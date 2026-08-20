'use strict';

const DATA_URL = 'data/reports.json';
const DATA_DIR = 'data/';   // 画像パス（images/...）はここ基準で解決する

const el = {
  reports: document.getElementById('reports'),
  search: document.getElementById('search'),
  count: document.getElementById('count'),
  empty: document.getElementById('empty'),
  error: document.getElementById('error'),
  lightbox: document.getElementById('lightbox'),
  tabList: document.getElementById('tab-list'),
  tabCalendar: document.getElementById('tab-calendar'),
  viewList: document.getElementById('view-list'),
  viewCalendar: document.getElementById('view-calendar'),
  calPrev: document.getElementById('cal-prev'),
  calNext: document.getElementById('cal-next'),
  calTitle: document.getElementById('cal-title'),
  calGrid: document.getElementById('cal-grid'),
  calDayDetail: document.getElementById('cal-day-detail'),
};

let allReports = [];

init();

async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`データ取得に失敗しました (HTTP ${res.status})`);
    const data = await res.json();
    // 新しい順（date + time 降順）
    allReports = (Array.isArray(data) ? data : []).sort(
      (a, b) => key(b).localeCompare(key(a))
    );
    render(allReports);
    setupCalendar();
  } catch (err) {
    el.error.textContent = err.message;
    el.error.hidden = false;
  }

  el.search.addEventListener('input', () => {
    const q = el.search.value.trim().toLowerCase();
    render(q ? allReports.filter((r) => matches(r, q)) : allReports);
  });

  setupLightbox();
  setupTabs();
}

// ===== 一覧⇔カレンダーのタブ切り替え =====
function setupTabs() {
  el.tabList.addEventListener('click', () => showView('list'));
  el.tabCalendar.addEventListener('click', () => showView('calendar'));
}

function showView(view) {
  const isList = view === 'list';
  el.viewList.hidden = !isList;
  el.viewCalendar.hidden = isList;
  el.tabList.classList.toggle('is-active', isList);
  el.tabList.setAttribute('aria-selected', String(isList));
  el.tabCalendar.classList.toggle('is-active', !isList);
  el.tabCalendar.setAttribute('aria-selected', String(!isList));
}

// ===== カレンダー =====
// 記録1件から「農薬」「肥料」「収穫」「作業」の区分（複数可）を判定する。
// record_type列に頼らず、harvest/pesticide/fertilizer配列の有無から判定するので
// convert.py・reports.jsonの形式は変更不要。
function categoriesFor(r) {
  const cats = [];
  if ((r.harvest || []).length) cats.push('収穫');
  if ((r.pesticide || []).length) cats.push('農薬');
  if ((r.fertilizer || []).length) cats.push('肥料');
  if (!cats.length) cats.push('作業');
  return cats;
}

let calMonth = new Date();
let calSelectedDate = null;

function setupCalendar() {
  el.calPrev.addEventListener('click', () => changeMonth(-1));
  el.calNext.addEventListener('click', () => changeMonth(1));
  // 最新の記録がある月を初期表示にする（記録が無ければ今月）
  if (allReports.length) {
    const latest = allReports.reduce((a, b) => (key(a) > key(b) ? a : b));
    const [y, m] = latest.date.split('-').map(Number);
    calMonth = new Date(y, m - 1, 1);
  }
  renderCalendar();
}

function changeMonth(delta) {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + delta, 1);
  calSelectedDate = null;
  renderCalendar();
}

function groupByDate(list) {
  const map = new Map();
  for (const r of list) {
    if (!r.date) continue;
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date).push(r);
  }
  return map;
}

