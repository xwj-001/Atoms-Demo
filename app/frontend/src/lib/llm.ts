import { createClient } from '@metagptx/web-sdk';
import { matchTemplate, mockIterate } from './templates';
import {
  ATOMS_MODEL,
  DEEPSEEK_MODEL,
  atomsModelLabel,
  deepseekModelLabel,
  isAtomsModel,
  isDeepSeekModel,
  type LlmMode,
  type StudioSettings,
} from './settings';
import { STYLE_LABEL, type StyleTag } from './db';
import {
  FILE_LABEL,
  lockedFiles as pickLockedFiles,
  renderToHTML,
  type CodeFiles,
  type FileLocks,
} from './codeFiles';
import { stripCodeBlocks } from './parser';
import { DIVIDER_MARK, REPLACE_MARK, SEARCH_MARK } from './patch';

const client = createClient();

/* ------------------------------ 思维链定义 ------------------------------ */

export type StageKey = 'requirement' | 'tech' | 'component' | 'style' | 'verify';
export type StageStatus = 'pending' | 'running' | 'done';

export interface ThoughtStage {
  key: StageKey;
  title: string;
  content: string;
  status: StageStatus;
}

export const STAGE_TITLES: Array<{ key: StageKey; title: string }> = [
  { key: 'requirement', title: '需求理解' },
  { key: 'tech', title: '技术选型' },
  { key: 'component', title: '组件设计' },
  { key: 'style', title: '样式方案' },
  { key: 'verify', title: '质量校验' },
];

export function emptyStages(): ThoughtStage[] {
  return STAGE_TITLES.map((s) => ({ ...s, content: '', status: 'pending' as StageStatus }));
}

/* ------------------------------ Prompt 构造 ------------------------------ */

const STYLE_PROMPT: Record<StyleTag, string> = {
  minimal:
    '风格偏好【简约风】：浅色中性底（#fafafa 一类），单列纵向布局，1px 描边替代阴影，圆角 8px 以内，不使用渐变与动画，字号层级克制，信息一眼可读。',
  card:
    '风格偏好【卡片风】：明亮柔和的渐变背景，内容以圆角 16px 卡片承载，配柔和阴影与 0.4s 进入动画，主按钮使用双色渐变，悬浮时轻微上移，整体氛围友好活泼。',
  dashboard:
    '风格偏好【数据看板风】：深色底（#0b1020 一类），顶部标题区 + KPI 指标卡片行 + 分区面板网格，包含进度条或占比条形图，数字使用等宽数字对齐，信息密度高且结构分明。',
};

/**
 * 硬性要求与确定性校验规则一一对应：
 * 每一条都能被 validator.ts 静态检出，因此模型知道会被怎样检查。
 */
const BASE_RULES = `硬性要求（会被自动校验，未通过会被打回重做）：
1. 产物必须拆成三个文件，使用如下分隔符输出，不要输出任何解释文字，也不要使用 Markdown 代码围栏：
--index.html--
<完整 HTML 文档，用 <link rel="stylesheet" href="style.css" /> 与 <script src="app.js"></script> 引用另外两个文件>
--style.css--
<全部样式>
--app.js--
<全部脚本>
2. index.html 必须包含 <!DOCTYPE html>、<meta charset="utf-8" />、viewport 声明，以及 <meta name="atoms-style" content="minimal|card|dashboard" />（与所选风格一致）。
3. 禁止任何外部依赖、CDN、远程字体或图片链接，离线打开必须完整可用。
4. 必须有真实交互闭环：至少一个按钮或可提交表单，脚本中绑定事件，并在事件里真正修改数据与重绘 DOM。
5. 必须使用 localStorage 同时完成读取与写入，刷新页面后数据不丢。
6. app.js 中通过 getElementById / querySelector('#id') 访问的每个 id，都必须真实存在于 index.html。
7. 禁止 TODO、占位符、无响应按钮；界面文案用简体中文，并处理空状态。
8. 视觉底线：内容不得横向溢出视口，按钮尺寸不小于 32×26px，文字与背景对比度不低于 4:1。`;

/**
 * 补丁模式规则。让模型只描述「把哪一段换成什么」，
 * 而不是重吐整份文件：省 token、改动可审计，也不容易顺手改坏别处。
 */
