#!/usr/bin/env node
// 標籤管理工具：維護 data/tags.js（登記表）與 data/entries.js、data/weeks.js（內容）
// 用法：node scripts/tags.js <指令> [參數]，不帶參數會列出所有指令
'use strict';

const {
  config, saveTags, saveContent, appendLog, label, eachItem, textOf, mentioned, canonical, die
} = require('./lib');

// 成功訊息同時寫入 log.txt
function done(msg) {
  console.log('✔ ' + msg);
  appendLog('標籤', msg);
}

const PALETTE = ['#3ccf91', '#4fb3e0', '#ff7eb8', '#ff9a5a', '#e6c229', '#9a7cff', '#5ad1c8', '#f07167', '#a3c45a', '#c38cf0'];

function findStock(q) {
  const s = canonical(q);
  if (!s) die(`找不到個股「${q}」，可先用 list 查看登記表`);
  return s;
}

// ---------- 指令 ----------
function cmdList() {
  const topicCount = new Map(), stockCount = new Map();
  for (const { i } of eachItem()) {
    for (const t of i.tags || []) topicCount.set(t, (topicCount.get(t) || 0) + 1);
    for (const s of i.stocks || []) stockCount.set(s, (stockCount.get(s) || 0) + 1);
  }
  console.log('【主題】（則數）');
  for (const t of config.topics) console.log(`  ${t.name}  ${t.color}  ${topicCount.get(t.name) || 0}`);
  const extraTopics = [...topicCount.keys()].filter(t => !config.topics.some(x => x.name === t));
  if (extraTopics.length) console.log('  ⚠ 內容使用但未登記：' + extraTopics.join('、'));

  console.log('\n【個股】（則數）');
  for (const s of config.stocks) {
    const alias = (s.aliases || []).length ? `（別名：${s.aliases.join('、')}）` : '';
    console.log(`  ${label(s)}${alias}  ${stockCount.get(label(s)) || 0}`);
  }
  const extraStocks = [...stockCount.keys()].filter(k => !config.stocks.some(s => label(s) === k));
  if (extraStocks.length) console.log('  ⚠ 內容使用但未登記：' + extraStocks.join('、'));
}

// 自動標記：內容提到的登記個股補上標籤，非標準寫法改成「代號 名稱」
function scan(apply) {
  let changes = 0;
  const logLines = [];
  for (const { e, i, kind } of eachItem()) {
    const before = i.stocks || [];
    const next = [];
    const notes = [];
    for (const raw of before) {
      const s = canonical(raw);
      const v = s ? label(s) : raw;
      if (v !== raw) notes.push(`改名 ${raw} → ${v}`);
      if (!next.includes(v)) next.push(v);
    }
    for (const { s, word } of mentioned(textOf(i))) {
      if (!next.includes(label(s))) {
        next.push(label(s));
        notes.push(`+ ${label(s)}（提到「${word}」）`);
      }
    }
    if (notes.length) {
      changes += notes.length;
      console.log(`${e.date} [${kind}] ${i.title || e.title}`);
      notes.forEach(n => console.log('   ' + n));
      logLines.push(`${e.date} ${i.title || e.title}：${notes.join('；')}`);
      if (apply) i.stocks = next;
    }
  }
  if (!changes) console.log('✔ 所有個股標籤都已是最新');
  else if (apply) {
    saveContent();
    console.log(`\n✔ 已套用 ${changes} 項變更到 data/entries.js、data/weeks.js`);
    appendLog('標籤', [`自動個股標籤：套用 ${changes} 項`, ...logLines]);
  }
  else console.log(`\n共 ${changes} 項建議，執行 apply 套用`);
}

