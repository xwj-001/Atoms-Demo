import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { renderForSandbox } from '@/lib/pipeline/renderer';
import { Monitor, Tablet, Smartphone, AlertCircle, Bug, Loader2 } from 'lucide-react';

interface SandboxProps {
  files: { 'index.html': string; 'style.css': string; 'app.js': string };
  onFixError?: (errorMessage: string) => void;
}

interface SandboxError {
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export default function Sandbox({ files, onFixError }: SandboxProps) {
  const { viewportSize, setViewportSize } = useWorkspaceStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errors, setErrors] = useState<SandboxError[]>([]);
  const [loading, setLoading] = useState(true);

  // 生成沙箱 HTML
  const sandboxHtml = renderForSandbox(files);

  // 监听 postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || !data.__atomsSandbox) return;

      switch (data.type) {
        case 'READY':
          setIsReady(true);
          setLoading(false);
          break;
        case 'ERROR':
          setHasError(true);
          setLoading(false);
          setErrors((prev) => [
            ...prev,
            {
              message: data.message || '未知错误',
              source: data.source,
              line: data.line,
              column: data.column,
              stack: data.stack,
            },
          ]);
          break;
        case 'LOG':
          // 控制台日志，暂不处理
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 文件变化时重置状态
  useEffect(() => {
    setIsReady(false);
    setHasError(false);
    setErrors([]);
    setLoading(true);
  }, [sandboxHtml]);

  const handleFixError = () => {
    if (errors.length === 0 || !onFixError) return;
    const errorText = errors
      .map((e) => `${e.message}${e.source ? ` (${e.source}:${e.line}:${e.column})` : ''}`)
      .join('\n');
    onFixError(errorText);
  };

  const getViewportWidth = () => {
    switch (viewportSize) {
      case 'mobile':
        return 'max-w-[375px]';
      case 'tablet':
        return 'max-w-[768px]';
      default:
        return 'w-full';
    }
  };

  const getViewportLabel = () => {
    switch (viewportSize) {
      case 'mobile':
        return '手机';
      case 'tablet':
        return '平板';
      default:
        return '桌面';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* 顶部工具栏 */}
      <div className="h-10 border-b border-slate-800 flex items-center justify-between px-3 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`w-8 h-8 ${viewportSize === 'desktop' ? 'text-violet-400 bg-violet-500/10' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setViewportSize('desktop')}
            title="桌面视图"
          >
            <Monitor className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`w-8 h-8 ${viewportSize === 'tablet' ? 'text-violet-400 bg-violet-500/10' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setViewportSize('tablet')}
            title="平板视图"
          >
            <Tablet className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`w-8 h-8 ${viewportSize === 'mobile' ? 'text-violet-400 bg-violet-500/10' : 'text-slate-400 hover:text-white'}`}
            onClick={() => setViewportSize('mobile')}
            title="手机视图"
          >
            <Smartphone className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-500 ml-2">{getViewportLabel()}</span>
        </div>

        <div className="flex items-center gap-2">
          {loading && (
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              加载中
            </Badge>
          )}
          {isReady && !hasError && (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs bg-emerald-500/10">
              运行正常
            </Badge>
          )}
          {hasError && (
            <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs bg-red-500/10">
              <AlertCircle className="w-3 h-3 mr-1" />
              运行错误
            </Badge>
          )}
        </div>
      </div>

      {/* 错误面板 */}
      {hasError && errors.length > 0 && (
        <div className="bg-red-950/50 border-b border-red-900/50 px-4 py-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm font-medium text-red-300">检测到运行时错误</span>
                <span className="text-xs text-red-400/70">({errors.length} 个)</span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-300/80 font-mono truncate">
                    {err.message}
                    {err.source && (
                      <span className="text-red-400/50">
                        {' '}
                        @ {err.source.split('/').pop()}:{err.line}:{err.column}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {onFixError && (
              <Button
                size="sm"
                className="shrink-0 bg-red-600 hover:bg-red-500 text-white"
                onClick={handleFixError}
              >
                <Bug className="w-3.5 h-3.5 mr-1.5" />
                智能体修复
              </Button>
            )}
          </div>
        </div>
      )}

      {/* iframe 容器 */}
      <div className="flex-1 overflow-auto bg-slate-950 min-h-0">
        <div className={`${getViewportWidth()} w-full mx-auto transition-all duration-300 h-full`}>
          <div
            className={`bg-white ${
              viewportSize === 'mobile'
                ? 'aspect-[9/16] h-auto mx-auto'
                : viewportSize === 'tablet'
                ? 'aspect-[4/3] h-auto mx-auto'
                : 'w-full h-full'
            }`}
          >
            <iframe
              ref={iframeRef}
              srcDoc={sandboxHtml}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="w-full h-full border-0"
              title="应用预览"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
