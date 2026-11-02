// راه‌اندازی اپ: مسیرها، منوی کناری، نوار ابزار قلم، یادآوری‌ها
import { h, ICON, toast } from './util.js';
import { loadAll, data, save, settings } from './db.js';
import { tool, setTool, onTool, getActive, onActive, PEN_COLORS, HL_COLORS, PEN_WIDTHS, HL_WIDTHS } from './ink.js';
import { applyTheme, lockNow } from './lock.js';
import { renderToday } from './views/today.js';
import { renderTasks } from './views/tasks.js';
import { renderPeople } from './views/people.js';
import { renderAgreements } from './views/agreements.js';
import { renderNotes, insertText, insertTable } from './views/notes.js';
import { renderSettings } from './views/settings.js';
import { openSearch } from './views/search.js';
import { todayKey } from './jalali.js';

const routes = { today: renderToday, tasks: renderTasks, people: renderPeople, agreements: renderAgreements, notes: renderNotes, settings: renderSettings };
const NAV = [
  ['today', 'امروز', ICON.today],
  ['tasks', 'کارها', ICON.tasks],
  ['people', 'اشخاص', ICON.people],
  ['agreements', 'توافقات', ICON.deal],
  ['notes', 'یادداشت', ICON.notes],
];

let main, rail, toolbar, cleanup = () => {};

function route() {
  const parts = (location.hash || '#/today').replace(/^#\/?/, '').split('/');
  const name = routes[parts[0]] ? parts[0] : 'today';
  try { cleanup(); } catch (e) { console.error(e); }
  main.innerHTML = '';
  document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  try { cleanup = routes[name](main, parts.slice(1)) || (() => {}); }
  catch (e) { console.error(e); main.append(h('div', { class: 'empty big' }, 'خطا در نمایش این بخش: ' + e.message)); cleanup = () => {}; }
  for (const b of rail.querySelectorAll('[data-route]')) b.classList.toggle('on', b.dataset.route === name);
  renderToolbar();
}

function buildRail() {
  rail = h('nav', { id: 'rail' },
    h('button', { class: 'rail-btn search', title: 'جستجو', onclick: openSearch }, h('span', { html: ICON.search })),
    h('div', { class: 'rail-nav' }, NAV.map(([r, label, icon]) =>
      h('a', { class: 'rail-btn', href: '#/' + r + (r === 'today' ? '/' + todayKey() : ''), dataset: { route: r } }, h('span', { html: icon }), h('small', null, label)))),
    h('a', { class: 'rail-btn', href: '#/settings', dataset: { route: 'settings' }, title: 'تنظیمات' }, h('span', { html: ICON.settings })));
  const badge = h('i', { class: 'rail-badge', hidden: true });
  rail.querySelector('[data-route=tasks]').append(badge);
  const upd = () => {
    const t = todayKey();
    const n = [...data.tasks.values()].filter((x) => !x.done && x.due && x.due <= t).length;
    badge.hidden = !n; badge.textContent = n > 99 ? '+' : new Intl.NumberFormat('fa').format(n);
  };
  upd();
  import('./db.js').then((m) => m.on('tasks', upd));
  return rail;
}

// ---------- نوار ابزار قلم ----------
let pop = null;
function closePop() { pop?.remove(); pop = null; }
function renderToolbar() {
  closePop();
  const s = getActive();
  const show = s && main.contains(s.wrap);
  document.body.classList.toggle('has-tools', !!show);
  toolbar.innerHTML = '';
  if (!show) return;
  const tb = (name, icon, label, extra) => {
    const b = h('button', { class: 'tool' + (tool.name === name ? ' on' : ''), title: label, onclick: () => {
      if (tool.name === name && (name === 'pen' || name === 'hl')) openPop(name, b);
      else { setTool({ name }); }
    } }, h('span', { html: icon }), extra);
    return b;
  };
  const colorBar = (c) => h('i', { class: 'tool-color', style: { background: c === 'k' ? 'var(--ink)' : c } });
  toolbar.append(
    tb('pen', ICON.pen, 'قلم (دوباره بزنید: رنگ و ضخامت)', colorBar(tool.pen.c)),
    tb('hl', ICON.hl, 'ماژیک (دوباره بزنید: رنگ)', colorBar(tool.hl.c)),
    tb('eraser', ICON.eraser, 'پاک‌کن'),
    tb('lasso', ICON.lasso, 'انتخاب (کمند)'),
    h('button', { class: 'tool' + (tool.shape ? ' on' : ''), title: 'تبدیل خودکار به شکل', onclick: () => setTool({ shape: !tool.shape }) }, h('span', { html: ICON.shape })),
    h('hr'),
    h('button', { class: 'tool', title: 'برگرداندن', disabled: !s.undoStack.length, onclick: () => s.undo() }, h('span', { html: ICON.undo })),
    h('button', { class: 'tool', title: 'انجام دوباره', disabled: !s.redoStack.length, onclick: () => s.redo() }, h('span', { html: ICON.redo })),
  );
  if (s.opts.objects) {
    toolbar.append(h('hr'),
      h('button', { class: 'tool', title: 'افزودن متن تایپی', onclick: () => insertText(s) }, h('span', { html: ICON.text })),
      h('button', { class: 'tool', title: 'افزودن جدول', onclick: () => insertTable(s) }, h('span', { html: ICON.table })));
  }
}
function openPop(kind, anchor) {
  closePop();
  const cfg = kind === 'pen' ? tool.pen : tool.hl;
  const colors = kind === 'pen' ? PEN_COLORS : HL_COLORS;
  const widths = kind === 'pen' ? PEN_WIDTHS : HL_WIDTHS;
  pop = h('div', { class: 'tool-pop' },
    h('div', { class: 'pop-colors' }, colors.map((c) => h('button', { class: 'swatch' + (cfg.c === c ? ' on' : ''), style: { background: c === 'k' ? 'var(--ink)' : c, opacity: kind === 'hl' ? 0.7 : 1 },
      onclick: () => { setTool({ [kind]: { ...cfg, c } }); closePop(); } }))),
    h('div', { class: 'pop-widths' }, widths.map((w) => h('button', { class: 'wbtn' + (cfg.w === w ? ' on' : ''), onclick: () => { setTool({ [kind]: { ...cfg, w } }); closePop(); } },
      h('i', { style: { height: Math.min(w, 22) * (kind === 'pen' ? 1.4 : 0.8) + 'px', background: cfg.c === 'k' ? 'var(--ink)' : cfg.c, opacity: kind === 'hl' ? 0.6 : 1 } })))));
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.top) + 'px';
  pop.style.left = r.right + 8 + 'px';
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!pop?.contains(e.target)) { closePop(); } document.removeEventListener('pointerdown', off, true); }, true), 0);
}