function renderCalendar() {
  const byDate = groupByDate(allReports);
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth(); // 0始まり
  el.calTitle.textContent = `${year}年${month + 1}月`;

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay(); // 0=日曜
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = dateStr(new Date());

  el.calGrid.innerHTML = '';
  for (const w of ['日', '月', '火', '水', '木', '金', '土']) {
    const cell = document.createElement('div');
    cell.className = 'cal-weekday';
    cell.textContent = w;
    el.calGrid.appendChild(cell);
  }
  for (let i = 0; i < firstWeekday; i++) {
    el.calGrid.appendChild(Object.assign(document.createElement('div'), { className: 'cal-cell is-blank' }));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(new Date(year, month, d));
    const records = byDate.get(ds) || [];
    el.calGrid.appendChild(dayCell(d, ds, records, ds === todayStr));
  }

  renderDayDetail();
}

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayCell(dayNum, ds, records, isToday) {
  const cell = document.createElement('div');
  cell.className = 'cal-cell';
  if (isToday) cell.classList.add('is-today');
  if (ds === calSelectedDate) cell.classList.add('is-selected');
  if (!records.length) cell.classList.add('is-empty');

  const num = document.createElement('div');
  num.className = 'cal-daynum';
  num.textContent = String(dayNum);
  cell.appendChild(num);

  if (records.length) {
    // その日の全記録から区分ごとの件数を数える（同日複数記録も反映）
    const counts = new Map();
    for (const r of records) {
      for (const c of categoriesFor(r)) counts.set(c, (counts.get(c) || 0) + 1);
    }
    const badges = document.createElement('div');
    badges.className = 'cal-badges';
    for (const [label, count] of counts) {
      const b = document.createElement('span');
      b.className = `cal-badge cal-badge--${badgeKind(label)}`;
      b.textContent = count > 1 ? `${label}×${count}` : label;
      badges.appendChild(b);
    }
    cell.appendChild(badges);
  }

  cell.addEventListener('click', () => {
    calSelectedDate = ds;
    renderCalendar();
  });
  return cell;
}

function badgeKind(label) {
  switch (label) {
    case '農薬': return 'pesticide';
    case '肥料': return 'fertilizer';
    case '収穫': return 'harvest';
    default: return 'work';
  }
}

function renderDayDetail() {
  el.calDayDetail.innerHTML = '';
  if (!calSelectedDate) {
    el.calDayDetail.appendChild(Object.assign(document.createElement('p'), {
      className: 'empty', textContent: '日にちを選んでください。',
    }));
    return;
  }
  const records = (groupByDate(allReports).get(calSelectedDate) || [])
    .sort((a, b) => key(b).localeCompare(key(a)));
  const title = document.createElement('h2');
  title.className = 'cal-day-title';
  title.textContent = `${calSelectedDate}（${records.length}件）`;
  el.calDayDetail.appendChild(title);

  if (!records.length) {
    el.calDayDetail.appendChild(Object.assign(document.createElement('p'), {
      className: 'empty', textContent: 'この日の記録はありません。',
    }));
    return;
  }
  for (const r of records) el.calDayDetail.appendChild(card(r));
}

function key(r) {
  return `${r.date || ''} ${r.time || ''}`;
}

