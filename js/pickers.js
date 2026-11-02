// انتخابگر تاریخ شمسی، انتخاب شخص، فیلد تاریخ/ساعت
import { h, modal, fa, norm, ICON, initials, uid } from './util.js';
import { MONTHS, WD_SHORT, jOf, keyFromJ, monthLen, weekdayIdx, todayKey, fmtShort, keyOf } from './jalali.js';
import { data, save } from './db.js';

export function calendarGrid(selKey, { onPick, marks } = {}) {
  const today = todayKey();
  let { jy, jm } = jOf(selKey || today);
  const root = h('div', { class: 'cal' });
  const render = () => {
    root.innerHTML = '';
    const head = h('div', { class: 'cal-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'ماه قبل', html: ICON.prev, onclick: () => { jm--; if (jm < 1) { jm = 12; jy--; } render(); } }),
      h('strong', null, `${MONTHS[jm - 1]} ${fa(jy)}`),
      h('button', { class: 'icon-btn', 'aria-label': 'ماه بعد', html: ICON.next, onclick: () => { jm++; if (jm > 12) { jm = 1; jy++; } render(); } }));
    const grid = h('div', { class: 'cal-grid' }, WD_SHORT.map((d, i) => h('div', { class: 'cal-wd' + (i === 6 ? ' fri' : '') }, d)));
    const first = keyFromJ(jy, jm, 1);
    const off = weekdayIdx(first);
    for (let i = 0; i < off; i++) grid.append(h('div'));
    const len = monthLen(jy, jm);
    for (let d = 1; d <= len; d++) {
      const k = keyFromJ(jy, jm, d);
      const cls = ['cal-day'];
      if (k === today) cls.push('today');
      if (k === selKey) cls.push('sel');
      if ((off + d - 1) % 7 === 6) cls.push('fri');
      const m = marks?.(k);
      grid.append(h('button', { class: cls.join(' '), onclick: () => onPick(k) }, fa(d), m ? h('i', { class: 'dot' }) : null));
    }
    root.append(head, grid);
  };
  render();
  return root;
}

export function pickDate(selKey, { allowClear = true, title = 'انتخاب تاریخ', marks } = {}) {
  return new Promise((res) => {
    let result;
    const m = modal({
      title, cls: 'modal-cal',
      body: calendarGrid(selKey, { marks, onPick: (k) => { result = k; m.close(); } }),
      actions: [
        ...(allowClear ? [{ label: 'بدون تاریخ', onclick: () => { result = null; } }] : []),
        { label: 'امروز', cls: 'primary', onclick: () => { result = todayKey(); } },
      ],
      onClose: () => res(result),
    });
  });
}

// فیلد تاریخ (دکمه) — مقدار: کلید تاریخ یا null
export function dateField(value, onChange, { placeholder = 'تاریخ', allowClear = true } = {}) {
  const b = h('button', { class: 'field date-field', type: 'button' });
  const set = (v) => { value = v; b.textContent = v ? fmtShort(v) : placeholder; b.classList.toggle('empty', !v); };
  set(value);
  b.addEventListener('click', async () => {
    const r = await pickDate(value, { allowClear });
    if (r !== undefined) { set(r); onChange(r); }
  });
  return b;
}

// فیلد یادآوری: تاریخ + ساعت → ms
export function remindField(ms, onChange) {
  let key = ms ? keyOf(new Date(ms)) : null;
  let time = ms ? new Date(ms).toTimeString().slice(0, 5) : '09:00';
  const emit = () => {
    if (!key) return onChange(null);
    const [y, mo, d] = key.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    onChange(new Date(y, mo - 1, d, hh, mm).getTime());
  };
  const t = h('input', { type: 'time', class: 'field time-field', value: time, onchange: (e) => { time = e.target.value || '09:00'; emit(); } });
  const d = dateField(key, (v) => { key = v; t.disabled = !v; emit(); }, { placeholder: 'بدون یادآوری' });
  t.disabled = !key;
  return h('div', { class: 'row gap' }, h('span', { class: 'ico-inline', html: ICON.bell }), d, t);
}

export const personName = (id) => data.people.get(id)?.name || '';

export function personChip(id, onclick) {
  const p = data.people.get(id);
  if (!p) return null;
  return h('span', { class: 'chip person-chip', onclick }, h('span', { class: 'mini-ava ' + p.kind }, initials(p.name)), p.name);
}

// انتخاب شخص یا شرکت
export function pickPerson(currentId, { kind = null, title = 'انتخاب شخص' } = {}) {
  return new Promise((res) => {
    let result;
    const inp = h('input', { class: 'field', placeholder: 'جستجوی نام...' });
    const list = h('div', { class: 'pick-list' });
    const render = () => {
      const q = norm(inp.value);
      list.innerHTML = '';
      const all = [...data.people.values()]
        .filter((p) => !kind || p.kind === kind)
        .filter((p) => !q || norm(p.name + ' ' + (p.role || '')).includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
      if (inp.value.trim()) {
        list.append(h('button', { class: 'pick-item add', onclick: () => {
          const p = save('people', { id: uid(), kind: kind || 'person', name: inp.value.trim(), phones: [] });
          result = p.id; m.close();
        } }, h('span', { html: ICON.plus }), `افزودن «${inp.value.trim()}»`));
      }
      for (const p of all.slice(0, 80)) {
        const comp = p.companyId ? data.people.get(p.companyId)?.name : '';
        list.append(h('button', { class: 'pick-item' + (p.id === currentId ? ' sel' : ''), onclick: () => { result = p.id; m.close(); } },
          h('span', { class: 'mini-ava ' + p.kind }, initials(p.name)),
          h('span', null, p.name, comp || p.role ? h('small', null, ' — ' + [p.role, comp].filter(Boolean).join('، ')) : null)));
      }
      if (!all.length && !inp.value.trim()) list.append(h('p', { class: 'muted pad' }, 'هنوز کسی ثبت نشده. نام را بنویسید تا اضافه شود.'));
    };
    inp.addEventListener('input', render);
    const m = modal({
      title, cls: 'modal-pick', body: h('div', null, inp, list),
      actions: currentId ? [{ label: 'حذف انتخاب', onclick: () => { result = null; } }] : [],
      onClose: () => res(result),
    });
    render();
    setTimeout(() => inp.focus(), 60);
  });
}

export function personField(value, onChange, opts = {}) {
  const b = h('button', { class: 'field person-field', type: 'button' });
  const set = (v) => {
    value = v;
    b.innerHTML = '';
    const p = data.people.get(v);
    if (p) b.append(h('span', { class: 'mini-ava ' + p.kind }, initials(p.name)), p.name);
    else b.append(h('span', { class: 'muted' }, opts.placeholder || 'انتخاب شخص'));
  };
  set(value);
  b.addEventListener('click', async () => {
    const r = await pickPerson(value, opts);
    if (r !== undefined) { set(r); onChange(r); }
  });
  return b;
}

export function segmented(options, value, onChange, cls = '') {
  const root = h('div', { class: 'seg ' + cls });
  const render = () => {
    root.innerHTML = '';
    for (const o of options) root.append(h('button', { type: 'button', class: o.value === value ? 'on' : '', style: o.color ? { '--c': o.color } : null, onclick: () => { value = o.value; render(); onChange(value); } }, o.label));
  };
  render();
  return root;
}
