---
title: Getting Started
sidebar_position: 2
---

# Getting Started

This guide walks through credential verification, user/plan registration, execution polling and final confirmation. Setup can be completed without waiting for a buy. The first real sandbox instruction depends on the shared timing engine and market prices; it is not guaranteed within a fixed number of minutes. Use [Sandbox Testing](/sandbox-testing) for offline client fixtures and end-to-end acceptance checks.

## Prerequisites

- A sandbox API key from SatStacker (request via **support@satstacker.app**)
- A way to make HTTPS requests. Curl examples are shown throughout
- A test user inside your platform with consent to enable Smart Timing
- An exchange sandbox or local order simulator isolated from live customer funds
- A durable attempt ledger that deduplicates instructions before exchange submission

## Step 1 — Verify your credentials

Confirm your API key works and SatStacker recognizes you as a partner:

```bash
curl https://api.satstacker.app/partner/v1/me \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE"
```

A successful response confirms which partner identity is associated with the key:

```json
{
  "partner_slug": "your_partner_slug",
  "partner_name": "Your Partner Name",
  "status": "active",
  "environment": "test"
}
```

If you get a `401`, double-check the `Authorization` header format. It must be `Bearer ` followed by the key, with a single space.

## Step 2 — Link a partner user

After a user in your platform opts in to Smart Timing and accepts the disclosure copy, register them with SatStacker:

```bash
curl https://api.satstacker.app/partner/v1/users \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_user_id": "user_abc_123",
    "email": "user@example.com",
    "auth_provider": "email",
    "consent_accepted": true,
    "consent_version": "satstacker-smart-timing-v1",
    "consent_timestamp": "2026-05-15T07:55:00Z"
  }'
```

`partner_user_id` is your own stable user identifier. SatStacker treats this as the primary key on your side. Re-sending the same `partner_user_id` updates the existing record rather than creating a duplicate.

## Step 3 — Create a Smart Timing plan

Once the user is linked, create their DCA plan:

```bash
curl https://api.satstacker.app/partner/v1/plans \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_user_id": "user_abc_123",
    "partner_plan_id": "plan_xyz_456",
    "amount_usd": "100.00",
    "frequency": "weekly",
    "smart_timing_enabled": true,
    "status": "active"
  }'
```

The amount is an all-in spending budget including exchange fees. A $100 window must not debit more than $100 across its instructions. Report total debit in `usd_amount`, net credited BTC in `btc_amount`, and the fee already included in the debit in `partner_fee_usd`. See [Amounts, Fees and Execution Outcomes](/execution-contract).

Like users, plans are idempotent on `partner_plan_id` within a partner environment. Re-sending the same plan updates editable fields, and if the amount or frequency changes, SatStacker resets the plan's buying window. See [Plans](/concepts#partner-plan) for the full reset rules.

## Step 4 — Poll for due executions

The SatStacker scheduler runs continuously, deciding when Smart Timing should fire for each active plan. When the algorithm decides a buy should occur, it writes a `PartnerExecution` row with status `pending`.

Your integration polls for these on a regular cadence:

```bash
curl https://api.satstacker.app/partner/v1/executions/due \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE"
```

A successful response returns an array of due execution instructions. The example is a $100 weekly bear window with a 50% first tranche; execution patterns depend on the frozen opening regime:

```json
[
  {
    "execution_id": "exec_8e1d3f9a2b4c5d6e7f8a9b0c",
    "partner_slug": "your_partner_slug",
    "partner_user_id": "user_abc_123",
    "partner_plan_id": "plan_xyz_456",
    "side": "buy",
    "asset": "BTC",
    "spend_currency": "USD",
    "amount_usd": "50.00",
    "reason": "smart_timing",
    "window_id": "0123456789abcdef0123456789abcdef",
    "window_start": "2026-05-15T08:00:00Z",
    "tranche_key": "0",
    "idempotency_key": "plan_xyz_456:2026-05-15T08:00:00+00:00:0123456789abcdef0123456789abcdef:0:attempt-1",
    "created_at": "2026-05-15T14:23:00Z",
    "lease_expires_at": "2026-05-15T14:28:00Z",
    "delivered_count": 1
  }
]
```

Each instruction is **leased to you for 5 minutes** when returned. If you do not confirm it within that window, the same instruction becomes eligible for redelivery, with the same `execution_id` and `idempotency_key`, on a later poll. Always dedupe on `idempotency_key` on your side.

Recommended polling cadence: **once every 60 seconds at the partner level**, not per user. See [Rate Limits](/rate-limits) for guidance.

You can only confirm an execution after it has been returned by `GET /partner/v1/executions/due`. Returning an execution marks it as `sent` and starts the lease. Confirming an execution that is still `pending` returns `409 Conflict`.

### Optional: register a webhook

You can register a webhook to be notified when new executions are available:

