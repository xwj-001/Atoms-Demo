# Atoms Studio —— AI 应用生成器

输入一句自然语言需求，自动产出可直接运行的单文件 HTML 应用；支持对话式迭代、版本管理、质量自检与云端同步。

## ✨ 功能特性

### 生成与迭代
- 🎨 **三风格生成**：同一需求可分别按「简约 / 活力 / 商务」风格生成，风格通过 System Prompt 注入
- 🧠 **思维链可视化**：需求理解 → 技术选型 → 组件设计 → 样式方案 → 质量校验，五阶段推理渐进展示
- 💬 **对话式迭代**：预览区下方输入修改意见即可产出新版本，自动存档
- 🩹 **补丁式编辑**：迭代与修复默认输出 search/replace 补丁并在宿主打补丁，改动范围可审计；补丁全部无法定位时自动回落整文件重写
- 🔒 **文件锁定**：手动改过的文件自动加锁，模型只能将其作为只读上下文，不会被覆盖
- 🎯 **模板优先**：内置常用模板，命中关键词秒出结果，也可作为断网时的离线兜底

### 质量保障（三层）
- ✅ **静态校验**：JS 语法编译、跨文件引用一致性、交互闭环、localStorage 读写、HTML 文档结构，5 项确定性检查
- 🧪 **交互冒烟**：沙箱内自动填表与点击可交互元素，观察 DOM 变化与运行时报错，抓出「死按钮」
- 👁️ **视觉体检**：检测布局溢出、内容裁切、触控尺寸不足、低对比度
- 🔁 **自动修复闭环**：任一层校验未通过时，把失败项清单回喂模型定向修复，最多重试 2 轮，取通过项最多的结果
- 🐛 **运行时可见性**：预览 iframe 回传 error / unhandledrejection / 资源失败 / console 输出，白屏可定位

### 编辑与管理
- ✏️ **三文件代码工作区**：CodeMirror 分栏编辑 index.html / style.css / app.js，改动可应用回预览并即时重校验、存为新版本
- 🗂️ **版本管理**：每个应用保留多个历史版本，支持预览、回滚、单版本导出
- 🔍 **版本 diff**：任意两个版本行级差异并排对比，并附上两版校验结论的变化
- 📦 **项目管理**：本地持久化，支持搜索、打开、导出、删除，附风格偏好统计图表
- 📊 **上下文用量可见化**：展示每轮各文件占用、是否被截断、总体预算占比

### 分享与账号
- 📥 **导出下载**：一键导出为纯净单文件 HTML，零外部依赖可独立运行
- 🔗 **可嵌入 embed**：生成自包含 iframe 片段，粘贴到博客或文档即可离线运行（超过 500KB 会提示改用导出文件自托管）
- 🖼️ **灵感画廊**：可将作品设为公开，跨用户浏览、预览与导出
- 👤 **账号体系**：支持正式账号登录/注册，也支持游客登录（本地会话解锁全部本地能力）
- ☁️ **云端同步**：登录后本地 IndexedDB 与云端双向同步（dirty 标记 + remoteId 去重）

## 🤖 支持的模型

三种运行模式，可在设置面板中切换：

| 模式 | 说明 | 是否需要自备 Key |
|------|------|------------------|
| **Atoms 代理** | 走后端代理，Key 不出服务端 | 否 |
| **OpenAI 兼容** | 浏览器直接调用兼容端点 | 是 |
| **Mock 模板** | 离线演示，使用预置模板 | 否 |

### Atoms 代理模式可选模型

| 模型 | 擅长场景 |
|------|----------|
| `gpt-5.6-sol` | 综合均衡（默认） |
| `claude-opus-5` | 代码能力最强，复杂应用与补丁式迭代优先 |
| `deepseek-v4-pro` | 性价比高、速度快，适合频繁迭代 |
| `gemini-2.5-pro` | 生产级通用，风格还原稳定 |
| `gemini-3.1-pro-preview` | 超长上下文，代码体量大时使用 |

> 模型名由后端白名单裁决，传入非白名单模型会回落到默认模型并在响应中标记；界面显示的是**本轮实际生效**的模型，而非用户的选择值。

### OpenAI 兼容模式内置端点预设

