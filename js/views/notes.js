// یادداشت‌ها: فهرست، ویرایشگر صفحه‌ی بی‌نهایت با متن، جدول و نمودار
import { h, ICON, uid, fa, norm, debounce, confirmDialog, parseNum, prompt } from '../util.js';
import { data, save, remove, on, settings } from '../db.js';
import { InkSurface, strokesSVG } from '../ink.js';
import { relLabel, keyOf } from '../jalali.js';

let folderFilter = '';

export function renderNotes(main, [id]) {
  if (id) return noteEditor(main, data.notes.get(id));
  const q = h('input', { class: 'field', type: 'search', placeholder: 'جستجو در یادداشت‌ها…' });
  const folders = h('div', { class: 'chips' });
  const grid = h('div', { class: 'note-grid scroll-y' });
  const create = () => {
    const n = save('notes', { id: uid(), title: '', folder: folderFilter || '', tags: [], bg: settings.noteBg || 'lines', doc: { strokes: [], objects: [] } });
    location.hash = '#/notes/' + n.id;
  };
  const render = () => {
    const all = [...data.notes.values()];
    const fs = [...new Set(all.map((n) => n.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fa'));
    folders.innerHTML = '';
    folders.append(h('button', { class: 'chip-btn' + (!folderFilter ? ' on' : ''), onclick: () => { folderFilter = ''; render(); } }, 'همه', h('span', { class: 'count' }, fa(all.length))));
    for (const f of fs) folders.append(h('button', { class: 'chip-btn' + (folderFilter === f ? ' on' : ''), onclick: () => { folderFilter = f; render(); } }, h('span', { html: ICON.folder, class: 'ico-inline' }), f));
    const query = norm(q.value);
    const items = all.filter((n) => !folderFilter || n.folder === folderFilter)
      .filter((n) => !query || norm(noteText(n)).includes(query))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    grid.innerHTML = '';
    grid.append(h('button', { class: 'note-card new', onclick: create }, h('span', { html: ICON.plus }), 'یادداشت جدید'));
    for (const n of items) {
      const prev = h('div', { class: 'nc-prev bg-' + (n.bg || 'lines') });
      const top = (n.doc?.strokes || []).filter((s) => s.p[1] < 900);
      if (top.length) prev.append(strokesSVG(top, { height: 110, maxWidth: 260 }));
      const txt = (n.doc?.objects || []).filter((o) => o.type === 'text').map((o) => stripHtml(o.html)).join(' ').slice(0, 120);
      if (txt && !top.length) prev.append(h('p', null, txt));
      const tbl = (n.doc?.objects || []).find((o) => o.type === 'table');
      if (!top.length && !txt && tbl) prev.append(h('table', { class: 'nc-table' }, tbl.rows.slice(0, 5).map((r) => h('tr', null, r.slice(0, 4).map((c) => h('td', null, c))))));
      const objs = (n.doc?.objects || []);
      grid.append(h('a', { class: 'note-card', href: '#/notes/' + n.id }, prev,
        h('div', { class: 'nc-info' },
          h('strong', null, n.title || 'بدون عنوان'),
          h('small', { class: 'muted' }, [relLabel(keyOf(new Date(n.updatedAt))), n.folder,
            objs.some((o) => o.type === 'table') ? 'جدول' : '', objs.some((o) => o.type === 'chart') ? 'نمودار' : ''].filter(Boolean).join(' · ')))));
    }
  };
  q.addEventListener('input', render);
  render();
  const off = on('notes', render);
  main.append(h('div', { class: 'view notes-view' },
    h('div', { class: 'view-head' }, h('h2', null, 'یادداشت‌ها'), q, h('button', { class: 'btn primary small', onclick: create }, h('span', { html: ICON.plus }), 'یادداشت جدید')),
    folders, grid));
  return off;
}

const stripHtml = (s) => { const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent || ''; };
export function noteText(n) {
  const parts = [n.title, n.folder, ...(n.tags || [])];
  for (const o of n.doc?.objects || []) {
    if (o.type === 'text') parts.push(stripHtml(o.html));
    if (o.type === 'table') parts.push(o.rows.flat().join(' '));
  }
  return parts.join(' ');
}

function noteEditor(main, n) {
  if (!n) { main.append(h('div', { class: 'empty big' }, 'یادداشت پیدا نشد')); return () => {}; }
  n.doc ||= { strokes: [], objects: [] };
  const persist = debounce(() => save('notes', n, { silent: true }), 500);
  const title = h('input', { class: 'field title-input', value: n.title || '', placeholder: 'عنوان یادداشت', oninput: (e) => { n.title = e.target.value; persist(); } });
  const folderList = h('datalist', { id: 'folders-dl' }, [...new Set([...data.notes.values()].map((x) => x.folder).filter(Boolean))].map((f) => h('option', { value: f })));
  const folder = h('input', { class: 'field folder-input', list: 'folders-dl', value: n.folder || '', placeholder: 'پوشه', oninput: (e) => { n.folder = e.target.value.trim(); persist(); } });
  const bg = h('select', { class: 'field small-sel', title: 'نوع کاغذ', onchange: (e) => { n.bg = e.target.value; surf.content.className = 'ink-content bg-' + n.bg; persist(); } },
    [['lines', 'خط‌دار'], ['grid', 'شطرنجی'], ['dots', 'نقطه‌ای'], ['blank', 'سفید']].map(([v, l]) => h('option', { value: v, selected: (n.bg || 'lines') === v }, l)));
  const host = h('div', { class: 'ink-host' });
  const head = h('div', { class: 'note-head' },
    h('button', { class: 'icon-btn', title: 'بازگشت', html: ICON.back, onclick: () => { location.hash = '#/notes'; } }),
    title, h('span', { html: ICON.folder, class: 'ico-inline muted' }), folder, folderList, bg,
    h('button', { class: 'icon-btn danger', title: 'حذف یادداشت', html: ICON.trash, onclick: async () => {
      if (await confirmDialog('این یادداشت حذف شود؟', 'حذف', true)) { persist.flush(); remove('notes', n.id); location.hash = '#/notes'; }
    } }));
  main.append(h('div', { class: 'view note-editor' }, head, h('div', { class: 'paper note-paper' }, host)));
  const surf = new InkSurface(host, {
    doc: n.doc, logicalWidth: 1000, lineGap: 36, bg: n.bg || 'lines', objects: true,
    renderObject: (o, s) => renderObj(o, s),
    onChange: () => persist(),
  });
  if (!n.title) setTimeout(() => title.focus(), 100);
  return () => { persist.flush(); surf.destroy(); data.notes.has(n.id) && save('notes', n, { silent: false }); };
}

// ---------- اشیاء صفحه ----------
export function insertText(surf) { surf.addObject({ type: 'text', w: 440, html: '' }); setTimeout(() => focusObj(surf), 50); }
export async function insertTable(surf) {
  const v = await prompt('اندازه‌ی جدول (ستون × سطر)', '۳×۴', 'مثلاً ۳×۴');
  if (v == null) return;
  const m = (v.match(/[\d۰-۹]+/g) || []).map((x) => parseNum(x));
  const cols = Math.min(10, Math.max(1, m[0] || 3)), rows = Math.min(40, Math.max(1, m[1] || 4));
  surf.addObject({ type: 'table', w: Math.min(960, cols * 150), rows: Array.from({ length: rows }, () => Array(cols).fill('')) });
  setTimeout(() => focusObj(surf), 50);
}
function focusObj(surf) {
  const el = surf.objLayer.querySelector(`[data-id="${surf.activeObj}"] [contenteditable]`);
  if (el) { el.focus(); setTimeout(() => surf.reveal(el), 350); }
}

function chrome(o, surf, extra = []) {
  return h('div', { class: 'obj-chrome' },
    h('span', { class: 'obj-handle', title: 'جابه‌جایی', html: ICON.move }),
    ...extra,
    h('button', { class: 'danger', title: 'حذف', html: ICON.trash, onclick: () => {
      surf.removeObject(o.id);
      for (const c of surf.doc.objects.filter((x) => x.src === o.id)) surf.removeObject(c.id);
    } }));
}
const cb = (label, fn, title) => h('button', { onclick: fn, title: title || label }, label);

function renderObj(o, surf) {
  if (o.type === 'text') {
    const ed = h('div', { class: 'obj-text-body', contenteditable: 'true', 'data-ph': 'متن را تایپ کنید…', html: o.html || '' });
    ed.addEventListener('input', () => { o.html = ed.innerHTML; surf.changed(); });
    return h('div', { class: 'obj obj-text' }, chrome(o, surf, [
      cb('باریک', () => { o.w = 320; surf.refreshObj(o.id); surf.changed(); }),
      cb('پهن', () => { o.w = 760; surf.refreshObj(o.id); surf.changed(); }),
    ]), ed);
  }
  if (o.type === 'table') {
    const table = h('table', { class: 'obj-table-el' });
    o.rows.forEach((row, r) => {
      const tr = h('tr');
      row.forEach((val, c) => {
        const td = h(r === 0 ? 'th' : 'td', { contenteditable: 'true' });
        td.textContent = val;
        td.addEventListener('input', () => { o.rows[r][c] = td.innerText.trim(); surf.changed(); refreshCharts(o, surf); });
        td.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (r === o.rows.length - 1) { o.rows.push(Array(o.rows[0].length).fill('')); surf.refreshObj(o.id); surf.changed(); }
            const next = surf.objLayer.querySelector(`[data-id="${o.id}"] tr:nth-child(${r + 2}) > :nth-child(${c + 1})`);
            next?.focus();
            if (next) surf.reveal(next);
          }
        });
        tr.append(td);
      });
      table.append(tr);
    });
    const mut = (fn) => () => { surf.snapshot(); fn(); surf.refreshObj(o.id); surf.changed(); refreshCharts(o, surf); };
    return h('div', { class: 'obj obj-table' }, chrome(o, surf, [
      cb('+ سطر', mut(() => o.rows.push(Array(o.rows[0].length).fill('')))),
      cb('− سطر', mut(() => { if (o.rows.length > 1) o.rows.pop(); })),
      cb('+ ستون', mut(() => { o.rows.forEach((r) => r.push('')); o.w = Math.min(980, (o.w || 450) + 120); })),
      cb('− ستون', mut(() => { if (o.rows[0].length > 1) { o.rows.forEach((r) => r.pop()); o.w = Math.max(200, (o.w || 450) - 120); } })),
      h('button', { title: 'ساخت نمودار از این جدول', onclick: () => {
        const el = surf.objLayer.querySelector(`[data-id="${o.id}"]`);
        surf.addObject({ type: 'chart', src: o.id, kind: 'bar', w: 560, x: o.x, y: o.y + (el?.offsetHeight || 200) + 24 });
      } }, h('span', { html: ICON.chart }), 'نمودار'),
    ]), table, h('div', { class: 'obj-hint' }, 'سطر اول = عنوان ستون‌ها · ستون اول = برچسب‌ها · ستون‌های بعدی = اعداد (برای نمودار)'));
  }
  if (o.type === 'chart') {
    const src = surf.doc.objects.find((x) => x.id === o.src);
    const kinds = [['bar', 'میله‌ای'], ['line', 'خطی'], ['pie', 'دایره‌ای']];
    const body = h('div', { class: 'chart-body' });
    body.append(src ? chartSVG(src.rows, o.kind) : h('p', { class: 'muted' }, 'جدول منبع حذف شده است'));
    const tip = h('div', { class: 'chart-tip', hidden: true });
    const wrap = h('div', { class: 'obj obj-chart' }, chrome(o, surf, kinds.map(([k, l]) =>
      h('button', { class: o.kind === k ? 'on' : '', onclick: () => { o.kind = k; surf.refreshObj(o.id); surf.changed(); } }, l))), body, tip);
    const showTip = (target, x, y) => {
      const t = target?.closest?.('[data-tip]');
      if (!t) { tip.hidden = true; return; }
      tip.textContent = t.dataset.tip; tip.hidden = false;
      const r = wrap.getBoundingClientRect(), k = r.width / wrap.offsetWidth;
      tip.style.left = (x - r.left) / k + 'px'; tip.style.top = (y - r.top) / k - 34 + 'px';
    };
    wrap.addEventListener('inktap', (e) => showTip(e.target, e.detail.x, e.detail.y));
    wrap.addEventListener('pointermove', (e) => showTip(e.target, e.clientX, e.clientY));
    wrap.addEventListener('pointerleave', () => (tip.hidden = true));
    return wrap;
  }
  return h('div', null, '?');
}
function refreshCharts(table, surf) {
  for (const c of surf.doc.objects.filter((x) => x.type === 'chart' && x.src === table.id)) surf.refreshObj(c.id);
}

