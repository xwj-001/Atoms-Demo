import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { listVersions, saveVersion, type VersionRecord } from '@/lib/db';
import { History, Save, RotateCcw, Clock, FileCode, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface VersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VersionDialog({ open, onOpenChange }: VersionDialogProps) {
  const { isGuest } = useAuthStore();
  const { currentProjectId, files, setFiles } = useWorkspaceStore();
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<VersionRecord | null>(null);

  // 加载版本列表
  useEffect(() => {
    if (open && currentProjectId) {
      loadVersions();
    }
  }, [open, currentProjectId]);

  const loadVersions = async () => {
    if (!currentProjectId) return;
    const items = await listVersions(currentProjectId);
    setVersions(items);
  };

  const handleSave = async () => {
    if (!currentProjectId || isGuest) {
      toast.warning('访客模式不可保存版本');
      return;
    }
    setSaving(true);
    try {
      await saveVersion(currentProjectId, files, note);
      toast.success('版本保存成功');
      setNote('');
      await loadVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = () => {
    if (!rollbackTarget) return;
    setFiles(rollbackTarget.files);
    toast.success(`已回滚到 v${rollbackTarget.versionNo}`);
    setRollbackTarget(null);
    onOpenChange(false);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-violet-400" />
              版本管理
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 保存新版本 */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">保存当前版本</span>
              </div>
              <Textarea
                placeholder="版本说明（可选）"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mb-3 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm min-h-[60px] resize-none"
                disabled={isGuest || saving}
              />
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleSave}
                disabled={isGuest || saving}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '保存中...' : '保存版本'}
              </Button>
              {isGuest && (
                <p className="text-xs text-amber-400 mt-2 text-center">
                  访客模式不可保存版本，请登录后使用
                </p>
              )}
            </div>

            {/* 历史版本列表 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">历史版本</span>
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                  {versions.length}/20
                </Badge>
              </div>

              <ScrollArea className="h-64 rounded-lg border border-slate-800">
                {versions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    暂无历史版本
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className="p-3 hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-violet-600/20 text-violet-300 border-violet-500/30 border">
                                v{version.versionNo}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {formatTime(version.createdAt)}
                              </span>
                            </div>
                            <div className="text-sm text-slate-300 truncate">
                              {version.note || `版本 v${version.versionNo}`}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <FileCode className="w-3 h-3" />
                                {version.files['index.html'].length +
                                  version.files['style.css'].length +
                                  version.files['app.js'].length} 字符
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-700"
                            onClick={() => setRollbackTarget(version)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            回滚
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 回滚确认对话框 */}
      <AlertDialog open={!!rollbackTarget} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>确认回滚版本？</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              将回滚到 v{rollbackTarget?.versionNo}：{rollbackTarget?.note}
              <br />
              当前未保存的修改将会丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-violet-600 hover:bg-violet-500 text-white"
              onClick={handleRollback}
            >
              确认回滚
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
