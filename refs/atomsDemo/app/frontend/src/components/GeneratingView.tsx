import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { AGENTS, STAGE_ORDER, STAGE_LABELS } from '@/lib/pipeline/agents';
import type { AgentLog, PipelineStage } from '@/lib/db';
import {
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileCode,
  TestTube,
  Wand2,
  AlertTriangle,
} from 'lucide-react';

const STAGE_ICONS: Record<PipelineStage, React.ReactNode> = {
  plan: <Sparkles className="w-4 h-4" />,
  generate: <FileCode className="w-4 h-4" />,
  validate: <TestTube className="w-4 h-4" />,
  render: <Wand2 className="w-4 h-4" />,
};

const STAGE_COLORS: Record<PipelineStage, { bg: string; text: string; border: string }> = {
  plan: { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' },
  generate: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  validate: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  render: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
};

export default function GeneratingView() {
  const { logs, statusNote } = useWorkspaceStore();
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // 计算当前阶段
  const currentStage = getCurrentStage(logs);

  const toggleLog = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLogsByStage = (stage: PipelineStage) => {
    return logs.filter((log) => log.stage === stage);
  };

  const getStageStatus = (stage: PipelineStage): 'done' | 'running' | 'pending' => {
    const stageIndex = STAGE_ORDER.indexOf(stage);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    if (stageIndex < currentIndex) return 'done';
    if (stageIndex === currentIndex) return 'running';
    return 'pending';
  };

  const getStatusIcon = (log: AgentLog) => {
    switch (log.status) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* 顶部进度条 */}
      <div className="px-6 py-6 border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              智能体正在生成应用...
            </h2>
            <p className="text-sm text-slate-400">
              {statusNote || '4 个智能体协同工作，请稍候'}
            </p>
          </div>

          {/* 阶段进度 */}
          <div className="flex items-center justify-between">
            {STAGE_ORDER.map((stage, index) => {
              const status = getStageStatus(stage);
              const colors = STAGE_COLORS[stage];
              return (
                <div key={stage} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        status === 'done'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : status === 'running'
                          ? `${colors.bg} ${colors.border} ${colors.text} animate-pulse`
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      {status === 'done' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : status === 'running' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        STAGE_ICONS[stage]
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium ${
                        status === 'done'
                          ? 'text-emerald-400'
                          : status === 'running'
                          ? colors.text
                          : 'text-slate-500'
                      }`}
                    >
                      {STAGE_LABELS[stage]}
                    </span>
                  </div>
                  {index < STAGE_ORDER.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-all ${
                        status === 'done' ? 'bg-emerald-500/50' : 'bg-slate-800'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 智能体日志 */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-sm">正在初始化智能体流水线...</p>
            </div>
          ) : (
            logs.map((log) => {
              const agent = AGENTS[log.role];
              const isExpanded = expandedLogs.has(log.id);
              const colors = STAGE_COLORS[log.stage];

              return (
                <Collapsible
                  key={log.id}
                  open={isExpanded}
                  onOpenChange={() => toggleLog(log.id)}
                  className={`rounded-lg border overflow-hidden transition-all ${
                    log.status === 'running'
                      ? `${colors.border} ${colors.bg}`
                      : 'border-slate-800 bg-slate-900/50'
                  }`}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full h-auto p-4 justify-between hover:bg-transparent"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(log)}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white text-sm">
                              {agent.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs h-5 ${colors.border} ${colors.text} ${colors.bg}`}
                            >
                              {STAGE_LABELS[log.stage]}
                            </Badge>
                            {log.round > 0 && (
                              <Badge variant="outline" className="text-xs h-5 border-amber-500/30 text-amber-400 bg-amber-500/10">
                                第 {log.round} 轮
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {log.title}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-800/50 pt-3">
                      {/* 思考过程 */}
                      {log.thinking && (
                        <div>
                          <div className="text-xs font-medium text-violet-400 mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            思考过程
                          </div>
                          <div className="bg-violet-950/30 border border-violet-900/30 rounded-md p-3 text-xs text-violet-200/80 font-mono whitespace-pre-wrap leading-relaxed">
                            {log.thinking}
                          </div>
                        </div>
                      )}

                      {/* 输入 */}
                      {log.input && (
                        <div>
                          <div className="text-xs font-medium text-slate-400 mb-1.5">
                            输入
                          </div>
                          <div className="bg-slate-800/50 rounded-md p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {log.input}
                          </div>
                        </div>
                      )}

                      {/* 输出 */}
                      {log.output && (
                        <div>
                          <div className="text-xs font-medium text-slate-400 mb-1.5">
                            输出
                          </div>
                          <div className="bg-slate-800/50 rounded-md p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {log.output}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function getCurrentStage(logs: AgentLog[]): PipelineStage {
  if (logs.length === 0) return 'plan';
  const lastLog = logs[logs.length - 1];
  if (lastLog.status === 'running') return lastLog.stage;
  const stageIndex = STAGE_ORDER.indexOf(lastLog.stage);
  if (stageIndex < STAGE_ORDER.length - 1 && lastLog.status === 'done') {
    return STAGE_ORDER[stageIndex + 1];
  }
  return lastLog.stage;
}
