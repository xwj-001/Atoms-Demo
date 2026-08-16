import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Gauge,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Wand2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ValidationReport } from '@/lib/validator';
import type { AttemptRecord } from '@/lib/pipeline';
import type { ContextUsage } from '@/lib/llm';
import {
  VISUAL_KIND_LABEL,
  type SmokeResult,
  type VisualResult,
} from '@/lib/sandboxAudit';

/** 预览沙箱回传的一条运行时记录 */
export interface RuntimeEntry {
  id: number;
  kind: 'error' | 'log' | 'resource';
  level?: string;
  text: string;
  time: number;
}

interface QualityPanelProps {
  report: ValidationReport | null;
  attempts: AttemptRecord[];
  runtime: RuntimeEntry[];
  smoke: SmokeResult | null;
  visual: VisualResult | null;
  auditing: boolean;
  usage: ContextUsage | null;
  patchNotes: string[];
  onClearRuntime: () => void;
  onRunAudit: () => void;
  onRepair: () => void;
  onRepairAudit: () => void;
  busy: boolean;
}

/** 补丁 / 整文件模式徽标文案 */
function modeLabel(record: AttemptRecord): string {
  if (record.fellBack) return '补丁失败→整文件';
  if (record.mode === 'patch') return `补丁 ${record.patchApplied ?? 0} 处`;
  return '整文件';
}

/**
 * 质量面板：确定性校验 + 交互冒烟 + 视觉体检 + 上下文用量 + 运行时日志。
 * 静态校验只能证明代码「写对了」，冒烟与体检才能证明它「用起来是活的、看起来是正的」。
 */
