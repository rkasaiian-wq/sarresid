// ابزارهای عمومی
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';
export const fa = (v) => String(v ?? '').replace(/\d/g, (d) => FA[d]);
export const toEn = (s) =>
  String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => AR.indexOf(d));
export const norm = (s) =>
  toEn(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[‌ً-ٟ]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();

export function fmtMoney(n) {
  const v = parseFloat(toEn(n).replace(/[,٬\s]/g, ''));
  if (!isFinite(v)) return '';
  return fa(v.toLocaleString('en-US')).replace(/,/g, '٬');
}
export const parseNum = (s) => {
  const v = parseFloat(toEn(s).replace(/[,٬\s]/g, ''));
  return isFinite(v) ? v : null;
};

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export function toast(msg, ms = 2600) {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, msg);
  box.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// پنجره‌ی محاوره
export function modal({ title, body, actions = [], cls = '', onClose, dismissable = true }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal ' + cls });
  const close = (v) => { back.remove(); onClose && onClose(v); };
  if (title) box.append(h('div', { class: 'modal-head' }, h('h3', null, title),
    h('button', { class: 'icon-btn', 'aria-label': 'بستن', onclick: () => close() , html: ICON.close })));
  const content = h('div', { class: 'modal-body' }, body);
  box.append(content);
  if (actions.length) {
    box.append(h('div', { class: 'modal-actions' }, actions.map((a) =>
      h('button', { class: 'btn ' + (a.cls || ''), onclick: () => { const r = a.onclick ? a.onclick() : undefined; if (r !== false) close(a.value); } }, a.label))));
  }
  back.append(box);
  if (dismissable) back.addEventListener('pointerdown', (e) => { if (e.target === back) back._down = true; });
  if (dismissable) back.addEventListener('click', (e) => { if (e.target === back && back._down) close(); back._down = false; });
  document.body.append(back);
  return { close, el: box, body: content };
}

export function confirmDialog(msg, okText = 'بله', danger = false) {
  return new Promise((res) => {
    modal({
      body: h('p', { class: 'confirm-msg' }, msg),
      actions: [
        { label: 'انصراف', value: false },
        { label: okText, cls: danger ? 'danger' : 'primary', value: true },
      ],
      onClose: (v) => res(!!v),
    });
  });
}

export function prompt(title, value = '', placeholder = '') {
  return new Promise((res) => {
    const inp = h('input', { class: 'field', value, placeholder });
    const m = modal({
      title, body: inp,
      actions: [{ label: 'انصراف', value: null }, { label: 'تأیید', cls: 'primary', onclick: () => { m.close(inp.value.trim()); return false; } }],
      onClose: (v) => res(v ?? null),
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') m.close(inp.value.trim()); });
    setTimeout(() => inp.focus(), 50);
  });
}

export function initials(name) {
  const s = (name || '').trim();
  return s ? s[0] : '؟';
}

// نمایش کوتاه شماره تلفن
export function waNumber(num) {
  let d = toEn(num).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return '98' + d.slice(1);
  return d;
}

// آیکن‌ها (SVG)
const svg = (p, extra = '') => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
export const ICON = {
  today: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 13.2v3.6M10.2 15h3.6"/>'),
  tasks: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12.3 2.7 2.7L16.3 9"/>'),
  people: svg('<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.4 3.2-5.3 6-5.3s5.3 1.9 6 5.3"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.5 14.4c2.3.2 4 1.8 4.5 4.6"/>'),
  deal: svg('<path d="M3 11.5 7 7.5l3 1.5 2.5-1.5L17 7.5l4 4"/><path d="m7 7.5-4 4 6.5 6.5a1.4 1.4 0 0 0 2-2"/><path d="m11.5 16 1.2 1.2a1.4 1.4 0 0 0 2-2l-1-1M13.7 13.2l1.5 1.5a1.4 1.4 0 0 0 2-2L13 8.5"/><path d="m17 7.5 4 4-3.8 3.8"/>'),
  notes: svg('<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4M9 12h7M9 15.5h7M9 8.5h3"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  pen: svg('<path d="M4 20l1.2-4.4L15.8 5a2.1 2.1 0 0 1 3 3L8.4 18.6z"/><path d="m13.8 7 3 3"/>'),
  hl: svg('<path d="m9 15-3 3H3.5l2-2.5"/><path d="m8.5 11.5 4-4 6.5 6.5-4 4z"/><path d="m8.5 11.5-.5 4 4-.5"/><path d="M12.5 7.5 15 5l5 5-1 1"/>'),
  eraser: svg('<path d="M7.5 19.5h12"/><path d="m4.7 14.3 9.6-9.6a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8l-8.6 8.6a4 4 0 0 1-2.8 1.2H7l-2.3-2.4a2 2 0 0 1 0-2.8z"/><path d="m9 10 5.5 5.5"/>'),
  lasso: svg('<path d="M7.5 17.5C4.6 16.3 3 14.4 3 12c0-4.1 4-7.5 9-7.5s9 3.4 9 7.5-4 7.5-9 7.5c-.9 0-1.8-.1-2.6-.3" stroke-dasharray="2.6 2.4"/><circle cx="8" cy="18.5" r="1.6"/><path d="M8 20c0 1 .5 1.8 1.5 2"/>'),
  shape: svg('<circle cx="8" cy="8" r="4.3"/><rect x="11.5" y="11.5" width="9" height="9" rx="1"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  chat: svg('<path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.5L3.5 20.5l1.4-4.5a8.4 8.4 0 1 1 15.6-4.4z"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>'),
  next: svg('<path d="m15 6-6 6 6 6"/>'),
  prev: svg('<path d="m9 6 6 6-6 6"/>'),
  back: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  more: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  write: svg('<path d="M3 17c2.5-6 4.5-6 4.5-2.5S9 18 11 13s3-3 3 0 2 2 3.5 0"/><path d="m16 4 4 4"/><path d="M14.5 5.5 18.5 9.5"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  folder: svg('<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  table: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15"/>'),
  text: svg('<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>'),
  chart: svg('<path d="M4 20h16"/><rect x="6" y="11" width="3" height="7" rx=".6"/><rect x="11" y="6" width="3" height="12" rx=".6"/><rect x="16" y="13" width="3" height="5" rx=".6"/>'),
  move: svg('<path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  download: svg('<path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15"/>'),
  upload: svg('<path d="M12 15.5v-11M7 9l5-5 5 5M4.5 19.5h15"/>'),
  contacts: svg('<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><circle cx="12" cy="10" r="2.7"/><path d="M7.8 17c.6-2.3 2.2-3.4 4.2-3.4s3.6 1.1 4.2 3.4M2.5 8h2M2.5 12h2M2.5 16h2"/>'),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  building: svg('<path d="M4 20.5V5.5l8-2v17M12 8.5l8 2.5v9.5M2.5 20.5h19M7 8h2M7 11.5h2M7 15h2M15 13h2M15 16.5h2"/>'),
  user: svg('<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
};
