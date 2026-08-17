/**
 * 预置模板蓝图库。
 *
 * 双重作用：
 *  1. Planner 阶段的模板匹配来源（FindBestTemplate 关键词长度加权评分）。
 *  2. LLM 不可用时的降级方案 —— 直接产出完整可运行的三件套代码。
 */

import type { AppFiles } from '../db';

export interface Blueprint {
  /** 应用名称 */
  appName: string;
  /** 一句话概述 */
  summary: string;
  /** 核心实体（数据模型） */
  entities: { name: string; fields: string[] }[];
  /** 功能点列表 */
  features: string[];
  /** 交互流程 */
  flows: string[];
  /** 持久化方案 */
  persistence: string;
  /** 视觉风格 */
  style: string;
}

export interface TemplateBlueprint {
  id: string;
  /** 匹配关键词，命中时按关键词长度加权计分 */
  keywords: string[];
  blueprint: Blueprint;
  files: AppFiles;
}

/* ------------------------------------------------------------------ */
/* 共享样式 —— 生成应用统一的现代暗色风格                              */
/* ------------------------------------------------------------------ */

const SHARED_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #0f172a;
  --surface: #172033;
  --surface-2: #1e293b;
  --border: #2c3a52;
  --text: #e8edf7;
  --muted: #94a3b8;
  --accent: #7c6cf5;
  --accent-soft: rgba(124, 108, 245, 0.16);
  --danger: #f2576b;
  --success: #34d399;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: radial-gradient(1200px 600px at 15% -10%, #1d2742 0%, var(--bg) 55%);
  color: var(--text);
  min-height: 100vh;
  padding: 32px 20px 64px;
  line-height: 1.6;
}
.wrap { max-width: 880px; margin: 0 auto; }
header { margin-bottom: 28px; }
h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
header p { color: var(--muted); margin-top: 6px; font-size: 14px; }
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 20px;
}
.panel h2 { font-size: 15px; font-weight: 600; margin-bottom: 14px; color: var(--muted); letter-spacing: 0.04em; text-transform: uppercase; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 13px; color: var(--muted); }
input, select, textarea {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); }
.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; align-items: end; }
button {
  background: var(--accent);
  color: #ffffff;
  border: none;
  border-radius: 9px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.15s;
}
button:hover { opacity: 0.9; }
button:active { transform: translateY(1px); }
button.ghost { background: transparent; border: 1px solid var(--border); color: var(--muted); }
button.danger { background: transparent; border: 1px solid rgba(242, 87, 107, 0.4); color: var(--danger); padding: 6px 12px; font-size: 13px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; }
.stat { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
.stat span { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.stat strong { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
ul.list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
ul.list li {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 11px; padding: 12px 14px;
}
.item-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.item-title { font-size: 15px; font-weight: 600; word-break: break-word; }
.item-meta { font-size: 12px; color: var(--muted); }
.amount { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: #c7c0ff; font-size: 12px; }
.empty { text-align: center; padding: 36px 16px; color: var(--muted); font-size: 14px; }
.done .item-title { text-decoration: line-through; color: var(--muted); }
.filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.filters button { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 6px 14px; font-size: 13px; }
.filters button.active { background: var(--accent-soft); border-color: var(--accent); color: #c7c0ff; }
input[type="checkbox"] { width: 17px; height: 17px; accent-color: var(--accent); cursor: pointer; }
@media (max-width: 560px) { body { padding: 20px 14px 48px; } h1 { font-size: 22px; } }`;

/* ------------------------------------------------------------------ */
/* 模板 1：记账本                                                      */
/* ------------------------------------------------------------------ */

const LEDGER_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>个人记账本</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="wrap">
  <header>
    <h1>个人记账本</h1>
    <p>记录每一笔开销，按月统计总支出</p>
  </header>

  <section class="panel">
    <h2>新增记录</h2>
    <div class="row">
      <div class="field">
        <label for="desc">项目说明</label>
        <input id="desc" type="text" placeholder="例如：午餐">
      </div>
      <div class="field">
        <label for="amount">金额（元）</label>
        <input id="amount" type="number" step="0.01" min="0" placeholder="0.00">
      </div>
      <div class="field">
        <label for="category">分类</label>
        <select id="category">
          <option value="餐饮">餐饮</option>
          <option value="交通">交通</option>
          <option value="购物">购物</option>
          <option value="居住">居住</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <div class="field">
        <label for="date">日期</label>
        <input id="date" type="date">
      </div>
      <button id="addBtn" type="button">添加记录</button>
    </div>
  </section>

  <section class="panel">
    <h2>本月统计</h2>
    <div class="stats">
      <div class="stat"><span>本月总开销</span><strong id="monthTotal">¥0.00</strong></div>
      <div class="stat"><span>本月笔数</span><strong id="monthCount">0</strong></div>
      <div class="stat"><span>累计总开销</span><strong id="allTotal">¥0.00</strong></div>
    </div>
  </section>

  <section class="panel">
    <h2>记录明细</h2>
    <div class="filters" id="filters">
      <button type="button" class="active" data-filter="all">全部</button>
      <button type="button" data-filter="餐饮">餐饮</button>
      <button type="button" data-filter="交通">交通</button>
      <button type="button" data-filter="购物">购物</button>
      <button type="button" data-filter="居住">居住</button>
      <button type="button" data-filter="其他">其他</button>
    </div>
    <ul class="list" id="list"></ul>
    <div class="empty" id="empty">还没有记录，先添加第一笔开销吧</div>
  </section>
</div>
<script src="app.js"></script>
</body>
</html>`;

const LEDGER_JS = `(function () {
  'use strict';

  var STORAGE_KEY = 'atoms_ledger_records';
  var records = [];
  var activeFilter = 'all';

  var descEl = document.getElementById('desc');
  var amountEl = document.getElementById('amount');
  var categoryEl = document.getElementById('category');
  var dateEl = document.getElementById('date');
  var addBtn = document.getElementById('addBtn');
  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('empty');
  var filtersEl = document.getElementById('filters');
  var monthTotalEl = document.getElementById('monthTotal');
  var monthCountEl = document.getElementById('monthCount');
  var allTotalEl = document.getElementById('allTotal');

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      records = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(records)) records = [];
    } catch (e) {
      records = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      /* 存储不可用时保持内存态 */
    }
  }

  function money(value) {
    return '¥' + Number(value || 0).toFixed(2);
  }

  function todayString() {
    var now = new Date();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + m + '-' + d;
  }

  function currentMonthPrefix() {
    return todayString().slice(0, 7);
  }

  function addRecord() {
    var desc = descEl.value.trim();
    var amount = parseFloat(amountEl.value);
    if (!desc) { descEl.focus(); return; }
    if (!isFinite(amount) || amount <= 0) { amountEl.focus(); return; }

    records.unshift({
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      desc: desc,
      amount: amount,
      category: categoryEl.value,
      date: dateEl.value || todayString()
    });
    save();
    descEl.value = '';
    amountEl.value = '';
    render();
  }

  function removeRecord(id) {
    records = records.filter(function (item) { return item.id !== id; });
    save();
    render();
  }

  function renderStats() {
    var prefix = currentMonthPrefix();
    var monthSum = 0;
    var monthCount = 0;
    var allSum = 0;
    records.forEach(function (item) {
      allSum += Number(item.amount) || 0;
      if (String(item.date).indexOf(prefix) === 0) {
        monthSum += Number(item.amount) || 0;
        monthCount += 1;
      }
    });
    monthTotalEl.textContent = money(monthSum);
    monthCountEl.textContent = String(monthCount);
    allTotalEl.textContent = money(allSum);
  }

  function render() {
    var visible = activeFilter === 'all'
      ? records
      : records.filter(function (item) { return item.category === activeFilter; });

    listEl.innerHTML = '';
    visible.forEach(function (item) {
      var li = document.createElement('li');

      var main = document.createElement('div');
      main.className = 'item-main';
      var title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = item.desc;
      var meta = document.createElement('span');
      meta.className = 'item-meta';
      meta.textContent = item.date + ' · ' + item.category;
      main.appendChild(title);
      main.appendChild(meta);

      var right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '12px';
      var amount = document.createElement('span');
      amount.className = 'amount';
      amount.textContent = money(item.amount);
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = '删除';
      del.addEventListener('click', function () { removeRecord(item.id); });
      right.appendChild(amount);
      right.appendChild(del);

      li.appendChild(main);
      li.appendChild(right);
      listEl.appendChild(li);
    });

    emptyEl.style.display = visible.length ? 'none' : 'block';
    emptyEl.textContent = records.length
      ? '该分类下暂无记录'
      : '还没有记录，先添加第一笔开销吧';
    renderStats();
  }

  addBtn.addEventListener('click', addRecord);
  descEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') addRecord(); });
  amountEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') addRecord(); });

  filtersEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    activeFilter = btn.getAttribute('data-filter');
    Array.prototype.forEach.call(filtersEl.querySelectorAll('button'), function (node) {
      node.classList.toggle('active', node === btn);
    });
    render();
  });

  dateEl.value = todayString();
  load();
  render();
})();`;

/* ------------------------------------------------------------------ */
/* 模板 2：待办清单                                                    */
/* ------------------------------------------------------------------ */

const TODO_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>待办清单</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="wrap">
  <header>
    <h1>待办清单</h1>
    <p>添加任务、标记完成，数据自动保存在本地</p>
  </header>

  <section class="panel">
    <h2>新增任务</h2>
    <div class="row">
      <div class="field">
        <label for="title">任务内容</label>
        <input id="title" type="text" placeholder="例如：整理周报">
      </div>
      <div class="field">
        <label for="priority">优先级</label>
        <select id="priority">
          <option value="普通">普通</option>
          <option value="重要">重要</option>
          <option value="紧急">紧急</option>
        </select>
      </div>
      <button id="addBtn" type="button">添加任务</button>
    </div>
  </section>

  <section class="panel">
    <h2>进度概览</h2>
    <div class="stats">
      <div class="stat"><span>全部任务</span><strong id="totalCount">0</strong></div>
      <div class="stat"><span>待完成</span><strong id="activeCount">0</strong></div>
      <div class="stat"><span>已完成</span><strong id="doneCount">0</strong></div>
    </div>
  </section>

  <section class="panel">
    <h2>任务列表</h2>
    <div class="filters" id="filters">
      <button type="button" class="active" data-filter="all">全部</button>
      <button type="button" data-filter="active">待完成</button>
      <button type="button" data-filter="done">已完成</button>
    </div>
    <ul class="list" id="list"></ul>
    <div class="empty" id="empty">暂无任务，添加第一个待办事项吧</div>
  </section>
</div>
<script src="app.js"></script>
</body>
</html>`;

const TODO_JS = `(function () {
  'use strict';

  var STORAGE_KEY = 'atoms_todo_items';
  var todos = [];
  var activeFilter = 'all';

  var titleEl = document.getElementById('title');
  var priorityEl = document.getElementById('priority');
  var addBtn = document.getElementById('addBtn');
  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('empty');
  var filtersEl = document.getElementById('filters');
  var totalCountEl = document.getElementById('totalCount');
  var activeCountEl = document.getElementById('activeCount');
  var doneCountEl = document.getElementById('doneCount');

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      todos = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(todos)) todos = [];
    } catch (e) {
      todos = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      /* 忽略存储异常 */
    }
  }

  function addTodo() {
    var title = titleEl.value.trim();
    if (!title) { titleEl.focus(); return; }
    todos.unshift({
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      title: title,
      priority: priorityEl.value,
      done: false,
      createdAt: new Date().toISOString().slice(0, 10)
    });
    save();
    titleEl.value = '';
    render();
  }

  function toggleTodo(id) {
    todos = todos.map(function (item) {
      return item.id === id ? Object.assign({}, item, { done: !item.done }) : item;
    });
    save();
    render();
  }

  function removeTodo(id) {
    todos = todos.filter(function (item) { return item.id !== id; });
    save();
    render();
  }

  function render() {
    var visible = todos.filter(function (item) {
      if (activeFilter === 'active') return !item.done;
      if (activeFilter === 'done') return item.done;
      return true;
    });

    listEl.innerHTML = '';
    visible.forEach(function (item) {
      var li = document.createElement('li');
      if (item.done) li.className = 'done';

      var left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '12px';
      left.style.minWidth = '0';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!item.done;
      checkbox.addEventListener('change', function () { toggleTodo(item.id); });

      var main = document.createElement('div');
      main.className = 'item-main';
      var title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = item.title;
      var meta = document.createElement('span');
      meta.className = 'item-meta';
      meta.textContent = item.createdAt;
      main.appendChild(title);
      main.appendChild(meta);

      left.appendChild(checkbox);
      left.appendChild(main);

      var right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '10px';
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = item.priority;
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = '删除';
      del.addEventListener('click', function () { removeTodo(item.id); });
      right.appendChild(tag);
      right.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    });

    emptyEl.style.display = visible.length ? 'none' : 'block';
    totalCountEl.textContent = String(todos.length);
    activeCountEl.textContent = String(todos.filter(function (i) { return !i.done; }).length);
    doneCountEl.textContent = String(todos.filter(function (i) { return i.done; }).length);
  }

  addBtn.addEventListener('click', addTodo);
  titleEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') addTodo(); });

  filtersEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    activeFilter = btn.getAttribute('data-filter');
    Array.prototype.forEach.call(filtersEl.querySelectorAll('button'), function (node) {
      node.classList.toggle('active', node === btn);
    });
    render();
  });

  load();
  render();
})();`;

/* ------------------------------------------------------------------ */
/* 模板 3：通用 CRUD 清单（兜底）                                       */
/* ------------------------------------------------------------------ */

const GENERIC_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>数据管理台</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="wrap">
  <header>
    <h1>数据管理台</h1>
    <p>支持新增、搜索、删除条目，数据保存在浏览器本地</p>
  </header>

  <section class="panel">
    <h2>新增条目</h2>
    <div class="row">
      <div class="field">
        <label for="name">名称</label>
        <input id="name" type="text" placeholder="请输入名称">
      </div>
      <div class="field">
        <label for="note">备注</label>
        <input id="note" type="text" placeholder="补充说明">
      </div>
      <div class="field">
        <label for="status">状态</label>
        <select id="status">
          <option value="进行中">进行中</option>
          <option value="已完成">已完成</option>
          <option value="已归档">已归档</option>
        </select>
      </div>
      <button id="addBtn" type="button">新增</button>
    </div>
  </section>

  <section class="panel">
    <h2>概览</h2>
    <div class="stats">
      <div class="stat"><span>条目总数</span><strong id="totalCount">0</strong></div>
      <div class="stat"><span>进行中</span><strong id="activeCount">0</strong></div>
      <div class="stat"><span>已完成</span><strong id="doneCount">0</strong></div>
    </div>
  </section>

  <section class="panel">
    <h2>条目列表</h2>
    <div class="field" style="margin-bottom:14px;">
      <label for="search">搜索</label>
      <input id="search" type="text" placeholder="按名称或备注搜索">
    </div>
    <ul class="list" id="list"></ul>
    <div class="empty" id="empty">暂无数据，先新增一条吧</div>
  </section>
</div>
<script src="app.js"></script>
</body>
</html>`;