export default function QualityPanel({
  report,
  attempts,
  runtime,
  smoke,
  visual,
  auditing,
  usage,
  patchNotes,
  onClearRuntime,
  onRunAudit,
  onRepair,
  onRepairAudit,
  busy,
}: QualityPanelProps) {
  const errorCount = runtime.filter((r) => r.kind !== 'log').length;
  const hasIssue = !!report && !report.passed;
  const smokeBad = !!smoke && (smoke.errors.length > 0 || smoke.dead.length > 0 || (smoke.total > 0 && smoke.mutated === 0));
  const visualBad = !!visual && visual.issues.length > 0;

  return (
    <div className="stream-scroll flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      {/* ---------------------------- 静态校验 ---------------------------- */}
      <section className="rounded-xl border border-white/70 bg-white/55 p-3">
        <header className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold">确定性校验</h3>
          {report && (
            <Badge
              className={`h-5 px-1.5 text-[10px] ${
                report.passed
                  ? 'bg-mint/18 text-mint hover:bg-mint/18'
                  : 'bg-destructive/12 text-destructive hover:bg-destructive/12'
              }`}
            >
              {report.checks.filter((c) => c.passed).length}/{report.checks.length} 项通过
            </Badge>
          )}
          {hasIssue && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-[10px]"
              disabled={busy}
              onClick={onRepair}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              让 AI 再修一轮
            </Button>
          )}
        </header>

        {!report ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            生成完成后，这里会展示 5 项静态校验结论：JS 语法、跨文件引用、交互闭环、数据持久化、HTML 结构。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {report.checks.map((check) => (
              <li
                key={check.id}
                className="flex items-start gap-2 rounded-lg bg-white/60 px-2.5 py-1.5"
              >
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold">{check.label}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {attempts.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/70 pt-2">
            <span className="text-[10px] text-muted-foreground">自动修复轨迹：</span>
            {attempts.map((record) => (
              <Badge
                key={record.attempt}
                variant="outline"
                className={`h-5 bg-white/60 px-1.5 text-[10px] ${
                  record.passed ? 'text-mint' : 'text-warm-foreground'
                }`}
              >
                第 {record.attempt} 轮 · {modeLabel(record)} ·{' '}
                {record.passed ? '通过' : `${record.failed.length} 项待修`}
              </Badge>
            ))}
          </div>
        )}

        {patchNotes.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-white/70 pt-2">
            {patchNotes.slice(0, 3).map((note, index) => (
              <li key={index} className="text-[10px] leading-relaxed text-warm-foreground">
                · {note}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------ 冒烟 + 视觉体检 ------------------------ */}
      <section className="rounded-xl border border-white/70 bg-white/55 p-3">
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold">交互冒烟 + 视觉体检</h3>
          {smoke && (
            <Badge
              className={`h-5 px-1.5 text-[10px] ${
                smokeBad
                  ? 'bg-destructive/12 text-destructive hover:bg-destructive/12'
                  : 'bg-mint/18 text-mint hover:bg-mint/18'
              }`}
            >
              触发 {smoke.triggered} · 生效 {smoke.mutated}
            </Badge>
          )}
          {visual && (
            <Badge
              className={`h-5 px-1.5 text-[10px] ${
                visualBad
                  ? 'bg-warm/18 text-warm-foreground hover:bg-warm/18'
                  : 'bg-mint/18 text-mint hover:bg-mint/18'
              }`}
            >
              视觉 {visual.issues.length} 处
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              disabled={busy || auditing}
              onClick={onRunAudit}
            >
              {auditing ? (
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <MousePointerClick className="mr-1 h-3 w-3" />
              )}
              {auditing ? '体检中' : '跑一次体检'}
            </Button>
            {(smokeBad || visualBad) && (
              <Button
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={busy}
                onClick={onRepairAudit}
              >
                <Wand2 className="mr-1 h-3 w-3" />
                按体检结果修复
              </Button>
            )}
          </div>
        </header>

        {!smoke && !visual ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            体检会在预览沙箱里自动填表、提交并逐个点击可交互元素，判断有没有「点了没反应」的死按钮；同时检测横向溢出、内容裁切、点击目标过小与文字对比度不足。切到「预览」视图即可自动跑一轮。
          </p>
        ) : (
          <div className="space-y-2">
            {smoke && (
              <div className="rounded-lg bg-white/60 px-2.5 py-2">
                <p className="text-[11px] font-semibold">
                  交互冒烟：发现 {smoke.total} 个可交互元素，触发 {smoke.triggered} 次，其中{' '}
                  {smoke.mutated} 次产生了可见变化
                  {smoke.storageWritten ? '，并已写入本地存储' : '，但未写入本地存储'}。
                </p>
                {smoke.errors.length > 0 && (
                  <p className="mt-1 text-[11px] leading-relaxed text-destructive">
                    操作时报错：{smoke.errors.slice(0, 2).join('；')}
                  </p>
                )}
                {smoke.dead.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {smoke.dead.slice(0, 4).map((dead, index) => (
                      <li key={index} className="text-[11px] leading-relaxed text-warm-foreground">
                        · {dead.label}：{dead.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {!smokeBad && (
                  <p className="mt-1 text-[11px] text-mint">主要交互路径都有真实响应。</p>
                )}
              </div>
            )}

            {visual && (
              <div className="rounded-lg bg-white/60 px-2.5 py-2">
                <p className="text-[11px] font-semibold">
                  视觉体检：视口 {visual.viewport.width}×{visual.viewport.height}，共{' '}
                  {visual.issues.length} 处问题。
                </p>
                {visual.issues.length === 0 ? (
                  <p className="mt-1 text-[11px] text-mint">未发现溢出、裁切、过小目标与低对比文字。</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {visual.issues.slice(0, 6).map((issue, index) => (
                      <li key={index} className="text-[11px] leading-relaxed text-warm-foreground">
                        · [{VISUAL_KIND_LABEL[issue.kind]}] {issue.label}：{issue.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* --------------------------- 上下文用量 --------------------------- */}
      <section className="rounded-xl border border-white/70 bg-white/55 p-3">
        <header className="mb-2 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold">上下文用量</h3>
          {usage && (
            <Badge variant="outline" className="h-5 bg-white/60 px-1.5 text-[10px]">
              {usage.mode === 'patch' ? '补丁式' : '整文件'} · {usage.totalChars} 字符
            </Badge>
          )}
        </header>

        {!usage ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            每轮请求会展示三个文件各自占用多少字符、是否触及预算被截断，以及被锁定不参与改写的文件。
          </p>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1.5">
              {usage.files.map((file) => (
                <div key={file.file} className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-medium">{file.label}</span>
                    <span className="text-muted-foreground">
                      {file.chars} / {file.budget} 字符
                    </span>
                    {file.truncated && (
                      <Badge className="h-4 bg-warm/18 px-1 text-[9px] text-warm-foreground hover:bg-warm/18">
                        已截断
                      </Badge>
                    )}
                    {file.locked && (
                      <Badge variant="outline" className="h-4 bg-white/60 px-1 text-[9px]">
                        已锁定
                      </Badge>
                    )}
                  </div>
                  <Progress
                    value={Math.min(100, Math.round((file.chars / file.budget) * 100))}
                    className="h-1"
                  />
                </div>
              ))}
            </div>
            <p className="border-t border-white/70 pt-2 text-[10px] leading-relaxed text-muted-foreground">
              系统提示 {usage.systemChars} 字符 + 本轮指令 {usage.promptChars} 字符，正文占预算{' '}
              {Math.round(usage.ratio * 100)}%。
              {usage.truncated.length > 0
                ? '被截断的文件只提供了前半部分，未展示的部分会要求模型保持原样。'
                : '全部内容均完整传入，未发生截断。'}
            </p>
          </div>
        )}
      </section>

      {/* --------------------------- 运行时日志 --------------------------- */}
      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/70 bg-white/55 p-3">
        <header className="mb-2 flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold">预览运行时</h3>
          {errorCount > 0 && (
            <Badge className="h-5 bg-destructive/12 px-1.5 text-[10px] text-destructive hover:bg-destructive/12">
              {errorCount} 条异常
            </Badge>
          )}
          {runtime.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-6 px-2 text-[10px]"
              onClick={onClearRuntime}
            >
              清空
            </Button>
          )}
        </header>

        {runtime.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            沙箱内的报错、未处理的 Promise 拒绝与 console 输出都会实时回传到这里，白屏也能定位原因。
          </p>
        ) : (
          <ul className="stream-scroll min-h-0 flex-1 space-y-1 overflow-y-auto">
            {runtime.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 font-mono text-[10px] leading-relaxed ${
                  entry.kind === 'log'
                    ? 'bg-foreground/[0.04] text-muted-foreground'
                    : 'bg-destructive/[0.07] text-destructive'
                }`}
              >
                {entry.kind === 'log' ? (
                  <Terminal className="mt-0.5 h-3 w-3 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                )}
                <span className="min-w-0 break-all">
                  {entry.level ? `[${entry.level}] ` : ''}
                  {entry.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}