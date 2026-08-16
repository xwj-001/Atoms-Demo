import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Atom, Compass, LayoutGrid, Settings2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountMenu, { CloudBadge, type AuthState } from '@/components/studio/AccountMenu';
import ControlPanel from '@/components/studio/ControlPanel';
import EmbedDialog from '@/components/studio/EmbedDialog';
import GalleryPanel from '@/components/studio/GalleryPanel';
import LoginGate from '@/components/studio/LoginGate';
import MyAppsPanel from '@/components/studio/MyAppsPanel';
import PreviewPane, { type GenPhase, type PaneView } from '@/components/studio/PreviewPane';
import SettingsDialog from '@/components/studio/SettingsDialog';
import ThoughtChainPanel from '@/components/studio/ThoughtChainPanel';
import VersionHistoryDialog from '@/components/studio/VersionHistoryDialog';
import {
  appendVersion,
  createApp,
  currentFilesOf,
  downloadHtml,
  getApp,
  locksOf,
  setAppLocks,
  setCurrentVersion,
  STYLE_LABEL,
  type StudioApp,
  type StyleTag,
  type VersionCheck,
} from '@/lib/db';
import {
  emptyFiles,
  emptyLocks,
  lockedFiles as pickLockedFiles,
  renderToHTML,
  type CodeFiles,
  type FileLocks,
} from '@/lib/codeFiles';
import {
  fetchCurrentUser,
  logout as cloudLogout,
  syncWithCloud,
  toLogin,
  type StudioUser,
} from '@/lib/cloud';
import {
  clearGuestSession,
  guestDisplayName,
  loadGuestSession,
  startGuestSession,
  type GuestSession,
} from '@/lib/session';
import {
  buildThoughtContents,
  emptyStages,
  errorMessage,
  type ContextUsage,
  type StageKey,
  type ThoughtStage,
} from '@/lib/llm';
import { generateValidated, validateEditedFiles, type AttemptRecord } from '@/lib/pipeline';
import type { ValidationReport } from '@/lib/validator';
import type { ParseStrategy } from '@/lib/parser';
import { loadSettings, type LlmMode, type StudioSettings } from '@/lib/settings';
import { PRESET_TEMPLATES } from '@/lib/templates';

const STAGE_ORDER: StageKey[] = ['requirement', 'tech', 'component', 'style', 'verify'];

/** 会话种类：none 表示未登录，此时功能全部锁在登录门后 */
type SessionKind = 'loading' | 'none' | 'guest' | 'atoms';

/** 从需求描述推断应用名称 */
function inferAppName(description: string): string {
  const lower = description.toLowerCase();
  const hit = PRESET_TEMPLATES.find((t) =>
    t.keywords.some((k) => lower.includes(k.toLowerCase())),
  );
  if (hit) return hit.label;
  const cleaned = description.replace(/^(帮我|请|麻烦)?(生成|做|创建|写)(一个)?/, '').trim();
  return (cleaned || description).slice(0, 14) || '未命名应用';
}

function toVersionCheck(report: ValidationReport, attempts: number): VersionCheck {
  return {
    passed: report.passed,
    failed: report.checks.filter((c) => !c.passed).map((c) => c.label),
    attempts,
  };
}

