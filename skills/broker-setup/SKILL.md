---
name: broker-setup
description: >
  Point an AI client at the Secrets Broker MCP endpoint and verify the
  connection end to end, including how to handle a connection that fails. Use
  when the user says "/broker-setup", "connect the client to the broker", "broker
  not working", or when a client reports that it cannot read credentials.
license: AGPL-3.0
---

# Broker Setup

Get a client talking to `https://sb.otscup.com/mcp`, then prove it works.

## What you are connecting to

The broker is a Cloudflare Worker holding a vault of named credential items
(`api` keys, `web` logins, plus unclassified ones), an agent registry, and the
grant/approval engine in between. Your client authenticates as an Agent bound to
one vault account; the Agent's scope (item allowlist, group filters, optional
write flag) decides what it can see, and per-item grants decide what it can do
(read / use / fill / materialize), while writes (`put_secret`) always need a
human approval. Plaintext reads are exposed only when the Worker runs with
`MCP_ALLOW_READ=1`; `http_request` needs no such switch because the secret never
leaves the broker. Approvals and denials surface in the web page,
in Telegram/ntfy/Gotify/wxpush, and in the DSH plugin, all against the same
pending queue.

Full tool reference: the `secrets-broker` skill (`SKILL.md` at this repo's root,
installed as `secrets-broker/SKILL.md`).

## 1. Pick the transport

**Remote OAuth (preferred)** — the client discovers OAuth, the human approves in
a browser:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
```

Discovery endpoints (both answer JSON; `scopes_supported: ["secrets.read"]`):

```text
https://sb.otscup.com/.well-known/oauth-protected-resource
https://sb.otscup.com/.well-known/oauth-authorization-server
```

**Static agent token** — for clients without remote OAuth:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
headers = { Authorization = "Bearer <agent token>" }
```

Create the agent in the broker UI (Agents → create), bind it to the vault account
it should read, set its readable items/groups, leave 允许写入 off unless the agent
must store credentials. Copy the token once.

**stdio bridge** — for clients that only speak local MCP: run
`mcp-stdio/index.mjs` from this repo. It does the OAuth login (DCR + PKCE) and
proxies stdio to the remote endpoint, caching the token in
`~/.secrets-broker/oauth.json`; `BROKER_TOKEN` skips OAuth.

Transport is Streamable HTTP, `POST /mcp` only. A client that opens a `GET`/SSE
stream gets `405 {"error":"this endpoint accepts POST only"}` — configure it for
POST, not SSE.

## 2. Verify

1. `POST /mcp` with `initialize` returns `serverInfo.name: "secrets-broker"` and
   `protocolVersion` (`2024-11-05`, `2025-03-26` or `2025-06-18`).
2. `tools/list` returns exactly eleven tools: `list_secrets`, `request_access`,
   `explain_access`, `get_secret`, `get_credential`, `request_fill`,
   `materialize`, `materialize_redeem`, `request_credential`, `put_secret`,
   `http_request`. A different set means you are talking to something that is not
   this broker (or an agent whose tool allowlist is narrower).
3. `list_secrets` returns item names with `kind` (never values).
4. One `get_secret` on a harmless item returns a value — or the expected refusal.
   A refusal with a clear reason is a working connection.

Nothing to guess about reachability:

```bash
curl -s https://sb.otscup.com/health          # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://sb.otscup.com/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# 401 = reachable, auth missing/expired.  200 = token works.  5xx = broker fault.
```

## 3. Connect-failure handling

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

An agent that cannot reach the broker must **not** immediately ask the user for
the password or key. The order is fixed:

1. **Retry once.** Repeat the same call after a few seconds — cold starts, a
   rotated token or a transient network blip often clear on the second attempt.
2. **If the retry fails, report and stop.** One message with: the exact URL, the
   HTTP status and/or JSON-RPC error code, the response body (truncated, never a
   secret), and what was already tried ("POST /mcp twice, 401 both times").
3. **Never** ask the user to paste the secret, the master password or the agent
   token in chat, and **never** fall back to a local `.env`/config file.

| Symptom | Cause | Fix / report |
|---|---|---|
| timeout, DNS error, no HTTP status | broker unreachable from this host | Report URL + "no response" + retries. Check `GET /health`. |
| `401` + `WWW-Authenticate: Bearer` (JSON-RPC `-32001 unauthorized`) | token missing, expired or revoked | Re-run OAuth consent; or the operator rotates the agent token. Report the 401 first. |
| `403 agent is bound to another vault account` | token issued for a different vault | Switch the account and re-authorize, or use an agent bound to the right one. |
| `405` `this endpoint accepts POST only` | client used GET/SSE | Configure Streamable HTTP POST. |
| `404` on `/mcp` | wrong URL | Use `https://sb.otscup.com/mcp`. |
| `423` / `vault locked` | broker up, vault locked | Human unlocks `https://sb.otscup.com`. Never ask for the master password. |
| HTML/login page instead of JSON | a proxy or the OAuth page intercepted the call | Report content type; fix the client's auth discovery. |
| `200` but an empty `tools/list` | wrong server behind that URL | Report it; do not proceed. |
| `secret.use denied: no-use-policy` | credential has no HTTP target policy | Operator adds the target per item. |
| `get_secret is disabled` | Worker lacks `MCP_ALLOW_READ=1` | Report it; `http_request` still works. |

## Note

The agent token is a credential too. Treat it like a password: keep it out of
prompts, logs and commits.
