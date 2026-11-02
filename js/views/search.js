// جستجوی سراسری
import { h, ICON, norm, modal, fmtMoney } from '../util.js';
import { data } from '../db.js';
import { relLabel, fmtShort } from '../jalali.js';
import { personName } from '../pickers.js';
import { noteText } from './notes.js';
import { taskRow } from '../tasks-common.js';

export function openSearch() {
  const inp = h('input', { class: 'field big', type: 'search', placeholder: 'جستجو در کارها، اشخاص، توافقات و یادداشت‌ها…' });
  const res = h('div', { class: 'search-res' });
  const go = (hash) => { m.close(); location.hash = hash; };
  const render = () => {
    const q = norm(inp.value);
    res.innerHTML = '';
    if (!q) { res.append(h('p', { class: 'muted pad' }, 'چیزی بنویسید…')); return; }
    const sec = (title, items) => { if (items.length) res.append(h('h4', { class: 'res-head' }, title), ...items); };
    const tasks = [...data.tasks.values()].filter((t) => norm([t.title, t.note, personName(t.personId)].join(' ')).includes(q)).slice(0, 20);
    sec('کارها', tasks.map((t) => { const r = taskRow(t, { showDate: true }); r.querySelector('.t-body').addEventListener('click', () => m.close(), { capture: true }); return r; }));
    const people = [...data.people.values()].filter((p) => norm([p.name, p.role, p.email, p.address, p.note, ...(p.phones || []).map((x) => x.num)].join(' ')).includes(q)).slice(0, 20);
    sec('اشخاص', people.map((p) => h('button', { class: 'res-item', onclick: () => go('#/people/' + p.id) }, h('span', { html: p.kind === 'company' ? ICON.building : ICON.user }), h('span', null, p.name, p.role ? h('small', null, ' · ' + p.role) : null))));
    const deals = [...data.agreements.values()].filter((a) => norm([a.subject, a.desc, personName(a.personId), a.amount].join(' ')).includes(q)).slice(0, 20);
    sec('توافقات', deals.map((a) => h('button', { class: 'res-item', onclick: () => go('#/agreements/' + a.id) }, h('span', { html: ICON.deal }),
      h('span', null, a.subject || 'توافق', h('small', null, ' · ' + [personName(a.personId), a.date ? fmtShort(a.date) : '', a.amount ? fmtMoney(a.amount) : ''].filter(Boolean).join(' · '))))));
    const notes = [...data.notes.values()].filter((n) => norm(noteText(n)).includes(q)).slice(0, 20);
    sec('یادداشت‌ها', notes.map((n) => h('button', { class: 'res-item', onclick: () => go('#/notes/' + n.id) }, h('span', { html: ICON.notes }), h('span', null, n.title || 'بدون عنوان', h('small', null, ' · ' + relLabel(new Date(n.updatedAt).toISOString().slice(0, 10)))))));
    if (!res.children.length) res.append(h('p', { class: 'muted pad' }, 'نتیجه‌ای پیدا نشد'));
  };
  inp.addEventListener('input', render);
  const m = modal({ title: 'جستجو', cls: 'modal-search', body: h('div', null, inp, res) });
  render();
  setTimeout(() => inp.focus(), 60);
}
