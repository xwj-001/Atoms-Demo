/**
 * 三文件产物结构与两种渲染形态。
 * - renderToHTML：纯净单文件，用于导出与云端存档
 * - renderForSandbox：额外注入通信桥，用于预览时把运行时错误回传宿主
 */
export interface CodeFiles {
  html: string;
  css: string;
  js: string;
}

export const FILE_LABEL: Record<keyof CodeFiles, string> = {
  html: 'index.html',
  css: 'style.css',
  js: 'app.js',
};

export const FILE_ORDER: Array<keyof CodeFiles> = ['html', 'css', 'js'];

export function emptyFiles(): CodeFiles {
  return { html: '', css: '', js: '' };
}

export function isFullDocument(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('<html') || lower.includes('<!doctype html');
}

/* --------------------------- 单文件 → 三文件 --------------------------- */

const STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * 把一份完整单文件 HTML 拆回三文件结构。
 * 内联 <style> 归入 css，内联 <script>（无 src）归入 js，
 * 原位置替换为对 style.css / app.js 的外部引用，便于分文件编辑。
 */
export function splitDocument(doc: string): CodeFiles {
  const source = (doc || '').trim();
  if (!source) return emptyFiles();

  const cssParts: string[] = [];
  const jsParts: string[] = [];

  let html = source.replace(STYLE_RE, (_all, body: string) => {
    const trimmed = (body || '').trim();
    if (trimmed) cssParts.push(trimmed);
    return '__ATOMS_CSS_SLOT__';
  });

  html = html.replace(SCRIPT_RE, (all, attrs: string, body: string) => {
    if (/\bsrc\s*=/.test(attrs || '')) return all;
    const trimmed = (body || '').trim();
    if (trimmed) jsParts.push(trimmed);
    return '__ATOMS_JS_SLOT__';
  });

  // 第一个槽位换成外部引用，其余槽位直接删掉，避免重复引用
  let cssUsed = false;
  html = html.replace(/__ATOMS_CSS_SLOT__/g, () => {
    if (cssUsed) return '';
    cssUsed = true;
    return '<link rel="stylesheet" href="style.css" />';
  });
  let jsUsed = false;
  html = html.replace(/__ATOMS_JS_SLOT__/g, () => {
    if (jsUsed) return '';
    jsUsed = true;
    return '<script src="app.js"></script>';
  });

  return {
    html: html.replace(/\n{3,}/g, '\n\n').trim(),
    css: cssParts.join('\n\n'),
    js: jsParts.join('\n\n'),
  };
}

/* --------------------------- 三文件 → 单文件 --------------------------- */

const BASE_RESET = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
button{font:inherit;cursor:pointer}
input,select,textarea{font:inherit}`;

function wrapDocument(body: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Atoms App</title>
<style>
${BASE_RESET}
${css}
</style>
</head>
<body>
${body || '<main><p style="padding:32px;color:#71717a">未生成页面结构。</p></main>'}
<script>
${js}
</script>
</body>
</html>`;
}

/** 把三文件合成一份可直接打开的纯净单文件 HTML（导出用，不含任何平台注入） */
export function renderToHTML(files: CodeFiles): string {
  const { html, css, js } = files;
  if (!html && !css && !js) {
    return wrapDocument('', '', '');
  }
  if (!html || !isFullDocument(html)) {
    return wrapDocument(html, css, js);
  }

  let out = html;

  // 优先替换外部引用，其次注入到 head / body 尾部
  const styleTag = `<style>\n${css}\n</style>`;
  if (css) {
    const linkRe = /<link\b[^>]*href\s*=\s*["'][^"']*style\.css["'][^>]*>\s*/i;
    if (linkRe.test(out)) {
      out = out.replace(linkRe, `${styleTag}\n`);
    } else if (out.includes('</head>')) {
      out = out.replace('</head>', `${styleTag}\n</head>`);
    } else {
      out = `${styleTag}\n${out}`;
    }
  } else {
    out = out.replace(/<link\b[^>]*href\s*=\s*["'][^"']*style\.css["'][^>]*>\s*/gi, '');
  }

  const scriptTag = `<script>\n${js}\n</script>`;
  if (js) {
    const srcRe = /<script\b[^>]*src\s*=\s*["'][^"']*app\.js["'][^>]*>\s*<\/script>\s*/i;
    if (srcRe.test(out)) {
      out = out.replace(srcRe, `${scriptTag}\n`);
    } else if (out.includes('</body>')) {
      out = out.replace('</body>', `${scriptTag}\n</body>`);
    } else {
      out = `${out}\n${scriptTag}`;
    }
  } else {
    out = out.replace(
      /<script\b[^>]*src\s*=\s*["'][^"']*app\.js["'][^>]*>\s*<\/script>\s*/gi,
      '',
    );
  }

  return out;
}