```bash
curl -X POST https://api.satstacker.app/partner/v1/webhooks \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/satstacker/webhook"
  }'
```

Webhooks are a latency optimization. Your worker should still poll `GET /partner/v1/executions/due` once every 60 seconds as a fallback.

When your webhook receives `executions.available`, immediately poll `/partner/v1/executions/due`. Do not treat the webhook payload itself as an execution instruction.

See [Webhooks](/webhooks) for signature verification and delivery behavior.

If no executions are pending, the response is an empty array:

```json
[]
```

This is the normal response when the engine has not decided to fire any tranches recently. Continue polling on your regular cadence.

## Step 5 — Confirm execution outcomes

After your platform executes the trade, or fails to, report the outcome back. For a successful fill:

```bash
curl -X POST https://api.satstacker.app/partner/v1/executions/exec_8e1d3f9a2b4c5d6e7f8a9b0c/confirm \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_order_id": "your_internal_order_id_001",
    "status": "filled",
    "executed_at": "2026-05-15T14:24:32Z",
    "usd_amount": "50.00",
    "btc_amount": "0.00050000",
    "execution_price": "100000.00",
    "partner_fee_usd": "0.00"
  }'
```

For a definitive zero-spend failure, such as an exchange rejection for insufficient funds, report the final outcome. Do not report an uncertain network timeout as failed: first look up the original exchange attempt.

```bash
curl -X POST https://api.satstacker.app/partner/v1/executions/exec_8e1d3f9a2b4c5d6e7f8a9b0c/confirm \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_order_id": "your_internal_order_id_001",
    "status": "failed",
    "failure_reason": "insufficient_funds"
  }'
```

For a current-window execution, a failure returns the reserved budget to that window. Normal tranche attempts advance on any terminal result; returned dollars remain available for a later remainder signal. A terminal remainder can receive a new instruction ID on a later signal. Old-window confirmations do not fund a newer window. Only report failed when the exchange order is definitively unsuccessful; reconcile uncertain timeouts against the original order.

See [Confirm Execution](/api/confirm-execution) for the full schema, partial-fill handling, idempotency rules, and error codes.

## A complete execution lifecycle

Here's what a single execution looks like from creation to confirmation, with an illustrative timeline. These offsets describe delivery and confirmation after an instruction exists; they are not a promise about when the strategy will trigger:

**T+0:00** — Smart Timing engine decides a tranche should fire. SatStacker writes a `PartnerExecution` row with `status: pending`. If you have a webhook registered, SatStacker fires `executions.available` to your endpoint.

**T+0:01** — Your webhook handler returns `200 OK` and triggers your worker to poll.

**T+0:02** — Your worker calls `GET /partner/v1/executions/due`. SatStacker returns the execution with `status` updated to `sent` and `lease_expires_at` set to `T+5:02` (five minutes after delivery).

**T+0:03** — Your worker executes the buy on your venue. Receives an internal order ID like `your_order_001`.

**T+0:05** — Your worker calls `POST /partner/v1/executions/{execution_id}/confirm`:

```json
{
  "partner_order_id": "your_order_001",
  "status": "filled",
  "executed_at": "2026-05-15T14:24:32Z",
  "usd_amount": "50.00",
  "btc_amount": "0.00050000",
  "execution_price": "100000.00",
  "partner_fee_usd": "0.00"
}
```

Response:

```json
{
  "ok": true,
  "execution_id": "exec_8e1d3f9a2b4c5d6e7f8a9b0c",
  "status": "filled",
  "partner_order_id": "your_order_001"
}
```

**T+0:08** — Brief network blip. Your worker times out waiting for the confirm response and retries with the identical payload.

**T+0:09** — SatStacker detects the duplicate, returns success without creating a second trade:

```json
{
  "ok": true,
  "execution_id": "exec_8e1d3f9a2b4c5d6e7f8a9b0c",
  "status": "filled",
  "partner_order_id": "your_order_001",
  "replayed": true
}
```

The execution is now `filled`. The trade appears in your monthly billing report. The plan's window state advances; the next tranche or window roll happens automatically.

## What's next

Once a genuine sandbox instruction has been executed and confirmed, complete the remaining [sandbox acceptance checks](/sandbox-testing) before production cutover:

- **Operations readiness** — prepare the durable ledger, recovery procedures and monitoring described in [Operations and Reconciliation](/operations).
- **Production cutover** — when you are ready to go live, request a production key (`sse_live_*`) and switch from your sandbox key to your production key. The base URL, endpoints, and payloads are identical between sandbox and production.
- **Billing visibility** — call `GET /partner/v1/billing/monthly?month=YYYY-MM` to see usage and fees for any billing month.
- **Per-user reconciliation** — `GET /partner/v1/billing/monthly/users` returns volume by user for finance review.

Continue to [Authentication](/authentication) for details on API key formats and security, or jump to the [API Reference](/api/health) for full endpoint documentation.
