import {
  applyLocks,
  emptyLocks,
  FILE_LABEL,
  splitDocument,
  type CodeFiles,
  type FileLocks,
} from './codeFiles';
import {
  FILE_BUDGET,
  generateApp,
  TOTAL_BUDGET,
  type ContextUsage,
  type GenerateIntent,
} from './llm';
import { parseGeneratedCode, type ParseStrategy } from './parser';
import {
  applyPatchBlocks,
  describePatchFailures,
  hasPatchMarkers,
  parsePatchBlocks,
} from './patch';
import { maxAttemptsOf, type LlmMode, type StudioSettings } from './settings';
import { findPresetTemplate } from './templates';
import { validateFiles, type ValidationReport } from './validator';
import type { StyleTag } from './db';

/** 模板秒出路径没有经过任何模型，用固定标识占位 */
export const TEMPLATE_MODEL = 'preset-template';

/** 严格档的硬上限：首轮 + 最多 2 轮定向修复 */
export const MAX_ATTEMPTS = 3;

/** 本轮产物的产生方式 */
export type ProduceMode = 'full' | 'patch';

export interface AttemptRecord {
  attempt: number;
  passed: boolean;
  /** 本轮未通过的检查项名称 */
  failed: string[];
  /** 本轮完整失败说明，用于下一轮修复提示 */
  issues: string[];
  /** 本轮是补丁编辑还是整文件重写 */
  mode: ProduceMode;
  /** 补丁模式下成功套用的补丁数 */
  patchApplied?: number;
  /** 补丁模式下未能套用的补丁数 */
  patchFailed?: number;
  /** 补丁全部失败，已回落整文件重写 */
  fellBack?: boolean;
}

export interface PipelineOptions {
  input: string;
  style: StyleTag;
  settings: StudioSettings;
  intent: GenerateIntent;
  currentFiles?: CodeFiles;
  /** 修复意图的问题清单：可来自静态校验、交互冒烟或视觉体检 */
  issues?: string[];
  /** 被锁定的文件，模型改动会被丢弃 */
  locks?: FileLocks;
  /** 是否允许补丁式编辑（首轮生成不适用） */
  allowPatch?: boolean;
  signal?: AbortSignal;
  onChunk?: (accumulated: string) => void;
  /** 每轮校验结束后回调，用于 UI 展示重试过程 */
  onAttempt?: (record: AttemptRecord) => void;
}

export interface PipelineResult {
  files: CodeFiles;
  strategy: ParseStrategy;
  usedMode: LlmMode;
  /** 本轮实际生效的模型标识 */
  usedModel: string;
  fallbackReason?: string;
  report: ValidationReport;
  /** 实际执行轮次 */
  attempts: number;
  history: AttemptRecord[];
  /** 最终产物的产生方式 */
  mode: ProduceMode;
  /** 补丁模式下实际被改动的文件 */
  patched: Array<keyof CodeFiles>;
  /** 因锁定而被丢弃改动的文件 */
  blockedByLock: Array<keyof CodeFiles>;
  /** 最后一轮的上下文占用明细 */
  usage: ContextUsage;
  /** 补丁未能套用的说明，用于面板提示 */
  patchNotes: string[];
  /** 命中预置模板并直接秒出时的模板名，未命中则为空 */
  templateName?: string;
}

interface RoundOutcome {
  files: CodeFiles;
  strategy: ParseStrategy;
  usedMode: LlmMode;
  usedModel: string;
  fallbackReason?: string;
  usage: ContextUsage;
  mode: ProduceMode;
  patched: Array<keyof CodeFiles>;
  blockedByLock: Array<keyof CodeFiles>;
  patchApplied: number;
  patchFailed: number;
  fellBack: boolean;
  patchNotes: string[];
}

