---
title: Operations and Reconciliation
sidebar_position: 8.5
---

# Operations and Reconciliation

SatStacker issues durable instructions; your exchange executes them and reports
the final result. Operate the integration with a durable attempt ledger,
regular polling, and reconciliation against your exchange's order records.

## Persist the attempt before execution

Retain these fields for every instruction:

- Partner environment, external user/plan IDs, `execution_id` and `idempotency_key`.
- `window_id`, `window_start`, instruction amount and delivery lease timestamps.
- Your local attempt ID, exchange order ID, order status and final fill/debit totals.
- Exact confirmation payload, HTTP outcome and whether SatStacker acknowledged it.

Use a unique key on environment and `idempotency_key` in your own ledger. Persist
the instruction before sending an exchange order, and use an exchange-supported
client order identifier or equivalent deduplication mechanism. A local unique key
alone does not close the gap between an exchange accepting an order and your
worker recording the response; your recovery path must locate the original order.

## Polling and batch handling

Poll `/partner/v1/executions/due` once every 60 seconds per partner environment.
Webhooks can wake the worker sooner, but are not execution instructions. The
endpoint defaults to `limit=50` and accepts limits from 1 to 500.

Choose a batch size your worker can safely process and confirm within the
five-minute default lease. If a batch is full, additional work may be waiting;
drain it using bounded concurrency and the agreed request-volume limits. Multiple
workers must share the same durable deduplication ledger.

Leases are delivery ownership, not exchange order cancellation. Their expiry
never authorizes an additional buy for an already placed order. The same
instruction may be delivered again with its original identity.

## Recovery decisions

| Situation | Action |
| --- | --- |
| Order submission timed out | Query the exchange using the original client/attempt identity. Resolve whether an order exists before another submission. Keep the SatStacker instruction unresolved while the outcome is uncertain. |
| Exchange order is still working | Wait, reconcile, or definitively cancel the remaining order. Do not send a terminal partial/failed outcome while it can still fill. |
| Trade finished; confirmation timed out | Retry only the exact saved confirmation payload. Do not place another buy. |
| Instruction is redelivered | Look up its original attempt. Continue reconciliation or repeat the saved final confirmation as needed; do not start another exchange order. |
| Confirmation returns 409 | Resolve the reported conflict using your attempt ledger. Do not change final amounts or invent another order ID to force acceptance. |
| Confirmation returns 400/422 | Correct the payload only if the exchange records support the correction. A confirmed execution cannot be amended through a different confirmation. |
| Authentication returns 401/403 | Stop new financial actions for the affected credential/environment and escalate. Retain completed exchange results for later confirmation recovery. |
| API request returns 429 | Honor `Retry-After` when present; otherwise apply backoff with jitter. |
| API request fails transiently | Apply backoff with jitter. Keep exchange execution separate from API retries. |
| Venue minimum prevents a zero-spend order | Report failed with a reason, retain the instruction record, and resolve repeated dust attempts with SatStacker. Never increase the customer debit to meet a minimum. |

## Pausing, cancellation and window rollover

Pause, cancellation, user disable and Smart Timing off cancel instructions that
were never delivered. An instruction already delivered can remain eligible for
redelivery and confirmation, even when the plan has stopped. If the exchange can
still fill its order, reconcile or cancel it definitively before reporting an
outcome. A plan-status change cannot recall a trade already accepted by the venue.

At most one unresolved instruction per plan is allowed. An old delivered order
can delay purchases for a newer window until it is settled. New/reset/rolled
windows have distinct IDs; an old confirmation cannot refund into a newer budget.
Unused expired budget does not automatically carry into the next window.

Keep polling and final-result confirmation available during a controlled pause.
When shutting down a worker, first persist all in-flight state and reconcile any
accepted exchange orders. A restart recovers from that ledger.

## Monitoring

Track polling health, authentication failures, confirmation error/retry rates,
oldest unresolved instruction age, duplicate delivery frequency, exchange order
status, webhook failures, and customer debit versus instruction amount. Alert
when an instruction remains unresolved beyond the expected exchange processing
time, especially beyond the default five-minute lease.

An empty due response is not proof that the scheduler is healthy or that there
are no outstanding orders. Check your unresolved-attempt ledger and application
health separately. `GET /partner/v1/health` checks API responsiveness; it does not
certify scheduler progress, exchange connectivity or successful deployment of a
window's full budget.

The current API does not expose a per-execution status lookup, execution-history
export, or a lease-renewal endpoint. Retain your own instruction and confirmation
history. Use exact confirmation replay where applicable and contact SatStacker
when your ledger and API outcomes disagree.

## Financial reconciliation

Compare your exchange's final order records with your attempt ledger daily.
Reconcile all-in USD debits, fee breakdowns, net BTC, instruction identity and
acknowledged confirmation. Use the definitions in [Amounts, Fees and Execution
Outcomes](/execution-contract).

Monthly endpoints provide aggregate reporting:

- `/partner/v1/billing/monthly?month=YYYY-MM`: filled/partial USD volume, trade count,
  funded-user count, pricing and partner fees.
- `/partner/v1/billing/monthly/users?month=YYYY-MM&limit=1000&offset=0`: per-user
  volume and BTC totals, with offset pagination.

The reporting month is based on the reported `executed_at`, not the confirmation
arrival time. A closed calendar period can still receive late confirmations;
`period_status: closed` is not an immutable accounting snapshot.

The current funded-user calculation and per-user report filter plans by their
current `smart_timing_enabled` flag. Disabling Smart Timing can therefore change
those historical views. The headline executed-volume total uses filled/partial
trades without that plan filter. Preserve your own month-end snapshots and
resolve differences with SatStacker before treating reports as a final invoice.

These endpoints are aggregates, not a complete order-level audit export. The
current reports sum all-in USD debits; separately recorded exchange fees are not
added again. Commercial partner fees are separate from customer exchange debits.

## Webhook recovery

Keep normal polling running when notifications fail. By default a webhook is
paused after 10 consecutive failures, and individual payloads are not retried.
Inspect `GET /partner/v1/webhooks` for status and failure counters. Re-registering
reactivates it and generates a new secret; update your signature verifier from
the successful registration response.

If a registration response is lost, the secret cannot be recovered with GET.
Coordinate another registration, persist its returned secret, and update the
handler. Do not put registration in a generic automatic retry loop.

## Support and incident handoff

Contact **support@satstacker.app** with your partner slug, environment, affected
execution/window IDs, UTC incident times, sanitized status codes/error messages,
local attempt IDs and a summary of the exchange order outcomes. Do not include
API keys, webhook secrets or customer credentials.

Agree monitoring ownership, launch traffic expectations and escalation contacts
during onboarding. This guide does not promise an uptime SLA, a specific support
response time or an automatic venue reconciliation service.