const GENERIC_JS = `(function () {
  'use strict';

  var STORAGE_KEY = 'atoms_generic_items';
  var items = [];

  var nameEl = document.getElementById('name');
  var noteEl = document.getElementById('note');
  var statusEl = document.getElementById('status');
  var addBtn = document.getElementById('addBtn');
  var searchEl = document.getElementById('search');
  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('empty');
  var totalCountEl = document.getElementById('totalCount');
  var activeCountEl = document.getElementById('activeCount');
  var doneCountEl = document.getElementById('doneCount');

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      /* 忽略存储异常 */
    }
  }

  function addItem() {
    var name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }
    items.unshift({
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      name: name,
      note: noteEl.value.trim(),
      status: statusEl.value,
      createdAt: new Date().toISOString().slice(0, 10)
    });
    save();
    nameEl.value = '';
    noteEl.value = '';
    render();
  }

  function removeItem(id) {
    items = items.filter(function (item) { return item.id !== id; });
    save();
    render();
  }

  function render() {
    var keyword = searchEl.value.trim().toLowerCase();
    var visible = keyword
      ? items.filter(function (item) {
          return (item.name + ' ' + item.note).toLowerCase().indexOf(keyword) >= 0;
        })
      : items;

    listEl.innerHTML = '';
    visible.forEach(function (item) {
      var li = document.createElement('li');

      var main = document.createElement('div');
      main.className = 'item-main';
      var title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = item.name;
      var meta = document.createElement('span');
      meta.className = 'item-meta';
      meta.textContent = item.createdAt + (item.note ? ' · ' + item.note : '');
      main.appendChild(title);
      main.appendChild(meta);

      var right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '10px';
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = item.status;
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = '删除';
      del.addEventListener('click', function () { removeItem(item.id); });
      right.appendChild(tag);
      right.appendChild(del);

      li.appendChild(main);
      li.appendChild(right);
      listEl.appendChild(li);
    });

    emptyEl.style.display = visible.length ? 'none' : 'block';
    emptyEl.textContent = items.length ? '没有匹配的条目' : '暂无数据，先新增一条吧';
    totalCountEl.textContent = String(items.length);
    activeCountEl.textContent = String(items.filter(function (i) { return i.status === '进行中'; }).length);
    doneCountEl.textContent = String(items.filter(function (i) { return i.status === '已完成'; }).length);
  }

  addBtn.addEventListener('click', addItem);
  nameEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') addItem(); });
  searchEl.addEventListener('input', render);

  load();
  render();
})();`;


/* ------------------------------------------------------------------ */
/* 春节晚会 PPT 展示                                                   */
/* ------------------------------------------------------------------ */

const PPT_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>春节联欢晚会 · 节目展演</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app">
  <div class="bg-clouds"></div>

  <div class="lantern lantern-left">
    <div class="lantern-cap"></div>
    <div class="lantern-body"><span class="lantern-text">福</span></div>
    <div class="lantern-cap"></div>
    <div class="lantern-tassel"></div>
  </div>
  <div class="lantern lantern-right">
    <div class="lantern-cap"></div>
    <div class="lantern-body"><span class="lantern-text">春</span></div>
    <div class="lantern-cap"></div>
    <div class="lantern-tassel"></div>
  </div>

  <header class="topbar">
    <div class="brand">
      <span class="brand-seal">春</span>
      <span class="brand-text">春节联欢晚会</span>
    </div>
    <div class="topbar-meta">
      <span id="pageIndicator" class="page-indicator">01 / 10</span>
      <button id="catalogBtn" class="icon-btn" title="节目目录" aria-label="节目目录">
        <svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <button id="autoBtn" class="icon-btn" title="自动播放" aria-label="自动播放">
        <svg viewBox="0 0 24 24"><polygon points="7,4 20,12 7,20" fill="currentColor"/></svg>
      </button>
      <button id="fullscreenBtn" class="icon-btn" title="全屏展示" aria-label="全屏展示">
        <svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      </button>
    </div>
  </header>

  <main class="stage">
    <button id="prevBtn" class="nav-btn nav-prev" aria-label="上一张">
      <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    </button>
    <div id="slideContainer" class="slide-container" data-direction="forward"></div>
    <button id="nextBtn" class="nav-btn nav-next" aria-label="下一张">
      <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    </button>
  </main>

  <div class="progress-bar">
    <div id="progressFill" class="progress-fill"></div>
  </div>

  <footer class="controls">
    <button id="prevBtnBottom" class="ctrl-btn">上一节目</button>
    <div id="dots" class="dots"></div>
    <button id="nextBtnBottom" class="ctrl-btn">下一节目</button>
  </footer>

  <aside id="catalog" class="catalog">
    <div class="catalog-header">
      <h3>节目单</h3>
      <button id="closeCatalog" class="close-btn" aria-label="关闭目录">×</button>
    </div>
    <ul id="catalogList" class="catalog-list"></ul>
    <div class="catalog-footer">
      <button id="addSlideBtn" class="add-btn">＋ 新增节目</button>
      <div class="catalog-hint">点击节目快速跳转 · 方向键翻页 · F 键全屏 · P 键自动播放</div>
    </div>
  </aside>
  <div id="catalogOverlay" class="catalog-overlay"></div>

  <div id="addModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>新增节目</h3>
        <button id="closeAddModal" class="close-btn" aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>节目标题</label>
          <input type="text" id="inputTitle" maxlength="20" placeholder="请输入节目标题">
        </div>
        <div class="form-row">
          <label>节目类型</label>
          <input type="text" id="inputType" maxlength="10" placeholder="如：歌曲、舞蹈、相声">
        </div>
        <div class="form-row">
          <label>节目简介</label>
          <textarea id="inputContent" rows="3" maxlength="120" placeholder="请输入节目简介"></textarea>
        </div>
        <div class="form-row">
          <label>表演者</label>
          <input type="text" id="inputPerformer" maxlength="20" placeholder="请输入表演者">
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancelAdd" class="ctrl-btn">取消</button>
        <button id="confirmAdd" class="ctrl-btn primary">确认新增</button>
      </div>
    </div>
  </div>

  <div id="fireworks" class="fireworks"></div>
  <div id="toast" class="toast"></div>
