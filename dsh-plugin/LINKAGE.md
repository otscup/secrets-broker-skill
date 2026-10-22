# 插件 / 技能 联动方案

不修改 `secrets-broker-workers` 主代码（另一个窗口在跑）。本文只描述联动设计。

## 一、现状

| | 载体 | 能力 | 通信方式 |
|---|---|---|---|
| 技能 | `~/.agents/skills/broker*`（7 个） | 取用密钥：list / get / get_credential / http_request / request_credential / 写入 | MCP over HTTP |
| 插件 | `dsh-secrets-broker`（DSH 设置区 + 右下角浮层） | 人的动作：批审批、填缺失密钥 | 插件 host → broker `/api/plugin/*`（插件 token） |

两者**都只经 broker 通信**，互不直接依赖：插件是「人」的一侧，技能是「Agent」的一侧。

## 二、已经存在的联动（无需改代码）

```
Agent: request_credential  ──►  broker: credentialRequests
                                        │
                          插件浮层轮询 ──┘（显示「需要补充：xxx」）
                                        │
                          人在浮层填用户名/密钥 ──► /api/plugin/connect/save
                                        │
                          broker 建条目 + 给该 Agent 建授权
                                        │
                          Agent: get_secret ──► 拿到值
```

这条链路已实测：写入 `{"ok":true,"created":true}`，读回值一致。

审批方向同理：Agent 请求 → broker pending → 插件浮层批 → Agent 读。

## 三、缺口与建议（按性价比排序）

### 1. 插件浮层缺「条目状态」，只缺「谁在等」

现在浮层只有两类卡片：待审批、待补充密钥。
**建议**：加一类「已授权/已使用」列表，让人在 DSH 里看到最近哪些 Agent 用了哪些条目。

broker 侧已有 `secret.read` / `secret.use` 审计事件，但插件端**没有读取审计的端点**。
需要 broker 加一个 `GET /api/plugin/usage`（只回 agent/name/time/action，不回 value）。
**成本**：broker 加 1 个只读端点 + 插件加 1 个列表卡片。**收益**：把「谁在用我的密钥」变成 DSH 内的可见事实，这正是插件相对网页的独特价值。

### 2. 插件的浮层是「被动轮询」，技能是「主动拉取」——节奏不一致

插件每 15s 轮询 broker；技能在调用 MCP 时同步拿结果。
用户在插件里批完，Agent 端要等下一次 MCP 调用才知道（除非 Agent 自己在轮询）。

**建议**：不动 broker 的前提下，插件在批准成功后，可以让技能侧通过 MCP `request_access` 拿到 pending→ok 的状态变化。**但**这依赖 Agent 是否在轮询，属于客户端行为，不是 broker 能强制的。

若要真正做到「批完即恢复」，需要在 broker 侧加一个 **长轮询 / 通知** 端点（如 `GET /api/plugin/wait?agent=X&id=Y` 挂起至批准）。这会改主代码，留给那个窗口决定。

### 3. 技能侧的写入（`/broker-write`）没有 UI 支撑

`/broker-write` 走 `POST /agent/items/save`，需要 agent 有 `write` 权限且条目在其 scope 内。
**缺口**：新 agent 默认无 write，写入会被 403；技能文档已写「让操作员开权限」，但没有「怎么开」。

**建议**：插件里加一个「Agent 权限」小卡片（只读显示某 agent 的 allow/groups/write），或者在 broker 网页里已有该项。**不新增端点**，插件复用现有 `/api/state` 即可（需管理员 Cookie，插件是服务端调用，可加一个 plugin-token 版的只读视图）。

### 4. 7 个技能偏多

现在有 `secrets-broker`（旧的）+ `broker` 系列 7 个，共 8 个，职责有重叠：

- `secrets-broker` ≈ `broker`（前者是模型自动触发，后者是斜杠命令）
- `broker-help` 与 `broker` 的工具表重复

**建议**：保留 `broker` 系列的 7 个，把旧的 `secrets-broker` 保留不动（它已被其他 Agent 引用），但在其描述里标注「斜杠命令见 /broker-help」，避免两套指令打架。**纯文档改动，零风险。**

### 5. 插件缺少「帮助」入口

技能有 `/broker-help`，插件没有对应说明。
**建议**：插件浮层顶部加一个 `?` 按钮，展开一行说明（当前 broker 地址、插件 token 位置、常见错误）。纯客户端改动。

## 四、让别的 Agent 也能用

现在有三条路，成本递增：

| 方式 | 覆盖 | 成本 | 适合 |
|---|---|---|---|
| **A. 导入 skill 仓库** | 任何支持 skills 的客户端（Codex / Claude Code / OpenCode / Hermes） | 复制 `skills/broker*` 目录 | 通用，已可做 |
| **B. stdio 桥接器** | 只支持本地 stdio MCP 的客户端 | 跑 `mcp-stdio/index.mjs`（已自带 OAuth 登录） | 已可做 |
| **C. 远端 MCP + OAuth** | 支持远程 MCP 的客户端 | 填 `https://sb.otscup.com/mcp` | 最简，已可做 |

**统一发布方式**：把 7 个 `broker*` 技能 + `mcp-stdio` 放在同一个仓库（已做：`otscup/secrets-broker-skill`），对方只需要「导入仓库」或「配置一行 URL」。

**DSH 插件不可移植**：它是 DSH 专属（cordis 插件 + 设置区），别的客户端没有等价物。
但**插件承担的是「人的动作」**——审批、填密——这些在别的客户端里没有 UI 承载，只能退回「人打开 broker 网页」。
所以对其他 Agent，正确形态是**只给技能 + MCP，不给插件**。

## 五、建议的执行顺序

1. 纯文档：去重 `secrets-broker` 与 `broker` 的表述（零风险，随时可做）
2. 插件内加「帮助」入口 + 最近使用列表（需 broker 加 1 个只读端点）
3. 技能侧补「怎么申请 write 权限」的操作步骤说明
4. 若要「批完即恢复」，评估 broker 长轮询（改主代码，交那个窗口）

## 六、边界

- 本轮**不改** `secrets-broker-workers` 主代码。
- 插件改的是 `E:\DeepSeek workers\dsh-secrets-broker`（独立包），与主仓库解耦。
- 技能改的是 `C:\Users\Administrator\.agents\skills\broker*`（独立目录）。
- 插件与 broker 之间的任何**新增端点**都需主仓库改动，因此本轮只做不依赖新端点的部分。
