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

1. `list_secrets` — confirm the item exists and note its URL.
2. Decide: can the broker do the work for me?
   - **Yes** → `http_request` with `{name, url, method, body}`. The secret stays
     server-side. Prefer this always.
   - **No** (the value itself is the deliverable) → `get_secret`, and say so
     explicitly because the value will exist in the transcript.
3. If the request is refused, do **not** retry with different parameters to
   find a way through. Report the refusal and the exact reason.

Guardrails:

- Never use `get_secret` for something `http_request` can do.
- Never put a secret in a URL, a log line, a commit, or a file.
- If an item has no `secret.use` policy, the operator must add one; do not
  fall back to plaintext to get the job done.
- A shared credential is a production credential. Treat every use as a change
  that someone would want in the audit log.