DeepSeek、Kimi / Moonshot、通义千问（DashScope 兼容模式）、SiliconFlow、OpenRouter、本地 Ollama、OpenAI 官方。

预设只负责帮你填好 Base URL 与常用模型名，两个字段都可自由改写，因此**任何提供 OpenAI 兼容 `/chat/completions` 接口的服务都能接入**。API Key 仅存放在浏览器 localStorage，不会提交到仓库，也不会发往本项目后端。

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript + Vite 5
- Tailwind CSS + shadcn/ui（浅色毛玻璃主题）
- Dexie / IndexedDB（本地持久化）
- CodeMirror（`@uiw/react-codemirror`，三文件编辑器）
- React Router（**BrowserRouter**，需服务端 rewrite 支持）
- TanStack Query、Recharts、Sonner

### 后端（可选，但 Atoms 代理模式与云端同步依赖它）
- FastAPI + SQLAlchemy(async) + Alembic
- 模块化路由自动发现（`routers/` 目录下的 APIRouter 自动挂载）
- 核心接口：
  - `POST /api/v1/llm/complete` —— LLM 代理（角色归一化、空消息过滤、单条预算截断、消息条数上限、模型白名单）
  - `studio_apps` —— 作品云端存储与画廊
  - `auth` / `user` / `storage` / `settings` / `health`

## 🚀 快速开始

### 本地开发

```bash
# 前端
cd app/frontend
pnpm install
pnpm run dev
```

访问 http://localhost:3000

前端开发服务器已配置代理：`/api` 转发到 `http://localhost:8000`。若只想跑前端，把设置切到 **Mock 模板** 或 **OpenAI 兼容** 模式即可，无需启动后端。

```bash
# 后端（需要 Atoms Cloud 相关环境变量）
cd app/backend
pip install -r requirements.txt
python main.py
```

### 校验与构建

```bash
cd app/frontend
pnpm run lint     # ESLint 静态检查
pnpm run build    # 产物输出到 dist/
pnpm run preview  # 本地预览构建产物
```

## 📦 部署

### 方式一：Atoms 平台一键发布（推荐，能力最完整）

在 Atoms 的 App Viewer 中点击 Publish 即可发布，前端与 FastAPI 后端一起上线，Atoms 代理模式、账号登录、云端同步、灵感画廊全部可用，无需自己准备任何模型 Key。

### 方式二：静态托管（Vercel / Netlify / Cloudflare Pages）

