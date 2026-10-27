#!/usr/bin/env node
// inbox 資料夾工具：建立正確的素材資料夾架構（日期／直播／複習／MSBK／週總結）
// 用法：node scripts/inbox.js new [日期] [類型...]，不帶參數會列出用法
'use strict';

const fs = require('fs');
const path = require('path');

const INBOX = path.join(__dirname, '..', 'inbox');
const TYPES = { group: '群組', live: '直播', review: '複習', msbk: 'MSBK', week: '週總結' };

function die(msg) {
  console.error('✖ ' + msg);
  process.exit(1);
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 接受 YYYY-MM-DD、M/D（今年）、today
function parseDate(s) {
  if (s === 'today') return fmtDate(new Date());
  let y, m, d;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) [y, m, d] = s.split('-').map(Number);
  else if (/^\d{1,2}\/\d{1,2}$/.test(s)) { [m, d] = s.split('/').map(Number); y = new Date().getFullYear(); }
  else return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) die(`日期不存在：${s}`);
  return fmtDate(date);
}

function monday(s) {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return fmtDate(date);
}

function mkdir(rel) {
  const full = path.join(INBOX, rel);
  const existed = fs.existsSync(full);
  fs.mkdirSync(full, { recursive: true });
  console.log(`${existed ? '－ 已存在' : '✓ 建立'} inbox/${rel.split(path.sep).join('/')}/`);
}

function cmdNew(args) {
  let date = fmtDate(new Date());
  if (args.length && !(args[0] in TYPES)) {
    date = parseDate(args[0]);
    if (!date) die(`無法辨識的日期或類型：${args[0]}（日期需為 YYYY-MM-DD、M/D 或 today；類型：${Object.keys(TYPES).join('、')}）`);
    args = args.slice(1);
  }
  const types = args.length ? [...new Set(args)] : ['group'];
  const bad = types.filter(t => !(t in TYPES));
  if (bad.length) die(`未知的類型：${bad.join('、')}（可用：${Object.keys(TYPES).join('、')}）`);

  for (const t of types) {
    if (t === 'group') mkdir(date);
    else if (t === 'week') {
      mkdir('weeks');
      const mon = monday(date);
      console.log(`   請把週總結存成 inbox/weeks/${mon}.txt${mon !== date ? `（${date} 那週的週一）` : ''}`);
    } else mkdir(path.join(date, t));
  }
  console.log('放好素材後，跟 Claude Code 說「整理 inbox」。');
}

// 只列出待處理素材（略過 _done/ 與 README.txt），不必掃描已處理的檔案
function files(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile()).map(f => f.name) : [];
}
function cmdList() {
  const lines = [];
  const dirs = fs.readdirSync(INBOX, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== '_done').map(d => d.name).sort();
  for (const name of dirs) {
    const dir = path.join(INBOX, name);
    if (name === 'weeks') {
      const f = files(dir);
      if (f.length) lines.push(`weeks       ${f.join('、')}`);
      continue;
    }
    const parts = [];
    for (const [t, sub] of [['group', ''], ['live', 'live'], ['review', 'review'], ['msbk', 'msbk']]) {
      const f = files(path.join(dir, sub)).filter(n => n !== 'entry.json');
      if (f.length) parts.push(`${TYPES[t]} ${f.length} 檔（${f.join('、')}）`);
    }
    if (parts.length) lines.push(`${name.padEnd(11)} ${parts.join('；')}`);
  }
  console.log(lines.length ? lines.join('\n') : 'inbox 沒有待處理素材');
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'new') cmdNew(rest);
else if (cmd === 'list') cmdList();
else {
  console.log(`inbox 資料夾工具
  new [日期] [類型...]    建立素材資料夾
    日期：YYYY-MM-DD、M/D（今年）或 today，省略 = 今天
    類型：group 群組（預設）、live 直播、review 複習、msbk MSBK 圖文教學、week 週總結，可多個
  list                    列出待處理素材（不含 _done/）
  例：node scripts/inbox.js new 2026-10-23 live review`);
}
