---
name: broker-setup
description: >
  Point an AI client at the Secrets Broker MCP endpoint and verify the
  connection end to end. Use when the user says "/broker-setup", "connect the
  client to the broker", "broker not working", or when a client reports that
  it cannot read credentials.
license: AGPL-3.0
---

# Broker Setup

Get a client talking to `https://sb.otscup.com/mcp`, then prove it works.

## 1. Pick the transport

**Remote OAuth (preferred)** — the client discovers OAuth and the human
approves in a browser:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
```

**Static agent token** — for clients without remote OAuth:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
headers = { Authorization = "Bearer <agent token>" }
```

Create the agent in the broker UI (Agents → create), bind it to the vault
account it should read, and set its readable items/groups. Copy the token once.

**stdio bridge** — for clients that only speak local MCP: run
`mcp-stdio/index.mjs` from the skill repo; it does the OAuth login and
proxies to the remote endpoint.

## 2. Verify

1. `initialize` succeeds and returns the broker's `instructions`.
2. `tools/list` shows: `list_secrets`, `get_secret`, `get_credential`,
   `http_request`, `request_access`, `request_credential`.
3. `list_secrets` returns item names (not values).
4. One `get_secret` on a harmless item returns a value.

## 3. If it fails

| Symptom | Cause | Fix |
|---|---|---|
| 401 on every call | token expired or revoked | re-authorize / rotate the agent token |
| `vault locked` | no unlock session | human unlocks `https://sb.otscup.com` |
| `agent is bound to another vault account` | OAuth token issued for a different vault account | switch the account and re-authorize |
| `agent is not allowed to read this item` | scope is empty | widen that agent's allow list |
| `secret.use denied: no-use-policy` | credential has no HTTP target policy | operator adds one per item |

## Note

The agent token is a credential too. Treat it like a password: keep it out of
prompts, logs and commits.
