---
last_updated: 2026-08-04T15:23:03Z
---

# Architecture Design

## System Overview
atomsDemo 采用「胖前端 + 瘦后端」架构：

- **前端（app/frontend）**：承载全部业务逻辑与数据。React SPA，业务数据（用户、项目、版本）全部持久化在浏览器 IndexedDB（Dexie）中，认证在本地完成（SHA-256 + 每用户随机 salt），会话状态由 zustand persist 维护 7 天。
- **后端（app/backend）**：仅作为 **LLM 调用代理**，提供一个自定义 API 路由，把前端的对话/生成请求转发给 AIHubService（模型固定 `claude-opus-5`），避免在浏览器暴露任何 API Key。后端不存储任何业务数据、不创建数据库表、不使用云端 Auth。

核心数据流（一次生成任务）：
```
用户自然语言需求
  → [团队领导] 任务受理与调度         (agents/leader)
  → [产品经理] 需求解析 → 蓝图 JSON    (pipeline/planner)  ← 模板蓝图匹配优先，无匹配则调 LLM
  → [全栈开发工程师] 生成三文件代码    (pipeline/generator) ← 完整收集输出后 3 层降级解析
  → [测试工程师] 确定性 5 项校验       (pipeline/validator) ← 失败则回退开发工程师，最多 3 轮
  → [团队领导] 最终评审
  → 渲染合成单文件 HTML + 沙箱桥      (pipeline/renderer)
  → iframe srcDoc 预览 / CodeMirror 编辑 / Dexie 持久化
```

## Tech Stack
| 层 | 选型 |
|----|------|
| 框架 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + shadcn/ui（暗色主题，slate #0f172a 基调 + violet 强调） |
| 状态管理 | zustand（authStore 用 persist 持久化会话与设置；workspaceStore 管理工作区瞬时状态） |
| 本地持久化 | Dexie（IndexedDB），三表：`users` / `projects` / `versions` |
| 代码编辑器 | @uiw/react-codemirror + @codemirror/lang-html/css/javascript |
| 图标 | lucide-react |
| 路由 | react-router-dom |
| 密码哈希 | Web Crypto API（SHA-256 + 随机 salt，PBKDF2 迭代） |
| LLM 接入 | 适配器模式：`mock`（预置模板流式）/ `atoms`（后端代理，claude-opus-5）/ `openai`（兼容端点 SSE） |
| 后端 | FastAPI + AIHubService（仅 LLM 代理路由 `/api/v1/llm/*`） |

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| 数据层 | Dexie 三表定义、用户/项目/版本 CRUD、版本数量上限 20 裁剪 | `src/lib/db.ts` |
| 认证 | 注册/登录/登出/访客模式、SHA-256 + 随机 salt、7 天会话过期校验 | `src/lib/crypto.ts`、`src/store/authStore.ts` |
| LLM 适配器 | 三模式统一接口 `streamChat()`，完整收集输出后回调；mock 预置模板降级 | `src/lib/llm/adapter.ts`、`src/lib/llm/mockTemplates.ts` |
| 解析层 | 3 层降级解析（`--file--` 分隔符 → markdown 代码块 → 整体 HTML）、剥离代码块 | `src/lib/parser.ts` |
| 流水线 | 4 阶段编排 + 4 智能体角色 Prompt + 阶段事件回调 | `src/lib/pipeline/index.ts`、`src/lib/pipeline/agents.ts` |
| 规划 | 模板蓝图关键词长度加权评分匹配（FindBestTemplate），无匹配调 LLM 出蓝图 JSON | `src/lib/pipeline/planner.ts` |
| 生成 | 按蓝图生成 index.html / style.css / app.js | `src/lib/pipeline/generator.ts` |
| 校验 | 确定性 5 项检查（JS 语法/HTML 引用完整性/交互闭环/持久化/HTML 结构） | `src/lib/pipeline/validator.ts` |
| 渲染 | 三文件合成单 HTML、替换 link/script 或注入、注入沙箱通信桥、导出下载 | `src/lib/pipeline/renderer.ts` |
| 布局 | 顶栏 + 可收起项目列表侧栏 + 主工作区三态切换 | `src/pages/Workspace.tsx`、`src/components/TopBar.tsx`、`src/components/ProjectList.tsx` |
| 生成中视图 | 4 阶段进度可视化、思考过程紫色可展开、代码流式显示 | `src/components/GeneratingView.tsx` |
| 结果视图 | 预览/代码/分屏三视图、分屏拖拽 20%–80%、工具栏 | `src/components/ResultView.tsx` |
| 沙箱 | iframe srcDoc、桌面/平板/手机切换、READY/ERROR/LOG postMessage 处理、错误面板 | `src/components/Sandbox.tsx` |
| 代码编辑器 | 三文件 tab、语法高亮、暗色主题、编辑防抖同步沙箱 | `src/components/CodeEditor.tsx` |
| 对话面板 | 流式 thinking/text、智能体切换、改码自动应用、可拉高冻结底部 | `src/components/ChatPanel.tsx` |
| 版本管理 | 保存版本（号递增、note）、历史列表、回滚 | `src/components/VersionDialog.tsx` |
| 后端代理 | 转发 LLM 请求到 AIHubService（claude-opus-5），非流式返回完整内容 | `app/backend/routers/llm.py`、`app/backend/services/llm_proxy.py` |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| 业务数据存储 | IndexedDB（Dexie），不用云端 DB | 用户明确要求；离线可用、无需后端表 |
| 认证方案 | 本地 SHA-256 + 每用户随机 salt | 用户明确要求；不使用 Atoms Cloud Auth |
| 后端职责 | 仅 LLM 代理，单一路由 | 避免前端暴露 API Key，其余全部前端自治 |
| LLM 模型 | claude-opus-5 | 代码生成质量最优，团队指定 |
| LLM 输出解析 | 先完整收集再 split | 流式实时解析会丢失/截断分隔符 |
| 校验实现 | 确定性代码检查（new Function + DOM 正则分析） | 用户明确要求，非 LLM 写报告，结果可复现 |
| 沙箱隔离 | iframe srcDoc + `allow-scripts allow-same-origin` | 生成应用需要 localStorage 持久化 |
| 降级策略 | mock 预置模板 | LLM 不可用时仍能演示端到端主链路 |
| 上下文控制 | 历史保存前剥离代码块 | 防止上下文膨胀导致后续对话变慢 |
| 列表刷新 | workspaceStore 维护 `projectListVersion` | 新建/删除项目后强制列表重取 |

