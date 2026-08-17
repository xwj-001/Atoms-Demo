/**
 * 确定性代码校验器（测试工程师执行体）。
 *
 * 关键点：这里是**真实的代码执行与静态分析**，不是让 LLM 写一份主观报告。
 * 五项检查：
 *   1. JS 语法        —— new Function 实际编译 app.js
 *   2. HTML 引用完整性 —— JS 中引用的 id / class 是否真实存在于 HTML
 *   3. 交互闭环       —— 是否绑定事件且事件里真的会更新 DOM
 *   4. 数据持久化     —— localStorage 是否同时有读与写
 *   5. HTML 结构      —— DOCTYPE / html / body / link / script 引用
 */

import type { AppFiles } from '../db';

export interface CheckItem {
  key: 'jsSyntax' | 'htmlRefs' | 'interaction' | 'persistence' | 'htmlStructure';
  name: string;
  passed: boolean;
  /** 通过或失败的具体说明 */
  detail: string;
  /** 该项检查产生的缺陷描述（供开发工程师修复） */
  defects: string[];
}

export interface ValidationReport {
  passed: boolean;
  checks: CheckItem[];
  defects: string[];
  /** 通过项数量 / 总项数 */
  score: string;
  summary: string;
}

/** 去掉 JS 里的注释与字符串，避免误判。 */
function stripJsNoise(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

/* ------------------------------------------------------------------ */
/* 1. JS 语法检查                                                      */
/* ------------------------------------------------------------------ */

function checkJsSyntax(files: AppFiles): CheckItem {
  const code = (files['app.js'] || '').trim();
  const item: CheckItem = {
    key: 'jsSyntax',
    name: 'JS 语法',
    passed: false,
    detail: '',
    defects: [],
  };

  if (!code) {
    item.detail = 'app.js 为空，应用不具备任何行为';
    item.defects.push('app.js 内容为空，请实现完整的应用逻辑');
    return item;
  }

  try {
    // 仅编译不执行：能构造成功即语法合法
    // eslint-disable-next-line no-new-func
    new Function(code);
    item.passed = true;
    item.detail = `app.js 语法检查通过（${code.length} 字符）`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    item.detail = `app.js 存在语法错误：${message}`;
    item.defects.push(`app.js 存在 JavaScript 语法错误：${message}，请修正语法`);
  }
  return item;
}

/* ------------------------------------------------------------------ */
/* 2. HTML 引用完整性                                                  */
/* ------------------------------------------------------------------ */

function collectHtmlIds(html: string): Set<string> {
  const ids = new Set<string>();
  const pattern = /\bid\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) ids.add(match[1].trim());
  return ids;
}

function collectHtmlClasses(html: string): Set<string> {
  const classes = new Set<string>();
  const pattern = /\bclass\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    match[1]
      .split(/\s+/)
      .filter(Boolean)
      .forEach((name) => classes.add(name));
  }
  return classes;
}

