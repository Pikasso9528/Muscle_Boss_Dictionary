#!/usr/bin/env node
// 內容新增工具：把新內容（JSON）合併進 data/entries.js / data/weeks.js，不需要讀過往資料
// 用法：node scripts/add.js <指令> [參數]，不帶參數會列出所有指令
'use strict';

const fs = require('fs');
const { config, entries, weeks, saveContent, appendLog, KINDS, textOf, autoTagStocks, die } = require('./lib');

const logLines = [];  // 本次變更摘要，最後寫入 log.txt
function done(msg) {
  console.log('✔ ' + msg);
  appendLog('內容', msg);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const topicNames = new Set(config.topics.map(t => t.name));

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function checkDate(s, what) {
  if (!DATE_RE.test(s || '') || fmtDate(parseDate(s)) !== s) die(`${what} 日期格式錯誤：${s}（需為 YYYY-MM-DD）`);
}

// 統一欄位順序，去掉空欄位
function normalize(obj, keys) {
  const out = {};
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && !v.length && k !== 'tags' && k !== 'stocks') continue;
    out[k] = v;
  }
  for (const k of Object.keys(obj)) if (!keys.includes(k)) console.log(`   ⚠ 忽略未知欄位「${k}」`);
  return out;
}
const ITEM_KEYS = ['title', 'time', 'refs', 'tags', 'stocks', 'summary', 'points', 'quote'];
const WEEK_KEYS = ['start', 'end', 'title', 'tags', 'stocks', 'summary', 'sections', 'quote'];

function checkTags(obj, where) {
  if (!Array.isArray(obj.tags)) obj.tags = [];
  if (!Array.isArray(obj.stocks)) obj.stocks = [];
  const unknown = obj.tags.filter(t => !topicNames.has(t));
  if (unknown.length) console.log(`   ⚠ ${where} 使用未登記主題：${unknown.join('、')}（可用 tags.js add-topic 登記或改用既有主題）`);
}

function addDay(input) {
  checkDate(input.date, '日資料');
  let e = entries.find(x => x.date === input.date);
  if (!e) {
    if (!input.title) die(`${input.date} 是新的一天，需要 title（當天一句話概要）`);
    e = { date: input.date, title: input.title };
    entries.push(e);
    console.log(`＋ 新增 ${e.date}「${e.title}」`);
    logLines.push(`新增 ${e.date}「${e.title}」`);
  } else {
    console.log(`～ 合併到既有的 ${e.date}「${e.title}」`);
    logLines.push(`合併 ${e.date}「${e.title}」`);
    if (input.title && input.title !== e.title) {
      console.log(`   標題改為「${input.title}」`);
      logLines.push(`  標題改為「${input.title}」`);
      e.title = input.title;
    }
  }
  let added = 0;
  for (const [k, name] of Object.entries(KINDS)) {
    for (const raw of input[k] || []) {
      if (!raw.title) die(`${e.date} 的${name}內容缺少 title`);
      const item = normalize(raw, ITEM_KEYS);
      checkTags(item, `${e.date} [${name}]`);
      for (const r of item.refs || []) {
        checkDate(r, '複習 refs');
        if (!entries.some(x => x.date === r)) console.log(`   ⚠ refs ${r} 沒有對應的日資料`);
      }
      const notes = autoTagStocks(item);
      const list = e[k] || (e[k] = []);
      const idx = list.findIndex(x => x.title === item.title);
      if (idx === -1) list.push(item);
      else list[idx] = item;
      console.log(`   ${idx === -1 ? '+' : '↻ 更新'} [${name}] ${item.title}`);
      logLines.push(`  ${idx === -1 ? '+' : '更新'} [${name}] ${item.title}${notes.length ? '（' + notes.join('；') + '）' : ''}`);
      notes.forEach(n => console.log('      ' + n));
      added++;
    }
  }
  for (const k of Object.keys(input)) if (!['date', 'title', ...Object.keys(KINDS)].includes(k)) console.log(`   ⚠ 忽略未知欄位「${k}」`);
  if (!added && !input.title) console.log('   （沒有新增任何內容）');
  // 合併後列出當天現況，方便判斷標題是否需要更新
  if (Object.keys(KINDS).reduce((n, k) => n + (e[k] || []).length, 0) > added) {
    console.log(`   當天全部內容：${Object.entries(KINDS).flatMap(([k, n]) => (e[k] || []).map(i => `[${n}]${i.title}`)).join('、')}`);
  }
}

function addWeek(input) {
  checkDate(input.start, '週總結 start');
  if (parseDate(input.start).getDay() !== 1) die(`週總結 start 必須是週一：${input.start}`);
  if (!input.title) die(`週總結 ${input.start} 缺少 title`);
  const w = normalize({ ...input, end: input.end || addDays(input.start, 6) }, WEEK_KEYS);
  checkDate(w.end, '週總結 end');
  checkTags(w, `週總結 ${w.start}`);
  const notes = autoTagStocks(w);
  const idx = weeks.findIndex(x => x.start === w.start);
  if (idx === -1) weeks.push(w);
  else weeks[idx] = w;
  console.log(`${idx === -1 ? '＋ 新增' : '↻ 更新'} 週總結 ${w.start}～${w.end}「${w.title}」`);
  logLines.push(`${idx === -1 ? '新增' : '更新'} 週總結 ${w.start}～${w.end}「${w.title}」${notes.length ? '（' + notes.join('；') + '）' : ''}`);
  notes.forEach(n => console.log('   ' + n));
}

