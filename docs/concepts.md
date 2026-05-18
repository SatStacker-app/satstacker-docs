---
title: Core Concepts
sidebar_position: 4
---

# Core Concepts

This page explains the data model SatStacker Engine uses and how a Smart Timing plan flows from creation to executed trades.

## Partner

A platform integrating SatStacker Engine. Partners are identified by a `partner_slug` (for display) and an internal partner ID (used in audit trails).

Each partner has:

- One or more **API keys** (sandbox and/or production)
- An optional **pricing tier override** (used for negotiated deals)
- An **active / disabled** status

Partner identity is determined by the API key on each request. You do not send `partner_slug` in request bodies, SatStacker resolves your partner from the authentication credential.

## Partner User

A user inside your platform who has opted in to Smart Timing.

| Field | Type | Description |
|-------|------|-------------|
| `partner_user_id` | string | Your stable user ID. Primary identifier. |
| `email` | string \| null | Optional contact email or relay email. |
| `auth_provider` | string \| null | `apple`, `google`, `email`, or other partner-side auth source. |
| `consent_accepted` | boolean | Must be `true`. SatStacker rejects users without explicit consent. |
| `consent_version` | string | Identifier for the consent language version shown to the user. |
| `consent_timestamp` | ISO datetime | When the user accepted consent. |
| `status` | string | `linked` (active) or `disabled` (admin action). |

Partner users are **idempotent on `(partner_slug, partner_user_id)`**. Re-sending the same `partner_user_id` updates the existing record:

- `email`, `auth_provider`, `consent_version`, `consent_timestamp` are updated.
- `status` is refreshed to `linked` unless the user was previously `disabled` (which requires admin action to clear).

The user's `partner_user_id` is permanent. Once registered with SatStacker under a given partner, it cannot be reassigned to a different user.

## Partner Plan

A Smart Timing DCA plan created by a partner user.

| Field | Type | Description |
|-------|------|-------------|
| `partner_user_id` | string | The user this plan belongs to. |
| `partner_plan_id` | string | Your stable plan ID. |
| `amount_usd` | decimal string | USD purchase amount per buying window. Min `1.00`, max `1,000,000.00`. |
| `frequency` | string | `daily`, `weekly`, or `bi-weekly`. |
| `smart_timing_enabled` | boolean | If false, the plan exists but generates no Smart Timing executions. |
| `start_date` | ISO datetime \| null | Window anchor. If omitted, defaults to creation time. |
| `status` | string | `active`, `paused`, or `cancelled`. |

Partner plans are **idempotent on `(partner_slug, partner_plan_id)`**. Re-sending updates the plan, but there are specific rules about when the buying window resets — see [Window reset behavior](#window-reset-behavior) below.

### Window reset behavior

When you call `POST /partner/v1/plans` for a plan that already exists, the plan's current buying window (and all associated state — `unspent_fiat_usd`, `tranches`, ratchet reference) is **only reset** when one of the following is true:

- The `amount_usd` changed from its previous value.
- The `frequency` changed.
- The plan was previously `paused` or `cancelled` and is being reactivated.
- The plan has no `window_start` yet (defensive).

Otherwise, the editable fields (`smart_timing_enabled`, `status`) are updated and the existing window is preserved. This means a duplicate or retried create call mid-window does not destroy in-flight Smart Timing state.

### Plan ownership

A `partner_plan_id` is permanently bound to the `partner_user_id` it was first created under. Attempting to assign the same `partner_plan_id` to a different `partner_user_id` returns `409 Conflict`. To move a plan between users, cancel the existing plan and create a new one with a fresh `partner_plan_id`.

## Execution Instruction

A signal from SatStacker that a Smart Timing buy should fire for a specific plan.

When the Smart Timing engine decides a tranche should execute, it writes a `PartnerExecution` row with:

| Field | Type | Description |
|-------|------|-------------|
| `execution_id` | string | Opaque identifier (`exec_*`). Use this when confirming. |
| `idempotency_key` | string | Deterministic key derived from plan ID, window start, and tranche index. |
| `amount_usd` | decimal string | USD amount the partner should spend on this tranche. |
| `reason` | string | `smart_timing` (currently the only value). |
| `status` | string | `pending`, `sent`, `filled`, `partial`, `failed`, `cancelled`. |

The lifecycle of an execution:

1. **`pending`** — written by the SatStacker scheduler. Not yet delivered to the partner.
2. **`sent`** — returned to the partner via `GET /executions/due`. Leased for 5 minutes.
3. **Terminal** — `filled`, `partial`, `failed`, or `cancelled` based on the partner's confirmation.

If a `sent` execution is not confirmed before its lease expires, it returns to the eligible pool and is re-delivered on the next `GET /executions/due` poll. The `execution_id` and `idempotency_key` never change between deliveries — partners should dedupe on either of these.

## Trade

A record of a partner's actual trade attempt — successful, partial, failed, or cancelled.

Trades are written when a partner calls `POST /partner/v1/executions/{id}/confirm`. Each trade is linked back to:

- The `PartnerExecution` that generated it (one-to-one)
- The `PartnerPlan` the execution belonged to
- The `PartnerUser` who owns the plan

For successful trades, SatStacker records `usd_amount`, `btc_amount`, `execution_price`, `executed_at`, and optionally `partner_fee_usd`. For failures, the `failure_reason` is recorded for audit but no financial values are stored.

The `partner_order_id` field links each trade back to the partner's own internal order/trade record. SatStacker enforces uniqueness on `(partner, partner_order_id)` — the same `partner_order_id` cannot be used to confirm two different executions.

## How a Smart Timing plan flows through the system

1. **User opts in** inside the partner platform and consents to Smart Timing.
2. Partner calls **`POST /users`** to register the user with SatStacker.
3. Partner calls **`POST /plans`** to create the Smart Timing plan.
4. The **SatStacker scheduler** runs continuously. For each active plan whose `next_run` has elapsed, it invokes the Smart Timing engine.
5. The engine may decide a buy should fire. If so, it writes a `PartnerExecution` with `status=pending` and reserves the tranche amount against the plan's `unspent_fiat_usd`.
6. The partner polls **`GET /executions/due`** on a regular cadence. SatStacker returns pending executions (and any sent-but-unconfirmed executions whose lease has expired), marking each as `sent` with a 5-minute lease.
7. Partner executes the buy on their side using their own custody and market access.
8. Partner calls **`POST /executions/{id}/confirm`** with the outcome:
   - **`filled`** — trade succeeded. SatStacker records the trade and refunds any unspent budget difference (e.g., if the partner spent slightly less than the reserved amount).
   - **`partial`** — partial fill. SatStacker records the trade and refunds the unfilled portion to the plan's window, allowing the engine to catch up on subsequent ticks.
   - **`failed`** — trade failed. SatStacker refunds the full reservation and records the failure reason.
   - **`cancelled`** — partner decided not to execute. Same refund behavior as failed.
9. The cycle repeats until the plan's buying window expires, at which point the window rolls forward and `unspent_fiat_usd` resets to the plan's full `amount_usd`.

## Tenancy and isolation

All API endpoints are automatically scoped to the partner identified by your API key. Concretely:

- `GET /executions/due` only returns executions belonging to your plans.
- `POST /executions/{id}/confirm` returns `404` if the `execution_id` belongs to another partner.
- `GET /billing/monthly` returns only your usage.

This is enforced at the database query level, not just the application layer.