function checkHtmlRefs(files: AppFiles): CheckItem {
  const html = files['index.html'] || '';
  const js = files['app.js'] || '';
  const item: CheckItem = {
    key: 'htmlRefs',
    name: 'HTML 引用完整性',
    passed: false,
    detail: '',
    defects: [],
  };

  if (!html.trim()) {
    item.detail = 'index.html 为空';
    item.defects.push('index.html 内容为空，请生成完整页面结构');
    return item;
  }

  const ids = collectHtmlIds(html);
  const classes = collectHtmlClasses(html);
  const missingIds: string[] = [];
  const missingClasses: string[] = [];

  // getElementById('x')
  const idPattern = /getElementById\(\s*["']([^"']+)["']\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = idPattern.exec(js)) !== null) {
    const id = match[1].trim();
    if (id && !ids.has(id) && !missingIds.includes(id)) missingIds.push(id);
  }

  // querySelector('#x') / querySelectorAll('.y')
  const selectorPattern = /querySelector(?:All)?\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = selectorPattern.exec(js)) !== null) {
    const selector = match[1].trim();
    // 只校验最简单的单一 id/class 选择器，复合选择器跳过避免误报
    if (/^#[A-Za-z0-9_-]+$/.test(selector)) {
      const id = selector.slice(1);
      if (!ids.has(id) && !missingIds.includes(id)) missingIds.push(id);
    } else if (/^\.[A-Za-z0-9_-]+$/.test(selector)) {
      const cls = selector.slice(1);
      if (!classes.has(cls) && !missingClasses.includes(cls)) missingClasses.push(cls);
    }
  }

  const totalRefs = (js.match(/getElementById\(/g) || []).length;
  if (missingIds.length === 0 && missingClasses.length === 0) {
    item.passed = true;
    item.detail =
      totalRefs > 0
        ? `JS 中 ${totalRefs} 处元素引用全部在 HTML 中存在`
        : 'JS 未使用 id 引用，无缺失引用';
  } else {
    const parts: string[] = [];
    if (missingIds.length) parts.push(`缺失 id：${missingIds.join(', ')}`);
    if (missingClasses.length) parts.push(`缺失 class：${missingClasses.join(', ')}`);
    item.detail = parts.join('；');
    if (missingIds.length) {
      item.defects.push(
        `app.js 中引用了 HTML 里不存在的元素 id：${missingIds.join(', ')}。请在 index.html 中补充这些元素，或修正 JS 中的 id`,
      );
    }
    if (missingClasses.length) {
      item.defects.push(
        `app.js 中引用了 HTML 里不存在的 class：${missingClasses.join(', ')}。请补充对应元素或修正选择器`,
      );
    }
  }
  return item;
}

/* ------------------------------------------------------------------ */
/* 3. 交互闭环                                                         */
/* ------------------------------------------------------------------ */

