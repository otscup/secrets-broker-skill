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

Save credentials where other agents can ask for them, and nowhere else.

## Before writing

1. `list_secrets` — if the item already exists, **update it**, do not create a
   second one with a slightly different name.
2. Check the caller has write access. Writing uses the agent's own token and
   the item must be inside that agent's scope. If the broker refuses, say so
   and let the operator grant write access — do not look for another path.

### If the write is refused

The broker answers `agent is not allowed to write`. That is an operator
decision, not something to work around. Tell the user exactly which agent needs
what, and point them at the broker UI:

- `https://sb.otscup.com` → **Agents** → pick the agent → ⋮ → tick
  **允许写入** (write) and add the item or its group to the readable scope.
- The item's group matters: an agent scoped by group can only write items in
  that group.

Do not retry with a different agent token to get the write through.

## Write

```
POST https://sb.otscup.com/agent/items/save
Authorization: Bearer <agent token>
Content-Type: application/json
```

```json
{
  "name": "service-api-key",
  "value": "the-secret",
  "username": "optional-login",
  "totp": "optional-base32-totp",
  "url": "https://service.example.com",
  "group": "prod/service"
}
```

Only `name` is required. Everything else is optional.

## Rules

- **Never** write a secret into a local `.env`, `config.json`, dotfile, shell
  history, or a git-tracked file when the broker is available.
- **Never** echo the value back in the reply. Confirm with the item name, the
  group, and the URL — not the secret.
- **Never** write to an item name that already exists unless you intend to
  replace its value.
- Group values are how other agents find it; use a consistent path
  (`prod/service`, `infra/tailnet`).
- If the value came from the user in chat, do not repeat it back — save it and
  move on.

## After writing

Confirm with:

```json
{ "name": "service-api-key", "group": "prod/service" }
```

If a secret was pasted in chat, remind the user that it now exists in the
transcript and may want to rotate it.