function cmdAddTopic(name, color) {
  if (!name) die('用法：add-topic <名稱> [#顏色]');
  if (config.topics.some(t => t.name === name)) die(`主題「${name}」已存在`);
  const used = new Set(config.topics.map(t => t.color.toLowerCase()));
  color = color || PALETTE.find(c => !used.has(c)) || PALETTE[config.topics.length % PALETTE.length];
  if (!/^#[0-9a-f]{6}$/i.test(color)) die('顏色格式需為 #rrggbb');
  config.topics.push({ name, color });
  saveTags();
  done(`新增主題「${name}」${color}`);
}

function cmdRemoveTopic(name, args) {
  if (!name) die('用法：remove-topic <名稱> [--remap <改成的主題>]');
  const idx = config.topics.findIndex(t => t.name === name);
  if (idx === -1) die(`主題「${name}」不存在`);
  const remap = args[args.indexOf('--remap') + 1];
  if (args.includes('--remap') && !config.topics.some(t => t.name === remap)) die(`--remap 的主題「${remap}」不存在`);
  let n = 0;
  for (const { i } of eachItem()) {
    if (!(i.tags || []).includes(name)) continue;
    n++;
    i.tags = i.tags.filter(t => t !== name);
    if (remap && !i.tags.includes(remap)) i.tags.push(remap);
  }
  config.topics.splice(idx, 1);
  saveTags();
  saveContent();
  done(`移除主題「${name}」，影響 ${n} 則${remap ? `（改標為「${remap}」）` : ''}`);
}

function cmdRenameTopic(from, to) {
  if (!from || !to) die('用法：rename-topic <舊名稱> <新名稱>');
  const t = config.topics.find(x => x.name === from);
  if (!t) die(`主題「${from}」不存在`);
  if (config.topics.some(x => x.name === to)) die(`主題「${to}」已存在，請改用 remove-topic ${from} --remap ${to}`);
  t.name = to;
  let n = 0;
  for (const { i } of eachItem()) {
    const k = (i.tags || []).indexOf(from);
    if (k !== -1) { i.tags[k] = to; n++; }
  }
  saveTags();
  saveContent();
  done(`主題「${from}」改名為「${to}」，影響 ${n} 則`);
}

function cmdTopicColor(name, color) {
  const t = config.topics.find(x => x.name === name);
  if (!t) die(`主題「${name}」不存在`);
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) die('用法：topic-color <名稱> #rrggbb');
  t.color = color;
  saveTags();
  done(`主題「${name}」顏色改為 ${color}`);
}

function cmdAddStock(code, name, aliases) {
  if (!/^\d{4,6}[A-Z]?$/.test(code || '') || !name) die('用法：add-stock <代號> <名稱> [別名...]');
  const s = config.stocks.find(x => x.code === code);
  if (s) {
    // 已存在：補別名
    const added = aliases.filter(a => !(s.aliases || []).includes(a));
    s.aliases = [...(s.aliases || []), ...added];
    saveTags();
    done(`${label(s)} 已存在，新增別名：${added.join('、') || '（無）'}`);
  } else {
    config.stocks.push({ code, name, aliases });
    saveTags();
    done(`新增個股 ${code} ${name}${aliases.length ? '（別名：' + aliases.join('、') + '）' : ''}`);
  }
  console.log('  提示：執行 scan 檢查既有內容是否要補上此標籤');
}

function cmdRemoveStock(q, args) {
  if (!q) die('用法：remove-stock <代號或名稱> [--keep-entries]');
  const s = findStock(q);
  let n = 0;
  if (!args.includes('--keep-entries')) {
    for (const { i } of eachItem()) {
      const before = (i.stocks || []).length;
      i.stocks = (i.stocks || []).filter(x => canonical(x) !== s);
      n += before - i.stocks.length;
    }
    saveContent();
  }
  config.stocks.splice(config.stocks.indexOf(s), 1);
  saveTags();
  done(`移除個股 ${label(s)}，內容中移除 ${n} 個標籤`);
}

function cmdRemoveAlias(q, alias) {
  const s = findStock(q);
  if (!(s.aliases || []).includes(alias)) die(`${label(s)} 沒有別名「${alias}」`);
  s.aliases = s.aliases.filter(a => a !== alias);
  saveTags();
  done(`${label(s)} 移除別名「${alias}」`);
}

const HELP = `標籤管理工具
  list                                 列出主題與個股登記表及使用次數
  scan                                 預覽自動個股標籤（不修改）
  apply                                套用自動個股標籤
  add-topic <名稱> [#顏色]             新增主題
  remove-topic <名稱> [--remap <主題>] 移除主題（內容中的該標籤一併移除或改標）
  rename-topic <舊> <新>               主題改名（內容同步）
  topic-color <名稱> <#顏色>           修改主題顏色
  add-stock <代號> <名稱> [別名...]    新增個股，已存在則補別名
  remove-stock <代號|名稱> [--keep-entries]  移除個股（預設內容中的標籤一併移除）
  remove-alias <代號|名稱> <別名>      移除個股別名`;

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'list': cmdList(); break;
  case 'scan': scan(false); break;
  case 'apply': scan(true); break;
  case 'add-topic': cmdAddTopic(args[0], args[1]); break;
  case 'remove-topic': cmdRemoveTopic(args[0], args); break;
  case 'rename-topic': cmdRenameTopic(args[0], args[1]); break;
  case 'topic-color': cmdTopicColor(args[0], args[1]); break;
  case 'add-stock': cmdAddStock(args[0], args[1], args.slice(2)); break;
  case 'remove-stock': cmdRemoveStock(args[0], args); break;
  case 'remove-alias': cmdRemoveAlias(args[0], args[1]); break;
  default: console.log(HELP);
}
