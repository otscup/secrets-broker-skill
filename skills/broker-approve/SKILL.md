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

Full tool reference: the `secrets-broker` skill (`SKILL.md` at this repo's root,
installed as `secrets-broker/SKILL.md`). Approving is a human action; you do not
need MCP tools for it.

## What an approval is

When an agent's call has no covering grant, the broker records a **pending
request** and hands the agent an approval URL. The request names the agent, the
item and the action: `secret.read` (plaintext out), `secret.use` (`http_request`
to a named host), `secret.fill` (browser executor types a login into a named
origin), `secret.materialize` (write one credential into one allowlisted file) or
`secret.write` (store/update an item via `put_secret`). Approving mints a
capability with a duration — `once` = one use, `1h`, `24h`, `7d`, `always`
(permanent) — or denied, and every decision is audited. A `secret.write` approval
is different: it unlocks **one** write of that item for ten minutes and stores no
value itself; the agent must repeat the call with the value inside that window.
Approvals arrive in the broker UI, over Telegram/ntfy/Gotify/wxpush, or in the
DSH plugin; all three hit the same pending queue and the same decision endpoint.

## Steps

1. List what is pending.
   - Broker UI: `https://sb.otscup.com/#/grants` (or the pending card on the
     dashboard).
   - Telegram: `/pending`, then `/approve #1 [once|1h|24h|7d|always]` or
     `/deny #1`. `/grants`, `/extend <agent> <item> <days|permanent>` and
     `/revoke <agent> <item> [action]` manage existing ones.
   - DSH plugin: the 待审批 cards, with 本次 / 24 小时 / 永久 / 拒绝.
2. If the human asks you to pick a duration, choose by intent:
   - one-off command → **once**
   - a session of work → **24h**
   - long-lived integration → **always**, but only together with a dedicated
     agent and a narrow scope.
3. Confirm the result: the request leaves the pending list and the agent's retry
   succeeds. A denial is not a retry prompt — the agent should stop.

## Rules

- Approve only the item and action the human named. Do not approve "everything
  pending" on your own initiative.
- Check the action before the item: approving `secret.read` on a `web` credential
  will still be refused by the read guard, and `secret.use` approvals are bound
  to the host they were requested for.
- `once` and a `maxUses` cap are safer than an open-ended grant; keep the limit
  when one is offered.
- Don't answer an approval request by pasting the secret into chat. The agent
  needs a capability, not the value.
- If the same request keeps reappearing for the same item, that agent is looping
  — fix the agent, not the approval. Denials already notify the operator at most
  once per 30 minutes per (agent, item, action); a flood means several agents.
- The human may prefer a standing answer: an item marked `noApproval` (within
  the agent's scope), or `/auto <agent|*> <duration> <minutes>` for a time-boxed
  auto-approval rule. Both are operator decisions — propose, don't assume.

## If the human wants the credential instead

They probably want `/broker` (fetch and use) or `/broker-lite`, not an
approval. Approvals are for agents that are waiting, not for handing values
to a chat.

## Connect failures

Operator rule, verbatim:

> 不要让agent连不上就去问用户，可以尝试重连一次，或者把遇到的问题反馈给用户

This skill often runs with no MCP session at all: the pending list may come from
the web page, Telegram or the plugin. If the broker page or API does not answer,
retry once, then report the URL, the status and what you tried — do not ask the
user for a password to "get in", and do not fall back to a credential file.
`GET https://sb.otscup.com/health` separates network from auth problems.
