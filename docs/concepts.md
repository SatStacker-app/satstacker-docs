---
title: Core Concepts
sidebar_position: 4
---

# Core Concepts

This page explains the data model SatStacker Engine uses and how a Smart Timing plan flows from creation to executed trades.

## Time zones

Send UTC timestamps with an explicit offset, preferably `Z`, such as `2026-05-15T14:24:32Z`. Responses use ISO 8601 and may encode UTC as `Z` or `+00:00`; accept both. Do not send timezone-naive values or date-only values for execution timestamps. Convert local venue times to UTC before calling endpoints.

Date-only fields (such as the `month` parameter on billing endpoints) are interpreted in UTC.

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

Partner users are **idempotent on `(partner_slug, environment, partner_user_id)`**. Re-sending the same `partner_user_id` updates the existing record:

- `email`, `auth_provider`, `consent_version`, `consent_timestamp` are updated.
- `status` is refreshed to `linked` unless the user was previously `disabled` (which requires admin action to clear).

The user's `partner_user_id` is permanent. Once registered with SatStacker under a given partner, it cannot be reassigned to a different user.

### Disabling a user

To disable a partner user, send `PATCH /partner/v1/users/{partner_user_id}` with `{"status": "disabled"}`:

```bash
curl -X PATCH https://api.satstacker.app/partner/v1/users/user_abc_123 \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"status": "disabled"}'
```

Disabling a user has two cascading effects:

- All of the user's `active` plans are set to `paused`.
- Instructions that have never been delivered are cancelled and their current-window reservations refunded. Delivered instructions remain settleable and can be redelivered after lease expiry; confirm their final exchange outcomes.

To re-enable the user, send the same endpoint with `{"status": "linked"}`. Note that re-enabling does not automatically reactivate the user's plans, the partner must re-send each plan with `status: "active"` to resume.

## Partner Plan

A Smart Timing DCA plan created by a partner user.

| Field | Type | Description |
|-------|------|-------------|
| `partner_user_id` | string | The user this plan belongs to. |
| `partner_plan_id` | string | Your stable plan ID. |
| `amount_usd` | decimal string | All-in USD spending budget per window, including exchange fees. Defaults: min `1.00`, max `1,000,000.00`; deployment limits may differ. |
| `frequency` | string | `daily`, `weekly`, or `bi-weekly`. |
| `smart_timing_enabled` | boolean | If false, the plan exists but generates no Smart Timing executions. |
| `start_date` | ISO datetime \| null | Create-only window anchor. If omitted, defaults to creation time. Omit on updates; changing it returns 409. |
| `status` | string | `active`, `paused`, or `cancelled`. |