export default function Index() {
  const [settings, setSettings] = useState<StudioSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState('workbench');

  const [sessionKind, setSessionKind] = useState<SessionKind>('loading');
  const [user, setUser] = useState<StudioUser | null>(null);
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('尚未同步');

  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<StyleTag>('minimal');

  const [phase, setPhase] = useState<GenPhase>('idle');
  const [streamText, setStreamText] = useState('');
  const [files, setFiles] = useState<CodeFiles>(() => emptyFiles());
  const [draftFiles, setDraftFiles] = useState<CodeFiles>(() => emptyFiles());
  const [activeFile, setActiveFile] = useState<keyof CodeFiles>('html');
  const [locks, setLocks] = useState<FileLocks>(() => emptyLocks());
  const [strategy, setStrategy] = useState<ParseStrategy | null>(null);
  const [usedMode, setUsedMode] = useState<LlmMode>('atoms');
  /** 本轮实际生效的模型标识，用于预览区徽标与思维链展示 */
  const [usedModel, setUsedModel] = useState<string>('');
  const [fallbackReason, setFallbackReason] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [statusText, setStatusText] = useState('');

  const [report, setReport] = useState<ValidationReport | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [usage, setUsage] = useState<ContextUsage | null>(null);
  const [patchNotes, setPatchNotes] = useState<string[]>([]);

  const [stages, setStages] = useState<ThoughtStage[]>(() => emptyStages());
  const [chainOpen, setChainOpen] = useState(true);

  const [view, setView] = useState<PaneView>('preview');
  const [iterateInput, setIterateInput] = useState('');

  const [currentApp, setCurrentApp] = useState<StudioApp | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const revealRef = useRef<number | null>(null);

  const hasCode = !!(files.html || files.css || files.js);
  const draftDirty = useMemo(
    () =>
      draftFiles.html !== files.html ||
      draftFiles.css !== files.css ||
      draftFiles.js !== files.js,
    [draftFiles, files],
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (revealRef.current) window.clearInterval(revealRef.current);
    },
    [],
  );

  const applyFiles = useCallback((next: CodeFiles) => {
    setFiles(next);
    setDraftFiles(next);
  }, []);

  const runSync = useCallback(async (target: StudioUser, silent = false) => {
    setSyncing(true);
    try {
      const result = await syncWithCloud(target);
      setLastSyncText(
        `最近同步 ${new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })} · 上传 ${result.uploaded} / 拉取 ${result.downloaded}`,
      );
      setRefreshToken((n) => n + 1);
      if (!silent) {
        toast.success(`同步完成，上传 ${result.uploaded} 个、拉取 ${result.downloaded} 个`);
      }
    } catch (err) {
      const message = errorMessage(err);
      setLastSyncText(`同步失败：${message}`);
      if (!silent) toast.error(`同步失败：${message}`);
    } finally {
      setSyncing(false);
    }
  }, []);

  /** 首屏解析会话：优先正式账号，其次本地游客会话，都没有则展示登录门 */
  useEffect(() => {
    let alive = true;
    const fallbackToGuest = () => {
      const existingGuest = loadGuestSession();
      if (existingGuest) {
        setGuest(existingGuest);
        setSessionKind('guest');
      } else {
        setSessionKind('none');
      }
    };
    fetchCurrentUser()
      .then((me) => {
        if (!alive) return;
        if (me) {
          setUser(me);
          setGuest(null);
          setSessionKind('atoms');
          void runSync(me, true);
          return;
        }
        fallbackToGuest();
      })
      .catch(() => {
        if (alive) fallbackToGuest();
      });
    return () => {
      alive = false;
    };
  }, [runSync]);

  /** 按固定节奏逐阶段揭示思维链 */
  const startReveal = useCallback((contents: Record<StageKey, string>) => {
    if (revealRef.current) window.clearInterval(revealRef.current);
    const titles = emptyStages();
    setStages(
      STAGE_ORDER.map((key, index) => ({
        key,
        title: titles[index].title,
        content: index === 0 ? contents[key] : '',
        status: index === 0 ? 'running' : 'pending',
      })),
    );
    let cursor = 0;
    revealRef.current = window.setInterval(() => {
      cursor += 1;
      if (cursor >= STAGE_ORDER.length) {
        if (revealRef.current) window.clearInterval(revealRef.current);
        revealRef.current = null;
        return;
      }
      setStages((prev) =>
        prev.map((stage, index) => {
          if (index < cursor) return { ...stage, content: contents[stage.key], status: 'done' };
          if (index === cursor)
            return { ...stage, content: contents[stage.key], status: 'running' };
          return stage;
        }),
      );
    }, 900);
  }, []);

  const finishReveal = useCallback((contents: Record<StageKey, string>) => {
    if (revealRef.current) window.clearInterval(revealRef.current);
    revealRef.current = null;
    setStages((prev) =>
      prev.map((stage) => ({ ...stage, content: contents[stage.key], status: 'done' })),
    );
  }, []);

  /**
   * 统一生成入口。
   * - create：整文件输出
   * - iterate / repair：默认走补丁式编辑，补丁定位失败时流水线内部自动回落整文件重写
   * - repair 会带上具体问题清单（静态校验 / 交互冒烟 / 视觉体检）
   */
  const runGeneration = useCallback(
    async (options: {
      input: string;
      iterate: boolean;
      issues?: string[];
      changelog?: string;
    }) => {
      const { input, iterate, issues, changelog } = options;
      const baseFiles = iterate ? files : undefined;
      const activeLocks = iterate ? locks : emptyLocks();

      const controller = new AbortController();
      abortRef.current = controller;

      setPhase('running');
      setView('preview');
      setStreamText('');
      setError(undefined);
      setFallbackReason(undefined);
      setStrategy(null);
      setReport(null);
      setAttempts([]);
      setPatchNotes([]);
      setChainOpen(true);
      setStatusText(iterate ? '正在基于当前版本迭代…' : '正在生成第一个版本…');

      const contents = buildThoughtContents({
        description: iterate ? currentApp?.description || description : description,
        style,
        mode: settings.mode,
        model: settings.mode === 'atoms' ? settings.atomsModel : settings.model,
        templateName: inferAppName(iterate ? currentApp?.description || description : description),
        iterationNote: iterate ? input : undefined,
        versionNumber: iterate ? (currentApp?.versions.length ?? 1) + 1 : 1,
        locked: pickLockedFiles(activeLocks),
        patchMode: iterate,
      });
      startReveal(contents);

      try {
        const result = await generateValidated({
          input,
          style,
          settings,
          intent: iterate ? (issues?.length ? 'repair' : 'iterate') : 'create',
          currentFiles: baseFiles,
          issues,
          locks: activeLocks,
          allowPatch: iterate,
          signal: controller.signal,
          onChunk: setStreamText,
          onAttempt: (record) => {
            setAttempts((prev) => [...prev, record]);
            if (!record.passed && record.attempt === 1) {
              setStatusText(`首轮校验有 ${record.failed.length} 项未通过，正在自动修复…`);
            }
          },
        });

        applyFiles(result.files);
        setStrategy(result.strategy);
        setUsedMode(result.usedMode);
        setUsedModel(result.usedModel);
        setFallbackReason(result.fallbackReason);
        setReport(result.report);
        setAttempts(result.history);
        setUsage(result.usage);
        setPatchNotes(result.patchNotes);
        finishReveal(contents);
        setPhase('done');

        if (result.blockedByLock.length > 0) {
          toast.info(
            `已保留锁定文件：${result.blockedByLock.length} 个文件的模型改动被拦下，未覆盖你的手改内容`,
          );
        }

        const check = toVersionCheck(result.report, result.attempts);
        const qualityText = result.report.passed
          ? `质量校验 ${result.report.checks.length}/${result.report.checks.length} 项通过`
          : `仍有 ${check.failed.length} 项未通过（${check.failed.join('、')}）`;

        if (iterate && currentApp?.id) {
          const next = await appendVersion(currentApp.id, result.files, changelog ?? input, {
            check,
            origin: result.mode,
            patched: result.patched,
          });
          setCurrentApp(next);
          setIterateInput('');
          setStatusText(`已保存为第 ${next.versions.length} 版 · ${qualityText}`);
          if (result.report.passed) {
            toast.success(`迭代完成，已存为第 ${next.versions.length} 版`);
          } else {
            toast.warning(`已存为第 ${next.versions.length} 版，但${qualityText}`);
          }
        } else {
          const created = await createApp({
            name: inferAppName(description),
            description,
            style,
            files: result.files,
            changelog: '初始版本',
            check,
            origin: 'full',
          });
          setCurrentApp(created);
          setLocks(emptyLocks());
          setStatusText(`已保存「${created.name}」· ${qualityText}`);
          if (result.report.passed) {
            toast.success(`已生成并保存「${created.name}」`);
          } else {
            toast.warning(`已保存「${created.name}」，但${qualityText}`);
          }
        }
        if (!result.report.passed) setView('quality');
        setRefreshToken((n) => n + 1);
        if (user) void runSync(user, true);
      } catch (err) {
        if (controller.signal.aborted) {
          if (revealRef.current) window.clearInterval(revealRef.current);
          revealRef.current = null;
          setPhase(hasCode ? 'done' : 'idle');
          setStatusText('已停止本次生成。');
          return;
        }
        const message = errorMessage(err);
        setError(message);
        setPhase('error');
        setStatusText(`生成失败：${message}`);
        toast.error(message);
      } finally {
        abortRef.current = null;
      }
    },
    [
      applyFiles,
      currentApp,
      description,
      files,
      finishReveal,
      hasCode,
      locks,
      runSync,
      settings,
      startReveal,
      style,
      user,
    ],
  );

  const handleGenerate = () => {
    if (!description.trim()) {
      toast.error('请先描述你想要的应用');
      return;
    }
    setCurrentApp(null);
    applyFiles(emptyFiles());
    setLocks(emptyLocks());
    setUsage(null);
    setIterateInput('');
    void runGeneration({ input: description.trim(), iterate: false });
  };

  const handleIterate = () => {
    if (!iterateInput.trim() || !hasCode) return;
    if (!currentApp?.id) {
      toast.error('请先生成一个应用再进行迭代');
      return;
    }
    void runGeneration({ input: iterateInput.trim(), iterate: true });
  };

  /** 静态校验未通过时手动再触发一轮定向修复 */
  const handleRepair = () => {
    if (!hasCode || !report || report.passed) return;
    if (!currentApp?.id) {
      toast.error('请先生成一个应用');
      return;
    }
    void runGeneration({
      input: '修复未通过的静态校验项',
      iterate: true,
      issues: report.issues,
      changelog: `修复静态校验问题（${report.issues.length} 项）`,
    });
  };

  /** 按交互冒烟 / 视觉体检的结论发起定向修复 */
  const handleRepairAudit = (issues: string[]) => {
    if (!hasCode || issues.length === 0) return;
    if (!currentApp?.id) {
      toast.error('请先生成一个应用');
      return;
    }
    void runGeneration({
      input: '修复体检发现的交互与视觉问题',
      iterate: true,
      issues,
      changelog: `修复体检问题（${issues.length} 项）`,
    });
  };

  /** 切换文件锁定：锁定后模型迭代不会覆盖该文件 */
  const handleToggleLock = (file: keyof CodeFiles) => {
    const next: FileLocks = { ...locks, [file]: !locks[file] };
    setLocks(next);
    if (currentApp?.id) {
      void setAppLocks(currentApp.id, next).then(setCurrentApp);
    }
    toast.success(next[file] ? '已锁定，后续 AI 迭代不会改动此文件' : '已解锁，AI 可以再次改动此文件');
  };

  /** 手改代码后应用：即时重新校验、自动锁定改过的文件并存为新版本 */
  const handleApplyDraft = async () => {
    if (!draftDirty) return;
    const nextReport = validateEditedFiles(draftFiles);
    // 手改过的文件自动加锁，避免下一轮迭代把刚改的内容冲掉
    const autoLocks: FileLocks = {
      html: locks.html || draftFiles.html !== files.html,
      css: locks.css || draftFiles.css !== files.css,
      js: locks.js || draftFiles.js !== files.js,
    };

    applyFiles(draftFiles);
    setLocks(autoLocks);
    setReport(nextReport);
    setAttempts([
      {
        attempt: 1,
        passed: nextReport.passed,
        failed: nextReport.checks.filter((c) => !c.passed).map((c) => c.label),
        issues: nextReport.issues,
        mode: 'full',
      },
    ]);
    setStrategy('delimiter');
    setPhase('done');

    if (currentApp?.id) {
      const next = await appendVersion(currentApp.id, draftFiles, '手动编辑代码', {
        check: toVersionCheck(nextReport, 1),
        origin: 'manual',
      });
      const withLocks = await setAppLocks(currentApp.id, autoLocks);
      setCurrentApp({ ...withLocks, versions: next.versions, currentVersionIndex: next.currentVersionIndex });
      setStatusText(`手动改动已存为第 ${next.versions.length} 版，改过的文件已自动锁定。`);
      setRefreshToken((n) => n + 1);
      if (user) void runSync(user, true);
    }
    if (nextReport.passed) {
      toast.success('改动已应用，校验全部通过');
    } else {
      toast.warning(`改动已应用，但仍有 ${nextReport.issues.length} 项校验未通过`);
      setView('quality');
    }
  };

  const handleQuickTemplate = (templateDescription: string, templateStyle: StyleTag) => {
    setDescription(templateDescription);
    setStyle(templateStyle);
    setStatusText(`已填入模板需求，推荐风格：${STYLE_LABEL[templateStyle]}。`);
  };

  const handleOpenApp = async (app: StudioApp) => {
    const fresh = (app.id ? await getApp(app.id) : null) ?? app;
    const freshFiles = currentFilesOf(fresh);
    setCurrentApp(fresh);
    setDescription(fresh.description);
    setStyle(fresh.style);
    applyFiles(freshFiles);
    setLocks(locksOf(fresh));
    setStrategy('delimiter');
    setReport(validateEditedFiles(freshFiles));
    setAttempts([]);
    setUsage(null);
    setPatchNotes([]);
    setPhase('done');
    setView('preview');
    setStreamText('');
    setError(undefined);
    setFallbackReason(undefined);
    setIterateInput('');
    setStatusText(`已载入「${fresh.name}」第 ${fresh.currentVersionIndex + 1} 版，可继续迭代。`);
    finishReveal(
      buildThoughtContents({
        description: fresh.description,
        style: fresh.style,
        mode: settings.mode,
        model: settings.mode === 'atoms' ? settings.atomsModel : settings.model,
        templateName: fresh.name,
        versionNumber: fresh.currentVersionIndex + 1,
        locked: pickLockedFiles(locksOf(fresh)),
      }),
    );
    setTab('workbench');
  };

  const handleRestoreVersion = async (index: number) => {
    if (!currentApp?.id) return;
    const next = await setCurrentVersion(currentApp.id, index);
    const nextFiles = currentFilesOf(next);
    setCurrentApp(next);
    applyFiles(nextFiles);
    setReport(validateEditedFiles(nextFiles));
    setAttempts([]);
    setPatchNotes([]);
    setPhase('done');
    setView('preview');
    setRefreshToken((n) => n + 1);
    toast.success(`已恢复到第 ${index + 1} 版`);
  };

  const handleExport = () => {
    if (!hasCode) return;
    const name = currentApp?.name || inferAppName(description) || 'atoms-app';
    downloadHtml(name, renderToHTML(files));
    toast.success('已导出 HTML 文件');
  };

  /** 建立游客会话，直接解锁本地功能 */
  const handleGuestLogin = () => {
    const session = startGuestSession();
    setGuest(session);
    setUser(null);
    setSessionKind('guest');
    setLastSyncText('游客模式不同步云端');
    toast.success(`已以${guestDisplayName(session)}身份进入，作品保存在本地`);
  };

  /** 退出：正式账号走云端登出，游客清空本地会话回到登录门 */
  const handleLogout = () => {
    if (sessionKind === 'guest') {
      clearGuestSession();
      setGuest(null);
      setSessionKind('none');
      setCurrentApp(null);
      applyFiles(emptyFiles());
      setLocks(emptyLocks());
      setReport(null);
      setUsage(null);
      setPhase('idle');
      setStatusText('');
      toast.success('已退出游客模式');
      return;
    }
    cloudLogout().catch(() => toast.error('退出登录失败'));
  };

  const handleManualSync = () => {
    if (!user) {
      toast.error('游客模式暂不支持云端同步，请登录正式账号');
      return;
    }
    void runSync(user);
  };

  if (sessionKind === 'loading') {
    return (
      <div className="mesh-bg flex min-h-screen items-center justify-center">
        <div className="glass flex items-center gap-3 rounded-2xl px-6 py-4">
          <Atom className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">正在检查登录状态…</p>
        </div>
      </div>
    );
  }

  if (sessionKind === 'none') {
    return <LoginGate onLogin={toLogin} onGuest={handleGuestLogin} />;
  }

  const authState: AuthState = sessionKind === 'atoms' ? 'authenticated' : 'anonymous';
  const guestName = sessionKind === 'guest' && guest ? guestDisplayName(guest) : null;

  return (
    <div className="mesh-bg min-h-screen">
      <div className="mx-auto flex h-screen max-w-[1680px] flex-col px-4 py-3 sm:px-6">
        <header className="mb-3 flex shrink-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Atom className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">Atoms Studio</h1>
              <p className="text-[11px] text-muted-foreground">看得见的思考过程，可校验的生成质量</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="ml-auto">
            <TabsList className="bg-white/65">
              <TabsTrigger value="workbench" className="gap-1.5 text-xs">
                <Wand2 className="h-3.5 w-3.5" />
                工作台
              </TabsTrigger>
              <TabsTrigger value="apps" className="gap-1.5 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" />
                我的应用
              </TabsTrigger>
              <TabsTrigger value="gallery" className="gap-1.5 text-xs">
                <Compass className="h-3.5 w-3.5" />
                灵感画廊
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <CloudBadge authState={authState} isGuest={!!guestName} syncing={syncing} />

          <AccountMenu
            authState={authState}
            user={user}
            guestName={guestName}
            syncing={syncing}
            lastSyncText={lastSyncText}
            onLogin={toLogin}
            onLogout={handleLogout}
            onSync={handleManualSync}
          />

          <Button
            variant="outline"
            size="icon"
            className="bg-white/60"
            onClick={() => setSettingsOpen(true)}
            aria-label="打开设置"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsContent value="workbench" className="mt-0 min-h-0 flex-1 focus-visible:outline-none">
            <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[2fr_3fr]">
              <div className="flex min-h-0 flex-col gap-3">
                <ControlPanel
                  description={description}
                  onDescriptionChange={setDescription}
                  style={style}
                  onStyleChange={setStyle}
                  onQuickTemplate={handleQuickTemplate}
                  onGenerate={handleGenerate}
                  onCancel={() => abortRef.current?.abort()}
                  busy={phase === 'running'}
                  settings={settings}
                  statusText={statusText}
                />
                <ThoughtChainPanel
                  open={chainOpen}
                  onToggle={() => setChainOpen((v) => !v)}
                  stages={stages}
                  busy={phase === 'running'}
                />
              </div>

              <PreviewPane
                phase={phase}
                streamText={streamText}
                files={files}
                draftFiles={draftFiles}
                activeFile={activeFile}
                onActiveFileChange={setActiveFile}
                onDraftChange={(file, value) =>
                  setDraftFiles((prev) => ({ ...prev, [file]: value }))
                }
                draftDirty={draftDirty}
                onApplyDraft={() => {
                  void handleApplyDraft();
                }}
                onResetDraft={() => setDraftFiles(files)}
                locks={locks}
                onToggleLock={handleToggleLock}
                strategy={strategy}
                usedMode={usedMode}
                usedModel={usedModel}
                fallbackReason={fallbackReason}
                error={error}
                style={style}
                app={currentApp}
                view={view}
                onViewChange={setView}
                report={report}
                attempts={attempts}
                usage={usage}
                patchNotes={patchNotes}
                onRepair={handleRepair}
                onRepairAudit={handleRepairAudit}
                iterateInput={iterateInput}
                onIterateInputChange={setIterateInput}
                onIterate={handleIterate}
                onExport={handleExport}
                onOpenEmbed={() => setEmbedOpen(true)}
                onOpenHistory={() => setHistoryOpen(true)}
                busy={phase === 'running'}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="apps"
            className="stream-scroll mt-0 min-h-0 flex-1 overflow-y-auto pb-4 focus-visible:outline-none"
          >
            <MyAppsPanel
              refreshToken={refreshToken}
              authState={authState}
              onOpenApp={handleOpenApp}
              onAppsChanged={() => setRefreshToken((n) => n + 1)}
              onRequestSync={handleManualSync}
            />
          </TabsContent>

          <TabsContent
            value="gallery"
            className="stream-scroll mt-0 min-h-0 flex-1 overflow-y-auto pb-4 focus-visible:outline-none"
          >
            <GalleryPanel
              authState={authState}
              userId={user?.id ?? null}
              refreshToken={refreshToken}
              onLogin={toLogin}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />

      <VersionHistoryDialog
        app={currentApp}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={(index) => {
          void handleRestoreVersion(index);
        }}
      />

      <EmbedDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        files={files}
        title={currentApp?.name || inferAppName(description) || 'Atoms App'}
      />
    </div>
  );
}