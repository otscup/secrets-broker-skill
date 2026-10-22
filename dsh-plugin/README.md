# DSH plugin (dsh-secrets-broker)

A DSH Web plugin that puts the **human side** of the Secrets Broker inside DSH:
approve pending requests and fill in credentials the vault is missing, without
opening a second tab.

It talks to the broker over the same-origin routes the plugin host exposes, and
authenticates to the broker with a plugin token (`DSH_PLUGIN_TOKEN` Worker
secret).

## What it does

- **Right-bottom launcher** (🔐) is always present; click it for status and help.
- **待审批** cards: approve a pending request as 本次 / 24 小时 / 永久 / 拒绝.
- **待补充** cards: fill name, username and secret inline; the broker stores it
  and grants the requesting agent access.
- Input is never lost to the 15-second poll: the popup skips re-rendering while
  a field has focus and keeps drafts.
- Nothing secret is ever placed in the plugin's DOM except the value you typed,
  and that value is sent straight to the broker.

## Install

```powershell
Copy-Item -Recurse .\dsh-plugin "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-secrets-broker"
```

Then add it to the profile's `package.json`:

```json
{
  "dependencies": { "dsh-secrets-broker": "file:<path>/dsh-plugin" },
  "dsh": { "profile": { "bundles": ["...", "dsh-secrets-broker"] } }
}
```

Restart DSH Web.

The broker needs the matching secret:

```bash
wrangler secret put DSH_PLUGIN_TOKEN
```

The same token goes in the plugin token file the host reads:

```
%DSH_HOME%\secrets-broker\dsh-plugin-token.txt
```

## Verify

```bash
node dsh-plugin/test-popup.mjs
```

Prints `PASS launcher present` and `PASS empty panel opens with help`.

## Relationship to the skills

The skills (`/broker*`) are the **agent** side: fetch, use and store
credentials over MCP. The plugin is the **human** side: approve and fill.
Both talk to the same broker; see `LINKAGE.md` for how they chain together.

## Not included

- Reading secret values inside the plugin. The plugin never shows a stored
  value; that keeps a DSH-side log or screenshot from leaking one.
- Automatic resume of an agent after approval. That needs a broker-side
  long-poll and is tracked separately.
