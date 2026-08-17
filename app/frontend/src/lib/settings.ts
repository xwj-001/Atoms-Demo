/** LLM 运行模式：deepseek 自备账号代理 / atoms 平台代理 / openai 兼容直连 / mock 离线模板 */
export type LlmMode = 'deepseek' | 'atoms' | 'openai' | 'mock';

/**
 * 质量校验强度。5 项静态校验本身是纯字符串与语法分析，毫秒级就能跑完；
 * 真正拖慢整条链路的是「校验未通过 → 把失败项回喂模型定向修复」这几轮
 * 额外的模型调用。因此这里用轮次预算来直接控制整体耗时。
 */
export type QualityLevel = 'fast' | 'standard' | 'strict';

export interface StudioSettings {
  mode: LlmMode;
  /** 质量校验强度，决定最多允许几轮生成（含自动修复） */
  qualityLevel: QualityLevel;
  /**
   * 模板优先：首轮需求命中预置模板关键词时直接使用预置代码，完全跳过模型调用。
   * 整条链路里最慢的一环永远是模型往返，命中即秒出是最有效的加速开关。
   */
  templateFirst: boolean;
  /** deepseek 模式下使用的模型（必须是 deepseek- 前缀） */
  deepseekModel: string;
  /** atoms 模式下使用的平台模型（必须在 ATOMS_MODELS 白名单内） */
  atomsModel: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  autoFallback: boolean;
}

/* --------------------------- DeepSeek 自备账号 --------------------------- */

export interface ModelMeta {
  id: string;
  label: string;
  /** 擅长场景，用于设置面板里帮用户选型 */
  desc: string;
  /** 简短能力标签 */
  tags: string[];
}

/** DeepSeek 官方端点，密钥在后端环境变量里，仅作展示用 */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * DeepSeek 可选模型。默认模型为 deepseek-v4-flash；
 * 若账号尚未开通该模型，后端会自动改用 deepseek-chat 重试并在响应里标注。
 */
export const DEEPSEEK_MODELS: ModelMeta[] = [
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    desc: '响应快、单价低，适合高频生成与反复迭代，是当前默认模型。',
    tags: ['默认', '快速'],
  },
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    desc: '通用对话模型，长期可用，作为默认模型不可用时的兜底选择。',
    tags: ['通用', '兜底'],
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    desc: '推理增强，复杂逻辑与多文件改写更稳，但耗时与成本更高。',
    tags: ['推理增强'],
  },
];

/** deepseek 模式默认模型 */
export const DEEPSEEK_MODEL = DEEPSEEK_MODELS[0].id;

/** 只允许 deepseek 系列模型走这条通道，与后端校验保持一致 */
export function isDeepSeekModel(id: string | undefined | null): boolean {
  return !!id && id.trim().startsWith('deepseek-');
}

/** 取 DeepSeek 模型展示名，未知模型直接回显原始 id */
export function deepseekModelLabel(id: string | undefined | null): string {
  if (!id) return deepseekModelLabel(DEEPSEEK_MODEL);
  return DEEPSEEK_MODELS.find((m) => m.id === id)?.label ?? id;
}

/* --------------------------- atoms 平台模型清单 --------------------------- */

export type AtomsModelMeta = ModelMeta;

/**
 * 平台可用模型清单，与后端 `MODEL_WHITELIST` 保持一致。
 * 前端只允许从这里选择，越界的模型名会在后端被回落为默认模型。
 */
export const ATOMS_MODELS: AtomsModelMeta[] = [
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    desc: '综合能力均衡，指令遵循与结构化输出稳定，适合大多数生成场景。',
    tags: ['均衡'],
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
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
    hint: '深度求索官方端点；需要推理模型可把模型名改为 deepseek-reasoner。',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hint: '官方端点，Key 以 sk- 开头。',
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
  mode: 'deepseek',
  qualityLevel: 'fast',
  templateFirst: true,
  deepseekModel: DEEPSEEK_MODEL,
  atomsModel: ATOMS_MODEL,
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-flash',
  autoFallback: true,
};

export const MODE_META: Record<LlmMode, { label: string; desc: string }> = {
  deepseek: {
    label: 'DeepSeek 代理',
    desc: '使用你自己的 DeepSeek 账号，密钥保存在服务端环境变量中，浏览器不接触密钥。',
  },
  atoms: {
    label: 'Atoms 代理',
    desc: '经由平台后端调用平台模型，同样不在前端持有密钥。可在下方挑选具体模型。',
  },
  openai: {
    label: 'OpenAI 兼容',
    desc: '浏览器直连任意 OpenAI 兼容端点，需自备 Key。密钥仅存本机浏览器。',
  },
  mock: {
    label: '离线模板',
    desc: '不调用任何模型，直接返回预置模板，适合断网演示。',
  },
};

/* ------------------------------ 质量校验强度 ------------------------------ */

export const QUALITY_LEVELS: QualityLevel[] = ['fast', 'standard', 'strict'];

export const QUALITY_META: Record<
  QualityLevel,
  { label: string; desc: string; maxAttempts: number; badge?: string }
> = {
  fast: {
    label: '快速',
    desc: '只生成一轮并校验一次，未通过时不自动重修，可在校验面板手动点「让 AI 再修一轮」。演示与笔试场景推荐。',
    maxAttempts: 1,
    badge: '默认',
  },
  standard: {
    label: '标准',
    desc: '未通过时自动定向修复 1 轮，速度与成品率兼顾。',
    maxAttempts: 2,
  },
  strict: {
    label: '严格',
    desc: '未通过时最多自动修复 2 轮，成品率最高但等待最久。',
    maxAttempts: 3,
  },
};

/** 该强度下允许的最大生成轮次（含首轮） */
export function maxAttemptsOf(level: QualityLevel | undefined): number {
  return QUALITY_META[level ?? 'fast']?.maxAttempts ?? 1;
}

/** 旧设置里没有该字段，或值非法时统一回落到最快档 */
function normalizeQualityLevel(value: unknown): QualityLevel {
  return value === 'standard' || value === 'strict' ? value : 'fast';
}

/** 当前保留的静态校验项，仅用于界面文案展示 */
export const BASIC_CHECK_ITEMS = ['JS 语法', '引用完整性', 'HTML 结构'] as const;

const STORAGE_KEY = 'atoms-studio-settings';

export function loadSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;

    // 旧版本设置里没有 deepseekModel 字段，说明是接入 DeepSeek 之前保存的，
    // 统一迁移到新的默认通道，避免老用户仍停留在旧默认模型上。
    const legacy = typeof parsed.deepseekModel !== 'string';

    const storedMode = parsed.mode;
    const validMode =
      storedMode === 'deepseek' ||
      storedMode === 'openai' ||
      storedMode === 'mock' ||
      storedMode === 'atoms';
    const mode: LlmMode = legacy || !validMode ? DEFAULT_SETTINGS.mode : (storedMode as LlmMode);

    return {
      mode,
      qualityLevel: normalizeQualityLevel(parsed.qualityLevel),
      // 旧设置没有该字段时默认开启：命中预置模板即秒出，是最省时间的一档
      templateFirst: parsed.templateFirst !== false,
      deepseekModel: isDeepSeekModel(parsed.deepseekModel)
        ? (parsed.deepseekModel as string).trim()
        : DEEPSEEK_MODEL,
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