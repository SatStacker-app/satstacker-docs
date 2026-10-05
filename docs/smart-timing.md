---
title: Smart Timing
sidebar_position: 5
---

# Smart Timing

SatStacker decides when to deploy a recurring Bitcoin budget within a daily
(24-hour), weekly (7-day), or bi-weekly (14-day) purchasing window. Partners
execute the resulting instructions on their own exchange. SatStacker does not
hold customer funds, and the exchange does not need to reproduce the algorithm.

## Window initialization and regime

New, reset and rolled windows use production strategy v2. Future windows are
staged first; the scheduler activates them at or after their opening once price
data is available. The opening regime compares the window opening price with
the previous 200 completed UTC daily closes. Insufficient history falls back to
bear; missing opening data defers activation.

The regime is frozen for the entire window. It is not recomputed continuously.
Existing untagged legacy windows finish using legacy rules and switch at their
next rollover or an explicit plan reset.

## Normal tranches and reference prices

Current v2 normal-phase rules are:

| Cadence | Bull allocations / dip targets | Bear allocations / dip targets |
| --- | --- | --- |
| Daily | 100% / -2.50% | 100% / -2.25% |
| Weekly | 100% / -2.00% | 50% / -4.00%, then 50% / -3.00% |
| Bi-weekly | 40% / -1.00%, 40% / -1.00%, 20% / -1.00% | 40% / -4.00%, 40% / -3.00%, 20% / -3.00% |

Weekly bull uses the original opening reference throughout its normal phase.
Other normal phases can ratchet the reference upward after a 0.50% rise. The
engine allows one normal tranche per eligible check. Each normal instruction
is capped by the actual available window balance.

The scheduler wakes approximately every 60 seconds by default. An individual
plan is normally checked about every three minutes, controlled by
`TRANCHE_DELAY_MINUTES`. Delivery and confirmation delays can postpone checks.

## Final smart phase and hard remainder deadline

The final phase freezes a checkpoint reference and seeks a 0.50% pullback.
The hard deadline stays fixed, even when the pullback does not happen.

| Cadence | Bull final phase / hard deadline | Bear final phase / hard deadline |
| --- | --- | --- |
| Daily | 45%–55% / 55% | 50%–60% / 60% |
| Weekly | 60%–65% / 65% | 50%–55% / 55% |
| Bi-weekly | 90%–95% / 95% | 50%–55% / 55% |

These percentages are elapsed fractions of the full cadence window. Bi-weekly
bull also retains an earlier smart failsafe from 70% to 90%: it can instruct the
remainder below the opening price or after a 1% dip from the trailing reference.
Weekly bull can still take its normal -2% opportunity at the 60% boundary.

Every remainder instruction uses exactly the available unreserved USD balance,
not the original plan amount. Thresholds are implementation details and may
change with future strategy versions.

## Reservations, outcomes and retries

Only one unresolved instruction is allowed per plan. Its dollars are reserved
when it is created. A normal instruction advances its tranche on any terminal
outcome: filled, partial, failed or cancelled. A partial fill returns the
unfilled reservation; a failed/cancelled attempt returns the full reservation.
These dollars remain available for a later remainder signal in that same window.

A terminal partial/failed/cancelled remainder can produce a new instruction
with a new `execution_id` and `idempotency_key` on a later eligible signal.
Expired leases redeliver the original instruction with its original identity.
Always deduplicate exchange orders by the instruction's idempotency key.

Confirm only final exchange outcomes. A network timeout with an uncertain order
result is not evidence that the trade failed. Reconcile the original exchange
order and retry its confirmation; do not submit a second market order.

## Window boundaries and stopping plans

Instructions include `window_id`, `window_start` and `tranche_key`. Window IDs
identify distinct budget generations, including resets with an unchanged anchor.
Refunds and tranche updates apply only to the instruction's own current window.
An old-window confirmation cannot increase a newer window's available balance.

Pause, cancellation, user disable, Smart Timing off and window expiry cancel
instructions that have never been delivered. Delivered instructions remain
available for redelivery and confirmation because the exchange may already
have executed them. A new window can be staged while an old delivered order is
unresolved, but it cannot generate a buy until that outcome is confirmed.

The algorithm targets spending within the window; exchange failures, missing
price data, delayed polling or unresolved orders can prevent full deployment.
An expired window's unused budget is not automatically added to the next budget.
Partners should monitor unresolved orders and confirm them promptly.

## Partner responsibilities

Create/update the plan, poll for instructions, execute each instruction once,
and report its final outcome. Webhooks are a wake-up signal; polling remains the
source of truth. SatStacker handles timing, tranche state and window reservations.
