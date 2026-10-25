---
name: broker-ultra
description: >
  Strictest broker mode: checks what the credential may be used for before
  using it, prefers server-side execution over plaintext, and refuses to widen
  scope on its own. Use when the user says "/broker-ultra", "be careful with
  keys", or the task touches production credentials.
argument-hint: "[item-name]"
license: AGPL-3.0
---

# Broker Ultra

Before touching a credential, know what you are about to do with it.

The broker (`https://sb.otscup.com/mcp`) separates four actions on a credential:
`secret.read` (plaintext out), `secret.use` (broker calls the API for you),
`secret.fill` (browser executor types a web login into one origin) and
`secret.materialize` (one credential into one allowlisted file). Each action is
a separate grant, bound to one agent and one item, with a duration, optional
use cap, and revocability. `secret.use` additionally requires a per-item target
policy naming the host and path — that policy, not the grant, is what bounds the
blast radius. Reads of `web` and unclassified items are refused by default; a
denied call is written to the audit log and notified to the operator, and retries
are rate-limited so they do not become a spam channel.

Full tool reference: the `secrets-broker` skill (`SKILL.md` at this repo's root,
installed as `secrets-broker/SKILL.md`).

## Workflow

1. `list_secrets` — confirm the item exists; note `kind` and URL.
2. `explain_access` with `{name, action: "secret.use", url: "<target>"}` before a
   production call. It returns the rule that decides, without spending a read.
   Do the same with `action: "secret.fill"` and `origin` for a web login.
3. Decide: can the broker do the work for me?
   - **Yes** → `http_request` with `{name, url, method, body}`. The secret stays
     server-side and the target must be in the item's use policy.
   - **No** (the value itself is the deliverable) → `get_secret` /
     `get_credential`, and say so explicitly because the value now exists in the
     transcript.
4. If the request is refused, do **not** retry with different parameters to find
   a way through. Report the refusal and the exact string, including any bracketed
   code such as `[web-credential-is-fill-only]`.

## Guardrails

- Never use `get_secret` for something `http_request` can do.
- Never put a secret in a URL, a log line, a commit, or a file.
- If an item has no `secret.use` policy, the operator must add one; do not fall
  back to plaintext to get the job done.
- `secret.use denied: target-denied` means the host/path is outside the policy —
  report it, do not probe neighbouring URLs.
- A `web` credential is fill-only. `request_fill` into its exact origin is the
  only way in; a plaintext read of it is a bug in your plan, not a broker fault.
- A shared credential is a production credential. Treat every use as a change
  that someone would want in the audit log.
- Writing is a human decision, not a side effect: `put_secret` stores nothing
  until the operator approves that one write. Never write a key locally "for
  now", and never treat an approval as a standing permission.

## Connect failures

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

Retry the same call once. If it still fails, report the URL, HTTP status and/or
JSON-RPC code, the response body and what you tried; then stop. Do not ask for a
key and do not read a local `.env` as a fallback. `GET /health` distinguishes a
network failure from an auth failure; full diagnosis is in `broker-setup`.
