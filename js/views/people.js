// بخش اشخاص (افراد و شرکت‌ها)
import { h, ICON, uid, fa, norm, debounce, initials, confirmDialog, toast, waNumber } from '../util.js';
import { data, save, remove, on } from '../db.js';
import { InkSurface } from '../ink.js';
import { taskList, fillTaskList, addTaskBar, sortTasks } from '../tasks-common.js';
import { personField, segmented } from '../pickers.js';
import { fmtShort } from '../jalali.js';
import { STATUS, newAgreement } from './agreements.js';

let kindFilter = 'person';
const PHONE_LABELS = ['موبایل', 'محل کار', 'منزل', 'فکس', 'سایر'];

export function renderPeople(main, [selId]) {
  let sel = selId ? data.people.get(selId) : null;
  if (sel) kindFilter = sel.kind;
  const q = h('input', { class: 'field', type: 'search', placeholder: 'جستجو در اشخاص…' });
  const listEl = h('div', { class: 'master-list' });
  const detail = h('section', { class: 'pane detail' });
  let cleanupDetail = () => {};

  const kindSeg = h('div');
  const renderKindSeg = () => {
    kindSeg.innerHTML = '';
    kindSeg.append(segmented([{ value: 'person', label: 'افراد' }, { value: 'company', label: 'شرکت‌ها' }], kindFilter, (v) => { kindFilter = v; renderList(); }, 'full'));
  };
  const renderList = () => {
    const query = norm(q.value);
    listEl.innerHTML = '';
    const items = [...data.people.values()].filter((p) => p.kind === kindFilter)
      .filter((p) => !query || norm([p.name, p.role, p.email, ...(p.phones || []).map((x) => x.num), data.people.get(p.companyId)?.name].join(' ')).includes(query))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
    for (const p of items) {
      const comp = p.companyId ? data.people.get(p.companyId)?.name : '';
      const sub = p.kind === 'company'
        ? [p.role, fa([...data.people.values()].filter((x) => x.companyId === p.id).length) + ' نفر'].filter(Boolean).join(' · ')
        : [p.role, comp].filter(Boolean).join(' · ');
      listEl.append(h('button', { class: 'master-item' + (sel?.id === p.id ? ' sel' : ''), onclick: () => select(p.id) },
        h('span', { class: 'ava ' + p.kind }, p.kind === 'company' ? h('span', { html: ICON.building }) : initials(p.name)),
        h('span', { class: 'mi-txt' }, h('strong', null, p.name || '(بدون نام)'), sub ? h('small', null, sub) : null)));
    }
    if (!items.length) listEl.append(h('div', { class: 'empty small' }, query ? 'موردی پیدا نشد' : kindFilter === 'company' ? 'هنوز شرکتی ثبت نشده' : 'هنوز کسی ثبت نشده'));
  };
  const select = (id) => {
    sel = data.people.get(id) || null;
    history.replaceState(null, '', '#/people' + (sel ? '/' + sel.id : ''));
    renderList();
    renderDetail();
  };
  const addNew = () => {
    const p = save('people', { id: uid(), kind: kindFilter, name: '', phones: [{ label: 'موبایل', num: '' }] });
    select(p.id);
    setTimeout(() => detail.querySelector('.name-input')?.focus(), 50);
  };
  const importContacts = async () => {
    try {
      const cs = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
      let n = 0;
      for (const c of cs) {
        const name = c.name?.[0]?.trim();
        if (!name) continue;
        save('people', { id: uid(), kind: 'person', name, phones: (c.tel || []).map((num) => ({ label: 'موبایل', num })), email: c.email?.[0] || '' });
        n++;
      }
      if (n) toast(`${fa(n)} نفر اضافه شد`);
    } catch (e) { toast('دسترسی به مخاطبین ممکن نشد'); }
  };

  const renderDetail = () => {
    cleanupDetail();
    detail.innerHTML = '';
    if (!sel) {
      detail.append(h('div', { class: 'empty big' }, h('span', { html: ICON.people }), h('p', null, 'یک نفر یا شرکت را از فهرست انتخاب کنید'), h('button', { class: 'btn primary', onclick: addNew }, 'افزودن ' + (kindFilter === 'company' ? 'شرکت' : 'شخص') + ' جدید')));
      cleanupDetail = () => {};
      return;
    }
    cleanupDetail = personDetail(detail, sel, { onDelete: () => select(null), onKind: (k) => { kindFilter = k; renderKindSeg(); select(sel.id); } });
  };

  q.addEventListener('input', renderList);
  renderKindSeg();
  renderList();
  renderDetail();
  const off = on('people', () => renderList());

  const tools = h('div', { class: 'row gap' },
    h('button', { class: 'btn primary small grow', onclick: addNew }, h('span', { html: ICON.plus }), 'جدید'),
    'contacts' in navigator && 'select' in navigator.contacts ? h('button', { class: 'btn small', title: 'وارد کردن از مخاطبین گوشی', onclick: importContacts }, h('span', { html: ICON.contacts }), 'مخاطبین') : null);
  main.append(h('div', { class: 'view master-detail' },
    h('section', { class: 'pane master' }, h('div', { class: 'view-head' }, h('h2', null, 'اشخاص')), kindSeg, q, tools, listEl),
    detail));
  return () => { off(); cleanupDetail(); };
}

