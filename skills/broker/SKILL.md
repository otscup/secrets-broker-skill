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

## Workflow

1. `list_secrets` — find the item name (values are never listed).
2. Prefer `http_request` — the broker injects the secret server-side and returns
   only the upstream response, so the model never sees the credential.
3. Use `get_secret` only when the value itself is required. It returns
   `{ "name": "item-name" }`.
4. `get_credential` — username + password + TOTP for login items.
5. `request_credential` — create a one-time link so the human can fill in a
   credential the vault is missing; the broker stores it and grants access.

## Handling refusals

| Broker says | Do this |
|---|---|
| `pending approval: <url>` | Show the URL, wait for the human, retry the same call. |
| `vault locked` | Ask the human to unlock `https://sb.otscup.com` — never ask for the master password. |
| `agent is not allowed to read this item` | Stop; ask the operator to widen that agent's scope. |
| `agent is bound to another vault account` | Stop; the operator must share the item across accounts. |
| `secret.use denied: no-use-policy` | The credential has no per-item HTTP target policy yet; ask the operator to add one. |

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