// ---------- یادآوری‌ها ----------
async function notify(title, body, tag) {
  toast('🔔 ' + title + (body ? ' — ' + body : ''), 6000);
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', lang: 'fa', dir: 'rtl' });
      else new Notification(title, { body, tag });
    }
  } catch {}
}
function checkReminders() {
  const now = Date.now();
  for (const t of data.tasks.values()) {
    if (t.remind && !t.reminded && !t.done && t.remind <= now) { t.reminded = true; save('tasks', t, { silent: true }); notify('یادآوری کار', t.title || 'کار دست‌نویس', 't' + t.id); }
  }
  for (const a of data.agreements.values()) {
    if (a.remind && !a.reminded && a.status === 'open' && a.remind <= now) { a.reminded = true; save('agreements', a, { silent: true }); notify('پیگیری توافق', a.subject || '', 'a' + a.id); }
  }
}

// ---------- شروع ----------
async function boot() {
  await loadAll();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  main = h('main', { id: 'main' });
  toolbar = h('aside', { id: 'toolbar' });
  const app = h('div', { id: 'app' }, buildRail(), main, toolbar);
  document.getElementById('splash')?.remove();
  document.body.append(app,
    h('div', { id: 'rotate' }, h('div', null, h('div', { class: 'rot-ico' }, '⟲'), h('p', null, 'برای نوشتن راحت‌تر، گوشی را افقی بگیرید'),
      h('button', { class: 'btn primary', onclick: goFullscreen }, 'تمام‌صفحه و افقی'))));
  onTool(renderToolbar);
  onActive(renderToolbar);
  window.addEventListener('hashchange', route);
  if (!location.hash) history.replaceState(null, '', '#/today/' + todayKey());
  route();
  await lockNow();
  checkReminders();
  setInterval(checkReminders, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); } });
  // تغییر روز در نیمه‌شب
  let day = todayKey();
  setInterval(() => { if (todayKey() !== day) { day = todayKey(); if (location.hash.startsWith('#/today') || location.hash.startsWith('#/tasks')) route(); } }, 60000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  document.addEventListener('pointerdown', tryLock, { once: true });
}
function tryLock() {
  if (matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) screen.orientation?.lock?.('landscape').catch(() => {});
}
async function goFullscreen() {
  try { await document.documentElement.requestFullscreen(); await screen.orientation.lock('landscape'); } catch { toast('گوشی را بچرخانید'); }
}

boot().catch((e) => { console.error(e); document.body.append(h('pre', { class: 'fatal' }, 'خطا در راه‌اندازی: ' + e.message)); });