</div>
<script src="app.js"></script>
</body>
</html>`;

const PPT_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --red-darkest: #0a0202;
  --red-deep: #1f0606;
  --red-mid: #3d0a0a;
  --red: #6b0d0d;
  --red-bright: #c41e3a;
  --red-light: #e63946;
  --gold-dim: #8a6f1f;
  --gold: #d4af37;
  --gold-bright: #f4d03f;
  --gold-light: #ffe5a0;
}

html, body {
  height: 100%;
  overflow: hidden;
  background: var(--red-darkest);
  font-family: "STKaiti", "KaiTi", "楷体", "STSong", "宋体", "Songti SC", serif;
  color: var(--gold-light);
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

#app {
  position: relative;
  width: 100vw;
  height: 100vh;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(196, 30, 58, 0.3) 0%, transparent 60%),
    radial-gradient(ellipse at 50% 100%, rgba(212, 175, 55, 0.08) 0%, transparent 60%),
    linear-gradient(180deg, #2d0a0a 0%, #1a0606 50%, #0d0303 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.bg-clouds {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120'><path d='M30,70 Q30,50 50,50 Q55,30 80,35 Q105,20 120,40 Q145,30 155,50 Q175,45 180,65 Q200,60 200,80 Q200,95 180,95 L50,95 Q30,95 30,70 Z' fill='%23d4af37' opacity='0.6'/></svg>");
  background-repeat: repeat;
  background-size: 320px 160px;
  opacity: 0.05;
  animation: cloudDrift 90s linear infinite;
  pointer-events: none;
  z-index: 1;
}
@keyframes cloudDrift {
  0% { background-position: 0 0; }
  100% { background-position: 320px 0; }
}

.lantern {
  position: absolute;
  top: 70px;
  width: 70px;
  z-index: 3;
  pointer-events: none;
  animation: lanternSwing 4.5s ease-in-out infinite;
  transform-origin: top center;
}
.lantern-left { left: 4%; }
.lantern-right { right: 4%; animation-delay: -2.2s; }

.lantern-cap {
  width: 32px;
  height: 7px;
  margin: 0 auto;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold-dim));
  border-radius: 3px;
  border: 1px solid var(--gold-dim);
}
.lantern-body {
  width: 70px;
  height: 80px;
  margin: -1px auto 0;
  background: radial-gradient(ellipse at 35% 35%, #ff6b4a 0%, #c41e3a 55%, #6b0d0d 100%);
  border-radius: 50%;
  border: 2.5px solid var(--gold);
  box-shadow:
    inset 0 0 25px rgba(255, 180, 80, 0.5),
    inset 0 0 8px rgba(255, 230, 150, 0.4),
    0 0 35px rgba(255, 80, 60, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.lantern-body::before, .lantern-body::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 78px;
  height: 1.5px;
  background: rgba(212, 175, 55, 0.4);
}
.lantern-body::before { top: 28%; }
.lantern-body::after { top: 60%; }
.lantern-text {
  color: var(--gold-bright);
  font-size: 30px;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.9);
  font-family: "STKaiti", "KaiTi", serif;
}
.lantern-tassel {
  width: 3px;
  height: 22px;
  background: linear-gradient(180deg, var(--gold), var(--gold-bright));
  margin: 0 auto;
  position: relative;
}
.lantern-tassel::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 16px;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold-dim));
  border-radius: 0 0 7px 7px;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
}
@keyframes lanternSwing {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
}

.topbar {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 36px;
  flex-shrink: 0;
}
.brand { display: flex; align-items: center; gap: 14px; }
.brand-seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  color: var(--gold-bright);
  border: 2px solid var(--gold);
  border-radius: 6px;
  font-size: 26px;
  font-weight: bold;
  box-shadow: 0 2px 14px rgba(196, 30, 58, 0.6), inset 0 0 10px rgba(255, 200, 100, 0.3);
  font-family: "STKaiti", "KaiTi", serif;
}
.brand-text {
  font-size: 22px;
  letter-spacing: 6px;
  color: var(--gold-bright);
  text-shadow: 0 0 18px rgba(212, 175, 55, 0.4);
  font-weight: bold;
}
.topbar-meta { display: flex; align-items: center; gap: 12px; }
.page-indicator {
  font-family: "Georgia", "Times New Roman", serif;
  color: var(--gold-light);
  font-size: 15px;
  margin-right: 8px;
  letter-spacing: 3px;
  opacity: 0.85;
}
.icon-btn {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(212, 175, 55, 0.4);
  background: rgba(0, 0, 0, 0.35);
  color: var(--gold-light);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  padding: 0;
}
.icon-btn svg { width: 20px; height: 20px; }
.icon-btn:hover {
  background: rgba(196, 30, 58, 0.45);
  border-color: var(--gold);
  color: var(--gold-bright);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(196, 30, 58, 0.4);
}
.icon-btn.active {
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  border-color: var(--gold);
  color: var(--gold-bright);
  box-shadow: 0 0 18px rgba(212, 175, 55, 0.4);
}
.icon-btn.active svg { animation: spinPulse 2s linear infinite; }
@keyframes spinPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.stage {
  position: relative;
  z-index: 5;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 90px;
  min-height: 0;
}
.slide-container {
  position: relative;
  width: 100%;
  max-width: 1280px;
  height: 100%;
  max-height: 620px;
}
.slide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transform: translateX(60px) scale(0.95);
  transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s 0.7s;
  pointer-events: none;
  padding: 40px;
  overflow: hidden;
}
.slide.active {
  opacity: 1;
  visibility: visible;
  transform: translateX(0) scale(1);
  pointer-events: auto;
  transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s 0s;
}
[data-direction="backward"] .slide:not(.active) {
  transform: translateX(-60px) scale(0.95);
}

.slide-opening { text-align: center; }
.opening-seal {
  display: inline-block;
  padding: 8px 28px;
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  border: 2px solid var(--gold);
  border-radius: 4px;
  color: var(--gold-bright);
  font-size: 20px;
  letter-spacing: 8px;
  margin-bottom: 36px;
  box-shadow: 0 4px 20px rgba(196, 30, 58, 0.4);
}
.opening-title {
  font-size: clamp(48px, 8.5vw, 108px);
  font-weight: bold;
  background: linear-gradient(180deg, var(--gold-light) 0%, var(--gold-bright) 40%, var(--gold) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 16px;
  margin-bottom: 24px;
  font-family: "STKaiti", "KaiTi", serif;
  filter: drop-shadow(0 4px 30px rgba(212, 175, 55, 0.4));
  animation: titleFloat 4s ease-in-out infinite;
}
@keyframes titleFloat {
  0%, 100% { filter: drop-shadow(0 4px 30px rgba(212, 175, 55, 0.4)); }
  50% { filter: drop-shadow(0 4px 50px rgba(212, 175, 55, 0.85)); }
}
.opening-subtitle {
  font-size: clamp(18px, 2.4vw, 30px);
  color: var(--gold-light);
  letter-spacing: 12px;
  margin-bottom: 50px;
  opacity: 0.9;
}
.opening-divider {
  width: 200px;
  height: 2px;
  margin: 0 auto 30px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  position: relative;
}
.opening-divider::before {
  content: '◆';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--gold);
  background: var(--red-deep);
  padding: 0 12px;
  font-size: 14px;
}
.opening-date {
  font-size: 18px;
  color: var(--gold-light);
  opacity: 0.7;
  letter-spacing: 6px;
}

.slide-speech { max-width: 900px; width: 100%; text-align: center; }
.speech-label {
  display: inline-block;
  padding: 6px 22px;
  background: rgba(196, 30, 58, 0.3);
  border: 1px solid var(--gold);
  border-radius: 20px;
  color: var(--gold-bright);
  font-size: 15px;
  letter-spacing: 6px;
  margin-bottom: 28px;
}
.speech-title {
  font-size: clamp(36px, 5.5vw, 60px);
  color: var(--gold-bright);
  letter-spacing: 12px;
  margin-bottom: 32px;
  text-shadow: 0 0 30px rgba(212, 175, 55, 0.5);
  font-family: "STKaiti", "KaiTi", serif;
}
.speech-content {
  font-size: clamp(16px, 1.8vw, 21px);
  color: var(--gold-light);
  line-height: 2.1;
  letter-spacing: 3px;
  margin-bottom: 36px;
  padding: 28px 44px;
  border-top: 1px solid rgba(212, 175, 55, 0.3);
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
  position: relative;
  background: rgba(0, 0, 0, 0.2);
}
.speech-meta {
  display: flex;
  justify-content: center;
  gap: 40px;
  font-size: 15px;
  color: var(--gold-light);
  opacity: 0.7;
  letter-spacing: 2px;
}
.speech-meta span::before {
  content: '◆ ';
  color: var(--gold);
  margin-right: 4px;
}

.slide-program {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 60px;
  align-items: center;
  width: 100%;
  max-width: 1100px;
  padding: 0 40px;
}
.program-number {
  font-size: clamp(110px, 17vw, 210px);
  font-weight: bold;
  line-height: 1;
  background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 40%, var(--red-bright) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  opacity: 0.95;
  font-family: "Georgia", "Times New Roman", serif;
  filter: drop-shadow(0 0 30px rgba(212, 175, 55, 0.3));
}
.program-info { text-align: left; }
.program-type {
  display: inline-block;
  padding: 6px 22px;
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  color: var(--gold-light);
  border: 1px solid var(--gold);
  border-radius: 20px;
  font-size: 14px;
  letter-spacing: 6px;
  margin-bottom: 22px;
  box-shadow: 0 2px 12px rgba(196, 30, 58, 0.4);
}
.program-title {
  font-size: clamp(36px, 5vw, 64px);
  color: var(--gold-bright);
  letter-spacing: 10px;
  margin-bottom: 22px;
  text-shadow: 0 0 30px rgba(212, 175, 55, 0.4);
  font-family: "STKaiti", "KaiTi", serif;
}
.program-desc {
  font-size: 17px;
  color: var(--gold-light);
  opacity: 0.88;
  line-height: 1.9;
  letter-spacing: 2px;
  margin-bottom: 26px;
  max-width: 540px;
}
.program-meta {
  display: flex;
  gap: 32px;
  font-size: 15px;
  color: var(--gold-light);
  opacity: 0.75;
  letter-spacing: 2px;
}
.program-meta span::before {
  content: '◆ ';
  color: var(--gold);
  margin-right: 4px;
}

.slide-ending { text-align: center; }
.ending-title {
  font-size: clamp(56px, 9.5vw, 124px);
  font-weight: bold;
  background: linear-gradient(180deg, var(--gold-light) 0%, var(--gold-bright) 40%, var(--gold) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 20px;
  margin-bottom: 24px;
  font-family: "STKaiti", "KaiTi", serif;
  filter: drop-shadow(0 4px 30px rgba(212, 175, 55, 0.5));
  animation: titleFloat 3.5s ease-in-out infinite;
}
.ending-subtitle {
  font-size: clamp(18px, 2.4vw, 28px);
  color: var(--gold-light);
  letter-spacing: 12px;
  margin-bottom: 40px;
  opacity: 0.9;
}
.ending-blessing {
  font-size: clamp(16px, 1.9vw, 21px);
  color: var(--gold-light);
  letter-spacing: 4px;
  line-height: 2;
  padding: 22px 44px;
  border-top: 1px solid rgba(212, 175, 55, 0.4);
  border-bottom: 1px solid rgba(212, 175, 55, 0.4);
  display: inline-block;
  background: rgba(0, 0, 0, 0.2);
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  border: 2px solid rgba(212, 175, 55, 0.5);
  background: rgba(0, 0, 0, 0.4);
  color: var(--gold-light);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  transition: all 0.3s;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.nav-prev { left: 24px; }
.nav-next { right: 24px; }
.nav-btn svg { width: 24px; height: 24px; }
.nav-btn:hover {
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  border-color: var(--gold);
  color: var(--gold-bright);
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 0 30px rgba(212, 175, 55, 0.5);
}
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: translateY(-50%); }
.nav-btn:disabled:hover { background: rgba(0, 0, 0, 0.4); border-color: rgba(212, 175, 55, 0.5); color: var(--gold-light); }

.progress-bar {
  position: relative;
  z-index: 10;
  height: 3px;
  background: rgba(212, 175, 55, 0.12);
  margin: 0 36px 12px;
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--red-bright), var(--gold-bright));
  transition: width 0.6s ease;
  box-shadow: 0 0 12px var(--gold);
  border-radius: 2px;
  width: 0%;
}

.controls {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 12px 32px 18px;
  flex-shrink: 0;
}
.ctrl-btn {
  padding: 9px 24px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(212, 175, 55, 0.4);
  color: var(--gold-light);
  border-radius: 22px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 3px;
  transition: all 0.3s;
}
.ctrl-btn:hover {
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  border-color: var(--gold);
  color: var(--gold-bright);
  transform: translateY(-2px);
}
.ctrl-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
.ctrl-btn:disabled:hover { background: rgba(0, 0, 0, 0.4); border-color: rgba(212, 175, 55, 0.4); color: var(--gold-light); }
.ctrl-btn.primary {
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  border-color: var(--gold);
  color: var(--gold-bright);
}
.ctrl-btn.primary:hover {
  box-shadow: 0 4px 16px rgba(196, 30, 58, 0.5);
}

.dots { display: flex; gap: 8px; align-items: center; }
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.3);
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  padding: 0;
}
.dot.active {
  background: var(--gold-bright);
  width: 28px;
  border-radius: 4px;
  box-shadow: 0 0 10px var(--gold);
}
.dot:hover { background: var(--gold); }

.catalog {
  position: fixed;
  top: 0;
  right: -380px;
  width: 360px;
  height: 100%;
  background: linear-gradient(180deg, rgba(45, 10, 10, 0.97), rgba(26, 6, 6, 0.97));
  border-left: 1px solid rgba(212, 175, 55, 0.4);
  z-index: 100;
  transition: right 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
}
.catalog.open { right: 0; }
.catalog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 20px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}
.catalog-header h3 {
  color: var(--gold-bright);
  font-size: 24px;
  letter-spacing: 8px;
  font-family: "STKaiti", "KaiTi", serif;
}
.close-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(212, 175, 55, 0.4);
  color: var(--gold-light);
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  font-family: inherit;
}
.close-btn:hover {
  background: var(--red-bright);
  color: var(--gold-bright);
  border-color: var(--gold);
}
.catalog-list {
  list-style: none;
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}
.catalog-list::-webkit-scrollbar { width: 6px; }
.catalog-list::-webkit-scrollbar-track { background: transparent; }
.catalog-list::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.4); border-radius: 3px; }
.catalog-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
}
.catalog-item:hover {
  background: rgba(196, 30, 58, 0.3);
  border-color: rgba(212, 175, 55, 0.3);
  transform: translateX(-4px);
}
.catalog-item.active {
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.5), rgba(139, 0, 0, 0.4));
  border-color: var(--gold);
  box-shadow: 0 0 16px rgba(212, 175, 55, 0.2);
}
.catalog-num {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  border: 1px solid var(--gold);
  color: var(--gold-bright);
  border-radius: 50%;
  font-family: "STKaiti", "KaiTi", serif;
  font-weight: bold;
  font-size: 16px;
  flex-shrink: 0;
}
.catalog-info { flex: 1; min-width: 0; }
.catalog-title {
  color: var(--gold-light);
  font-size: 16px;
  letter-spacing: 3px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: "STKaiti", "KaiTi", serif;
}
.catalog-item.active .catalog-title { color: var(--gold-bright); }
.catalog-type {
  color: var(--gold-light);
  opacity: 0.55;
  font-size: 12px;
  letter-spacing: 2px;
}
.catalog-del {
  width: 24px;
  height: 24px;
  background: transparent;
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: var(--gold-light);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  opacity: 0.6;
  transition: all 0.3s;
  font-family: inherit;
}
.catalog-del:hover {
  background: var(--red-bright);
  color: var(--gold-bright);
  border-color: var(--gold);
  opacity: 1;
  transform: scale(1.1);
}
.catalog-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
}
.add-btn {
  width: 100%;
  padding: 10px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--red-bright), var(--red));
  border: 1px solid var(--gold);
  color: var(--gold-bright);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 4px;
  transition: all 0.3s;
}
.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(196, 30, 58, 0.5);
}
.catalog-hint {
  font-size: 11px;
  color: var(--gold-light);
  opacity: 0.5;
  letter-spacing: 1px;
  line-height: 1.7;
  text-align: center;
}

.catalog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 99;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s;
}
.catalog-overlay.open { opacity: 1; pointer-events: auto; }

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.modal.open { opacity: 1; pointer-events: auto; }
.modal-content {
  width: 90%;
  max-width: 460px;
  background: linear-gradient(180deg, rgba(45, 10, 10, 0.98), rgba(26, 6, 6, 0.98));
  border: 1px solid var(--gold);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(212, 175, 55, 0.2);
  transform: scale(0.92);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.modal.open .modal-content { transform: scale(1); }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}
.modal-header h3 {
  color: var(--gold-bright);
  font-size: 20px;
  letter-spacing: 6px;
  font-family: "STKaiti", "KaiTi", serif;
}
.modal-body {
  padding: 20px 24px;
  max-height: 60vh;
  overflow-y: auto;
}
.form-row { margin-bottom: 16px; }
.form-row label {
  display: block;
  color: var(--gold-light);
  font-size: 13px;
  letter-spacing: 3px;
  margin-bottom: 6px;
  opacity: 0.85;
}
.form-row input, .form-row textarea {
  width: 100%;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: var(--gold-light);
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 1px;
  outline: none;
  transition: border-color 0.3s, background 0.3s;
  resize: vertical;
}
.form-row input:focus, .form-row textarea:focus {
  border-color: var(--gold);
  background: rgba(0, 0, 0, 0.55);
}
.form-row textarea { line-height: 1.6; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
}

.fireworks { position: fixed; inset: 0; pointer-events: none; z-index: 4; }
.firework-explosion { position: absolute; width: 4px; height: 4px; pointer-events: none; }
.firework-particle {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  animation: fireworkFly 1.6s ease-out var(--delay, 0s) forwards;
  opacity: 0;
}
@keyframes fireworkFly {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  60% { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
}

.toast {
  position: fixed;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.95), rgba(107, 13, 13, 0.95));
  color: var(--gold-bright);
  padding: 12px 28px;
  border: 1px solid var(--gold);
  border-radius: 24px;
  font-size: 14px;
  letter-spacing: 3px;
  z-index: 200;
  opacity: 0;
  transition: all 0.4s;
  pointer-events: none;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  font-family: inherit;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

@media (max-width: 768px) {
  .topbar { padding: 12px 16px; }
  .brand-text { font-size: 16px; letter-spacing: 3px; }
  .brand-seal { width: 36px; height: 36px; font-size: 20px; }
  .page-indicator { display: none; }
  .stage { padding: 0 60px; }
  .nav-btn { width: 44px; height: 44px; }
  .nav-btn svg { width: 20px; height: 20px; }
  .slide-program { grid-template-columns: 1fr; gap: 16px; text-align: center; padding: 0 10px; }
  .program-info { text-align: center; }
  .program-meta { justify-content: center; }
  .speech-content { padding: 20px 16px; }
  .controls { gap: 12px; padding: 8px 12px 14px; }
  .ctrl-btn { padding: 7px 14px; font-size: 12px; }
  .lantern { width: 50px; top: 50px; }
  .lantern-body { width: 50px; height: 58px; }
  .lantern-text { font-size: 22px; }
  .catalog { width: 280px; right: -300px; }
  .opening-divider { width: 140px; }
  .progress-bar { margin: 0 16px 10px; }
  .modal-content { width: 94%; }
}
@media (max-width: 480px) {
  .topbar-meta .icon-btn { width: 36px; height: 36px; }
  .lantern { display: none; }
  .stage { padding: 0 56px; }
}
@media (prefers-reduced-motion: reduce) {
  .lantern, .opening-title, .ending-title, .bg-clouds, .icon-btn.active svg { animation: none; }
  .slide { transition: opacity 0.3s ease; transform: none; }
}`;

