import { useMemo, useState } from 'react';
import { Check, Code2, Copy } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  buildEmbedSnippet,
  copyToClipboard,
  DEFAULT_EMBED_HEIGHT,
  embedSizeKb,
  EMBED_SIZE_WARN_KB,
} from '@/lib/embed';
import type { CodeFiles } from '@/lib/codeFiles';

interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: CodeFiles;
  title: string;
}

/** 嵌入代码弹窗：把作品打包成自包含 iframe，可直接贴进博客或文档 */
export default function EmbedDialog({ open, onOpenChange, files, title }: EmbedDialogProps) {
  const [height, setHeight] = useState(DEFAULT_EMBED_HEIGHT);
  const [withCaption, setWithCaption] = useState(true);
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(
    () => buildEmbedSnippet(files, { title, height, withCaption }),
    [files, title, height, withCaption],
  );
  const sizeKb = useMemo(() => embedSizeKb(snippet), [snippet]);
  const oversize = sizeKb > EMBED_SIZE_WARN_KB;

  const handleCopy = async () => {
    const ok = await copyToClipboard(snippet);
    if (ok) {
      setCopied(true);
      toast.success('嵌入代码已复制');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('复制失败，请手动选中代码复制');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            嵌入到其他页面
          </DialogTitle>
          <DialogDescription>
            代码已内联全部 HTML/CSS/JS，粘贴到博客或文档即可离线运行，不依赖本平台。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="embed-height" className="text-xs">
                嵌入高度（px）
              </Label>
              <Input
                id="embed-height"
                type="number"
                min={200}
                max={1200}
                step={20}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) || DEFAULT_EMBED_HEIGHT)}
                className="h-8 w-32 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 pb-1.5">
              <Switch id="embed-caption" checked={withCaption} onCheckedChange={setWithCaption} />
              <Label htmlFor="embed-caption" className="text-xs">
                附带说明文字
              </Label>
            </div>
            <Badge
              variant="outline"
              className={`ml-auto bg-white/60 text-[11px] ${oversize ? 'text-destructive' : ''}`}
            >
              约 {sizeKb} KB
            </Badge>
          </div>

          {oversize && (
            <p className="rounded-lg bg-warm/12 px-3 py-2 text-[11px] leading-relaxed text-warm-foreground">
              代码体积偏大，部分平台的编辑器会限制单段 HTML 长度。如果粘贴后无法保存，建议改用导出
              HTML 文件自行托管。
            </p>
          )}

          <div className="rounded-xl border border-white/70 bg-white/70 p-2">
            <pre className="stream-scroll max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
              {snippet}
            </pre>
          </div>

          <Button className="w-full" onClick={handleCopy}>
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copied ? '已复制到剪贴板' : '复制嵌入代码'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}