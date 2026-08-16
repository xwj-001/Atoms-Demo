---
last_updated: 2026-08-16T05:38:15Z
---

# Architecture Design

## System Overview

Atoms Studio 是纯前端形态的 AI 应用生成器，核心理念是「看得见的思考过程」与「可迭代的生成体验」。用户输入需求并从简约风 / 卡片风 / 数据看板风中选一种，风格描述被注入 System Prompt 后生成单文件 HTML；生成过程中左侧思维链面板分四阶段展示推理，右侧 iframe 沙箱渲染成品。此后可在预览区下方持续提交修改意见做迭代，每轮结果追加为新版本，历史版本以时间线呈现且可随时恢复。文本生成经 Atoms Cloud 的 `client.ai.gentxt`（模型 gpt-5.6-sol）代理，API Key 不落前端；同时保留 OpenAI 兼容直连与离线模板两种模式。数据全部存于 IndexedDB，无自建数据表与自定义后端路由。

## Tech Stack

React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Dexie.js(IndexedDB) + @metagptx/web-sdk(client.ai) + sonner + react-router-dom。

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| LLM 适配器 | atoms / openai / mock 三模式统一入口，流式回调，失败自动降级；思维链构造；补丁模式提示词、锁定只读声明与上下文用量统计 | `src/lib/llm.ts` |
| 补丁引擎 | 解析 `--patch:file--` + SEARCH/REPLACE 块，精确与宽松两级定位、唯一性校验、失败原因清单 | `src/lib/patch.ts` |
| 差异引擎 | LCS 行级差异、未改动段折叠、大文件退化为整块替换 | `src/lib/diff.ts` |
| 沙箱体检 | 注入 ES5 体检脚本：交互冒烟（填表/点击/DOM 与 localStorage 变化）与视觉体检（溢出/裁切/触控尺寸/对比度），结论转修复指令 | `src/lib/sandboxAudit.ts` |
| 嵌入片段 | 三文件合成自包含 iframe srcdoc、体积预警、剪贴板降级复制 | `src/lib/embed.ts`, `src/components/studio/EmbedDialog.tsx` |
| 文件锁定 | 锁定状态定义、归一化与产物过滤（被锁文件强制保留基线内容） | `src/lib/codeFiles.ts`, `src/lib/db.ts` |
| 设置持久化 | LlmMode、apiKey、baseUrl、model、autoFallback 读写 localStorage | `src/lib/settings.ts` |
| 代码解析器 | 三层降级解析（分隔符 → Markdown 代码块 → 整体 HTML）、风格推断、两版差异摘要 | `src/lib/parser.ts` |
| 预置模板库 | 待办清单 / 记账本 / 番茄钟各含极简与创意两版完整单文件 HTML，含通用兜底 | `src/lib/templates.ts` |
| 数据持久化 | Dexie 表 apps / versions，保存选择、历史版本裁剪、搜索、风格统计、导出与分享编码 | `src/lib/db.ts` |
| 工作台页面 | 三栏布局编排、并行生成、思维链阶段揭示、选择保存、载入历史 | `src/pages/Index.tsx` |
| 分享预览页 | 解压 URL 中的 gzip+base64url 数据并 iframe 渲染 | `src/pages/Share.tsx` |
| 交互组件 | 对话区、双列预览、思维链面板、设置弹窗、选择弹窗、我的应用 | `src/components/studio/*` |
| 三文件结构层 | 单文件↔三文件互转、导出用纯净渲染与预览用注入渲染、沙箱消息类型 | `src/lib/codeFiles.ts` |
| 确定性校验器 | 5 项静态检查（JS 语法编译、跨文件引用、交互闭环、localStorage 读写、HTML 结构） | `src/lib/validator.ts` |
| 质量保障闭环 | 生成→解析→校验→带失败原因定向重试（最多 2 轮），取通过项最多的结果 | `src/lib/pipeline.ts` |
| 代码工作区 | CodeMirror 三文件分栏编辑，改动应用回预览并即时重校验、存为新版本 | `src/components/studio/CodeWorkspace.tsx` |
| 质量校验面板 | 展示校验结论、自动修复轨迹，以及沙箱回传的运行时报错与 console 输出 | `src/components/studio/QualityPanel.tsx` |
| LLM 代理层（后端） | 入口清洗（角色归一化 / 空消息过滤 / 单条截断 / 条数上限）+ 模型白名单与默认回落 + 非流式补全 | `backend/routers/llm_proxy.py`、`backend/services/llm_proxy.py`、`backend/schemas/llm_proxy.py` |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| 文本生成通道 | `client.ai.gentxt` + gpt-5.6-sol，stream 模式 | 后端代理避免密钥暴露，流式支撑双列实时生成过程 |
| 数据存储 | Dexie/IndexedDB，不建后端表 | 需求明确指定 IndexedDB 持久化；预留 userId/tags/isPublic 便于后续上云 |
| 预览隔离 | iframe + srcDoc + sandbox | 生成代码为完整单文件 HTML，沙箱隔离避免污染宿主页面 |
| 分享链接 | CompressionStream gzip + base64url，附纯 base64 回退 | 无需后端存储即可分享；旧浏览器仍可用 |
| 风格标签识别 | 生成代码内 `atoms-style` meta 优先，其次按 CSS 特征打分 | 支撑风格偏好学习统计，且对模型输出格式变化容错 |
| 历史版本上限 | 每应用保留 12 条（每轮 2 条） | 满足「至少 5 个」要求，同时避免 IndexedDB 无限膨胀 |
| 产物结构 | 三文件（index.html / style.css / app.js），预览与导出时合成单文件 | 分文件才能做可读的代码工作区与精准的跨文件引用校验；旧单文件数据自动拆分兼容 |
| 质量判定方式 | 纯确定性静态校验，不用 LLM 自评打分 | 同一份代码结论可复现，且失败原因能直接作为修复指令回喂模型 |
| 校验失败处理 | 把失败项清单回喂模型定向修复，最多 2 轮，取通过项最多者 | 避免整体重写导致行为漂移，也保证兜底结果不比首轮更差 |
| 预览渲染 | 双版本：导出用纯净单文件，预览用额外注入通信桥 | 桥在业务脚本前注入才能捕获初始化期错误，同时导出产物保持零平台残留 |
| 运行时可见性 | iframe 内劫持 error / unhandledrejection / console，postMessage 回传宿主 | 生成应用的白屏与静默报错在平台侧可定位，而非只能看到空白页面 |
| 上下文控制 | 迭代/修复提示按文件分块并设预算截断，历史代码块折叠为摘要 | 防止多轮迭代把上下文撑爆，同时保留模型定位改动所需信息 |
| 迭代编辑方式 | 迭代与修复默认补丁式 search/replace，补丁全部无法定位时自动回落整文件重写 | 省 token 且改动范围可审计，避免顺手改坏别处；回落保证链路不会因定位失败卡死 |
| 补丁定位策略 | SEARCH 片段要求逐字唯一命中，另留忽略行尾空白的宽松命中作为二级兜底 | 唯一性避免改错位置，宽松命中容忍模型的空白格式漂移 |
| 手改保护 | 手改过的文件自动加锁并随应用持久化，锁定文件只作为只读上下文传入 | 用户最不能接受的是刚改完又被模型冲掉；提示词声明 + 产物过滤双重拦截 |
| 质量三层化 | 静态校验之外新增沙箱交互冒烟与视觉体检，三层结论都可一键回喂修复 | 静态校验只能证明代码写对了，冒烟与体检才能抓出死按钮与界面错位 |
| 体检脚本形态 | 注入沙箱的脚本用 ES5 并全程 try/catch，冒烟后延迟一拍再做视觉检测 | 生成代码本身可能有问题，体检脚本不能连带崩掉；视觉检测的应是交互后的真实状态 |
| 上下文可见化 | 面板展示各文件占用、截断标记、锁定标记与预算占比 | 预算截断若不可见，用户会把质量下降误判为模型退化 |
| 嵌入方式 | iframe srcdoc 内联全部三文件，不引用平台任何接口 | 粘贴到博客或文档即可离线运行；超过 500KB 提示改用导出文件自托管 |
| 模型选择权 | 模型名由后端白名单裁决，非法或缺省一律回落默认模型 | 前端可传 model 等于让浏览器决定消耗哪种额度，白名单把这个决定权收回后端 |
| 多模型开放方式 | atoms 模式只开放白名单内的模型清单供选择，任意第三方模型走 OpenAI 兼容模式自备 Key | 平台额度必须受控，而用户想用的 DeepSeek/Kimi/通义等都提供兼容接口，不必为每家写一套适配 |
| 端点预设 | 内置 DeepSeek / Kimi / 通义 / SiliconFlow / OpenRouter / 本地 Ollama 预设，仅填 Base URL 与模型名 | 各家 baseUrl 与模型名格式差异大，手填最容易出错；预设可点选后再自由改写 |
| 生效模型回传 | 以调用层返回的模型为准逐层透传到 UI，而非直接回显用户选择 | 后端可能因白名单回落模型，只显示用户的选择会造成「我选了 A 其实跑的是 B」 |
| 入口清洗位置 | 角色归一化与空消息过滤放在后端代理入口，而非前端 | 非法 role 与空 content 会让上游直接 400，提前拦掉比整轮生成失败更划算 |
| 流式策略 | 用户在看的用流式（首轮生成、迭代），机器要解析的用非流式（定向修复） | 修复输出需按三文件分隔符严格切分，流式中断会让解析降级到兜底逻辑，出现「修完更差」 |

