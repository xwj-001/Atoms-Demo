/**
 * 渲染器：把 index.html / style.css / app.js 合成单文件 HTML。
 *
 * 两种产物：
 *  - renderToHTML：纯净版，用于导出下载，可脱离平台独立运行，
 *    绝不包含平台自身 UI、日志或通信桥。
 *  - renderForSandbox：预览版，额外注入沙箱通信桥
 *    （error / unhandledrejection / READY / console 劫持 → postMessage）。
 */

import type { AppFiles } from '../db';

const LINK_PATTERN = /<link[^>]*href\s*=\s*["']\.?\/?style\.css["'][^>]*>/i;
const SCRIPT_PATTERN = /<script[^>]*src\s*=\s*["']\.?\/?app\.js["'][^>]*>\s*<\/script>/i;

function fallbackShell(title = 'Generated App'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app"></div>
<script src="app.js"></script>
</body>
</html>`;
}

/** 沙箱通信桥：错误 / 就绪 / 控制台上报给父窗口。 */
const SANDBOX_BRIDGE = `<script>
(function () {
  var post = function (type, payload) {
    try {
      parent.postMessage(Object.assign({ __atomsSandbox: true, type: type }, payload || {}), '*');
    } catch (e) { /* 忽略跨域异常 */ }
  };

  window.addEventListener('error', function (event) {
    post('ERROR', {
      message: (event && event.message) || 'Unknown error',
      source: (event && event.filename) || '',
      line: (event && event.lineno) || 0,
      column: (event && event.colno) || 0,
      stack: event && event.error && event.error.stack ? String(event.error.stack) : ''
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    post('ERROR', {
      message: 'Unhandled Promise Rejection: ' + (reason && reason.message ? reason.message : String(reason)),
      stack: reason && reason.stack ? String(reason.stack) : ''
    });
  });

  ['log', 'warn', 'error'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      var text = args.map(function (item) {
        if (typeof item === 'string') return item;
        try { return JSON.stringify(item); } catch (e) { return String(item); }
      }).join(' ');
      post('LOG', { level: level, message: text });
      if (level === 'error') {
        post('ERROR', { message: 'console.error: ' + text, stack: '' });
      }
      if (typeof original === 'function') original.apply(console, args);
    };
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    post('READY', {});
  } else {
    window.addEventListener('DOMContentLoaded', function () { post('READY', {}); });
  }
})();
</script>`;

function inlineAssets(files: AppFiles): string {
  let html = (files['index.html'] || '').trim() || fallbackShell();
  const css = (files['style.css'] || '').trim();
  const js = (files['app.js'] || '').trim();

  // --- CSS：优先替换 <link>，否则注入 </head> 前 ---
  const styleTag = css ? `<style>\n${css}\n</style>` : '';
  if (styleTag) {
    if (LINK_PATTERN.test(html)) {
      html = html.replace(LINK_PATTERN, styleTag);
    } else if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${styleTag}\n</head>`);
    } else {
      html = `${styleTag}\n${html}`;
    }
  } else {
    html = html.replace(LINK_PATTERN, '');
  }

  // --- JS：优先替换 <script src="app.js">，否则注入 </body> 前 ---
  const scriptTag = js ? `<script>\n${js}\n</script>` : '';
  if (scriptTag) {
    if (SCRIPT_PATTERN.test(html)) {
      html = html.replace(SCRIPT_PATTERN, scriptTag);
    } else if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
    } else {
      html = `${html}\n${scriptTag}`;
    }
  } else {
    html = html.replace(SCRIPT_PATTERN, '');
  }

  return html;
}

/** 纯净单文件 HTML —— 导出下载用，可独立运行。 */
export function renderToHTML(files: AppFiles): string {
  return inlineAssets(files);
}

/** 预览用 HTML —— 在纯净产物基础上注入沙箱通信桥。 */
export function renderForSandbox(files: AppFiles): string {
  const html = inlineAssets(files);
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${SANDBOX_BRIDGE}\n</head>`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${SANDBOX_BRIDGE}`);
  }
  return `${SANDBOX_BRIDGE}\n${html}`;
}

function slugify(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-');
  return cleaned || 'atoms-app';
}

/** 导出为单个 .html 文件并触发浏览器下载。 */
export function exportToHTMLFile(files: AppFiles, projectName: string): void {
  const html = renderToHTML(files);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(projectName)}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}