function checkInteraction(files: AppFiles): CheckItem {
  const js = stripJsNoise(files['app.js'] || '');
  const html = files['index.html'] || '';
  const item: CheckItem = {
    key: 'interaction',
    name: '交互闭环',
    passed: false,
    detail: '',
    defects: [],
  };

  const hasListener = /addEventListener\s*\(/.test(js) || /\bon(?:click|change|input|submit)\s*=/.test(js);
  const hasInlineHandler = /\bon(?:click|change|input|submit)\s*=\s*["']/.test(html);
  const hasDomWrite =
    /\.(?:innerHTML|textContent|innerText|value)\s*=/.test(js) ||
    /(?:appendChild|removeChild|insertAdjacentHTML|createElement|classList\.(?:add|remove|toggle))\s*\(/.test(js);
  const hasStateChange =
    /\b(?:push|unshift|splice|filter|map|concat|pop|shift)\s*\(/.test(js);

  const problems: string[] = [];
  if (!hasListener && !hasInlineHandler) problems.push('未发现任何事件绑定');
  if (!hasDomWrite) problems.push('未发现更新 DOM 的代码');
  if (!hasStateChange) problems.push('未发现修改数据集合的代码');

  if (problems.length === 0) {
    item.passed = true;
    item.detail = '已形成「事件绑定 → 数据变更 → DOM 更新」的完整交互闭环';
  } else {
    item.detail = problems.join('；');
    item.defects.push(
      `交互闭环不完整（${problems.join('；')}）。请为按钮等控件绑定事件，在事件里修改数据数组并重新渲染 DOM`,
    );
  }
  return item;
}

/* ------------------------------------------------------------------ */
/* 4. 数据持久化                                                       */
/* ------------------------------------------------------------------ */

function checkPersistence(files: AppFiles): CheckItem {
  const js = stripJsNoise(files['app.js'] || '');
  const item: CheckItem = {
    key: 'persistence',
    name: '数据持久化',
    passed: false,
    detail: '',
    defects: [],
  };

  const hasWrite = /localStorage\.setItem\s*\(/.test(js);
  const hasRead = /localStorage\.getItem\s*\(/.test(js);
  const hasGuard = /try\s*\{/.test(js);

  if (hasWrite && hasRead) {
    item.passed = true;
    item.detail = hasGuard
      ? 'localStorage 读写齐备，并已用 try/catch 保护'
      : 'localStorage 读写齐备（建议补充 try/catch）';
  } else {
    const problems: string[] = [];
    if (!hasWrite) problems.push('缺少 localStorage.setItem 写入');
    if (!hasRead) problems.push('缺少 localStorage.getItem 读取');
    item.detail = problems.join('；');
    item.defects.push(
      `数据持久化未闭环（${problems.join('；')}）。请在数据变更后写入 localStorage，并在页面初始化时读取，用 try/catch 包裹`,
    );
  }
  return item;
}

/* ------------------------------------------------------------------ */
/* 5. HTML 结构                                                        */
/* ------------------------------------------------------------------ */

function checkHtmlStructure(files: AppFiles): CheckItem {
  const html = files['index.html'] || '';
  const item: CheckItem = {
    key: 'htmlStructure',
    name: 'HTML 结构',
    passed: false,
    detail: '',
    defects: [],
  };

  const problems: string[] = [];
  if (!/<!DOCTYPE\s+html/i.test(html)) problems.push('缺少 <!DOCTYPE html>');
  if (!/<html[\s>]/i.test(html)) problems.push('缺少 <html> 标签');
  if (!/<head[\s>]/i.test(html)) problems.push('缺少 <head> 标签');
  if (!/<body[\s>]/i.test(html)) problems.push('缺少 <body> 标签');
  if (!/<title[\s>]/i.test(html)) problems.push('缺少 <title> 标签');
  if (!/<meta[^>]+viewport/i.test(html)) problems.push('缺少 viewport meta');

  const hasCss = Boolean((files['style.css'] || '').trim());
  if (hasCss && !/<link[^>]+style\.css/i.test(html) && !/<style[\s>]/i.test(html)) {
    problems.push('未引用 style.css');
  }
  const hasJs = Boolean((files['app.js'] || '').trim());
  if (hasJs && !/<script[^>]+app\.js/i.test(html) && !/<script[\s>]/i.test(html)) {
    problems.push('未引用 app.js');
  }

  if (problems.length === 0) {
    item.passed = true;
    item.detail = 'DOCTYPE、head/body、title、viewport 与样式脚本引用均完整';
  } else {
    item.detail = problems.join('；');
    item.defects.push(`index.html 结构不完整（${problems.join('；')}），请补齐这些结构`);
  }
  return item;
}

/* ------------------------------------------------------------------ */
/* 主入口                                                             */
/* ------------------------------------------------------------------ */

/** 执行五项确定性检查并汇总测试报告。 */
export function validateFiles(files: AppFiles): ValidationReport {
  const checks: CheckItem[] = [
    checkJsSyntax(files),
    checkHtmlRefs(files),
    checkInteraction(files),
    checkPersistence(files),
    checkHtmlStructure(files),
  ];

  const defects = checks.flatMap((item) => item.defects);
  const passedCount = checks.filter((item) => item.passed).length;
  const passed = passedCount === checks.length;

  const summary = passed
    ? `五项检查全部通过（${passedCount}/${checks.length}），应用可正常运行。`
    : `${passedCount}/${checks.length} 项通过，发现 ${defects.length} 个缺陷：${checks
        .filter((item) => !item.passed)
        .map((item) => item.name)
        .join('、')}。`;

  return {
    passed,
    checks,
    defects,
    score: `${passedCount}/${checks.length}`,
    summary,
  };
}

/** 把报告格式化成可读文本，用于日志展示。 */
export function formatReport(report: ValidationReport): string {
  const lines = [`测试结论：${report.passed ? '通过' : '未通过'}（${report.score}）`, ''];
  report.checks.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.passed ? '✓' : '✗'}] ${item.name}：${item.detail}`);
  });
  if (report.defects.length) {
    lines.push('', '缺陷清单：');
    report.defects.forEach((defect, index) => lines.push(`  ${index + 1}) ${defect}`));
  }
  return lines.join('\n');
}