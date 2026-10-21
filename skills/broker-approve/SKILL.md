---
name: broker-approve
description: >
  Handle a pending Secrets Broker approval: show what is waiting, approve it
  with the right duration, and report the outcome. Use when the user says
  "/broker-approve", "approve the broker request", or an agent is waiting on
  an approval URL.
license: AGPL-3.0
---

# Broker Approve

Someone (an agent, a script, a plugin) is waiting for permission to read a
credential. Clear the queue.

## Steps

1. List what is pending. In the broker UI: `https://sb.otscup.com/#/grants`.
   From an agent that can see the broker, ask the human to open that page and
   press the approve button.
2. If the human asks you to pick, choose by intent:
   - one-off command → **仅本次 / once**
   - a session of work → **24 小时**
   - a long-lived integration → **永久 / always** (and prefer a dedicated
     agent with a narrow scope instead)
3. Confirm the result: the request disappears from the pending list and the
   agent reports a successful read.

## Rules

- Approve only the item the human named. Do not approve "everything pending" on
  your own initiative.
- A grant with `maxReads` is safer than an open-ended one; keep the limit if
  one is offered.
- If a request keeps reappearing for the same item, that agent is looping —
  fix the agent, not the approval.

## If the human wants the credential instead

They probably want `/broker` (fetch and use) or `/broker-lite`, not an
approval. Approvals are for agents that are waiting, not for handing values
to a chat.
