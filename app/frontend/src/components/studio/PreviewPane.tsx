import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Code2,
  Download,
  Eye,
  History,
  Loader2,
  Lock,
  Monitor,
  RefreshCw,
  Save,
  Share2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CodeWorkspace from '@/components/studio/CodeWorkspace';
import QualityPanel, { type RuntimeEntry } from '@/components/studio/QualityPanel';
import { STYLE_LABEL, type StudioApp, type StyleTag } from '@/lib/db';
import { STRATEGY_LABEL, type ParseStrategy } from '@/lib/parser';
import { atomsModelLabel, deepseekModelLabel } from '@/lib/settings';
import {
  FILE_LABEL,
  filesMetrics,
  isSandboxMessage,
  lockedFiles,
  renderForSandbox,
  type CodeFiles,
  type FileLocks,
} from '@/lib/codeFiles';
import {
  AUDIT_BUDGET_MS,
  AUDIT_SCRIPT,
  buildHostMessage,
  smokeIssues,
  visualIssues,
  type SmokeResult,
  type VisualResult,
} from '@/lib/sandboxAudit';
import type { ValidationReport } from '@/lib/validator';
import type { AttemptRecord } from '@/lib/pipeline';
import type { ContextUsage } from '@/lib/llm';

export type GenPhase = 'idle' | 'running' | 'done' | 'error';
export type PaneView = 'preview' | 'code' | 'quality';

interface PreviewPaneProps {
  phase: GenPhase;
  /** 流式原始输出，用于生成中展示 */
  streamText: string;
  files: CodeFiles;
  draftFiles: CodeFiles;
  activeFile: keyof CodeFiles;
  onActiveFileChange: (file: keyof CodeFiles) => void;
  onDraftChange: (file: keyof CodeFiles, value: string) => void;
  draftDirty: boolean;
  onApplyDraft: () => void;
  onResetDraft: () => void;
  locks: FileLocks;
  onToggleLock: (file: keyof CodeFiles) => void;
  strategy: ParseStrategy | null;
  usedMode: string;
  /** 本轮实际生效的模型标识 */
  usedModel?: string;
  fallbackReason?: string;
  error?: string;
  style: StyleTag;
  app: StudioApp | null;
  view: PaneView;
  onViewChange: (view: PaneView) => void;
  report: ValidationReport | null;
  attempts: AttemptRecord[];
  usage: ContextUsage | null;
  patchNotes: string[];
  onRepair: () => void;
  /** 按体检结果发起定向修复 */
  onRepairAudit: (issues: string[]) => void;
  iterateInput: string;
  onIterateInputChange: (value: string) => void;
  onIterate: () => void;
  onExport: () => void;
  onOpenEmbed: () => void;
  onOpenHistory: () => void;
  busy: boolean;
}

let runtimeSeq = 0;