/** 找出模型试图改动但因锁定被拦下的文件 */
function detectBlocked(
  base: CodeFiles,
  produced: CodeFiles,
  locks: FileLocks,
): Array<keyof CodeFiles> {
  return (['html', 'css', 'js'] as Array<keyof CodeFiles>).filter(
    (key) => locks[key] && produced[key] !== base[key],
  );
}

/**
 * 执行一轮生成。补丁模式下若补丁全部无法定位，
 * 立即以整文件模式重跑一次，保证链路不会因为定位失败而卡死。
 */
async function runRound(
  options: PipelineOptions,
  intent: GenerateIntent,
  baseFiles: CodeFiles | undefined,
  issues: string[] | undefined,
  wantPatch: boolean,
): Promise<RoundOutcome> {
  const locks = options.locks ?? emptyLocks();
  const canPatch = wantPatch && !!baseFiles && intent !== 'create';

  const result = await generateApp({
    input: options.input,
    style: options.style,
    settings: options.settings,
    intent,
    currentFiles: baseFiles,
    issues,
    locks,
    patchMode: canPatch,
    signal: options.signal,
    onChunk: options.onChunk,
  });

  // 补丁路径：只有模型确实输出了补丁标记才尝试套用
  if (canPatch && baseFiles && hasPatchMarkers(result.raw)) {
    const blocks = parsePatchBlocks(result.raw, baseFiles);
    const applied = applyPatchBlocks(baseFiles, blocks);
    const notes = describePatchFailures(applied.failed);

    if (applied.applied.length > 0) {
      const guarded = applyLocks(baseFiles, applied.files, locks);
      return {
        files: guarded,
        strategy: 'delimiter',
        usedMode: result.usedMode,
        usedModel: result.usedModel,
        fallbackReason: result.fallbackReason,
        usage: result.usage,
        mode: 'patch',
        patched: applied.touched.filter((key) => !locks[key]),
        blockedByLock: detectBlocked(baseFiles, applied.files, locks),
        patchApplied: applied.applied.length,
        patchFailed: applied.failed.length,
        fellBack: false,
        patchNotes: notes,
      };
    }

    // 一个补丁都没套上：回落整文件重写，并把失败原因带过去
    const fallback = await runRound(
      options,
      intent,
      baseFiles,
      [...(issues ?? []), ...notes],
      false,
    );
    return { ...fallback, fellBack: true, patchFailed: applied.failed.length, patchNotes: notes };
  }

  const parsed = parseGeneratedCode(result.raw);
  const guarded = baseFiles ? applyLocks(baseFiles, parsed.files, locks) : parsed.files;
  return {
    files: guarded,
    strategy: parsed.strategy,
    usedMode: result.usedMode,
    usedModel: result.usedModel,
    fallbackReason: result.fallbackReason,
    usage: result.usage,
    mode: 'full',
    patched: [],
    blockedByLock: baseFiles ? detectBlocked(baseFiles, parsed.files, locks) : [],
    patchApplied: 0,
    patchFailed: 0,
    fellBack: false,
    patchNotes: [],
  };
}

/**
 * 生成质量保障闭环：生成 → 解析（或打补丁）→ 确定性校验 → 未通过则带着失败原因定向重试。
 * mock 模式产物为固定模板，无需重试；真实模型最多重试 2 轮，仍不通过则返回
 * 最佳轮次结果并保留校验报告，让问题可见而不是静默交付。
 */
