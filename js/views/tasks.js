// بخش کارها: همه‌ی کارها با فیلتر
import { h, fa, ICON } from '../util.js';
import { data, on } from '../db.js';
import { todayKey, diffDays, relLabel, parseKey, keyOf } from '../jalali.js';
import { taskList, fillTaskList, addTaskBar, groupOpen, sortTasks, taskDialog } from '../tasks-common.js';

const FILTERS = [
  { id: 'open', label: 'همه‌ی کارهای باز' },
  { id: 'today', label: 'امروز' },
  { id: 'week', label: 'این هفته' },
  { id: 'late', label: 'عقب‌افتاده' },
  { id: 'nodate', label: 'بدون تاریخ' },
  { id: 'done', label: 'انجام‌شده' },
];
let current = 'open';

export function renderTasks(main) {
  const chips = h('div', { class: 'chips' });
  const list = taskList([], {});
  const count = h('span', { class: 'muted small' });
  const renderChips = () => {
    chips.innerHTML = '';
    const all = [...data.tasks.values()];
    const today = todayKey();
    const n = {
      open: all.filter((t) => !t.done).length,
      late: all.filter((t) => !t.done && t.due && t.due < today).length,
      today: all.filter((t) => !t.done && t.due === today).length,
    };
    for (const f of FILTERS) chips.append(h('button', { class: 'chip-btn' + (f.id === current ? ' on' : '') + (f.id === 'late' && n.late ? ' warn' : ''), onclick: () => { current = f.id; refresh(); } },
      f.label, n[f.id] ? h('span', { class: 'count' }, fa(n[f.id])) : null));
  };
  const refresh = () => {
    renderChips();
    const all = [...data.tasks.values()];
    const today = todayKey();
    const open = all.filter((t) => !t.done);
    let opts = { showDate: true, empty: 'کاری در این فهرست نیست 🎉' };
    let items = [];
    if (current === 'open') opts.groups = groupOpen(open);
    else if (current === 'today') items = open.filter((t) => t.due === today).sort(sortTasks);
    else if (current === 'late') items = open.filter((t) => t.due && t.due < today).sort((a, b) => a.due.localeCompare(b.due));
    else if (current === 'nodate') items = open.filter((t) => !t.due).sort(sortTasks);
    else if (current === 'week') {
      const groups = [];
      const late = open.filter((t) => t.due && t.due < today);
      if (late.length) groups.push({ title: 'عقب‌افتاده', items: late.sort((a, b) => a.due.localeCompare(b.due)) });
      for (let i = 0; i < 7; i++) {
        const d = new Date(parseKey(today)); d.setDate(d.getDate() + i);
        const k = keyOf(d);
        groups.push({ title: relLabel(k) + (i > 1 ? '' : ''), items: all.filter((t) => t.due === k).sort(sortTasks) });
      }
      opts.groups = groups;
    } else if (current === 'done') {
      const done = all.filter((t) => t.done).sort((a, b) => (b.doneDay || '').localeCompare(a.doneDay || '') || b.updatedAt - a.updatedAt);
      const byDay = new Map();
      for (const t of done.slice(0, 300)) { const k = t.doneDay || 'x'; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(t); }
      opts.groups = [...byDay].map(([k, items]) => ({ title: k === 'x' ? 'نامشخص' : 'انجام‌شده در ' + relLabel(k), items }));
    }
    fillTaskList(list, items, opts);
    count.textContent = '';
  };
  refresh();
  const off = on('tasks', refresh);
  const offP = on('people', refresh);
  const dueFor = () => (current === 'nodate' ? null : todayKey());
  main.append(h('div', { class: 'view tasks-view' },
    h('div', { class: 'view-head' }, h('h2', null, 'کارها'), count,
      h('button', { class: 'btn primary small', onclick: () => taskDialog(null) }, h('span', { html: ICON.plus }), 'کار با جزئیات')),
    chips,
    addTaskBar({ due: dueFor }),
    h('p', { class: 'hint' }, 'برای تمام کردن یک کار، می‌توانید با قلم روی آن خط بکشید.'),
    list));
  return () => { off(); offP(); };
}