const PATCH_RULES = `本轮请以补丁形式输出，不要重写整份文件。格式如下，可重复多个补丁块：
--patch:index.html--
${SEARCH_MARK}
<必须与现有文件逐字一致的原文片段>
${DIVIDER_MARK}
<替换后的新内容>
${REPLACE_MARK}

补丁硬性要求：
1. SEARCH 片段必须与给出的当前文件内容逐字一致（含缩进），且在该文件中唯一出现；如果一段不唯一，请多带几行上下文让它唯一。
2. SEARCH 片段尽量小，只覆盖需要改动的行及必要上下文，不要整块贴文件。
3. 每个补丁块前必须有 --patch:index.html-- / --patch:style.css-- / --patch:app.js-- 指明目标文件。
4. 需要新增内容时，把插入点附近的原文放进 SEARCH，在 REPLACE 里连同新内容一起写出。
5. 不要输出解释文字、不要使用 Markdown 代码围栏、不要输出未改动的文件。
6. 改完后整体仍须满足原有硬性要求（交互闭环、localStorage 读写、引用一致、无外部依赖）。`;

export function buildSystemPrompt(style: StyleTag, patchMode = false): string {
  return `你是一位资深前端工程师，擅长用原生 HTML/CSS/JS 三文件交付完整可用的小应用。
${STYLE_PROMPT[style]}
${BASE_RULES}${patchMode ? `\n\n${PATCH_RULES}` : ''}`;
}

function buildCreateUserPrompt(description: string, style: StyleTag): string {
  return `请生成一个网页应用。

需求描述：
${description}

目标风格：${STYLE_LABEL[style]}

请严格按系统提示中的三文件分隔符格式输出。`;
}

/** 单文件在上下文中的预算上限，超出即截断，避免上下文无限膨胀 */
export const FILE_BUDGET: Record<keyof CodeFiles, number> = { html: 9000, css: 6000, js: 8000 };

/** 三文件预算之和，用于计算整体占用比例 */
export const TOTAL_BUDGET = FILE_BUDGET.html + FILE_BUDGET.css + FILE_BUDGET.js;

/* --------------------------- 上下文用量可见化 --------------------------- */

export interface FileUsage {
  file: keyof CodeFiles;
  label: string;
  chars: number;
  budget: number;
  truncated: boolean;
  /** 被锁定的文件仅作参考传入，模型不得改动 */
  locked: boolean;
}

/**
 * 一轮请求的上下文占用明细。做了预算截断但用户看不见的话，
 * 生成质量下降时会误以为是模型退化，所以把截断情况显式暴露出来。
 */
export interface ContextUsage {
  files: FileUsage[];
  systemChars: number;
  promptChars: number;
  totalChars: number;
  totalBudget: number;
  /** 三文件正文占预算的比例 */
  ratio: number;
  truncated: Array<keyof CodeFiles>;
  locked: Array<keyof CodeFiles>;
  mode: 'full' | 'patch';
}

function clip(content: string, budget: number): string {
  const text = content.trim();
  if (!text) return '（空文件）';
  if (text.length <= budget) return text;
  return `${text.slice(0, budget)}\n/* …已截断，保持未展示部分不变 */`;
}

function buildUsage(
  files: CodeFiles | undefined,
  locks: FileLocks | undefined,
  systemChars: number,
  promptChars: number,
  mode: 'full' | 'patch',
): ContextUsage {
  const keys: Array<keyof CodeFiles> = ['html', 'css', 'js'];
  const detail: FileUsage[] = keys.map((file) => {
    const chars = (files?.[file] ?? '').trim().length;
    return {
      file,
      label: FILE_LABEL[file],
      chars,
      budget: FILE_BUDGET[file],
      truncated: chars > FILE_BUDGET[file],
      locked: locks?.[file] === true,
    };
  });
  const bodyChars = detail.reduce((sum, item) => sum + Math.min(item.chars, item.budget), 0);
  return {
    files: detail,
    systemChars,
    promptChars,
    totalChars: systemChars + promptChars,
    totalBudget: TOTAL_BUDGET,
    ratio: TOTAL_BUDGET ? Math.min(1, bodyChars / TOTAL_BUDGET) : 0,
    truncated: detail.filter((d) => d.truncated).map((d) => d.file),
    locked: detail.filter((d) => d.locked).map((d) => d.file),
    mode,
  };
}

/* --------------------------- 迭代 / 修复提示 --------------------------- */

