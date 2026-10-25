---
name: secrets-broker
description: >
  Retrieve API keys, passwords and other credentials from the self-hosted
  Secrets Broker over MCP, and use them without the value reaching the model.
  Use whenever a task needs a secret, token, password, cookie, database URL or
  API key, or when a credential call fails and you need to know why. This file
  is also the full tool reference the /broker* skills point at. For slash
  commands see the `broker-help` skill.
---

# Secrets Broker

The broker at `https://sb.otscup.com` is the only source of credentials. It holds
vault items and hands them to agents over MCP, under rules the operator sets.

## What it actually does

Read this once; the rest of the file assumes it.

**Items.** A vault holds named items. Each is classified as one of:

- `api` — a key/token/database URL an agent may read and use.
- `web` — a website/SSH/account login. Fill-only: `get_secret` and
  `get_credential` refuse it, `request_fill` is the way in.
- `unclassified` — no decision yet. Plaintext reads are refused by default.

`list_secrets` returns the name, kind, `noApproval` flag and URL of each item an
agent may see. Values never appear in a listing.

**Agents.** Every MCP client authenticates as an Agent: either an OAuth client
(dynamic registration + PKCE) or a named Agent with a static Bearer token. An
Agent is bound to one vault account and has a scope — an item allowlist, group
filters, or everything — plus a separate write flag and, optionally, a tool
allowlist. Scope decides what it may even see; a grant decides what it may do.

**Grants and capabilities.** Access is a capability bound to (agent, item, action)
for one of four actions: `secret.read`, `secret.use`, `secret.fill`,
`secret.materialize`. A capability carries a duration (`once`/`1h`/`24h`/`7d`/
`always`), optionally `maxUses`, and can be revoked. `once` means one read. An
expired, exhausted or revoked capability is a hard stop — the broker never falls
back to an older grant to let the call through.

