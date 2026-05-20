---
title: Smart Timing
sidebar_position: 5
---

# Smart Timing

Smart Timing is SatStacker's tranche-based DCA algorithm. This page explains how it works at a conceptual level so your product, engineering, and customer-facing teams can understand and explain it.

## The problem with naive DCA

Most recurring Bitcoin purchases fire at the same time every week or month, regardless of where price sits. Over years that's fine, the dollar-cost-averaging principle smooths things out. But within any individual purchase, the user has no protection against buying at a local high.

If a user's weekly buy fires on Monday at 9am, they pay Monday's 9am price. If Bitcoin happens to be 4% above its weekly average at that moment, the user paid more than they would have at the weekly average.

Smart Timing replaces that single-shot purchase with a sequence of smaller buys ("tranches") spread across the user's purchase window, with each tranche timed to fire on a price dip rather than at an arbitrary moment.

## How a Smart Timing window works

A "window" is the time period over which one full DCA cycle is spent. For a user with weekly cadence, the window is 7 days. For bi-weekly, 14 days. For daily, 24 hours.

The user's full DCA amount is divided into tranches. At the start of each window, no tranches have fired yet. As the window progresses, the algorithm watches the price and fires tranches when conditions are favorable.

By the end of the window, all tranches must have fired. The user receives their full DCA amount, just spread across multiple buys at different price points rather than concentrated in one.

## Tranches

Each tranche represents a portion of the window's budget. Tranches are not equal-sized; the algorithm allocates more to earlier opportunities (when there's more window left to recover from a bad fill) and less to later ones.

A tranche fires when **price and metrics hit specific thresholds**. The reference price is established at the start of the window and may change during the window; however the price when the window opened is the anchor price used as a baseline for sats gained metrics.

If a tranche's dip threshold is hit, it fires. If not, it waits. The algorithm runs a check approximately every minute throughout the window.

## Regime detection

Bitcoin behaves differently in bull markets and bear markets. In a sustained uptrend, waiting too long for a dip means buying at progressively higher prices. In a bear market, the same patience is rewarded.

Smart Timing detects which regime the market is in by examining longer-term price trends. The detected regime affects:

- How aggressive the dip thresholds are. Bull markets get tighter thresholds (smaller dips fire tranches) so the user doesn't miss out on the trend.
- When the failsafe activates. Bull markets failsafe earlier in the window.

Regime detection is recomputed continuously, so a market that shifts will see Smart Timing adapt.

## Ratchet

Within a single window, if price rallies significantly above the original reference, the algorithm bumps the reference price upward. Subsequent tranches then fire on dips from the new, higher reference rather than the original starting price.

This protects against the failure mode where a window starts low, rallies hard, and the algorithm refuses to fire because price never returns to the original starting level. The ratchet says: if the trend has clearly moved up, accept the new reality and look for dips relative to that.

## Failsafe

The algorithm's prime directive is: by the end of the window, the user must have received their full DCA amount. Smart Timing is an optimization over naive DCA, not a market-timing system that might skip purchases.

To enforce this, every window has a **failsafe checkpoint** at a configurable point, somewhere in the latter portion of the window. If, at that checkpoint, not all tranches have fired, the algorithm enters failsafe mode:

- If price is below the window's opening price, the failsafe may fire the remaining tranches as a single buy.
- If price is above the opening price, the failsafe may wait briefly for a small dip below the current reference.
- If that dip does not occur before the hard failsafe point, the remaining tranches are instructed anyway.

Either way, the user gets their full DCA amount within the window. Failsafe ensures Smart Timing never silently underspends.

## What partners need to know

For integration purposes, the specifics of the algorithm are abstracted away. From a partner's perspective:

- You create a plan with an amount, frequency, and `smart_timing_enabled: true`.
- SatStacker decides when each tranche should fire and emits execution instructions.
- You execute the tranches as they arrive.
- By the end of each window, the full `amount_usd` will have been instructed (in some combination of tranches), assuming successful execution on your side.

The number of tranches per window, their relative sizing, the dip thresholds, the regime parameters, the ratchet step, and the failsafe checkpoint are SatStacker implementation details. They are tuned based on historical backtests and may evolve over time. We will notify partners in advance of any algorithm changes that affect execution patterns materially.

## What partners don't need to do

- You don't decide *when* to fire tranches. SatStacker tells you.
- You don't sum tranches across a window. Each execution instruction is a complete, standalone buy.
- You don't need to understand the algorithm to integrate.