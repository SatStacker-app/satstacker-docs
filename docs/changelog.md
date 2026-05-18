---
title: Changelog
sidebar_position: 10
---

# Changelog

This page tracks partner-facing changes to SatStacker Engine.

## 2026-05-18

Initial private partner integration release.

### Added

- Partner API authentication using `sse_test_*` and `sse_live_*` API keys.
- Environment isolation for sandbox and production data.
- `GET /partner/v1/me` for credential verification.
- `POST /partner/v1/users` for partner user linking and consent tracking.
- `POST /partner/v1/plans` for Smart Timing plan creation and updates.
- `GET /partner/v1/executions/due` for leased execution delivery.
- `POST /partner/v1/executions/{execution_id}/confirm` for filled, partial, failed, and cancelled execution outcomes.
- Monthly partner billing report.
- Monthly per-user billing breakdown.
- Confirmation idempotency using `partner_order_id`.
- Execution delivery metadata: `lease_expires_at` and `delivered_count`.

### Notes

- SatStacker Engine is currently in private partner integration.
- API behavior may evolve before general availability.
- Partners will be notified before any material change to execution behavior, billing, or authentication.