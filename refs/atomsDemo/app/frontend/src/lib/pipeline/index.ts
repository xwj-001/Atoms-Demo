/**
 * 流水线编排。
 *
 * 串行顺序（严格对应需求文档）：
 *   团队领导（受理调度）→ 产品经理（规划）→ 全栈开发工程师（生成）
 *   → 测试工程师（校验）→[缺陷回退开发工程师，最多 3 轮]→ 团队领导（终审）→ 渲染
 *
 * 每个 Agent 都有明确的输入 Key 与输出 Key，数据以字典结构在阶段间流转，
 * 并逐条产出 AgentLog 供前端可视化展示。
 */

import { generateId } from '../crypto';
import type { AgentLog, AgentRole, AppFiles, PipelineStage, ProjectStatus } from '../db';
import { complete, type LLMSettings } from '../llm/adapter';
import type { Blueprint, TemplateBlueprint } from '../llm/mockTemplates';
import { AGENTS, buildLeaderReviewMessages } from './agents';
import { runFixer, runGenerator } from './generator';
import { formatBlueprint, runPlanner } from './planner';
import { renderToHTML } from './renderer';
import { formatReport, validateFiles, type ValidationReport } from './validator';

/** 校验失败后的最大重新生成轮次 */
export const MAX_FIX_ROUNDS = 3;

export type PipelineOutcome = 'success' | 'partial' | 'aborted' | 'failed';

export interface PipelineResult {
  outcome: PipelineOutcome;
  status: ProjectStatus;
  statusNote: string;
  files: AppFiles;
  blueprint: Blueprint | null;
  blueprintText: string;
  report: ValidationReport | null;
  logs: AgentLog[];
  /** 需求模糊时的补充提示 */
  missingInfo: string[];
  finalReview: string;
  /** 生成的完整 HTML（纯净版） */
  html: string;
}

export interface StageEvent {
  stage: PipelineStage;
  /** 当前阶段状态 */
  state: 'start' | 'update' | 'done' | 'failed';
  log: AgentLog;
  /** 累积的全部日志 */
  logs: AgentLog[];
  /** 代码流式内容（生成阶段） */
  codeStream?: string;
  /** 当前修复轮次 */
  round?: number;
}

export interface RunPipelineOptions {
  requirement: string;
  settings: LLMSettings;
  onEvent?: (event: StageEvent) => void;
  signal?: AbortSignal;
}

/** 日志收集器：负责创建、更新与广播 AgentLog。 */
class LogBook {
  private logs: AgentLog[] = [];

  constructor(private readonly onEvent?: (event: StageEvent) => void) {}

  start(role: AgentRole, stage: PipelineStage, title: string, input: string, round = 0): AgentLog {
    const definition = AGENTS[role];
    const log: AgentLog = {
      id: generateId(),
      role,
      roleName: definition.name,
      stage,
      title,
      input,
      output: '',
      thinking: '',
      status: 'running',
      round,
      startedAt: Date.now(),
    };
    this.logs = [...this.logs, log];
    this.emit(stage, 'start', log);
    return log;
  }

  update(log: AgentLog, patch: Partial<AgentLog>, codeStream?: string): void {
    Object.assign(log, patch);
    this.logs = this.logs.map((item) => (item.id === log.id ? { ...log } : item));
    this.emit(log.stage, 'update', log, codeStream);
  }

  finish(log: AgentLog, output: string, status: AgentLog['status'] = 'done'): void {
    Object.assign(log, { output, status, finishedAt: Date.now() });
    this.logs = this.logs.map((item) => (item.id === log.id ? { ...log } : item));
    this.emit(log.stage, status === 'failed' ? 'failed' : 'done', log);
  }

  snapshot(): AgentLog[] {
    return this.logs.map((item) => ({ ...item }));
  }

  private emit(
    stage: PipelineStage,
    state: StageEvent['state'],
    log: AgentLog,
    codeStream?: string,
  ): void {
    this.onEvent?.({
      stage,
      state,
      log: { ...log },
      logs: this.snapshot(),
      codeStream,
      round: log.round,
    });
  }
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('任务已取消');
}

