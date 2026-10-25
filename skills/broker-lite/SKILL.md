---
name: broker-lite
description: >
  Fastest path to a credential: fetch it and use it, no ceremony. Use when the
  user says "/broker-lite", "just get the key", or wants the value in the next
  command. Trigger: /broker-lite.
argument-hint: "[item-name]"
license: AGPL-3.0
---

# Broker Lite

Get the value, use it, move on. No policy lecture.

The broker (`https://sb.otscup.com/mcp`) holds named items of three kinds: `api`
(keys, tokens, database URLs — readable), `web` (site/SSH/account logins — they
can only be filled into their allowlisted origin, never read) and `unclassified`
(refused until the operator classifies them). Your client is an Agent with a
scope; a per-item grant or an approval unlocks each call. Plaintext reads are
only exposed when the Worker runs with `MCP_ALLOW_READ=1`, and every read is
audited.

Full tool reference: the `secrets-broker` skill (`SKILL.md` at this repo's root,
installed as `secrets-broker/SKILL.md`).

1. `list_secrets` if the name is not known verbatim. `kind: web` means step 2 is
   `request_fill`, not `get_secret`.
2. `get_secret` with `{ "name": "<item>" }`.
   Login item (website / SSH / account / panel)? Use **`get_credential`**
   instead — it returns username + password + TOTP. `get_secret` gives only the
   password, and both refuse a `web` item outright.
   Calling an API? Use **`http_request`** and the value never reaches you.
3. If it returns `pending approval: <url>` — show the URL and stop until the
   human approves, then retry the same call once.
4. Put the value in the command that needs it. Do not echo it, do not save it.

## Connect failures

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

Retry once. If that fails, report the URL, status/error code and what you tried,
then stop. Never ask the user to paste the key and never fall back to a local
`.env`. Diagnosis lives in the `broker-setup` skill.

Everything else about the broker is in the `broker` skill; this is the shortcut
for when you already know the item name.

Never ask the user to paste the secret. Never print it.