export async function generateValidated(options: PipelineOptions): Promise<PipelineResult> {
  const { intent, currentFiles, issues, allowPatch, onAttempt } = options;

  // 模板优先：首轮需求命中预置模板时直接交付预置代码，一次模型调用都不发。
  // 静态校验与沙箱体检本身只有毫秒级开销，真正的等待全部来自模型往返，
  // 因此「命中即秒出」比继续压缩校验逻辑有效得多。
  if (intent === 'create' && options.settings.templateFirst !== false) {
    const hit = findPresetTemplate(options.input);
    if (hit) {
      const code = hit.code[options.style];
      const files = splitDocument(code);
      const report = validateFiles(files);
      const record: AttemptRecord = {
        attempt: 1,
        passed: report.passed,
        failed: report.checks.filter((c) => !c.passed).map((c) => c.label),
        issues: report.issues,
        mode: 'full',
      };
      onAttempt?.(record);
      // 让流式面板立刻拿到完整产物，避免界面停在「正在建立连接」
      options.onChunk?.(`--index.html--\n${code}`);
      return {
        files,
        strategy: 'delimiter',
        usedMode: 'mock',
        usedModel: TEMPLATE_MODEL,
        report,
        attempts: 1,
        history: [record],
        mode: 'full',
        patched: [],
        blockedByLock: [],
        usage: templateUsage(files),
        patchNotes: [],
        templateName: hit.label,
      };
    }
  }

  let best: PipelineResult | null = null;
  const history: AttemptRecord[] = [];
  let baseline = currentFiles;
  let pendingIssues = issues;
  let currentIntent = intent;

  // 轮次预算由设置里的「质量校验强度」决定。校验本身只占几毫秒，
  // 省下的正是最慢的那几次模型调用，因此快速档只跑一轮、不做自动重修，
  // 失败项仍然完整展示，用户可以手动再触发一轮定向修复。
  const budget = Math.min(
    MAX_ATTEMPTS,
    Math.max(1, maxAttemptsOf(options.settings.qualityLevel)),
  );

  for (let attempt = 1; attempt <= budget; attempt += 1) {
    const round = await runRound(
      options,
      currentIntent,
      baseline,
      pendingIssues,
      !!allowPatch && !!baseline,
    );

    const report = validateFiles(round.files);
    const record: AttemptRecord = {
      attempt,
      passed: report.passed,
      failed: report.checks.filter((c) => !c.passed).map((c) => c.label),
      issues: report.issues,
      mode: round.mode,
      patchApplied: round.patchApplied,
      patchFailed: round.patchFailed,
      fellBack: round.fellBack,
    };
    history.push(record);
    onAttempt?.(record);

    const current: PipelineResult = {
      files: round.files,
      strategy: round.strategy,
      usedMode: round.usedMode,
      usedModel: round.usedModel,
      fallbackReason: round.fallbackReason,
      report,
      attempts: attempt,
      history: [...history],
      mode: round.mode,
      patched: round.patched,
      blockedByLock: round.blockedByLock,
      usage: round.usage,
      patchNotes: round.patchNotes,
    };

    // 通过项更多者胜出，保证兜底结果不会比首轮更差
    const passedCount = report.checks.filter((c) => c.passed).length;
    const bestPassed = best ? best.report.checks.filter((c) => c.passed).length : -1;
    if (!best || passedCount > bestPassed) best = current;

    if (report.passed) return current;
    // 离线模板是确定性产物，重试不会改变结果
    if (round.usedMode === 'mock') break;

    // 下一轮基于本轮产物做定向修复
    baseline = round.files;
    pendingIssues = report.issues;
    currentIntent = 'repair';
  }

  const fallback = best as PipelineResult;
  return { ...fallback, attempts: history.length, history: [...history] };
}

/** 模板秒出路径未消耗任何上下文，用零占用的用量对象占位，保持面板结构一致 */
function templateUsage(files: CodeFiles): ContextUsage {
  const keys: Array<keyof CodeFiles> = ['html', 'css', 'js'];
  return {
    files: keys.map((file) => ({
      file,
      label: FILE_LABEL[file],
      chars: files[file].trim().length,
      budget: FILE_BUDGET[file],
      truncated: false,
      locked: false,
    })),
    systemChars: 0,
    promptChars: 0,
    totalChars: 0,
    totalBudget: TOTAL_BUDGET,
    ratio: 0,
    truncated: [],
    locked: [],
    mode: 'full',
  };
}

/** 用户手改代码后即时校验，不经过模型 */
export function validateEditedFiles(files: CodeFiles): ValidationReport {
  return validateFiles(files);
}