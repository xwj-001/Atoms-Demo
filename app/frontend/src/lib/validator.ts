import type { CodeFiles } from './codeFiles';

/** 单项检查结果 */
export interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  /** 未通过时的具体问题描述，会回传给生成阶段用于修正 */
  detail: string;
}

export interface ValidationReport {
  passed: boolean;
  checks: CheckResult[];
  /** 未通过项的问题清单，供重新生成时作为修正指令 */
  issues: string[];
}

/**
 * 确定性静态校验，只保留「不通过就等于页面是坏的」三项硬性检查：
 * 1. JS 语法能否编译；2. HTML/CSS/JS 之间的引用是否齐全；3. 文档结构是否完整。
 *
 * 早期版本还带交互闭环、localStorage 持久化与占位文案三项主观判断，
 * 但纯展示、纯计算类页面本来就不需要按钮或本地存储，这些项会稳定误报，
 * 还会触发不必要的「回喂模型定向修复」轮次，是等待时间的主要来源，故已移除。
 * 剩下三项全是正则匹配与一次 `new Function` 编译，毫秒级完成。
 */
export function validateFiles(files: CodeFiles): ValidationReport {
  const checks: CheckResult[] = [
    checkJsSyntax(files),
    checkReferences(files),
    checkHtmlStructure(files),
  ];
  const issues = checks.filter((c) => !c.passed).map((c) => `【${c.label}】${c.detail}`);
  return { passed: issues.length === 0, checks, issues };
}

/* ----------------------------- 1. JS 语法 ----------------------------- */

function checkJsSyntax(files: CodeFiles): CheckResult {
  const base = { id: 'js-syntax', label: 'JS 语法' };
  const js = files.js.trim();
  if (!js) {
    return { ...base, passed: true, detail: '未包含脚本，跳过语法检查。' };
  }
  try {
    // 仅编译不执行，用于捕获语法错误
    new Function(js);
    return { ...base, passed: true, detail: '脚本可正常编译。' };
  } catch (error) {
    const message = (error as Error)?.message || '未知语法错误';
    return {
      ...base,
      passed: false,
      detail: `app.js 存在语法错误，浏览器无法执行：${message}。请修正语法后输出完整文件。`,
    };
  }
}

/* --------------------------- 2. 引用完整性 --------------------------- */

const ID_CALL_RE = /getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const QUERY_ID_RE = /querySelector(?:All)?\(\s*['"`]#([\w-]+)/g;

function collectHtmlIds(html: string): Set<string> {
  const ids = new Set<string>();
  const re = /\bid\s*=\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    ids.add(match[1].trim());
  }
  return ids;
}

function checkReferences(files: CodeFiles): CheckResult {
  const base = { id: 'references', label: '引用完整性' };
  const problems: string[] = [];

  const lower = files.html.toLowerCase();
  if (/href\s*=\s*["'][^"']*style\.css["']/.test(lower) && !files.css.trim()) {
    problems.push('index.html 引用了 style.css，但样式文件为空');
  }
  if (/src\s*=\s*["'][^"']*app\.js["']/.test(lower) && !files.js.trim()) {
    problems.push('index.html 引用了 app.js，但脚本文件为空');
  }
  if (/<(?:link|script)\b[^>]*(?:href|src)\s*=\s*["']https?:\/\//i.test(files.html)) {
    problems.push('存在外部 CDN 依赖，离线环境下会加载失败，请改为内联实现');
  }

  const ids = collectHtmlIds(files.html);
  const referenced = new Set<string>();
  let match: RegExpExecArray | null;
  ID_CALL_RE.lastIndex = 0;
  while ((match = ID_CALL_RE.exec(files.js)) !== null) referenced.add(match[1]);
  QUERY_ID_RE.lastIndex = 0;
  while ((match = QUERY_ID_RE.exec(files.js)) !== null) referenced.add(match[1]);

  const missing = [...referenced].filter((id) => !ids.has(id));
  if (missing.length) {
    problems.push(
      `脚本访问了 HTML 中不存在的元素 id：${missing.slice(0, 6).join('、')}，会导致 null 报错`,
    );
  }

  if (problems.length) {
    return { ...base, passed: false, detail: `${problems.join('；')}。请补齐对应元素或内容。` };
  }
  return { ...base, passed: true, detail: 'HTML、CSS、JS 之间的引用一致，无外部依赖。' };
}

/* ---------------------------- 3. HTML 结构 ---------------------------- */

function checkHtmlStructure(files: CodeFiles): CheckResult {
  const base = { id: 'html-structure', label: 'HTML 结构' };
  const html = files.html.trim();
  if (!html) {
    return { ...base, passed: false, detail: 'index.html 为空，没有任何页面结构。' };
  }

  const problems: string[] = [];
  const lower = html.toLowerCase();
  if (!lower.includes('<!doctype html')) problems.push('缺少 <!DOCTYPE html> 声明');
  if (!lower.includes('<html')) problems.push('缺少 <html> 根元素');
  if (!lower.includes('<head')) problems.push('缺少 <head>');
  if (!lower.includes('<body')) problems.push('缺少 <body>');
  if (!/charset\s*=\s*["']?utf-8/i.test(html)) problems.push('缺少 UTF-8 字符集声明，中文会乱码');
  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
    problems.push('缺少 viewport 声明，移动端显示会异常');
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyInner = (bodyMatch?.[1] ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  const hasTag = /<(main|section|div|ul|table|form|header|h1)\b/i.test(bodyMatch?.[1] ?? '');
  if (!bodyInner && !hasTag) problems.push('<body> 内没有可见内容');

  if (problems.length) {
    return { ...base, passed: false, detail: `${problems.join('；')}。请补齐后输出完整文件。` };
  }
  return { ...base, passed: true, detail: '文档结构完整，包含字符集、viewport 与可见内容。' };
}