function cmdAdd(files) {
  if (!files.length) die('用法：add <檔案.json> [...]');
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (err) { die(`${f} 不是有效的 JSON：${err.message}`); }
    for (const x of [].concat(data)) {
      if (x.start) addWeek(x);
      else if (x.date) addDay(x);
      else die(`${f} 中有一筆資料沒有 date（日資料）或 start（週總結）`);
    }
  }
  saveContent();
  appendLog('內容', logLines);
  console.log('\n✔ 已寫入 data/entries.js、data/weeks.js，並記錄到 log.txt');
}

// ---------- 精簡輸出（給 Claude 看，避免讀整個資料檔） ----------
function printDay(e) {
  console.log(`■ ${e.date}「${e.title}」`);
  for (const [k, name] of Object.entries(KINDS)) {
    for (const i of e[k] || []) {
      const meta = [...(i.tags || []).map(t => '#' + t), ...(i.stocks || []).map(s => '$' + s)].join(' ');
      console.log(`  [${name}${i.time ? ' ' + i.time : ''}] ${i.title}  ${meta}`);
      if (i.refs) console.log(`    複習自：${i.refs.join('、')}`);
      if (i.summary) console.log(`    ${i.summary}`);
      for (const p of i.points || []) console.log(`    - ${p}`);
      if (i.quote) console.log(`    「${i.quote}」`);
    }
  }
}

function cmdShow(date) {
  checkDate(date, 'show');
  const e = entries.find(x => x.date === date);
  if (!e) return console.log(`${date} 沒有資料`);
  printDay(e);
}

function cmdContext(start) {
  checkDate(start, 'context');
  const d = parseDate(start);
  const monday = addDays(start, -((d.getDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  console.log(`== ${monday}～${sunday} 的每日內容 ==`);
  const days = entries.filter(e => e.date >= monday && e.date <= sunday).sort((a, b) => a.date.localeCompare(b.date));
  if (!days.length) console.log('（這週沒有每日資料）');
  days.forEach(printDay);
  const w = weeks.find(x => x.start === monday);
  if (w) console.log(`\n⚠ 這週已有週總結「${w.title}」，再新增會覆蓋`);
}

function cmdFind(words) {
  const q = words.join(' ').trim().toLowerCase();
  if (!q) die('用法：find <關鍵字>');
  const hits = [];
  for (const e of entries) {
    const before = hits.length;
    for (const [k, name] of Object.entries(KINDS)) {
      for (const i of e[k] || []) {
        if (textOf(i).toLowerCase().includes(q)) hits.push(`${e.date} [${name}] ${i.title}`);
      }
    }
    // 只有當天概要提到時，列出概要本身
    if (hits.length === before && e.title.toLowerCase().includes(q)) hits.push(`${e.date} [當天概要] ${e.title}`);
  }
  for (const w of weeks) if (textOf(w).toLowerCase().includes(q)) hits.push(`${w.start} [週總結] ${w.title}`);
  hits.sort().reverse();
  hits.slice(0, 30).forEach(h => console.log(h));
  console.log(hits.length ? `共 ${hits.length} 筆${hits.length > 30 ? '（只列前 30 筆）' : ''}` : '找不到');
}

function cmdSetTitle(date, title) {
  checkDate(date, 'set-title');
  const e = entries.find(x => x.date === date);
  if (!e || !title) die('用法：set-title <日期> <標題>（日期需已存在）');
  done(`${date} 標題「${e.title}」→「${title}」`);
  e.title = title;
  saveContent();
}

function cmdRemove(kind, key, title) {
  if (kind === 'day') {
    const idx = entries.findIndex(x => x.date === key);
    if (idx === -1) die(`${key} 沒有資料`);
    if (title) {
      // 只移除當天某一則
      const e = entries[idx];
      const k = Object.keys(KINDS).find(k => (e[k] || []).some(i => i.title === title));
      if (!k) die(`${key} 沒有標題為「${title}」的內容`);
      e[k] = e[k].filter(i => i.title !== title);
      if (!e[k].length) delete e[k];
      done(`移除 ${key} [${KINDS[k]}] ${title}`);
      if (!Object.keys(KINDS).some(k => (e[k] || []).length)) {
        entries.splice(idx, 1);
        done(`${key} 已無內容，整天移除`);
      }
    } else {
      entries.splice(idx, 1);
      done(`移除 ${key} 整天`);
    }
  } else {
    const idx = weeks.findIndex(x => x.start === key);
    if (idx === -1) die(`沒有 ${key} 開始的週總結`);
    weeks.splice(idx, 1);
    done(`移除週總結 ${key}`);
  }
  saveContent();
}

const HELP = `內容新增工具
  add <檔案.json> [...]           合併新內容（日資料用 date、週總結用 start），已存在的日期會合併
  show <日期>                     精簡列出某天內容
  context <該週任一日期>          精簡列出該週每日內容（產生週總結用）
  find <關鍵字>                   找出提到關鍵字的日期與標題（找複習 refs 用）
  set-title <日期> <標題>         修改某天的一句話概要
  remove-day <日期> [內容標題]    移除整天，或只移除當天某一則
  remove-week <週一日期>          移除週總結`;

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'add': cmdAdd(args); break;
  case 'show': cmdShow(args[0]); break;
  case 'context': cmdContext(args[0]); break;
  case 'find': cmdFind(args); break;
  case 'set-title': cmdSetTitle(args[0], args.slice(1).join(' ')); break;
  case 'remove-day': cmdRemove('day', args[0], args.slice(1).join(' ')); break;
  case 'remove-week': cmdRemove('week', args[0]); break;
  default: console.log(HELP);
}