const PPT_JS = `(function() {
  'use strict';

  var STORAGE_KEY = 'spring_gala_ppt_index';
  var AUTOPLAY_INTERVAL = 5000;

  var slides = [
    {
      type: 'opening',
      title: '春节联欢晚会',
      subtitle: '盛世华章 · 新春贺岁',
      programType: '',
      content: '',
      meta: {},
      catalogLabel: '开场'
    },
    {
      type: 'speech',
      title: '新春致辞',
      programType: '开场致辞',
      content: '金虎辞旧岁，玉兔迎新春。值此辞旧迎新之际，谨向全体同仁致以最诚挚的新春祝福，愿阖家欢乐、万事如意、心想事成、福运亨通！',
      meta: { speaker: '晚会主持人', duration: '5 分钟' },
      catalogLabel: '新春致辞'
    },
    {
      type: 'program',
      number: '01',
      title: '盛世华章',
      programType: '开场舞蹈',
      content: '宏大的开场舞蹈以恢弘气势拉开晚会序幕，融合中国古典舞与现代舞台艺术，展现盛世中华的繁荣景象与文化自信。',
      meta: { performer: '东方歌舞团', duration: '6 分钟' },
      catalogLabel: '盛世华章'
    },
    {
      type: 'program',
      number: '02',
      title: '欢声笑语',
      programType: '相声',
      content: '妙趣横生的相声表演，以幽默诙谐的语言讲述新春趣事，传递欢乐祥和的节日氛围，让观众捧腹大笑、乐而忘返。',
      meta: { performer: '特邀嘉宾', duration: '12 分钟' },
      catalogLabel: '欢声笑语'
    },
    {
      type: 'program',
      number: '03',
      title: '锦绣中华',
      programType: '歌曲',
      content: '深情款款的歌曲演唱，歌颂祖国大好河山与五千年灿烂文明，激发观众的爱国热情与民族自豪感。',
      meta: { performer: '著名歌唱家', duration: '5 分钟' },
      catalogLabel: '锦绣中华'
    },
    {
      type: 'program',
      number: '04',
      title: '奇幻新春',
      programType: '魔术',
      content: '神秘莫测的魔术表演，以新春为主题，融入传统元素与现代魔术技法，为观众呈现一场奇幻绝伦的视觉盛宴。',
      meta: { performer: '国际魔术师', duration: '8 分钟' },
      catalogLabel: '奇幻新春'
    },
    {
      type: 'program',
      number: '05',
      title: '国韵流芳',
      programType: '京剧',
      content: '国粹京剧经典选段，唱腔优美、身段优雅，展现中华戏曲艺术的博大精深与永恒魅力，传承民族文化瑰宝。',
      meta: { performer: '京剧名家', duration: '10 分钟' },
      catalogLabel: '国韵流芳'
    },
    {
      type: 'program',
      number: '06',
      title: '龙腾虎跃',
      programType: '杂技',
      content: '惊险刺激的杂技表演，融合舞龙舞狮等传统元素，展现中华民族的勇毅精神与非凡技艺，令人叹为观止。',
      meta: { performer: '杂技团', duration: '7 分钟' },
      catalogLabel: '龙腾虎跃'
    },
    {
      type: 'program',
      number: '07',
      title: '我和我的祖国',
      programType: '合唱',
      content: '气势磅礴的大合唱，全体演员与观众共唱赞歌，将晚会推向高潮，共同祝福伟大祖国繁荣昌盛、国泰民安。',
      meta: { performer: '全体演员', duration: '6 分钟' },
      catalogLabel: '我和我的祖国'
    },
    {
      type: 'ending',
      title: '新春大吉',
      subtitle: '万事如意 · 阖家欢乐',
      programType: '',
      content: '祝大家新春快乐，阖家幸福，福运亨通，吉祥如意！',
      meta: {},
      catalogLabel: '谢幕祝福'
    }
  ];

  var state = {
    current: 0,
    autoPlaying: false,
    autoTimer: null,
    fireworkTimer: null,
    isFullscreen: false
  };

  var dom = {};
  var toastTimer = null;

  function init() {
    dom.app = document.getElementById('app');
    dom.slideContainer = document.getElementById('slideContainer');
    dom.pageIndicator = document.getElementById('pageIndicator');
    dom.progressFill = document.getElementById('progressFill');
    dom.dotsContainer = document.getElementById('dots');
    dom.catalog = document.getElementById('catalog');
    dom.catalogList = document.getElementById('catalogList');
    dom.catalogOverlay = document.getElementById('catalogOverlay');
    dom.fireworks = document.getElementById('fireworks');
    dom.toast = document.getElementById('toast');
    dom.prevBtn = document.getElementById('prevBtn');
    dom.nextBtn = document.getElementById('nextBtn');
    dom.prevBtnBottom = document.getElementById('prevBtnBottom');
    dom.nextBtnBottom = document.getElementById('nextBtnBottom');
    dom.catalogBtn = document.getElementById('catalogBtn');
    dom.autoBtn = document.getElementById('autoBtn');
    dom.fullscreenBtn = document.getElementById('fullscreenBtn');
    dom.closeCatalog = document.getElementById('closeCatalog');
    dom.addSlideBtn = document.getElementById('addSlideBtn');
    dom.addModal = document.getElementById('addModal');
    dom.closeAddModal = document.getElementById('closeAddModal');
    dom.cancelAdd = document.getElementById('cancelAdd');
    dom.confirmAdd = document.getElementById('confirmAdd');
    dom.inputTitle = document.getElementById('inputTitle');
    dom.inputType = document.getElementById('inputType');
    dom.inputContent = document.getElementById('inputContent');
    dom.inputPerformer = document.getElementById('inputPerformer');

    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        var idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < slides.length) {
          state.current = idx;
        }
      }
    } catch (e) {}

    renderSlides();
    renderDots();
    renderCatalog();
    bindEvents();
    showSlide(state.current, 0);
  }

  function renderSlides() {
    var html = '';
    slides.forEach(function(slide, i) {
      html += buildSlideHTML(slide, i);
    });
    dom.slideContainer.innerHTML = html;
  }

  function buildSlideHTML(slide, index) {
    var cls = 'slide slide-' + slide.type;
    var inner = '';

    if (slide.type === 'opening') {
      inner =
        '<div class="opening-seal">恭贺新禧</div>' +
        '<h1 class="opening-title">' + slide.title + '</h1>' +
        '<div class="opening-subtitle">' + slide.subtitle + '</div>' +
        '<div class="opening-divider"></div>' +
        '<div class="opening-date">农历甲辰年 · 正月初一</div>';
    } else if (slide.type === 'speech') {
      inner =
        '<div class="slide-speech">' +
          '<div class="speech-label">' + slide.programType + '</div>' +
          '<h2 class="speech-title">' + slide.title + '</h2>' +
          '<div class="speech-content">' + slide.content + '</div>' +
          '<div class="speech-meta">' +
            '<span>致辞人：' + slide.meta.speaker + '</span>' +
            '<span>时长：' + slide.meta.duration + '</span>' +
          '</div>' +
        '</div>';
    } else if (slide.type === 'program') {
      inner =
        '<div class="slide-program">' +
          '<div class="program-number">' + slide.number + '</div>' +
          '<div class="program-info">' +
            '<div class="program-type">' + slide.programType + '</div>' +
            '<h2 class="program-title">' + slide.title + '</h2>' +
            '<p class="program-desc">' + slide.content + '</p>' +
            '<div class="program-meta">' +
              '<span>表演：' + slide.meta.performer + '</span>' +
              '<span>时长：' + slide.meta.duration + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    } else if (slide.type === 'ending') {
      inner =
        '<div class="slide-ending">' +
          '<h1 class="ending-title">' + slide.title + '</h1>' +
          '<div class="ending-subtitle">' + slide.subtitle + '</div>' +
          '<div class="ending-blessing">' + slide.content + '</div>' +
        '</div>';
    }

    return '<section class="' + cls + '" data-index="' + index + '" data-type="' + slide.type + '">' + inner + '</section>';
  }

  function renderDots() {
    var html = '';
    slides.forEach(function(slide, i) {
      html += '<button class="dot" data-index="' + i + '" aria-label="第' + (i + 1) + '张幻灯片"></button>';
    });
    dom.dotsContainer.innerHTML = html;
  }

  function renderCatalog() {
    var html = '';
    slides.forEach(function(slide, i) {
      var label = slide.catalogLabel || slide.title;
      var typeText = slide.programType || (slide.type === 'opening' ? '开场' : (slide.type === 'ending' ? '谢幕' : '特别环节'));
      var numText;
      if (slide.type === 'program') {
        numText = slide.number;
      } else if (slide.type === 'opening') {
        numText = '开';
      } else if (slide.type === 'speech') {
        numText = '辞';
      } else {
        numText = '终';
      }
      var canDelete = (slide.type === 'program' || slide.type === 'speech');
      var delBtn = canDelete
        ? '<button class="catalog-del" data-del="' + i + '" title="删除该节目" aria-label="删除该节目">×</button>'
        : '';
      html +=
        '<li class="catalog-item" data-index="' + i + '">' +
          '<div class="catalog-num">' + numText + '</div>' +
          '<div class="catalog-info">' +
            '<div class="catalog-title">' + label + '</div>' +
            '<div class="catalog-type">' + typeText + '</div>' +
          '</div>' +
          delBtn +
        '</li>';
    });
    dom.catalogList.innerHTML = html;
  }

  function bindEvents() {
    dom.prevBtn.addEventListener('click', function() { goTo(state.current - 1, -1); });
    dom.nextBtn.addEventListener('click', function() { goTo(state.current + 1, 1); });
    dom.prevBtnBottom.addEventListener('click', function() { goTo(state.current - 1, -1); });
    dom.nextBtnBottom.addEventListener('click', function() { goTo(state.current + 1, 1); });

    dom.catalogBtn.addEventListener('click', openCatalog);
    dom.closeCatalog.addEventListener('click', closeCatalog);
    dom.catalogOverlay.addEventListener('click', closeCatalog);

    dom.autoBtn.addEventListener('click', toggleAutoplay);
    dom.fullscreenBtn.addEventListener('click', toggleFullscreen);

    dom.addSlideBtn.addEventListener('click', openAddModal);
    dom.closeAddModal.addEventListener('click', closeAddModal);
    dom.cancelAdd.addEventListener('click', closeAddModal);
    dom.confirmAdd.addEventListener('click', confirmAddSlide);
    dom.addModal.addEventListener('click', function(e) {
      if (e.target === dom.addModal) closeAddModal();
    });

    dom.catalogList.addEventListener('click', function(e) {
      var target = e.target;
      while (target && target !== dom.catalogList) {
        if (target.classList && target.classList.contains('catalog-del')) {
          var delIdx = parseInt(target.dataset.del, 10);
          deleteSlide(delIdx);
          return;
        }
        if (target.classList && target.classList.contains('catalog-item')) break;
        target = target.parentElement;
      }
      if (target && target.classList && target.classList.contains('catalog-item')) {
        var idx = parseInt(target.dataset.index, 10);
        var dir = idx > state.current ? 1 : -1;
        closeCatalog();
        goTo(idx, dir);
      }
    });

    dom.dotsContainer.addEventListener('click', function(e) {
      if (e.target.classList && e.target.classList.contains('dot')) {
        var idx = parseInt(e.target.dataset.index, 10);
        var dir = idx > state.current ? 1 : -1;
        goTo(idx, dir);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (dom.addModal.classList.contains('open')) {
        if (e.key === 'Escape') {
          closeAddModal();
        } else if (e.key === 'Enter') {
          confirmAddSlide();
        }
        return;
      }
      var key = e.key;
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        e.preventDefault();
        goTo(state.current - 1, -1);
      } else if (key === 'ArrowRight' || key === 'ArrowDown' || key === ' ') {
        e.preventDefault();
        goTo(state.current + 1, 1);
      } else if (key === 'Home') {
        e.preventDefault();
        goTo(0, -1);
      } else if (key === 'End') {
        e.preventDefault();
        goTo(slides.length - 1, 1);
      } else if (key === 'Escape') {
        if (dom.catalog.classList.contains('open')) {
          closeCatalog();
        }
      } else if (key === 'f' || key === 'F') {
        toggleFullscreen();
      } else if (key === 'p' || key === 'P') {
        toggleAutoplay();
      }
    });

    document.addEventListener('fullscreenchange', function() {
      state.isFullscreen = !!document.fullscreenElement;
      dom.fullscreenBtn.classList.toggle('active', state.isFullscreen);
    });

    window.addEventListener('beforeunload', saveState);
  }

  function goTo(idx, direction) {
    if (idx < 0) {
      showToast('已是第一页');
      return;
    }
    if (idx >= slides.length) {
      if (state.autoPlaying) {
        stopAutoplay();
        showToast('播放结束');
      } else {
        showToast('已是最后一页');
      }
      return;
    }
    showSlide(idx, direction);
  }

  function showSlide(idx, direction) {
    var slideEls = dom.slideContainer.children;
    if (idx < 0 || idx >= slideEls.length) return;

    if (direction > 0) {
      dom.slideContainer.dataset.direction = 'forward';
    } else if (direction < 0) {
      dom.slideContainer.dataset.direction = 'backward';
    }

    for (var i = 0; i < slideEls.length; i++) {
      slideEls[i].classList.remove('active');
    }
    slideEls[idx].classList.add('active');

    state.current = idx;
    updateUI();
    saveState();

    var type = slides[idx].type;
    if (type === 'opening' || type === 'ending') {
      startFireworks();
    } else {
      stopFireworks();
    }
  }

  function updateUI() {
    var total = slides.length;
    var cur = state.current + 1;

    dom.pageIndicator.textContent = pad(cur) + ' / ' + pad(total);
    dom.progressFill.style.width = (cur / total * 100) + '%';

    var dots = dom.dotsContainer.children;
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === state.current);
    }

    var items = dom.catalogList.children;
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('active', j === state.current);
    }

    var isFirst = state.current === 0;
    var isLast = state.current === slides.length - 1;
    dom.prevBtn.disabled = isFirst;
    dom.nextBtn.disabled = isLast;
    dom.prevBtnBottom.disabled = isFirst;
    dom.nextBtnBottom.disabled = isLast;
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function renumberPrograms() {
    var n = 1;
    slides.forEach(function(s) {
      if (s.type === 'program') {
        s.number = pad(n);
        n++;
      }
    });
  }

  function openAddModal() {
    dom.inputTitle.value = '';
    dom.inputType.value = '';
    dom.inputContent.value = '';
    dom.inputPerformer.value = '';
    dom.addModal.classList.add('open');
    setTimeout(function() { dom.inputTitle.focus(); }, 120);
  }

  function closeAddModal() {
    dom.addModal.classList.remove('open');
  }

  function confirmAddSlide() {
    var title = dom.inputTitle.value.trim();
    var type = dom.inputType.value.trim();
    var content = dom.inputContent.value.trim();
    var performer = dom.inputPerformer.value.trim();

    if (!title) {
      showToast('请输入节目标题');
      dom.inputTitle.focus();
      return;
    }
    if (!type) {
      showToast('请输入节目类型');
      dom.inputType.focus();
      return;
    }
    if (!content) {
      content = '精彩节目，敬请期待。';
    }
    if (!performer) {
      performer = '特邀演员';
    }

    addSlide({
      title: title,
      type: type,
      content: content,
      performer: performer
    });
  }

  function addSlide(data) {
    var newSlide = {
      type: 'program',
      number: '00',
      title: data.title,
      programType: data.type,
      content: data.content,
      meta: { performer: data.performer, duration: '5 分钟' },
      catalogLabel: data.title
    };
    var insertIdx = slides.length - 1;
    slides.splice(insertIdx, 0, newSlide);
    renumberPrograms();

    renderSlides();
    renderDots();
    renderCatalog();

    closeAddModal();
    showSlide(insertIdx, 1);
    showToast('已新增节目：' + data.title);
  }

  function deleteSlide(idx) {
    if (idx < 0 || idx >= slides.length) return;
    var slide = slides[idx];
    if (slide.type !== 'program' && slide.type !== 'speech') {
      showToast('该节目不可删除');
      return;
    }
    var removableCount = slides.reduce(function(acc, s) {
      return acc + (s.type === 'program' || s.type === 'speech' ? 1 : 0);
    }, 0);
    if (removableCount <= 1) {
      showToast('至少保留一个节目');
      return;
    }

    slides.splice(idx, 1);
    renumberPrograms();

    if (state.current >= slides.length) {
      state.current = slides.length - 1;
    } else if (idx < state.current) {
      state.current = state.current - 1;
    }

    renderSlides();
    renderDots();
    renderCatalog();
    showSlide(state.current, 0);
    showToast('已删除该节目');
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, String(state.current));
    } catch (e) {}
  }

  function openCatalog() {
    dom.catalog.classList.add('open');
    dom.catalogOverlay.classList.add('open');
  }

  function closeCatalog() {
    dom.catalog.classList.remove('open');
    dom.catalogOverlay.classList.remove('open');
  }

  function toggleAutoplay() {
    if (state.autoPlaying) {
      stopAutoplay();
      showToast('已暂停自动播放');
    } else {
      if (state.current === slides.length - 1) {
        showSlide(0, 1);
      }
      startAutoplay();
      showToast('已开始自动播放');
    }
  }

  function startAutoplay() {
    state.autoPlaying = true;
    dom.autoBtn.classList.add('active');
    state.autoTimer = setInterval(function() {
      if (state.current >= slides.length - 1) {
        stopAutoplay();
        showToast('播放结束');
        return;
      }
      goTo(state.current + 1, 1);
    }, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    state.autoPlaying = false;
    dom.autoBtn.classList.remove('active');
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        var el = dom.app;
        if (el.requestFullscreen) {
          el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          el.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    } catch (e) {
      showToast('全屏不可用');
    }
  }

  function startFireworks() {
    if (state.fireworkTimer) return;
    launchFirework();
    state.fireworkTimer = setInterval(function() {
      launchFirework();
      if (Math.random() > 0.4) {
        setTimeout(launchFirework, 200 + Math.random() * 400);
      }
    }, 1100);
  }

  function stopFireworks() {
    if (state.fireworkTimer) {
      clearInterval(state.fireworkTimer);
      state.fireworkTimer = null;
    }
  }

  function launchFirework() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var x = 80 + Math.random() * Math.max(160, w - 160);
    var y = 60 + Math.random() * (h * 0.45);
    var colors = ['#ff4444', '#ffd700', '#ff8844', '#ff66aa', '#88ff88', '#ffaa00', '#ff5577', '#ffcc44'];
    var color = colors[Math.floor(Math.random() * colors.length)];

    var explosion = document.createElement('div');
    explosion.className = 'firework-explosion';
    explosion.style.left = x + 'px';
    explosion.style.top = y + 'px';

    var particleCount = 22;
    for (var i = 0; i < particleCount; i++) {
      var p = document.createElement('div');
      p.className = 'firework-particle';
      p.style.background = color;
      p.style.boxShadow = '0 0 6px ' + color + ', 0 0 12px ' + color;
      var angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.2;
      var distance = 50 + Math.random() * 90;
      var dx = Math.cos(angle) * distance;
      var dy = Math.sin(angle) * distance;
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');
      p.style.setProperty('--delay', (Math.random() * 0.15) + 's');
      explosion.appendChild(p);
    }

    dom.fireworks.appendChild(explosion);
    setTimeout(function() {
      if (explosion.parentNode) {
        explosion.parentNode.removeChild(explosion);
      }
    }, 1900);
  }

  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      dom.toast.classList.remove('show');
    }, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`;


