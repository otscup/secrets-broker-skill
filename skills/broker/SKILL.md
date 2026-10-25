---
name: broker
description: >
  Fetch credentials from the self-hosted Secrets Broker over MCP instead of
  asking the user for passwords or API keys. Use whenever a task needs a
  secret, token, password, cookie, database URL or API key. Prefer
  server-side use (http_request) so the value never reaches the model.
  Trigger: /broker, "get the key from the broker", "fetch the api key".
argument-hint: "[item-name]"
license: AGPL-3.0
---

# Broker

The self-hosted **Secrets Broker** at `https://sb.otscup.com/mcp` is the only
source of credentials. Never ask the user to paste a secret into chat, and never
put a secret in a prompt, log, commit message or file.

Full tool reference (all eleven tools, arguments, error strings): the
`secrets-broker` skill — `SKILL.md` at this repo's root, installed as
`secrets-broker/SKILL.md`. This file is the working procedure only.

## What the broker gives you

A vault of named items, each classified `api` (key, token, database URL — readable
and usable), `web` (website/SSH/account login — fill-only, never plaintext) or
`unclassified` (no plaintext until the operator decides). Your MCP client
authenticates as an Agent: bound to one vault account, scoped to an allowlist or
group, with read/use/fill gated per item by a grant or an approval. `http_request`
runs the API call inside the broker with the secret injected, so the value never
enters the transcript; `request_fill` types a web login into one allowlisted
origin; `materialize` writes one credential into one allowlisted local file;
`put_secret` stores or updates an item, always behind a human approval. Every
read, use, fill and denial lands in the broker audit log, and pending items can be
approved from the web page, Telegram/ntfy/Gotify/wxpush or the DSH plugin.

## Workflow

1. `list_secrets` — find the exact item name and its `kind` (values are never
   listed). Names must match the panel, spaces included.
2. Choose the narrowest tool that finishes the job:
   - calling an API → `http_request` with `{name, url, method?, body?}`; the
     secret stays server-side;
   - web login → `request_fill` with `{name, origin}`;
   - needs to exist in a file → `materialize`, then `materialize_redeem`;
   - plain secret → `get_secret`; login fields → `get_credential`.
3. Unknown permission → `explain_access` with `{name}` (add `action` when it is
   about `secret.use`/`secret.fill`), then do what it says.
4. Item missing entirely → `request_credential` and hand the one-time link to the
   human; the broker stores it and grants you access.
5. Asked to store or update a credential → `put_secret`. It always needs a human:
   show the approval URL, then repeat the same call within 10 minutes. Details in
   the `broker-write` skill.

## Handling refusals

| Broker says | Do this |
|---|---|
| `pending approval: <url>` | Show the URL, wait for the human, retry the same call once. |
| `vault locked` | Ask the human to unlock `https://sb.otscup.com` — never ask for the master password. |
| `agent not allowed to read this item：…` | Read the reason: wrong name → fix it; out of scope → operator widens scope; no grant → `request_access`. |
| `agent is bound to another vault account` | Stop; the operator must switch account/agent or share the item. |
| `capability revoked/expired/exhausted` | Stop; report the exact code. A new request is the only route. |
| `不能读明文：… [web-credential-is-fill-only]` | Use `request_fill`, not `get_secret`. |
| `不能读明文：… [unclassified-plaintext-off]` | Operator must classify the item as `api`. |
| `secret.use denied: no-use-policy` | The credential has no per-item HTTP target policy; ask the operator to add one. Do not fall back to plaintext. |
| `fill execution layer is not configured` | No browser executor registered; report it and stop. |
| `agent not allowed to write this item: it is outside the agent scope` | Write scope does not cover it; the operator fixes it. |

## Connect failures

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

- Retry the same call **once**, a few seconds later.
- If it still fails: report the URL, the HTTP status and/or JSON-RPC code, the
  response body, and what you tried. Then stop.
- Never answer a connection failure by asking for the password/key, and never
  read a local `.env` as a fallback. `GET https://sb.otscup.com/health` tells you
  whether it is the network or auth; `/broker-setup` has the full diagnosis.

## Using a value safely

Put it straight into an environment variable or a command argument for the
current step. Do not echo it, write it to disk, or reuse it later.

```bash
API_KEY="<resolved-by-mcp>" command-that-needs-key
```

## If MCP is not configured

Ask the operator to add:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
```

Clients without OAuth use a static agent token:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
headers = { Authorization = "Bearer <agent token>" }
```

## Hard rules

- Never ask "what is the password/key?" — use the broker.
- Never use the Bitwarden master password as an agent credential.
- Never print a secret into the chat or into any tool result the model reads.
- If approval is required, wait for the human; never work around the broker.
