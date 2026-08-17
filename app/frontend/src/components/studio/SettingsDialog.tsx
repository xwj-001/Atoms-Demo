import { useEffect, useState } from 'react';
import { Check, Gauge, KeyRound, Settings2, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ATOMS_MODEL,
  ATOMS_MODELS,
  BASIC_CHECK_ITEMS,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  DEEPSEEK_MODELS,
  DEFAULT_SETTINGS,
  MODE_META,
  OPENAI_PRESETS,
  isAtomsModel,
  isDeepSeekModel,
  matchOpenAiPreset,
  QUALITY_LEVELS,
  QUALITY_META,
  saveSettings,
  type LlmMode,
  type StudioSettings,
} from '@/lib/settings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: StudioSettings;
  onSettingsChange: (settings: StudioSettings) => void;
}

const MODES: LlmMode[] = ['deepseek', 'atoms', 'openai', 'mock'];

/**
 * 右上角设置入口。
 * deepseek 模式使用自备 DeepSeek 账号（密钥在服务端环境变量里）；atoms 模式从平台白名单里选模型；
 * openai 模式可一键套用常见兼容端点（DeepSeek / Kimi / 通义等），也可以手填任意 Base URL 与模型名。
 */
export default function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState<StudioSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const activePreset = matchOpenAiPreset(draft.baseUrl);

  const handleSave = () => {
    if (draft.mode === 'openai') {
      if (!draft.apiKey.trim()) {
        toast.error('OpenAI 兼容模式需要填写 API Key');
        return;
      }
      if (!draft.model.trim()) {
        toast.error('请填写要调用的模型名称');
        return;
      }
    }
    const next: StudioSettings = {
      ...draft,
      deepseekModel: isDeepSeekModel(draft.deepseekModel) ? draft.deepseekModel.trim() : DEEPSEEK_MODEL,
      atomsModel: isAtomsModel(draft.atomsModel) ? draft.atomsModel : ATOMS_MODEL,
      apiKey: draft.apiKey.trim(),
      baseUrl: draft.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl,
      model: draft.model.trim() || DEFAULT_SETTINGS.model,
    };
    saveSettings(next);
    onSettingsChange(next);
    onOpenChange(false);
    const modelText =
      next.mode === 'deepseek'
        ? DEEPSEEK_MODELS.find((m) => m.id === next.deepseekModel)?.label || next.deepseekModel
        : next.mode === 'atoms'
          ? ATOMS_MODELS.find((m) => m.id === next.atomsModel)?.label
          : next.mode === 'openai'
            ? next.model
            : '';
    toast.success(
      modelText
        ? `已切换到「${MODE_META[next.mode].label} · ${modelText}」`
        : `已切换到「${MODE_META[next.mode].label}」`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            设置
          </DialogTitle>
          <DialogDescription>
            配置模型调用方式。所有设置只保存在你的浏览器 localStorage 中。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              运行模式
            </Label>
            <div className="grid gap-2">
              {MODES.map((mode) => {
                const active = draft.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, mode }))}
                    aria-pressed={active}
                    className={`rounded-xl border p-3 text-left transition-all duration-200 ease-out-quart ${
                      active
                        ? 'border-primary/45 bg-primary/[0.08] shadow-sm'
                        : 'border-border bg-white/50 hover:bg-accent/45'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          active ? 'bg-primary' : 'bg-muted-foreground/35'
                        }`}
                      />
                      <span className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>
                        {MODE_META[mode].label}
                      </span>
                      {mode === 'deepseek' && (
                        <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          默认
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block pl-[1.125rem] text-[11px] leading-relaxed text-muted-foreground">
                      {MODE_META[mode].desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Gauge className="h-3 w-3 text-primary" />
              质量校验强度
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {QUALITY_LEVELS.map((level) => {
                const active = draft.qualityLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, qualityLevel: level }))}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ease-out-quart ${
                      active
                        ? 'border-primary/45 bg-primary/[0.1] text-primary'
                        : 'border-border bg-white/55 text-foreground hover:bg-accent/45'
                    }`}
                  >
                    {QUALITY_META[level].label}
                    {QUALITY_META[level].badge ? ` · ${QUALITY_META[level].badge}` : ''}
                  </button>
                );
              })}
            </div>
            <p className="glass-soft rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {QUALITY_META[draft.qualityLevel].desc}本档位最多 {' '}
              {QUALITY_META[draft.qualityLevel].maxAttempts} 轮生成。静态校验本身只需几毫秒，
              等待主要来自未通过后的自动重修轮次。
            </p>
          </div>

          <div className="glass-soft flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Zap className="h-3 w-3 text-primary" />
                模板优先（命中即秒出）
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                首次需求命中内置模板关键词（待办、番茄钟等）时直接交付预置代码，跳过模型调用。
                整条链路最慢的一环是模型往返，命中后基本无需等待。迭代与修复仍走模型。
              </p>
            </div>
            <Switch
              checked={draft.templateFirst}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, templateFirst: checked }))
              }
              aria-label="模板优先"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-primary" />
              静态校验项
            </Label>
            <p className="glass-soft rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              只保留 {BASIC_CHECK_ITEMS.length} 项硬性检查：{BASIC_CHECK_ITEMS.join(' · ')}
              。交互闭环、数据持久化与占位文案检测已移除——它们对纯展示、纯计算类页面本来就不适用，
              既会误报也会触发多余的自动重修轮次。
            </p>
          </div>

          {draft.mode === 'deepseek' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                DeepSeek 模型
              </Label>
              <div className="grid gap-2">
                {DEEPSEEK_MODELS.map((model) => {
                  const active = draft.deepseekModel === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, deepseekModel: model.id }))}
                      aria-pressed={active}
                      className={`rounded-xl border p-2.5 text-left transition-all duration-200 ease-out-quart ${
                        active
                          ? 'border-primary/45 bg-primary/[0.08] shadow-sm'
                          : 'border-border bg-white/50 hover:bg-accent/45'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>
                          {model.label}
                        </span>
                        {model.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                        {active && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                        {model.desc}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">
                        {model.id}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="glass-soft rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                上游端点 <span className="font-mono">{DEEPSEEK_BASE_URL}</span>，请求由后端代理转发，
                API Key 保存在服务端环境变量中，浏览器不接触密钥。若所选模型未在账号上开通，
                后端会自动改用 <span className="font-mono">deepseek-chat</span> 重试。
              </p>
            </div>
          )}

          {draft.mode === 'atoms' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                平台模型
              </Label>
              <div className="grid gap-2">
                {ATOMS_MODELS.map((model) => {
                  const active = draft.atomsModel === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, atomsModel: model.id }))}
                      aria-pressed={active}
                      className={`rounded-xl border p-2.5 text-left transition-all duration-200 ease-out-quart ${
                        active
                          ? 'border-primary/45 bg-primary/[0.08] shadow-sm'
                          : 'border-border bg-white/50 hover:bg-accent/45'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>
                          {model.label}
                        </span>
                        {model.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                        {active && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                        {model.desc}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">
                        {model.id}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="glass-soft rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                请求由后端代理转发，前端不持有任何密钥。若所选模型不在服务端白名单内，后端会自动回落到默认模型。
              </p>
            </div>
          )}

          {draft.mode === 'openai' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  端点预设
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {OPENAI_PRESETS.map((preset) => {
                    const active = activePreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            baseUrl: preset.baseUrl,
                            model: preset.model,
                          }))
                        }
                        aria-pressed={active}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ease-out-quart ${
                          active
                            ? 'border-primary/45 bg-primary/[0.1] text-primary'
                            : 'border-border bg-white/55 text-foreground hover:bg-accent/45'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {activePreset
                    ? activePreset.hint
                    : '点选预设可自动填好 Base URL 与常用模型名，也可以完全手填任意兼容端点。'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="api-key" className="text-xs font-semibold">
                  API Key
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="api-key"
                    type="password"
                    value={draft.apiKey}
                    onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="bg-white/60 pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="base-url" className="text-xs font-semibold">
                  API Base URL
                </Label>
                <Input
                  id="base-url"
                  value={draft.baseUrl}
                  onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.deepseek.com/v1"
                  className="bg-white/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model" className="text-xs font-semibold">
                  模型名称
                </Label>
                <Input
                  id="model"
                  value={draft.model}
                  onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                  placeholder="deepseek-chat"
                  className="bg-white/60"
                />
              </div>
              <p className="glass-soft rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                需要该端点支持 OpenAI 兼容的 <span className="font-mono">/chat/completions</span>{' '}
                接口。密钥只保存在本机浏览器，请求由浏览器直连，若对方未开放跨域访问可能被浏览器拦下。
              </p>
            </div>
          )}

          {draft.mode !== 'mock' && (
            <div className="glass-soft flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold">调用失败时自动降级</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  模型不可用时改用离线模板，保证演示不中断。
                </p>
              </div>
              <Switch
                checked={draft.autoFallback}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, autoFallback: checked }))
                }
                aria-label="自动降级"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存设置</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}