/** 右侧工作区：预览沙箱 / 代码工作区 / 质量面板三视图 + 迭代输入 */
export default function PreviewPane({
  phase,
  streamText,
  files,
  draftFiles,
  activeFile,
  onActiveFileChange,
  onDraftChange,
  draftDirty,
  onApplyDraft,
  onResetDraft,
  locks,
  onToggleLock,
  strategy,
  usedMode,
  usedModel,
  fallbackReason,
  error,
  style,
  app,
  view,
  onViewChange,
  report,
  attempts,
  usage,
  patchNotes,
  onRepair,
  onRepairAudit,
  iterateInput,
  onIterateInputChange,
  onIterate,
  onExport,
  onOpenEmbed,
  onOpenHistory,
  busy,
}: PreviewPaneProps) {
  const [runtime, setRuntime] = useState<RuntimeEntry[]>([]);
  const [smoke, setSmoke] = useState<SmokeResult | null>(null);
  const [visual, setVisual] = useState<VisualResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  /** 上一次体检的实测墙钟耗时，用于向用户证明这层校验的真实上限 */
  const [auditMs, setAuditMs] = useState<number | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const auditTimer = useRef<number | null>(null);
  const auditStart = useRef(0);
  /** 沙箱是否已就绪，未就绪时发送体检指令会丢失 */
  const readyRef = useRef(false);
  /** 是否有一次「等沙箱就绪后立刻执行」的体检排队中 */
  const pendingAuditRef = useRef(false);
  /** 持有最新的 runAudit，供只注册一次的消息监听器调用 */
  const runAuditRef = useRef<() => void>(() => {});

  const hasCode = !!(files.html || files.css || files.js);
  const metrics = useMemo(() => filesMetrics(files), [files]);
  // 预览版本注入通信桥 + 体检脚本；导出版本保持纯净，互不干扰
  const sandboxDoc = useMemo(
    () => (hasCode ? renderForSandbox(files, AUDIT_SCRIPT) : ''),
    [files, hasCode],
  );

  const versionCount = app?.versions.length ?? 0;
  const currentVersion = app ? app.currentVersionIndex + 1 : 0;
  const runtimeErrors = runtime.filter((r) => r.kind !== 'log').length;
  const lockedList = useMemo(() => lockedFiles(locks), [locks]);

  const auditIssueCount =
    (smoke ? smoke.errors.length + smoke.dead.length : 0) + (visual ? visual.issues.length : 0);

  /** 向沙箱下发一次体检指令：先冒烟，再做视觉检测 */
  const runAudit = useCallback(() => {
    const frame = frameRef.current;
    if (!frame?.contentWindow || !readyRef.current) return;
    auditStart.current = Date.now();
    setAuditMs(null);
    setAuditing(true);
    setSmoke(null);
    setVisual(null);
    // 一条指令让沙箱在同一个任务里连续跑完冒烟与视觉：冒烟改完 DOM 后紧接着做视觉检测，
    // 既保证检测的是交互后的真实状态，又省掉两次 postMessage 往返与中间的人为等待
    frame.contentWindow.postMessage(buildHostMessage('run-audit'), '*');
    // 硬截止只是兜底：正常情况下结论一到就立刻收尾并清掉定时器，
    // 只有沙箱脚本完全不回话时才会走到这里
    if (auditTimer.current) window.clearTimeout(auditTimer.current);
    auditTimer.current = window.setTimeout(() => {
      setAuditing(false);
      setAuditMs(Date.now() - auditStart.current);
    }, AUDIT_BUDGET_MS);
  }, []);

  useEffect(() => {
    runAuditRef.current = runAudit;
  }, [runAudit]);

  /** 接收沙箱桥回传的运行时事件与体检结论 */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isSandboxMessage(event.data)) return;
      const { type, payload } = event.data;

      if (type === 'ready') {
        readyRef.current = true;
        // 沙箱脚本一就绪就立刻开跑，不再干等固定延迟
        if (pendingAuditRef.current) {
          pendingAuditRef.current = false;
          runAuditRef.current();
        }
        return;
      }
      if (type === 'smoke') {
        setSmoke(payload as unknown as SmokeResult);
        return;
      }
      if (type === 'visual') {
        setVisual(payload as unknown as VisualResult);
        setAuditing(false);
        setAuditMs(Date.now() - auditStart.current);
        // 结论已到手，立刻撤掉兜底截止定时器，避免它稍后再次覆盖耗时展示
        if (auditTimer.current) {
          window.clearTimeout(auditTimer.current);
          auditTimer.current = null;
        }
        return;
      }

      runtimeSeq += 1;
      const entry: RuntimeEntry = {
        id: runtimeSeq,
        kind: type === 'log' ? 'log' : type === 'resource' ? 'resource' : 'error',
        level: typeof payload.level === 'string' ? payload.level : undefined,
        text:
          type === 'resource'
            ? `资源加载失败：${String(payload.tag ?? '')} ${String(payload.url ?? '')}`
            : String(payload.message ?? payload.text ?? '未知事件'),
        time: Date.now(),
      };
      // 只保留最近 60 条，避免死循环日志把内存打满
      setRuntime((prev) => [...prev.slice(-59), entry]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /** 代码变化即视为新一次运行：清空上一轮记录，并自动跑一遍体检 */
  useEffect(() => {
    setRuntime([]);
    setSmoke(null);
    setVisual(null);
    setAuditMs(null);
    readyRef.current = false;
    pendingAuditRef.current = false;
    if (!sandboxDoc) return;
    // 首选由沙箱回传的 ready 立即触发体检；这里只留一个保底延迟，
    // 防止 ready 消息因故丢失时体检永远不跑
    pendingAuditRef.current = true;
    const timer = window.setTimeout(() => {
      if (!pendingAuditRef.current) return;
      pendingAuditRef.current = false;
      runAudit();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [sandboxDoc, runAudit]);

  useEffect(
    () => () => {
      if (auditTimer.current) window.clearTimeout(auditTimer.current);
    },
    [],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !busy && iterateInput.trim() && hasCode) {
      event.preventDefault();
      onIterate();
    }
  };

  return (
    <section className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/60 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <Monitor className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{app?.name || '预览'}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {app
              ? `第 ${currentVersion} / ${versionCount} 版 · ${metrics.lines} 行 · ${metrics.kb}KB`
              : '生成后在这里沙箱运行'}
          </p>
        </div>

        <Tabs value={view} onValueChange={(v) => onViewChange(v as PaneView)}>
          <TabsList className="h-8 bg-white/60">
            <TabsTrigger value="preview" className="h-6 gap-1 px-2 text-xs">
              <Eye className="h-3.5 w-3.5" /> 预览
            </TabsTrigger>
            <TabsTrigger value="code" className="h-6 gap-1 px-2 text-xs">
              <Code2 className="h-3.5 w-3.5" /> 代码
            </TabsTrigger>
            <TabsTrigger value="quality" className="h-6 gap-1 px-2 text-xs">
              {report && !report.passed ? (
                <ShieldAlert className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              校验
              {(runtimeErrors > 0 || auditIssueCount > 0 || (report && !report.passed)) && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          disabled={!app}
          onClick={onOpenHistory}
        >
          <History className="mr-1 h-3.5 w-3.5" />
          版本
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          disabled={!hasCode}
          onClick={onOpenEmbed}
        >
          <Share2 className="mr-1 h-3.5 w-3.5" />
          嵌入
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          disabled={!hasCode}
          onClick={onExport}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          导出
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 text-[11px] text-muted-foreground">
        <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
          {STYLE_LABEL[style]}
        </Badge>
        {phase === 'running' && (
          <span className="flex items-center gap-1 font-medium text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            正在生成 · {streamText.length} 字符
          </span>
        )}
        {phase === 'done' && strategy && (
          <>
            <Badge variant="outline" className="h-5 bg-white/50 px-1.5 text-[11px]">
              {STRATEGY_LABEL[strategy]}
            </Badge>
            <Badge variant="outline" className="h-5 bg-white/50 px-1.5 text-[11px]">
              {usedMode === 'mock'
                ? '离线模板'
                : usedMode === 'openai'
                  ? 'OpenAI 兼容'
                  : usedMode === 'deepseek'
                    ? 'DeepSeek 代理'
                    : 'Atoms 代理'}
            </Badge>
            {usedMode !== 'mock' && usedModel && (
              <Badge
                variant="outline"
                className="h-5 max-w-[14rem] truncate bg-white/50 px-1.5 text-[11px]"
                title={usedModel}
              >
                {usedMode === 'atoms'
                  ? atomsModelLabel(usedModel)
                  : usedMode === 'deepseek'
                    ? deepseekModelLabel(usedModel)
                    : usedModel}
              </Badge>
            )}
            {usage?.mode === 'patch' && (
              <Badge variant="outline" className="h-5 bg-white/50 px-1.5 text-[11px]">
                补丁式编辑
              </Badge>
            )}
            {report && (
              <Badge
                className={`h-5 gap-1 px-1.5 text-[11px] ${
                  report.passed
                    ? 'bg-mint/15 text-mint hover:bg-mint/15'
                    : 'bg-destructive/12 text-destructive hover:bg-destructive/12'
                }`}
              >
                {report.passed ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                校验 {report.checks.filter((c) => c.passed).length}/{report.checks.length}
              </Badge>
            )}
            {auditMs !== null && (
              <Badge variant="outline" className="h-5 bg-white/50 px-1.5 text-[11px]">
                体检 {(auditMs / 1000).toFixed(1)}s / 上限 {(AUDIT_BUDGET_MS / 1000).toFixed(0)}s
              </Badge>
            )}
            {attempts.length > 1 && (
              <Badge variant="outline" className="h-5 bg-white/50 px-1.5 text-[11px]">
                自动修复 {attempts.length - 1} 轮
              </Badge>
            )}
            {app && (
              <Badge className="h-5 gap-1 bg-mint/15 px-1.5 text-[11px] text-mint hover:bg-mint/15">
                <Save className="h-3 w-3" /> 已保存
              </Badge>
            )}
          </>
        )}
        {lockedList.length > 0 && (
          <Badge variant="outline" className="h-5 gap-1 bg-white/50 px-1.5 text-[11px]">
            <Lock className="h-3 w-3" />
            已锁定 {lockedList.map((key) => FILE_LABEL[key]).join('、')}
          </Badge>
        )}
        {phase === 'idle' && <span>等待生成</span>}
        {phase === 'error' && <span className="text-destructive">{error}</span>}
      </div>

      {fallbackReason && phase === 'done' && (
        <p className="mx-4 mb-2 rounded-lg bg-warm/12 px-2.5 py-1.5 text-[11px] leading-relaxed text-warm-foreground">
          模型调用未成功，已自动使用离线模板：{fallbackReason}
        </p>
      )}

      <div className="min-h-0 flex-1 px-4">
        {view === 'code' ? (
          <CodeWorkspace
            files={draftFiles}
            activeFile={activeFile}
            onActiveFileChange={onActiveFileChange}
            onFileChange={onDraftChange}
            dirty={draftDirty}
            onApply={onApplyDraft}
            onReset={onResetDraft}
            locks={locks}
            onToggleLock={onToggleLock}
            disabled={busy || !hasCode}
          />
        ) : view === 'quality' ? (
          <QualityPanel
            report={report}
            attempts={attempts}
            runtime={runtime}
            smoke={smoke}
            visual={visual}
            auditing={auditing}
            auditMs={auditMs}
            usage={usage}
            patchNotes={patchNotes}
            onClearRuntime={() => setRuntime([])}
            onRunAudit={runAudit}
            onRepair={onRepair}
            onRepairAudit={() => onRepairAudit(collectAuditIssues(smoke, visual))}
            busy={busy}
          />
        ) : phase === 'running' ? (
          <SkeletonPreview streamText={streamText} />
        ) : phase === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-semibold text-destructive">这次生成失败了</p>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{error}</p>
          </div>
        ) : hasCode ? (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <iframe
              ref={frameRef}
              title="应用预览"
              srcDoc={sandboxDoc}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              className="min-h-0 flex-1 w-full rounded-xl border border-white/70 bg-white"
            />
            {(runtimeErrors > 0 || auditIssueCount > 0) && (
              <button
                type="button"
                onClick={() => onViewChange('quality')}
                className="flex items-center gap-2 rounded-lg bg-destructive/[0.08] px-2.5 py-1.5 text-left text-[11px] text-destructive transition-colors duration-200 hover:bg-destructive/[0.14]"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                {runtimeErrors > 0 && `捕获 ${runtimeErrors} 条运行时异常`}
                {runtimeErrors > 0 && auditIssueCount > 0 && '，'}
                {auditIssueCount > 0 && `体检发现 ${auditIssueCount} 处问题`}
                ，点击查看详情
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/25 bg-white/40 p-6 text-center">
            <Monitor className="h-5 w-5 text-primary/60" />
            <p className="text-sm font-medium">还没有内容</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              在左侧写下需求并选好风格，点击「生成应用」后，成品会在这里的沙箱中直接运行，并自动跑一轮静态校验、交互冒烟与视觉体检。
            </p>
          </div>
        )}
      </div>

      <footer className="space-y-2 border-t border-white/60 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={iterateInput}
            onChange={(e) => onIterateInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="继续提修改意见，例如：把按钮颜色改成蓝色"
            disabled={!hasCode || busy}
            className="bg-white/60 text-sm"
          />
          <Button disabled={!hasCode || busy || !iterateInput.trim()} onClick={onIterate}>
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            迭代
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          迭代默认走补丁式编辑，只替换命中的片段；补丁无法定位时自动回落整文件重写，产出仍会跑一轮校验后存档。
        </p>
      </footer>
    </section>
  );
}

/**
 * 把冒烟与视觉体检结论合并为回喂模型的问题清单。
 * 具体文案生成放在 sandboxAudit 内，避免重复维护两套描述。
 */
function collectAuditIssues(smoke: SmokeResult | null, visual: VisualResult | null): string[] {
  return [...smokeIssues(smoke), ...visualIssues(visual)];
}

function SkeletonPreview({ streamText }: { streamText: string }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl bg-white/55 p-4">
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="h-3 w-3/5" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-11/12" />
      <Skeleton className="h-11 w-4/5" />
      <div className="stream-scroll mt-auto max-h-28 overflow-auto rounded-lg bg-foreground/[0.05] p-2">
        <p className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
          {streamText.slice(-700) || '正在建立连接…'}
        </p>
      </div>
    </div>
  );
}