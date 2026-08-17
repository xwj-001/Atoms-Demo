import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
import { createProject, deleteProject, listProjects, renameProject, type ProjectRecord } from '@/lib/db';
import { Plus, Search, Trash2, FileCode, Clock, CheckCircle2, AlertTriangle, PanelLeftClose } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectList() {
  const { currentUserId, isGuest } = useAuthStore();
  const {
    currentProjectId,
    setCurrentProject,
    setFiles,
    setLogs,
    setBlueprint,
    setReport,
    setStatusNote,
    setChatMessages,
    setPhase,
    projectListVersion,
    refreshProjectList,
    resetToInput,
    toggleSidebar,
  } = useWorkspaceStore();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, [projectListVersion, currentUserId]);

  const loadProjects = async () => {
    const items = await listProjects(currentUserId(), searchKeyword);
    setProjects(items);
  };

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProjects();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 编辑时自动聚焦
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleNewProject = () => {
    resetToInput();
    setCurrentProject(null);
  };

  const handleSelectProject = async (project: ProjectRecord) => {
    setCurrentProject(project);
    setFiles(project.files);
    setLogs(project.logs);
    setChatMessages(project.chat);
    setStatusNote(project.statusNote);
    if (project.blueprint) {
      try {
        const parsed = JSON.parse(project.blueprint);
        setBlueprint(parsed, project.blueprint);
      } catch {
        setBlueprint(null, project.blueprint);
      }
    } else {
      setBlueprint(null, '');
    }
    setReport(null);
    setPhase(project.status === 'draft' ? 'input' : 'result');
  };

  const handleDoubleClick = (project: ProjectRecord) => {
    if (isGuest) {
      toast.warning('访客模式不可重命名');
      return;
    }
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleRename = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await renameProject(editingId, editingName);
      refreshProjectList();
      if (currentProjectId === editingId) {
        const project = projects.find((p) => p.id === editingId);
        if (project) {
          setCurrentProject({ ...project, name: editingName.trim() });
        }
      }
      toast.success('重命名成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重命名失败');
    }
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      refreshProjectList();
      if (currentProjectId === deleteTarget.id) {
        resetToInput();
        setCurrentProject(null);
      }
      toast.success('删除成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
    setDeleteTarget(null);
  };

  const getStatusIcon = (status: ProjectRecord['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'partial':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'failed':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50 w-full overflow-hidden">
      {/* 顶部：新建按钮 + 收起按钮 + 搜索 */}
      <div className="p-3 space-y-3 border-b border-slate-800">
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
            onClick={handleNewProject}
          >
            <Plus className="w-4 h-4 mr-2" />
            新建项目
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={toggleSidebar}
            title="收起侧栏"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="搜索项目..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-9 h-9 bg-slate-800/50 border-slate-700 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
          />
        </div>
      </div>

      {/* 项目列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-2 space-y-1 w-full">
          {projects.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <FileCode className="w-10 h-10 mx-auto mb-3 opacity-30" />
              {searchKeyword ? '未找到匹配的项目' : '暂无项目，点击上方按钮新建'}
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className={`group relative rounded-lg px-3.5 py-3 cursor-pointer transition-all overflow-hidden w-full ${
                  currentProjectId === project.id
                    ? 'bg-violet-600/20 border border-violet-500/30'
                    : 'hover:bg-slate-800/60 border border-transparent'
                }`}
                onClick={() => handleSelectProject(project)}
                onDoubleClick={() => handleDoubleClick(project)}
              >
                {editingId === project.id ? (
                  <Input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="h-7 text-sm bg-slate-800 border-slate-600 text-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="flex items-start gap-2 w-full">
                      <div className="mt-0.5 shrink-0">
                        {getStatusIcon(project.status)}
                      </div>
                      <div className="flex-1 min-w-0 w-0 overflow-hidden">
                        <div
                          className="text-sm font-medium text-white"
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                          }}
                          title={project.name}
                        >
                          {project.name}
                        </div>
                        <div
                          className="text-xs text-slate-500 mt-1"
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                          }}
                          title={project.requirement || '空需求'}
                        >
                          {project.requirement.slice(0, 25) || '空需求'}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-slate-500">
                            {formatTime(project.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 删除按钮 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 w-6 h-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(project);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部：访客提示 */}
      {isGuest && (
        <div className="p-3 border-t border-slate-800">
          <Badge variant="outline" className="w-full justify-center border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs">
            访客模式 · 项目不会保存
          </Badge>
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目？</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              项目「{deleteTarget?.name}」及其所有版本将被永久删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