/* ------------------------------------------------------------------ */
/* 商品详情页                                                          */
/* ------------------------------------------------------------------ */

const PRODUCT_DETAIL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>商品详情</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="page">
    <header class="topbar">
      <button class="icon-circle" id="backBtn" aria-label="返回">
        <svg viewBox="0 0 24 24" width="20" height="20"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <span class="topbar-title">商品详情</span>
      <button class="icon-circle" id="shareBtn" aria-label="分享">
        <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="18" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8.2" y1="13.3" x2="15.8" y2="17.7" stroke="currentColor" stroke-width="2"/><line x1="15.8" y1="6.3" x2="8.2" y2="10.7" stroke="currentColor" stroke-width="2"/></svg>
      </button>
    </header>

    <main class="content">
      <section class="hero">
        <div class="hero-img-wrap">
          <img id="productImage" alt="商品主图" />
          <div class="stock-tag" id="stockTag">现货</div>
        </div>
      </section>

      <section class="info-card">
        <div class="price-row">
          <span class="price-symbol">¥</span>
          <span class="price-value" id="productPrice">0</span>
          <span class="price-origin" id="productOriginPrice"></span>
          <span class="price-badge" id="priceBadge">限时直降</span>
        </div>
        <h1 class="product-name" id="productName">商品名称加载中</h1>
        <div class="sales-row">
          <span class="sales-item">已售 <em id="soldCount">0</em></span>
          <span class="divider">·</span>
          <span class="sales-item">库存 <em id="stockCount">0</em></span>
          <span class="divider">·</span>
          <span class="sales-item">好评率 98%</span>
        </div>
      </section>

      <section class="tags-card">
        <div class="tag-item">
          <div class="tag-dot"></div>
          <div class="tag-text">
            <div class="tag-title">正品保障</div>
            <div class="tag-desc">品牌授权</div>
          </div>
        </div>
        <div class="tag-item">
          <div class="tag-dot"></div>
          <div class="tag-text">
            <div class="tag-title">极速发货</div>
            <div class="tag-desc">24h直达</div>
          </div>
        </div>
        <div class="tag-item">
          <div class="tag-dot"></div>
          <div class="tag-text">
            <div class="tag-title">七天无忧</div>
            <div class="tag-desc">无理由退换</div>
          </div>
        </div>
      </section>

      <section class="detail-card">
        <div class="section-title">商品详情</div>
        <div class="detail-content" id="detailContent"></div>
      </section>

      <section class="recommend-card">
        <div class="section-title">店铺推荐</div>
        <div class="recommend-list">
          <div class="recommend-item">
            <img src="https://picsum.photos/seed/reca1/300/300.jpg" alt="推荐">
            <div class="rec-name">同款沙发</div>
            <div class="rec-price">¥1280</div>
          </div>
          <div class="recommend-item">
            <img src="https://picsum.photos/seed/reca2/300/300.jpg" alt="推荐">
            <div class="rec-name">实木茶几</div>
            <div class="rec-price">¥680</div>
          </div>
          <div class="recommend-item">
            <img src="https://picsum.photos/seed/reca3/300/300.jpg" alt="推荐">
            <div class="rec-name">羊毛地毯</div>
            <div class="rec-price">¥899</div>
          </div>
        </div>
      </section>

      <div class="bottom-placeholder"></div>
    </main>

    <footer class="action-bar">
      <div class="action-icons">
        <button class="icon-btn" id="favBtn">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          <span>收藏</span>
        </button>
        <button class="icon-btn" id="cartBtn">
          <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="9" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          <span>记录</span>
        </button>
      </div>
      <button class="buy-btn" id="buyBtn">立即购买</button>
    </footer>

    <div class="modal-mask" id="modalMask">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <span>确认购买</span>
          <button class="modal-close" id="modalClose" aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <div class="modal-product">
            <img id="modalImage" alt="">
            <div class="modal-product-info">
              <div class="modal-product-name" id="modalName"></div>
              <div class="modal-product-price" id="modalPrice"></div>
              <div class="modal-product-stock" id="modalStock"></div>
            </div>
          </div>
          <div class="qty-row">
            <span class="qty-label">购买数量</span>
            <div class="qty-control">
              <button class="qty-btn" id="qtyMinus">−</button>
              <span class="qty-num" id="qtyNum">1</span>
              <button class="qty-btn" id="qtyPlus">+</button>
            </div>
          </div>
          <div class="summary-row">
            <span>合计</span>
            <span class="summary-price" id="summaryPrice">¥0</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-cancel" id="modalCancel">再想想</button>
          <button class="modal-confirm" id="modalConfirm">确认下单</button>
        </div>
      </div>
    </div>

    <div class="toast" id="toast"></div>
  </div>
  <script src="app.js"></script>
