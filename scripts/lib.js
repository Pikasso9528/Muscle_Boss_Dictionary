// 共用：讀寫 data/*.js、個股比對。由 scripts/tags.js 與 scripts/add.js 使用
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ENTRIES_FILE = path.join(ROOT, 'data', 'entries.js');
const TAGS_FILE = path.join(ROOT, 'data', 'tags.js');
const WEEKS_FILE = path.join(ROOT, 'data', 'weeks.js');

// ---------- 讀寫 ----------
function load(file, key, fallbackHeader = '') {
  if (!fs.existsSync(file)) return { data: [], header: fallbackHeader };
  const src = fs.readFileSync(file, 'utf8');
  const ctx = { window: {} };
  vm.runInNewContext(src, ctx, { filename: file });
  // 保留檔頭註解
  return { data: JSON.parse(JSON.stringify(ctx.window[key])), header: src.slice(0, src.indexOf('window.')) };
}

function fmt(v, ind = '') {
  const pad = ind + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(x => typeof x !== 'object' || x === null)) {
      const one = '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
      if (one.length + ind.length < 100) return one;
      return '[\n' + v.map(x => pad + JSON.stringify(x)).join(',\n') + '\n' + ind + ']';
    }
    if (v.every(x => x && typeof x === 'object' && !Object.values(x).some(y => y && typeof y === 'object' && !Array.isArray(y)))) {
      // 物件陣列：每個物件盡量一行（tags.js 的 topics / stocks）
      const lines = v.map(x => '{ ' + Object.keys(x).map(k => `${k}: ${fmtInline(x[k])}`).join(', ') + ' }');
      if (lines.every(l => l.length + pad.length < 110)) return '[\n' + lines.map(l => pad + l).join(',\n') + '\n' + ind + ']';
    }
    return '[\n' + v.map(x => pad + fmt(x, pad)).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter(k => v[k] !== undefined);
    return '{\n' + keys.map(k => `${pad}${k}: ${fmt(v[k], pad)}`).join(',\n') + '\n' + ind + '}';
  }
  return JSON.stringify(v);
}
function fmtInline(v) {
  return Array.isArray(v) ? '[' + v.map(x => JSON.stringify(x)).join(', ') + ']' : JSON.stringify(v);
}

function save(file, key, header, data) {
  fs.writeFileSync(file, header + `window.${key} = ${fmt(data)};\n`);
}

const tagsDb = load(TAGS_FILE, 'TAG_CONFIG');
const entriesDb = load(ENTRIES_FILE, 'ENTRIES');
const weeksDb = load(WEEKS_FILE, 'WEEKS', '// 週總結：每週一筆，start 填週一日期（end 可省略，預設為週日）\n');
const config = tagsDb.data;
const entries = entriesDb.data;
const weeks = weeksDb.data;
const saveTags = () => save(TAGS_FILE, 'TAG_CONFIG', tagsDb.header, config);
// 內容 = 日資料（entries.js，新到舊）+ 週總結（weeks.js，新到舊）
const saveContent = () => {
  entries.sort((a, b) => b.date.localeCompare(a.date));
  weeks.sort((a, b) => b.start.localeCompare(a.start));
  save(ENTRIES_FILE, 'ENTRIES', entriesDb.header, entries);
  save(WEEKS_FILE, 'WEEKS', weeksDb.header, weeks);
};

// ---------- 共用 ----------
const KINDS = { group: '群組', live: '直播', review: '複習', msbk: 'MSBK' };
const label = s => `${s.code} ${s.name}`;
function* eachItem() {
  for (const e of entries) {
    for (const k of Object.keys(KINDS)) for (const i of e[k] || []) yield { e, i, kind: KINDS[k] };
  }
  for (const w of weeks) yield { e: { date: `${w.start} 週`, title: w.title }, i: w, kind: '週總結' };
}
const textOf = i => [i.title, i.summary, ...(i.points || []), i.quote,
  ...(i.sections || []).flatMap(s => [s.heading, ...(s.points || [])])].filter(Boolean).join('\n');

// 內容提到哪些登記個股（代號需前後不是數字，避免 23300 誤判）
// 名稱比對前先移除包含它的其他登記名稱，避免「南亞科」誤判成「南亞」
function mentioned(text) {
  const hits = [];
  const allWords = config.stocks.flatMap(s => [s.name, ...(s.aliases || [])].filter(Boolean).map(w => ({ s, w })));
  for (const s of config.stocks) {
    const word = [s.name, ...(s.aliases || [])].find(a => {
      if (!a) return false;
      const t = allWords.filter(x => x.s !== s && x.w.length > a.length && x.w.includes(a))
        .reduce((acc, x) => acc.split(x.w).join(''), text);
      return t.includes(a);
    });
    if (word) hits.push({ s, word });
    else if (new RegExp(`(^|\\D)${s.code}(\\D|$)`).test(text)) hits.push({ s, word: s.code });
  }
  return hits;
}

// 把「台積電」「2330」等非標準寫法對應回登記個股
function canonical(raw) {
  const t = raw.trim();
  return config.stocks.find(s => t === label(s) || t === s.code || t === s.name ||
    (s.aliases || []).includes(t) || t.startsWith(s.code + ' '));
}

// 自動標記單則內容的個股：統一寫法 + 補上內容提到的登記個股，回傳變更說明
function autoTagStocks(i) {
  const next = [];
  const notes = [];
  for (const raw of i.stocks || []) {
    const s = canonical(raw);
    const v = s ? label(s) : raw;
    if (v !== raw) notes.push(`改名 ${raw} → ${v}`);
    else if (!s) notes.push(`⚠ 未登記個股 ${raw}`);
    if (!next.includes(v)) next.push(v);
  }
  for (const { s, word } of mentioned(textOf(i))) {
    if (!next.includes(label(s))) {
      next.push(label(s));
      notes.push(`+ ${label(s)}（提到「${word}」）`);
    }
  }
  i.stocks = next;
  return notes;
}

function die(msg) {
  console.error('✖ ' + msg);
  process.exit(1);
}

// 寫入 log.txt：[時間] [類別] 內容（多行時後續行縮排）
const LOG_FILE = path.join(ROOT, 'log.txt');
function appendLog(category, lines) {
  lines = [].concat(lines).filter(Boolean);
  if (!lines.length) return;
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const body = lines.map((l, i) => (i ? '    ' : '') + l).join('\n');
  fs.appendFileSync(LOG_FILE, `[${ts}] [${category}] ${body}\n`);
}

module.exports = {
  ROOT, config, entries, weeks, saveTags, saveContent, appendLog,
  KINDS, label, eachItem, textOf, mentioned, canonical, autoTagStocks, die
};
