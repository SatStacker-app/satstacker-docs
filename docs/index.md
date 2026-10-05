---
slug: /
title: SatStacker Engine
sidebar_position: 1
---

# SatStacker Engine

SatStacker Engine is an API that lets exchanges, brokerages, and Bitcoin platforms embed **Smart Timing** into their own recurring Bitcoin purchase experience.

Partners keep the customer relationship, account system, custody, funding, compliance, and trade execution on their platform. SatStacker provides the timing algorithm, plan state tracking, execution instructions, and reporting.

## What SatStacker provides

- **Smart Timing logic** — a window-based algorithm that deploys a recurring all-in budget through one or more price-timed buys.
- **Partner-linked DCA plan state** — durable storage of each user's plan parameters and per-window execution progress.
- **Execution instruction generation** — when the algorithm decides a buy should fire, SatStacker emits an instruction the partner can pull and execute.
- **Trade and performance tracking** — confirmed trades are recorded for billing, reporting, and per-user breakdowns.
- **Billing and reporting** — monthly usage reports with tier-based pricing.

## What partners are responsible for

- User authentication and KYC.
- Custody of user funds.
- Trade execution against the underlying market.
- User-facing disclosures and consent flows.
- First-line customer support.

## Integration in four phases

1. **[Link a partner user](/concepts#partner-user)** — call `POST /partner/v1/users` after the user opts in.
2. **[Create a Smart Timing plan](/concepts#partner-plan)** — call `POST /partner/v1/plans` with the user's DCA parameters.
3. **[Poll for due executions](/api/executions-due)** — call `GET /partner/v1/executions/due` on a regular cadence and execute any returned instructions.
4. **[Confirm execution outcomes](/api/confirm-execution)** — call `POST /partner/v1/executions/{id}/confirm` after each trade attempt.

## Where to go next

- **[Getting Started](/getting-started)** — the fastest path from zero to a working sandbox integration.
- **[Authentication](/authentication)** — API keys, environments, rotation, and security.
- **[Core Concepts](/concepts)** — the data model and how Smart Timing plans flow through the system.
- **[Amounts, Fees and Execution Outcomes](/execution-contract)** — all-in budgets, net BTC, partial fills and venue minimums.
- **[Sandbox Testing](/sandbox-testing)** — predictable offline fixtures and real sandbox acceptance checks.
- **[Operations and Reconciliation](/operations)** — recovery, monitoring, reporting and incident handoff.
- **[Smart Timing](/smart-timing)** — how the algorithm works at a conceptual level.
- **[API Reference](/api/health)** — full endpoint reference with curl examples.
- **[OpenAPI specification](/openapi/partner-api.json)** — download the partner-only contract for Postman, Insomnia, or client code generators.

## Getting access

SatStacker Engine is in private partner integration. To request sandbox access, reach out to **support@satstacker.app** with a brief description of your platform, the geography you serve, and your expected Smart Timing user volume.

## Budget contract

A plan amount includes exchange fees: a $10 weekly plan authorizes up to $10 of total customer debits for that window. Each instruction has the same all-in convention. The exchange reports the actual total debit and net BTC credited; separately reported fees are already included in that debit. See [Amounts, Fees and Execution Outcomes](/execution-contract) for examples.
