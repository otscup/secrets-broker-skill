---
name: broker-write
description: >
  Store a credential in the self-hosted Secrets Broker instead of writing it to
  a local .env, a config file or a shell history. Use when the user says
  "/broker-write", "save this key to the broker", "put the password in the
  vault", or a task creates a credential that should be shared later.
argument-hint: "[item-name]"
license: AGPL-3.0
---

# Broker Write

Store the credential in the vault — never in a file, never in a prompt.

The broker (`https://sb.otscup.com/mcp`) is a Cloudflare Worker that holds named
vault items (`api` keys, `web` logins, unclassified ones), the agent registry and
the grant engine. Writing an item is **not** covered by a read grant: it takes a
`secret.write` approval from a human, and the approval is a one-shot ticket valid
for ten minutes, not a standing permission. The value is sent only after the
ticket exists, and the write lands in the audit log like every other action.

Full tool reference: the `secrets-broker` skill (`SKILL.md` at this repo's root,
installed as `secrets-broker/SKILL.md`).

## Path A — `put_secret` (MCP, the normal way)

1. Call `put_secret` with the fields you have:

   ```json
   {"name": "stripe-live", "value": "sk_live_...", "group": "billing", "notes": "created by agent"}
   ```

2. Nothing is stored yet. The answer is the pending shape:

   ```json
   {"status":"pending-approval","requestId":"...","approvalUrl":"https://sb.otscup.com/#pending","retryAfterSeconds":5,"next":"批准后重新调用同一个工具即可取到值；不需要再申请一次","message":"pending approval: ..."}
   ```

   Show the URL. The human approves it in the broker UI (`/#pending`), in
   Telegram (`/approve <id>`), or in the DSH plugin — all hit the same queue.
   Where the broker enforces human confirmation, it is this step: do not try to
   write before it lands.

3. After approval, repeat the **exact same call** within 10 minutes. The ticket
   is spent before the write, so one approval = one write:

   ```json
   {"status":"written","name":"stripe-live","updated":false}
   ```

4. Verify with `list_secrets` (name present, expected `kind`). Do not read the
   value back.

Omit `value` to change only metadata (`username`, `totp`, `url`, `notes`,
`group`) on an existing item. Fields: `name` (required, exact), `value`,
`username`, `totp`, `url`, `notes`, `group`. There is no rename here.

If the call comes back `agent not allowed to write this item: it is outside the
agent scope`, the name or group is not in this agent's scope — the operator fixes
that; retrying with another name is not a workaround.

## Path B — `POST /agent/items/save` (scripts, no MCP session)

```text
POST https://sb.otscup.com/agent/items/save
Authorization: Bearer <agent token>
content-type: application/json
```

Fields: `name` (required; update target or new name), `newName` (rename),
`group`, `value`, `username`, `totp`, `url`, `notes`. Success:
`{"ok":true,"name":...,"created":true}` or `{"ok":true,...,"updated":true}`.

This path is gated by the agent record: **允许写入（可调 `/agent/items/save`）**
must be on (`写入权限` in the Agents panel), and the item must be inside the
agent's allowlist/groups. There is no per-request approval here — the human gate
is enabling that flag, so ask before writing if you are unsure it is on.

## Responses

| Result | Meaning | Do this |
|---|---|---|
| `{"status":"pending-approval",...}` | waiting on the human | Show the URL, wait, retry the same call once. |
| `{"status":"written",...}` | stored | Report name + group, never the value. |
| `nothing to write: pass value, username, totp, url, notes or group` | `put_secret` with no fields | Send at least one field. |
| `agent not allowed to write this item: it is outside the agent scope` | scope | Operator widens scope; stop. |
| `403 agent is not allowed to write` | HTTP path, write flag off | Operator enables 允许写入; stop. |
| `403 agent not allowed to create this item` / `move this item to the target group` | HTTP path, scope | Ask the operator for the scope. |
| `423` / `vault locked` | vault unreachable from the Worker | Human unlocks `https://sb.otscup.com`. |
| `403 agent is bound to another vault account` | wrong account for this token | Fix the binding; do not retry blindly. |

A refusal is a decision, not a transient error: report the exact text and stop.

## Rules

- Never write a secret to a local file, shell history, commit or chat message.
- Never echo the value in your report or a log line.
- Updating an item replaces the stored value: confirm the exact name first.
- One approval, one write. A second write needs its own approval.
- Never put the secret in `notes` as a backup.

## Connect failures

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

Retry the same request once. If it still fails, report the URL, the HTTP status,
the response body and what you tried, then stop. Never ask the user for the
credential or the token to "just write it", and never fall back to a local `.env`.
Diagnosis: the `broker-setup` skill.
