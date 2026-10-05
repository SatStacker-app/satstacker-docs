---
title: Amounts, Fees and Execution Outcomes
sidebar_position: 5.5
---

# Amounts, Fees and Execution Outcomes

A plan's USD amount is the customer's **total spending budget, including exchange
fees**, for one purchasing window. A $10 weekly plan must spend no more than $10
in that window. SatStacker reservations track this all-in amount.

## Amount definitions

| Field | Meaning |
| --- | --- |
| Plan `amount_usd` | Total USD budget for the cadence window, including exchange fees. |
| Instruction `amount_usd` | Maximum total USD debit for this instruction, including exchange fees. |
| Confirmation `usd_amount` | Actual total USD debit for the completed attempt, including exchange fees. Must not exceed the instruction amount. |
| Confirmation `partner_fee_usd` | Exchange fee already included in the total debit, expressed in USD. Informational breakdown; SatStacker does not add it again or subtract it from `usd_amount`. |
| Confirmation `btc_amount` | Actual BTC credited to the customer, net of any BTC withheld by the exchange for the trade. Excludes unrelated later transfers or withdrawal fees. |
| Confirmation `execution_price` | Exchange-reported BTC/USD fill price, or volume-weighted fill price for multiple fills. Report the fill price before a separately reported fee; it need not equal `usd_amount / btc_amount`. |
| Confirmation `executed_at` | UTC time of the completed exchange attempt. Required for filled and partial outcomes. |

Use decimal strings for monetary values. `usd_amount` must be positive with at
most two decimal places. `btc_amount` must be positive with at most eight.
Execution price is stored to cents and must stay positive after rounding.
`partner_fee_usd` must be nonnegative and is stored to cents. Report known fees
accurately; omit or use `"0.00"` only when there is no separate fee to report.

If your exchange deducts fees from BTC rather than charging USD, report the net
BTC credited and agree the USD fee-breakdown convention with SatStacker during
onboarding. Never add an extra customer debit beyond the instruction amount.

## Full-fill example: $10 including fees

At a fill price of $100,000/BTC, a $10 instruction with a $0.10 exchange fee
purchases $9.90 of Bitcoin and credits 0.00009900 BTC:

```json
{
  "partner_order_id": "order_all_in_001",
  "status": "filled",
  "executed_at": "2026-10-05T20:00:00Z",
  "usd_amount": "10.00",
  "btc_amount": "0.00009900",
  "execution_price": "100000.00",
  "partner_fee_usd": "0.10"
}
```

The customer debit is $10.00. SatStacker settles the $10.00 reservation and does
not refund the $0.10 fee or try to buy it again.

When your exchange's order API accepts a purchase amount before fees, calculate
a purchase amount whose final quote, including fees, stays within the instruction.
Do not place a $10 purchase and charge a $0.10 fee on top of a $10 instruction.

## Partial-fill example: $6 of a $10 instruction

Assume the exchange attempt is final and the remaining exchange order cannot
fill later. The customer was debited $6.00, including a $0.06 fee, and received
0.00005940 BTC at $100,000/BTC:

```json
{
  "partner_order_id": "order_all_in_partial_001",
  "status": "partial",
  "executed_at": "2026-10-05T20:00:00Z",
  "usd_amount": "6.00",
  "btc_amount": "0.00005940",
  "execution_price": "100000.00",
  "partner_fee_usd": "0.06"
}
```

SatStacker settles $6.00 and releases $4.00 back to the same current window.
A normal tranche advances after this terminal attempt. The returned dollars
remain available for a later remainder signal. An old-window release cannot
increase a newer window's budget.

## Final outcomes

| Status | Report it when | Reservation handling |
| --- | --- | --- |
| `filled` | The attempt completed successfully. Any rounding difference in the total debit is final. | Settle the actual debit; release any unused reservation. |
| `partial` | Some BTC was credited, and the remaining order is definitively cancelled or otherwise cannot fill. | Settle the actual debit; release the unused reservation. |
| `failed` | The attempt definitively failed, with no BTC credited and no customer debit. | Release the full reservation. |
| `cancelled` | The attempt was definitively cancelled or never placed, with no BTC credited and no customer debit. | Release the full reservation. |

`partial` is a terminal outcome. Do not confirm an order that is still working
as partial: a later fill cannot be appended to that confirmation. Reconcile or
cancel the remaining exchange order first, then report the final totals.

For failed/cancelled confirmations, `partner_order_id` and `failure_reason` are
required. If no exchange order was created, use a unique ID from your own attempt
ledger and reuse it for confirmation retries. Do not invent an exchange order ID.
If an unsuccessful attempt incurred a fee or another debit, contact SatStacker
for reconciliation rather than reporting a zero-spend failed/cancelled outcome.
The current failure payload does not record nonzero financial amounts.

A network timeout or lost response does not establish a final outcome. Look up
the original exchange attempt before deciding whether a trade failed. Retrying
confirmation never requires placing a new exchange order.

## Minimum order sizes and remaining cents

The API's default plan minimum is $1.00; this is configurable and is not an
exchange-specific minimum-order guarantee. A tranche or refunded remainder can
be smaller than the original plan amount. Partners must account for their own
minimums, precision and fee schedule before enabling a plan.

For planning, check the smallest allocation across supported regimes: 100% for
daily, 50% for weekly, and 20% for bi-weekly. For example, if your exchange needs a
$5 all-in instruction, a $10 bi-weekly plan can emit a $2 tranche and is unsuitable
without a separately agreed handling policy. A before-fee venue minimum requires
additional room for fees within the all-in budget.

Partial fills can still leave a remainder below the venue minimum even when the
original tranches were large enough. Do not exceed the instruction, combine it
with another instruction, or carry it to another window without an agreed policy.
Report an unexecutable, zero-spend attempt as failed with a clear reason such as
`below_venue_minimum`, then contact SatStacker if it repeats. The engine may issue
a new remainder attempt on a later eligible signal; it does not automatically
merge dust, learn venue minimums, or increase the next window's budget.

## Billing and performance

Executed USD volume sums `usd_amount` from filled and partial confirmations. Under
this contract it therefore includes exchange fees within the customer debit.
`partner_fee_usd` is an informational breakdown and is not an extra volume charge.
SatStacker's partner subscription and volume fees are reported separately by the
billing API; they are not part of an exchange instruction or a second customer
debit authorized by it. Commercial responsibility for those fees belongs in the
partner agreement.

BTC-based performance calculations use reported net BTC and the reported all-in
USD debit. These may differ from a comparison based only on the exchange's gross
fill price. Keep reporting conventions consistent across all confirmations.