</body>
</html>`;

const PRODUCT_DETAIL_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html { -webkit-text-size-adjust: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #0f172a;
  color: #f1f5f9;
  line-height: 1.5;
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  overflow-x: hidden;
  min-height: 100vh;
}

.page { min-height: 100vh; display: flex; flex-direction: column; }

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}
.icon-circle {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform .15s, background .2s;
}
.icon-circle:active { transform: scale(0.9); background: rgba(51, 65, 85, 0.9); }
.topbar-title { font-size: 16px; font-weight: 600; color: #f1f5f9; letter-spacing: 0.5px; }

.content { flex: 1; }

.hero { position: relative; width: 100%; background: #1e293b; }
.hero-img-wrap { position: relative; width: 100%; aspect-ratio: 1/1; overflow: hidden; }
.hero-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.stock-tag {
  position: absolute;
  top: 16px; left: 16px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  color: #f97316;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(249, 115, 22, 0.45);
  font-weight: 600;
  letter-spacing: 0.3px;
}
.stock-tag.sold-out { color: #94a3b8; border-color: rgba(148, 163, 184, 0.3); }

.info-card { padding: 22px 18px 18px; background: #0f172a; position: relative; }
.info-card::before {
  content: '';
  position: absolute;
  top: -20px; left: 0; right: 0;
  height: 24px;
  background: linear-gradient(to bottom, transparent, #0f172a);
  pointer-events: none;
  z-index: 2;
}
.price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.price-symbol { color: #f97316; font-size: 18px; font-weight: 700; }
.price-value { color: #f97316; font-size: 36px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
.price-origin { color: #64748b; font-size: 14px; text-decoration: line-through; margin-left: 2px; }
.price-badge {
  background: linear-gradient(135deg, rgba(249,115,22,0.18), rgba(239,68,68,0.18));
  color: #f97316;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(249, 115, 22, 0.3);
  font-weight: 600;
}
.product-name { font-size: 18px; font-weight: 600; color: #f1f5f9; line-height: 1.45; margin-bottom: 12px; }
.sales-row { display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 12px; flex-wrap: wrap; }
.sales-item em { font-style: normal; color: #cbd5e1; font-weight: 600; }
.divider { color: #475569; }

.tags-card {
  margin: 0 16px 16px;
  background: linear-gradient(135deg, #1e293b 0%, #172033 100%);
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 14px;
  padding: 14px 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.tag-item { display: flex; gap: 8px; align-items: flex-start; flex: 1; }
.tag-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f97316, #ef4444);
  margin-top: 5px;
  box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
  flex-shrink: 0;
}
.tag-title { font-size: 13px; color: #e2e8f0; font-weight: 600; }
.tag-desc { font-size: 11px; color: #64748b; margin-top: 2px; }

.detail-card { padding: 0 18px; margin-bottom: 20px; }
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 14px;
  padding-left: 10px;
  border-left: 3px solid #f97316;
  line-height: 1.2;
}
.detail-content { font-size: 14px; color: #cbd5e1; line-height: 1.75; }
.detail-content p { margin-bottom: 12px; }
.detail-content img { width: 100%; border-radius: 12px; margin: 14px 0; display: block; }
.detail-content h3 {
  font-size: 15px;
  color: #f1f5f9;
  margin: 18px 0 8px;
  font-weight: 600;
  padding-left: 8px;
  border-left: 2px solid rgba(249, 115, 22, 0.5);
}
.detail-content ul { padding-left: 18px; margin-bottom: 14px; list-style: none; }
.detail-content li { margin-bottom: 8px; position: relative; padding-left: 12px; color: #94a3b8; }
.detail-content li::before {
  content: '';
  position: absolute;
  left: 0; top: 9px;
  width: 4px; height: 4px;
  border-radius: 50%;
  background: #f97316;
}

.recommend-card { padding: 0 18px; margin-bottom: 24px; }
.recommend-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.recommend-item {
  background: #1e293b;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.06);
  transition: transform .2s;
}
.recommend-item:active { transform: scale(0.97); }
.recommend-item img { width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; }
.rec-name { font-size: 12px; color: #cbd5e1; padding: 7px 8px 2px; line-height: 1.3; }
.rec-price { font-size: 13px; color: #f97316; font-weight: 700; padding: 0 8px 8px; }

.bottom-placeholder { height: 90px; }

.action-bar {
  position: fixed;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  padding: 10px 14px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 100;
}
.action-icons { display: flex; gap: 2px; }
.icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  padding: 4px 10px;
  cursor: pointer;
  transition: color .2s;
}
.icon-btn.active { color: #f97316; }
.icon-btn.active svg path { fill: #f97316; stroke: #f97316; }

.buy-btn {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: 24px;
  background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4);
  transition: transform .15s, box-shadow .2s;
  position: relative;
  overflow: hidden;
}
.buy-btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  animation: shine 3s ease-in-out infinite;
}
@keyframes shine {
  0%, 60% { left: -100%; }
  100% { left: 200%; }
}
.buy-btn:active { transform: scale(0.97); box-shadow: 0 3px 10px rgba(249, 115, 22, 0.3); }
.buy-btn.disabled {
  background: #334155;
  color: #64748b;
  box-shadow: none;
  cursor: not-allowed;
}
.buy-btn.disabled::after { display: none; }

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity .25s;
}
.modal-mask.show { opacity: 1; pointer-events: auto; }
.modal {
  width: 100%;
  max-width: 480px;
  background: linear-gradient(180deg, #1e293b 0%, #172033 100%);
  border-radius: 22px 22px 0 0;
  padding: 8px 18px 18px;
  padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  transform: translateY(100%);
  transition: transform .32s cubic-bezier(.32,.72,0,1);
  border-top: 1px solid rgba(249, 115, 22, 0.2);
  box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
}
.modal-mask.show .modal { transform: translateY(0); }
.modal-handle {
  width: 36px; height: 4px;
  background: rgba(148, 163, 184, 0.3);
  border-radius: 2px;
  margin: 0 auto 12px;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 16px;
}
.modal-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 28px;
  width: 28px; height: 28px;
  cursor: pointer;
  line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.modal-body { padding-bottom: 4px; }
.modal-product { display: flex; gap: 12px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.08); }
.modal-product img {
  width: 88px; height: 88px;
  border-radius: 12px;
  object-fit: cover;
  background: #0f172a;
  flex-shrink: 0;
}
.modal-product-info { flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.modal-product-name {
  font-size: 14px;
  color: #e2e8f0;
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.modal-product-price { font-size: 20px; color: #f97316; font-weight: 800; margin-bottom: 4px; }
.modal-product-stock { font-size: 11px; color: #64748b; }

.qty-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  margin-bottom: 14px;
}
.qty-label { font-size: 14px; color: #cbd5e1; }
.qty-control { display: flex; align-items: center; gap: 16px; }
.qty-btn {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: #0f172a;
  color: #e2e8f0;
  font-size: 18px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.qty-btn:active { background: #334155; transform: scale(0.92); }
.qty-num { font-size: 16px; color: #f1f5f9; font-weight: 700; min-width: 24px; text-align: center; }

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #cbd5e1;
  margin-bottom: 16px;
}
.summary-price { font-size: 22px; color: #f97316; font-weight: 800; }

.modal-footer { display: flex; gap: 10px; }
.modal-cancel, .modal-confirm {
  flex: 1;
  height: 46px;
  border: none;
  border-radius: 23px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform .15s;
}
.modal-cancel { background: #334155; color: #cbd5e1; }
.modal-cancel:active { transform: scale(0.97); }
.modal-confirm {
  background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
}
.modal-confirm:active { transform: scale(0.97); }

.toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.85);
  background: rgba(15, 23, 42, 0.96);
  color: #f1f5f9;
  padding: 12px 22px;
  border-radius: 12px;
  font-size: 14px;
  z-index: 300;
  opacity: 0;
  pointer-events: none;
  transition: all .25s cubic-bezier(.32,.72,0,1);
  border: 1px solid rgba(148, 163, 184, 0.15);
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  max-width: 80%;
  text-align: center;
}
.toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.toast.success { border-color: rgba(34, 197, 94, 0.45); color: #86efac; }
.toast.error { border-color: rgba(239, 68, 68, 0.45); color: #fca5a5; }

@media (max-width: 360px) {
  .price-value { font-size: 30px; }
  .product-name { font-size: 16px; }
  .tag-desc { display: none; }
}`;

const PRODUCT_DETAIL_JS = `(function () {
  'use strict';

  var DEFAULT_PRODUCT = {
    id: 'P20240601',
    name: '北欧原木极简落地灯 黄昏系列｜客厅卧室氛围照明灯具',
    image: 'https://picsum.photos/seed/nordiclamp88/800/800.jpg',
    price: 469,
    originPrice: 698,
    stock: 36,
    sold: 1284,
    detail: {
      intro: '采用北欧极简设计语言，原木质感灯杆搭配磨砂布艺灯罩，柔和不刺眼，为空间注入一抹温暖的黄昏光。一盏灯，一段静谧时光。',
      images: [
        'https://picsum.photos/seed/lampdetail01/800/520.jpg',
        'https://picsum.photos/seed/lampdetail02/800/600.jpg',
        'https://picsum.photos/seed/lampdetail03/800/680.jpg'
      ],
      sections: [
        {
          title: '设计理念',
          text: '灵感源自北欧黄昏时分的天空，柔和的暖光透过双层布艺灯罩均匀散射，营造安静、松弛的居家氛围。让每一束光，都成为生活的一部分。'
        },
        {
          title: '材质工艺',
          text: '灯杆甄选北美 FAS 级白橡木，经 18 道工序打磨上油，触感温润；灯罩采用高密度亚麻布料，透光均匀耐久不褪色。'
        },
        {
          title: '产品参数',
          list: [
            '色温：2700K 暖黄光',
            '功率：12W LED 高亮灯珠',
            '高度：148cm',
            '灯罩直径：28cm',
            '开关：脚踏式 + 无极调光',
            '材质：白橡木 + 亚麻布艺',
            '寿命：≥ 30000 小时'
          ]
        }
      ]
    }
  };

  var STORAGE_KEY = 'product_detail_data';
  var CART_KEY = 'cart_records';

  var state = {
    product: null,
    cartRecords: [],
    quantity: 1,
    favorited: false
  };

  var els = {};
  var toastTimer = null;

  function cacheDom() {
    els.productImage = document.getElementById('productImage');
    els.stockTag = document.getElementById('stockTag');
    els.productPrice = document.getElementById('productPrice');
    els.productOriginPrice = document.getElementById('productOriginPrice');
    els.priceBadge = document.getElementById('priceBadge');
    els.productName = document.getElementById('productName');
    els.soldCount = document.getElementById('soldCount');
    els.stockCount = document.getElementById('stockCount');
    els.detailContent = document.getElementById('detailContent');
    els.buyBtn = document.getElementById('buyBtn');
    els.favBtn = document.getElementById('favBtn');
    els.cartBtn = document.getElementById('cartBtn');
    els.backBtn = document.getElementById('backBtn');
    els.shareBtn = document.getElementById('shareBtn');
    els.modalMask = document.getElementById('modalMask');
    els.modalClose = document.getElementById('modalClose');
    els.modalCancel = document.getElementById('modalCancel');
    els.modalConfirm = document.getElementById('modalConfirm');
    els.modalImage = document.getElementById('modalImage');
    els.modalName = document.getElementById('modalName');
    els.modalPrice = document.getElementById('modalPrice');
    els.modalStock = document.getElementById('modalStock');
    els.qtyNum = document.getElementById('qtyNum');
    els.qtyMinus = document.getElementById('qtyMinus');
    els.qtyPlus = document.getElementById('qtyPlus');
    els.summaryPrice = document.getElementById('summaryPrice');
    els.toast = document.getElementById('toast');
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.id && typeof parsed.stock === 'number') {
          state.product = parsed;
        } else {
          state.product = JSON.parse(JSON.stringify(DEFAULT_PRODUCT));
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.product)); } catch (e) {}
        }
      } else {
        state.product = JSON.parse(JSON.stringify(DEFAULT_PRODUCT));
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.product)); } catch (e) {}
      }
    } catch (e) {
      state.product = JSON.parse(JSON.stringify(DEFAULT_PRODUCT));
    }

    try {
      var cartRaw = localStorage.getItem(CART_KEY);
      state.cartRecords = cartRaw ? JSON.parse(cartRaw) : [];
      if (!Array.isArray(state.cartRecords)) state.cartRecords = [];
    } catch (e) {
      state.cartRecords = [];
    }
  }

  function saveProduct() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.product));
    } catch (e) {}
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cartRecords));
    } catch (e) {}
  }

  function renderProduct() {
    var p = state.product;
    els.productImage.src = p.image;
    els.productImage.alt = p.name;
    els.productPrice.textContent = p.price;
    els.productName.textContent = p.name;
    els.stockCount.textContent = p.stock;
    els.soldCount.textContent = p.sold;

    if (p.originPrice && p.originPrice > p.price) {
      els.productOriginPrice.textContent = '¥' + p.originPrice;
      els.productOriginPrice.style.display = '';
    } else {
      els.productOriginPrice.style.display = 'none';
    }

    if (p.stock <= 0) {
      els.stockTag.textContent = '已售罄';
      els.stockTag.classList.add('sold-out');
      els.buyBtn.textContent = '已售罄';
      els.buyBtn.classList.add('disabled');
      els.buyBtn.disabled = true;
      els.priceBadge.textContent = '暂时缺货';
      els.priceBadge.style.opacity = '0.5';
    } else {
      els.stockTag.textContent = '现货 · ' + p.stock + ' 件';
      els.stockTag.classList.remove('sold-out');
      els.buyBtn.textContent = '立即购买';
      els.buyBtn.classList.remove('disabled');
      els.buyBtn.disabled = false;
      els.priceBadge.textContent = '限时直降';
      els.priceBadge.style.opacity = '1';
    }

    var html = '';
    html += '<p>' + escapeHtml(p.detail.intro) + '</p>';
    if (p.detail.images && p.detail.images[0]) {
      html += '<img src="' + p.detail.images[0] + '" alt="详情图1" loading="lazy">';
    }
    var sections = p.detail.sections || [];
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      html += '<h3>' + escapeHtml(s.title) + '</h3>';
      if (s.text) html += '<p>' + escapeHtml(s.text) + '</p>';
      if (s.list && s.list.length) {
        html += '<ul>';
        for (var j = 0; j < s.list.length; j++) {
          html += '<li>' + escapeHtml(s.list[j]) + '</li>';
        }
        html += '</ul>';
      }
      if (p.detail.images[i + 1]) {
        html += '<img src="' + p.detail.images[i + 1] + '" alt="详情图' + (i + 2) + '" loading="lazy">';
      }
    }
    els.detailContent.innerHTML = html;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showToast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = 'toast show ' + (type || '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 1800);
  }

  function updateModalPrice() {
    var p = state.product;
    var total = p.price * state.quantity;
    els.modalPrice.textContent = '¥' + p.price;
    els.summaryPrice.textContent = '¥' + total;
    els.modalStock.textContent = '库存 ' + p.stock + ' 件';
  }

  function openModal() {
    var p = state.product;
    state.quantity = 1;
    els.qtyNum.textContent = state.quantity;
    els.modalImage.src = p.image;
    els.modalImage.alt = p.name;
    els.modalName.textContent = p.name;
    updateModalPrice();
    els.modalMask.classList.add('show');
  }

  function closeModal() {
    els.modalMask.classList.remove('show');
  }

  function bindEvents() {
    els.buyBtn.addEventListener('click', function () {
      if (els.buyBtn.disabled) return;
      if (state.product.stock <= 0) {
        showToast('商品已售罄', 'error');
        return;
      }
      openModal();
    });

    els.modalClose.addEventListener('click', closeModal);
    els.modalCancel.addEventListener('click', closeModal);
    els.modalMask.addEventListener('click', function (e) {
      if (e.target === els.modalMask) closeModal();
    });

    els.qtyMinus.addEventListener('click', function () {
      if (state.quantity > 1) {
        state.quantity--;
        els.qtyNum.textContent = state.quantity;
        updateModalPrice();
      }
    });

    els.qtyPlus.addEventListener('click', function () {
      if (state.quantity < state.product.stock) {
        state.quantity++;
        els.qtyNum.textContent = state.quantity;
        updateModalPrice();
      } else {
        showToast('已达库存上限', 'error');
      }
    });

    els.modalConfirm.addEventListener('click', function () {
      var p = state.product;
      if (p.stock <= 0) {
        showToast('商品已售罄', 'error');
        closeModal();
        return;
      }
      if (state.quantity > p.stock) {
        showToast('库存不足', 'error');
        return;
      }
      var record = {
        orderId: 'ORD' + Date.now(),
        productId: p.id,
        name: p.name,
        price: p.price,
        quantity: state.quantity,
        total: p.price * state.quantity,
        time: new Date().getTime()
      };
      state.cartRecords.push(record);
      p.stock -= state.quantity;
      p.sold += state.quantity;
      saveCart();
      saveProduct();
      renderProduct();
      closeModal();
      showToast('下单成功 · 共' + state.cartRecords.length + '笔记录', 'success');
    });

    els.favBtn.addEventListener('click', function () {
      state.favorited = !state.favorited;
      els.favBtn.classList.toggle('active', state.favorited);
      showToast(state.favorited ? '已加入收藏' : '已取消收藏', 'success');
    });

    els.cartBtn.addEventListener('click', function () {
      var count = state.cartRecords.length;
      if (count === 0) {
        showToast('暂无购买记录', '');
      } else {
        var last = state.cartRecords[state.cartRecords.length - 1];
        showToast('共' + count + '笔记录 · 最近¥' + last.total, 'success');
      }
    });

    els.backBtn.addEventListener('click', function () {
      showToast('返回上一页');
    });

    els.shareBtn.addEventListener('click', function () {
      showToast('链接已复制到剪贴板', 'success');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.modalMask.classList.contains('show')) {
        closeModal();
      }
    });
  }

  function init() {
    cacheDom();
    loadData();
    renderProduct();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`;


