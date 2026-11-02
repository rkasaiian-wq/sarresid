// بخش توافقات
import { h, ICON, uid, fa, norm, debounce, confirmDialog, fmtMoney, modal } from '../util.js';
import { data, save, remove, on, putFile, getFileRec, delFile } from '../db.js';
import { InkSurface } from '../ink.js';
import { todayKey, fmtShort, diffDays, relLabel } from '../jalali.js';
import { dateField, remindField, personField, personName, segmented } from '../pickers.js';

export const STATUS = {
  open: { label: 'در جریان', color: 'var(--accent)' },
  done: { label: 'انجام شد', color: 'var(--ok)' },
  cancel: { label: 'لغو شد', color: 'var(--muted)' },
};
const UNITS = ['تومان', 'ریال', 'دلار', 'یورو', 'درهم'];
let filter = 'open';

export function newAgreement(defaults = {}) {
  const a = save('agreements', { id: uid(), subject: '', date: todayKey(), status: 'open', unit: 'تومان', files: [], ...defaults });
  location.hash = '#/agreements/' + a.id;
  return a;
}

function deadlineBadge(a) {
  if (a.status !== 'open' || !a.deadline) return null;
  const d = diffDays(todayKey(), a.deadline);
  const cls = d < 0 ? 'late' : d <= 3 ? 'soon' : '';
  return h('span', { class: 'badge ' + cls }, d < 0 ? `مهلت گذشته · ${relLabel(a.deadline)}` : `مهلت: ${relLabel(a.deadline)}`);
}

export function renderAgreements(main, [selId]) {
  let sel = selId ? data.agreements.get(selId) : null;
  if (sel && filter !== 'all' && sel.status !== filter) filter = 'all';
  const q = h('input', { class: 'field', type: 'search', placeholder: 'جستجو در توافقات…' });
  const chips = h('div', { class: 'chips' });
  const listEl = h('div', { class: 'master-list' });
  const detail = h('section', { class: 'pane detail' });
  let cleanupDetail = () => {};

  const renderList = () => {
    chips.innerHTML = '';
    for (const [id, label] of [['open', 'در جریان'], ['done', 'انجام شد'], ['cancel', 'لغو شد'], ['all', 'همه']]) {
      const n = id === 'all' ? data.agreements.size : [...data.agreements.values()].filter((a) => a.status === id).length;
      chips.append(h('button', { class: 'chip-btn' + (filter === id ? ' on' : ''), onclick: () => { filter = id; renderList(); } }, label, n ? h('span', { class: 'count' }, fa(n)) : null));
    }
    const query = norm(q.value);
    let items = [...data.agreements.values()].filter((a) => filter === 'all' || a.status === filter)
      .filter((a) => !query || norm([a.subject, a.desc, personName(a.personId), a.amount].join(' ')).includes(query));
    if (filter === 'open') items.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    else items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    listEl.innerHTML = '';
    for (const a of items) {
      listEl.append(h('button', { class: 'master-item deal-item' + (sel?.id === a.id ? ' sel' : ''), onclick: () => select(a.id) },
        h('span', { class: 'status-dot', style: { '--c': STATUS[a.status]?.color } }),
        h('span', { class: 'mi-txt' },
          h('strong', null, a.subject || '(بدون موضوع)'),
          h('small', null, [personName(a.personId), a.date ? fmtShort(a.date) : '', a.amount ? fmtMoney(a.amount) + ' ' + (a.unit || '') : ''].filter(Boolean).join(' · ')),
          deadlineBadge(a))));
    }
    if (!items.length) listEl.append(h('div', { class: 'empty small' }, 'توافقی در این فهرست نیست'));
  };
  const select = (id) => {
    sel = data.agreements.get(id) || null;
    history.replaceState(null, '', '#/agreements' + (sel ? '/' + sel.id : ''));
    renderList();
    renderDetail();
  };
  const renderDetail = () => {
    cleanupDetail();
    detail.innerHTML = '';
    cleanupDetail = () => {};
    if (!sel) {
      detail.append(h('div', { class: 'empty big' }, h('span', { html: ICON.deal }), h('p', null, 'یک توافق را انتخاب کنید یا توافق جدید ثبت کنید'), h('button', { class: 'btn primary', onclick: () => newAgreement() }, 'ثبت توافق جدید')));
      return;
    }
    cleanupDetail = agreementDetail(detail, sel, { onDelete: () => select(null) });
  };
  q.addEventListener('input', renderList);
  renderList();
  renderDetail();
  const off = on('agreements', renderList);
  const offP = on('people', renderList);
  main.append(h('div', { class: 'view master-detail' },
    h('section', { class: 'pane master' },
      h('div', { class: 'view-head' }, h('h2', null, 'توافقات'), h('button', { class: 'btn primary small', onclick: () => newAgreement() }, h('span', { html: ICON.plus }), 'جدید')),
      chips, q, listEl),
    detail));
  return () => { off(); offP(); cleanupDetail(); };
}

