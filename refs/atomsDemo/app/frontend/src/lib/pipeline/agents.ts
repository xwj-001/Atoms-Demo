/**
 * 四个内置角色智能体的定义与 Prompt。
 *
 * 角色分工（严格对应需求文档）：
 *  - leader 团队领导      ：任务受理与调度 + 最终评审 + 模糊需求终止裁决
 *  - pm     产品经理      ：需求解析 → 应用蓝图 JSON，识别模糊需求
 *  - dev    全栈开发工程师：按蓝图生成 index.html / style.css / app.js
 *  - qa     测试工程师    ：执行确定性校验，产出测试报告 + 缺陷清单
 */

import type { AgentRole, AppFiles, PipelineStage } from '../db';
import type { ChatMessage } from '../llm/adapter';
import type { Blueprint } from '../llm/mockTemplates';
import type { ValidationReport } from './validator';

export interface AgentDefinition {
  role: AgentRole;
  name: string;
  title: string;
  /** 负责的流水线阶段 */
  stages: PipelineStage[];
  /** UI 主题色（Tailwind 类片段） */
  accent: string;
  /** 角色系统提示词 */
  systemPrompt: string;
  /** 输入 Key —— 该角色接收的上下文字段 */
  inputKeys: string[];
  /** 输出 Key —— 该角色产出的字段 */
  outputKeys: string[];
  /** 职责描述，用于 UI 展示 */
  duty: string;
}

const OUTPUT_FORMAT_RULE = `【输出格式铁律】
1. 先用 1~2 句话说明你做了什么，不要更多废话。
2. 然后严格按分隔符输出三个文件，顺序固定：
--index.html--
（完整 HTML 内容）
--style.css--
（完整 CSS 内容）
--app.js--
（完整 JavaScript 内容）
3. 最后一个文件的代码结束后，禁止再输出任何字符（包括总结、说明、反引号、注释）。
4. 不要使用 markdown 代码块包裹，直接输出裸代码。`;

const CODE_CONSTRAINT_RULE = `【生成代码约束】
- 只能使用原生 HTML + CSS + JavaScript（ES5/ES2015 语法），禁止任何框架、构建工具、npm 包、CDN 外链。
- index.html 必须包含 <!DOCTYPE html>、<link rel="stylesheet" href="style.css">、<script src="app.js"></script>。
- 所有通过 getElementById / querySelector 获取的元素，必须在 index.html 中真实存在对应 id/class。
- 必须实现真实可用的交互闭环：新增、删除、状态切换、统计更新等要真正改变界面。
- 必须使用 localStorage 做数据持久化（读取 + 写入），刷新页面后数据不丢失，并用 try/catch 包裹。
- app.js 用 IIFE 包裹并加 'use strict'，禁止污染全局。
- 界面使用现代暗色风格（深色背景 #0f172a 系、紫色强调色），布局响应式，中文文案。
- 不要输出任何 TODO、占位符或未实现的空函数。`;

