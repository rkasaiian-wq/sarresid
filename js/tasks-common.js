// اجزای مشترک کارها: ردیف کار، پنجره‌ی ویرایش، نوار افزودن، نوشتن دستی
import { h, uid, modal, confirmDialog, ICON, fa } from './util.js';
import { data, save, remove } from './db.js';
import { todayKey, relLabel, diffDays, fmtDateTime } from './jalali.js';
import { InkSurface, strokesSVG, attachStrike } from './ink.js';
import { dateField, remindField, personField, personChip, segmented } from './pickers.js';

export const PRI = { 1: { label: 'فوری', color: 'var(--danger)' }, 2: { label: 'مهم', color: 'var(--warn)' }, 3: { label: 'عادی', color: 'var(--muted)' } };

export function sortTasks(a, b) {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1;
  if ((a.pri || 3) !== (b.pri || 3)) return (a.pri || 3) - (b.pri || 3);
  return (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
}

export function toggleDone(t, val) {
  t.done = val ?? !t.done;
  t.doneDay = t.done ? todayKey() : null;
  save('tasks', t);
}

export function taskRow(t, { showDate = false, hidePerson = false } = {}) {
  const today = todayKey();
  const overdue = !t.done && t.due && t.due < today;
  const row = h('div', { class: 'task-row' + (t.done ? ' done' : '') + (overdue ? ' overdue' : ''), dataset: { id: t.id } });
  const chk = h('button', { class: 'chk', 'aria-label': t.done ? 'برگرداندن' : 'انجام شد', html: ICON.check, onclick: (e) => { e.stopPropagation(); toggleDone(t); } });
  const title = h('div', { class: 't-title' });
  if (t.ink?.length) title.append(strokesSVG(t.ink, { height: 30, maxWidth: 520 }));
  if (t.title) title.append(h('span', null, t.title));
  if (!t.ink?.length && !t.title) title.append(h('span', { class: 'muted' }, '(بدون عنوان)'));
  const meta = [];
  if (t.pri && t.pri < 3) meta.push(h('span', { class: 'pri', style: { '--c': PRI[t.pri].color } }, PRI[t.pri].label));
  if (overdue) meta.push(h('span', { class: 'badge late' }, `عقب‌افتاده · ${relLabel(t.due)}`));
  else if (showDate && t.due) meta.push(h('span', { class: 'badge' }, relLabel(t.due)));
  if (t.remind && !t.done) meta.push(h('span', { class: 'badge', html: ICON.bell + ' ' + fmtDateTime(t.remind) }));
  if (t.personId && !hidePerson) meta.push(personChip(t.personId, (e) => { e.stopPropagation(); location.hash = '#/people/' + t.personId; }));
  if (t.note) meta.push(h('span', { class: 'muted small' }, '📝'));
  const body = h('div', { class: 't-body', onclick: () => taskDialog(t) }, title, meta.length ? h('div', { class: 't-meta' }, meta) : null);
  row.append(chk, body);
  return row;
}

// فهرست کارها با قابلیت خط‌زدن با قلم
export function taskList(tasks, opts = {}) {
  const list = h('div', { class: 'task-list' + (opts.cls ? ' ' + opts.cls : '') });
  fillTaskList(list, tasks, opts);
  attachStrike(list, {
    rowSelector: '.task-row',
    onStrike: (row) => { const t = data.tasks.get(row.dataset.id); if (t) toggleDone(t); },
  });
  return list;
}
export function fillTaskList(list, tasks, opts = {}) {
  list.innerHTML = '';
  if (opts.groups) {
    for (const g of opts.groups) {
      if (!g.items.length) continue;
      list.append(h('div', { class: 'group-head' }, g.title, h('span', { class: 'count' }, fa(g.items.length))));
      for (const t of g.items) list.append(taskRow(t, opts));
    }
  } else for (const t of tasks) list.append(taskRow(t, opts));
  if (!list.children.length && opts.empty) list.append(h('div', { class: 'empty' }, opts.empty));
}

// نوار افزودن کار
export function addTaskBar({ due = null, personId = null, placeholder = 'کار جدید را بنویسید و Enter بزنید…' } = {}) {
  const inp = h('input', { class: 'field add-input', placeholder, enterkeyhint: 'done' });
  const add = () => {
    const v = inp.value.trim();
    if (!v) return;
    save('tasks', { id: uid(), title: v, due: typeof due === 'function' ? due() : due, personId, pri: 3, done: false });
    inp.value = '';
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  return h('div', { class: 'add-bar' },
    h('button', { class: 'icon-btn accent', title: 'نوشتن با قلم', html: ICON.write, onclick: () => handwriteTask({ due: typeof due === 'function' ? due() : due, personId }) }),
    inp,
    h('button', { class: 'icon-btn', title: 'افزودن', html: ICON.plus, onclick: add }));
}

// پنجره‌ی نوشتن کار با قلم
export function inkPad(strokes, { height = 130, width = 700, gap = 44, cls = '' } = {}) {
  const doc = { strokes: strokes ? strokes.map((s) => ({ ...s, p: s.p.slice() })) : [], objects: [] };
  const host = h('div', { class: 'ink-pad ' + cls, style: { height: typeof height === 'number' ? height + 'px' : height } });
  let surf;
  const ctrl = h('div', { class: 'row gap pad-ctrl' },
    h('button', { class: 'btn small', onclick: () => surf.undo() }, 'برگرداندن'),
    h('button', { class: 'btn small', onclick: () => surf.clearAll() }, 'پاک کردن'));
  const el = h('div', { class: 'ink-pad-box' }, host, ctrl);
  requestAnimationFrame(() => { surf = new InkSurface(host, { doc, logicalWidth: width, bg: 'lines', lineGap: gap, scroll: false, forceTool: 'pen' }); });
  return { el, doc, destroy: () => surf?.destroy(), clear: () => { doc.strokes.length = 0; surf?.changed(); surf?.undoStack.splice(0); } };
}

export function handwriteTask({ due = null, personId = null } = {}) {
  const pad = inkPad(null, { height: 'max(150px, calc(100dvh - 170px))', width: 760, gap: 64, cls: 'big' });
  let n = 0;
  const counter = h('span', { class: 'muted small' });
  const store = () => {
    if (!pad.doc.strokes.length) return false;
    save('tasks', { id: uid(), title: '', ink: pad.doc.strokes.slice(), due, personId, pri: 3, done: false });
    n++; counter.textContent = fa(n) + ' کار ذخیره شد';
    return true;
  };
  const m = modal({
    title: 'کار جدید با قلم', cls: 'modal-wide modal-hw', body: pad.el,
    actions: [
      { label: 'بستن' },
      { label: 'ذخیره و کار بعدی', onclick: () => { if (store()) pad.clear(); return false; } },
      { label: 'ذخیره', cls: 'primary', onclick: () => { store(); } },
    ],
    onClose: () => pad.destroy(),
  });
  m.el.querySelector('.pad-ctrl').prepend(counter);
  return m;
}

// پنجره‌ی ویرایش کار
export function taskDialog(t) {
  const isNew = !t;
  const d = t ? JSON.parse(JSON.stringify(t)) : { id: uid(), title: '', due: todayKey(), pri: 3, done: false };
  const title = h('input', { class: 'field', value: d.title || '', placeholder: 'عنوان کار' });
  const pad = inkPad(d.ink, { height: 110 });
  const note = h('textarea', { class: 'field', rows: 2, placeholder: 'توضیحات (اختیاری)' }, d.note || '');
  const body = h('div', { class: 'form task-form' },
    h('div', null,
      h('label', null, 'عنوان (تایپی)'), title,
      h('label', null, 'یا با قلم بنویسید'), pad.el,
      h('label', null, 'توضیحات'), note),
    h('div', null,
      h('label', null, 'تاریخ انجام'), dateField(d.due, (v) => (d.due = v)),
      h('label', null, 'اولویت'), segmented([1, 2, 3].map((p) => ({ value: p, label: PRI[p].label, color: PRI[p].color })), d.pri || 3, (v) => (d.pri = v), 'full'),
      h('label', null, 'مربوط به'), personField(d.personId, (v) => (d.personId = v)),
      h('label', null, 'یادآوری'), remindField(d.remind, (v) => { d.remind = v; d.reminded = false; })),
  );
  const actions = [];
  if (!isNew) actions.push({ label: 'حذف', cls: 'danger ghost', onclick: () => {
    confirmDialog('این کار حذف شود؟', 'حذف', true).then((ok) => { if (ok) { remove('tasks', t.id); m.close(); } });
    return false;
  } });
  if (!isNew) actions.push({ label: d.done ? 'برگرداندن به انجام‌نشده' : 'انجام شد ✓', onclick: () => { toggleDone(t, !t.done); } });
  actions.push({ label: 'ذخیره', cls: 'primary', onclick: () => {
    d.title = title.value.trim();
    d.note = note.value.trim();
    d.ink = pad.doc.strokes.length ? pad.doc.strokes : null;
    if (!d.title && !d.ink) return;
    save('tasks', Object.assign(t || {}, d));
  } });
  const m = modal({ title: isNew ? 'کار جدید' : 'ویرایش کار', cls: 'modal-wide', body, actions, onClose: () => pad.destroy() });
  return m;
}

// دسته‌بندی کارهای باز
export function groupOpen(tasks) {
  const today = todayKey();
  const g = { late: [], today: [], tomorrow: [], week: [], later: [], none: [] };
  for (const t of tasks) {
    if (!t.due) g.none.push(t);
    else {
      const d = diffDays(today, t.due);
      if (d < 0) g.late.push(t); else if (d === 0) g.today.push(t); else if (d === 1) g.tomorrow.push(t); else if (d <= 7) g.week.push(t); else g.later.push(t);
    }
  }
  const byDue = (a, b) => (a.due || '').localeCompare(b.due || '') || sortTasks(a, b);
  return [
    { title: 'عقب‌افتاده', items: g.late.sort(byDue) },
    { title: 'امروز', items: g.today.sort(sortTasks) },
    { title: 'فردا', items: g.tomorrow.sort(sortTasks) },
    { title: 'هفت روز آینده', items: g.week.sort(byDue) },
    { title: 'بعداً', items: g.later.sort(byDue) },
    { title: 'بدون تاریخ', items: g.none.sort(sortTasks) },
  ];
}
