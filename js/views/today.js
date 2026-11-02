// صفحه‌ی روزانه: کارهای روز (راست) + صفحه‌ی دست‌نویس (چپ)
import { h, ICON, fa, debounce } from '../util.js';
import { data, save, on } from '../db.js';
import { todayKey, addDays, fmtLong, jOf, MONTHS, diffDays, relLabel } from '../jalali.js';
import { InkSurface } from '../ink.js';
import { taskList, fillTaskList, addTaskBar, sortTasks } from '../tasks-common.js';
import { pickDate, personName } from '../pickers.js';

export function renderToday(main, [key]) {
  const today = todayKey();
  key ||= today;
  const go = (k) => location.replace('#/today/' + k);
  const isToday = key === today;

  const tasksFor = () => [...data.tasks.values()].filter((t) =>
    t.due === key ||
    (isToday && t.due && t.due < key && (!t.done || t.doneDay === key))).sort(sortTasks);

  const marks = (k) => data.days.get(k)?.ink?.strokes?.length || [...data.tasks.values()].some((t) => t.due === k);

  const j = jOf(key);
  const head = h('div', { class: 'day-head' },
    h('button', { class: 'icon-btn', title: 'روز قبل', html: ICON.prev, onclick: () => go(addDays(key, -1)) }),
    h('button', { class: 'day-title', onclick: async () => { const k = await pickDate(key, { allowClear: false, marks }); if (k) go(k); } },
      h('span', { class: 'day-num' }, fa(j.jd)),
      h('span', { class: 'day-txt' }, h('strong', null, fmtLong(key).split(' ')[0]), h('small', null, `${MONTHS[j.jm - 1]} ${fa(j.jy)}`))),
    h('button', { class: 'icon-btn', title: 'روز بعد', html: ICON.next, onclick: () => go(addDays(key, 1)) }),
    !isToday ? h('button', { class: 'btn small today-btn', onclick: () => go(today) }, 'امروز') : h('span', { class: 'today-tag' }, 'امروز'),
  );

  const counter = h('div', { class: 'day-count muted small' });
  const list = taskList([], { empty: 'برای این روز کاری ثبت نشده' });
  const dealsBox = h('div', { class: 'day-deals' });
  const refresh = () => {
    const ts = tasksFor();
    fillTaskList(list, ts, { empty: 'برای این روز کاری ثبت نشده' });
    const open = ts.filter((t) => !t.done).length;
    counter.textContent = ts.length ? `${fa(open)} کار باقی‌مانده از ${fa(ts.length)}` : '';
    dealsBox.innerHTML = '';
    const deals = [...data.agreements.values()].filter((a) => a.status === 'open' && a.deadline && (a.deadline === key || (isToday && a.deadline < key)));
    if (deals.length) {
      dealsBox.append(h('div', { class: 'group-head' }, 'مهلت توافقات'));
      for (const a of deals) dealsBox.append(h('a', { class: 'deal-mini' + (a.deadline < today ? ' late' : ''), href: '#/agreements/' + a.id },
        h('span', { html: ICON.deal }), h('span', null, a.subject || 'توافق', a.personId ? h('small', null, ' · ' + personName(a.personId)) : null),
        a.deadline < today ? h('span', { class: 'badge late' }, relLabel(a.deadline)) : null));
    }
  };
  refresh();
  const offT = on('tasks', refresh);
  const offA = on('agreements', refresh);
  const offP = on('people', refresh);

  const right = h('section', { class: 'pane day-tasks' }, head, counter, dealsBox, list, addTaskBar({ due: key }));

  // صفحه‌ی دست‌نویس روز
  const day = data.days.get(key) || { id: key, ink: { strokes: [], objects: [] } };
  const persist = debounce(() => { if (day.ink.strokes.length || data.days.has(key)) save('days', day, { silent: true }); }, 500);
  const inkHost = h('div', { class: 'ink-host' });
  const left = h('section', { class: 'pane day-ink paper' },
    h('div', { class: 'paper-head' }, h('span', null, 'یادداشت‌های روز'), h('small', { class: 'muted' }, diffDays(today, key) === 0 ? '' : relLabel(key))),
    inkHost);
  const root = h('div', { class: 'view today' }, right, left);
  main.append(root);
  const surf = new InkSurface(inkHost, {
    doc: day.ink, logicalWidth: 640, lineGap: 38, bg: 'lines',
    onChange: persist,
    onSwipe: (dir) => go(addDays(key, dir === 'right' ? 1 : -1)),
  });

  // کشیدن انگشت روی بخش کارها برای تغییر روز
  let sw = null;
  head.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') sw = { x: e.clientX, y: e.clientY }; });
  head.addEventListener('pointerup', (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(addDays(key, dx > 0 ? 1 : -1));
  });

  return () => { persist.flush(); surf.destroy(); offT(); offA(); offP(); };
}