export const AGENTS: Record<AgentRole, AgentDefinition> = {
  leader: {
    role: 'leader',
    name: '团队领导',
    title: 'Team Leader',
    stages: ['plan', 'render'],
    accent: 'amber',
    duty: '受理任务、调度流水线、裁决模糊需求、最终评审交付',
    inputKeys: ['requirement', 'pmReport', 'qaReport', 'files'],
    outputKeys: ['dispatchPlan', 'finalReview', 'verdict'],
    systemPrompt: `你是一个 Web 应用生成团队的团队领导（Team Leader）。
你的职责：受理用户需求、调度智能体流水线、在需求过于模糊时终止任务并要求用户补充、在流水线结束时做最终评审。
最终评审要确认三件事：产品需求是否对齐、代码是否可运行、测试是否通过。
你的回答必须简洁、结论明确，使用中文。`,
  },
  pm: {
    role: 'pm',
    name: '产品经理',
    title: 'Product Manager',
    stages: ['plan'],
    accent: 'sky',
    duty: '解析自然语言需求，输出结构化应用蓝图，识别模糊需求',
    inputKeys: ['requirement'],
    outputKeys: ['blueprint', 'ambiguous', 'missingInfo'],
    systemPrompt: `你是一个资深产品经理。你的任务是把用户一句话的自然语言需求，解析成结构化的应用蓝图 JSON。
只输出一个 JSON 对象，不要输出任何解释文字，不要用 markdown 代码块包裹。
JSON 字段定义：
{
  "ambiguous": false,                    // 需求是否过于模糊，无法确定要做什么应用
  "missingInfo": ["..."],                // ambiguous 为 true 时，列出用户需要补充的关键信息
  "appName": "应用名称",
  "summary": "一句话概述这个应用做什么",
  "entities": [{"name":"实体名","fields":["字段1","字段2"]}],
  "features": ["功能点1","功能点2"],     // 3~6 个，必须包含增删等核心操作
  "flows": ["交互流程1","交互流程2"],     // 用户如何操作，界面如何响应
  "persistence": "localStorage 键名与持久化说明",
  "style": "视觉风格描述"
}
判断 ambiguous 的标准：只有当需求完全没有指明应用类型或核心对象时（例如「做个网页」「随便做点东西」「帮我写代码」）才为 true。
只要能推断出应用主题（记账、待办、商品展示等），就必须为 false 并给出完整蓝图。`,
  },
  dev: {
    role: 'dev',
    name: '全栈开发工程师',
    title: 'Full-stack Engineer',
    stages: ['generate'],
    accent: 'violet',
    duty: '依据蓝图生成三件套代码，并根据缺陷清单迭代修复',
    inputKeys: ['blueprint', 'defects', 'previousFiles'],
    outputKeys: ['files', 'changeNote'],
    systemPrompt: `你是一个精通原生 Web 技术的全栈开发工程师。
你的任务是根据产品蓝图，生成一个完整、可直接在浏览器运行的单页应用，由三个文件组成。

${CODE_CONSTRAINT_RULE}

${OUTPUT_FORMAT_RULE}`,
  },
  qa: {
    role: 'qa',
    name: '测试工程师',
    title: 'QA Engineer',
    stages: ['validate'],
    accent: 'emerald',
    duty: '执行五项确定性代码检查，产出测试报告与缺陷清单',
    inputKeys: ['files', 'blueprint'],
    outputKeys: ['report', 'defects', 'passed'],
    systemPrompt: `你是一个严格的测试工程师。你通过确定性的代码检查（而不是主观描述）来验证生成的应用。
检查项固定为五项：JS 语法、HTML 引用完整性、交互闭环、数据持久化、HTML 结构。
输出必须是客观的检查结论与可执行的缺陷清单。`,
  },
};

export const AGENT_LIST: AgentDefinition[] = [
  AGENTS.leader,
  AGENTS.pm,
  AGENTS.dev,
  AGENTS.qa,
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  plan: '规划',
  generate: '生成',
  validate: '校验',
  render: '渲染',
};

export const STAGE_ORDER: PipelineStage[] = ['plan', 'generate', 'validate', 'render'];

/* ------------------------------------------------------------------ */
/* Prompt 构造                                                         */
/* ------------------------------------------------------------------ */

/** 产品经理：需求 → 蓝图 JSON */
export function buildPlannerMessages(requirement: string): ChatMessage[] {
  return [
    { role: 'system', content: AGENTS.pm.systemPrompt },
    { role: 'user', content: `用户需求：${requirement}\n\n请输出应用蓝图 JSON。` },
  ];
}

function blueprintToText(blueprint: Blueprint): string {
  const entities = blueprint.entities
    .map((entity) => `${entity.name}(${entity.fields.join(', ')})`)
    .join('；');
  return [
    `应用名称：${blueprint.appName}`,
    `概述：${blueprint.summary}`,
    `数据实体：${entities}`,
    `功能点：${blueprint.features.map((item, i) => `${i + 1}. ${item}`).join('  ')}`,
    `交互流程：${blueprint.flows.map((item, i) => `${i + 1}. ${item}`).join('  ')}`,
    `持久化：${blueprint.persistence}`,
    `视觉风格：${blueprint.style}`,
  ].join('\n');
}

