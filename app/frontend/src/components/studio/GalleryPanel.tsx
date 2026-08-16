import { useCallback, useEffect, useState } from 'react';
import { Compass, Download, Eye, LogIn, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadHtml, formatTime, STYLE_LABEL } from '@/lib/db';
import { fetchGallery, type GalleryItem } from '@/lib/cloud';
import type { AuthState } from './AccountMenu';

interface GalleryPanelProps {
  authState: AuthState;
  userId: string | null;
  refreshToken: number;
  onLogin: () => void;
}

/**
 * 灵感画廊：展示所有用户公开分享的应用，可预览与导出。
 * 这是登录后的衍生能力，让本地生成的作品能被他人看到。
 */
export default function GalleryPanel({
  authState,
  userId,
  refreshToken,
  onLogin,
}: GalleryPanelProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<GalleryItem | null>(null);

  const load = useCallback(async () => {
    if (authState !== 'authenticated') return;
    setLoading(true);
    setError('');
    try {
      setItems(await fetchGallery(userId));
    } catch (err) {
      const message = (err as { message?: string })?.message || '读取画廊失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authState, userId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  if (authState === 'loading') {
    return <p className="py-12 text-center text-sm text-muted-foreground">正在检查登录状态…</p>;
  }

  if (authState === 'anonymous') {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <Compass className="mx-auto h-6 w-6 text-primary/70" />
        <p className="mt-3 text-sm font-semibold">登录后即可浏览灵感画廊</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
          画廊汇集所有用户主动公开的作品，你可以直接预览别人的成品并导出学习。
          登录同时会把你本地的应用同步到云端，换设备也不丢。
        </p>
        <Button className="mt-4" onClick={onLogin}>
          <LogIn className="mr-1.5 h-4 w-4" />
          登录 / 注册
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Compass className="h-4 w-4 text-primary" />
            灵感画廊
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length
              ? `共 ${items.length} 个公开作品，点击卡片即可预览运行效果。`
              : '还没有公开作品。到「我的应用」把任意应用设为公开，它就会出现在这里。'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </section>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">正在读取公开作品…</p>
      ) : items.length === 0 ? (
        <div className="glass-soft rounded-2xl border border-dashed border-primary/25 p-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary/60" />
          <p className="mt-3 text-sm font-semibold">画廊还是空的</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            在「我的应用」卡片上点「公开」，你的作品就会成为画廊里的第一件展品。
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.remoteId}
              className="glass animate-fade-up flex flex-col overflow-hidden rounded-2xl"
            >
              <button
                type="button"
                onClick={() => setPreview(item)}
                className="group relative h-40 overflow-hidden border-b border-white/60 bg-white text-left"
                aria-label={`预览 ${item.name}`}
              >
                <iframe
                  title={`${item.name} 缩略预览`}
                  srcDoc={item.code}
                  sandbox=""
                  scrolling="no"
                  tabIndex={-1}
                  className="pointer-events-none h-[320px] w-[200%] origin-top-left scale-50 border-0"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-all duration-200 ease-out-quart group-hover:bg-foreground/35 group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold">
                    <Eye className="h-3.5 w-3.5" />
                    查看大图
                  </span>
                </span>
              </button>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</h3>
                  <Badge variant="secondary" className="shrink-0 text-[11px]">
                    {STYLE_LABEL[item.style]}
                  </Badge>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {item.description || '未填写需求描述'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{item.versionCount} 个版本</span>
                  <span>{formatTime(item.createdAt)}</span>
                  {item.mine && (
                    <Badge className="h-4 bg-primary/12 px-1.5 text-[10px] text-primary hover:bg-primary/12">
                      我的作品
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex gap-2 border-t border-white/60 pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 flex-1 text-xs"
                    onClick={() => setPreview(item)}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    预览
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      downloadHtml(item.name, item.code);
                      toast.success('已导出 HTML 文件');
                    }}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    导出
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>
              {preview?.description || '未填写需求描述'}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <iframe
              title={`${preview.name} 预览`}
              srcDoc={preview.code}
              sandbox="allow-scripts allow-forms allow-modals"
              className="h-[62vh] w-full rounded-xl border border-white/70 bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}