function personDetail(root, p, { onDelete, onKind }) {
  const persist = debounce(() => save('people', p), 400);
  const bind = (field, el) => { el.addEventListener('input', () => { p[field] = el.value; persist(); }); return el; };
  const isCo = p.kind === 'company';

  const name = bind('name', h('input', { class: 'field big name-input', value: p.name || '', placeholder: isCo ? 'نام شرکت' : 'نام و نام خانوادگی' }));
  const ava = h('span', { class: 'ava big ' + p.kind }, isCo ? h('span', { html: ICON.building }) : initials(p.name));
  if (!isCo) name.addEventListener('input', () => { ava.textContent = initials(p.name); });
  const head = h('div', { class: 'detail-head' },
    ava,
    name,
    segmented([{ value: 'person', label: 'شخص' }, { value: 'company', label: 'شرکت' }], p.kind, (v) => { p.kind = v; save('people', p); onKind(v); }),
    h('button', { class: 'icon-btn danger', title: 'حذف', html: ICON.trash, onclick: async () => {
      if (await confirmDialog(`«${p.name || 'این مورد'}» حذف شود؟ کارها و توافقات مرتبط باقی می‌مانند.`, 'حذف', true)) { remove('people', p.id); onDelete(); }
    } }));

  // تلفن‌ها
  p.phones ||= [];
  const phones = h('div', { class: 'phones' });
  const renderPhones = () => {
    phones.innerHTML = '';
    p.phones.forEach((ph, i) => {
      const num = h('input', { class: 'field ltr', type: 'tel', value: ph.num || '', placeholder: '0912…', oninput: (e) => { ph.num = e.target.value; persist(); } });
      const label = h('select', { class: 'field small-sel', onchange: (e) => { ph.label = e.target.value; persist(); } }, PHONE_LABELS.map((l) => h('option', { value: l, selected: l === ph.label }, l)));
      phones.append(h('div', { class: 'phone-row' }, label, num,
        h('a', { class: 'icon-btn ok', title: 'تماس', html: ICON.phone, onclick: (e) => { if (!ph.num) e.preventDefault(); else e.currentTarget.href = 'tel:' + ph.num.replace(/\s/g, ''); } }),
        h('a', { class: 'icon-btn wa', title: 'واتساپ', target: '_blank', html: ICON.chat, onclick: (e) => { if (!ph.num) e.preventDefault(); else e.currentTarget.href = 'https://wa.me/' + waNumber(ph.num); } }),
        h('button', { class: 'icon-btn', title: 'حذف شماره', html: ICON.close, onclick: () => { p.phones.splice(i, 1); persist(); renderPhones(); } })));
    });
    phones.append(h('button', { class: 'btn small ghost', onclick: () => { p.phones.push({ label: 'موبایل', num: '' }); renderPhones(); phones.querySelectorAll('input')[p.phones.length - 1]?.focus(); } }, '+ افزودن شماره'));
  };
  renderPhones();

  const email = bind('email', h('input', { class: 'field ltr', type: 'email', value: p.email || '', placeholder: 'email@example.com' }));
  const fields = h('div', { class: 'form-grid' },
    h('div', null, h('label', null, isCo ? 'حوزه‌ی کاری' : 'سمت'), bind('role', h('input', { class: 'field', value: p.role || '' }))),
    !isCo ? h('div', null, h('label', null, 'شرکت'), personField(p.companyId, (v) => { p.companyId = v; save('people', p); }, { kind: 'company', title: 'انتخاب شرکت', placeholder: 'انتخاب شرکت' }))
      : h('div', null, h('label', null, 'وب‌سایت'), bind('website', h('input', { class: 'field ltr', value: p.website || '', placeholder: 'www…' }))),
    h('div', null, h('label', null, 'ایمیل'), h('div', { class: 'row gap' }, email, h('a', { class: 'icon-btn', title: 'ارسال ایمیل', html: ICON.mail, onclick: (e) => { if (!p.email) e.preventDefault(); else e.currentTarget.href = 'mailto:' + p.email; } }))),
    h('div', null, h('label', null, 'آدرس'), bind('address', h('input', { class: 'field', value: p.address || '' }))),
  );
  const note = bind('note', h('textarea', { class: 'field', rows: 3, placeholder: 'یادداشت تایپی…' }, p.note || ''));

  // دست‌نوشته
  p.ink ||= { strokes: [], objects: [] };
  const inkHost = h('div', { class: 'ink-box paper' });

  // کارها و توافقات مرتبط
  const tasksEl = taskList([], { hidePerson: true, showDate: true, cls: 'compact' });
  const dealsEl = h('div', { class: 'deal-list' });
  const membersEl = h('div', { class: 'members' });
  const refreshRel = () => {
    const ts = [...data.tasks.values()].filter((t) => t.personId === p.id).sort(sortTasks);
    fillTaskList(tasksEl, ts.filter((t) => !t.done).concat(ts.filter((t) => t.done).slice(0, 5)), { hidePerson: true, showDate: true, empty: 'کاری ثبت نشده' });
    dealsEl.innerHTML = '';
    const ds = [...data.agreements.values()].filter((a) => a.personId === p.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    for (const a of ds) dealsEl.append(h('a', { class: 'deal-mini', href: '#/agreements/' + a.id },
      h('span', { class: 'status-dot', style: { '--c': STATUS[a.status]?.color } }), h('span', { class: 'grow' }, a.subject || 'توافق'), h('small', { class: 'muted' }, a.date ? fmtShort(a.date) : '')));
    if (!ds.length) dealsEl.append(h('div', { class: 'empty small' }, 'توافقی ثبت نشده'));
    membersEl.innerHTML = '';
    if (isCo) {
      const ms = [...data.people.values()].filter((x) => x.companyId === p.id);
      for (const m of ms) membersEl.append(h('a', { class: 'chip person-chip', href: '#/people/' + m.id }, h('span', { class: 'mini-ava person' }, initials(m.name)), m.name, m.role ? h('small', null, ' · ' + m.role) : null));
      if (!ms.length) membersEl.append(h('span', { class: 'muted small' }, 'هنوز کسی به این شرکت وصل نشده. در کارت هر شخص، شرکت را انتخاب کنید.'));
    }
  };
  refreshRel();
  const offT = on('tasks', refreshRel);
  const offA = on('agreements', refreshRel);

  const body = h('div', { class: 'detail-body scroll-y' },
    head,
    h('div', { class: 'card' }, h('h4', null, 'تلفن‌ها'), phones),
    h('div', { class: 'card' }, fields),
    isCo ? h('div', { class: 'card' }, h('h4', null, 'افراد این شرکت'), membersEl) : null,
    h('div', { class: 'card' }, h('h4', null, 'یادداشت'), note, h('div', { class: 'small muted', style: { margin: '8px 0 4px' } }, 'یادداشت دست‌نویس'), inkHost),
    h('div', { class: 'two-col' },
      h('div', { class: 'card' }, h('h4', null, 'کارهای مرتبط'), tasksEl, addTaskBar({ due: null, personId: p.id, placeholder: 'کار جدید برای ' + (p.name || 'این شخص') + '…' })),
      h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h4', null, 'توافقات'), h('button', { class: 'btn small', onclick: () => newAgreement({ personId: p.id }) }, '+ توافق جدید')), dealsEl)),
  );
  root.append(body);
  const surf = new InkSurface(inkHost, { doc: p.ink, logicalWidth: 800, lineGap: 36, bg: 'lines', onChange: () => persist() });
  const cleanup = () => { persist.flush(); surf.destroy(); offT(); offA(); };
  return () => cleanup();
}
