---
last_updated: 2026-08-16T05:38:15Z
status: active
---

# Project Context

## Project Overview

Atoms Studio —— AI 驱动的应用生成器，核心设计理念是「对比与选择」。一次需求并行产出两版风格迥异的单文件 HTML 应用，用户在左右双列中直接对比并选出最合适的版本，选择过程与落选方案一并存档，用于后续复盘与风格偏好学习。技术栈为 React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Dexie.js。

## Key Decisions
| Date | Decision | By | Rationale |
|------|----------|-----|-----------|
| 2026-08-15 | 文本生成走 Atoms Cloud 代理（gpt-5.6-sol）作为默认 atoms 模式 | Alex | 满足「API Key 不暴露在前端」的硬性要求，同时支持流式双列生成 |
| 2026-08-15 | 数据全部落 IndexedDB（Dexie），不建后端业务表 | Alex | 需求明确指定 IndexedDB；字段预留 userId/tags/isPublic 便于后续上云 |
| 2026-08-15 | 生成产物统一为内联 CSS/JS 的完整单文件 HTML，iframe sandbox 预览 | Alex | 保证 iframe 零外部依赖即可运行，且不污染宿主页面 |
| 2026-08-15 | 分享链接采用 gzip + base64url 编码进 URL，附纯 base64 回退 | Alex | 无需后端存储即可分享，老浏览器仍可打开 |
| 2026-08-15 | 风格标签优先读取生成代码内的 atoms-style meta，其次按 CSS 特征打分 | Alex | 支撑风格偏好统计，且对模型输出格式变化保持容错 |

## Constraints


