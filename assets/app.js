(() => {
  'use strict';

  // 密碼鎖：lockEnabled 設 true 並填入密碼的 SHA-256 hash 即啟用（僅防一般瀏覽）
  const CONFIG = {
    lockEnabled: true,
    passwordHash: 'd923700040b2271bcefb62d6823d40628a3a9a91d9a9b3c86d45a3b0e0a69b50'
  };

  // 主題標籤與顏色來自 data/tags.js；每個主題產生 .tag-N 的顏色變數
  const TOPICS = (window.TAG_CONFIG && window.TAG_CONFIG.topics) || [];
  const TAGS = TOPICS.map(t => t.name);
  const tagStyle = document.createElement('style');
  tagStyle.textContent = TOPICS.map((t, i) =>
    `.tag-${i}{--c:color-mix(in srgb,${t.color} 62%,var(--ink));--cs:color-mix(in srgb,${t.color} var(--tag-alpha),transparent)}`).join('\n');
  document.head.appendChild(tagStyle);
  const WEEK = '日一二三四五六';
  const CAL_WEEK = '一二三四五六日';  // 日曆以週一開頭，與週總結（週一～週日）對齊
  const svg = d => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON_LIVE = svg('<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>');
  const ICON_CHAT = svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
  const ICON_BOOK = svg('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>');
  const ICON_WEEK = svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 14h10"/>');
  const ICON_CHEVRON = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  const entries = (window.ENTRIES || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const byDate = new Map(entries.map(e => [e.date, e]));
  const weeks = (window.WEEKS || []).map(w => ({ ...w, end: w.end || addDays(w.start, 6) }))
    .sort((a, b) => b.start.localeCompare(a.start));
  const byWeek = new Map(weeks.map(w => [w.start, w]));
  const hasWeeks = weeks.length > 0;  // 沒有週總結時隱藏週次欄與日/週切換

  const itemsOf = e => [
    ...(e.group || []).map(i => ({ ...i, kind: 'group' })),
    ...(e.live || []).map(i => ({ ...i, kind: 'live' })),
    ...(e.review || []).map(i => ({ ...i, kind: 'review' }))
  ];
  // 漏寫當天概要時，以第一則內容的標題代替
  for (const e of entries) if (!e.title) e.title = (itemsOf(e)[0] || {}).title || e.date;
  const tagsOf = e => new Set(itemsOf(e).flatMap(i => i.tags || []));
  const stocksOf = e => new Set(itemsOf(e).flatMap(i => i.stocks || []));

  const today = new Date();
  const latest = entries[0] ? parseDate(entries[0].date) : today;
  const state = {
    query: '',
    tag: null,
    stock: null,
    date: null,
    view: 'day',           // 'day' 日流水線 | 'week' 週流水線
    topicTab: 'tags',
    open: new Set(entries[0] ? [entries[0].date] : []),
    openWeeks: new Set(weeks[0] ? [weeks[0].start] : []),
    calY: latest.getFullYear(),
    calM: latest.getMonth()
  };

  const $ = sel => document.querySelector(sel);

  // ---------- helpers ----------
  function parseDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtDate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function addDays(s, n) {
    const d = parseDate(s);
    d.setDate(d.getDate() + n);
    return fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const md = s => `${Number(s.slice(5, 7))}/${Number(s.slice(8))}`;
  // ISO 週次（週一為一週開始）
  function isoWeek(s) {
    const d = parseDate(s);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function hl(text, q) {
    text = String(text ?? '');
    if (!q) return esc(text);
    const lower = text.toLowerCase(), ql = q.toLowerCase();
    let out = '', i = 0, j;
    while ((j = lower.indexOf(ql, i)) !== -1) {
      out += esc(text.slice(i, j)) + '<mark>' + esc(text.slice(j, j + q.length)) + '</mark>';
      i = j + q.length;
    }
    return out + esc(text.slice(i));
  }
  function tagClass(t) {
    const i = TAGS.indexOf(t);
    return i === -1 ? 'tag' : `tag tag-${i}`;
  }
  function storage(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (_) { return null; }
  }
  function clearHash() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  // ---------- header ----------
  function renderStats() {
    const count = k => entries.reduce((n, e) => n + (e[k] || []).length, 0);
    const parts = [`${entries.length} 天`, `${count('group')} 則教學`, `${count('live')} 場直播`];
    if (count('review')) parts.push(`${count('review')} 則複習`);
    if (weeks.length) parts.push(`${weeks.length} 週總結`);
    $('#stats').textContent = parts.join(' · ');
  }

  function renderTagBar() {
    $('#tag-bar').innerHTML =
      `<button class="chip ${!state.tag ? 'is-active' : ''}" data-tag="">全部</button>` +
      TAGS.map(t => `<button class="chip ${tagClass(t)} ${state.tag === t ? 'is-active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  }

  // ---------- calendar ----------
  function renderCalendar() {
    const { calY: y, calM: m } = state;
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());
    const monthCount = entries.filter(e => e.date.startsWith(calKey())).length;
    const weekCount = weeksInMonth().length;

    let cells = '';
    for (let row = 0; row * 7 - offset < days; row++) {
      // 每列最前面是週次欄
      const monday = new Date(y, m, row * 7 - offset + 1);
      const mondayStr = fmtDate(monday.getFullYear(), monday.getMonth(), monday.getDate());
      const w = byWeek.get(mondayStr);
      const wCls = ['cal-wk'];
      if (w) wCls.push('has');
      if (w && state.view === 'week' && state.openWeeks.has(mondayStr)) wCls.push('is-selected');
      if (hasWeeks) cells += `<button class="${wCls.join(' ')}" data-week="${mondayStr}" title="${w ? esc(w.title) : '第 ' + isoWeek(mondayStr) + ' 週（無週總結）'}">
        <span>${isoWeek(mondayStr)}</span>${w ? '<i class="cal-dot"></i>' : ''}</button>`;
      for (let c = 0; c < 7; c++) {
        const d = row * 7 - offset + c + 1;
        if (d < 1 || d > days) { cells += '<span class="cal-cell is-blank"></span>'; continue; }
        const ds = fmtDate(y, m, d);
        const e = byDate.get(ds);
        const hasLive = e && (e.live || []).length;
        const hasReview = e && (e.review || []).length;
        const cls = ['cal-cell'];
        if (e) cls.push('has');
        if (hasLive) cls.push('has-live');
        if (hasReview) cls.push('has-review');
        if (ds === state.date) cls.push('is-selected');
        if (ds === todayStr) cls.push('is-today');
        cells += `<button class="${cls.join(' ')}" data-date="${ds}" title="${e ? esc(e.title) : '無紀錄'}">
          <span>${d}</span>${e ? '<i class="cal-dot"></i>' : ''}${hasLive ? '<i class="cal-live">' + ICON_LIVE + '</i>' : ''}${hasReview ? '<i class="cal-review">' + ICON_BOOK + '</i>' : ''}
        </button>`;
      }
    }

    const sub = [monthCount ? monthCount + ' 天' : '', weekCount ? weekCount + ' 週總結' : ''].filter(Boolean).join(' · ');
    $('#calendar').innerHTML = `
      <div class="cal-head">
        <button class="icon-btn sm" data-cal="-1" aria-label="上個月">‹</button>
        <div class="cal-title">
          <strong>${y} 年 ${m + 1} 月</strong>
          <small>${sub || '本月無紀錄'}</small>
        </div>
        <button class="icon-btn sm" data-cal="1" aria-label="下個月">›</button>
      </div>
      <div class="cal-grid cal-week${hasWeeks ? '' : ' no-wk'}">${hasWeeks ? '<span>週</span>' : ''}${[...CAL_WEEK].map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid${hasWeeks ? '' : ' no-wk'}">${cells}</div>
      <div class="cal-foot">
        <span><i class="cal-dot"></i>教學</span>
        <span><i class="cal-live">${ICON_LIVE}</i>直播</span>
        <span><i class="cal-review">${ICON_BOOK}</i>複習</span>
        <button class="link-btn" data-cal="latest">回到最新</button>
      </div>`;
  }

  // ---------- topic index ----------
  function renderTopics() {
    const counts = new Map();
    const sources = state.view === 'week'
      ? weeks.map(w => state.topicTab === 'tags' ? new Set(w.tags || []) : new Set(w.stocks || []))
      : entries.map(e => state.topicTab === 'tags' ? tagsOf(e) : stocksOf(e));
    for (const set of sources) for (const k of set) counts.set(k, (counts.get(k) || 0) + 1);
    const list = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'));
    const active = state.topicTab === 'tags' ? state.tag : state.stock;
    $('#topic-list').innerHTML = list.length
      ? list.map(([k, n]) => `<li><button class="topic ${active === k ? 'is-active' : ''}" data-topic="${esc(k)}">
          <span class="${state.topicTab === 'tags' ? tagClass(k) + ' swatch' : 'swatch stock'}"></span>
          <span class="topic-name">${esc(k)}</span><span class="count">${n}</span></button></li>`).join('')
      : '<li class="muted">尚無資料</li>';
    document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('is-active', t.dataset.tab === state.topicTab));
  }

  // ---------- main ----------
  // 沒有主題/個股/日期篩選時，只顯示日曆所在月份；主題/個股篩選則跨月份列出
  const calKey = () => fmtDate(state.calY, state.calM, 1).slice(0, 7);
  const isMonthOnly = () => !state.tag && !state.stock && !state.date;
  // 週與月份有重疊就算該月（跨月週兩個月都顯示）
  const weekInMonth = (w, key) => w.start <= key + '-31' && w.end >= key + '-01';
  const weeksInMonth = () => weeks.filter(w => weekInMonth(w, calKey()));
  const monthKeys = [...new Set([
    ...entries.map(e => e.date.slice(0, 7)),
    ...weeks.flatMap(w => [w.start.slice(0, 7), w.end.slice(0, 7)])
  ])].sort().reverse();

  function filtered() {
    const monthOnly = isMonthOnly();
    return entries.filter(e =>
      (!state.tag || tagsOf(e).has(state.tag)) &&
      (!state.stock || stocksOf(e).has(state.stock)) &&
      (!state.date || e.date === state.date) &&
      (!monthOnly || e.date.startsWith(calKey())));
  }

  function filteredWeeks() {
    const monthOnly = isMonthOnly();
    return weeks.filter(w =>
      (!state.tag || (w.tags || []).includes(state.tag)) &&
      (!state.stock || (w.stocks || []).includes(state.stock)) &&
      (!monthOnly || weekInMonth(w, calKey())));
  }

  function renderMonthNav() {
    const key = calKey();
    const older = monthKeys.find(k => k < key);
    const newer = [...monthKeys].reverse().find(k => k > key);
    const label = k => `${k.slice(0, 4)} 年 ${Number(k.slice(5))} 月`;
    return `<nav class="month-nav">
      ${newer ? `<button class="chip" data-month="${newer}">‹ ${label(newer)}</button>` : '<span></span>'}
      ${older ? `<button class="chip" data-month="${older}">${label(older)} ›</button>` : '<span></span>'}
    </nav>`;
  }

  function renderViewToggle() {
    if (!hasWeeks) return '';
    return `<div class="view-toggle" role="tablist" aria-label="切換日/週流水線">
      <button class="tab ${state.view === 'day' ? 'is-active' : ''}" data-view="day">日</button>
      <button class="tab ${state.view === 'week' ? 'is-active' : ''}" data-view="week">週</button>
    </div>`;
  }

  function renderFilterBar() {
    const parts = [];
    if (state.date) parts.push(['date', `📅 ${state.date}`]);
    if (state.tag) parts.push(['tag', `# ${state.tag}`]);
    if (state.stock) parts.push(['stock', `📈 ${state.stock}`]);
    const bar = $('#filter-bar');
    bar.hidden = !parts.length || !!state.query;
    bar.innerHTML = '<span class="muted">篩選中：</span>' +
      parts.map(([k, label]) => `<button class="chip is-active" data-clear="${k}">${esc(label)} ✕</button>`).join('') +
      '<button class="link-btn" data-clear="all">回到月份檢視</button>';
  }

  function renderItem(item, q) {
    const tags = (item.tags || []).map(t => `<button class="chip sm ${tagClass(t)}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
    const stocks = (item.stocks || []).map(s => `<button class="chip sm stock" data-stock="${esc(s)}">📈 ${hl(s, q)}</button>`).join('');
    return `<article class="item">
      ${item.title ? `<h4>${hl(item.title, q)}</h4>` : ''}
      ${tags || stocks ? `<div class="chips">${tags}${stocks}</div>` : ''}
      ${item.summary ? `<p>${hl(item.summary, q)}</p>` : ''}
      ${(item.points || []).length ? `<ul>${item.points.map(p => `<li>${hl(p, q)}</li>`).join('')}</ul>` : ''}
      ${item.quote ? `<blockquote>「${hl(item.quote, q)}」</blockquote>` : ''}
    </article>`;
  }

  // 直播、複習共用的可展開區塊
  function renderFold(cls, icon, label, item, extra = '') {
    return `<details class="fold ${cls}">
      <summary>
        <span class="fold-icon">${icon}</span>
        <span class="fold-meta"><small>${label}</small><strong>${esc(item.title)}</strong></span>
        ${ICON_CHEVRON}
      </summary>
      <div class="fold-body">${extra}${renderItem({ ...item, title: '' })}</div>
    </details>`;
  }

  function renderEntry(e) {
    const d = parseDate(e.date);
    const open = state.open.has(e.date);
    const group = e.group || [];
    const live = e.live || [];
    const review = e.review || [];
    const headTags = [...tagsOf(e)].map(t => `<span class="chip sm ${tagClass(t)}">${esc(t)}</span>`).join('');
    const badge = (cls, icon, n, title) => n
      ? `<span class="badge ${cls}" title="${title}">${icon}<span>${n > 1 ? n : ''}</span></span>` : '';

    const body = `
      ${group.length ? `<section class="block">
        <h5 class="block-title">${ICON_CHAT}群組教學 <span class="muted">${group.length} 則</span></h5>
        ${group.map(i => renderItem(i)).join('')}
      </section>` : ''}
      ${live.map(l => renderFold('live', ICON_LIVE, '語音直播' + (l.time ? ' · ' + esc(l.time) : ''), l)).join('')}
      ${review.map(r => renderFold('review', ICON_BOOK, '週末複習', r,
        (r.refs || []).length ? `<div class="refs"><span class="muted">複習自</span>${r.refs.map(ds =>
          `<button class="chip sm" data-jump="${ds}">${md(ds)}${byDate.has(ds) ? ' ' + esc(byDate.get(ds).title) : ''}</button>`).join('')}</div>` : '')).join('')}`;

    return `<li class="node ${open ? 'is-open' : ''}" id="d-${e.date}">
      <span class="node-dot ${live.length ? 'has-live' : ''}"></span>
      <button class="node-head" data-toggle="${e.date}" aria-expanded="${open}">
        <time datetime="${e.date}"><b>${d.getDate()}</b><small>${d.getMonth() + 1}月 · 週${WEEK[d.getDay()]}</small></time>
        <span class="node-main">
          <span class="node-title">${esc(e.title)}</span>
          <span class="chips">${headTags}</span>
        </span>
        ${badge('live-badge', ICON_LIVE, live.length, '有語音直播')}
        ${badge('review-badge', ICON_BOOK, review.length, '有週末複習')}
        ${ICON_CHEVRON}
      </button>
      <div class="node-body">${open ? body : ''}</div>
    </li>`;
  }

  function renderWeek(w) {
    const open = state.openWeeks.has(w.start);
    const headTags = (w.tags || []).map(t => `<span class="chip sm ${tagClass(t)}">${esc(t)}</span>`).join('');
    const days = entries.filter(e => e.date >= w.start && e.date <= w.end).reverse();
    const stocks = (w.stocks || []).map(s => `<button class="chip sm stock" data-stock="${esc(s)}">📈 ${esc(s)}</button>`).join('');

    const body = `
      ${w.summary ? `<p class="week-summary">${esc(w.summary)}</p>` : ''}
      ${stocks ? `<div class="chips">${stocks}</div>` : ''}
      ${(w.sections || []).map(s => `<article class="item">
        <h4>${esc(s.heading)}</h4>
        ${(s.points || []).length ? `<ul>${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      </article>`).join('')}
      ${w.quote ? `<blockquote class="week-quote">「${esc(w.quote)}」</blockquote>` : ''}
      ${days.length ? `<div class="refs"><span class="muted">本週紀錄</span>${days.map(e =>
        `<button class="chip sm" data-jump="${e.date}">${md(e.date)} ${esc(e.title)}</button>`).join('')}</div>` : ''}`;

    return `<li class="node week ${open ? 'is-open' : ''}" id="w-${w.start}">
      <span class="node-dot"></span>
      <button class="node-head" data-toggle-week="${w.start}" aria-expanded="${open}">
        <time class="week-no" datetime="${w.start}"><b>W${isoWeek(w.start)}</b><small>${md(w.start)}–${md(w.end)}</small></time>
        <span class="node-main">
          <span class="node-title">${esc(w.title)}</span>
          <span class="chips">${headTags}</span>
        </span>
        ${ICON_CHEVRON}
      </button>
      <div class="node-body">${open ? body : ''}</div>
    </li>`;
  }

  // 依月份分組；週以開始日的月份分組（跨月篩選時）
  function groupByMonth(list, keyOf) {
    const months = new Map();
    for (const x of list) {
      const k = keyOf(x).slice(0, 7);
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(x);
    }
    return months;
  }

  function monthHead(title, count, toggle) {
    return `<h2 class="month-head"><span>${title}</span>${count ? `<small>${count}</small>` : ''}${toggle ? renderViewToggle() : ''}</h2>`;
  }

  function renderTimeline() {
    const isWeek = state.view === 'week' && !state.date;
    const list = isWeek ? filteredWeeks() : filtered();
    const unit = isWeek ? '週' : '天';
    const renderOne = isWeek ? renderWeek : renderEntry;
    const monthOnly = isMonthOnly();
    const toggle = !state.date;

    if (monthOnly) {
      const title = `${state.calY} 年 ${state.calM + 1} 月`;
      return `<section class="month">
        ${monthHead(title, list.length ? list.length + ' ' + unit : '', toggle)}
        ${list.length ? `<ol class="line">${list.map(renderOne).join('')}</ol>`
          : `<div class="empty"><p>${isWeek ? '這個月還沒有週總結' : '這個月沒有紀錄'}</p></div>`}
      </section>${renderMonthNav()}`;
    }
    if (!list.length) {
      const msg = state.date ? `${state.date} 沒有紀錄` : '沒有符合條件的紀錄';
      return (toggle ? `<div class="view-row">${renderViewToggle()}</div>` : '') +
        `<div class="empty"><p>${msg}</p><button class="link-btn" data-clear="all">回到月份檢視</button></div>`;
    }
    const months = groupByMonth(list, x => isWeek ? x.start : x.date);
    return [...months].map(([k, xs], i) => `<section class="month">
        ${monthHead(`${k.slice(0, 4)} 年 ${Number(k.slice(5))} 月`, xs.length + ' ' + unit, toggle && i === 0)}
        <ol class="line">${xs.map(renderOne).join('')}</ol>
      </section>`).join('');
  }

  function renderSearch() {
    const q = state.query.trim().toLowerCase();
    const results = [];
    const find = fields => fields.filter(Boolean).find(f => f.toLowerCase().includes(q));
    for (const e of entries) {
      for (const item of itemsOf(e)) {
        const hit = find([item.title, item.summary, ...(item.points || []), item.quote, ...(item.stocks || []), ...(item.tags || [])]);
        if (hit) results.push({ date: e.date, sort: e.date, kind: item.kind, title: item.title || e.title, hit, jump: e.date });
      }
      if (e.title.toLowerCase().includes(q) && !results.some(r => r.date === e.date)) {
        results.push({ date: e.date, sort: e.date, kind: 'day', title: e.title, hit: e.title, jump: e.date });
      }
    }
    for (const w of weeks) {
      const hit = find([w.title, w.summary, w.quote, ...(w.sections || []).flatMap(s => [s.heading, ...(s.points || [])]),
        ...(w.stocks || []), ...(w.tags || [])]);
      if (hit) results.push({ date: `W${isoWeek(w.start)} ${md(w.start)}–${md(w.end)}`, sort: w.end, kind: 'week', title: w.title, hit, jump: 'w' + w.start });
    }
    results.sort((a, b) => b.sort.localeCompare(a.sort));

    const raw = state.query.trim();
    const snippet = text => {
      const i = text.toLowerCase().indexOf(q);
      const start = Math.max(0, i - 30), end = Math.min(text.length, i + q.length + 40);
      return (start > 0 ? '…' : '') + hl(text.slice(start, end), raw) + (end < text.length ? '…' : '');
    };
    const kindTag = {
      live: `<span class="kind-tag live">${ICON_LIVE}直播</span>`,
      review: `<span class="kind-tag review">${ICON_BOOK}複習</span>`,
      week: `<span class="kind-tag week">${ICON_WEEK}週總結</span>`
    };
    return `<div class="search-head"><strong>「${esc(raw)}」</strong> 共 ${results.length} 筆結果</div>` +
      (results.length ? `<ul class="results">${results.map(r => `
        <li><button class="result" data-jump="${r.jump}">
          <span class="result-date">${esc(r.date)} ${kindTag[r.kind] || ''}</span>
          <span class="result-title">${hl(r.title, raw)}</span>
          <span class="result-snippet">${snippet(r.hit)}</span>
        </button></li>`).join('')}</ul>`
        : '<div class="empty"><p>找不到相關內容</p></div>');
  }

  function renderMain() {
    renderFilterBar();
    $('#content').innerHTML = state.query.trim() ? renderSearch() : renderTimeline();
  }

  function renderAll() {
    renderTagBar();
    renderCalendar();
    renderTopics();
    renderMain();
  }

  // ---------- actions ----------
  function resetSearch() {
    state.query = '';
    $('#search').value = '';
  }

  function scrollToEl(id) {
    const el = document.getElementById(id);
    (el || $('#main')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goDate(ds, { scroll = true } = {}) {
    resetSearch();
    state.view = 'day';
    state.date = ds;
    state.tag = null;
    state.stock = null;
    if (ds) {
      state.open.add(ds);
      const d = parseDate(ds);
      state.calY = d.getFullYear();
      state.calM = d.getMonth();
    }
    renderAll();
    if (ds && scroll) scrollToEl('d-' + ds);
  }

  function goWeek(start) {
    if (!hasWeeks) return;
    const w = byWeek.get(start);
    resetSearch();
    state.view = 'week';
    state.date = null;
    state.tag = null;
    state.stock = null;
    if (w) {
      state.openWeeks.add(start);
      // 已在顯示中的月份就不切換（跨月週）
      if (!weekInMonth(w, calKey())) {
        const d = parseDate(w.start);
        state.calY = d.getFullYear();
        state.calM = d.getMonth();
      }
    }
    renderAll();
    scrollToEl('w-' + start);
  }

  function setHash(h) {
    if (location.hash.slice(1) === h) onHash();
    else location.hash = h;
  }

  function onHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (/^\d{4}-\d{2}-\d{2}$/.test(h)) goDate(h);
    else if (/^w\d{4}-\d{2}-\d{2}$/.test(h)) goWeek(h.slice(1));
    else if (!h) goDate(null, { scroll: false });
  }

  // 切換月份：清掉所有篩選與搜尋，顯示該月流水線（維持日/週模式）
  function showMonth(y, m) {
    const d = new Date(y, m, 1);
    state.calY = d.getFullYear();
    state.calM = d.getMonth();
    resetSearch();
    clearFilters('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearFilters(which) {
    if (which === 'date' || which === 'all') {
      state.date = null;
      clearHash();
    }
    if (which === 'tag' || which === 'all') state.tag = null;
    if (which === 'stock' || which === 'all') state.stock = null;
    renderAll();
  }

  function setFilter(key, value) {
    resetSearch();
    state[key] = state[key] === value || !value ? null : value;
    state.date = null;
    clearHash();
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('button, a');
    if (!t) return;
    const ds = t.dataset;

    if (ds.toggle) {
      if (state.open.has(ds.toggle)) state.open.delete(ds.toggle);
      else state.open.add(ds.toggle);
      t.closest('.node').outerHTML = renderEntry(byDate.get(ds.toggle));
    } else if (ds.toggleWeek) {
      const k = ds.toggleWeek;
      if (state.openWeeks.has(k)) state.openWeeks.delete(k);
      else state.openWeeks.add(k);
      t.closest('.node').outerHTML = renderWeek(byWeek.get(k));
      renderCalendar();
    } else if (ds.date !== undefined && t.classList.contains('cal-cell')) {
      setHash(ds.date);
    } else if (ds.week) {
      if (byWeek.has(ds.week)) setHash('w' + ds.week);
    } else if (ds.view) {
      state.view = ds.view;
      state.date = null;
      clearHash();
      renderAll();
    } else if (ds.cal) {
      if (ds.cal === 'latest') showMonth(latest.getFullYear(), latest.getMonth());
      else showMonth(state.calY, state.calM + Number(ds.cal));
    } else if (ds.month) {
      const [y, m] = ds.month.split('-').map(Number);
      showMonth(y, m - 1);
    } else if (ds.tag !== undefined) {
      setFilter('tag', ds.tag);
    } else if (ds.stock !== undefined) {
      setFilter('stock', ds.stock);
    } else if (ds.topic !== undefined) {
      setFilter(state.topicTab === 'tags' ? 'tag' : 'stock', ds.topic);
    } else if (ds.tab) {
      state.topicTab = ds.tab;
      renderTopics();
    } else if (ds.clear) {
      clearFilters(ds.clear);
    } else if (ds.jump) {
      setHash(ds.jump);
    } else if (t.id === 'brand') {
      ev.preventDefault();
      showMonth(latest.getFullYear(), latest.getMonth());
    } else if (t.id === 'theme') {
      const root = document.documentElement;
      const dark = root.dataset.theme
        ? root.dataset.theme === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      storage('mbd-theme', root.dataset.theme);
    }
  });

  $('#search').addEventListener('input', ev => {
    state.query = ev.target.value;
    renderMain();
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === '/' && document.activeElement !== $('#search') && !(ev.target instanceof HTMLInputElement)) {
      ev.preventDefault();
      $('#search').focus();
    } else if (ev.key === 'Escape' && document.activeElement === $('#search')) {
      resetSearch();
      renderMain();
    }
  });

  window.addEventListener('hashchange', onHash);

  // ---------- lock ----------
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function initLock(done) {
    if (!CONFIG.lockEnabled || storage('mbd-auth') === CONFIG.passwordHash) return done();
    const lock = $('#lock');
    lock.hidden = false;
    $('#lock-input').focus();
    $('#lock-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const h = await sha256($('#lock-input').value);
      if (h === CONFIG.passwordHash) {
        storage('mbd-auth', h);
        lock.hidden = true;
        done();
      } else {
        $('#lock-error').hidden = false;
      }
    });
  }

  // ---------- init ----------
  const savedTheme = storage('mbd-theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  initLock(() => {
    renderStats();
    if (location.hash) onHash();
    else renderAll();
  });
})();
