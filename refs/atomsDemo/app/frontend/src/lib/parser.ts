/**
 * LLM 输出解析层。
 *
 * 硬性约定：必须**先收集完整输出**再进入本模块解析，
 * 禁止在流式过程中实时 split（会导致分隔符截断 / 内容丢失）。
 *
 * 三层降级策略：
 *   1. `--index.html--` / `----index.html----` 分隔符格式
 *   2. markdown 代码块（```html / ```css / ```js，或带文件名注释）
 *   3. 整体 HTML（从单个 HTML 文档中抽出 <style> 与 <script>）
 */

import { FILE_NAMES, emptyFiles, type AppFiles, type FileName } from './db';

export interface ParseResult {
  files: Partial<AppFiles>;
  /** 命中的解析层级，用于日志展示 */
  strategy: 'separator' | 'markdown' | 'wholeHtml' | 'none';
  /** 代码块之前的自然语言说明 */
  prose: string;
}

const FILE_ALIASES: Record<string, FileName> = {
  'index.html': 'index.html',
  'index.htm': 'index.html',
  html: 'index.html',
  'style.css': 'style.css',
  'styles.css': 'style.css',
  css: 'style.css',
  'app.js': 'app.js',
  'script.js': 'app.js',
  'main.js': 'app.js',
  js: 'app.js',
  javascript: 'app.js',
};