/** 执行完整流水线。 */
export async function runPipeline(options: RunPipelineOptions): Promise<PipelineResult> {
  const { requirement, settings, onEvent, signal } = options;
  const book = new LogBook(onEvent);
  const trimmed = requirement.trim();

  /* ---------------- 阶段 0：团队领导受理与调度 ---------------- */
  const dispatchLog = book.start(
    'leader',
    'plan',
    '受理任务并调度流水线',
    `原始需求：${trimmed}`,
  );
  book.update(dispatchLog, {
    thinking:
      '收到用户需求，先确认需求是否具备可执行性，然后按「产品经理 → 全栈开发工程师 → 测试工程师」的顺序串行调度，并保留最多 3 轮缺陷修复额度。',
  });
  book.finish(
    dispatchLog,
    [
      '任务已受理，流水线调度方案：',
      '1. 产品经理：解析需求，输出结构化应用蓝图（输出 Key：blueprint / ambiguous）',
      '2. 全栈开发工程师：按蓝图生成 index.html / style.css / app.js（输出 Key：files）',
      '3. 测试工程师：执行五项确定性检查，输出测试报告与缺陷清单（输出 Key：report / defects）',
      `4. 缺陷回退开发工程师修复，最多 ${MAX_FIX_ROUNDS} 轮`,
      '5. 团队领导终审并交付产物',
    ].join('\n'),
  );

  /* ---------------- 阶段 1：产品经理规划 ---------------- */
  ensureNotAborted(signal);
  const planLog = book.start('pm', 'plan', '解析需求并输出应用蓝图', `原始需求：${trimmed}`);
  let planResult;
  try {
    planResult = await runPlanner({
      requirement: trimmed,
      settings,
      onThinking: (text) => book.update(planLog, { thinking: text }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    book.finish(planLog, `规划失败：${reason}`, 'failed');
    return {
      outcome: 'failed',
      status: 'failed',
      statusNote: `规划阶段失败：${reason}`,
      files: { 'index.html': '', 'style.css': '', 'app.js': '' },
      blueprint: null,
      blueprintText: '',
      report: null,
      logs: book.snapshot(),
      missingInfo: [],
      finalReview: '',
      html: '',
    };
  }

  const blueprintText = formatBlueprint(planResult.blueprint);

  // --- 边界场景：需求过于模糊 → 团队领导终止任务 ---
  if (planResult.ambiguous) {
    book.finish(
      planLog,
      [`判定结果：需求过于模糊，无法生成蓝图。`, '', planResult.note, '', '需要用户补充：', ...planResult.missingInfo.map((item, i) => `  ${i + 1}. ${item}`)].join('\n'),
      'warning',
    );

    const abortLog = book.start(
      'leader',
      'plan',
      '终止任务并要求补充需求',
      `产品经理反馈：需求模糊，缺失 ${planResult.missingInfo.length} 项关键信息`,
    );
    book.update(abortLog, {
      thinking:
        '产品经理判定需求无法解析。继续往下走只会产出无意义的应用，因此在此终止流水线，把问题反馈给用户，请其补充关键信息后重新发起。',
    });
    book.finish(
      abortLog,
      [
        '决议：终止本次流水线。',
        '原因：需求描述不足以确定应用类型与核心数据模型。',
        '',
        '请补充以下信息后重新提交：',
        ...planResult.missingInfo.map((item, i) => `  ${i + 1}. ${item}`),
      ].join('\n'),
      'warning',
    );

    return {
      outcome: 'aborted',
      status: 'failed',
      statusNote: '需求过于模糊，任务已终止，请补充需求后重试',
      files: { 'index.html': '', 'style.css': '', 'app.js': '' },
      blueprint: planResult.blueprint,
      blueprintText,
      report: null,
      logs: book.snapshot(),
      missingInfo: planResult.missingInfo,
      finalReview: '',
      html: '',
    };
  }

  book.finish(
    planLog,
    [
      `蓝图来源：${
        planResult.source === 'template'
          ? '预置模板匹配'
          : planResult.source === 'llm'
            ? '大模型生成'
            : '通用模板降级'
      }`,
      planResult.note,
      '',
      blueprintText,
    ].join('\n'),
    planResult.degraded ? 'warning' : 'done',
  );

  /* ---------------- 阶段 2：开发工程师生成代码 ---------------- */
  ensureNotAborted(signal);
  const template: TemplateBlueprint | null = planResult.template;
  const genLog = book.start(
    'dev',
    'generate',
    '生成 index.html / style.css / app.js',
    `蓝图：${planResult.blueprint.appName}（${planResult.blueprint.features.length} 个功能点）`,
  );

  let files: AppFiles;
  try {
    const generated = await runGenerator({
      requirement: trimmed,
      blueprint: planResult.blueprint,
      settings,
      template,
      onThinking: (text) => book.update(genLog, { thinking: text }),
      onCode: (accumulated) => book.update(genLog, {}, accumulated),
    });
    files = generated.files;
    book.finish(
      genLog,
      [
        generated.prose || '三个文件已生成完毕。',
        '',
        generated.note,
        '',
        `index.html：${files['index.html'].length} 字符`,
        `style.css：${files['style.css'].length} 字符`,
        `app.js：${files['app.js'].length} 字符`,
      ].join('\n'),
      generated.degraded ? 'warning' : 'done',
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    book.finish(genLog, `代码生成失败：${reason}`, 'failed');
    return {
      outcome: 'failed',
      status: 'failed',
      statusNote: `生成阶段失败：${reason}`,
      files: { 'index.html': '', 'style.css': '', 'app.js': '' },
      blueprint: planResult.blueprint,
      blueprintText,
      report: null,
      logs: book.snapshot(),
      missingInfo: [],
      finalReview: '',
      html: '',
    };
  }

  /* ---------------- 阶段 3：测试工程师校验（含修复闭环） ---------------- */
  let report = validateFiles(files);
  let round = 0;

  const qaLog = book.start(
    'qa',
    'validate',
    '执行五项确定性检查',
    'JS 语法 / HTML 引用完整性 / 交互闭环 / 数据持久化 / HTML 结构',
  );
  book.update(qaLog, {
    thinking:
      '不依赖主观判断：用 new Function 实际编译 app.js 验证语法，扫描 JS 中的元素引用与 HTML 实际 id 做交叉比对，再静态分析事件绑定、DOM 写入、数据集合变更与 localStorage 读写。',
  });
  book.finish(qaLog, formatReport(report), report.passed ? 'done' : 'warning');

  while (!report.passed && round < MAX_FIX_ROUNDS) {
    ensureNotAborted(signal);
    round += 1;

    const fixLog = book.start(
      'dev',
      'generate',
      `第 ${round} 轮缺陷修复`,
      `缺陷清单（${report.defects.length} 条）：\n${report.defects.map((d, i) => `${i + 1}. ${d}`).join('\n')}`,
      round,
    );

    try {
      const fixed = await runFixer({
        requirement: trimmed,
        blueprint: planResult.blueprint,
        settings,
        template,
        files,
        report,
        round,
        onThinking: (text) => book.update(fixLog, { thinking: text }),
        onCode: (accumulated) => book.update(fixLog, {}, accumulated),
      });
      files = fixed.files;
      book.finish(
        fixLog,
        [fixed.prose || `第 ${round} 轮修复已完成。`, '', fixed.note].join('\n'),
        fixed.degraded ? 'warning' : 'done',
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      book.finish(fixLog, `第 ${round} 轮修复失败：${reason}`, 'failed');
      break;
    }

    const reLog = book.start(
      'qa',
      'validate',
      `第 ${round} 轮回归校验`,
      '对修复后的代码重新执行五项检查',
      round,
    );
    report = validateFiles(files);
    book.finish(reLog, formatReport(report), report.passed ? 'done' : 'warning');
  }

  /* ---------------- 阶段 4：团队领导终审 + 渲染 ---------------- */
  ensureNotAborted(signal);
  const reviewLog = book.start(
    'leader',
    'render',
    '最终评审并交付产物',
    `测试结论：${report.passed ? '五项检查全部通过' : `${report.score} 通过，${report.defects.length} 项待改进`}${round ? `（经过 ${round} 轮修复）` : ''}`,
  );
  book.update(reviewLog, {
    thinking:
      '逐项确认：需求是否被蓝图完整覆盖、代码是否可在浏览器直接运行、测试报告是否通过。若仍有未通过项，需在交付说明中明确标注，不隐藏风险。',
  });

  let finalReview = '';
  try {
    const result = await complete(
      buildLeaderReviewMessages(trimmed, planResult.blueprint, report),
      settings,
      {
        mockText: report.passed
          ? `评审通过。需求「${trimmed}」已在蓝图中完整拆解为 ${planResult.blueprint.features.length} 个功能点并全部实现。代码经五项确定性检查全部通过，语法合法、元素引用完整、交互闭环成立、localStorage 持久化可用。产物可直接在浏览器运行，准予交付。`
          : `评审有条件通过。需求主体已实现，但测试仍有 ${report.defects.length} 项未通过（${report.score}），经过 ${round} 轮修复未能完全消除。产物仍可运行并交付，但需标注「未完全通过测试」，建议用户在对话面板中针对遗留问题继续迭代。`,
      },
    );
    finalReview = result.content.trim();
  } catch {
    finalReview = report.passed
      ? '评审通过：需求对齐、代码可运行、测试全部通过，准予交付。'
      : `评审有条件通过：需求主体已实现，但仍有 ${report.defects.length} 项检查未通过，标注「未完全通过测试」后交付。`;
  }

  const html = renderToHTML(files);
  const exceeded = !report.passed && round >= MAX_FIX_ROUNDS;
  const status: ProjectStatus = report.passed ? 'success' : 'partial';
  const statusNote = report.passed
    ? `五项检查全部通过${round ? `（经过 ${round} 轮修复）` : ''}`
    : exceeded
      ? `未完全通过测试：已达最大修复轮次 ${MAX_FIX_ROUNDS}，仍有 ${report.defects.length} 项缺陷未消除`
      : `未完全通过测试：仍有 ${report.defects.length} 项缺陷未消除`;

  book.finish(
    reviewLog,
    [
      finalReview,
      '',
      `交付结论：${statusNote}`,
      `产物规模：单文件 HTML ${html.length} 字符（CSS 与 JS 已内联，可独立运行）`,
    ].join('\n'),
    report.passed ? 'done' : 'warning',
  );

  return {
    outcome: report.passed ? 'success' : 'partial',
    status,
    statusNote,
    files,
    blueprint: planResult.blueprint,
    blueprintText,
    report,
    logs: book.snapshot(),
    missingInfo: [],
    finalReview,
    html,
  };
}