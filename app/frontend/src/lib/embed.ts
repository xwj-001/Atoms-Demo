import { renderToHTML, withStorageShim, type CodeFiles } from './codeFiles';

/**
 * 可嵌入片段：把作品打包成一段自包含的 iframe HTML，
 * 直接贴进博客或文档就能运行，不依赖本平台任何接口。
 */
export interface EmbedOptions {
  title: string;
  /** iframe 高度（px） */
  height: number;
  /** 是否附带一行说明与外链提示 */
  withCaption: boolean;
}

export const DEFAULT_EMBED_HEIGHT = 520;

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * srcdoc 内联需要转义双引号，否则会提前闭合属性。
 * 这样整段代码不含外链，复制到任何地方都能独立运行。
 */
function toSrcdoc(html: string): string {
  return html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** 生成可直接粘贴的嵌入代码 */
export function buildEmbedSnippet(files: CodeFiles, options: EmbedOptions): string {
  const { title, height, withCaption } = options;
  // srcdoc iframe 未开 allow-same-origin，读 localStorage 会抛 SecurityError，
  // 生成应用会在初始化时直接崩掉，所以嵌入代码里也内联一份内存存储垫片。
  const doc = withStorageShim(renderToHTML(files));
  const safeTitle = escapeAttr(title || 'Atoms App');
  const safeHeight = Math.min(Math.max(Math.round(height) || DEFAULT_EMBED_HEIGHT, 200), 1200);

  const iframe = `<iframe
  title="${safeTitle}"
  loading="lazy"
  sandbox="allow-scripts allow-forms allow-modals allow-popups"
  style="width:100%;height:${safeHeight}px;border:1px solid #e4e4e7;border-radius:12px;background:#fff"
  srcdoc="${toSrcdoc(doc)}"
></iframe>`;

  if (!withCaption) return iframe;

  return `<figure style="margin:0">
${iframe}
  <figcaption style="margin-top:8px;font:13px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;color:#71717a">
    ${escapeText(title || 'Atoms App')} · 由 Atoms Studio 生成，代码已内联，可离线运行
  </figcaption>
</figure>`;
}

/** 嵌入代码体积，超过 500KB 时提示改用导出文件自托管 */
export function embedSizeKb(snippet: string): number {
  return Math.max(1, Math.round(new Blob([snippet]).size / 1024));
}

export const EMBED_SIZE_WARN_KB = 500;

/** 复制到剪贴板，降级到 execCommand 兼容非安全上下文 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续走降级方案 */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}