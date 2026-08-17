import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  FileDiff,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DiffView from '@/components/studio/DiffView';
import { downloadHtml, formatTime, STYLE_LABEL, type AppVersion, type StudioApp } from '@/lib/db';
import { codeMetrics } from '@/lib/parser';
import { splitDocument, type CodeFiles } from '@/lib/codeFiles';

interface VersionHistoryDialogProps {
  app: StudioApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (index: number) => void;
}

/** 旧数据只有合成后的单文件，读取时拆回三文件才能做行级差异 */
function versionFiles(version: AppVersion): CodeFiles {
  return version.files ?? splitDocument(version.code);
}

const ORIGIN_LABEL: Record<NonNullable<AppVersion['origin']>, string> = {
  full: '整文件重写',
  patch: '补丁编辑',
  manual: '手动修改',
};

/** 时间线形式展示某个应用的所有历史版本，可预览、恢复，并对任意两版做行级差异对比 */
export default function VersionHistoryDialog({
  app,
  open,
  onOpenChange,
  onRestore,
}: VersionHistoryDialogProps) {
  const [diffMode, setDiffMode] = useState(false);
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(0);

  // 每次打开都回到时间线，并默认对比「上一版 → 当前版」
  useEffect(() => {
    if (!open || !app) return;
    setDiffMode(false);
    const current = app.currentVersionIndex;
    setRightIndex(current);
    setLeftIndex(Math.max(0, current - 1));
  }, [open, app]);

  const canDiff = (app?.versions.length ?? 0) >= 2;

  const diffPair = useMemo(() => {
    if (!app || !canDiff) return null;
    const left = app.versions[Math.min(leftIndex, app.versions.length - 1)];
    const right = app.versions[Math.min(rightIndex, app.versions.length - 1)];
    if (!left || !right) return null;
    return { left, right };
  }, [app, canDiff, leftIndex, rightIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{app?.name} · 版本历史</span>
            {canDiff && (
              <Button
                size="sm"
                variant={diffMode ? 'default' : 'outline'}
                className="h-6 px-2 text-[10px]"
                onClick={() => setDiffMode((v) => !v)}
              >
                <FileDiff className="mr-1 h-3 w-3" />
                {diffMode ? '返回时间线' : '对比两版差异'}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {diffMode
              ? '选择基准版本与目标版本，查看逐行差异以及两版的校验结论变化。'
              : '按时间倒序排列，点击任一版本即可预览并恢复为当前版本。'}
          </DialogDescription>
        </DialogHeader>

        {!app || app.versions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无版本记录。</p>
        ) : diffMode && diffPair ? (
          <div className="space-y-3">
            <div className="glass-soft flex flex-wrap items-center gap-2 rounded-xl p-3">
              <VersionSelect
                label="基准版本"
                app={app}
                value={leftIndex}
                onChange={setLeftIndex}
              />
              <ArrowRight className="mt-4 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <VersionSelect
                label="目标版本"
                app={app}
                value={rightIndex}
                onChange={setRightIndex}
              />
            </div>

            <div className="glass-soft rounded-xl p-3">
              <p className="text-xs font-semibold">校验结论变化</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <CheckBadge version={diffPair.left} prefix={`第 ${leftIndex + 1} 版`} />
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <CheckBadge version={diffPair.right} prefix={`第 ${rightIndex + 1} 版`} />
              </div>
            </div>

            <div className="h-[46vh] min-h-0">
              <DiffView
                oldFiles={versionFiles(diffPair.left)}
                newFiles={versionFiles(diffPair.right)}
                oldLabel={`第 ${leftIndex + 1} 版`}
                newLabel={`第 ${rightIndex + 1} 版`}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="glass-soft rounded-xl p-3">
              <p className="text-xs font-semibold">原始需求</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{app.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[11px]">
                  {STYLE_LABEL[app.style]}
                </Badge>
                <Badge variant="outline" className="bg-white/50 text-[11px]">
                  共 {app.versions.length} 个版本
                </Badge>
              </div>
            </div>

            <ol className="relative space-y-3 pl-6">
              <span className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
              {app.versions
                .map((version, index) => ({ version, index }))
                .reverse()
                .map(({ version, index }) => {
                  const isCurrent = index === app.currentVersionIndex;
                  const metrics = codeMetrics(version.code);
                  return (
                    <li key={`${version.timestamp}-${index}`} className="relative">
                      <span
                        className={`absolute -left-6 top-3 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                          isCurrent
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background'
                        }`}
                      >
                        {isCurrent && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <div
                        className={`rounded-xl border p-3 transition-colors duration-200 ${
                          isCurrent ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-white/55'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold">第 {index + 1} 版</span>
                          {isCurrent && (
                            <Badge className="h-5 bg-primary/15 px-1.5 text-[10px] text-primary hover:bg-primary/15">
                              当前版本
                            </Badge>
                          )}
                          <span className="tabular ml-auto text-[11px] text-muted-foreground">
                            {formatTime(version.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {version.changelog}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="tabular text-[11px] text-muted-foreground">
                            {metrics.lines} 行 · {metrics.kb}KB
                          </span>
                          {version.origin && (
                            <Badge variant="outline" className="h-5 bg-white/50 px-1.5 text-[10px]">
                              {ORIGIN_LABEL[version.origin]}
                            </Badge>
                          )}
                          {version.check && (
                            <Badge
                              className={`h-5 gap-1 px-1.5 text-[10px] ${
                                version.check.passed
                                  ? 'bg-mint/15 text-mint hover:bg-mint/15'
                                  : 'bg-destructive/12 text-destructive hover:bg-destructive/12'
                              }`}
                            >
                              {version.check.passed ? (
                                <ShieldCheck className="h-3 w-3" />
                              ) : (
                                <ShieldAlert className="h-3 w-3" />
                              )}
                              {version.check.passed
                                ? '校验通过'
                                : `待修：${version.check.failed.join('、')}`}
                            </Badge>
                          )}
                          {version.check && version.check.attempts > 1 && (
                            <Badge variant="outline" className="h-5 bg-white/50 px-1.5 text-[10px]">
                              自动修复 {version.check.attempts - 1} 轮
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={isCurrent ? 'secondary' : 'default'}
                            className="h-7 text-xs"
                            disabled={isCurrent}
                            onClick={() => onRestore(index)}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            {isCurrent ? '正在使用' : '恢复此版本'}
                          </Button>
                          {canDiff && index > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setLeftIndex(index - 1);
                                setRightIndex(index);
                                setDiffMode(true);
                              }}
                            >
                              <FileDiff className="mr-1 h-3.5 w-3.5" />
                              看这轮改了什么
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => downloadHtml(`${app.name}-v${index + 1}`, version.code)}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            导出
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 版本下拉选择器 */
function VersionSelect({
  label,
  app,
  value,
  onChange,
}: {
  label: string;
  app: StudioApp;
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <label className="min-w-40 flex-1 space-y-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full rounded-lg border border-white/70 bg-white/70 px-2 text-[11px] outline-none focus:border-primary/50"
      >
        {app.versions.map((version, index) => (
          <option key={`${version.timestamp}-${index}`} value={index}>
            第 {index + 1} 版 · {formatTime(version.timestamp)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 单版本校验结论徽标 */
function CheckBadge({ version, prefix }: { version: AppVersion; prefix: string }) {
  if (!version.check) {
    return (
      <Badge variant="outline" className="h-5 bg-white/60 px-1.5 text-[10px]">
        {prefix} · 无校验记录
      </Badge>
    );
  }
  const { passed, failed } = version.check;
  return (
    <Badge
      className={`h-5 gap-1 px-1.5 text-[10px] ${
        passed
          ? 'bg-mint/15 text-mint hover:bg-mint/15'
          : 'bg-destructive/12 text-destructive hover:bg-destructive/12'
      }`}
    >
      {passed ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {prefix} · {passed ? '全部通过' : `${failed.length} 项待修`}
    </Badge>
  );
}