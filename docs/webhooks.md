---
title: Webhooks
sidebar_position: 8
---

# Webhooks

SatStacker Engine can notify your platform when new execution instructions are available.

Webhooks are optional. They are designed to reduce latency between SatStacker creating an execution and your worker polling for it.

The source of truth remains:

```text
GET /partner/v1/executions/due
```

When you receive a webhook, immediately poll `/partner/v1/executions/due` using your existing worker. Do not treat the webhook payload itself as an execution instruction.

## Event

SatStacker currently sends one webhook event:

```text
executions.available
```

This event means one or more execution instructions were created for your partner account and are ready to be fetched.

## Payload

Example payload:

```json
{
  "event": "executions.available",
  "partner_slug": "your_partner_slug",
  "environment": "test",
  "count": 2,
  "earliest_execution_id": "exec_8e1d3f9a2b4c5d6e7f8a9b0c"
}
```

| Field | Type | Description |
|---|---|---|
| `event` | string | Always `executions.available` for this event. |
| `partner_slug` | string | Your SatStacker partner slug. |
| `environment` | string | `test` or `live`. |
| `count` | integer | Number of new execution instructions created in this scheduler tick. |
| `earliest_execution_id` | string | The earliest execution created in this notification batch. |

The payload is only a signal. Your system should fetch the actual execution instructions from `/partner/v1/executions/due`.

## Register a webhook

Use `POST /partner/v1/webhooks` to register a webhook URL for the current API key environment.

```bash
curl -X POST https://api.satstacker.app/partner/v1/webhooks \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/satstacker/webhook"
  }'
```

Example response:

```json
{
  "partner_slug": "your_partner_slug",
  "environment": "test",
  "url": "https://example.com/satstacker/webhook",
  "status": "active",
  "created_at": "2026-05-19T15:00:00Z",
  "updated_at": "2026-05-19T15:00:00Z",
  "last_delivered_at": null,
  "last_status_code": null,
  "consecutive_failures": 0,
  "secret": "sse_whsec_..."
}
```

The webhook secret is shown only once. Store it securely. SatStacker cannot recover it later.

To rotate the secret, register the webhook URL again. Registering again replaces the previous URL and generates a new secret.

There is one webhook registration per partner environment. For example, registering a webhook with a sandbox key creates or replaces the sandbox webhook. Registering with a production key creates or replaces the production webhook.

## View your webhook

Use `GET /partner/v1/webhooks` to view the current webhook registration for the current API key environment.

```bash
curl https://api.satstacker.app/partner/v1/webhooks \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE"
```

Example response:

```json
{
  "partner_slug": "your_partner_slug",
  "environment": "test",
  "url": "https://example.com/satstacker/webhook",
  "status": "active",
  "created_at": "2026-05-19T15:00:00Z",
  "updated_at": "2026-05-19T15:00:00Z",
  "last_delivered_at": "2026-05-19T15:04:31Z",
  "last_status_code": 200,
  "consecutive_failures": 0
}
```

If no webhook is registered, the response contains your partner and environment with the webhook fields set to `null`.

## Delete your webhook

Use `DELETE /partner/v1/webhooks` to unregister the webhook for the current API key environment.

```bash
curl -X DELETE https://api.satstacker.app/partner/v1/webhooks \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE"
```

Example response:

```json
{
  "ok": true,
  "partner_slug": "your_partner_slug",
  "environment": "test",
  "deleted": true
}
```

Deleting a webhook only stops webhook notifications. It does not affect execution generation, polling, confirmation, or billing.

## Delivery behavior

SatStacker sends webhooks using an HTTPS `POST` request.

Webhook requests include these headers:

```text
Content-Type: application/json
X-SatStacker-Event: executions.available
X-SatStacker-Signature: sha256=<hmac>
```

Your endpoint should return any `2xx` status code to acknowledge delivery.

If your endpoint times out or returns a non-`2xx` response, SatStacker records the failure and increments `consecutive_failures`.

After 10 consecutive failures, the webhook is paused and SatStacker stops sending webhook notifications for that partner environment.

Your polling worker should continue to receive executions normally even if webhook delivery fails or is paused.

SatStacker does not retry individual webhook payloads. This is intentional: execution instructions are durably stored and can always be fetched from `/partner/v1/executions/due`.

## Signature verification

Each webhook request includes:

```text
X-SatStacker-Signature: sha256=<hmac>
```

The signature is an HMAC-SHA256 over the raw request body using your webhook secret.

Verify the signature before trusting the payload.

Python example:

```python
import hashlib
import hmac


def verify_satstacker_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    expected_header = f"sha256={expected}"

    return hmac.compare_digest(expected_header, signature_header or "")
```

Important: verify the signature against the raw request body, before parsing or re-serializing the JSON.

## Recommended handler behavior

When your webhook endpoint receives `executions.available`:

1. Verify the `X-SatStacker-Signature` header.
2. Return `200 OK` quickly.
3. Wake your worker to call `GET /partner/v1/executions/due`.
4. Execute and confirm returned instructions using your existing flow.

You should continue polling once every 60 seconds as a fallback. Webhooks reduce latency, but polling remains the reliable delivery mechanism.

## Example handler

Example FastAPI handler:

```python
import hashlib
import hmac

from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()

WEBHOOK_SECRET = "sse_whsec_YOUR_SECRET_HERE"


def verify_satstacker_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(f"sha256={expected}", signature_header or "")


@app.post("/satstacker/webhook")
async def satstacker_webhook(
    request: Request,
    x_satstacker_signature: str = Header(default=""),
):
    raw_body = await request.body()

    if not verify_satstacker_signature(
        raw_body=raw_body,
        signature_header=x_satstacker_signature,
        secret=WEBHOOK_SECRET,
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()

    if payload.get("event") == "executions.available":
        # Wake your worker to call:
        # GET https://api.satstacker.app/partner/v1/executions/due
        pass

    return {"ok": True}
```

## Operational notes

Webhooks are scoped by partner and environment.

A sandbox API key registers a sandbox webhook. A production API key registers a production webhook.

Sandbox and production webhooks should point to separate infrastructure unless your handler is explicitly designed to separate environments.

Webhook delivery status is visible through `GET /partner/v1/webhooks` using these fields:

| Field | Description |
|---|---|
| `status` | `active` or `paused`. |
| `last_delivered_at` | Timestamp of the last successful delivery. |
| `last_status_code` | Last HTTP status code returned by your webhook endpoint, if available. |
| `consecutive_failures` | Number of consecutive failed delivery attempts. |

To reactivate a paused webhook, register the webhook URL again with `POST /partner/v1/webhooks`.
