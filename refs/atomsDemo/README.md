# atomsDemo —— 智能体驱动的 Web 应用生成平台

零代码门槛，用户输入一句自然语言需求，由 4 个内置智能体串行流水线协同工作，自动产出可运行的单文件 HTML 应用。

## ✨ 功能特性

- 🤖 **4 智能体流水线**：产品经理 → 全栈开发 → 测试工程师 → 团队领导，全流程智能驱动
- 🎨 **可视化预览**：iframe 沙箱实时预览生成的应用
- ✏️ **代码编辑器**：三文件（HTML/CSS/JS）实时编辑，即时生效
- 💬 **对话式迭代**：生成后可通过对话继续修改优化
- 📦 **项目管理**：本地持久化，支持新建、重命名、删除、搜索
- 🗂️ **版本管理**：每个项目最多保存 20 个历史版本，支持回滚
- 📥 **导出下载**：一键导出单文件 HTML，可独立运行
- 🎯 **模板优先**：内置 6 个常用模板，命中秒出

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui（暗色主题）
- Zustand（状态管理）
- Dexie / IndexedDB（本地持久化）
- CodeMirror（代码编辑器）
- React Router（HashRouter，适配静态部署）

### 后端
- FastAPI（可选，LLM 代理）
- 支持多种 LLM 接入方式：
  - Atoms 代理（后端代理，Key 不出服务端）
  - OpenAI 兼容端点（直接调用）
  - Mock 模板（离线演示）

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
cd app/frontend
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录，可部署到任意静态网站托管平台。

## 🧩 内置模板

| 模板 ID | 名称 | 匹配关键词 |
|---------|------|-----------|
| ledger | 个人记账本 | 记账、账本、开销、预算 |
| todo | 待办清单 | 待办、任务、todo、清单 |
| generic | 数据管理台 | 管理、列表、收藏、笔记 |
| spring-festival-ppt | 春节联欢晚会 | 春节、晚会、PPT、节目 |
| product-detail | 商品详情页 | 商品、详情、购物、电商 |
| pomodoro | 番茄钟计时器 | 番茄、计时器、专注、倒计时 |

## 📁 项目结构

```
atomsDemo开发/
├── app/
│   ├── frontend/          # 前端（React + TypeScript）
│   │   ├── src/
│   │   │   ├── components/   # UI 组件
│   │   │   ├── lib/
│   │   │   │   ├── llm/      # LLM 适配器
│   │   │   │   ├── pipeline/ # 智能体流水线
│   │   │   │   ├── parser.ts # 代码解析器
│   │   │   │   └── db.ts     # 本地数据库
│   │   │   ├── pages/        # 页面
│   │   │   └── store/        # 状态管理
│   │   └── dist/             # 构建产物
│   └── backend/           # 后端（FastAPI，可选）
├── cloudbase/
│   └── functions/         # 腾讯云 CloudBase 云函数
├── uploads/               # 原始需求文档
└── .atoms/                # 项目架构文档
```

## ⚙️ 配置说明

在设置中可配置：

- **运行模式**：
  - Atoms 代理：走后端代理，API Key 安全
  - OpenAI 兼容：直接调用兼容端点（如智谱、DeepSeek 等）
  - Mock 模板：离线演示，使用预置模板

- **模型名称**：要使用的模型标识
- **后端代理地址**：Atoms 模式下自定义后端地址
- **API Base URL / API Key**：OpenAI 模式下配置

## 📝 License

MIT