function normalizeFileName(raw: string): FileName | null {
  const key = raw.trim().toLowerCase().replace(/^\.\//, '');
  return FILE_ALIASES[key] ?? null;
}

function stripFence(code: string): string {
  return code
    .replace(/^```[a-zA-Z0-9]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/** 第一层：分隔符格式 `--index.html--`，允许 2~6 个连字符。 */
function parseBySeparator(raw: string): { files: Partial<AppFiles>; prose: string } | null {
  const pattern = /^[ \t]*-{2,6}\s*([A-Za-z0-9._/-]+?)\s*-{2,6}[ \t]*$/gm;
  const marks: { name: FileName; start: number; end: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const name = normalizeFileName(match[1]);
    if (name) {
      marks.push({ name, start: match.index, end: match.index + match[0].length });
    }
  }
  if (marks.length === 0) return null;

  const files: Partial<AppFiles> = {};
  marks.forEach((mark, index) => {
    const sliceEnd = index + 1 < marks.length ? marks[index + 1].start : raw.length;
    const body = stripFence(raw.slice(mark.end, sliceEnd));
    if (body) files[mark.name] = body;
  });

  if (Object.keys(files).length === 0) return null;
  return { files, prose: raw.slice(0, marks[0].start).trim() };
}

/** 第二层：markdown 代码块。 */
function parseByMarkdown(raw: string): { files: Partial<AppFiles>; prose: string } | null {
  const pattern = /```([A-Za-z0-9._+-]*)[^\S\n]*\n([\s\S]*?)```/g;
  const files: Partial<AppFiles> = {};
  let firstIndex = -1;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const lang = match[1].trim().toLowerCase();
    const body = match[2].trim();
    if (!body) continue;
    if (firstIndex < 0) firstIndex = match.index;

    // 优先看 fence 上的语言/文件名
    let target = normalizeFileName(lang);

    // 其次看代码块前一行是否写了文件名
    if (!target) {
      const before = raw.slice(0, match.index).trimEnd();
      const lastLine = before.split('\n').pop() ?? '';
      const nameHit = lastLine.match(/([A-Za-z0-9._-]+\.(?:html|css|js))/i);
      if (nameHit) target = normalizeFileName(nameHit[1]);
    }

    // 最后按内容特征推断
    if (!target) {
      if (/<!DOCTYPE html|<html[\s>]/i.test(body)) target = 'index.html';
      else if (/^[\s\S]*\{[\s\S]*:[\s\S]*;[\s\S]*\}/.test(body) && !/function|=>|const |let /.test(body)) {
        target = 'style.css';
      } else target = 'app.js';
    }

    if (target && !files[target]) files[target] = body;
  }

  if (Object.keys(files).length === 0) return null;
  return { files, prose: firstIndex > 0 ? raw.slice(0, firstIndex).trim() : '' };
}

/** 第三层：整体 HTML —— 从完整文档中抽离 style 与 script。 */
function parseByWholeHtml(raw: string): { files: Partial<AppFiles>; prose: string } | null {
  const htmlStart = raw.search(/<!DOCTYPE html|<html[\s>]/i);
  if (htmlStart < 0) return null;

  let html = raw.slice(htmlStart).trim();
  const prose = raw.slice(0, htmlStart).trim();

  const styles: string[] = [];
  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_full, body: string) => {
    styles.push(body.trim());
    return '<link rel="stylesheet" href="style.css">';
  });

  const scripts: string[] = [];
  html = html.replace(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
    (_full, body: string) => {
      const code = body.trim();
      if (!code) return '';
      scripts.push(code);
      return '<script src="app.js"></script>';
    },
  );

  return {
    files: {
      'index.html': html,
      'style.css': styles.join('\n\n'),
      'app.js': scripts.join('\n\n'),
    },
    prose,
  };
}

/** 主入口：按三层降级顺序解析完整输出。 */
export function parseGeneratedFiles(raw: string): ParseResult {
  const text = (raw ?? '').replace(/\r\n/g, '\n');
  if (!text.trim()) return { files: {}, strategy: 'none', prose: '' };

  const separator = parseBySeparator(text);
  if (separator) return { ...separator, strategy: 'separator' };

  const markdown = parseByMarkdown(text);
  if (markdown) return { ...markdown, strategy: 'markdown' };

  const whole = parseByWholeHtml(text);
  if (whole) return { ...whole, strategy: 'wholeHtml' };

  return { files: {}, strategy: 'none', prose: text.trim() };
}

/** 把解析结果合并到已有文件上（用于对话式增量修改）。 */
export function mergeFiles(base: AppFiles, patch: Partial<AppFiles>): AppFiles {
  const next: AppFiles = { ...base };
  FILE_NAMES.forEach((name) => {
    const value = patch[name];
    if (typeof value === 'string' && value.trim()) next[name] = value;
  });
  return next;
}

/** 判断三件套是否已经具备可运行的最小内容。 */
export function hasRunnableFiles(files: Partial<AppFiles>): boolean {
  return Boolean(files['index.html'] && files['index.html'].trim().length > 30);
}

export function ensureFiles(files: Partial<AppFiles>): AppFiles {
  return mergeFiles(emptyFiles(), files);
}

/**
 * 剥离代码块后的纯文本，用于写入对话历史，避免上下文膨胀。
 */
export function stripCodeBlocks(raw: string): string {
  let text = (raw ?? '').replace(/\r\n/g, '\n');

  // 去掉 markdown 代码块
  text = text.replace(/```[\s\S]*?```/g, '');
  // 去掉未闭合的尾部代码块
  text = text.replace(/```[\s\S]*$/g, '');
  // 去掉分隔符及其之后的所有内容（约定代码后不再有正文）
  const sepIndex = text.search(/^[ \t]*-{2,6}\s*[A-Za-z0-9._/-]+\s*-{2,6}[ \t]*$/m);
  if (sepIndex >= 0) text = text.slice(0, sepIndex);
  // 去掉裸 HTML 文档
  const htmlIndex = text.search(/<!DOCTYPE html|<html[\s>]/i);
  if (htmlIndex >= 0) text = text.slice(0, htmlIndex);

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** 从 LLM 输出中提取第一个 JSON 对象（蓝图解析用）。 */
export function extractJsonObject(raw: string): unknown | null {
  const text = (raw ?? '').trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1].trim());

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // 尝试下一个候选
    }
  }
  return null;
}