仓库内 `app/frontend/vercel.json` 已配置好：

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "framework": "vite",
  "rewrites": [{ "source": "/((?!assets/).*)", "destination": "/index.html" }]
}
```

在平台上把 **Root Directory 设为 `app/frontend`** 即可自动识别。

⚠️ 纯静态部署的能力边界：
- ✅ **可用**：OpenAI 兼容模式（自备 Key）、Mock 模板模式、本地 IndexedDB 存储、版本管理、diff、质量校验、导出、embed
- ❌ **不可用**：Atoms 代理模式、账号登录/注册、云端同步、灵感画廊 —— 这些都依赖后端接口，静态站点没有 `/api`

如果希望静态前端也能用 Atoms 代理模式，需要单独部署后端，并在设置面板中把「后端代理地址」指向该后端（后端已开启 CORS 全域放通）。

### 方式三：GitHub Pages

可以部署，但有两个前提，因为本项目用的是 **BrowserRouter** 而非 HashRouter：

1. **子路径问题**：仓库页地址形如 `username.github.io/repo/`，需要在 `vite.config.ts` 中设置 `base: '/repo/'`
2. **刷新 404 问题**：GitHub Pages 不支持 rewrite，直接访问或刷新 `/auth/callback` 等子路由会 404。常见解法是把 `dist/index.html` 复制一份为 `dist/404.html`

若不想处理这两点，建议优先选择方式一或方式二。

### 方式四：自建后端（Docker / VPS）

后端是标准 FastAPI 应用，可用 uvicorn 或容器化部署。但需注意：**LLM 代理层依赖 Atoms Cloud 的 AI 能力与数据库/鉴权环境变量**。脱离 Atoms 平台自建时，需要自行替换 `services/llm_proxy.py` 依赖的上游调用与相应凭据，否则 Atoms 代理模式无法工作（此时改用 OpenAI 兼容模式即可）。

> 关于腾讯云 CloudBase 云函数：本项目**未包含** CloudBase 云函数目录，后端是完整的 FastAPI 服务而非函数式入口。若确实需要 CloudBase 部署，需要额外编写函数适配层（把 FastAPI 应用包一层 handler），不是开箱可用的。

## 📁 项目结构

```
.
├── app/
│   ├── frontend/                      # 前端（React + TypeScript + Vite）
│   │   ├── vercel.json                # 静态部署配置（SPA rewrites）
│   │   ├── tailwind.config.ts
│   │   └── src/
│   │       ├── components/studio/     # 工作台组件
│   │       │   ├── ControlPanel.tsx       # 需求输入 + 风格选择 + 快速模板
│   │       │   ├── PreviewPane.tsx        # 沙箱预览 + 生效模型徽标
│   │       │   ├── CodeWorkspace.tsx      # 三文件编辑 + 文件锁定
│   │       │   ├── QualityPanel.tsx       # 校验结论 / 冒烟体检 / 上下文用量
│   │       │   ├── DiffView.tsx           # 行级 diff 渲染
│   │       │   ├── VersionHistoryDialog.tsx
│   │       │   ├── EmbedDialog.tsx
│   │       │   ├── SettingsDialog.tsx     # 模式与模型配置
│   │       │   ├── MyAppsPanel.tsx / GalleryPanel.tsx
│   │       │   ├── ThoughtChainPanel.tsx
│   │       │   └── LoginGate.tsx / AccountMenu.tsx
│   │       ├── lib/
│   │       │   ├── llm.ts              # LLM 适配层（三模式 + 生效模型透传）
│   │       │   ├── settings.ts         # 模型清单与端点预设
│   │       │   ├── pipeline.ts         # 生成 → 解析 → 校验 → 修复闭环
│   │       │   ├── parser.ts           # 三层降级代码解析
│   │       │   ├── validator.ts        # 确定性静态校验
│   │       │   ├── patch.ts            # 补丁式编辑
│   │       │   ├── diff.ts             # 版本差异计算
│   │       │   ├── sandboxAudit.ts     # 交互冒烟 + 视觉体检
│   │       │   ├── codeFiles.ts        # 三文件互转与沙箱渲染
│   │       │   ├── embed.ts            # 可嵌入片段生成
│   │       │   ├── db.ts               # Dexie 本地数据库
│   │       │   ├── cloud.ts            # 云端同步
│   │       │   └── templates.ts        # 内置模板库
│   │       └── pages/Index.tsx         # 主工作台
│   └── backend/                       # 后端（FastAPI）
│       ├── main.py
│       ├── routers/                   # 自动发现并挂载
│       │   ├── llm_proxy.py           # LLM 代理接口
│       │   ├── studio_apps.py         # 作品云端存储
│       │   └── auth.py / user.py / storage.py / settings.py / health.py
│       ├── services/llm_proxy.py      # 消息清洗 + 模型白名单
│       └── schemas/llm_proxy.py
└── .atoms/                            # 架构与进度文档
    ├── ARCHITECTURE.md                # 关键设计决策与取舍理由
    ├── ATOMS.md
    └── PROGRESS.md
```

## ⚙️ 配置说明

设置面板中可配置：

- **运行模式**：Atoms 代理 / OpenAI 兼容 / Mock 模板
- **Atoms 模式**：从平台白名单模型清单中选择
- **OpenAI 兼容模式**：选择端点预设，或手填 Base URL、模型名与 API Key
- **后端代理地址**：Atoms 模式下自定义后端地址
- **自动降级**：调用失败时自动回落到 Mock 模板，保证演示不中断

所有配置持久化在浏览器 localStorage。若配置中的模型已下线，会自动回落到默认模型而非直接报错。

## 🔐 安全说明

- 仓库根目录已包含 `.gitignore`，已忽略 `node_modules`、`dist`、`.env`、`*.log`、`__pycache__` 等
- OpenAI 兼容模式的 API Key 只存于浏览器 localStorage，不写入代码、不提交仓库、不发往本项目后端
- Atoms 代理模式下 Key 完全不出服务端，前端拿不到

## 📝 License

MIT