/**
 * 规划阶段（产品经理执行体）。
 *
 * 策略：优先用 findBestTemplate 做模板蓝图匹配（关键词长度加权评分），
 * 命中则直接复用预置蓝图；未命中才调用 LLM 生成蓝图 JSON。
 * LLM 失败时降级到兜底模板，保证流水线不中断。
 */

import { extractJsonObject } from '../parser';
import { complete, type LLMSettings } from '../llm/adapter';
import {
  fallbackTemplate,
  findBestTemplate,
  type Blueprint,
  type TemplateBlueprint,
} from '../llm/mockTemplates';
import { buildPlannerMessages } from './agents';

export interface PlanResult {
  blueprint: Blueprint;
  /** 蓝图来源 */
  source: 'template' | 'llm' | 'fallback';
  /** 命中的模板（source 为 template 时有值），可作为生成阶段的降级代码 */
  template: TemplateBlueprint | null;
  /** 需求过于模糊，需要用户补充 */
  ambiguous: boolean;
  /** 需要补充的信息 */
  missingInfo: string[];
  /** 规划说明，用于日志 */
  note: string;
  /** 是否发生了 LLM 降级 */
  degraded: boolean;
}

function normalizeStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
}

/** 把 LLM 返回的任意 JSON 收敛成合法 Blueprint。 */
function coerceBlueprint(raw: unknown, requirement: string): Blueprint | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const appName =
    typeof data.appName === 'string' && data.appName.trim()
      ? data.appName.trim()
      : requirement.slice(0, 18) || '生成应用';
  const summary =
    typeof data.summary === 'string' && data.summary.trim()
      ? data.summary.trim()
      : requirement.trim();

  const features = normalizeStringArray(data.features);
  const flows = normalizeStringArray(data.flows);

  const entitiesRaw = Array.isArray(data.entities) ? data.entities : [];
  const entities = entitiesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entity = item as Record<string, unknown>;
      const name = typeof entity.name === 'string' ? entity.name.trim() : '';
      const fields = normalizeStringArray(entity.fields, 12);
      if (!name) return null;
      return { name, fields: fields.length ? fields : ['id', 'title', 'createdAt'] };
    })
    .filter((item): item is { name: string; fields: string[] } => item !== null);

  if (features.length === 0) return null;

  return {
    appName,
    summary,
    entities: entities.length ? entities : [{ name: 'Item', fields: ['id', 'title', 'createdAt'] }],
    features,
    flows: flows.length ? flows : ['用户填写表单并提交，列表与统计即时更新'],
    persistence:
      typeof data.persistence === 'string' && data.persistence.trim()
        ? data.persistence.trim()
        : 'localStorage 持久化，刷新后数据保留',
    style:
      typeof data.style === 'string' && data.style.trim()
        ? data.style.trim()
        : '现代暗色风格，紫色强调色，卡片式布局',
  };
}

export interface PlanOptions {
  requirement: string;
  settings: LLMSettings;
  onThinking?: (text: string) => void;
}

/** 执行规划阶段。 */
export async function runPlanner(options: PlanOptions): Promise<PlanResult> {
  const { requirement, settings, onThinking } = options;
  const trimmed = requirement.trim();

  // --- 需求模糊的确定性前置判断（过短或全为泛化词） ---
  const vaguePattern = /^(做个?网页|做个?网站|随便(做|写)点?(东西)?|帮我写代码|做个应用|做个程序)[。！！.\s]*$/;
  if (trimmed.length < 6 || vaguePattern.test(trimmed)) {
    return {
      blueprint: fallbackTemplate().blueprint,
      source: 'fallback',
      template: fallbackTemplate(),
      ambiguous: true,
      missingInfo: [
        '你希望做哪一类应用？（如记账本、待办清单、商品展示页）',
        '这个应用要管理什么数据？包含哪些字段？',
        '你最关心的核心操作是什么？（如新增、删除、统计、筛选）',
      ],
      note: `需求「${trimmed}」过于模糊，无法确定应用类型与核心数据。`,
      degraded: false,
    };
  }

  // --- 第一优先：模板蓝图匹配 ---
  const matched = findBestTemplate(trimmed);
  if (matched) {
    onThinking?.(
      `命中预置模板蓝图「${matched.template.blueprint.appName}」，匹配关键词：${matched.hits.join(
        '、',
      )}，加权得分 ${matched.score}。直接复用该蓝图，跳过 LLM 规划以提升稳定性与速度。`,
    );
    return {
      blueprint: matched.template.blueprint,
      source: 'template',
      template: matched.template,
      ambiguous: false,
      missingInfo: [],
      note: `模板匹配成功：${matched.template.id}（关键词 ${matched.hits.join('、')}，得分 ${matched.score}）`,
      degraded: false,
    };
  }

  // --- 第二优先：调用 LLM 生成蓝图 ---
  onThinking?.('未命中预置模板，转为调用大模型解析需求并生成结构化应用蓝图。');
  try {
    const result = await complete(buildPlannerMessages(trimmed), settings, {
      onDelta: (_delta, accumulated) => {
        // 仅做思考过程展示，不在流式过程中解析
        onThinking?.(accumulated.slice(-600));
      },
    });

    const parsed = extractJsonObject(result.content);
    if (parsed && typeof parsed === 'object') {
      const data = parsed as Record<string, unknown>;
      if (data.ambiguous === true) {
        return {
          blueprint: fallbackTemplate().blueprint,
          source: 'llm',
          template: fallbackTemplate(),
          ambiguous: true,
          missingInfo: normalizeStringArray(data.missingInfo, 5).length
            ? normalizeStringArray(data.missingInfo, 5)
            : ['请补充应用类型、要管理的数据以及核心操作。'],
          note: '产品经理判定需求过于模糊，需要用户补充关键信息。',
          degraded: result.degraded,
        };
      }

      const blueprint = coerceBlueprint(parsed, trimmed);
      if (blueprint) {
        return {
          blueprint,
          source: 'llm',
          template: null,
          ambiguous: false,
          missingInfo: [],
          note: `大模型生成蓝图成功：${blueprint.appName}，含 ${blueprint.features.length} 个功能点。`,
          degraded: result.degraded,
        };
      }
    }

    throw new Error('蓝图 JSON 解析失败或字段不完整');
  } catch (error) {
    // --- 兜底：使用通用模板蓝图 ---
    const reason = error instanceof Error ? error.message : String(error);
    const template = fallbackTemplate();
    onThinking?.(`大模型规划失败（${reason}），降级使用通用模板蓝图继续流水线。`);
    return {
      blueprint: { ...template.blueprint, summary: trimmed },
      source: 'fallback',
      template,
      ambiguous: false,
      missingInfo: [],
      note: `大模型规划失败（${reason}），已降级为通用模板蓝图。`,
      degraded: true,
    };
  }
}

/** 把蓝图格式化成可读文本，用于日志与项目存档。 */
export function formatBlueprint(blueprint: Blueprint): string {
  return [
    `应用名称：${blueprint.appName}`,
    `概述：${blueprint.summary}`,
    '',
    '数据实体：',
    ...blueprint.entities.map((entity) => `  · ${entity.name}（${entity.fields.join('、')}）`),
    '',
    '功能点：',
    ...blueprint.features.map((item, index) => `  ${index + 1}. ${item}`),
    '',
    '交互流程：',
    ...blueprint.flows.map((item, index) => `  ${index + 1}. ${item}`),
    '',
    `持久化：${blueprint.persistence}`,
    `视觉风格：${blueprint.style}`,
  ].join('\n');
}