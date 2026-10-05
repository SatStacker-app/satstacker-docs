---
title: Authentication
sidebar_position: 3
---

# Authentication

All protected SatStacker Engine endpoints authenticate using a partner API key sent as a Bearer token in the standard `Authorization` header.

## Request format

```
Authorization: Bearer sse_test_YOUR_KEY_HERE
```

Example:

```bash
curl https://api.satstacker.app/partner/v1/me \
  -H "Authorization: Bearer sse_test_8KdN3pq2RmV5wXcL7fH4yZjBaQs6tEnG"
```

The header name is `Authorization` (capital A) and the scheme is `Bearer` followed by a single space and the key.

## Key formats

SatStacker issues two key formats, distinguishable by prefix:

| Prefix | Environment | Use |
|--------|-------------|-----|
| `sse_test_` | Sandbox | All integration testing. Test records only; route orders to your own simulator, never live infrastructure. |
| `sse_live_` | Production | Live partner traffic. Production executions reflect actual user trades. |

Both formats follow the pattern `sse_{environment}_{32 random URL-safe characters}`.

The prefix is visible by design, it lets your engineers verify at a glance whether they're hitting the sandbox or production environment before sending real user data. Configure your own secret-scanning rules to detect SatStacker key prefixes; do not assume third-party scanners recognize them automatically.

## Obtaining a key

SatStacker Engine is in private partner integration. To request a sandbox key, email **support@satstacker.app** with:

- Your platform name and a brief description
- The geography you serve
- Expected Smart Timing user volume
- Your primary technical contact

Arrange key issuance with SatStacker during onboarding. Production access follows agreed sandbox acceptance and launch coordination.

## Key storage

Current keys remain valid until revoked or the partner is disabled; there is no automatic expiry in this API version. Keys authorize access to partner users, plans, instructions and confirmations. Your exchange controls actual trade execution. Treat them with the same care as production database credentials:

- **Never commit keys to source control.** Use environment variables or a secrets manager.
- **Never log key values.** Use only a masked key identifier or trailing suffix when troubleshooting; never include raw credentials.
- **Never share keys across environments.** Sandbox and production should always use different keys.
- **Restrict key access** to systems and personnel who need it.

SatStacker stores only a SHA-256 hash of your key. The raw key is shown to you exactly once at issuance time. If a key is lost, you must request a new one (we cannot recover it).

## Key rotation

To rotate a key:

1. Email **support@satstacker.app** requesting a new key for the relevant environment.
2. Deploy the new key to your systems.
3. Verify the new key works by hitting `GET /partner/v1/me`.
4. Notify SatStacker that the new key is in use.
5. SatStacker revokes the old key.

We recommend rotating production keys every 12 months and immediately upon any suspected compromise.

## Authentication errors

A request with a missing, malformed, or invalid key returns `401 Unauthorized`:

```json
{
  "detail": "Invalid API key."
}
```

The response always includes:

```
WWW-Authenticate: Bearer
```

Revoked, unknown or unsupported-prefix keys return `401`. A missing or malformed Authorization header also returns `401`, with a header-format error. Do not depend on identical error strings across these cases. Your application should not attempt to distinguish between these cases, so treat any `401` as "this key cannot make this request" and surface it to your operations team.

A request with a valid key but for a partner whose account is not active returns `403 Forbidden`:

```json
{
  "detail": "Partner is not active."
}
```

This typically indicates an issue with your account status. Contact **support@satstacker.app**.

## Tenant isolation

API keys are scoped to a specific partner. Every endpoint that returns data automatically filters to your partner's records. You cannot query, modify, or confirm executions belonging to another partner using your key. Attempting to access another partner's `execution_id` returns `404 Not Found`.

## Sandbox versus production base URLs

Both environments use the same base URL:

```
https://api.satstacker.app
```

The environment is determined entirely by the API key you present. A `sse_test_*` key always reads from and writes to sandbox data. A `sse_live_*` key always reads from and writes to production data. There is no way to "cross over", production keys cannot access sandbox data and vice versa.

This means you can use identical code paths in your integration; only the key value changes between environments.