/** 锁定说明：明确告诉模型哪些文件只能读、不能改 */
function lockNotice(locks?: FileLocks): string {
  const locked = locks ? pickLockedFiles(locks) : [];
  if (!locked.length) return '';
  return `\n\n【只读文件】${locked
    .map((key) => FILE_LABEL[key])
    .join('、')} 已被用户锁定，只能作为参考阅读，禁止输出对它们的任何改动。请把需要的调整放到未锁定的文件里完成。`;
}

function filesBlock(files: CodeFiles): string {
  return `--index.html--
${clip(files.html, FILE_BUDGET.html)}

--style.css--
${clip(files.css, FILE_BUDGET.css)}

--app.js--
${clip(files.js, FILE_BUDGET.js)}`;
}

function buildIteratePrompt(
  files: CodeFiles,
  instruction: string,
  style: StyleTag,
  patchMode: boolean,
  locks?: FileLocks,
): string {
  return `下面是当前版本的三个文件。

${filesBlock(files)}

请在保留既有功能与整体${STYLE_LABEL[style]}风格的前提下，按以下修改意见调整：
${stripCodeBlocks(instruction)}${lockNotice(locks)}

${
  patchMode
    ? '要求：以补丁块形式输出改动，不要重写整份文件。'
    : '要求：输出修改后的完整三个文件（不是差异片段），仍然使用系统提示中的分隔符格式。'
}`;
}

function buildRepairPrompt(
  files: CodeFiles,
  issues: string[],
  style: StyleTag,
  patchMode: boolean,
  locks?: FileLocks,
): string {
  return `下面是当前版本的三个文件，自动检查没有通过。

${filesBlock(files)}

必须修好的问题清单：
${issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}${lockNotice(locks)}

${
  patchMode
    ? '要求：仅针对上述问题输出补丁块，不要重写整份文件，保持其余结构与风格不变。'
    : `要求：仅针对上述问题修改，保持其余结构、交互与${STYLE_LABEL[style]}风格不变，输出修复后的完整三个文件，仍使用分隔符格式。`
}`;
}

/* ------------------------------ 适配器接口 ------------------------------ */

export type GenerateIntent = 'create' | 'iterate' | 'repair';

export interface GenerateOptions {
  /** 需求描述、修改意见，或修复时的失败项说明 */
  input: string;
  style: StyleTag;
  settings: StudioSettings;
  intent: GenerateIntent;
  /** 迭代与修复时传入当前三文件 */
  currentFiles?: CodeFiles;
  /** 修复时的问题清单（校验 / 冒烟 / 视觉体检） */
  issues?: string[];
  /** 被锁定的文件，模型只读不改 */
  locks?: FileLocks;
  /** 是否要求补丁式输出 */
  patchMode?: boolean;
  onChunk?: (accumulated: string) => void;
  signal?: AbortSignal;
}

export interface GenerateResult {
  raw: string;
  /** 真正生效的模式，可能因降级而与设置不同 */
  usedMode: LlmMode;
  /** 真正生效的模型标识；atoms 模式下以后端返回值为准（可能被白名单回落） */
  usedModel: string;
  fallbackReason?: string;
  usage: ContextUsage;
}

/** 单次调用的原始产出：文本 + 实际生效模型 */
interface RunOutput {
  raw: string;
  model: string;
}

/** 离线模板不经过任何模型，用固定标识占位 */
const MOCK_MODEL = 'offline-template';

/**
 * 解析 atoms 模式下要使用的模型。
 * 前端做一层白名单校验，避免把已下线的历史设置继续发给后端。
 */
function resolveAtomsModel(settings: StudioSettings): string {
  const candidate = settings.atomsModel?.trim();
  return isAtomsModel(candidate) ? (candidate as string) : ATOMS_MODEL;
}

/**
 * 解析 deepseek 模式下要使用的模型。
 * 只允许 deepseek 系列，避免借这条通道调用其他上游模型。
 */
function resolveDeepSeekModel(settings: StudioSettings): string {
  const candidate = settings.deepseekModel?.trim();
  return isDeepSeekModel(candidate) ? (candidate as string) : DEEPSEEK_MODEL;
}

/**
 * LLM 适配器：atoms / openai / mock 三模式统一入口。
 * 前两种失败时（若开启自动降级）自动回落 mock，保证 Demo 始终可演示。
 */