## File Tree Plan

```
app/frontend/
├── vercel.json                          # 一键部署配置（SPA rewrites）
├── tailwind.config.ts                   # 字体、warm/mint 扩展色、动效曲线
└── src/
    ├── index.css                        # 浅色毛玻璃主题 token 与 .glass 组件类
    ├── App.tsx                          # 路由：/ 与 /share
    ├── lib/{db,llm,parser,settings,templates}.ts
    ├── pages/{Index,Share}.tsx
    └── components/studio/
        ├── ConversationPanel.tsx        # 左栏 25%
        ├── PreviewColumn.tsx            # 中右两栏各 37.5%
        ├── ThoughtChainPanel.tsx        # 底部折叠思维链
        ├── SettingsDialog.tsx           # 齿轮设置
        ├── SelectVersionDialog.tsx      # 选择理由与命名
        └── MyAppsPanel.tsx              # 卡片网格 / 搜索 / 风格统计 / 对比历史
```

## Implementation Guide

1. 生成流程：`Index.handleGenerate` 构造 AbortController，`Promise.all` 并行跑 A/B 两列的 `generateApp`，onChunk 更新各列 streamText 与骨架屏；完成后 `parseGeneratedCode` → `inferStyleTag` → 渲染 iframe。
2. 降级链：atoms/openai 抛错且 `autoFallback` 开启时回落 mock（`matchTemplate` 关键词匹配预置模板），UI 以提示条说明降级原因。
3. 保存：`saveSelection` 写入 apps 主记录并追加两条 versions，超过 `MAX_VERSIONS_PER_APP` 自动裁剪最旧记录。
4. 新增预置模板：在 `templates.ts` 的 `PRESET_TEMPLATES` 追加条目，使用 `shell()` 包装并声明 `atoms-style`。
5. 扩展到云端：apps 表已含 userId / tags / isPublic / schemaVersion，改造时可直接映射到后端实体。