/* ------------------------------------------------------------------ */
/* 番茄钟计时器                                                          */
/* ------------------------------------------------------------------ */

const POMODORO_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>番茄钟计时器</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="focus-mode">
  <div class="app">
    <header>
      <h1>番茄钟</h1>
      <button id="settings-btn" aria-label="设置">设置</button>
    </header>

    <div class="mode-tabs">
      <button id="focus-tab" class="mode-tab active">专注</button>
      <button id="break-tab" class="mode-tab">休息</button>
    </div>

    <div class="timer-display">
      <svg class="progress-ring" viewBox="0 0 300 300">
        <circle id="progress-bg" cx="150" cy="150" r="140"></circle>
        <circle id="progress-circle" cx="150" cy="150" r="140"></circle>
      </svg>
      <div class="time-wrapper">
        <div class="time-text" id="time-text">25:00</div>
        <div class="mode-label" id="mode-label">专注模式</div>
      </div>
    </div>

    <div class="controls">
      <button id="reset-btn" class="ctrl-btn small" aria-label="重置">重置</button>
      <button id="start-btn" class="ctrl-btn primary">开始</button>
      <button id="skip-btn" class="ctrl-btn small" aria-label="跳过">跳过</button>
    </div>

    <div class="stats">
      <div class="stat-item">
        <div class="stat-value" id="focus-count">0</div>
        <div class="stat-label">今日专注次数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" id="focus-duration">0分钟</div>
        <div class="stat-label">今日专注时长</div>
      </div>
    </div>

    <p class="tip" id="tip-text"></p>
  </div>

  <div class="modal-overlay" id="settings-modal">
    <div class="modal-content">
      <h2>时长设置</h2>
      <div class="form-row">
        <label for="focus-input">专注时长（分钟）</label>
        <input type="number" id="focus-input" min="1" max="90" value="25">
      </div>
      <div class="form-row">
        <label for="break-input">休息时长（分钟）</label>
        <input type="number" id="break-input" min="1" max="30" value="5">
      </div>
      <div class="form-row">
        <label for="long-break-input">长休息时长（分钟）</label>
        <input type="number" id="long-break-input" min="1" max="60" value="15">
      </div>
      <div class="modal-actions">
        <button id="cancel-settings" class="btn-ghost">取消</button>
        <button id="save-settings" class="btn-primary">保存</button>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>`;

const POMODORO_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #f1f5f9;
  min-height: 100vh;
  transition: background 0.8s ease;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

body.focus-mode {
  background: radial-gradient(ellipse at top, #2a1018 0%, #1a0f1a 40%, #0f172a 100%);
}

body.break-mode {
  background: radial-gradient(ellipse at top, #0f2820 0%, #0f1f1a 40%, #0f172a 100%);
}

.app {
  max-width: 560px;
  margin: 0 auto;
  padding: 28px 20px 32px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #e2e8f0;
}

#settings-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 8px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.25s;
}

#settings-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f8fafc;
}

.mode-tabs {
  display: flex;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 5px;
  border-radius: 14px;
  margin-bottom: 20px;
}

.mode-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 11px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.mode-tab.active {
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
}

.focus-mode .mode-tab.active {
  color: #fb7185;
  background: rgba(251, 113, 133, 0.12);
}

.break-mode .mode-tab.active {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}

.timer-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 20px 0;
  min-height: 320px;
}

.progress-ring {
  position: absolute;
  width: 300px;
  height: 300px;
  transform: rotate(-90deg);
  top: 50%;
  left: 50%;
  margin-top: -150px;
  margin-left: -150px;
}

.progress-ring circle {
  fill: none;
  stroke-width: 5;
}

#progress-bg {
  stroke: rgba(255, 255, 255, 0.05);
}

#progress-circle {
  stroke: #a855f7;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.95s linear, stroke 0.6s;
}

.focus-mode #progress-circle {
  stroke: #fb7185;
}

.break-mode #progress-circle {
  stroke: #4ade80;
}

.time-wrapper {
  position: relative;
  z-index: 1;
  text-align: center;
}

.time-text {
  font-size: 76px;
  font-weight: 200;
  font-variant-numeric: tabular-nums;
  letter-spacing: 3px;
  line-height: 1;
  color: #f8fafc;
}

.mode-label {
  margin-top: 12px;
  font-size: 13px;
  color: #64748b;
  letter-spacing: 4px;
  text-transform: uppercase;
}

.controls {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  margin: 24px 0 32px;
}

.ctrl-btn {
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.25s;
  color: #f8fafc;
  font-family: inherit;
}

.ctrl-btn.small {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ctrl-btn.small:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f8fafc;
  transform: translateY(-2px);
}

.ctrl-btn.primary {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: #a855f7;
  font-size: 17px;
  box-shadow: 0 10px 30px rgba(168, 85, 247, 0.35);
}

.focus-mode .ctrl-btn.primary {
  background: #e11d48;
  box-shadow: 0 10px 30px rgba(225, 29, 72, 0.4);
}

.break-mode .ctrl-btn.primary {
  background: #16a34a;
  box-shadow: 0 10px 30px rgba(22, 163, 74, 0.4);
}

.ctrl-btn.primary:hover {
  transform: scale(1.06);
}

.ctrl-btn.primary:active {
  transform: scale(0.97);
}

.stats {
  display: flex;
  gap: 14px;
}

.stat-item {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 18px 14px;
  text-align: center;
}

.stat-value {
  font-size: 26px;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  letter-spacing: 1px;
}

.tip {
  text-align: center;
  margin-top: 18px;
  font-size: 13px;
  color: #64748b;
  min-height: 20px;
  transition: opacity 0.3s;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-overlay.show {
  display: flex;
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: #1e293b;
  border-radius: 18px;
  padding: 28px;
  width: 100%;
  max-width: 380px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-content h2 {
  margin-bottom: 22px;
  font-size: 19px;
  color: #f8fafc;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.form-row input {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.form-row input:focus {
  border-color: #a855f7;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 26px;
}

.modal-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  transition: all 0.2s;
}

.btn-ghost {
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.12);
}

.btn-primary {
  background: #a855f7;
  color: #fff;
}

.btn-primary:hover {
  background: #9333ea;
}

@media (max-width: 480px) {
  .time-text {
    font-size: 60px;
  }
  .progress-ring {
    width: 260px;
    height: 260px;
    margin-top: -130px;
    margin-left: -130px;
  }
  .ctrl-btn.primary {
    width: 76px;
    height: 76px;
    font-size: 15px;
  }
  .ctrl-btn.small {
    width: 52px;
    height: 52px;
  }
  .stat-value {
    font-size: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}`;

