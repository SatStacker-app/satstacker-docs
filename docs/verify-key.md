---
title: Verify Your Key
sidebar_position: 1.5
---

# Verify Your Key

A 30-second sanity check after receiving a fresh API key.

```bash
curl https://api.satstacker.app/partner/v1/me \
  -H "Authorization: Bearer sse_test_YOUR_KEY_HERE"
```

Expected response:

```json
{
  "partner_slug": "your_partner_slug",
  "partner_name": "Your Partner Name",
  "status": "active",
  "environment": "test"
}
```

If you receive `200 OK` with this payload, your key is valid and the partner record is active. You're ready for [Getting Started](/getting-started).

If you receive `401`, double-check the `Authorization` header format: `Bearer ` followed by a single space, then the key. No quotes, no leading or trailing whitespace.

If you receive `403`, your key is valid but the partner account is not active. Contact **support@satstacker.app**.