function matches(r, q) {
  const hay = [
    r.work, r.field, r.weather, r.note,
    ...(r.harvest || []).map((h) => h.item),
    ...(r.pesticide || []).map((p) => `${p.name} ${p.target}`),
    ...(r.fertilizer || []).map((f) => `${f.name} ${f.purpose} ${f.crops}`),
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function render(list) {
  el.reports.innerHTML = '';
  el.count.textContent = `${list.length} 件`;
  el.empty.hidden = list.length !== 0;
  for (const r of list) el.reports.appendChild(card(r));
}

function card(r) {
  const wrap = document.createElement('article');
  wrap.className = 'report';

  wrap.appendChild(head(r));

  const body = document.createElement('div');
  body.className = 'report-body';
  body.appendChild(factsTable(r));

  if (r.note) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = r.note;
    body.appendChild(note);
  }

  // メイン画像（1枚もしくはなし）
  for (const img of (r.images || [])) body.appendChild(figure(img));

  // 追加画像フォルダ
  const extras = r.extra_images || [];
  if (extras.length) {
    const title = document.createElement('div');
    title.className = 'extra-title';
    title.textContent = `追加の画像（${extras.length}枚）`;
    body.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'extra-grid';
    for (const img of extras) grid.appendChild(figure(img));
    body.appendChild(grid);
  }

  wrap.appendChild(body);
  return wrap;
}

function head(r) {
  const h = document.createElement('div');
  h.className = 'report-head';
  h.innerHTML = `
    <span class="report-date">${esc(r.date || '')}</span>
    <span class="report-time">${esc(r.time || '')}</span>
    ${r.weather ? `<span class="report-weather">${esc(r.weather)}</span>` : ''}
    ${r.field ? `<span class="report-field">${esc(r.field)}</span>` : ''}
  `;
  return h;
}

function factsTable(r) {
  const rows = [];
  rows.push(row('作業内容', esc(r.work || '—')));
  rows.push(row('作業時間', esc(formatDuration(r.duration_min))));
  rows.push(row('収穫', harvestCell(r.harvest)));
  rows.push(row('農薬散布', pesticideCell(r.pesticide)));
  rows.push(row('肥料', fertilizerCell(r.fertilizer)));

  const table = document.createElement('table');
  table.className = 'facts';
  table.innerHTML = `<tbody>${rows.join('')}</tbody>`;
  return table;
}

function row(label, valueHtml) {
  return `<tr><th>${label}</th><td>${valueHtml}</td></tr>`;
}

function formatDuration(min) {
  if (min == null || min === '') return '—';
  const n = Number(min);
  if (Number.isNaN(n)) return String(min);
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h}時間${m}分`;
  if (h) return `${h}時間`;
  return `${m}分`;
}

function harvestCell(harvest) {
  if (!harvest || !harvest.length) return '<span class="tag-none">なし</span>';
  const items = harvest.map(
    (h) => `<li>${esc(h.item)}：${esc(String(h.qty))}${esc(h.unit || '')}</li>`
  );
  return `<ul class="sub-list">${items.join('')}</ul>`;
}

function pesticideCell(pest) {
  if (!pest || !pest.length) return '<span class="tag-none">なし</span>';
  const items = pest.map((p) => {
    const meta = [p.dilution, p.amount].filter(Boolean).join(' / ');
    return `<li class="pest">${esc(p.name || '')}
      ${p.target ? `<small>（${esc(p.target)}）</small>` : ''}
      ${meta ? `<small> — ${esc(meta)}</small>` : ''}</li>`;
  });
  return `<ul class="sub-list">${items.join('')}</ul>`;
}

function resolveSrc(file) {
  const f = String(file || '');
  return /^https?:\/\//.test(f) ? f : DATA_DIR + f;
}

function fertilizerCell(fert) {
  if (!fert || !fert.length) return '<span class="tag-none">なし</span>';
  const items = fert.map((f) => {
    const meta = [f.dilution, f.amount].filter(Boolean).join(' / ');
    const sub = [f.purpose, f.crops].filter(Boolean).join('・');
    return `<li class="pest">${esc(f.name || '')}
      ${meta ? `<small> — ${esc(meta)}</small>` : ''}
      ${sub ? `<small>（${esc(sub)}）</small>` : ''}</li>`;
  });
  return `<ul class="sub-list">${items.join('')}</ul>`;
}

function figure(img) {
  const fig = document.createElement('figure');
  const image = document.createElement('img');
  image.src = resolveSrc(img.file);
  image.referrerPolicy = 'no-referrer';
  image.alt = img.caption || '';
  image.loading = 'lazy';
  image.addEventListener('click', () => openLightbox(img));
  image.addEventListener('error', () => {
    fig.classList.add('img-error');
    image.replaceWith(Object.assign(document.createElement('div'), {
      className: 'img-fallback',
      textContent: '画像を表示できません（Driveの共有設定を確認）',
    }));
  });
  fig.appendChild(image);
  if (img.caption) {
    const cap = document.createElement('figcaption');
    cap.textContent = img.caption;
    fig.appendChild(cap);
  }
  return fig;
}

function setupLightbox() {
  const closeBtn = el.lightbox.querySelector('.lightbox-close');
  const close = () => { el.lightbox.hidden = true; };
  closeBtn.addEventListener('click', close);
  el.lightbox.addEventListener('click', (e) => {
    if (e.target === el.lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function openLightbox(img) {
  el.lightbox.querySelector('img').src = resolveSrc(img.file);
  el.lightbox.querySelector('.lightbox-caption').textContent = img.caption || '';
  el.lightbox.hidden = false;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
