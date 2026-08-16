import { emptyFiles, isFullDocument, splitDocument, type CodeFiles } from './codeFiles';

export type ParseStrategy = 'delimiter' | 'markdown' | 'raw';

export const STRATEGY_LABEL: Record<ParseStrategy, string> = {
  delimiter: '分隔符解析',
  markdown: 'Markdown 代码块',
  raw: '整体 HTML 兜底',
};

export interface ParsedCode {
  /** 三文件结构产物 */
  files: CodeFiles;
  /** 实际生效的解析层级 */
  strategy: ParseStrategy;
  /** 命中的片段名称，用于展示解析细节 */
  parts: string[];
}

const DELIMITER_RE = /^\s*-{2,}\s*([\w.\-/]+)\s*-{2,}\s*$/;

/**
 * 三层降级解析，任意一层成功即停止：
 * 1. `--index.html--` / `--style.css--` / `--app.js--` 分隔符标记
 * 2. Markdown 代码块（html / css / javascript）
 * 3. 整个输出作为完整 HTML 文档
 * 最终统一归一化为三文件结构：若模型只给了单文件，会自动拆出 css / js。
 */
export function parseGeneratedCode(raw: string): ParsedCode {
  const text = (raw || '').trim();
  if (!text) {
    return { files: emptyFiles(), strategy: 'raw', parts: [] };
  }

  const byDelimiter = parseByDelimiter(text);
  if (byDelimiter) return byDelimiter;

  const byMarkdown = parseByMarkdown(text);
  if (byMarkdown) return byMarkdown;

  return {
    files: normalize(stripFences(text), '', ''),
    strategy: 'raw',
    parts: ['整段输出'],
  };
}

/**
 * 归一化为三文件：
 * - 模型给了完整文档且未单独给 css/js → 拆分内联块
 * - 模型分别给了三段 → 直接采用，仅补齐 HTML 外壳
 */
function normalize(html: string, css: string, js: string): CodeFiles {
  if (html && isFullDocument(html) && !css && !js) {
    return splitDocument(html);
  }
  if (html && isFullDocument(html)) {
    // 文档内可能仍有内联块，先拆出来再与显式片段合并
    const split = splitDocument(html);
    return {
      html: split.html,
      css: [split.css, css].filter(Boolean).join('\n\n'),
      js: [split.js, js].filter(Boolean).join('\n\n'),
    };
  }
  return { html: wrapFragment(html), css, js };
}

/** 片段化 HTML 补齐成完整文档外壳，并声明对 style.css / app.js 的引用 */
function wrapFragment(fragment: string): string {
  const body = fragment.trim() || '<main><p>未生成页面结构。</p></main>';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Atoms App</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
${body}
<script src="app.js"></script>
</body>
</html>`;
}

function parseByDelimiter(text: string): ParsedCode | null {
  const lines = text.split(/\r?\n/);
  const buckets: Record<string, string[]> = {};
  let current: string | null = null;

  lines.forEach((line) => {
    const match = line.match(DELIMITER_RE);
    if (match) {
      current = match[1].toLowerCase();
      buckets[current] = buckets[current] ?? [];
      return;
    }
    if (current) buckets[current].push(line);
  });

  const keys = Object.keys(buckets);
  if (!keys.length) return null;

  const pick = (...candidates: string[]) => {
    const key = keys.find((k) => candidates.some((c) => k.includes(c)));
    return key ? stripFences(buckets[key].join('\n').trim()) : '';
  };

  const html = pick('index.html', '.html', 'html');
  const css = pick('style.css', '.css', 'css');
  const js = pick('app.js', '.js', 'javascript', 'script');

  if (!html && !css && !js) return null;

  return { files: normalize(html, css, js), strategy: 'delimiter', parts: keys };
}

function parseByMarkdown(text: string): ParsedCode | null {
  const blockRe = /```([a-zA-Z0-9+#]*)\s*\n([\s\S]*?)```/g;
  const blocks: Array<{ lang: string; code: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(text)) !== null) {
    blocks.push({ lang: (match[1] || '').toLowerCase(), code: match[2].trim() });
  }
  if (!blocks.length) return null;

  const find = (langs: string[]) => blocks.find((b) => langs.includes(b.lang))?.code ?? '';
  let html = find(['html', 'xml', 'markup']);
  const css = find(['css', 'scss']);
  const js = find(['javascript', 'js', 'jsx', 'ts', 'typescript']);

  if (!html && !css && !js) {
    const longest = blocks.reduce((a, b) => (b.code.length > a.code.length ? b : a), blocks[0]);
    html = longest.code;
  }
  if (!html && !css && !js) return null;

  return {
    files: normalize(html, css, js),
    strategy: 'markdown',
    parts: blocks.map((b) => b.lang || 'plain'),
  };
}

function stripFences(text: string): string {
  return text
    .replace(/^```[a-zA-Z0-9+#]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/**
 * 剥离对话历史中的代码块，防止上下文无限膨胀。
 * 保留一行摘要说明这里原本有代码，让模型知道上下文存在但不必重读全文。
 */
export function stripCodeBlocks(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9+#]*\s*\n[\s\S]*?```/g, '［此处省略一段代码］')
    .replace(/^\s*-{2,}\s*[\w.\-/]+\s*-{2,}\s*$[\s\S]*?(?=^\s*-{2,}|\s*$)/gm, '［此处省略一个文件］')
    .replace(/<!DOCTYPE html[\s\S]*?<\/html>/gi, '［此处省略完整 HTML 文档］')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 粗略统计代码规模，用于版本信息展示 */
export function codeMetrics(code: string): { lines: number; kb: number } {
  return {
    lines: code ? code.split('\n').length : 0,
    kb: code ? Math.max(1, Math.round(code.length / 1024)) : 0,
  };
}