function agreementDetail(root, a, { onDelete }) {
  const persist = debounce(() => save('agreements', a), 400);
  const set = (k) => (v) => { a[k] = v; persist(); };
  const subject = h('input', { class: 'field big', value: a.subject || '', placeholder: 'موضوع توافق', oninput: (e) => set('subject')(e.target.value) });
  const amount = h('input', { class: 'field ltr', inputmode: 'decimal', value: a.amount ? fmtMoney(a.amount) : '', placeholder: '۰',
    oninput: (e) => set('amount')(e.target.value), onblur: (e) => { e.target.value = a.amount ? fmtMoney(a.amount) : ''; } });
  const unit = h('select', { class: 'field small-sel', onchange: (e) => set('unit')(e.target.value) }, UNITS.map((u) => h('option', { value: u, selected: u === (a.unit || 'تومان') }, u)));
  const desc = h('textarea', { class: 'field', rows: 4, placeholder: 'شرح توافق، تعهدات طرفین، شرایط…', oninput: (e) => set('desc')(e.target.value) }, a.desc || '');
  a.ink ||= { strokes: [], objects: [] };
  a.files ||= [];
  const inkHost = h('div', { class: 'ink-box paper' });

  const files = h('div', { class: 'attach-grid' });
  const urls = [];
  const renderFiles = async () => {
    files.innerHTML = '';
    for (const fid of a.files) {
      const rec = await getFileRec(fid);
      if (!rec?.blob) continue;
      const url = URL.createObjectURL(rec.blob); urls.push(url);
      const isImg = (rec.blob.type || '').startsWith('image/');
      const name = rec.name || (isImg ? 'عکس' : 'فایل');
      const del = h('button', { class: 'icon-btn tiny', html: ICON.close, title: 'حذف', onclick: async (e) => {
        e.stopPropagation(); e.preventDefault();
        if (!(await confirmDialog(`«${name}» حذف شود؟`, 'حذف', true))) return;
        a.files = a.files.filter((x) => x !== fid); delFile(fid); save('agreements', a); renderFiles();
      } });
      if (isImg) files.append(h('div', { class: 'attach' }, h('img', { src: url, alt: name, onclick: () => viewImage(url) }), del));
      else files.append(h('a', { class: 'attach file', href: url, download: name, title: 'باز کردن / ذخیره' },
        h('span', { class: 'file-ext' }, fileExt(name)), h('small', { class: 'file-name' }, name), h('small', { class: 'muted' }, fmtSize(rec.blob.size)), del));
    }
    const pick = (accept) => h('input', { type: 'file', accept, multiple: true, hidden: true, onchange: async (e) => {
      for (const f of e.target.files) {
        const id = uid();
        const isImg = f.type.startsWith('image/') && !/svg|gif/.test(f.type);
        await putFile(id, isImg ? await compressImage(f) : f, f.name);
        a.files.push(id);
      }
      save('agreements', a); renderFiles();
    } });
    files.append(
      h('label', { class: 'attach add' }, pick('image/*'), h('span', { html: ICON.camera }), h('small', null, 'افزودن عکس')),
      h('label', { class: 'attach add' }, pick('*/*'), h('span', { html: ICON.clip }), h('small', null, 'پیوست فایل')));
  };
  renderFiles();

  const head = h('div', { class: 'detail-head' }, h('span', { class: 'ava big deal', html: ICON.deal }), subject,
    h('button', { class: 'icon-btn danger', title: 'حذف توافق', html: ICON.trash, onclick: async () => {
      if (await confirmDialog('این توافق حذف شود؟', 'حذف', true)) { a.files.forEach(delFile); remove('agreements', a.id); onDelete(); }
    } }));

  const body = h('div', { class: 'detail-body scroll-y' },
    head,
    h('div', { class: 'card' },
      h('div', { class: 'form-grid' },
        h('div', null, h('label', null, 'طرف توافق'), personField(a.personId, (v) => { a.personId = v; save('agreements', a); })),
        h('div', null, h('label', null, 'تاریخ توافق'), dateField(a.date, (v) => { a.date = v; save('agreements', a); })),
        h('div', null, h('label', null, 'مبلغ'), h('div', { class: 'row gap' }, amount, unit)),
        h('div', null, h('label', null, 'مهلت انجام'), dateField(a.deadline, (v) => { a.deadline = v; save('agreements', a); }, { placeholder: 'بدون مهلت' })),
        h('div', null, h('label', null, 'یادآوری پیگیری'), remindField(a.remind, (v) => { a.remind = v; a.reminded = false; save('agreements', a); })),
        h('div', null, h('label', null, 'وضعیت'), segmented(Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label, color: s.color })), a.status, (v) => { a.status = v; save('agreements', a); })),
      )),
    h('div', { class: 'card' }, h('h4', null, 'شرح توافق'), desc, h('div', { class: 'small muted', style: { margin: '8px 0 4px' } }, 'دست‌نویس'), inkHost),
    h('div', { class: 'card' }, h('h4', null, 'پیوست‌ها (عکس، PDF، فایل قرارداد، رسید، …)'), files),
  );
  root.append(body);
  const surf = new InkSurface(inkHost, { doc: a.ink, logicalWidth: 800, lineGap: 36, bg: 'lines', onChange: () => persist() });
  return () => { persist.flush(); surf.destroy(); urls.forEach((u) => URL.revokeObjectURL(u)); };
}

function viewImage(url) {
  modal({ cls: 'modal-img', body: h('img', { src: url, class: 'full-img' }) });
}

async function compressImage(file, max = 1800) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
  } catch { return file; }
}

function fileExt(name) { const m = /\.([a-z0-9]{1,5})$/i.exec(name || ''); return m ? m[1].toUpperCase() : 'فایل'; }
function fmtSize(b) { return b < 1024 * 1024 ? fa(Math.max(1, Math.round(b / 1024))) + ' کیلوبایت' : fa((b / 1048576).toFixed(1)) + ' مگابایت'; }