// ---------- رسم نمودار ----------
const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];
function parseTable(rows) {
  const head = rows[0] || [];
  const body = rows.slice(1).filter((r) => r.some((v) => v !== ''));
  const labels = body.map((r, i) => r[0] || fa(i + 1));
  const series = [];
  for (let c = 1; c < head.length; c++) {
    const vals = body.map((r) => parseNum(r[c]));
    if (vals.some((v) => v != null)) series.push({ name: head[c] || `ستون ${fa(c)}`, vals });
  }
  return { labels, series };
}
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
const fmtN = (v) => fa(Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : +v.toFixed(2)).replace(/,/g, '٬');

function chartSVG(rows, kind) {
  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); kids.forEach((c) => c && e.append(c)); return e; };
  const { labels, series } = parseTable(rows);
  const W = 560, H = 300;
  const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart-svg' });
  if (!series.length || !labels.length) {
    svg.append(S('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'c-muted' }, document.createTextNode('برای نمودار، عدد در ستون‌های دوم به بعد وارد کنید')));
    return svg;
  }
  const legendItems = kind === 'pie' ? labels.slice(0, 8) : series.length > 1 ? series.slice(0, 8).map((s) => s.name) : [];
  const legH = legendItems.length ? 26 : 0;
  if (kind === 'pie') {
    const s = series[0];
    let vals = s.vals.map((v) => Math.max(0, v || 0)), labs = labels.slice();
    if (vals.length > 8) { const rest = vals.slice(7).reduce((a, b) => a + b, 0); vals = vals.slice(0, 7).concat(rest); labs = labs.slice(0, 7).concat('سایر'); }
    const tot = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = (H - legH) / 2 + 4, R = Math.min(W, H - legH) / 2 - 16, r0 = R * 0.55;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / tot) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (r, a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
      const d = v >= tot ? `M${p(R, 0)}A${R} ${R} 0 1 1 ${p(R, Math.PI)}A${R} ${R} 0 1 1 ${p(R, 0)}M${p(r0, 0)}A${r0} ${r0} 0 1 0 ${p(r0, Math.PI)}A${r0} ${r0} 0 1 0 ${p(r0, 0)}`
        : `M${p(R, a0)}A${R} ${R} 0 ${large} 1 ${p(R, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
      svg.append(S('path', { d, fill: SERIES[i % 8], class: 'c-mark', 'data-tip': `${labs[i]}: ${fmtN(v)} (${fa(Math.round((v / tot) * 100))}٪)` }));
      a0 = a1;
    });
    svg.append(S('text', { x: cx, y: cy + 6, 'text-anchor': 'middle', class: 'c-total' }, document.createTextNode(fmtN(tot))));
    legend(S, svg, labs, W, H);
    return svg;
  }
  // محورها (راست‌به‌چپ: اولین دسته سمت راست)
  const all = series.flatMap((s) => s.vals.filter((v) => v != null));
  const mn = Math.min(0, ...all), mx = niceMax(Math.max(...all, 0));
  const padR = 52, padL = 14, padT = 14, padB = 34 + legH;
  const pw = W - padR - padL, ph = H - padT - padB;
  const y = (v) => padT + ph - ((v - mn) / (mx - mn || 1)) * ph;
  for (let i = 0; i <= 4; i++) {
    const v = mn + ((mx - mn) * i) / 4, yy = y(v);
    svg.append(S('line', { x1: padL, x2: W - padR, y1: yy, y2: yy, class: i === 0 && mn === 0 ? 'c-base' : 'c-grid' }));
    svg.append(S('text', { x: W - padR + 8, y: yy + 4, class: 'c-axis', 'text-anchor': 'start' }, document.createTextNode(fmtN(v))));
  }
  const n = labels.length, band = pw / n;
  const xc = (i) => W - padR - band * (i + 0.5);
  labels.forEach((l, i) => {
    if (n > 12 && i % Math.ceil(n / 12)) return;
    svg.append(S('text', { x: xc(i), y: H - padB + 20, class: 'c-axis', 'text-anchor': 'middle' }, document.createTextNode(String(l).slice(0, 14))));
  });
  if (kind === 'line') {
    series.slice(0, 8).forEach((s, si) => {
      let d = '';
      s.vals.forEach((v, i) => { if (v != null) d += (d ? 'L' : 'M') + xc(i) + ' ' + y(v); });
      svg.append(S('path', { d, fill: 'none', stroke: SERIES[si], 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      s.vals.forEach((v, i) => { if (v != null) svg.append(S('circle', { cx: xc(i), cy: y(v), r: 4, fill: SERIES[si], class: 'c-dot', 'data-tip': `${s.name} · ${labels[i]}: ${fmtN(v)}` })); });
    });
  } else {
    const ns = Math.min(8, series.length), inner = band * 0.72, bw = Math.max(2, (inner - (ns - 1) * 2) / ns);
    series.slice(0, 8).forEach((s, si) => {
      s.vals.forEach((v, i) => {
        if (v == null) return;
        const x0 = xc(i) + inner / 2 - (si + 1) * bw - si * 2;
        const y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v)), hgt = Math.max(1, y1 - y0), rr = Math.min(4, bw / 2, hgt);
        const d = v >= 0
          ? `M${x0} ${y1}V${y0 + rr}Q${x0} ${y0} ${x0 + rr} ${y0}H${x0 + bw - rr}Q${x0 + bw} ${y0} ${x0 + bw} ${y0 + rr}V${y1}Z`
          : `M${x0} ${y0}V${y1 - rr}Q${x0} ${y1} ${x0 + rr} ${y1}H${x0 + bw - rr}Q${x0 + bw} ${y1} ${x0 + bw} ${y1 - rr}V${y0}Z`;
        svg.append(S('path', { d, fill: SERIES[si], class: 'c-mark', 'data-tip': `${series.length > 1 ? s.name + ' · ' : ''}${labels[i]}: ${fmtN(v)}` }));
      });
    });
  }
  if (legendItems.length) legend(S, svg, legendItems, W, H);
  return svg;
}
function legend(S, svg, items, W, H) {
  let x = W - 16;
  const yy = H - 10;
  items.forEach((name, i) => {
    const label = String(name).slice(0, 16);
    const w = label.length * 7 + 26;
    svg.append(S('rect', { x: x - 10, y: yy - 9, width: 10, height: 10, rx: 2, fill: SERIES[i % 8] }));
    svg.append(S('text', { x: x - 16, y: yy, class: 'c-legend', 'text-anchor': 'end' }, document.createTextNode(label)));
    x -= w;
  });
}
