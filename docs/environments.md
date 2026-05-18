---
title: Environments
sidebar_position: 7
---

# Environments

SatStacker Engine supports two environments:

| Environment | Key prefix | Purpose |
|---|---|---|
| Sandbox | `sse_test_` | Integration testing and non-production validation |
| Production | `sse_live_` | Live partner traffic and real user trading |

Both environments use the same base URL:

```text
https://api.satstacker.app
```

The API key determines which environment your request uses.

## Sandbox

Sandbox keys start with:

```text
sse_test_
```

Use sandbox for:

- Initial integration work
- API contract testing
- Worker testing
- Execution polling and confirmation testing
- Billing/reconciliation validation

Sandbox executions do not represent real user trades unless your own system chooses to execute them against a live venue. Partners should keep sandbox workers isolated from production trading infrastructure.

## Production

Production keys start with:

```text
sse_live_
```

Use production only after:

- The sandbox flow has been tested end-to-end
- Your polling worker handles retries and idempotency correctly
- Your confirmation flow is stable
- Your team has received a production key from SatStacker

Production executions represent live Smart Timing instructions for real users.

## Environment isolation

Sandbox and production data are isolated.

A sandbox key can only read and write sandbox records. A production key can only read and write production records.

This applies to:

- Partner users
- Plans
- Execution instructions
- Trade confirmations
- Billing reports

For example, if you create `partner_user_id: "user_123"` using a sandbox key, that user does not exist in production. Creating the same `partner_user_id` with a production key creates a separate production record.

## Checking your environment

Call `GET /partner/v1/me` to confirm which environment your key is using:

```bash
curl https://api.satstacker.app/partner/v1/me \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE"
```

Example response:

```json
{
  "partner_slug": "your_partner_slug",
  "partner_name": "Your Partner Name",
  "status": "active",
  "environment": "test"
}
```

If you expected production but see `"environment": "test"`, you are using a sandbox key.

## Production cutover

To move from sandbox to production:

1. Complete sandbox testing.
2. Request a production key from SatStacker.
3. Deploy the `sse_live_*` key to your production environment.
4. Confirm `GET /partner/v1/me` returns `"environment": "live"`.
5. Start production polling workers.

You do not need to change the base URL. Only the API key changes.
