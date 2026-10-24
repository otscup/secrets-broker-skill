---
name: broker-help
description: >
  Quick reference for the broker slash commands, levels and MCP setup.
  One-shot display. Use for /broker-help, "broker help", "how do I use the
  broker".
license: AGPL-3.0
---

# Broker Help

Reference card. Nothing is changed by invoking this.

## Commands

| Command | What it does |
|---------|--------------|
| `/broker` | Fetch a credential through the broker, default strictness. |
| `/broker-lite` | Fastest path: get the value and use it, no ceremony. |
| `/broker-ultra` | Strict mode: prefer server-side use, refuse to widen scope. |
| `/broker-approve` | Handle a pending approval request. |
| `/broker-setup` | Point a client at the broker MCP endpoint. |
| `/broker-help` | This card. |

## MCP endpoint

```text
https://sb.otscup.com/mcp
```

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
```

Clients without OAuth support add a static agent token:

```toml
headers = { Authorization = "Bearer <agent token>" }
```

## Tools

| Tool | Returns |
|------|---------|
| `list_secrets` | Item names and URLs only. |
| `get_secret` | One value (needs approval unless no-approval). |
| `get_credential` | Username + password + TOTP. |
| `http_request` | Upstream response only; the secret is injected server-side. |
| `explain_access` | Why this agent can or cannot use a credential, and what to try next. No value. |
| `request_access` | Approval request / approval URL. |
| `request_fill` | A browser executor types a `web` login into an allowed origin. No value to the model. |
| `materialize` | Write one credential into one allowlisted file. Approval makes a job, not a read grant. |
| `materialize_redeem` | Redeem that job once within ten minutes. Needs `MCP_ALLOW_READ=1`. |
| `request_credential` | One-time link for the human to fill a missing key. |

## Common answers

- **pending approval** → show the URL, wait, retry.
- **vault locked** → the human unlocks `https://sb.otscup.com`; never ask for the
  Bitwarden master password.
- **not allowed to read** → operator widens that agent's scope; stop there.
- **secret.use denied: no-use-policy** → no per-item HTTP target yet; the
  operator adds one.
