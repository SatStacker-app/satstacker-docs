---
title: Sandbox Testing
sidebar_position: 7.5
---

# Sandbox Testing

Sandbox uses the same timing engine and price-driven cadence rules as production.
It isolates partner data by a `sse_test_*` API key; it is not an accelerated clock
or a separate exchange simulator. Test workers must route orders to your own
sandbox or simulator, never to your live trading infrastructure.

## First connection

You can verify credentials and register a test user and plan without waiting for
an execution. Follow [Getting Started](/getting-started) for those steps.

An empty response from `/partner/v1/executions/due` is expected until the engine
decides a buy is due. The first buy is not guaranteed within 30 minutes. Current
production windows can last 24 hours, 7 days, or 14 days, and timing depends on
opening regime, prices and any unresolved instruction for that plan.

There is no public force-execution or time-advance endpoint in the current
partner API. Do not change the host clock, backdate a production plan, or use a
live key to speed up testing.

## Deterministic client checks

Download [sandbox-contract.json](/fixtures/sandbox-contract.json) for local client tests.
These are **offline client fixtures**, not records in SatStacker's sandbox. The
same fixture IDs cannot be confirmed against the live API unless an actual
instruction with those IDs was issued there.

Use the fixtures in your local HTTP mock or unit tests to verify:

- An empty due response leaves the worker idle.
- A full-fill instruction maps to one all-in exchange budget.
- A redelivered instruction has the same identity and does not place another buy.
- A partial-fill confirmation includes fees within its actual debit.
- A replayed confirmation response settles the attempt once.
- A failed/cancelled attempt reports a final zero-spend outcome and a reason.
- A 409 conflict stops automatic financial actions and goes to reconciliation.

Mock fixtures test client behavior. They do not validate SatStacker timing,
authentication, actual lease transitions or exchange execution.

## End-to-end sandbox checks

Use real test-environment records and actual instructions for the following
checks. Never substitute fixture IDs when making API confirmations.

| Check | Expected behavior |
| --- | --- |
| Credentials | `/me` returns your partner with `environment: test`. |
| User/plan registration | Repeating unchanged IDs updates metadata or preserves the plan window without creating another plan. |
| Natural execution | Poll with the test key until a real instruction arrives; verify amount, window identity and your user's plan mapping. |
| Exchange execution | Route to your exchange simulator and enforce the instruction's all-in debit limit. |
| Confirmation | Send the definitive full or partial result and retain the exact payload. |
| Replay | Send the identical confirmation again; receive success with `replayed: true`. |
| Lease recovery | On a separate unexecuted instruction, let the lease expire and poll again. Identity stays the same. Do not place two orders. |
| Pause/off/cancel | Never-delivered instructions stop. Delivered instructions still require definitive settlement and may be redelivered. |
| Window isolation | A delayed old-window result does not fund or advance a newer budget generation. |
| Webhook failure | Your polling worker continues even if notifications stop. |
| Environment isolation | A live key cannot confirm a test execution, and vice versa. Do not place live orders during this check. |

Several checks require separate genuine instructions and may span multiple
windows. Coordinate a test schedule and unresolved-order reconciliation with
SatStacker before production cutover. Record the instructions, exchange outcomes
and API responses you used for acceptance.

## Production cutover

Before requesting a production key, verify that client fixtures pass, a real
sandbox instruction has completed end to end, unknown exchange outcomes can be
recovered, and your venue minimum/fee policies are agreed. Use the [Operations
Guide](/operations) to prepare monitoring and recovery procedures.
