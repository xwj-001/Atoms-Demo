/**
 * LLM 适配器：统一三种运行模式。
 *
 *  - atoms  ：走后端 Edge Function 代理（默认，模型 claude-opus-5），Key 不出服务端
 *  - openai ：OpenAI 兼容端点，SSE 流式
 *  - mock   ：预置模板流式输出，作为 LLM 不可用时的降级方案
 *
 * 重要约定：`complete()` 一定返回**完整文本**。
 * onDelta 仅用于 UI 打字机效果，调用方不得在回调里做代码解析。
 */

// 默认后端代理 API 基础路径
const DEFAULT_API_BASE = '/api/v1';

export type LLMMode = 'atoms' | 'openai' | 'mock';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMSettings {
  mode: LLMMode;
  model: string;
  /** openai 模式：兼容端点 base url */
  baseUrl: string;
  /** openai 模式：浏览器侧 API Key（仅该模式使用） */
  apiKey: string;
  /** atoms 模式：后端代理 API 基础地址 */
  apiBaseUrl: string;
}

export const DEFAULT_MODEL = 'claude-opus-5';

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  mode: 'openai',
  model: 'GLM-5.2',
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '',
  apiBaseUrl: '/api/v1',
};

export interface CompleteOptions {
  /** UI 打字机回调，收到增量文本 */
  onDelta?: (delta: string, accumulated: string) => void;
  /** 中断信号 */
  signal?: AbortSignal;
  /** mock 模式下用于挑选降级内容 */
  mockText?: string;
}

export interface CompleteResult {
  content: string;
  /** 实际生效的模式（可能因失败而降级） */
  mode: LLMMode;
  /** 是否发生了降级 */
  degraded: boolean;
  /** 降级原因 */
  reason?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 把一段完整文本按小块「流」给 UI，制造打字机效果。 */
async function streamOut(
  text: string,
  onDelta?: (delta: string, accumulated: string) => void,
  chunkSize = 24,
  delayMs = 12,
): Promise<string> {
  if (!onDelta) return text;
  let accumulated = '';
  for (let i = 0; i < text.length; i += chunkSize) {
    const delta = text.slice(i, i + chunkSize);
    accumulated += delta;
    onDelta(delta, accumulated);
    // 让出主线程，避免阻塞渲染
    if (i % (chunkSize * 8) === 0) await sleep(delayMs);
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* atoms 模式：后端代理                                                */
/* ------------------------------------------------------------------ */

async function completeViaAtoms(
  messages: ChatMessage[],
  settings: LLMSettings,
  options: CompleteOptions,
): Promise<string> {
  const apiBase = settings.apiBaseUrl?.trim() || DEFAULT_API_BASE;
  const response = await fetch(`${apiBase}/llm/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map((item) => ({ role: item.role, content: item.content })),
      model: settings.model || DEFAULT_MODEL,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`后端代理返回 ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = String(data?.content ?? '').trim();
  if (!content) throw new Error('后端代理返回内容为空');
  await streamOut(content, options.onDelta);
  return content;
}

/* ------------------------------------------------------------------ */
/* openai 模式：兼容端点 SSE                                           */
/* ------------------------------------------------------------------ */

async function completeViaOpenAI(
  messages: ChatMessage[],
  settings: LLMSettings,
  options: CompleteOptions,
): Promise<string> {
  if (!settings.apiKey.trim()) throw new Error('未配置 API Key');
  const base = settings.baseUrl.trim().replace(/\/+$/, '');

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_MODEL,
      messages,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`兼容端点返回 ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  // 注意：这里只累积文本，绝不在流式过程中解析代码
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
        const parsed = JSON.parse(payload);
        const delta: string = parsed?.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          accumulated += delta;
          options.onDelta?.(delta, accumulated);
        }
      } catch {
        // 单条 chunk 解析失败可忽略，后续 chunk 继续累积
      }
    }
  }

  const content = accumulated.trim();
  if (!content) throw new Error('兼容端点未返回内容');
  return content;
}

/* ------------------------------------------------------------------ */
/* mock 模式：预置文本流式输出                                          */
/* ------------------------------------------------------------------ */

async function completeViaMock(options: CompleteOptions): Promise<string> {
  const text = options.mockText?.trim();
  if (!text) throw new Error('mock 模式缺少预置内容');
  await streamOut(text, options.onDelta, 32, 10);
  return text;
}

/* ------------------------------------------------------------------ */
/* 主入口                                                             */
/* ------------------------------------------------------------------ */

/**
 * 执行一次补全。
 *
 * 失败策略：atoms / openai 失败后，若调用方提供了 mockText，
 * 自动降级到 mock，保证流水线仍能产出可运行结果。
 */
export async function complete(
  messages: ChatMessage[],
  settings: LLMSettings,
  options: CompleteOptions = {},
): Promise<CompleteResult> {
  const mode = settings.mode;

  if (mode === 'mock') {
    const content = await completeViaMock(options);
    return { content, mode: 'mock', degraded: false };
  }

  try {
    const content =
      mode === 'openai'
        ? await completeViaOpenAI(messages, settings, options)
        : await completeViaAtoms(messages, settings, options);
    return { content, mode, degraded: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (options.mockText?.trim()) {
      const content = await completeViaMock(options);
      return { content, mode: 'mock', degraded: true, reason };
    }
    throw new Error(`LLM 调用失败：${reason}`);
  }
}

/** 探测后端代理是否可用。 */
export async function probeAtomsProxy(apiBaseUrl?: string): Promise<boolean> {
  try {
    const apiBase = apiBaseUrl?.trim() || DEFAULT_API_BASE;
    const response = await fetch(`${apiBase}/llm/health`, {
      method: 'GET',
    });
    if (!response.ok) return false;
    const data = await response.json();
    return String(data?.status ?? '') === 'ok';
  } catch {
    return false;
  }
}