/* ------------------------------ 沙箱通信桥 ------------------------------ */

/**
 * 存储垫片，必须在任何业务脚本之前执行。
 *
 * 预览 iframe 出于安全不能开 allow-same-origin（否则生成代码可以读取宿主页面的
 * 登录令牌与本地数据），代价是访问 window.localStorage 会直接抛
 * SecurityError: The document is sandboxed and lacks the 'allow-same-origin' flag。
 * 而生成的应用几乎都在初始化第一行读存储恢复数据，一抛异常整段脚本就中断、
 * 所有事件监听都没来得及绑定，表现就是「按钮点了完全没反应」。
 *
 * 这里把 localStorage / sessionStorage 换成 API 完全一致的内存实现：
 * 预览期内读写、刷新前的状态都正常，导出的单文件仍然用浏览器原生存储。
 */
export const SANDBOX_STORAGE_SHIM = `(function(){
  var makeStore=function(){
    var map={};
    var api={
      length:0,
      getItem:function(k){
        k=String(k);
        return Object.prototype.hasOwnProperty.call(map,k)?map[k]:null;
      },
      setItem:function(k,v){map[String(k)]=String(v);api.length=Object.keys(map).length;},
      removeItem:function(k){delete map[String(k)];api.length=Object.keys(map).length;},
      clear:function(){map={};api.length=0;},
      key:function(i){
        var keys=Object.keys(map);
        i=Number(i);
        return i>=0&&i<keys.length?keys[i]:null;
      }
    };
    return api;
  };
  var installStore=function(name){
    // 探针必须真的读写一次：部分环境下取属性不报错，写入时才抛 SecurityError
    try{
      var probe=window[name];
      if(probe){
        probe.setItem('__atoms_probe__','1');
        probe.removeItem('__atoms_probe__');
        return;
      }
    }catch(e){}
    var shim=makeStore();
    try{
      Object.defineProperty(window,name,{configurable:true,get:function(){return shim;}});
    }catch(e){
      try{window[name]=shim;}catch(e2){}
    }
  };
  installStore('localStorage');
  installStore('sessionStorage');
})();`;

/**
 * 注入到预览 iframe 的桥接脚本：
 * 劫持 error / unhandledrejection / console，通过 postMessage 回传宿主，
 * 让生成应用的运行时问题在平台侧可见，而不是白屏。
 */
export const SANDBOX_BRIDGE = `(function(){
  var send=function(type,payload){
    try{parent.postMessage({source:'atoms-sandbox',type:type,payload:payload},'*');}catch(e){}
  };
  var describe=function(v){
    if(v===null)return 'null';
    if(typeof v==='undefined')return 'undefined';
    if(typeof v==='string')return v;
    if(v instanceof Error)return v.message;
    try{return JSON.stringify(v);}catch(e){return String(v);}
  };
  window.addEventListener('error',function(ev){
    if(ev && ev.target && ev.target!==window && ev.target.tagName){
      send('resource',{tag:ev.target.tagName.toLowerCase(),url:ev.target.src||ev.target.href||''});
      return;
    }
    send('error',{message:(ev&&ev.message)||'未知运行时错误',line:ev&&ev.lineno,column:ev&&ev.colno});
  },true);
  window.addEventListener('unhandledrejection',function(ev){
    send('error',{message:'未处理的 Promise 拒绝：'+describe(ev&&ev.reason)});
  });
  ['log','warn','error','info'].forEach(function(level){
    var origin=console[level];
    console[level]=function(){
      var args=Array.prototype.slice.call(arguments).map(describe);
      send('log',{level:level,text:args.join(' ')});
      if(typeof origin==='function')origin.apply(console,arguments);
    };
  });
  var ready=function(){
    send('ready',{
      nodes:document.body?document.body.querySelectorAll('*').length:0,
      title:document.title||''
    });
  };
  if(document.readyState==='complete'||document.readyState==='interactive'){setTimeout(ready,0);}
  else{window.addEventListener('DOMContentLoaded',ready);}
})();`;

