import { Brain, Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { ThoughtStage } from '@/lib/llm';

interface ThoughtChainPanelProps {
  open: boolean;
  onToggle: () => void;
  stages: ThoughtStage[];
  busy: boolean;
}

/** 左侧下方的思维链面板，默认展开显示简要状态 */
export default function ThoughtChainPanel({
  open,
  onToggle,
  stages,
  busy,
}: ThoughtChainPanelProps) {
  const doneCount = stages.filter((s) => s.status === 'done').length;
  const running = stages.find((s) => s.status === 'running');
  const started = stages.some((s) => s.status !== 'pending');

  const summary = busy
    ? running
      ? `正在推理：${running.title}（${doneCount}/${stages.length} 已完成）`
      : `推理中（${doneCount}/${stages.length} 已完成）`
    : started
      ? `四个阶段已完成，点击任一阶段查看推理摘要`
      : '发起生成后，这里会实时展示 AI 的思考过程';

  return (
    <section className="glass shrink-0 overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200 ease-out-quart hover:bg-white/40"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">思维链</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out-quart ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-white/60 p-3">
          <div className="mb-3 flex items-center gap-1">
            {stages.map((stage, index) => (
              <div key={stage.key} className="flex flex-1 items-center gap-1">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold transition-colors duration-300 ${
                    stage.status === 'done'
                      ? 'bg-primary text-primary-foreground'
                      : stage.status === 'running'
                        ? 'bg-primary/20 text-primary animate-breathe'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stage.status === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                {index < stages.length - 1 && (
                  <span
                    className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                      stage.status === 'done' ? 'bg-primary/45' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <Accordion type="multiple" className="space-y-1.5">
            {stages.map((stage) => (
              <AccordionItem
                key={stage.key}
                value={stage.key}
                className="glass-soft rounded-xl border-none px-3"
              >
                <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{stage.title}</span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        stage.status === 'done'
                          ? 'bg-primary/12 text-primary'
                          : stage.status === 'running'
                            ? 'bg-warm/15 text-warm-foreground'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {stage.status === 'done' ? '已完成' : stage.status === 'running' ? '推理中' : '待开始'}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="whitespace-pre-wrap pb-3 text-xs leading-relaxed text-muted-foreground">
                  {stage.content || '等待这一阶段开始…'}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </section>
  );
}