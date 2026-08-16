/** LLM 运行模式：atoms 后端代理 / openai 兼容端点 / mock 离线模板 */
export type LlmMode = 'atoms' | 'openai' | 'mock';

export interface StudioSettings {
  mode: LlmMode;
  /** atoms 模式下使用的平台模型（必须在 ATOMS_MODELS 白名单内） */
  atomsModel: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  autoFallback: boolean;
}

/* --------------------------- atoms 平台模型清单 --------------------------- */

export interface AtomsModelMeta {
  id: string;
  label: string;
  /** 擅长场景，用于设置面板里帮用户选型 */
  desc: string;
  /** 简短能力标签 */
  tags: string[];
}

/**
 * 平台可用模型清单，与后端 `MODEL_WHITELIST` 保持一致。
 * 前端只允许从这里选择，越界的模型名会在后端被回落为默认模型。
 */
export const ATOMS_MODELS: AtomsModelMeta[] = [
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    desc: '综合能力均衡，指令遵循与结构化输出稳定，适合大多数生成场景。',
    tags: ['均衡', '默认'],
  },
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    desc: '代码能力最强，长逻辑与多文件改写不易出错，复杂应用与补丁式迭代优先选它。',
    tags: ['代码专家', '高质量'],
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    desc: '纯文本模型，性价比高、速度快，适合频繁迭代与批量生成。',
    tags: ['性价比', '纯文本'],
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    desc: '生产级通用模型，输出稳定，风格还原度好。',
    tags: ['稳定', '通用'],
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    desc: '超长上下文，适合代码体量大、需要整体把握全文的整文件重写。',
    tags: ['长上下文'],
  },
];

/** atoms 模式默认模型 */
export const ATOMS_MODEL = ATOMS_MODELS[0].id;

const ATOMS_MODEL_IDS = new Set(ATOMS_MODELS.map((m) => m.id));

/** 判断模型是否在平台白名单内 */
export function isAtomsModel(id: string | undefined | null): boolean {
  return !!id && ATOMS_MODEL_IDS.has(id);
}

/** 取模型展示名，未知模型直接回显原始 id，避免界面出现空白 */
export function atomsModelLabel(id: string | undefined | null): string {
  if (!id) return atomsModelLabel(ATOMS_MODEL);
  return ATOMS_MODELS.find((m) => m.id === id)?.label ?? id;
}

/* ------------------------- OpenAI 兼容端点预设 ------------------------- */

export interface OpenAiPreset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  hint: string;
}

/**
 * 常见 OpenAI 兼容端点预设。DeepSeek、Kimi、通义、SiliconFlow、OpenRouter
 * 都提供 `/chat/completions` 兼容接口，选中后只需填自己的 Key。
 */
export const OPENAI_PRESETS: OpenAiPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hint: '官方端点，Key 以 sk- 开头。',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    hint: '深度求索官方端点；需要推理模型可把模型名改为 deepseek-reasoner。',
  },
  {
    id: 'moonshot',
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-32k',
    hint: '月之暗面官方端点，长上下文可选 moonshot-v1-128k。',
  },
  {
    id: 'dashscope',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    hint: '阿里云 DashScope 的 OpenAI 兼容模式，Key 为 sk- 开头的 DashScope Key。',
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    hint: '硅基流动聚合端点，模型名带组织前缀。',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat',
    hint: '聚合多家模型，模型名格式为 vendor/model。',
  },
  {
    id: 'ollama',
    label: '本地 Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder',
    hint: '本地服务；API Key 可随意填写（例如 ollama），需先启动本地模型。',
  },
];

/** 按 baseUrl 反查当前命中的预设，用于设置面板高亮 */
export function matchOpenAiPreset(baseUrl: string): OpenAiPreset | undefined {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  return OPENAI_PRESETS.find((p) => p.baseUrl.replace(/\/+$/, '') === normalized);
}

/* ------------------------------ 模式元信息 ------------------------------ */

export const DEFAULT_SETTINGS: StudioSettings = {
  mode: 'atoms',
  atomsModel: ATOMS_MODEL,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  autoFallback: true,
};

export const MODE_META: Record<LlmMode, { label: string; desc: string }> = {
  atoms: {
    label: 'Atoms 代理',
    desc: '经由平台后端调用模型，API Key 不出现在前端。可在下方挑选具体模型。',
  },
  openai: {
    label: 'OpenAI 兼容',
    desc: '直连任意 OpenAI 兼容端点（DeepSeek / Kimi / 通义 / OpenRouter 等），需自备 Key。密钥仅存本机浏览器。',
  },
  mock: {
    label: '离线模板',
    desc: '不调用任何模型，直接返回预置模板，适合断网演示。',
  },
};

const STORAGE_KEY = 'atoms-studio-settings';

export function loadSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    const mode: LlmMode =
      parsed.mode === 'openai' || parsed.mode === 'mock' || parsed.mode === 'atoms'
        ? parsed.mode
        : DEFAULT_SETTINGS.mode;
    return {
      mode,
      // 旧数据没有该字段，或模型已下线时统一回落默认模型
      atomsModel: isAtomsModel(parsed.atomsModel) ? (parsed.atomsModel as string) : ATOMS_MODEL,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      baseUrl:
        typeof parsed.baseUrl === 'string' && parsed.baseUrl ? parsed.baseUrl : DEFAULT_SETTINGS.baseUrl,
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULT_SETTINGS.model,
      autoFallback: parsed.autoFallback !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: StudioSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}