export async function generateApp(options: GenerateOptions): Promise<GenerateResult> {
  const { settings } = options;
  const messages = buildMessages(options);
  const usage = buildUsage(
    options.currentFiles,
    options.locks,
    messages[0].content.length,
    messages[1].content.length,
    options.patchMode ? 'patch' : 'full',
  );

  if (settings.mode === 'mock') {
    const mock = await runMock(options);
    return { ...mock, usage };
  }

  // DeepSeek 通道经后端代理转发，代理层为非流式返回，因此固定不走流式；
  // 另外需要严格切分的输出（补丁、定向修复）也一律非流式，
  // 流式一旦中断就会解析降级；用户正在观看的首轮生成与普通迭代仍保持流式。
  const useStream =
    settings.mode !== 'deepseek' && options.intent !== 'repair' && !options.patchMode;

  try {
    const output =
      settings.mode === 'deepseek'
        ? await runDeepSeek(options, messages, resolveDeepSeekModel(settings))
        : settings.mode === 'atoms'
          ? await runAtoms(options, messages, useStream, resolveAtomsModel(settings))
          : await runOpenAiCompatible(options, messages, useStream);
    const trimmed = output.raw.trim();
    if (!trimmed) throw new Error('模型返回内容为空');
    return { raw: trimmed, usedMode: settings.mode, usedModel: output.model, usage };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const reason = errorMessage(error);
    if (!settings.autoFallback) throw new Error(reason);
    const fallback = await runMock(options);
    return { ...fallback, fallbackReason: reason, usage };
  }
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

function buildMessages(options: GenerateOptions): [ChatMessage, ChatMessage] {
  const { input, style, currentFiles, intent, issues, locks, patchMode } = options;
  const usePatch = !!patchMode && !!currentFiles;

  let userContent: string;
  if (intent === 'repair' && currentFiles) {
    userContent = buildRepairPrompt(currentFiles, issues ?? [input], style, usePatch, locks);
  } else if (intent === 'iterate' && currentFiles) {
    userContent = buildIteratePrompt(currentFiles, input, style, usePatch, locks);
  } else {
    userContent = buildCreateUserPrompt(input, style);
  }

  return [
    { role: 'system', content: buildSystemPrompt(style, usePatch) },
    { role: 'user', content: userContent },
  ];
}

/* ------------------------------ atoms 模式 ------------------------------ */

/** 后端 LLM 代理返回体：角色归一化与模型白名单在服务端完成 */
interface ProxyCompleteData {
  content?: string;
  model?: string;
  model_fallback?: boolean;
}

/**
 * 非流式补全：经由后端 `/api/v1/llm/complete` 代理。
 * 一次性拿到完整文本，避免末尾被截断导致分隔符或补丁标记解析失败。
 */
async function runAtomsComplete(
  options: GenerateOptions,
  messages: ChatMessage[],
  model: string,
): Promise<RunOutput> {
  const response = await client.apiCall.invoke({
    url: '/api/v1/llm/complete',
    method: 'POST',
    data: { messages, model },
    options: { timeout: 600_000 },
  });

  const data = (response?.data ?? {}) as ProxyCompleteData;
  const content = (data.content ?? '').trim();
  if (!content) throw new Error('Atoms 代理返回内容为空');
  // 非流式没有中间片段，一次性推给 UI 保证进度可见
  options.onChunk?.(content);
  // 后端可能因白名单把模型回落成默认模型，以它返回的为准
  return { raw: content, model: data.model?.trim() || model };
}

async function runAtoms(
  options: GenerateOptions,
  messages: ChatMessage[],
  useStream: boolean,
  model: string,
): Promise<RunOutput> {
  if (!useStream) return runAtomsComplete(options, messages, model);

  let accumulated = '';

  await client.ai.gentxt({
    messages,
    model,
    stream: true,
    onChunk: (chunk: { content?: string }) => {
      const delta = chunk?.content ?? '';
      if (!delta) return;
      accumulated += delta;
      options.onChunk?.(accumulated);
    },
    onComplete: (final: { content?: string }) => {
      if (final?.content && final.content.length > accumulated.length) {
        accumulated = final.content;
        options.onChunk?.(accumulated);
      }
    },
    onError: (error: { message?: string }) => {
      throw new Error(error?.message || 'Atoms 代理调用失败');
    },
  });

  return { raw: accumulated, model };
}

/* ---------------------------- deepseek 模式 ---------------------------- */

/**
 * DeepSeek 通道：请求交给后端 `/api/v1/llm/deepseek/complete` 转发，
 * 密钥只存在服务端环境变量里，浏览器侧不持有任何凭据。
 * 后端为非流式返回，这里一次性把完整文本推给 UI 保证进度可见。
 */
async function runDeepSeek(
  options: GenerateOptions,
  messages: ChatMessage[],
  model: string,
): Promise<RunOutput> {
  const response = await client.apiCall.invoke({
    url: '/api/v1/llm/deepseek/complete',
    method: 'POST',
    data: { messages, model },
    options: { timeout: 600_000 },
  });

  const data = (response?.data ?? {}) as ProxyCompleteData;
  const content = (data.content ?? '').trim();
  if (!content) throw new Error('DeepSeek 代理返回内容为空');
  options.onChunk?.(content);
  // 默认模型未开通时后端会兜底换模型，以它返回的为准
  return { raw: content, model: data.model?.trim() || model };
}

/* ----------------------------- openai 模式 ----------------------------- */

async function runOpenAiCompatible(
  options: GenerateOptions,
  messages: ChatMessage[],
  useStream: boolean,
): Promise<RunOutput> {
  const { settings, signal } = options;
  if (!settings.apiKey.trim()) throw new Error('未配置 API Key，请在设置中填写');

  const model = settings.model.trim() || 'gpt-4o-mini';
  const base = settings.baseUrl.trim().replace(/\/+$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      stream: useStream,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`端点返回 ${response.status}${detail ? `：${detail.slice(0, 160)}` : ''}`);
  }

  if (!useStream) {
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = (json.choices?.[0]?.message?.content ?? '').trim();
    if (!content) throw new Error('端点返回内容为空');
    options.onChunk?.(content);
    return { raw: content, model };
  }

  if (!response.body) throw new Error('端点未返回流式响应体');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = json.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          accumulated += delta;
          options.onChunk?.(accumulated);
        }
      } catch {
        /* 忽略无法解析的心跳片段 */
      }
    }
  }

  return { raw: accumulated, model };
}

