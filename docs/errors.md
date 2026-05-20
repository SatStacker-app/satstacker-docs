---
title: Errors
sidebar_position: 9
---

# Errors

SatStacker Engine uses standard HTTP status codes and JSON error responses.

Most errors return a response body with a `detail` field:

```json
{
  "detail": "Invalid API key."
}
```

Validation errors may return a structured list:

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "partner_user_id"],
      "msg": "Field required"
    }
  ]
}
```

## Status codes

| Status | Meaning |
|---|---|
| `400 Bad Request` | The request is syntactically valid but violates an API rule. |
| `401 Unauthorized` | Missing, malformed, revoked, or invalid API key. |
| `403 Forbidden` | The key is valid, but the partner or resource is not active. |
| `404 Not Found` | The requested resource does not exist in your partner/environment scope. |
| `409 Conflict` | The request conflicts with an existing record or execution state. |
| `422 Unprocessable Entity` | Request body validation failed. |
| `429 Too Many Requests` | Request was throttled. Not generally enforced during private integration. |
| `500 Internal Server Error` | Unexpected SatStacker error. Retry if safe, then contact support. |

## Authentication errors

Missing or malformed key:

```json
{
  "detail": "Missing or malformed Authorization header. Expected 'Authorization: Bearer <key>'."
}
```

Invalid key:

```json
{
  "detail": "Invalid API key."
}
```

Inactive partner:

```json
{
  "detail": "Partner is not active."
}
```

## User errors

Consent is required when linking a user:

```json
{
  "detail": "User consent is required."
}
```

A disabled or deleted partner user cannot create active plans:

```json
{
  "detail": "Partner user is not active (status=disabled)."
}
```

If you attempt to disable a partner user that doesn't exist:

```json
{
  "detail": "Partner user not found."
}
```

## Plan errors

If you create a plan for a user that has not been linked yet:

```json
{
  "detail": "Partner user not found. Create/link the partner user first."
}
```

If you try to reuse a `partner_plan_id` for a different user:

```json
{
  "detail": "partner_plan_id already exists under a different partner_user_id. Cancel the existing plan and create a new one with a fresh partner_plan_id if the plan is moving between users."
}
```

## Confirmation field requirements by status

The required fields on `POST /partner/v1/executions/{execution_id}/confirm` depend on the `status` value:

| Status | partner_order_id | usd_amount | btc_amount | execution_price | partner_fee_usd | failure_reason |
|---|---|---|---|---|---|---|
| `filled` | required | required | required | required | optional | ignored |
| `partial` | required | required | required | required | optional | ignored |
| `failed` | required | ignored | ignored | ignored | ignored | recommended |
| `cancelled` | required | ignored | ignored | ignored | ignored | optional |

Fields marked `ignored` may be included in the request body but are not stored. Fields marked `required` will return `422 Unprocessable Entity` if missing.

`partner_order_id` is always required so that retried confirmations can be deduped, regardless of outcome.

## Execution confirmation errors

You must first retrieve an execution from `GET /partner/v1/executions/due` before confirming it. Confirming a `pending` execution returns:

```json
{
  "detail": "Execution cannot be confirmed while status='pending'. Poll /partner/v1/executions/due first, then confirm after execution."
}
```

If an execution has already been confirmed with different values:

```json
{
  "detail": "Execution already confirmed as status='filled' with partner_order_id='order_123'. An execution cannot be re-confirmed with different values."
}
```

If the same `partner_order_id` was already used for another execution:

```json
{
  "detail": "partner_order_id='order_123' is already recorded under execution_id='exec_...'."
}
```

If `usd_amount` is greater than the reserved execution amount:

```json
{
  "detail": "usd_amount cannot exceed reserved execution amount. reserved=5.00, received=6.00"
}
```

## Idempotent confirmation replay

If you retry the same confirmation payload after it has already been recorded, SatStacker returns success with `replayed: true`:

```json
{
  "ok": true,
  "execution_id": "exec_...",
  "status": "filled",
  "partner_order_id": "order_123",
  "replayed": true
}
```

This means your retry was accepted and no duplicate trade was created.

## Retry guidance

Safe to retry:

- `GET /partner/v1/me`
- `GET /partner/v1/executions/due`
- `GET /partner/v1/billing/monthly`
- `GET /partner/v1/billing/monthly/users`
- `POST /partner/v1/users` with the same `partner_user_id`
- `POST /partner/v1/plans` with the same `partner_plan_id`
- `POST /partner/v1/executions/{execution_id}/confirm` with the exact same payload
- `POST /partner/v1/webhooks`, `GET /partner/v1/webhooks`, `DELETE /partner/v1/webhooks` — webhook registration is idempotent per partner environment

Do not retry by placing another market order. If a trade executed but confirmation failed, retry the confirmation request with the same `partner_order_id`.
