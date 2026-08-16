import { Loader2, Sparkles, Square, Wand2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { STYLE_DESC, STYLE_LABEL, STYLE_ORDER, type StyleTag } from '@/lib/db';
import { MODE_META, type StudioSettings } from '@/lib/settings';
import { PRESET_TEMPLATES } from '@/lib/templates';

interface ControlPanelProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  style: StyleTag;
  onStyleChange: (style: StyleTag) => void;
  onQuickTemplate: (description: string, style: StyleTag) => void;
  onGenerate: () => void;
  onCancel: () => void;
  busy: boolean;
  settings: StudioSettings;
  statusText: string;
}

/** 左侧控制区：快速模板 + 需求输入 + 风格选择 + 生成 */
export default function ControlPanel({
  description,
  onDescriptionChange,
  style,
  onStyleChange,
  onQuickTemplate,
  onGenerate,
  onCancel,
  busy,
  settings,
  statusText,
}: ControlPanelProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!busy && description.trim()) onGenerate();
    }
  };

  return (
    <section className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center gap-2 border-b border-white/60 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <Wand2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">描述你的应用</h2>
          <p className="truncate text-xs text-muted-foreground">选一个风格，看着它被一步步构建出来</p>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1 bg-white/50 text-[11px]">
          <Zap className="h-3 w-3 text-primary" />
          {MODE_META[settings.mode].label}
        </Badge>
      </header>

      <div className="stream-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            快速模板
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={busy}
                onClick={() => onQuickTemplate(template.description, template.recommendedStyle)}
                className="rounded-full border border-border bg-white/60 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out-quart hover:bg-accent/60 disabled:opacity-50"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            需求描述
          </p>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="例如：帮我生成一个待办事项管理应用，可以添加、勾选和删除任务"
            rows={5}
            className="resize-none bg-white/60 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Ctrl / ⌘ + Enter 快速生成</p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            风格
          </p>
          <div className="grid gap-2">
            {STYLE_ORDER.map((tag) => {
              const active = style === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onStyleChange(tag)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3 text-left transition-all duration-200 ease-out-quart ${
                    active
                      ? 'border-primary/45 bg-primary/[0.09] shadow-sm'
                      : 'border-border bg-white/50 hover:bg-accent/45'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full transition-colors duration-200 ${
                        active ? 'bg-primary' : 'bg-muted-foreground/35'
                      }`}
                    />
                    <span className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>
                      {STYLE_LABEL[tag]}
                    </span>
                  </span>
                  <span className="mt-1 block pl-[1.125rem] text-[11px] leading-relaxed text-muted-foreground">
                    {STYLE_DESC[tag]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {statusText && (
          <p className="glass-soft animate-fade-up rounded-xl px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {statusText}
          </p>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-white/60 p-3">
        <Button className="flex-1" disabled={busy || !description.trim()} onClick={onGenerate}>
          {busy ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              生成中
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              生成应用
            </>
          )}
        </Button>
        {busy && (
          <Button variant="outline" size="icon" onClick={onCancel} aria-label="停止生成">
            <Square className="h-4 w-4" />
          </Button>
        )}
      </footer>
    </section>
  );
}