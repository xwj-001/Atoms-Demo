import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CloudOff,
  Download,
  FolderOpen,
  Globe,
  History,
  Layers,
  Lock,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VersionHistoryDialog from './VersionHistoryDialog';
import type { AuthState } from './AccountMenu';
import {
  computeStyleStats,
  currentCodeOf,
  downloadHtml,
  formatTime,
  listApps,
  removeApp,
  setAppPublic,
  setCurrentVersion,
  STYLE_LABEL,
  type StudioApp,
} from '@/lib/db';
import { deleteRemote } from '@/lib/cloud';

interface MyAppsPanelProps {
  /** 变化时触发列表刷新 */
  refreshToken: number;
  authState: AuthState;
  onOpenApp: (app: StudioApp) => void;
  onAppsChanged: () => void;
  onRequestSync: () => void;
}

/** 「我的应用」：统计卡片 + 搜索 + 卡片网格 + 版本历史 + 公开开关 */
export default function MyAppsPanel({
  refreshToken,
  authState,
  onOpenApp,
  onAppsChanged,
  onRequestSync,
}: MyAppsPanelProps) {
  const [apps, setApps] = useState<StudioApp[]>([]);
  const [allApps, setAllApps] = useState<StudioApp[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyApp, setHistoryApp] = useState<StudioApp | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listApps(keyword)
      .then((rows) => {
        if (alive) setApps(rows);
      })
      .catch(() => {
        if (alive) toast.error('读取本地应用库失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [keyword, refreshToken]);

  useEffect(() => {
    listApps('')
      .then(setAllApps)
      .catch(() => setAllApps([]));
  }, [refreshToken]);

  const styleReport = useMemo(() => computeStyleStats(allApps), [allApps]);
  const pendingSync = useMemo(() => allApps.filter((app) => app.dirty).length, [allApps]);

  const handleDelete = async (app: StudioApp) => {
    try {
      if (app.remoteId && authState === 'authenticated') {
        await deleteRemote(app.remoteId).catch(() => undefined);
      }
      await removeApp(app.id as number);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      setAllApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success(`已删除「${app.name}」`);
      onAppsChanged();
    } catch {
      toast.error('删除失败，请重试');
    }
  };

  const handleTogglePublic = async (app: StudioApp) => {
    if (!app.id) return;
    if (authState !== 'authenticated') {
      toast.error('公开分享需要先登录');
      return;
    }
    try {
      const next = await setAppPublic(app.id, !app.isPublic);
      setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      setAllApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      toast.success(next.isPublic ? '已设为公开，同步后出现在画廊' : '已取消公开');
      onRequestSync();
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleRestore = async (index: number) => {
    if (!historyApp?.id) return;
    try {
      const next = await setCurrentVersion(historyApp.id, index);
      setHistoryApp(next);
      setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      setAllApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      toast.success(`已恢复到第 ${index + 1} 版`);
      onAppsChanged();
    } catch {
      toast.error('恢复版本失败');
    }
  };

  return (
    <div className="space-y-4">
      <section className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              风格统计
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {styleReport.total
                ? `共 ${styleReport.total} 个应用，最常用的是 ${STYLE_LABEL[styleReport.favorite ?? 'minimal']}。`
                : '还没有数据。生成并保存应用后，这里会统计各风格的使用次数。'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {authState === 'authenticated' && pendingSync > 0 && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onRequestSync}>
                <CloudOff className="mr-1 h-3.5 w-3.5" />
                {pendingSync} 个待同步
              </Button>
            )}
            {styleReport.favorite && (
              <Badge className="bg-primary/12 text-primary hover:bg-primary/12">
                最常用：{STYLE_LABEL[styleReport.favorite]}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {styleReport.stats.map((stat) => (
            <div key={stat.tag} className="glass-soft rounded-xl p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold">{STYLE_LABEL[stat.tag]}</span>
                <span className="tabular text-lg font-bold text-primary">{stat.count}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out-expo"
                  style={{ width: `${Math.max(stat.ratio * 100, stat.count ? 5 : 0)}%` }}
                />
              </div>
              <p className="tabular mt-1.5 text-[11px] text-muted-foreground">
                占比 {Math.round(stat.ratio * 100)}%
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按应用名称或需求搜索"
            className="bg-white/60 pl-9"
          />
        </div>
        <Badge variant="outline" className="h-9 shrink-0 bg-white/50 px-3 text-xs">
          共 {apps.length} 个
        </Badge>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">正在读取本地应用库…</p>
      ) : apps.length === 0 ? (
        <div className="glass-soft rounded-2xl border border-dashed border-primary/25 p-10 text-center">
          <FolderOpen className="mx-auto h-6 w-6 text-primary/60" />
          <p className="mt-3 text-sm font-semibold">
            {keyword ? '没有匹配的应用' : '应用库还是空的'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {keyword
              ? '换一个关键词试试，搜索会同时匹配应用名称与需求描述。'
              : '回到工作台描述一个需求并生成，成品会自动保存到这里。'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <article key={app.id} className="glass animate-fade-up flex flex-col rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{app.name}</h3>
                <Badge variant="secondary" className="shrink-0 text-[11px]">
                  {STYLE_LABEL[app.style]}
                </Badge>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="tabular flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {app.versions.length} 个版本
                </span>
                <span className="tabular">{formatTime(app.createdAt)}</span>
                {app.isPublic && (
                  <Badge className="h-4 gap-1 bg-mint/15 px-1.5 text-[10px] text-mint hover:bg-mint/15">
                    <Globe className="h-2.5 w-2.5" />
                    公开
                  </Badge>
                )}
              </div>

              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {app.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/60 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2 text-xs"
                  onClick={() => onOpenApp(app)}
                >
                  <FolderOpen className="mr-1 h-3.5 w-3.5" />
                  打开
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => setHistoryApp(app)}
                >
                  <History className="mr-1 h-3.5 w-3.5" />
                  版本历史
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => downloadHtml(app.name, currentCodeOf(app))}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  导出
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => void handleTogglePublic(app)}
                >
                  {app.isPublic ? (
                    <>
                      <Lock className="mr-1 h-3.5 w-3.5" />
                      转私有
                    </>
                  ) : (
                    <>
                      <Globe className="mr-1 h-3.5 w-3.5" />
                      公开
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => void handleDelete(app)}
                  aria-label={`删除 ${app.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <VersionHistoryDialog
        app={historyApp}
        open={!!historyApp}
        onOpenChange={(open) => !open && setHistoryApp(null)}
        onRestore={(index) => {
          void handleRestore(index);
        }}
      />
    </div>
  );
}