/**
 * 生成阶段（全栈开发工程师执行体）。
 *
 * 严格遵守：先收集完整 LLM 输出，再交给 parser 做三层降级解析。
 * 流式回调只用于 UI 展示代码「正在写入」的效果。
 */

import { ensureFiles, hasRunnableFiles, parseGeneratedFiles } from '../parser';
import { complete, type LLMSettings } from '../llm/adapter';
import type { AppFiles } from '../db';
import type { Blueprint, TemplateBlueprint } from '../llm/mockTemplates';
import { buildFixMessages, buildGeneratorMessages } from './agents';
import type { ValidationReport } from './validator';

export interface GenerateResult {
  files: AppFiles;
  /** 命中的解析层级 */
  strategy: 'separator' | 'markdown' | 'wholeHtml' | 'none';
  /** 代码前的自然语言说明 */
  prose: string;
  /** 是否使用了降级方案 */
  degraded: boolean;
  note: string;
}

/** 把预置模板代码转成符合输出规范的文本，作为 mock 降级内容。 */
function templateToMockOutput(template: TemplateBlueprint): string {
  return `已根据蓝图生成「${template.blueprint.appName}」，包含完整的增删、筛选与本地持久化能力。

--index.html--
${template.files['index.html']}
--style.css--
${template.files['style.css']}
--app.js--
${template.files['app.js']}`;
}

export interface GenerateOptions {
  requirement: string;
  blueprint: Blueprint;
  settings: LLMSettings;
  /** 降级模板（规划阶段命中的模板或兜底模板） */
  template: TemplateBlueprint | null;
  onThinking?: (text: string) => void;
  onCode?: (accumulated: string) => void;
}

/** 首轮生成三件套代码。 */
export async function runGenerator(options: GenerateOptions): Promise<GenerateResult> {
  const { requirement, blueprint, settings, template, onThinking, onCode } = options;

  onThinking?.(
    `开始依据蓝图「${blueprint.appName}」编写代码：先搭 index.html 结构与元素 id，再写 style.css 暗色样式，最后实现 app.js 的数据层、渲染函数与 localStorage 持久化。`,
  );

  // 模板优先：命中模板则直接使用预置代码，跳过 LLM 生成
  if (template) {
    const mockOutput = templateToMockOutput(template);
    // 模拟代码流式输出效果
    await simulateCodeStream(mockOutput, onCode);

    const parsed = parseGeneratedFiles(mockOutput);
    const files = ensureFiles(parsed.files);

    return {
      files,
      strategy: 'separator',
      prose: `已根据蓝图生成「${template.blueprint.appName}」，包含完整的增删、筛选与本地持久化能力。`,
      degraded: false,
      note: `使用预置模板「${template.blueprint.appName}」（模板优先模式）`,
    };
  }

  // 未命中模板，调用 LLM 生成
  const result = await complete(buildGeneratorMessages(requirement, blueprint), settings, {
    onDelta: (_delta, accumulated) => onCode?.(accumulated),
  });

  // 完整输出收集完毕后才解析
  const parsed = parseGeneratedFiles(result.content);
  let files = ensureFiles(parsed.files);
  let degraded = result.degraded;
  let note = `解析策略：${parsed.strategy}${result.degraded ? `（LLM 降级：${result.reason ?? '未知原因'}）` : ''}`;

  if (!hasRunnableFiles(files)) {
    throw new Error('LLM 输出无法解析为可运行的三件套代码，且无可用降级模板');
  }

  return { files, strategy: parsed.strategy, prose: parsed.prose, degraded, note };
}

/** 模拟代码流式输出效果 */
async function simulateCodeStream(
  fullText: string,
  onCode?: (accumulated: string) => void,
): Promise<void> {
  if (!onCode) return;

  const chunkSize = Math.max(20, Math.floor(fullText.length / 30));
  let accumulated = '';

  for (let i = 0; i < fullText.length; i += chunkSize) {
    accumulated = fullText.slice(0, i + chunkSize);
    onCode(accumulated);
    // 小延迟模拟打字机效果
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  onCode(fullText);
}

export interface FixOptions extends GenerateOptions {
  files: AppFiles;
  report: ValidationReport;
  round: number;
}

/** 按缺陷清单迭代修复代码。 */
export async function runFixer(options: FixOptions): Promise<GenerateResult> {
  const { requirement, blueprint, settings, template, files, report, round, onThinking, onCode } =
    options;

  onThinking?.(
    `第 ${round} 轮修复：收到 ${report.defects.length} 条缺陷，逐条定位。原则是保留已有结构与功能，只做最小化必要修改，并输出三个文件的完整内容。`,
  );

  const mockText = template ? templateToMockOutput(template) : undefined;
  const result = await complete(
    buildFixMessages(requirement, blueprint, files, report),
    settings,
    {
      onDelta: (_delta, accumulated) => onCode?.(accumulated),
      mockText,
    },
  );

  const parsed = parseGeneratedFiles(result.content);
  const merged = ensureFiles({ ...files, ...parsed.files });

  if (!hasRunnableFiles(merged)) {
    if (template) {
      return {
        files: ensureFiles(template.files),
        strategy: parsed.strategy,
        prose: parsed.prose,
        degraded: true,
        note: '修复输出无法解析，已降级使用预置模板代码。',
      };
    }
    throw new Error('修复输出无法解析为可运行代码');
  }

  return {
    files: merged,
    strategy: parsed.strategy,
    prose: parsed.prose,
    degraded: result.degraded,
    note: `第 ${round} 轮修复完成（解析策略：${parsed.strategy}）`,
  };
}