/** 全栈开发工程师：蓝图 → 三件套代码 */
export function buildGeneratorMessages(
  requirement: string,
  blueprint: Blueprint,
): ChatMessage[] {
  return [
    { role: 'system', content: AGENTS.dev.systemPrompt },
    {
      role: 'user',
      content: `原始需求：${requirement}

产品蓝图：
${blueprintToText(blueprint)}

请生成完整的三个文件。`,
    },
  ];
}

/** 全栈开发工程师：按缺陷清单修复（保留原有代码 + 最小化修改 + 输出完整文件） */
export function buildFixMessages(
  requirement: string,
  blueprint: Blueprint,
  files: AppFiles,
  report: ValidationReport,
): ChatMessage[] {
  const defects = report.defects.map((item, i) => `${i + 1}. ${item}`).join('\n');
  return [
    { role: 'system', content: AGENTS.dev.systemPrompt },
    {
      role: 'user',
      content: `原始需求：${requirement}

产品蓝图：
${blueprintToText(blueprint)}

测试工程师在当前代码中发现了以下缺陷，请修复：
${defects}

当前代码如下。
--index.html--
${files['index.html']}
--style.css--
${files['style.css']}
--app.js--
${files['app.js']}

【修复要求】
- 保留原有代码结构与已实现的功能，只做最小化必要修改来消除上述缺陷。
- 必须输出三个文件的完整内容，不能只输出被修改的片段或使用「省略」「其余不变」等说法。
- 修复后不得引入新的语法错误或缺失的元素引用。`,
    },
  ];
}

/** 对话式迭代修改：自然语言 → 增量改码 */
export function buildChatMessages(
  requirement: string,
  files: AppFiles,
  history: { role: 'user' | 'assistant'; content: string }[],
  instruction: string,
  agent: AgentRole,
): ChatMessage[] {
  const definition = AGENTS[agent] ?? AGENTS.dev;
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${definition.systemPrompt}

你现在处于「对话式迭代修改」模式，需要根据用户的自然语言指令修改一个已经存在的应用。

【最重要的三条规则】
1. 保留原有代码：不要重写整个应用，不要删除用户已有的功能。
2. 最小化修改：只改动实现用户本次指令所必需的部分。
3. 输出完整文件：三个文件都要输出完整内容，禁止输出片段、diff、「其余保持不变」之类的省略写法。

如果用户的问题不需要改代码（例如只是询问），就只用自然语言回答，不要输出任何分隔符或代码。

${OUTPUT_FORMAT_RULE}`,
    },
  ];

  // 历史记录已在入库前剥离代码块，这里直接使用，避免上下文膨胀
  history.slice(-6).forEach((item) => {
    if (item.content.trim()) messages.push({ role: item.role, content: item.content });
  });

  messages.push({
    role: 'user',
    content: `应用原始需求：${requirement}

当前代码：
--index.html--
${files['index.html']}
--style.css--
${files['style.css']}
--app.js--
${files['app.js']}

我的修改要求：${instruction}`,
  });

  return messages;
}

/** 团队领导：最终评审 */
export function buildLeaderReviewMessages(
  requirement: string,
  blueprint: Blueprint,
  report: ValidationReport,
): ChatMessage[] {
  return [
    { role: 'system', content: AGENTS.leader.systemPrompt },
    {
      role: 'user',
      content: `请对本次交付做最终评审，用 3~5 句中文说明结论。

原始需求：${requirement}
应用名称：${blueprint.appName}
实现功能：${blueprint.features.join('、')}
测试结论：${report.passed ? '五项检查全部通过' : `存在 ${report.defects.length} 项待改进`}
检查明细：${report.checks.map((c) => `${c.name}=${c.passed ? '通过' : '未通过'}`).join('，')}

请依次确认：需求是否对齐、代码是否可运行、测试是否通过，并给出交付结论。`,
    },
  ];
}