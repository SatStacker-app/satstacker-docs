---
title: Changelog
sidebar_position: 10
---

# Changelog

This page tracks partner-facing changes to SatStacker Engine.


### Notes

## Partner v2 patch (deploy with matching schema update)

- New/reset/rolled windows use the production v2 pending/activation lifecycle and a frozen opening regime. Existing legacy windows finish before transitioning.
- Final reference state is persisted; remainder instructions reserve only available USD.
- Instructions carry window identity and tranche keys; refunds and progression cannot affect a newer budget generation.
- Normal tranches advance after all terminal outcomes. Terminal remainder retries use new identities, while expired leases retain the original identity.
- Pause/cancel/disable/off cancel only never-delivered instructions. Delivered instructions remain confirmable and block new generation until settled.
- Cancelled plans are terminal, start_date is create-only, and resets return 409 while delivered executions are unresolved.
- Polling instruction fields are additive. Exchange integrations should ignore unknown response fields and treat idempotency keys as opaque.

## Documentation contract clarification — October 5, 2026

- Defined plan and instruction amounts as all-in customer debit limits, including exchange fees; reported fees are a breakdown already inside that debit.
- Added full/partial fee examples, venue minimum guidance and final-order outcome requirements.
- Added sandbox testing guidance and offline client fixtures without promising accelerated timing or an undocumented force endpoint.
- Added operations, ledger recovery, reconciliation and escalation guidance.
- Corrected confirmation timestamps, key descriptions, secret-rotation retry rules, and example lease timing.
- Supplied a regenerated partner-only OpenAPI specification and a repeatable export tool.

These are documentation updates for the existing partner v2 implementation. No additional SQL migration or timing change is required. Exchange clients must report amounts consistently with the clarified all-in contract.