/**
 * 预览用版本：纯净单文件 + 通信桥 + 可选体检脚本。
 * 桥在业务脚本之前注入，才能捕获初始化期错误；
 * 体检脚本只挂监听，等宿主下发指令后才执行，不影响正常预览。
 */
export function renderForSandbox(files: CodeFiles, auditScript = ''): string {
  const pure = renderToHTML(files);
  // 垫片排在最前：业务脚本读存储之前就得把 localStorage 换掉，否则照样抛 SecurityError
  const scripts = [SANDBOX_STORAGE_SHIM, SANDBOX_BRIDGE, auditScript].filter(Boolean).join('\n');
  const bridge = `<script>\n${scripts}\n</script>`;
  if (pure.includes('<head>')) {
    return pure.replace('<head>', `<head>\n${bridge}`);
  }
  if (pure.includes('<body>')) {
    return pure.replace('<body>', `<body>\n${bridge}`);
  }
  return `${bridge}\n${pure}`;
}

/**
 * 给一段已经渲染好的单文件 HTML 补上存储垫片。
 * 用于画廊缩略图 / 大图预览这类直接把存档代码塞进 srcDoc 的场景：
 * 它们同样没有 allow-same-origin，读 localStorage 会抛 SecurityError 导致整页交互失效。
 */
export function withStorageShim(doc: string): string {
  const shim = `<script>\n${SANDBOX_STORAGE_SHIM}\n</script>`;
  if (doc.includes('<head>')) {
    return doc.replace('<head>', `<head>\n${shim}`);
  }
  if (doc.includes('<body>')) {
    return doc.replace('<body>', `<body>\n${shim}`);
  }
  return `${shim}\n${doc}`;
}

/* --------------------------- 沙箱消息类型定义 --------------------------- */

export type SandboxMessageType =
  | 'ready'
  | 'error'
  | 'log'
  | 'resource'
  | 'smoke'
  | 'visual';

export interface SandboxMessage {
  source: 'atoms-sandbox';
  type: SandboxMessageType;
  payload: Record<string, unknown>;
}

export function isSandboxMessage(data: unknown): data is SandboxMessage {
  const msg = data as SandboxMessage | undefined;
  return !!msg && msg.source === 'atoms-sandbox' && typeof msg.type === 'string';
}

/** 粗略统计三文件规模，用于版本信息展示 */
export function filesMetrics(files: CodeFiles): { lines: number; kb: number } {
  const all = `${files.html}\n${files.css}\n${files.js}`;
  return {
    lines: all.trim() ? all.split('\n').length : 0,
    kb: all.trim() ? Math.max(1, Math.round(all.length / 1024)) : 0,
  };
}

/* ------------------------------ 文件锁定 ------------------------------ */

/**
 * 文件锁定状态。用户手改过的文件默认锁定，
 * 下一轮迭代模型不许覆盖，避免「我刚改的东西又被冲掉了」。
 */
export type FileLocks = Record<keyof CodeFiles, boolean>;

export function emptyLocks(): FileLocks {
  return { html: false, css: false, js: false };
}

export function lockedFiles(locks: FileLocks): Array<keyof CodeFiles> {
  return FILE_ORDER.filter((key) => locks[key]);
}

export function hasAnyLock(locks: FileLocks): boolean {
  return FILE_ORDER.some((key) => locks[key]);
}

/** 归一化历史数据中缺失的锁定字段 */
export function normalizeLocks(value: unknown): FileLocks {
  const raw = (value ?? {}) as Partial<Record<keyof CodeFiles, unknown>>;
  return { html: raw.html === true, css: raw.css === true, js: raw.js === true };
}

/** 用锁定状态过滤模型产物：被锁文件强制保留基线内容 */
export function applyLocks(base: CodeFiles, next: CodeFiles, locks: FileLocks): CodeFiles {
  return {
    html: locks.html ? base.html : next.html,
    css: locks.css ? base.css : next.css,
    js: locks.js ? base.js : next.js,
  };
}