/* ------------------------------ mock 模式 ------------------------------ */

const MOCK_CHUNK = 1000;

/** 离线模板不支持补丁，始终返回完整文档，由上层按整文件路径处理 */
async function runMock(options: GenerateOptions): Promise<Omit<GenerateResult, 'usage'>> {
  const { input, style, currentFiles, intent, onChunk, signal } = options;
  const baseDoc = currentFiles ? renderToHTML(currentFiles) : '';
  const doc =
    intent !== 'create' && baseDoc
      ? mockIterate(baseDoc, input, style)
      : matchTemplate(input, style).code;
  const raw = `--index.html--\n${doc}`;

  let accumulated = '';
  for (let i = 0; i < raw.length; i += MOCK_CHUNK) {
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
    accumulated += raw.slice(i, i + MOCK_CHUNK);
    onChunk?.(accumulated);
    await delay(70);
  }

  return { raw, usedMode: 'mock', usedModel: MOCK_MODEL };
}

/* ------------------------------ 思维链内容 ------------------------------ */

export interface ThoughtInput {
  description: string;
  style: StyleTag;
  mode: LlmMode;
  /** 本轮实际生效的模型标识 */
  model?: string;
  templateName: string;
  /** 迭代时的修改意见 */
  iterationNote?: string;
  /** 当前是第几个版本 */
  versionNumber: number;
  /** 本轮被锁定的文件 */
  locked?: Array<keyof CodeFiles>;
  /** 本轮是否走补丁式编辑 */
  patchMode?: boolean;
}

const STYLE_TECH: Record<StyleTag, string> = {
  minimal: '原生 DOM 直接重绘，不引入框架与动画库，把渲染成本压到最低。',
  card: '原生 DOM + CSS 过渡与关键帧动画，用进入动画和悬浮反馈承载状态变化。',
  dashboard: '原生 DOM + CSS 网格布局，指标区与面板区分离，用条形图元素表达占比。',
};

const STYLE_COMPONENT: Record<StyleTag, string> = {
  minimal: '结构：标题 → 输入表单 → 数据列表 → 统计脚注，单列纵向流；空状态用一行浅色说明文字。',
  card: '结构：标题与进度概览 → 输入区 → 卡片列表，每条数据独立成卡；空状态用虚线容器加引导文案。',
  dashboard: '结构：标题与主指标 → KPI 指标卡片行 → 双栏面板（录入 / 明细）；空状态在面板内以浅色提示占位。',
};

const STYLE_DESIGN: Record<StyleTag, string> = {
  minimal: '配色：中性灰阶为主，单一深色作为主按钮；1px 描边替代阴影，圆角 8px，焦点态保留可见轮廓。',
  card: '配色：柔和渐变铺底，主按钮双色渐变；圆角 16px，阴影极浅，进入动画 0.4s ease-out-expo。',
  dashboard: '配色：深色底 + 青蓝强调色；等宽数字对齐，指标条用渐变填充，面板以半透明描边区分层级。',
};

