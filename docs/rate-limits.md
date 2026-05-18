---
title: Rate Limits
sidebar_position: 8
---

# Rate Limits

During private partner integration, SatStacker does not enforce strict per-partner request quotas by default. Partners should follow the polling and retry guidance below. SatStacker may temporarily throttle abusive, accidental, or unusually high-volume traffic.

Production partners with higher expected throughput should coordinate expected request volume with SatStacker before launch.

## Recommended request patterns

| Endpoint | Recommendation |
|---|---|
| `GET /partner/v1/executions/due` | Poll once every 60 seconds per partner environment. Do not poll once per user. |
| `POST /partner/v1/executions/{execution_id}/confirm` | Confirm immediately after each trade attempt. Safe to retry the same confirmation payload. |
| `POST /partner/v1/users` | Call when a user opts in or when user metadata/consent changes. |
| `POST /partner/v1/plans` | Call when a plan is created or updated. Avoid sending unchanged plans on a tight loop. |
| `GET /partner/v1/billing/monthly` | Use for finance dashboards and reconciliation, not high-frequency polling. |
| `GET /partner/v1/billing/monthly/users` | Use for monthly user-level reconciliation. |

## Execution polling

Poll `GET /partner/v1/executions/due` at the partner level, not per user or per plan.

Recommended cadence:

```text
Every 60 seconds per partner environment
```

For example, if you have one sandbox worker and one production worker, each worker may poll once per minute using the appropriate API key.

Each returned execution is leased for 5 minutes. If your worker crashes or does not confirm the execution before the lease expires, the same execution may be returned again on a later poll with the same `execution_id` and `idempotency_key`.

Always dedupe execution attempts on your side using `idempotency_key`.

## Confirmation retries

`POST /partner/v1/executions/{execution_id}/confirm` is safe to retry with the exact same payload.

If SatStacker already recorded the same confirmation, the API returns a successful response with:

```json
{
  "ok": true,
  "execution_id": "exec_...",
  "status": "filled",
  "partner_order_id": "your_order_id",
  "replayed": true
}
```

Do not place a second market order when retrying confirmation. Retry only the confirmation request.

## Backoff guidance

If you receive transient network errors, use exponential backoff with jitter.

Suggested retry schedule:

```text
1 second
2 seconds
5 seconds
10 seconds
30 seconds
60 seconds
```

For execution confirmation, continue retrying until you receive a successful response or a non-retryable `4xx` error.

## Future hard limits

SatStacker may introduce explicit per-partner rate limits before general availability. If hard limits are enabled, responses may include `429 Too Many Requests` and a `Retry-After` header.
