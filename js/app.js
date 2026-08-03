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
  } catch (err) {
    el.error.textContent = err.message;
    el.error.hidden = false;
  }

  el.search.addEventListener('input', () => {
    const q = el.search.value.trim().toLowerCase();
    render(q ? allReports.filter((r) => matches(r, q)) : allReports);
  });

  setupLightbox();
}

function key(r) {
  return `${r.date || ''} ${r.time || ''}`;
}

function matches(r, q) {
  const hay = [
    r.work, r.field, r.weather, r.note,
    ...(r.harvest || []).map((h) => h.item),
    ...(r.pesticide || []).map((p) => `${p.name} ${p.target}`),
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

function figure(img) {
  const fig = document.createElement('figure');
  const image = document.createElement('img');
  image.src = DATA_DIR + img.file;
  image.alt = img.caption || '';
  image.loading = 'lazy';
  image.addEventListener('click', () => openLightbox(img));
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
  el.lightbox.querySelector('img').src = DATA_DIR + img.file;
  el.lightbox.querySelector('.lightbox-caption').textContent = img.caption || '';
  el.lightbox.hidden = false;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