/**
 * 生成五阶段思维链内容。最后一阶段说明质量校验策略，
 * 与运行时真正执行的确定性校验、冒烟测试与视觉体检保持一致。
 */
export function buildThoughtContents(input: ThoughtInput): Record<StageKey, string> {
  const {
    description,
    style,
    mode,
    templateName,
    iterationNote,
    versionNumber,
    locked,
    patchMode,
  } = input;
  const modelName = input.model?.trim();
  const modeLabel =
    mode === 'deepseek'
      ? `DeepSeek 后端代理 · ${deepseekModelLabel(modelName || DEEPSEEK_MODEL)}`
      : mode === 'atoms'
        ? `Atoms 后端代理 · ${atomsModelLabel(modelName || ATOMS_MODEL)}`
        : mode === 'openai'
          ? `OpenAI 兼容端点 · ${modelName || '自定义模型'}`
          : '离线模板库';
  const lockedText = locked?.length
    ? `只读文件：${locked.map((key) => FILE_LABEL[key]).join('、')}（已被锁定，本轮不会改动）。`
    : '';

  const requirement = iterationNote
    ? [
        `本轮为第 ${versionNumber} 版迭代，基线是上一版产物。`,
        `修改意见：${iterationNote}`,
        '判定改动范围：仅调整被点到的部分，其余结构、交互与数据格式保持不变。',
        lockedText,
        `原始需求仍为：${description}`,
      ]
        .filter(Boolean)
        .join('\n')
    : [
        `原始需求：${description}`,
        `识别到的应用类型：${templateName}。`,
        '核心实体与操作：录入、列表展示、状态变更、删除，以及刷新后数据不丢。',
        `目标风格：${STYLE_LABEL[style]}，风格会直接影响布局密度与视觉修饰程度。`,
      ].join('\n');

  return {
    requirement,
    tech: [
      `模型通道：${modeLabel}。`,
      '产物形态：index.html / style.css / app.js 三文件，预览时合成单文件在 iframe 中零依赖运行。',
      patchMode
        ? '本轮编辑方式：补丁式（search/replace 块），只替换命中的片段，改动范围可审计。'
        : '本轮编辑方式：整文件输出，适用于首轮生成或补丁无法定位时的回落。',
      '持久化：localStorage 存储数组结构，读写集中在 save / render 两个函数。',
      `渲染方式：${STYLE_TECH[style]}`,
    ].join('\n'),
    component: [
      STYLE_COMPONENT[style],
      '交互：表单 submit 负责新增，列表项内联完成状态切换与删除。',
      iterationNote
        ? '迭代策略：定位到受影响的节点与样式规则后局部替换，避免整体重写导致行为漂移。'
        : '数据流：单一数组作为唯一数据源，任何变更后统一重绘。',
    ].join('\n'),
    style: [
      STYLE_DESIGN[style],
      '排版：标题加粗收紧字距，正文行高偏松，数字统一等宽对齐。',
      '可访问性：焦点态保留可见轮廓，按钮文字与背景保持足够对比，点击目标不小于 32×26px。',
    ].join('\n'),
    verify: [
      '第一层｜静态校验：JS 语法编译、跨文件引用一致性、交互闭环、localStorage 读写成对、HTML 文档结构，共 5 项。',
      '第二层｜交互冒烟：在沙箱内自动填表、提交并逐个点击可交互元素，观察 DOM 与表单状态是否真的变化，抓出「点了没反应」的死按钮。',
      '第三层｜视觉体检：检测横向溢出、内容被裁切、点击目标过小与文字对比度不足，抓出代码正确但界面错位的问题。',
      '三层结论都是确定性的，不依赖模型自评；任一层失败都会把具体原因回喂模型定向修复，最多重试 2 轮。',
      '预览 iframe 内注入通信桥，运行时报错与 console 输出实时回传，避免只看到白屏。',
    ].join('\n'),
  };
}

/* -------------------------------- 工具 -------------------------------- */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function errorMessage(error: unknown): string {
  const err = error as {
    data?: { detail?: string };
    response?: { data?: { detail?: string } };
    message?: string;
  };
  return err?.data?.detail || err?.response?.data?.detail || err?.message || '生成失败，请稍后重试';
}