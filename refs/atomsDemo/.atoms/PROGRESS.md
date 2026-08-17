---
last_updated: 2026-08-04T15:23:03Z
---

# Requirements & Progress

## Requirements Overview
开发 atomsDemo：智能体驱动的 Web 应用生成平台。9 大核心需求模块：
1. **认证系统**：用户名 + 密码注册/登录，本地 SHA-256 哈希 + 每用户随机 salt 存 IndexedDB，会话 7 天持久化；支持访客模式（可体验不可保存）。
2. **需求输入**：自然语言文本框 + 示例 chips + 生成按钮。
3. **智能体流水线（核心）**：4 阶段串行 —— 规划（Planner，模板蓝图关键词加权评分匹配，无匹配则 LLM 生成蓝图 JSON）→ 生成（Generator，产出 index.html/style.css/app.js，分隔符格式，3 层降级解析）→ 校验（Validator，确定性 5 项检查，失败反馈重试最多 3 轮）→ 渲染（Renderer，拼接为单文件 HTML + 注入沙箱通信桥）。对应 4 个角色智能体：团队领导、产品经理、全栈开发工程师、测试工程师。
4. **可视化预览**：iframe srcDoc 沙箱，桌面/平板/手机视图切换，处理 READY/ERROR/LOG 三种 postMessage，运行时错误可一键交给智能体修复。
5. **代码编辑器**：CodeMirror 三文件 tab 切换 + 语法高亮 + 暗色主题，编辑后沙箱实时更新。
6. **对话式迭代修改**：流式输出 thinking（紫色主题）与 text，自动解析代码变更并应用到编辑器与沙箱，历史保存前剥离代码块。
7. **项目管理**：左侧列表，搜索 / 双击重命名 / 删除确认，`projectListVersion` 驱动刷新。
8. **版本管理**：保存版本（号递增，最多 20 个，带 note）+ 历史查看回滚。
9. **下载导出**：renderToHTML 生成单文件 HTML，Blob 下载，可独立运行。

## User Stories
- 作为无开发能力的用户，我输入「做一个个人记账本网页，支持增删记账记录，统计月度总开销」，点击生成后能看到 4 阶段流水线进度和每个智能体的输出日志，最终得到可交互的应用预览。
- 作为访客，我不登录也能体验生成流程，界面明确提示我是「访客」且项目不会被保存。
- 作为登录用户，我刷新页面后项目列表和历史任务仍然存在，可以随时回放某个历史任务的完整智能体输出与产物。
- 作为用户，当生成的应用在沙箱里报错时，我点击「智能体修复」按钮，错误信息自动填入对话框，智能体帮我修好代码并实时更新预览。
- 作为用户，我可以用自然语言说「加个按分类筛选的功能」或「按钮改成蓝色」，智能体最小化修改代码并同步到编辑器和预览。
- 作为用户，我可以手动编辑三个代码文件，沙箱实时反映我的修改。
- 作为用户，我可以保存版本快照（带备注）、查看历史版本列表并回滚。
- 作为用户，我可以下载单文件 HTML，双击本地打开即能独立运行。
- 作为产品经理角色的智能体，当需求过于模糊时我识别并交由团队领导终止任务，提示用户补充需求。

## Task Breakdown
| ID | Task | Assignee | Status | Deps |
|----|------|----------|--------|------|
| T1 | 后端 LLM 代理 Edge Function（claude-opus-5，流式/非流式） | Alex | Pending | - |
| T2 | Dexie 数据层：user/project/versions 三表 + CRUD | Alex | Pending | - |
| T3 | 认证：SHA-256 + 随机 salt、7 天会话、访客模式、zustand persist | Alex | Pending | T2 |
| T4 | LLM 适配器：mock / atoms / openai 三模式 + 预置模板蓝图 | Alex | Pending | T1 |
| T5 | 智能体流水线：4 角色 prompt + Planner/Generator/Validator/Renderer | Alex | Pending | T4 |
| T6 | 解析层：3 层降级解析 + 沙箱通信桥注入 + renderToHTML | Alex | Pending | T5 |
| T7 | 布局骨架：顶栏 + 可收起项目列表 + 主工作区三态路由 | Alex | Pending | T3 |
| T8 | 生成中页：4 阶段进度 + 思考过程紫色可展开 + 代码流式显示 | Alex | Pending | T5,T7 |
| T9 | 结果页：Sandbox 预览（3 视图 + 错误面板）/ CodeMirror 编辑器 / 分屏拖拽 | Alex | Pending | T6,T7 |
| T10 | 对话面板：流式 thinking + 改码解析应用 + 剥离代码块 + 可拉高 | Alex | Pending | T9 |
| T11 | 项目管理 + 版本管理（保存/历史/最多 20）+ 导出下载 | Alex | Pending | T2,T9 |
| T12 | 校验：lint + build 通过、CheckUI 验收 | Alex | Pending | 全部 |

## Progress Log
- 2026-08-04 已完整阅读需求文档 `/workspace/uploads/请你帮我开发一个web应用.txt`（含产品定位、9 大需求、UI/UX、技术栈、11 条验收标准）。
- 2026-08-04 已初始化全栈模板（app/frontend + app/backend），Atoms Cloud 后端激活成功，预览服务已启动。
- 2026-08-04 后端定位确认：仅作 LLM 调用代理（Edge Function，claude-opus-5），业务数据全部走 IndexedDB。
- 2026-08-04 已填充 ATOMS.md（项目概览/关键决策/硬性约束+设计规范）与 PROGRESS.md（需求概览/用户故事/12 项任务拆解）。