const POMODORO_JS = `(function () {
  'use strict';

  var DEFAULT_SETTINGS = {
    focusDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15
  };

  var STORAGE_RECORDS = 'pomodoro-records';
  var STORAGE_SETTINGS = 'pomodoro-settings';

  var state = {
    mode: 'focus',
    remaining: 25 * 60,
    isRunning: false,
    timerId: null,
    settings: cloneSettings(DEFAULT_SETTINGS),
    completedFocusInRound: 0
  };

  var el = {};

  function cloneSettings(s) {
    return { focusDuration: s.focusDuration, breakDuration: s.breakDuration, longBreakDuration: s.longBreakDuration };
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_SETTINGS);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.settings = {
          focusDuration: clampInt(parsed.focusDuration, 1, 90, 25),
          breakDuration: clampInt(parsed.breakDuration, 1, 30, 5),
          longBreakDuration: clampInt(parsed.longBreakDuration, 1, 60, 15)
        };
      }
    } catch (e) {
      state.settings = cloneSettings(DEFAULT_SETTINGS);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
    } catch (e) {}
  }

  function clampInt(val, min, max, fallback) {
    var n = parseInt(val, 10);
    if (isNaN(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function loadRecords() {
    try {
      var raw = localStorage.getItem(STORAGE_RECORDS);
      if (raw) return JSON.parse(raw) || [];
    } catch (e) {}
    return [];
  }

  function saveRecord(record) {
    try {
      var records = loadRecords();
      records.push(record);
      localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records));
    } catch (e) {}
  }

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function getTodayRecords() {
    var records = loadRecords();
    var today = todayStr();
    return records.filter(function (r) { return r.date === today; });
  }

  function updateStats() {
    var today = getTodayRecords();
    var focusDone = today.filter(function (r) { return r.type === 'focus' && r.completed; });
    var totalMin = 0;
    focusDone.forEach(function (r) { totalMin += r.duration; });
    el.focusCount.textContent = focusDone.length;
    el.focusDuration.textContent = formatDuration(totalMin);
  }

  function formatDuration(minutes) {
    if (minutes === 0) return '0分钟';
    if (minutes < 60) return minutes + '分钟';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (m === 0) return h + '小时';
    return h + '小时' + m + '分';
  }

  function formatTime(seconds) {
    var s = Math.max(0, seconds);
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function getTotalSeconds() {
    if (state.mode === 'focus') return state.settings.focusDuration * 60;
    if (state.mode === 'longBreak') return state.settings.longBreakDuration * 60;
    return state.settings.breakDuration * 60;
  }

  function modeLabel() {
    if (state.mode === 'focus') return '专注模式';
    if (state.mode === 'longBreak') return '长休息模式';
    return '休息模式';
  }

  function updateDisplay() {
    el.timeText.textContent = formatTime(state.remaining);
    el.modeLabel.textContent = modeLabel();

    var total = getTotalSeconds();
    var progress = total > 0 ? 1 - state.remaining / total : 0;
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;
    updateProgressRing(progress);

    document.body.className = state.mode === 'focus' ? 'focus-mode' : 'break-mode';

    el.startBtn.textContent = state.isRunning ? '暂停' : '开始';
    el.focusTab.classList.toggle('active', state.mode === 'focus');
    el.breakTab.classList.toggle('active', state.mode !== 'focus');

    document.title = formatTime(state.remaining) + ' · ' + modeLabel();
  }

  function updateProgressRing(progress) {
    var circle = el.progressCircle;
    var radius = parseFloat(circle.getAttribute('r')) || 140;
    var circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = circumference.toString();
    circle.style.strokeDashoffset = (circumference * (1 - progress)).toString();
  }

  function startTimer() {
    if (state.isRunning) return;
    state.isRunning = true;
    el.tipText.textContent = '';
    updateDisplay();
    state.timerId = setInterval(tick, 1000);
  }

  function pauseTimer() {
    state.isRunning = false;
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    updateDisplay();
  }

  function tick() {
    state.remaining--;
    if (state.remaining <= 0) {
      state.remaining = 0;
      updateDisplay();
      timerComplete();
    } else {
      updateDisplay();
    }
  }

  function timerComplete() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    state.isRunning = false;
    playChime();

    var minutes = getTotalSeconds() / 60;
    saveRecord({
      date: todayStr(),
      type: state.mode,
      duration: minutes,
      completed: true
    });

    if (state.mode === 'focus') {
      state.completedFocusInRound++;
      var nextMode = (state.completedFocusInRound % 4 === 0) ? 'longBreak' : 'break';
      switchMode(nextMode, false);
      el.tipText.textContent = '专注完成，开始' + (nextMode === 'longBreak' ? '长' : '') + '休息';
      updateStats();
      startTimer();
    } else {
      switchMode('focus', false);
      el.tipText.textContent = '休息结束，点击开始下一轮专注';
      updateStats();
      updateDisplay();
    }
  }

  function switchMode(mode, resetRunning) {
    state.mode = mode;
    state.remaining = getTotalSeconds();
    state.isRunning = false;
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (resetRunning) {
      el.tipText.textContent = '';
    }
    updateDisplay();
  }

  function resetTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    state.isRunning = false;
    state.remaining = getTotalSeconds();
    el.tipText.textContent = '';
    updateDisplay();
  }

  function skipCurrent() {
    if (state.isRunning || state.remaining < getTotalSeconds()) {
      if (state.mode === 'focus') {
        var elapsedMin = (getTotalSeconds() - state.remaining) / 60;
        if (elapsedMin > 0) {
          saveRecord({
            date: todayStr(),
            type: 'focus',
            duration: Math.round(elapsedMin * 10) / 10,
            completed: false
          });
        }
        state.completedFocusInRound++;
        var nextMode = (state.completedFocusInRound % 4 === 0) ? 'longBreak' : 'break';
        switchMode(nextMode, true);
        el.tipText.textContent = '已跳过，进入' + (nextMode === 'longBreak' ? '长' : '') + '休息';
      } else {
        switchMode('focus', true);
        el.tipText.textContent = '已跳过休息，进入专注';
      }
      updateStats();
    } else {
      if (state.mode === 'focus') {
        switchMode('break', true);
      } else {
        switchMode('focus', true);
      }
    }
  }

  function playChime() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var now = ctx.currentTime;
      var notes = [880, 1108.73, 1318.51];
      for (var i = 0; i < notes.length; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = notes[i];
        var start = now + i * 0.28;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.start(start);
        osc.stop(start + 0.45);
      }
    } catch (e) {}
  }

  function openSettings() {
    el.focusInput.value = state.settings.focusDuration;
    el.breakInput.value = state.settings.breakDuration;
    el.longBreakInput.value = state.settings.longBreakDuration;
    el.settingsModal.classList.add('show');
  }

  function closeSettings() {
    el.settingsModal.classList.remove('show');
  }

  function saveSettingsHandler() {
    state.settings.focusDuration = clampInt(el.focusInput.value, 1, 90, 25);
    state.settings.breakDuration = clampInt(el.breakInput.value, 1, 30, 5);
    state.settings.longBreakDuration = clampInt(el.longBreakInput.value, 1, 60, 15);
    saveSettings();
    closeSettings();
    if (!state.isRunning) {
      state.remaining = getTotalSeconds();
      updateDisplay();
    }
  }

  function init() {
    el.timeText = document.getElementById('time-text');
    el.modeLabel = document.getElementById('mode-label');
    el.startBtn = document.getElementById('start-btn');
    el.resetBtn = document.getElementById('reset-btn');
    el.skipBtn = document.getElementById('skip-btn');
    el.focusTab = document.getElementById('focus-tab');
    el.breakTab = document.getElementById('break-tab');
    el.focusCount = document.getElementById('focus-count');
    el.focusDuration = document.getElementById('focus-duration');
    el.progressCircle = document.getElementById('progress-circle');
    el.settingsBtn = document.getElementById('settings-btn');
    el.settingsModal = document.getElementById('settings-modal');
    el.focusInput = document.getElementById('focus-input');
    el.breakInput = document.getElementById('break-input');
    el.longBreakInput = document.getElementById('long-break-input');
    el.cancelSettings = document.getElementById('cancel-settings');
    el.saveSettings = document.getElementById('save-settings');
    el.tipText = document.getElementById('tip-text');

    loadSettings();
    state.remaining = getTotalSeconds();

    el.startBtn.addEventListener('click', function () {
      if (state.isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    });

    el.resetBtn.addEventListener('click', resetTimer);
    el.skipBtn.addEventListener('click', skipCurrent);

    el.focusTab.addEventListener('click', function () {
      if (state.mode !== 'focus') {
        switchMode('focus', true);
      }
    });

    el.breakTab.addEventListener('click', function () {
      if (state.mode === 'focus') {
        switchMode('break', true);
      }
    });

    el.settingsBtn.addEventListener('click', openSettings);
    el.cancelSettings.addEventListener('click', closeSettings);
    el.saveSettings.addEventListener('click', saveSettingsHandler);

    el.settingsModal.addEventListener('click', function (e) {
      if (e.target === el.settingsModal) closeSettings();
    });

    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && el.settingsModal.classList.contains('show') === false) {
        e.preventDefault();
        if (state.isRunning) pauseTimer();
        else startTimer();
      }
      if (e.code === 'Escape' && el.settingsModal.classList.contains('show')) {
        closeSettings();
      }
    });

    updateProgressRing(0);
    updateDisplay();
    updateStats();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`;

/* ------------------------------------------------------------------ */

export const TEMPLATE_BLUEPRINTS: TemplateBlueprint[] = [
        {
    id: 'pomodoro',
    keywords: ['番茄', '番茄钟', '计时器', '专注', '倒计时', '时钟', '时间管理'],
    blueprint: {
      appName: '番茄钟计时器',
      summary: '番茄钟计时器应用，支持完整的交互功能。',
      entities: [{ name: 'Item', fields: ['id', 'name', 'desc'] }],
      features: ['基础交互', '数据展示', '本地持久化'],
      flows: ['用户交互 → 数据更新 → 页面刷新'],
      persistence: 'localStorage 持久化，刷新后数据保留',
      style: '现代暗色风格',
    },
    files: { 'index.html': POMODORO_HTML, 'style.css': POMODORO_CSS, 'app.js': POMODORO_JS },
  },
{
    id: 'product-detail',
    keywords: ['商品', '详情', '购物', '电商', '产品', '商城'],
    blueprint: {
      appName: '商品详情页',
      summary: '商品详情页应用，支持完整的交互功能。',
      entities: [{ name: 'Item', fields: ['id', 'name', 'desc'] }],
      features: ['基础交互', '数据展示', '本地持久化'],
      flows: ['用户交互 → 数据更新 → 页面刷新'],
      persistence: 'localStorage 持久化，刷新后数据保留',
      style: '现代暗色风格',
    },
    files: { 'index.html': PRODUCT_DETAIL_HTML, 'style.css': PRODUCT_DETAIL_CSS, 'app.js': PRODUCT_DETAIL_JS },
  },
{
    id: 'spring-festival-ppt',
    keywords: ['春节', '晚会', 'PPT', '幻灯片', '节目', '展演', '春晚', '拜年', '新年'],
    blueprint: {
      appName: '春节联欢晚会',
      summary: '春节晚会节目展演 PPT，支持翻页、自动播放、全屏、节目目录与新增节目。',
      entities: [{ name: 'Slide', fields: ['id', 'title', 'type', 'content', 'performer'] }],
      features: ['左右翻页', '自动播放', '全屏展示', '节目目录', '新增节目', '进度指示', '烟花特效'],
      flows: ['点击左右按钮或方向键翻页 → 页面切换动画 → 进度条更新', '点击目录按钮 → 展开节目单 → 点击节目快速跳转', '点击自动播放 → 自动翻页 → 再次点击暂停'],
      persistence: 'localStorage 键 atoms_ppt_slides，刷新后新增节目保留',
      style: '中国红 + 金色主题，灯笼、祥云、烟花等春节元素，楷体字体',
    },
    files: { 'index.html': PPT_HTML, 'style.css': PPT_CSS, 'app.js': PPT_JS },
  },
{
    id: 'ledger',
    keywords: ['记账', '账本', '记账本', '开销', '支出', '消费', '账单', '预算', '花销', '财务'],
    blueprint: {
      appName: '个人记账本',
      summary: '记录每日开销，按分类筛选并统计月度总支出。',
      entities: [{ name: 'Record', fields: ['id', 'desc', 'amount', 'category', 'date'] }],
      features: ['新增记账记录', '删除记录', '按分类筛选', '本月总开销统计', '累计开销统计'],
      flows: ['填写说明/金额/分类/日期 → 添加 → 列表与统计即时更新', '点击分类标签筛选列表', '点击删除移除记录'],
      persistence: 'localStorage 键 atoms_ledger_records，刷新后数据保留',
      style: '现代暗色，紫色强调色，卡片式布局',
    },
    files: { 'index.html': LEDGER_HTML, 'style.css': SHARED_CSS, 'app.js': LEDGER_JS },
  },
  {
    id: 'todo',
    keywords: ['待办', '任务', 'todo', '清单', '计划', '事项', '打卡', '日程'],
    blueprint: {
      appName: '待办清单',
      summary: '管理任务清单，支持优先级、完成标记与状态筛选。',
      entities: [{ name: 'Todo', fields: ['id', 'title', 'priority', 'done', 'createdAt'] }],
      features: ['新增任务', '勾选完成', '删除任务', '按状态筛选', '进度统计'],
      flows: ['输入任务与优先级 → 添加 → 列表更新', '勾选复选框切换完成状态', '筛选全部/待完成/已完成'],
      persistence: 'localStorage 键 atoms_todo_items，刷新后数据保留',
      style: '现代暗色，紫色强调色，卡片式布局',
    },
    files: { 'index.html': TODO_HTML, 'style.css': SHARED_CSS, 'app.js': TODO_JS },
  },
  {
    id: 'generic',
    keywords: ['管理', '列表', '收藏', '笔记', '通讯录', '库存', '客户', '增删改查', 'crud'],
    blueprint: {
      appName: '数据管理台',
      summary: '通用条目管理：新增、搜索、删除，并按状态统计。',
      entities: [{ name: 'Item', fields: ['id', 'name', 'note', 'status', 'createdAt'] }],
      features: ['新增条目', '关键词搜索', '删除条目', '状态标签', '数量统计'],
      flows: ['填写名称/备注/状态 → 新增 → 列表更新', '输入关键词实时过滤列表', '点击删除移除条目'],
      persistence: 'localStorage 键 atoms_generic_items，刷新后数据保留',
      style: '现代暗色，紫色强调色，卡片式布局',
    },
    files: { 'index.html': GENERIC_HTML, 'style.css': SHARED_CSS, 'app.js': GENERIC_JS },
  },
];

export interface TemplateMatch {
  template: TemplateBlueprint;
  score: number;
  hits: string[];
}

/**
 * 关键词长度加权评分匹配。
 *
 * 计分规则：命中关键词得分 = 关键词长度（越具体权重越高），
 * 总分需超过阈值才认为命中模板蓝图。
 */
export function findBestTemplate(requirement: string, threshold = 2): TemplateMatch | null {
  const text = (requirement || '').toLowerCase();
  if (!text.trim()) return null;

  let best: TemplateMatch | null = null;
  TEMPLATE_BLUEPRINTS.forEach((template) => {
    const hits: string[] = [];
    let score = 0;
    template.keywords.forEach((keyword) => {
      if (text.includes(keyword.toLowerCase())) {
        hits.push(keyword);
        score += keyword.length;
      }
    });
    if (score > 0 && (!best || score > best.score)) {
      best = { template, score, hits };
    }
  });

  if (best && best.score >= threshold) return best;
  return null;
}

/** LLM 完全不可用时的最终兜底模板。 */
export function fallbackTemplate(): TemplateBlueprint {
  return TEMPLATE_BLUEPRINTS[TEMPLATE_BLUEPRINTS.length - 1];
}