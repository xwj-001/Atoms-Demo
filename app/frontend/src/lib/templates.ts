import type { StyleTag } from './db';

/** 预置模板：mock 模式返回结果 + 快速模板按钮的需求文案来源 */
export interface PresetTemplate {
  id: string;
  /** 快速模板按钮文案 */
  label: string;
  /** 点击后填入输入框的需求描述 */
  description: string;
  /** 推荐风格 */
  recommendedStyle: StyleTag;
  keywords: string[];
  /** 三种风格各一份完整可运行代码 */
  code: Record<StyleTag, string>;
}

const shell = (
  title: string,
  styleTag: StyleTag,
  body: string,
  css: string,
  js: string,
) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="atoms-style" content="${styleTag}" />
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
button{font:inherit;cursor:pointer;min-width:36px;min-height:36px}
input,select{font:inherit}
${css}
</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>`;

/* =============================== 待办清单 =============================== */

const todoMinimal = shell(
  '待办清单',
  'minimal',
  `<main class="wrap">
  <h1>待办清单</h1>
  <form id="f" class="row"><input id="i" placeholder="要做什么？" autocomplete="off" /><button type="submit">添加</button></form>
  <ul id="list"></ul>
  <p id="meta" class="meta"></p>
</main>`,
  `body{background:#f7f7f8;color:#18181b;padding:40px 16px}
.wrap{max-width:520px;margin:0 auto}
h1{font-size:22px;font-weight:700;margin-bottom:20px}
.row{display:flex;gap:8px;margin-bottom:20px}
input{flex:1;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;background:#fff}
input:focus{outline:2px solid #18181b;outline-offset:1px}
button{padding:10px 16px;border:0;border-radius:8px;background:#18181b;color:#fff}
ul{list-style:none;display:flex;flex-direction:column;gap:6px}
li{display:flex;align-items:center;gap:10px;padding:11px 12px;background:#fff;border:1px solid #e4e4e7;border-radius:8px}
li.done span{text-decoration:line-through;color:#a1a1aa}
li span{flex:1;font-size:14px}
.del{flex:none;width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:8px;background:none;color:#a1a1aa;font-size:18px;line-height:1}
.del:hover{color:#dc2626}
.meta{margin-top:16px;font-size:13px;color:#71717a}`,
  `const KEY='atoms-todo-minimal';
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('list'),meta=document.getElementById('meta');
function save(){localStorage.setItem(KEY,JSON.stringify(items));render();}
function render(){
  list.innerHTML='';
  items.forEach((it,idx)=>{
    const li=document.createElement('li');
    if(it.done)li.className='done';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=it.done;
    cb.onchange=()=>{items[idx].done=cb.checked;save();};
    const sp=document.createElement('span');sp.textContent=it.text;
    const del=document.createElement('button');del.className='del';del.textContent='×';
    del.onclick=()=>{items.splice(idx,1);save();};
    li.append(cb,sp,del);list.appendChild(li);
  });
  const left=items.filter(i=>!i.done).length;
  meta.textContent=items.length?left+' 项待完成 / 共 '+items.length+' 项':'暂无待办，添加第一条吧。';
}
document.getElementById('f').onsubmit=e=>{
  e.preventDefault();
  const el=document.getElementById('i');
  const v=el.value.trim();if(!v)return;
  items.push({text:v,done:false});el.value='';save();
};
render();`,
);

const todoCard = shell(
  '待办清单',
  'card',
  `<main class="wrap">
  <header><h1>今天要征服什么？</h1><p id="progress">0% 完成</p></header>
  <div class="bar"><i id="fill"></i></div>
  <form id="f"><input id="i" placeholder="输入一个任务，回车添加" autocomplete="off" /><button type="submit">添加</button></form>
  <div id="list" class="cards"></div>
</main>`,
  `body{min-height:100vh;color:#1e1b4b;background:linear-gradient(135deg,#eef2ff,#fdf2f8 55%,#ecfeff);padding:48px 18px}
.wrap{max-width:640px;margin:0 auto}
header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
h1{font-size:28px;font-weight:800;letter-spacing:-.02em}
#progress{font-size:13px;font-weight:700;color:#7c3aed}
.bar{height:9px;border-radius:99px;background:rgba(124,58,237,.15);margin:16px 0 22px;overflow:hidden}
.bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#8b5cf6,#ec4899);transition:width .45s cubic-bezier(.16,1,.3,1)}
form{display:flex;gap:10px;margin-bottom:22px}
input{flex:1;padding:14px 16px;border:1px solid rgba(255,255,255,.9);border-radius:14px;background:rgba(255,255,255,.75);box-shadow:0 10px 26px -20px rgba(76,29,149,.6)}
input:focus{outline:2px solid #8b5cf6;outline-offset:2px}
button{padding:14px 20px;border:0;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font-weight:700;box-shadow:0 12px 26px -14px rgba(124,58,237,.75);transition:transform .15s cubic-bezier(.25,1,.5,1)}
button:hover{transform:translateY(-2px)}
.cards{display:grid;gap:12px}
.card{display:flex;align-items:center;gap:12px;padding:16px;border-radius:16px;background:rgba(255,255,255,.78);border:1px solid rgba(255,255,255,.95);box-shadow:0 14px 34px -26px rgba(76,29,149,.55);animation:pop .4s cubic-bezier(.16,1,.3,1) both}
@keyframes pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.dot{width:36px;height:36px;border-radius:50%;border:2px solid #a78bfa;flex:none;display:grid;place-items:center;color:#fff;font-size:15px;background:none;transition:.2s}
.card.done .dot{background:linear-gradient(135deg,#8b5cf6,#ec4899);border-color:transparent}
.card.done .txt{text-decoration:line-through;opacity:.5}
.txt{flex:1;font-size:15px;font-weight:600}
.x{flex:none;width:36px;height:36px;display:grid;place-items:center;background:none;border:0;border-radius:10px;color:#a5b4fc;font-size:20px;line-height:1}
.x:hover{color:#e11d48}
.empty{padding:34px;text-align:center;border-radius:16px;border:1px dashed rgba(124,58,237,.35);color:#6d28d9;background:rgba(255,255,255,.55)}`,
  `const KEY='atoms-todo-card';
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('list'),fill=document.getElementById('fill'),prog=document.getElementById('progress');
function save(){localStorage.setItem(KEY,JSON.stringify(items));render();}
function render(){
  list.innerHTML='';
  if(!items.length){const d=document.createElement('div');d.className='empty';d.textContent='还没有任务。写下第一件小事，进度条会为你亮起来。';list.appendChild(d);}
  items.forEach((it,idx)=>{
    const c=document.createElement('div');c.className='card'+(it.done?' done':'');
    const dot=document.createElement('button');dot.className='dot';dot.textContent=it.done?'✓':'';
    dot.onclick=()=>{items[idx].done=!items[idx].done;save();};
    const t=document.createElement('div');t.className='txt';t.textContent=it.text;
    const x=document.createElement('button');x.className='x';x.textContent='×';
    x.onclick=()=>{items.splice(idx,1);save();};
    c.append(dot,t,x);list.appendChild(c);
  });
  const done=items.filter(i=>i.done).length;
  const pct=items.length?Math.round(done/items.length*100):0;
  fill.style.width=pct+'%';prog.textContent=pct+'% 完成';
}
document.getElementById('f').onsubmit=e=>{
  e.preventDefault();const el=document.getElementById('i');
  const v=el.value.trim();if(!v)return;
  items.unshift({text:v,done:false});el.value='';save();
};
render();`,
);

const todoDashboard = shell(
  '待办看板',
  'dashboard',
  `<main class="wrap">
  <header><div><h1>任务看板</h1><p class="sub">用数据盯住每天的执行率</p></div><div class="big" id="rate">0%</div></header>
  <section class="kpis" id="kpis"></section>
  <section class="grid">
    <div class="panel">
      <h2>新增任务</h2>
      <form id="f">
        <input id="i" placeholder="任务名称" autocomplete="off" />
        <select id="p"><option value="high">高优先级</option><option value="mid" selected>中优先级</option><option value="low">低优先级</option></select>
        <button type="submit">加入看板</button>
      </form>
      <div class="bars" id="bars"></div>
    </div>
    <div class="panel">
      <h2>任务列表</h2>
      <div id="list" class="list"></div>
    </div>
  </section>
</main>`,
  `body{background:#0b1020;color:#e2e8f0;padding:36px 18px;min-height:100vh}
.wrap{max-width:1040px;margin:0 auto;display:grid;gap:18px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
h1{font-size:26px;font-weight:800}
.sub{color:#94a3b8;font-size:13px;margin-top:4px}
.big{font-size:34px;font-weight:800;color:#38bdf8;font-variant-numeric:tabular-nums}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.kpi{padding:16px;border-radius:14px;background:rgba(148,163,184,.09);border:1px solid rgba(148,163,184,.18)}
.kpi span{display:block;font-size:12px;color:#94a3b8;margin-bottom:6px}
.kpi b{font-size:21px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:1fr 1.2fr;gap:14px}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.panel{padding:18px;border-radius:16px;background:rgba(148,163,184,.07);border:1px solid rgba(148,163,184,.16)}
h2{font-size:14px;font-weight:700;color:#cbd5e1;margin-bottom:14px}
form{display:grid;gap:9px;margin-bottom:18px}
input,select{padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.7);color:#e2e8f0}
input:focus,select:focus{outline:2px solid #38bdf8}
button{padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:700}
.bars{display:grid;gap:11px}
.brow>span{display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-bottom:5px}
.track{height:9px;border-radius:99px;background:rgba(148,163,184,.16);overflow:hidden}
.track i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#22d3ee,#6366f1);transition:width .5s cubic-bezier(.16,1,.3,1)}
.list{display:grid;gap:8px;max-height:330px;overflow:auto}
.item{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;background:rgba(15,23,42,.62)}
.item.done .n{opacity:.45;text-decoration:line-through}
.tag{padding:2px 9px;border-radius:99px;font-size:11px}
.tag.high{background:rgba(248,113,113,.16);color:#fca5a5}
.tag.mid{background:rgba(56,189,248,.16);color:#7dd3fc}
.tag.low{background:rgba(148,163,184,.18);color:#cbd5e1}
.item .n{flex:1;font-size:14px}
.item button{background:none;border:0;color:#64748b;padding:2px 5px}
.item button:hover{color:#f87171}
.chk{width:20px;height:20px;border-radius:6px;border:1px solid rgba(148,163,184,.4);background:none;color:#38bdf8;display:grid;place-items:center;font-size:12px}
.empty{color:#64748b;font-size:13px}`,
  `const KEY='atoms-todo-dash';
const LEVELS=[['high','高优先级'],['mid','中优先级'],['low','低优先级']];
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const $=id=>document.getElementById(id);
function save(){localStorage.setItem(KEY,JSON.stringify(items));render();}
function render(){
  const done=items.filter(i=>i.done).length;
  const rate=items.length?Math.round(done/items.length*100):0;
  $('rate').textContent=rate+'%';
  $('kpis').innerHTML='';
  [['任务总数',items.length],['已完成',done],['进行中',items.length-done],['高优先级',items.filter(i=>i.p==='high').length]]
    .forEach(([k,v])=>{const d=document.createElement('div');d.className='kpi';
      const s=document.createElement('span');s.textContent=k;const b=document.createElement('b');b.textContent=v;
      d.append(s,b);$('kpis').appendChild(d);});
  $('bars').innerHTML='';
  LEVELS.forEach(([key,label])=>{
    const total=items.filter(i=>i.p===key).length;
    const pct=items.length?total/items.length*100:0;
    const w=document.createElement('div');w.className='brow';
    const s=document.createElement('span');
    const a=document.createElement('em');a.style.fontStyle='normal';a.textContent=label;
    const b=document.createElement('em');b.style.fontStyle='normal';b.textContent=total+' 项 · '+pct.toFixed(0)+'%';
    s.append(a,b);
    const t=document.createElement('div');t.className='track';const i=document.createElement('i');i.style.width=pct+'%';t.appendChild(i);
    w.append(s,t);$('bars').appendChild(w);
  });
  const list=$('list');list.innerHTML='';
  if(!items.length){const e=document.createElement('p');e.className='empty';e.textContent='看板还是空的，先加入一个任务。';list.appendChild(e);}
  items.forEach((it,idx)=>{
    const d=document.createElement('div');d.className='item'+(it.done?' done':'');
    const c=document.createElement('button');c.className='chk';c.textContent=it.done?'✓':'';
    c.onclick=()=>{items[idx].done=!items[idx].done;save();};
    const tg=document.createElement('span');tg.className='tag '+it.p;
    tg.textContent=(LEVELS.find(l=>l[0]===it.p)||['','中'])[1];
    const n=document.createElement('div');n.className='n';n.textContent=it.text;
    const x=document.createElement('button');x.textContent='×';x.onclick=()=>{items.splice(idx,1);save();};
    d.append(c,tg,n,x);list.appendChild(d);
  });
}
$('f').onsubmit=e=>{
  e.preventDefault();
  const v=$('i').value.trim();if(!v)return;
  items.unshift({text:v,p:$('p').value,done:false});$('i').value='';save();
};
render();`,
);

/* ================================ 记账本 ================================ */

const ledgerMinimal = shell(
  '记账本',
  'minimal',
  `<main class="wrap">
  <h1>记账本</h1>
  <p class="total">累计支出 <b id="sum">¥0.00</b></p>
  <form id="f">
    <input id="d" placeholder="项目，例如 午餐" autocomplete="off" />
    <input id="a" type="number" step="0.01" placeholder="金额" />
    <select id="c"><option>餐饮</option><option>交通</option><option>购物</option><option>居住</option><option>其他</option></select>
    <button type="submit">记一笔</button>
  </form>
  <table><thead><tr><th>项目</th><th>分类</th><th class="r">金额</th><th></th></tr></thead><tbody id="body"></tbody></table>
</main>`,
  `body{background:#fafafa;color:#171717;padding:40px 16px}
.wrap{max-width:640px;margin:0 auto}
h1{font-size:22px;font-weight:700}
.total{margin:8px 0 22px;font-size:14px;color:#737373}
.total b{font-size:24px;color:#171717;font-variant-numeric:tabular-nums}
form{display:grid;grid-template-columns:1fr 110px 110px auto;gap:8px;margin-bottom:22px}
input,select{padding:9px 11px;border:1px solid #d4d4d4;border-radius:7px;background:#fff}
button{padding:9px 14px;border:0;border-radius:7px;background:#171717;color:#fff}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:10px 8px;border-bottom:1px solid #e5e5e5;text-align:left}
th{font-size:12px;color:#737373;font-weight:600}
.r{text-align:right;font-variant-numeric:tabular-nums}
td.r{font-weight:600}
.x{padding:0 10px;background:none;border:0;border-radius:8px;color:#a3a3a3;font-size:13px;line-height:1}
.x:hover{color:#dc2626}
@media(max-width:560px){form{grid-template-columns:1fr 1fr}}`,
  `const KEY='atoms-ledger-minimal';
let rows=JSON.parse(localStorage.getItem(KEY)||'[]');
const body=document.getElementById('body'),sum=document.getElementById('sum');
function save(){localStorage.setItem(KEY,JSON.stringify(rows));render();}
function render(){
  body.innerHTML='';
  rows.forEach((r,i)=>{
    const tr=document.createElement('tr');
    const a=document.createElement('td');a.textContent=r.desc;
    const b=document.createElement('td');b.textContent=r.cat;
    const c=document.createElement('td');c.className='r';c.textContent='¥'+r.amount.toFixed(2);
    const d=document.createElement('td');d.className='r';
    const x=document.createElement('button');x.className='x';x.textContent='删除';
    x.onclick=()=>{rows.splice(i,1);save();};d.appendChild(x);
    tr.append(a,b,c,d);body.appendChild(tr);
  });
  if(!rows.length){const tr=document.createElement('tr');const td=document.createElement('td');
    td.colSpan=4;td.textContent='暂无记录。';td.style.color='#a3a3a3';tr.appendChild(td);body.appendChild(tr);}
  sum.textContent='¥'+rows.reduce((s,r)=>s+r.amount,0).toFixed(2);
}
document.getElementById('f').onsubmit=e=>{
  e.preventDefault();
  const d=document.getElementById('d'),a=document.getElementById('a'),c=document.getElementById('c');
  const amount=parseFloat(a.value);
  if(!d.value.trim()||!(amount>0))return;
  rows.unshift({desc:d.value.trim(),amount:amount,cat:c.value});
  d.value='';a.value='';save();
};
render();`,
);

const ledgerCard = shell(
  '记账本',
  'card',
  `<main class="wrap">
  <header><h1>我的账本</h1><p class="sum" id="sum">¥0.00</p></header>
  <form id="f">
    <input id="d" placeholder="花在哪儿了？" autocomplete="off" />
    <input id="a" type="number" step="0.01" placeholder="金额" />
    <select id="c"><option>餐饮</option><option>交通</option><option>购物</option><option>居住</option><option>其他</option></select>
    <button type="submit">记一笔</button>
  </form>
  <div id="list" class="cards"></div>
</main>`,
  `body{min-height:100vh;color:#134e4a;background:linear-gradient(140deg,#f0fdfa,#fef9c3 55%,#ffe4e6);padding:46px 18px}
.wrap{max-width:620px;margin:0 auto}
header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}
h1{font-size:28px;font-weight:800;letter-spacing:-.02em}
.sum{font-size:26px;font-weight:800;color:#0d9488;font-variant-numeric:tabular-nums}
form{display:grid;grid-template-columns:1fr 110px;gap:10px;margin-bottom:22px}
input,select{padding:13px 15px;border:1px solid rgba(255,255,255,.9);border-radius:14px;background:rgba(255,255,255,.78);box-shadow:0 10px 26px -22px rgba(19,78,74,.6)}
input:focus,select:focus{outline:2px solid #14b8a6;outline-offset:2px}
select{grid-column:1}
button{grid-column:2;padding:13px;border:0;border-radius:14px;background:linear-gradient(135deg,#0d9488,#f59e0b);color:#fff;font-weight:700;box-shadow:0 12px 26px -16px rgba(13,148,136,.8);transition:transform .15s cubic-bezier(.25,1,.5,1)}
button:hover{transform:translateY(-2px)}
.cards{display:grid;gap:11px}
.card{display:flex;align-items:center;gap:12px;padding:15px 16px;border-radius:16px;background:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.95);box-shadow:0 14px 32px -26px rgba(19,78,74,.5);animation:pop .4s cubic-bezier(.16,1,.3,1) both}
@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.tag{padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:rgba(13,148,136,.14);color:#0f766e}
.n{flex:1;font-size:15px;font-weight:600}
.v{font-weight:800;font-variant-numeric:tabular-nums}
.x{flex:none;width:36px;height:36px;display:grid;place-items:center;background:none;border:0;border-radius:10px;color:#99f6e4;font-size:20px;line-height:1}
.x:hover{color:#e11d48}
.empty{padding:32px;text-align:center;border-radius:16px;border:1px dashed rgba(13,148,136,.35);color:#0f766e;background:rgba(255,255,255,.55)}
@media(max-width:520px){form{grid-template-columns:1fr}select,button{grid-column:1}}`,
  `const KEY='atoms-ledger-card';
let rows=JSON.parse(localStorage.getItem(KEY)||'[]');
const $=id=>document.getElementById(id);
function save(){localStorage.setItem(KEY,JSON.stringify(rows));render();}
function render(){
  $('sum').textContent='¥'+rows.reduce((s,r)=>s+r.amount,0).toFixed(2);
  const list=$('list');list.innerHTML='';
  if(!rows.length){const d=document.createElement('div');d.className='empty';d.textContent='还没有记录。记下第一笔，账本就活起来了。';list.appendChild(d);}
  rows.forEach((r,i)=>{
    const c=document.createElement('div');c.className='card';
    const t=document.createElement('span');t.className='tag';t.textContent=r.cat;
    const n=document.createElement('div');n.className='n';n.textContent=r.desc;
    const v=document.createElement('div');v.className='v';v.textContent='¥'+r.amount.toFixed(2);
    const x=document.createElement('button');x.className='x';x.textContent='×';
    x.onclick=()=>{rows.splice(i,1);save();};
    c.append(t,n,v,x);list.appendChild(c);
  });
}
$('f').onsubmit=e=>{
  e.preventDefault();
  const amount=parseFloat($('a').value);
  if(!$('d').value.trim()||!(amount>0))return;
  rows.unshift({desc:$('d').value.trim(),amount:amount,cat:$('c').value});
  $('d').value='';$('a').value='';save();
};
render();`,
);

const ledgerDashboard = shell(
  '消费看板',
  'dashboard',
  `<main class="wrap">
  <header><div><h1>消费看板</h1><p class="sub">看清每一笔钱去了哪里</p></div><div class="big" id="sum">¥0.00</div></header>
  <section class="kpis" id="kpis"></section>
  <section class="grid">
    <div class="panel">
      <h2>分类占比</h2>
      <div id="bars" class="bars"></div>
    </div>
    <div class="panel">
      <h2>记一笔</h2>
      <form id="f">
        <input id="d" placeholder="项目" autocomplete="off" />
        <input id="a" type="number" step="0.01" placeholder="金额" />
        <select id="c"><option>餐饮</option><option>交通</option><option>购物</option><option>居住</option><option>其他</option></select>
        <button type="submit">添加记录</button>
      </form>
    </div>
  </section>
  <section class="panel"><h2>明细</h2><div id="list" class="list"></div></section>
</main>`,
  `body{background:#0b1020;color:#e2e8f0;padding:36px 18px;min-height:100vh}
.wrap{max-width:1000px;margin:0 auto;display:grid;gap:18px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
h1{font-size:26px;font-weight:800}
.sub{color:#94a3b8;font-size:13px;margin-top:4px}
.big{font-size:34px;font-weight:800;color:#38bdf8;font-variant-numeric:tabular-nums}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.kpi{padding:16px;border-radius:14px;background:rgba(148,163,184,.09);border:1px solid rgba(148,163,184,.18)}
.kpi span{display:block;font-size:12px;color:#94a3b8;margin-bottom:6px}
.kpi b{font-size:20px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:1.25fr 1fr;gap:14px}
@media(max-width:800px){.grid{grid-template-columns:1fr}}
.panel{padding:18px;border-radius:16px;background:rgba(148,163,184,.07);border:1px solid rgba(148,163,184,.16)}
h2{font-size:14px;font-weight:700;color:#cbd5e1;margin-bottom:14px}
.bars{display:grid;gap:11px}
.brow>span{display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-bottom:5px}
.track{height:9px;border-radius:99px;background:rgba(148,163,184,.16);overflow:hidden}
.track i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#22d3ee,#6366f1);transition:width .5s cubic-bezier(.16,1,.3,1)}
form{display:grid;gap:9px}
input,select{padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.7);color:#e2e8f0}
input:focus,select:focus{outline:2px solid #38bdf8}
button{padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:700}
.list{display:grid;gap:8px;max-height:290px;overflow:auto}
.item{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:11px;background:rgba(15,23,42,.6)}
.tag{padding:2px 9px;border-radius:99px;font-size:11px;background:rgba(56,189,248,.16);color:#7dd3fc}
.item .n{flex:1;font-size:14px}
.item .v{font-weight:700;font-variant-numeric:tabular-nums}
.item button{background:none;border:0;color:#64748b;padding:2px 4px}
.item button:hover{color:#f87171}
.empty{color:#64748b;font-size:13px}`,
  `const KEY='atoms-ledger-dash';
const CATS=['餐饮','交通','购物','居住','其他'];
let rows=JSON.parse(localStorage.getItem(KEY)||'[]');
const $=id=>document.getElementById(id);
function save(){localStorage.setItem(KEY,JSON.stringify(rows));render();}
function render(){
  const total=rows.reduce((s,r)=>s+r.amount,0);
  $('sum').textContent='¥'+total.toFixed(2);
  const avg=rows.length?total/rows.length:0;
  const max=rows.reduce((m,r)=>r.amount>m.amount?r:m,{amount:0,desc:'—'});
  $('kpis').innerHTML='';
  [['记录笔数',rows.length],['单笔均值','¥'+avg.toFixed(2)],['最大单笔','¥'+max.amount.toFixed(2)],['最大项目',max.desc||'—']]
    .forEach(([k,v])=>{const d=document.createElement('div');d.className='kpi';
      const s=document.createElement('span');s.textContent=k;const b=document.createElement('b');b.textContent=v;
      d.append(s,b);$('kpis').appendChild(d);});
  $('bars').innerHTML='';
  CATS.forEach(cat=>{
    const v=rows.filter(r=>r.cat===cat).reduce((s,r)=>s+r.amount,0);
    const pct=total?v/total*100:0;
    const w=document.createElement('div');w.className='brow';
    const s=document.createElement('span');
    const l=document.createElement('em');l.style.fontStyle='normal';l.textContent=cat;
    const rr=document.createElement('em');rr.style.fontStyle='normal';rr.textContent='¥'+v.toFixed(2)+' · '+pct.toFixed(0)+'%';
    s.append(l,rr);
    const t=document.createElement('div');t.className='track';const i=document.createElement('i');i.style.width=pct+'%';t.appendChild(i);
    w.append(s,t);$('bars').appendChild(w);
  });
  const list=$('list');list.innerHTML='';
  if(!rows.length){const e=document.createElement('p');e.className='empty';e.textContent='还没有数据，右侧添加第一笔支出。';list.appendChild(e);}
  rows.forEach((r,i)=>{
    const d=document.createElement('div');d.className='item';
    const tg=document.createElement('span');tg.className='tag';tg.textContent=r.cat;
    const n=document.createElement('div');n.className='n';n.textContent=r.desc;
    const v=document.createElement('div');v.className='v';v.textContent='¥'+r.amount.toFixed(2);
    const x=document.createElement('button');x.textContent='×';x.onclick=()=>{rows.splice(i,1);save();};
    d.append(tg,n,v,x);list.appendChild(d);
  });
}
$('f').onsubmit=e=>{
  e.preventDefault();
  const amount=parseFloat($('a').value);
  if(!$('d').value.trim()||!(amount>0))return;
  rows.unshift({desc:$('d').value.trim(),amount:amount,cat:$('c').value});
  $('d').value='';$('a').value='';save();
};
render();`,
);

/* ================================ 番茄钟 ================================ */

const pomodoroMinimal = shell(
  '番茄钟',
  'minimal',
  `<main class="wrap">
  <h1>番茄钟</h1>
  <div class="clock" id="clock">25:00</div>
  <p class="mode" id="mode">专注时段</p>
  <div class="btns">
    <button id="toggle">开始</button>
    <button id="reset" class="ghost">重置</button>
    <button id="switch" class="ghost">切到休息</button>
  </div>
  <p class="meta">已完成 <b id="done">0</b> 个番茄</p>
</main>`,
  `body{background:#fafafa;color:#171717;display:grid;place-items:center;min-height:100vh;padding:24px}
.wrap{text-align:center;max-width:380px}
h1{font-size:18px;font-weight:600;color:#737373}
.clock{font-size:74px;font-weight:700;letter-spacing:-.03em;margin:12px 0 4px;font-variant-numeric:tabular-nums}
.mode{font-size:14px;color:#737373;margin-bottom:26px}
.btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
button{padding:10px 18px;border:0;border-radius:8px;background:#171717;color:#fff;font-weight:600}
button.ghost{background:#fff;color:#171717;border:1px solid #d4d4d4}
.meta{margin-top:24px;font-size:13px;color:#737373}
.meta b{color:#171717}`,
  `const FOCUS=25*60,BREAK=5*60;
let mode='focus',left=FOCUS,running=false,timer=null,done=0;
const $=id=>document.getElementById(id);
function fmt(s){const m=Math.floor(s/60),x=s%60;return String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');}
function paint(){
  $('clock').textContent=fmt(left);
  $('mode').textContent=mode==='focus'?'专注时段':'休息时段';
  $('toggle').textContent=running?'暂停':'开始';
  $('switch').textContent=mode==='focus'?'切到休息':'切到专注';
  $('done').textContent=done;
  document.title=fmt(left)+' · 番茄钟';
}
function tick(){
  left--;
  if(left<=0){
    clearInterval(timer);running=false;
    if(mode==='focus'){done++;mode='break';left=BREAK;}else{mode='focus';left=FOCUS;}
  }
  paint();
}
$('toggle').onclick=()=>{running=!running;clearInterval(timer);if(running)timer=setInterval(tick,1000);paint();};
$('reset').onclick=()=>{running=false;clearInterval(timer);left=mode==='focus'?FOCUS:BREAK;paint();};
$('switch').onclick=()=>{running=false;clearInterval(timer);mode=mode==='focus'?'break':'focus';left=mode==='focus'?FOCUS:BREAK;paint();};
paint();`,
);

const pomodoroCard = shell(
  '番茄钟',
  'card',
  `<main class="wrap">
  <div class="card">
    <p class="badge" id="badge">专注中</p>
    <div class="ring">
      <svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="96" class="bg"/><circle cx="110" cy="110" r="96" class="fg" id="arc"/></svg>
      <div class="center"><b id="clock">25:00</b><span id="hint">点击开始</span></div>
    </div>
    <div class="btns">
      <button id="toggle">开始专注</button>
      <button id="reset" class="ghost">重置</button>
      <button id="switch" class="ghost">切换模式</button>
    </div>
  </div>
  <div class="tomatoes" id="tomatoes"></div>
</main>`,
  `body{min-height:100vh;display:grid;place-items:center;padding:28px;color:#3b0764;background:linear-gradient(150deg,#fff1f2,#f5f3ff 50%,#ecfeff)}
.wrap{width:100%;max-width:420px;display:grid;gap:16px;justify-items:center}
.card{width:100%;padding:26px 22px 22px;border-radius:26px;text-align:center;background:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.95);box-shadow:0 24px 60px -34px rgba(76,29,149,.55)}
.badge{display:inline-block;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;background:rgba(219,39,119,.12);color:#be185d;margin-bottom:14px}
.ring{position:relative;width:220px;margin:0 auto}
svg{width:220px;height:220px;transform:rotate(-90deg)}
circle{fill:none;stroke-width:13;stroke-linecap:round}
circle.bg{stroke:rgba(124,58,237,.14)}
circle.fg{stroke:#a855f7;stroke-dasharray:603;stroke-dashoffset:0;transition:stroke-dashoffset .95s linear}
.center{position:absolute;inset:0;display:grid;place-content:center;gap:4px}
.center b{font-size:44px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.center span{font-size:12px;color:#7c3aed}
.btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:20px}
button{padding:11px 18px;border:0;border-radius:12px;font-weight:700;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;box-shadow:0 14px 28px -16px rgba(124,58,237,.8);transition:transform .15s cubic-bezier(.25,1,.5,1)}
button:hover{transform:translateY(-2px)}
button.ghost{background:rgba(255,255,255,.85);color:#6d28d9;box-shadow:none;border:1px solid rgba(124,58,237,.25)}
.tomatoes{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;font-size:22px;min-height:28px}
.tomatoes span{animation:pop .4s cubic-bezier(.16,1,.3,1) both}
@keyframes pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}`,
  `const FOCUS=25*60,BREAK=5*60,CIRC=603;
let mode='focus',left=FOCUS,running=false,timer=null,done=0;
const $=id=>document.getElementById(id);
function fmt(s){const m=Math.floor(s/60),x=s%60;return String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');}
function paint(){
  const total=mode==='focus'?FOCUS:BREAK;
  $('clock').textContent=fmt(left);
  $('arc').style.strokeDashoffset=String(CIRC*(1-left/total));
  $('arc').style.stroke=mode==='focus'?'#a855f7':'#14b8a6';
  $('badge').textContent=mode==='focus'?'专注中':'休息中';
  $('hint').textContent=running?(mode==='focus'?'保持节奏':'放松肩膀'):'点击开始';
  $('toggle').textContent=running?'暂停':(mode==='focus'?'开始专注':'开始休息');
  $('tomatoes').innerHTML='';
  for(let i=0;i<done;i++){const s=document.createElement('span');s.textContent='🍅';$('tomatoes').appendChild(s);}
  document.title=fmt(left)+' · 番茄钟';
}
function tick(){
  left--;
  if(left<=0){
    clearInterval(timer);running=false;
    if(mode==='focus'){done++;mode='break';left=BREAK;}else{mode='focus';left=FOCUS;}
  }
  paint();
}
$('toggle').onclick=()=>{running=!running;clearInterval(timer);if(running)timer=setInterval(tick,1000);paint();};
$('reset').onclick=()=>{running=false;clearInterval(timer);left=mode==='focus'?FOCUS:BREAK;paint();};
$('switch').onclick=()=>{running=false;clearInterval(timer);mode=mode==='focus'?'break':'focus';left=mode==='focus'?FOCUS:BREAK;paint();};
paint();`,
);

const pomodoroDashboard = shell(
  '专注看板',
  'dashboard',
  `<main class="wrap">
  <header><div><h1>专注看板</h1><p class="sub">用番茄数量衡量今天的产出</p></div><div class="big" id="clock">25:00</div></header>
  <section class="kpis" id="kpis"></section>
  <section class="grid">
    <div class="panel">
      <h2>控制台</h2>
      <p class="state" id="state">专注时段 · 未开始</p>
      <div class="track big-track"><i id="fill"></i></div>
      <div class="btns">
        <button id="toggle">开始</button>
        <button id="reset" class="ghost">重置</button>
        <button id="switch" class="ghost">切换模式</button>
      </div>
    </div>
    <div class="panel">
      <h2>完成记录</h2>
      <div id="log" class="list"></div>
    </div>
  </section>
</main>`,
  `body{background:#0b1020;color:#e2e8f0;padding:36px 18px;min-height:100vh}
.wrap{max-width:1000px;margin:0 auto;display:grid;gap:18px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
h1{font-size:26px;font-weight:800}
.sub{color:#94a3b8;font-size:13px;margin-top:4px}
.big{font-size:42px;font-weight:800;color:#38bdf8;font-variant-numeric:tabular-nums}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.kpi{padding:16px;border-radius:14px;background:rgba(148,163,184,.09);border:1px solid rgba(148,163,184,.18)}
.kpi span{display:block;font-size:12px;color:#94a3b8;margin-bottom:6px}
.kpi b{font-size:21px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:1.1fr 1fr;gap:14px}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.panel{padding:18px;border-radius:16px;background:rgba(148,163,184,.07);border:1px solid rgba(148,163,184,.16)}
h2{font-size:14px;font-weight:700;color:#cbd5e1;margin-bottom:14px}
.state{font-size:13px;color:#94a3b8;margin-bottom:10px}
.track{height:10px;border-radius:99px;background:rgba(148,163,184,.16);overflow:hidden}
.big-track i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#22d3ee,#6366f1);transition:width .95s linear}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
button{padding:10px 16px;border:0;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:700}
button.ghost{background:rgba(15,23,42,.7);color:#cbd5e1;border:1px solid rgba(148,163,184,.28)}
.list{display:grid;gap:8px;max-height:250px;overflow:auto}
.item{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:11px;background:rgba(15,23,42,.62);font-size:13px}
.item span{color:#94a3b8;font-variant-numeric:tabular-nums}
.empty{color:#64748b;font-size:13px}`,
  `const FOCUS=25*60,BREAK=5*60;
let mode='focus',left=FOCUS,running=false,timer=null,log=[];
const $=id=>document.getElementById(id);
function fmt(s){const m=Math.floor(s/60),x=s%60;return String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');}
function paint(){
  const total=mode==='focus'?FOCUS:BREAK;
  $('clock').textContent=fmt(left);
  $('fill').style.width=((1-left/total)*100)+'%';
  $('state').textContent=(mode==='focus'?'专注时段':'休息时段')+' · '+(running?'进行中':'已暂停');
  $('toggle').textContent=running?'暂停':'开始';
  const minutes=log.length*25;
  $('kpis').innerHTML='';
  [['完成番茄',log.length],['累计专注',minutes+' 分钟'],['当前模式',mode==='focus'?'专注':'休息'],['剩余时间',fmt(left)]]
    .forEach(([k,v])=>{const d=document.createElement('div');d.className='kpi';
      const s=document.createElement('span');s.textContent=k;const b=document.createElement('b');b.textContent=v;
      d.append(s,b);$('kpis').appendChild(d);});
  const box=$('log');box.innerHTML='';
  if(!log.length){const e=document.createElement('p');e.className='empty';e.textContent='还没有完成的番茄，点击开始试试。';box.appendChild(e);}
  log.slice().reverse().forEach((t,i)=>{
    const d=document.createElement('div');d.className='item';
    const a=document.createElement('b');a.textContent='第 '+(log.length-i)+' 个番茄';
    const s=document.createElement('span');s.textContent=t;
    d.append(a,s);box.appendChild(d);
  });
  document.title=fmt(left)+' · 专注看板';
}
function tick(){
  left--;
  if(left<=0){
    clearInterval(timer);running=false;
    if(mode==='focus'){
      log.push(new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));
      mode='break';left=BREAK;
    }else{mode='focus';left=FOCUS;}
  }
  paint();
}
$('toggle').onclick=()=>{running=!running;clearInterval(timer);if(running)timer=setInterval(tick,1000);paint();};
$('reset').onclick=()=>{running=false;clearInterval(timer);left=mode==='focus'?FOCUS:BREAK;paint();};
$('switch').onclick=()=>{running=false;clearInterval(timer);mode=mode==='focus'?'break':'focus';left=mode==='focus'?FOCUS:BREAK;paint();};
paint();`,
);

/* ============================== 通用兜底模板 ============================== */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const genericMinimal = (prompt: string) =>
  shell(
    '轻量记录台',
    'minimal',
    `<main class="wrap">
  <h1>轻量记录台</h1>
  <p class="sub">需求：${escapeHtml(prompt)}</p>
  <form id="f"><input id="i" placeholder="添加一条内容" autocomplete="off" /><button type="submit">添加</button></form>
  <ul id="list"></ul>
</main>`,
    `body{background:#f7f7f8;color:#18181b;padding:40px 16px}
.wrap{max-width:560px;margin:0 auto}
h1{font-size:22px;font-weight:700}
.sub{margin:8px 0 22px;font-size:13px;color:#71717a;line-height:1.6}
form{display:flex;gap:8px;margin-bottom:18px}
input{flex:1;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;background:#fff}
button{padding:10px 16px;border:0;border-radius:8px;background:#18181b;color:#fff}
ul{list-style:none;display:grid;gap:6px}
li{display:flex;gap:10px;padding:11px 12px;background:#fff;border:1px solid #e4e4e7;border-radius:8px;font-size:14px}
li span{flex:1}
li button{background:none;border:0;color:#a1a1aa}`,
    `const KEY='atoms-generic-minimal';
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('list');
function save(){localStorage.setItem(KEY,JSON.stringify(items));render();}
function render(){
  list.innerHTML='';
  items.forEach((t,i)=>{
    const li=document.createElement('li');
    const s=document.createElement('span');s.textContent=t;
    const b=document.createElement('button');b.textContent='×';b.onclick=()=>{items.splice(i,1);save();};
    li.append(s,b);list.appendChild(li);
  });
}
document.getElementById('f').onsubmit=e=>{
  e.preventDefault();const el=document.getElementById('i');
  if(!el.value.trim())return;items.unshift(el.value.trim());el.value='';save();
};
render();`,
  );

const genericCard = (prompt: string) =>
  shell(
    '创意记录台',
    'card',
    `<main class="wrap">
  <header><h1>创意记录台</h1><p>需求：${escapeHtml(prompt)}</p></header>
  <form id="f"><input id="i" placeholder="写下一条想法" autocomplete="off" /><button type="submit">收藏</button></form>
  <div id="list" class="cards"></div>
</main>`,
    `body{min-height:100vh;color:#1e1b4b;padding:44px 18px;background:linear-gradient(140deg,#eef2ff,#fdf2f8 55%,#ecfeff)}
.wrap{max-width:620px;margin:0 auto}
h1{font-size:28px;font-weight:800;letter-spacing:-.02em}
header p{margin:8px 0 22px;font-size:13px;color:#6d28d9;line-height:1.6}
form{display:flex;gap:10px;margin-bottom:20px}
input{flex:1;padding:13px 15px;border:1px solid rgba(255,255,255,.9);border-radius:14px;background:rgba(255,255,255,.78)}
button{padding:13px 20px;border:0;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font-weight:700}
.cards{display:grid;gap:11px}
.card{display:flex;gap:12px;align-items:center;padding:16px;border-radius:16px;background:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.95);box-shadow:0 14px 32px -26px rgba(76,29,149,.5);animation:pop .4s cubic-bezier(.16,1,.3,1) both}
@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.card span{flex:1;font-size:15px;font-weight:600}
.card button{background:none;border:0;color:#a5b4fc;font-size:20px}
.empty{padding:30px;text-align:center;border-radius:16px;border:1px dashed rgba(124,58,237,.35);color:#6d28d9}`,
    `const KEY='atoms-generic-card';
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('list');
function save(){localStorage.setItem(KEY,JSON.stringify(items));render();}
function render(){
  list.innerHTML='';
  if(!items.length){const d=document.createElement('div');d.className='empty';d.textContent='空空如也，先记下一个念头。';list.appendChild(d);}
  items.forEach((t,i)=>{
    const c=document.createElement('div');c.className='card';
    const s=document.createElement('span');s.textContent=t;
    const b=document.createElement('button');b.textContent='×';b.onclick=()=>{items.splice(i,1);save();};
    c.append(s,b);list.appendChild(c);
  });
}
document.getElementById('f').onsubmit=e=>{
  e.preventDefault();const el=document.getElementById('i');
  if(!el.value.trim())return;items.unshift(el.value.trim());el.value='';save();
};
render();`,
  );

const genericDashboard = (prompt: string) =>
  shell(
    '数据记录台',
    'dashboard',
    `<main class="wrap">
  <header><div><h1>数据记录台</h1><p class="sub">需求：${escapeHtml(prompt)}</p></div><div class="big" id="count">0</div></header>
  <section class="kpis" id="kpis"></section>
  <section class="grid">
    <div class="panel"><h2>新增条目</h2>
      <form id="f"><input id="i" placeholder="条目名称" autocomplete="off" /><input id="v" type="number" placeholder="数值" /><button type="submit">添加</button></form>
    </div>
    <div class="panel"><h2>条目列表</h2><div id="list" class="list"></div></div>
  </section>
</main>`,
    `body{background:#0b1020;color:#e2e8f0;padding:36px 18px;min-height:100vh}
.wrap{max-width:980px;margin:0 auto;display:grid;gap:18px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
h1{font-size:26px;font-weight:800}
.sub{color:#94a3b8;font-size:13px;margin-top:4px;max-width:36rem;line-height:1.6}
.big{font-size:36px;font-weight:800;color:#38bdf8;font-variant-numeric:tabular-nums}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.kpi{padding:16px;border-radius:14px;background:rgba(148,163,184,.09);border:1px solid rgba(148,163,184,.18)}
.kpi span{display:block;font-size:12px;color:#94a3b8;margin-bottom:6px}
.kpi b{font-size:20px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:1fr 1.2fr;gap:14px}
@media(max-width:800px){.grid{grid-template-columns:1fr}}
.panel{padding:18px;border-radius:16px;background:rgba(148,163,184,.07);border:1px solid rgba(148,163,184,.16)}
h2{font-size:14px;font-weight:700;color:#cbd5e1;margin-bottom:14px}
form{display:grid;gap:9px}
input{padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.7);color:#e2e8f0}
button{padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:700}
.list{display:grid;gap:8px;max-height:280px;overflow:auto}
.item{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:11px;background:rgba(15,23,42,.62)}
.item .n{flex:1;font-size:14px}
.item .v{font-weight:700;font-variant-numeric:tabular-nums;color:#7dd3fc}
.item button{background:none;border:0;color:#64748b}
.empty{color:#64748b;font-size:13px}`,
    `const KEY='atoms-generic-dash';
let rows=JSON.parse(localStorage.getItem(KEY)||'[]');
const $=id=>document.getElementById(id);
function save(){localStorage.setItem(KEY,JSON.stringify(rows));render();}
function render(){
  const total=rows.reduce((s,r)=>s+r.value,0);
  $('count').textContent=rows.length;
  $('kpis').innerHTML='';
  const max=rows.reduce((m,r)=>r.value>m.value?r:m,{value:0,name:'—'});
  [['条目数量',rows.length],['数值合计',total],['平均值',rows.length?(total/rows.length).toFixed(1):'0'],['最大条目',max.name]]
    .forEach(([k,v])=>{const d=document.createElement('div');d.className='kpi';
      const s=document.createElement('span');s.textContent=k;const b=document.createElement('b');b.textContent=v;
      d.append(s,b);$('kpis').appendChild(d);});
  const list=$('list');list.innerHTML='';
  if(!rows.length){const e=document.createElement('p');e.className='empty';e.textContent='暂无条目，先在左侧添加一条。';list.appendChild(e);}
  rows.forEach((r,i)=>{
    const d=document.createElement('div');d.className='item';
    const n=document.createElement('div');n.className='n';n.textContent=r.name;
    const v=document.createElement('div');v.className='v';v.textContent=r.value;
    const x=document.createElement('button');x.textContent='×';x.onclick=()=>{rows.splice(i,1);save();};
    d.append(n,v,x);list.appendChild(d);
  });
}
$('f').onsubmit=e=>{
  e.preventDefault();
  const name=$('i').value.trim();const value=parseFloat($('v').value);
  if(!name||Number.isNaN(value))return;
  rows.unshift({name:name,value:value});$('i').value='';$('v').value='';save();
};
render();`,
  );

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'todo',
    label: '待办清单',
    description: '帮我生成一个待办事项管理应用，可以添加任务、勾选完成、删除任务，并显示剩余数量，数据要保存在本地。',
    recommendedStyle: 'minimal',
    keywords: ['待办', '待记', '任务', 'todo', '清单', '事项', '计划'],
    code: { minimal: todoMinimal, card: todoCard, dashboard: todoDashboard },
  },
  {
    id: 'ledger',
    label: '记账本',
    description: '帮我生成一个记账本应用，可以录入项目、金额和分类，展示明细列表与累计支出，并能按分类统计占比。',
    recommendedStyle: 'card',
    keywords: ['记账', '账本', '消费', '预算', '开支', '财务', '花销', 'expense'],
    code: { minimal: ledgerMinimal, card: ledgerCard, dashboard: ledgerDashboard },
  },
  {
    id: 'pomodoro',
    label: '番茄钟',
    description: '帮我生成一个番茄钟应用，25 分钟专注与 5 分钟休息可切换，支持开始、暂停、重置，并统计已完成的番茄数量。',
    recommendedStyle: 'dashboard',
    keywords: ['番茄', '计时', '专注', 'timer', 'pomodoro', '倒计时', '时钟'],
    code: { minimal: pomodoroMinimal, card: pomodoroCard, dashboard: pomodoroDashboard },
  },
];

export interface TemplateMatch {
  template: PresetTemplate | null;
  /** 推断出的应用名称 */
  name: string;
  /** 对应风格的完整代码 */
  code: string;
}

/**
 * 只做关键词命中判断，不返回通用兜底模板。
 * 「模板优先」加速路径必须能区分「真的命中预置模板」与「只能兜底」：
 * 兜底模板的内容与用户需求无关，绝不能拿去顶替模型产出。
 */
export function findPresetTemplate(prompt: string): PresetTemplate | null {
  const lower = prompt.toLowerCase();
  return (
    PRESET_TEMPLATES.find((t) => t.keywords.some((k) => lower.includes(k.toLowerCase()))) ?? null
  );
}

/** 按关键词匹配预置模板；无匹配时返回对应风格的通用兜底模板 */
export function matchTemplate(prompt: string, style: StyleTag): TemplateMatch {
  const hit = findPresetTemplate(prompt);
  if (hit) {
    return { template: hit, name: hit.label, code: hit.code[style] };
  }
  const fallback: Record<StyleTag, string> = {
    minimal: genericMinimal(prompt),
    card: genericCard(prompt),
    dashboard: genericDashboard(prompt),
  };
  return {
    template: null,
    name: prompt.trim().slice(0, 14) || '未命名应用',
    code: fallback[style],
  };
}

/** 对已有代码做「迭代」的本地兜底：注入一条修改批注 */
export function mockIterate(currentCode: string, instruction: string, style: StyleTag): string {
  const note = `<div data-atoms-note style="position:fixed;left:12px;bottom:12px;z-index:9999;max-width:min(420px,86vw);padding:10px 13px;border-radius:12px;font:500 12px/1.6 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;background:rgba(17,24,39,.88);color:#f9fafb;box-shadow:0 12px 30px -16px rgba(0,0,0,.6)">离线迭代记录（${style}）：${escapeHtml(
    instruction,
  )}</div>`;
  const cleaned = currentCode.replace(/<div data-atoms-note[\s\S]*?<\/div>\s*(?=<\/body>|$)/i, '');
  if (cleaned.includes('</body>')) {
    return cleaned.replace('</body>', `${note}\n</body>`);
  }
  return `${cleaned}\n${note}`;
}