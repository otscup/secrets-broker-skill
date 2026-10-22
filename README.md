# Secrets Broker skill

Portable instructions for any agent that supports **skills + remote MCP**. Hand it
the folder or the `SKILL.md` and configure the MCP server once; after that it will
use the broker automatically instead of asking you for passwords.

GitHub: `https://github.com/otscup/secrets-broker-skill`

相关仓库：

- Docker / Node 参考实现：<https://github.com/otscup/secrets-broker>
- Cloudflare Workers 版本：<https://github.com/otscup/secrets-broker-workers>

Import `SKILL.md` directly through an agent's GitHub skill importer, or clone this
repository and point the agent at the local folder. `mcp-stdio/` lets stdio-only
clients use the remote MCP endpoint with browser OAuth.

## Slash commands

Each folder under `skills/` is one slash command, installed side by side with
the existing `secrets-broker` skill:

| Command | What it does |
|---------|--------------|
| `/broker` | Fetch a credential through the broker; prefer server-side use. |
| `/broker-lite` | Fastest path: get the value and use it. |
| `/broker-ultra` | Strict mode: prefer `http_request`, never widen scope alone. |
| `/broker-write` | Store a credential in the broker instead of a local .env. |
| `/broker-approve` | Clear a pending approval request. |
| `/broker-setup` | Point a client at the MCP endpoint and verify it. |
| `/broker-help` | Reference card. |

Copy a folder into your skill root to install just that one:

```powershell
Copy-Item -Recurse .\skills\broker-lite "$env:USERPROFILE\.agents\skills\"
```

## DSH plugin (human side)

`dsh-plugin/` is a DSH Web plugin that puts approvals and credential filling
inside DSH, next to the agent that is waiting. The skills above are the
**agent** side (fetch over MCP); the plugin is the **human** side (approve,
fill). See `dsh-plugin/README.md` and `dsh-plugin/LINKAGE.md`.

The plugin is DSH-specific. Other clients take the skills and the MCP
endpoint, and fall back to the broker web page for approvals.

## What it does

The skill tells the agent to:

1. discover credentials with `list_secrets`;
2. pick the right read: `http_request` when calling an API (value never enters
   the model), `get_credential` for a login item (username + password + TOTP),
   `get_secret` for a plain secret;
3. if approval is needed, send you the approval URL and retry;
4. if the item does not exist, create a one-time fill link with
   `request_credential` instead of asking you to paste it;
5. never ask you for the secret value, master password or API key;
6. never print the value in chat/logs.

The broker does the actual access control: agent-bound vault account, item/group
allowlist, folder filter, grants, max reads, audit.

## MCP endpoint

```text
https://sb.otscup.com/mcp
```

OAuth 2.1 discovery:

```text
https://sb.otscup.com/.well-known/oauth-protected-resource
https://sb.otscup.com/.well-known/oauth-authorization-server
```

MCP clients that support remote OAuth use dynamic client registration + PKCE.
Clients without OAuth use a per-agent static token.

## Install per agent

### Codex

Copy `codex-config.toml` into your Codex `config.toml` (or merge the
`[mcp_servers.secrets]` section). Copy `SKILL.md` to your Codex skills directory
(for example `~/.codex/skills/secrets-broker/SKILL.md`).

OAuth-capable clients need only the `url`. If your client requires a header:

```toml
[mcp_servers.secrets]
url = "https://sb.otscup.com/mcp"
headers = { Authorization = "Bearer <agent token>" }
```

### DSH

Add the remote MCP URL in DSH's MCP settings, and place this folder under the
skills directory DSH loads (the exact path depends on your DSH version). The
skill's rules are model-facing; the MCP entry provides the tools.

### Hermes / other agents

Import `SKILL.md` as a skill/instruction file, then add the remote MCP endpoint
as above.

## stdio MCP bridge

Some agents only support local stdio MCP servers. Use the bundled bridge:

```bash
node mcp-stdio/index.mjs
```

It logs in to the broker with OAuth 2.1 (dynamic client registration + PKCE +
browser consent), caches the token in
`~/.secrets-broker/oauth.json`, then proxies stdio MCP requests to
`https://sb.otscup.com/mcp`.

Environment:

| Variable | Meaning |
|---|---|
| `BROKER_URL` | default `https://sb.otscup.com` |
| `BROKER_TOKEN` | optional static agent token; skips OAuth |
| `BROKER_TOKEN_FILE` | token cache path |
| `BROKER_NO_BROWSER=1` | print the login URL instead of opening a browser |

Codex-style config:

```toml
[mcp_servers.secrets]
command = "node"
args = ["/absolute/path/to/mcp-stdio/index.mjs"]
```

The bridge writes logs to stderr only; stdout is JSON-RPC.

## Create the agent identity

In `https://sb.otscup.com`:

1. Agents → create a dedicated agent, e.g. `dsh` or `codex`;
2. It is bound to the current vault account;
3. Set readable item/group scope; leave write disabled unless needed;
4. Copy the token once (or let MCP OAuth issue tokens instead).

For cross-account items: switch to the other account, share the item to this
agent, choose a target folder in the normal account, then switch back and unlock.
The broker copies the item into the normal account and grants the agent.

## Test without an agent

```bash
curl -s https://sb.otscup.com/mcp \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <agent token>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
```

Then:

```bash
curl -s https://sb.otscup.com/mcp \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <agent token>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_secret","arguments":{"name":"your-item"}}}'
```

The value is returned to the calling agent; do not show it in chat.

## Notes

- OAuth tokens are bound to the vault account that was unlocked when issued.
- `get_secret` requires `MCP_ALLOW_READ=1` on the Worker; the deployed broker has
  this enabled.
- The master password is only for the human unlock flow; it is never an agent
  credential.
- If the broker reports `vault locked`, a human must unlock it; the agent must not
  ask for the master password.
