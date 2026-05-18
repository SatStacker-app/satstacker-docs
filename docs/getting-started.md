---
title: Getting Started
sidebar_position: 2
---

# Getting Started

This guide walks through a complete sandbox integration end-to-end. The goal is to get from "I have a sandbox API key" to "I've executed a confirmed Smart Timing trade against the sandbox" in under 30 minutes.

## Prerequisites

- A sandbox API key from SatStacker (request via **support@satstacker.app**)
- A way to make HTTPS requests — curl examples are shown throughout
- A test user inside your platform with consent to enable Smart Timing

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
    "consent_timestamp": "2026-05-15T15:00:00Z"
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

Like users, plans are idempotent on `partner_plan_id` within a partner environment. Re-sending the same plan updates editable fields, and if the amount or frequency changes, SatStacker resets the plan's buying window. See [Plans](/concepts#partner-plan) for the full reset rules.

## Step 4 — Poll for due executions

The SatStacker scheduler runs continuously, deciding when Smart Timing should fire for each active plan. When the algorithm decides a buy should occur, it writes a `PartnerExecution` row with status `pending`.

Your integration polls for these on a regular cadence:

```bash
curl https://api.satstacker.app/partner/v1/executions/due \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE"
```

A successful response returns an array of due execution instructions:

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
    "amount_usd": "33.33",
    "reason": "smart_timing",
    "idempotency_key": "plan_xyz_456:2026-05-15T08:00:00+00:00:0",
    "created_at": "2026-05-15T14:23:00Z",
    "lease_expires_at": "2026-05-15T14:28:00Z",
    "delivered_count": 1
  }
]
```

Each instruction is **leased to you for 5 minutes** when returned. If you do not confirm it within that window, SatStacker assumes your worker crashed and re-issues the same instruction, with the same `execution_id` and `idempotency_key`, on a later poll. Always dedupe on `idempotency_key` on your side.

Recommended polling cadence: **once every 60 seconds at the partner level**, not per user. See [Rate Limits](/rate-limits) for guidance.

You can only confirm an execution after it has been returned by `GET /partner/v1/executions/due`. Returning an execution marks it as `sent` and starts the lease. Confirming an execution that is still `pending` returns `409 Conflict`.

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
    "usd_amount": "33.33",
    "btc_amount": "0.00033330",
    "execution_price": "100000.00",
    "partner_fee_usd": "0.00"
  }'
```

For a failure, such as insufficient funds, market closed, or network error:

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

Failed executions cause SatStacker to refund the reserved budget back to the plan's window. The Smart Timing engine's catchup logic will pick it up on a subsequent tick or roll it into the failsafe at end of window.

See [Confirm Execution](/api/confirm-execution) for the full schema, partial-fill handling, idempotency rules, and error codes.

## What's next

You now have the full flow working end-to-end:

- **Production cutover** — when you are ready to go live, request a production key (`sse_live_*`) and switch from your sandbox key to your production key. The base URL, endpoints, and payloads are identical between sandbox and production.
- **Billing visibility** — call `GET /partner/v1/billing/monthly?month=YYYY-MM` to see usage and fees for any billing month.
- **Per-user reconciliation** — `GET /partner/v1/billing/monthly/users` returns volume by user for finance review.

Continue to [Authentication](/authentication) for details on API key formats and security, or jump to the [API Reference](/api/health) for full endpoint documentation.