## File Tree Plan
```
app/frontend/src/
├── main.tsx
├── App.tsx                      # 路由：/ (登录) /workspace
├── index.css                    # 暗色主题 token
├── lib/
│   ├── db.ts                    # Dexie: users/projects/versions
│   ├── crypto.ts                # salt + SHA-256 哈希
│   ├── parser.ts                # 3 层降级解析 + 剥离代码块
│   ├── llm/
│   │   ├── adapter.ts           # mock/atoms/openai 三模式
│   │   └── mockTemplates.ts     # 预置蓝图与代码模板
│   └── pipeline/
│       ├── agents.ts            # 4 智能体角色定义与 Prompt
│       ├── planner.ts           # 蓝图匹配/生成
│       ├── generator.ts         # 三文件代码生成
│       ├── validator.ts         # 确定性 5 项校验
│       ├── renderer.ts          # 合成单 HTML + 沙箱桥 + 导出
│       └── index.ts             # 流水线编排
├── store/
│   ├── authStore.ts             # persist 会话 7 天 + 访客模式
│   └── workspaceStore.ts        # 三态、文件、日志、projectListVersion
├── components/
│   ├── TopBar.tsx
│   ├── ProjectList.tsx
│   ├── GeneratingView.tsx
│   ├── ResultView.tsx
│   ├── Sandbox.tsx
│   ├── CodeEditor.tsx
│   ├── ChatPanel.tsx
│   └── VersionDialog.tsx
└── pages/
    ├── Login.tsx
    └── Workspace.tsx

app/backend/
├── routers/llm.py               # POST /api/v1/llm/complete
└── services/llm_proxy.py        # AIHubService 封装（claude-opus-5）
```

## Implementation Guide
1. **后端代理先行**：实现 `/api/v1/llm/complete`，接收 `messages`，非流式返回完整 `content`（业务需要完整输出后解析，非流式最稳）。
2. **数据层与认证**：Dexie 三表 + crypto 工具 + authStore（persist，含 `expiresAt` 7 天校验、`isGuest` 标记）。
3. **LLM 适配器**：统一 `complete(messages, onThinking?, onText?)` 接口；`atoms` 模式走 `client.apiCall.invoke`；失败自动降级 `mock`。
4. **流水线**：`runPipeline(requirement, onStageEvent)` 串行执行 4 阶段，每阶段产出 `AgentLog{ role, stage, input, output, status }` 供前端日志可视化；校验失败携带问题清单回到 generator，计数上限 3。
5. **渲染与沙箱**：`renderToHTML(files)` 返回纯净单文件（不含平台 UI）；`renderForSandbox(files)` 额外注入通信桥（error / unhandledrejection / READY / console 劫持 → postMessage）。导出用纯净版。
6. **UI 三态**：`workspaceStore.phase = 'input' | 'generating' | 'result'`；生成中禁用返回与重复生成。
7. **对话改码**：Prompt 强调「保留原有代码 + 最小化修改 + 输出完整文件」；解析成功后写回 store 触发沙箱与编辑器更新；入库历史剥离代码块。
8. **验收**：`pnpm i && pnpm run lint && pnpm run build` 必须零 TypeScript 报错，随后 CheckUI 验收。

