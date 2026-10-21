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

1. `get_secret` with `{ "name": "<item>" }`.
2. If it returns `pending approval: <url>` — show the URL and stop until the
   human approves, then retry.
3. Put the value in the command that needs it. Do not echo it, do not save it.

Everything else about the broker is in the `broker` skill; this is the shortcut
for when you already know the item name.

Never ask the user to paste the secret. Never print it.
