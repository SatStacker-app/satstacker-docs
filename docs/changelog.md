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