**Approvals.** When no capability covers a call, the broker records a pending
request and answers with an approval URL. A human approves once/1h/24h/7d/always
or denies. Approvals can arrive from the broker UI, Telegram/ntfy/Gotify/wxpush
notification channels, or the DSH plugin. Operators may also set an item to
`noApproval` (standing yes inside the agent's scope), or arm a time-boxed
auto-approval rule for one agent. Retrying the same call after approval returns
the value; asking again just queues nothing new.

**Writes.** `put_secret` stores or updates an item, and it is never silent: the
first call records a `secret.write` pending request and stores nothing, the human
approves, and the same call retried within 10 minutes writes exactly once. The
approval is a one-shot ticket, not a grant, and the value travels only on that
retry. A direct `POST /agent/items/save` with the agent token also exists for
scripts, gated by 允许写入 on the agent record.

**Fill.** For `web` items, `request_fill` routes a login to a registered browser
executor, which types it into one exact HTTPS origin named in the item's fill
policy. The agent gets a task id, never the password. Without a registered
executor the call fails closed.

**Materialize.** `materialize` asks to write one credential into one file path
the operator allowlisted (设置 → 安全 → 本地写入白名单). Approval creates a
one-shot, 10-minute job; `materialize_redeem` returns `{path,key,value}` once for
a local process to write. It is a plaintext read, so `MCP_ALLOW_READ=1` is
required and a `web` item is still refused.

**Plaintext switch.** `get_secret`, `get_credential` and `materialize_redeem`
are disabled unless the Worker has `MCP_ALLOW_READ=1`. `http_request` needs no
such switch because the value never leaves the broker.

**Audit.** Every read, use, fill, materialize, denial and write is appended to the
broker audit log with agent, item, action and result. Denials notify the operator
at most once per 30 minutes per (agent, item, action) so a looping agent cannot
spam the channels.

## Endpoint

```text
MCP:               https://sb.otscup.com/mcp
Web / approvals:   https://sb.otscup.com
Health:            https://sb.otscup.com/health          -> {"ok":true}
OAuth discovery:
  https://sb.otscup.com/.well-known/oauth-protected-resource
  https://sb.otscup.com/.well-known/oauth-authorization-server
```

Transport is Streamable HTTP: `POST /mcp` only. `GET /mcp` answers
`405 {"error":"this endpoint accepts POST only"}`.

Auth is either:

- **OAuth 2.1** (preferred): dynamic client registration, PKCE S256, browser
  consent, Bearer access token. Discovery is advertised by the endpoint itself.
- **Static agent token**: create an Agent in the broker UI and send
  `Authorization: Bearer <token>`.

A token is bound to the vault account that was active when it was issued. Do not
use one agent token against another vault account.

## Tools

Full reference. Every other skill points here instead of repeating it.| Tool | Arguments | Returns |
|---|---|---|
| `list_secrets` | `filter?` (substring), `limit?` (default 200, max 500) | `[{name, kind: api\|web\|unclassified, noApproval, url}]`. No values. |
| `request_access` | `name` | Text: `access already allowed; use get_secret`, or `pending approval: <url>`, or a refusal message. Does not consume a read. |
| `explain_access` | `name`, `action?` (`secret.read` default, `secret.use`, `secret.fill`, `secret.materialize`), `origin?` (fill), `url?` (use) | JSON: kind, account, the grant that exists, the rule that decided, what to try next. No value. |
| `get_secret` | `name` | The value, as text. Needs `MCP_ALLOW_READ=1`. |
| `get_credential` | `name` | `{"username","password","totp"}`. Needs `MCP_ALLOW_READ=1`. |
| `request_fill` | `name`, `origin` (exact `https://host[:port]`), `action?` (`login`) | `{"taskId","origin","state","expiresInSeconds"}`. No value. |
| `materialize` | `name`, `path` (absolute, allowlisted), `key` (env-style name) | `{"status":"approved","path","key"}` or `{"status":"pending","id","approvalUrl","path","key"}`. No value. |
| `materialize_redeem` | `id` (job id) | `{"path","key","value"}` exactly once, within 10 minutes. Needs `MCP_ALLOW_READ=1`. |
| `request_credential` | `name`, `description?` | `credential request created: https://sb.otscup.com/connect?id=<id>` |
| `put_secret` | `name`, `value?`, `username?`, `totp?`, `url?`, `notes?`, `group?` | First call: `{"status":"pending-approval","approvalUrl":...}`. After approval, retried within 10 min: `{"status":"written","name","updated":true\|false}`. |
| `http_request` | `name`, `url` (https), `method?` (GET), `headers?`, `body?` (string), `headerName?`, `authPrefix?` | `{"status","ok","body"}`. The secret is injected server-side and never returned. |

### Notes per tool

- `list_secrets` names must match the panel exactly, including spaces. A
  `web` name is visible but unreadable — that is not a typo.
- `request_access` is the polite form of "may I?". Use it before retrying a
  denial so the operator sees one request, not a loop.
- `explain_access` is the first call after any `not allowed`, `不能读明文` or
  `no-use-policy`. It answers "request access, ask for a fill, or stop?" without
  burning a read.
- `get_secret` on a `web` item always fails (`web-credential-is-fill-only`);
  `get_credential` fails the same way. That is by design.
- `request_fill` requires the origin to be in that item's fill policy and a
  registered executor to exist. A task id is not a value and is useless after
  `expiresInSeconds`.
- `materialize` never returns the value. Approval records a job; if the response
  is `pending`, show the `approvalUrl` and poll with `materialize_redeem` after
  the human approves.
- `http_request` enforces: HTTPS only, no userinfo, default port 443, no
  private/local hosts, method allowlist (GET/POST by default), headerName in
  `Authorization|X-Api-Key|Api-Key|X-Auth-Token`, body ≤64KB, 15s timeout. It
  needs a per-item `secret.use` target policy; without one it refuses.
- `request_credential` is the only correct move when an item does not exist.
  Give the returned link to the human; the broker stores what they type and
  grants this agent access.
- `put_secret` needs a human every time: first call returns the pending shape,
  approve it, then repeat the exact same call within 10 minutes. Omit `value`
  to change only metadata. A write approval is a one-shot ticket, not a grant —
  the next write needs its own approval.

## Refusals: what you will see

| Broker answer | Meaning | Do this |
|---|---|---|
| `vault locked; open the broker page or run unlock.mjs` | no unlock session | Ask the human to unlock `https://sb.otscup.com`. Never ask for the master password. |
| `agent is bound to another vault account` | token issued for a different vault | Stop. The operator must switch account/agent or share the item. |
| `pending approval: <url>` (also `{"status":"pending-approval","approvalUrl",...}`) | waiting on a human | Show the URL, wait, retry the same call. Do not queue a second request. |
| `agent not allowed to read this item：<why>` | name wrong, out of scope, or no grant | Read `<why>`: 没有名为「…」的条目 → fix the name; 不在 Agent 的可读范围内 → operator widens scope; 缺少这条授权 → `request_access`, or `explain_access`. |
| `agent not allowed to fill with this credential：<why>` / `use this credential (http_request)：<why>` | same, for fill/use | Same three reasons, same fix. |
| `capability revoked: access denied` / `expired` / `exhausted` / `account-mismatch` | the grant is gone, not absent | Stop and report the exact code. A new `request_access` is the only route. |
| `不能读明文：<hint> [<code>]` | read guard refused | Codes: `web-credential-is-fill-only` → `request_fill`; `unclassified-plaintext-off` → operator classifies it as `api`; `no-read-grant` → `request_access`; `account-mismatch` → wrong vault account; `item-id-unresolved` → operator re-grants. |
| `get_secret is disabled; set MCP_ALLOW_READ=1 to expose values` | plaintext switch off | Report it; use `http_request` or ask the operator to enable it. |
| `secret.use denied: no-use-policy` | no per-item HTTP target | Operator adds the target in the panel. Do not fall back to plaintext. |
| `secret.use denied: target-denied` | target not in the policy | Report the exact host/path; do not probe other URLs. |
| `fill execution layer is not configured` | no browser executor registered | Report it. Nothing the agent can do. |
| `fill is not permitted for this credential and origin: <reason>` | origin not in the item's fill policy | Report the origin and reason. |
| `target path is not on the materialize allowlist; add it in 设置 → 安全 first` | path not approved | Ask the operator to add the exact path. |
| `unknown materialize request` / `this request was already redeemed` / `this request expired` / `that target is no longer on the materialize allowlist` | job unusable | One redemption per approval; re-`materialize` only if the work still matters. |
| `nothing to write: pass value, username, totp, url, notes or group` | `put_secret` with no fields | Send at least one field. |
| `agent not allowed to write this item: it is outside the agent scope` | item/group outside the agent's write scope | Operator widens scope; do not retry with a different name. |
| `this agent is restricted to: <tools> — <name> is not allowed` | per-agent tool allowlist | Use one of the listed tools, or the operator adds this one. |
| `only https targets are allowed` / `private/local targets are not allowed` / `upstream request timed out (15s)` / `upstream fetch failed: <msg>` | `http_request` target or upstream problem | Fix the URL or report the upstream failure. The secret was fine. |
| `this endpoint accepts POST only` (HTTP 405) | client used GET/SSE | Configure Streamable HTTP POST; see connect failures below. |

## Mandatory workflow

1. `list_secrets` — if the item name is unknown, or to confirm the exact name
   and `kind`.
2. Pick the narrowest capability that finishes the task:
   - calling an API → `http_request` (value never reaches you);
   - login item to type into a site → `request_fill`;
   - credential must exist in a file → `materialize` + `materialize_redeem`;
   - plain secret is genuinely the deliverable → `get_secret`; login fields →
     `get_credential`.
3. On `pending approval: <url>` — give the URL to the human, wait, retry the
   same call. Never ask for the value and never work around the broker.
4. On any denial — `explain_access` once, then act on its answer or stop. Do not
   retry variations of the same call hoping for a different result.
5. Missing item — `request_credential` and hand over the one-time link. A
   credential you were asked to store or update — `put_secret`, then hand over
   the approval URL and retry the same call once it is approved.

## Connect failures

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

So: **never** answer a connection problem by asking the user to paste the
password/key, and **never** fall back to reading a local `.env` or config file.
Do exactly this:

1. **Retry once.** Wait a few seconds and repeat the same call (same tool, same
   arguments). A cold start or a rotated token often clears on the second try.
2. **If the retry also fails, report and stop.** Tell the user, in one message:
   the exact URL you called, the HTTP status and/or JSON-RPC error code, the
   response body (truncated, never a secret), and what you already tried
   (e.g. "POST /mcp twice, 401 both times"). Then stop; do not loop.
3. **Do not** ask the user for a key, password, master password or agent token
   in chat, and do not try a different transport or a local file "just to get
   unblocked".

Diagnose with these facts before reporting:

| Symptom | Likely cause | What to report / do |
|---|---|---|
| DNS/timeout, no HTTP status | broker unreachable from this host | URL + "no response" + retry count. Report; do not substitute a local secret. |
| `401` + `WWW-Authenticate: Bearer` (JSON-RPC `-32001 unauthorized`) | token missing, expired or revoked | Report the 401. Re-run OAuth (`/broker-setup`) or ask the operator to rotate the agent token — that is a connection fix, not a request for a secret. |
| `403` with `agent is bound to another vault account` | token bound to a different vault | Report it. Account switch is the operator's call. |
| `405` `this endpoint accepts POST only` | client used GET/SSE against `/mcp` | Report it; use Streamable HTTP POST. |
| `404` on `/mcp` | wrong base URL (typo, missing path) | Report the URL you used; correct it to `https://sb.otscup.com/mcp`. |
| HTML instead of JSON | a proxy/login page intercepted the call | Report the content type and first line. |
| `423` / `vault locked` | broker up, vault locked | Human unlocks the page. Never ask for the master password. |
| `tools/list` empty or missing `list_secrets` | endpoint reachable but not this broker | Report which tools came back. |

Verify reachability without touching a credential:
`GET https://sb.otscup.com/health` → `{"ok":true}`, then a `POST /mcp`
`initialize`. If health is 200 and initialize is 401, the network is fine and the
problem is auth — report that, do not ask the user for a password.

## Using a value safely

- Put it straight into the environment variable or command argument for the
  current step; do not echo it.
- Never put it in chat, tool output, shell history, logs, diffs, commit messages
  or generated files.
- Do not reuse it in later unrelated tasks.
- Do not write it to disk unless the operator allowlisted that exact path and
  you used `materialize`.

```bash
# Resolved through MCP by the agent; it is not printed here.
API_KEY="<resolved-by-mcp>" command-that-needs-key
```

## Configure MCP

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
```

Clients without remote OAuth use a static agent token:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
headers = { Authorization = "Bearer <agent token>" }
```

For DSH / Hermes, add the same URL as a remote MCP server and pick OAuth
discovery or the static Bearer header. Setup details and the verification
checklist live in the `broker-setup` skill.

## Hard rules

- Never ask "what is the password/key?" — use the broker.
- Never use the vault master password as an agent credential.
- Never print a secret into the chat or into any tool result the model reads.
- Never widen your own scope, retry a denial with different arguments, or
  approve your own pending request.
- If approval is required, wait for the human; never work around the broker.
