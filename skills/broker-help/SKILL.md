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
| `/broker-ultra` | Strict mode: explain the policy first, prefer server-side use, refuse to widen scope. |
| `/broker-write` | Store or update a credential in the vault. |
| `/broker-approve` | Handle a pending approval request. |
| `/broker-setup` | Point a client at the broker MCP endpoint and verify it, including connect failures. |
| `/broker-help` | This card. |

## What the broker is

`https://sb.otscup.com` stores named vault items — `api` (readable/usable keys),
`web` (site/SSH logins: fill-only), `unclassified` (plaintext refused). Your MCP
client is an Agent bound to one vault account with a scope; each call is allowed
by a per-item grant (read / use / fill / materialize, with duration and optional
use cap) or by a human approval. `http_request` executes inside the broker so the
value never reaches the model; `request_fill` types a web login into one
allowlisted origin; `materialize` writes one credential into one allowlisted file;
`put_secret` stores/updates an item but always needs a human to approve that one
write. Everything is audited, denials are notified (web, Telegram/ntfy/Gotify/
wxpush, DSH plugin), and plaintext reads need `MCP_ALLOW_READ=1` on the Worker.

## Full tool reference

The eleven tools with arguments, return shapes and every error string live in the
`secrets-broker` skill: `SKILL.md` at this repo's root, installed as
`secrets-broker/SKILL.md`. That file is the single copy; do not duplicate it here.

## Endpoints

```text
MCP:     https://sb.otscup.com/mcp      (POST only, Streamable HTTP)
Web:     https://sb.otscup.com
Health:  https://sb.otscup.com/health   -> {"ok":true}
OAuth:   https://sb.otscup.com/.well-known/oauth-protected-resource
         https://sb.otscup.com/.well-known/oauth-authorization-server
```

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
```

Clients without OAuth support add a static agent token:

```toml
headers = { Authorization = "Bearer <agent token>" }
```

## Common answers

- **pending approval** → show the URL, wait, retry the same call once.
- **vault locked** → the human unlocks `https://sb.otscup.com`; never ask for the
  Bitwarden master password.
- **not allowed to read / fill / use** → read the reason after `：`; wrong name,
  out of scope, or no grant. `explain_access` tells you which.
- **不能读明文** → a bracketed code says why: `[web-credential-is-fill-only]` →
  `request_fill`; `[unclassified-plaintext-off]` → operator classifies it;
  `[no-read-grant]` → `request_access`.
- **secret.use denied: no-use-policy** → no per-item HTTP target yet; the
  operator adds one.
- **write refused** → `put_secret` needs an approval first; see `/broker-write`.

## Connect failures

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

Retry once, then report the URL, HTTP status/JSON-RPC code and what you tried,
and stop. Never ask for the password/key and never fall back to a local `.env`.
The step-by-step diagnosis table is in the `broker-setup` skill.