Partner plans are **idempotent on `(partner_slug, environment, partner_plan_id)`**. Re-sending updates the plan, but there are specific rules about when the buying window resets — see [Window reset behavior](#window-reset-behavior) below.

### Window reset behavior

When you call `POST /partner/v1/plans` for a plan that already exists, the plan's current buying window and all associated tranche state is **only reset** when one of the following is true:

- The `amount_usd` changed from its previous value.
- The `frequency` changed.
- The plan was previously `paused` and is being reactivated. Cancelled plans cannot be reactivated.
- Smart Timing changes from disabled to enabled.
- The plan has no `window_start` yet (defensive).

A reset returns `409` if any delivered execution remains unresolved. Confirm it before retrying the update. Existing-plan resets start at the update time and receive a new `window_id`. Never-delivered instructions are cancelled before a reset.

Otherwise, the editable fields (`smart_timing_enabled`, `status`) are updated and the existing window is preserved. This means a duplicate or retried create call mid-window does not destroy in-flight Smart Timing state.

### Updating a plan

`POST /plans` expects a complete plan representation, not a partial PATCH: include the user ID, plan ID, amount and frequency, and send `status` and `smart_timing_enabled` explicitly. If omitted, those two fields default to `active` and `true`. Omit `start_date` on existing-plan updates.

To update a plan's parameters, send `POST /partner/v1/plans` with the same `partner_plan_id` and the new values.

Common update scenarios:

**Change amount.** User wants to go from $100/week to $200/week. POST with `partner_plan_id` unchanged and `amount_usd: "200.00"`. SatStacker resets the buying window (per [window reset rules](#window-reset-behavior)) so the new amount applies cleanly from the moment of update.

**Change frequency.** User wants to switch from weekly to bi-weekly. POST with `frequency: "bi-weekly"`. Window resets.

**Pause without cancelling.** Set `status: "paused"`. The plan stops generating executions. Never-delivered instructions are cancelled and refunded; history is preserved. Delivered instructions still require final confirmation. To resume, POST again with `status: "active"`. This counts as reactivation and resets the window.

**Cancel.** Set `status: "cancelled"`. Plan stops generating executions. Never-delivered instructions are cancelled; delivered instructions retain their reservation and confirmation path. Cancelled plans cannot be reactivated. To restart DCA for the same user, create a new plan with a fresh `partner_plan_id`.

**Toggle Smart Timing off.** Set `smart_timing_enabled: false`. The plan record is preserved. Never-delivered instructions are cancelled and no new Smart Timing instructions are generated. Delivered instructions still require confirmation. Re-enabling resets the window after those outcomes are settled. Useful for partners offering Smart Timing as an opt-in feature their users can toggle.

### Plan ownership

A `partner_plan_id` is permanently bound to the `partner_user_id` it was first created under. Attempting to assign the same `partner_plan_id` to a different `partner_user_id` returns `409 Conflict`. To move a plan between users, cancel the existing plan and create a new one with a fresh `partner_plan_id`.

## Execution Instruction

A signal from SatStacker that a Smart Timing buy should fire for a specific plan.

When the Smart Timing engine decides a tranche should execute, it writes a `PartnerExecution` row with:

| Field | Type | Description |
|-------|------|-------------|
| `execution_id` | string | Opaque identifier (`exec_*`). Use this when confirming. |
| `idempotency_key` | string | Opaque deduplication key for one attempt. Stable on lease redelivery; a new terminal-remainder attempt gets a new key. Do not parse or construct it. |
| `window_id` | string \| null | Budget-generation identity, distinct even for resets at the same timestamp. |
| `window_start` | ISO datetime \| null | Original opening anchor for this instruction. |
| `tranche_key` | string \| null | Zero-based normal tranche index or `failsafe`; informational, not a deduplication key. |
| `amount_usd` | decimal string | Maximum all-in customer debit, including exchange fees, for this instruction. |
| `reason` | string | `smart_timing` (currently the only value). |
| `status` | string | `pending`, `sent`, `filled`, `partial`, `failed`, `cancelled`. |
| `lease_expires_at` | ISO datetime | When the current delivery lease expires. Returned by `GET /executions/due`. |
| `delivered_count` | integer | Number of times this execution has been delivered to the partner. |

The three window fields are nullable for legacy historical compatibility. Newly generated instructions populate them. See [Amounts, Fees and Execution Outcomes](/execution-contract) for confirmation field definitions.

The lifecycle of an execution:

1. **`pending`** — written by the SatStacker scheduler. Not yet delivered to the partner.
2. **`sent`** — returned to the partner via `GET /executions/due`. Leased for 5 minutes.
3. **Terminal** — `filled`, `partial`, `failed`, or `cancelled` based on the partner's final confirmation. Never-delivered instructions can also be cancelled by plan/user changes or expiry.

If a `sent` execution is not confirmed before its lease expires, it returns to the eligible pool and is re-delivered on the next `GET /executions/due` poll. The `execution_id` and `idempotency_key` never change between deliveries. Partners should dedupe on either of these.

## Trade

Report the total customer debit, including fees, and net BTC credited. `partner_fee_usd` is the fee breakdown already within that debit; it is not added to the instruction or charged again.

A record of a partner's actual trade attempt — successful, partial, failed, or cancelled.

Trades are written when a partner calls `POST /partner/v1/executions/{id}/confirm`. Each trade is linked back to:

- The `PartnerExecution` that generated it (one-to-one)
- The `PartnerPlan` the execution belonged to
- The `PartnerUser` who owns the plan

For successful trades, SatStacker records `usd_amount`, `btc_amount`, `execution_price`, `executed_at`, and optionally `partner_fee_usd`. For failures, the `failure_reason` is recorded for audit but no financial values are stored.

### Partial fill example

A weekly bear plan with an all-in `amount_usd: 100.00` has fired its first 50% tranche. The engine reserved `$50.00` against the plan's window budget and SatStacker emitted an execution with `amount_usd: 50.00`.

The exchange completes only a $20.00 debit and definitively cancels the remaining order. This example has no separately reported exchange fee. Partner confirms:

```json
{
  "partner_order_id": "order_partial_001",
  "status": "partial",
  "executed_at": "2026-05-15T14:24:32Z",
  "usd_amount": "20.00",
  "btc_amount": "0.00020000",
  "execution_price": "100000.00"
}
```

SatStacker:

- Records a `PartnerTrade` for $20.00 / 0.00020000 BTC
- Refunds the unfilled $30.00 back to the plan's window budget
- Marks the execution as `partial` (terminal state)

The normal tranche advances after this terminal attempt. The returned $30 remains available for a later remainder signal in the same window. Normal subsequent tranches retain their scheduled allocation, capped by the available balance. A partial/failed remainder can receive a new instruction ID on a later eligible signal. An old-window refund never funds a new window.

After confirming this terminal result, continue polling. SatStacker manages the same-window remainder; successful deployment still depends on prompt execution and confirmation.

The `partner_order_id` field links each trade back to the partner's own internal order/trade record. SatStacker enforces uniqueness on `(partner, environment, partner_order_id)`, so the same `partner_order_id` cannot be used to confirm two different executions in the same environment.

## How a Smart Timing plan flows through the system

1. **User opts in** inside the partner platform and consents to Smart Timing.
2. Partner calls **`POST /users`** to register the user with SatStacker.
3. Partner calls **`POST /plans`** to create the Smart Timing plan.
4. The **SatStacker scheduler** runs continuously. For each active plan whose `next_run` has elapsed, it invokes the Smart Timing engine.
5. The engine may decide a buy should fire. If so, it writes a `PartnerExecution` with `status=pending` and reserves the tranche amount against the plan's window budget.
6. The partner polls **`GET /executions/due`** on a regular cadence. SatStacker returns pending executions (and any sent-but-unconfirmed executions whose lease has expired), marking each as `sent` with a 5-minute lease. If the partner has registered a webhook, SatStacker also sends an `executions.available` notification, allowing the partner to poll immediately rather than waiting for the next interval.
7. Partner executes the buy on their side using their own custody and market access.
8. Partner calls **`POST /executions/{id}/confirm`** with the outcome:
   - **`filled`** — trade succeeded. SatStacker records the trade and refunds any unspent budget difference (e.g., if the partner spent slightly less than the reserved amount).
   - **`partial`** — partial fill. SatStacker records the trade and refunds the unfilled portion to the plan's window, leaving the returned dollars available to a later same-window remainder signal.
   - **`failed`** — trade failed. SatStacker refunds the full reservation and records the failure reason.
   - **`cancelled`** — partner decided not to execute. Same refund behavior as failed.
9. The cycle repeats until the plan's buying window expires, at which point the window rolls forward and the plan's window budget resets to the full `amount_usd`.

## Tenancy and isolation

All API endpoints are automatically scoped to the partner identified by your API key. Concretely:

- `GET /executions/due` only returns executions belonging to your plans.
- `POST /executions/{id}/confirm` returns `404` if the `execution_id` belongs to another partner.
- `GET /billing/monthly` returns only your usage.

This is enforced at the database query level, not just the application layer.

## Cascade behavior reference

Common operations and their side effects on related records:

| Action | User effect | Plan effect | Execution effect |
|---|---|---|---|
| `POST /users` with new ID | created as `linked` | none | none |
| `POST /users` with existing ID | metadata updated | none | none |
| `PATCH /users/{id}` with `status=disabled` | → `disabled` | all `active` plans → `paused` | never-delivered → `cancelled`; delivered require confirmation |
| `PATCH /users/{id}` with `status=linked` | → `linked` | no change (still `paused`) | no change |
| `POST /plans` with new ID | none | created as `active` | none |
| `POST /plans` with `status=cancelled` | none | → `cancelled` | never-delivered → `cancelled`; delivered require confirmation |
| `POST /plans` with `status=paused` | none | → `paused` | never-delivered → `cancelled`; delivered require confirmation |
| Window naturally expires | none | window rolls forward | new executions will appear in next cycle |

Re-enabling a disabled user does **not** automatically reactivate their plans. To resume, re-POST each plan with `status: "active"`.

### Window identity and asynchronous delivery

Instructions include `window_id`, `window_start` and `tranche_key` (a zero-based normal tranche index or `failsafe`). Treat idempotency keys as opaque. At most one unresolved instruction exists per plan. Lease redelivery retains its identity; a new attempt after a terminal remainder outcome gets a new identity. A new window does not issue a buy while any older delivered order remains unresolved. Expired unused budgets are not added to subsequent windows. Missing prices, exchange failures or delayed confirmation can prevent full window deployment.
