import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useWorkspaceStore } from '@/store/workspaceStore';
import Sandbox from './Sandbox';
import CodeEditor from './CodeEditor';
import VersionDialog from './VersionDialog';
import { exportToHTMLFile } from '@/lib/pipeline/renderer';
import {
  Eye,
  Code2,
  Columns3,
  Download,
  FileCode,
  History,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface ResultViewProps {
  onFixError?: (errorMessage: string) => void;
}

export default function ResultView({ onFixError }: ResultViewProps) {
  const { files, activeTab, setActiveTab, report, statusNote, currentProject } = useWorkspaceStore();
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  const handleDownload = () => {
    const projectName = currentProject?.name || 'atoms-app';
    exportToHTMLFile(files, projectName);
    toast.success('已开始下载');
  };

  const handleExportSource = () => {
    const projectName = currentProject?.name || 'atoms-app';

    // 分别下载三个文件
    const downloadFile = (filename: string, content: string, type: string) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    downloadFile('index.html', files['index.html'] || '', 'text/html');
    setTimeout(() => {
      downloadFile('style.css', files['style.css'] || '', 'text/css');
    }, 100);
    setTimeout(() => {
      downloadFile('app.js', files['app.js'] || '', 'text/javascript');
    }, 200);

    toast.success('已导出 3 个源码文件');
  };

  const getScoreColor = () => {
    if (!report) return 'text-slate-400';
    const score = parseInt(report.score.split('/')[0]);
    if (score >= 5) return 'text-emerald-400';
    if (score >= 3) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-slate-950">
        {/* 工具栏 */}
        <div className="h-12 border-b border-slate-800 flex items-center justify-between px-3 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-1">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="bg-slate-800/50 h-8">
                <TabsTrigger value="preview" className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-slate-700">
                  <Eye className="w-3.5 h-3.5" />
                  预览
                </TabsTrigger>
                <TabsTrigger value="code" className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-slate-700">
                  <Code2 className="w-3.5 h-3.5" />
                  代码
                </TabsTrigger>
                <TabsTrigger value="split" className="h-7 px-3 text-xs gap-1.5 data-[state=active]:bg-slate-700">
                  <Columns3 className="w-3.5 h-3.5" />
                  分屏
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            {/* 校验结果 */}
            {report && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge
                      variant="outline"
                      className={`h-7 gap-1.5 ${
                        report.passed
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      }`}
                    >
                      {report.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span className={getScoreColor()}>{report.score}</span>
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                  <p className="text-xs">{report.summary}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {statusNote && (
              <Badge variant="outline" className="h-7 border-slate-700 text-slate-400">
                {statusNote}
              </Badge>
            )}

            <div className="w-px h-5 bg-slate-700 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => setVersionDialogOpen(true)}
                >
                  <History className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                版本管理
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={handleExportSource}
                >
                  <FileCode className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                导出源码
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                下载 HTML
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 min-h-0">
          {activeTab === 'preview' && (
            <Sandbox files={files} onFixError={onFixError} />
          )}

          {activeTab === 'code' && (
            <CodeEditor files={files} />
          )}

          {activeTab === 'split' && (
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
                <Sandbox files={files} onFixError={onFixError} />
              </ResizablePanel>
              <ResizableHandle className="w-1 bg-slate-800 hover:bg-violet-500/50 transition-colors" />
              <ResizablePanel defaultSize={50} minSize={20} maxSize={80}>
                <CodeEditor files={files} />
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>

        {/* 版本管理对话框 */}
        <VersionDialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen} />
      </div>
    </TooltipProvider>
  );
}
