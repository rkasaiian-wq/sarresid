// موتور نوشتن با قلم: صفحه‌ی دست‌نویس، پاک‌کن، کمند، تشخیص شکل، خط‌زدن کارها
import { h, uid, ICON } from './util.js';

// ---------- وضعیت ابزار (سراسری) ----------
export const PEN_COLORS = ['k', '#1f4fb8', '#c62828', '#1b7a3d', '#7b3fb5', '#d4600f'];
export const HL_COLORS = ['#f5c400', '#5ad17a', '#f27ab0', '#62a8f5'];
export const PEN_WIDTHS = [1.6, 2.6, 4.2];
export const HL_WIDTHS = [12, 20, 30];
export const tool = { name: 'pen', pen: { c: 'k', w: 2.6 }, hl: { c: '#f5c400', w: 20 }, shape: false, finger: false };
const toolSubs = new Set();
export const onTool = (f) => (toolSubs.add(f), () => toolSubs.delete(f));
export function setTool(patch) { Object.assign(tool, patch); toolSubs.forEach((f) => f(tool)); }
try { const saved = JSON.parse(localStorage.getItem('sarresid.tool') || 'null'); if (saved) Object.assign(tool, saved, { name: saved.name === 'lasso' ? 'pen' : saved.name }); } catch {}
onTool(() => { try { localStorage.setItem('sarresid.tool', JSON.stringify(tool)); } catch {} });

let active = null;
const activeSubs = new Set();
export const getActive = () => active;
export const onActive = (f) => (activeSubs.add(f), () => activeSubs.delete(f));
function setActive(s) { if (active !== s) { active = s; activeSubs.forEach((f) => f(s)); } }

// دکمه‌ی کنار قلم: Samsung/Chrome آن را به شکل‌های مختلف گزارش می‌کند
let barrelAt = 0;
export const isBarrel = (e) => e.pointerType === 'pen' && (((e.buttons & 2) || (e.buttons & 32)) || e.button === 2 || e.button === 5);
window.addEventListener('pointermove', (e) => { if (isBarrel(e)) barrelAt = performance.now(); }, { capture: true, passive: true });
window.addEventListener('pointerdown', (e) => { if (isBarrel(e)) barrelAt = performance.now(); }, { capture: true, passive: true });
const barrelRecently = () => performance.now() - barrelAt < 250;

export const inkColor = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1d2433';

// ---------- هندسه و رسم خط ----------
const bbCache = new WeakMap();
const pathCache = new WeakMap();
export function bbox(s) {
  let b = bbCache.get(s);
  if (b) return b;
  const p = s.p;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
    if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
  }
  const m = s.w / 2 + 1;
  b = { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
  bbCache.set(s, b);
  return b;
}
const wOf = (s, pr) => s.w * (0.42 + 0.9 * pr);
const Q = (w) => Math.round(w * 5) / 5;

function buildPaths(s) {
  let c = pathCache.get(s);
  if (c) return c;
  const p = s.p, n = p.length / 3;
  c = [];
  const X = (i) => p[i * 3], Y = (i) => p[i * 3 + 1];
  if (s.t === 'h' || s.sh || n < 3) {
    const path = new Path2D();
    path.moveTo(X(0), Y(0));
    if (s.sh || n < 3) for (let i = 1; i < n; i++) path.lineTo(X(i), Y(i));
    else {
      for (let i = 1; i < n - 1; i++) path.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
      path.lineTo(X(n - 1), Y(n - 1));
    }
    c.push({ w: s.t === 'h' ? s.w : wOf(s, s.sh ? 0.5 : avgP(p)), path });
  } else {
    let cur = null, cw = -1;
    for (let k = 0; k < n; k++) {
      const w = Q(wOf(s, p[k * 3 + 2]));
      if (w !== cw || !cur) {
        cur = new Path2D(); cw = w; c.push({ w, path: cur });
        if (k === 0) cur.moveTo(X(0), Y(0)); else cur.moveTo((X(k - 1) + X(k)) / 2, (Y(k - 1) + Y(k)) / 2);
      }
      if (k === 0) cur.lineTo((X(0) + X(1)) / 2, (Y(0) + Y(1)) / 2);
      else if (k === n - 1) cur.lineTo(X(k), Y(k));
      else cur.quadraticCurveTo(X(k), Y(k), (X(k) + X(k + 1)) / 2, (Y(k) + Y(k + 1)) / 2);
    }
  }
  pathCache.set(s, c);
  return c;
}
function avgP(p) { let t = 0, n = 0; for (let i = 2; i < p.length; i += 3) { t += p[i]; n++; } return n ? t / n : 0.5; }
function invalidate(s) { bbCache.delete(s); pathCache.delete(s); }

export function drawStroke(ctx, s, ink) {
  const p = s.p, n = p.length / 3;
  if (!n) return;
  const col = s.c === 'k' ? ink : s.c;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col; ctx.fillStyle = col;
  if (n === 1) {
    ctx.beginPath(); ctx.arc(p[0], p[1], wOf(s, p[2]) / 2 + 0.4, 0, 7); ctx.fill(); return;
  }
  const paths = buildPaths(s);
  if (s.t === 'h') { ctx.save(); ctx.globalAlpha = 0.38; }
  for (const g of paths) { ctx.lineWidth = g.w; ctx.stroke(g.path); }
  if (s.t === 'h') ctx.restore();
}

// پیش‌نمایش SVG از دست‌نوشته (برای فهرست‌ها)
export function strokesSVG(strokes, { height = 28, maxWidth = 600, pad = 4 } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = document.createElementNS(NS, 'svg');
  el.classList.add('ink-svg');
  if (!strokes?.length) return el;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) { const b = bbox(s); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = x1 - x0, hh = y1 - y0;
  const scale = Math.min(height / hh, maxWidth / w);
  el.setAttribute('viewBox', `${x0} ${y0} ${w} ${hh}`);
  el.setAttribute('width', Math.round(w * scale));
  el.setAttribute('height', Math.round(hh * scale));
  for (const s of strokes) {
    const p = s.p, n = p.length / 3;
    const path = document.createElementNS(NS, 'path');
    let d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    if (n === 1) d += `l0.1 0`;
    for (let i = 1; i < n; i++) d += `L${p[i * 3].toFixed(1)} ${p[i * 3 + 1].toFixed(1)}`;
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', s.c === 'k' ? 'currentColor' : s.c);
    path.setAttribute('stroke-width', s.t === 'h' ? s.w : wOf(s, s.sh ? 0.5 : avgP(p)));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    if (s.t === 'h') path.setAttribute('opacity', '0.38');
    el.append(path);
  }
  return el;
}

// ---------- تشخیص شکل ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  if (!L) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function rdp(P, eps) {
  if (P.length < 3) return P.slice();
  let dmax = 0, idx = 0;
  const a = P[0], b = P[P.length - 1];
  for (let i = 1; i < P.length - 1; i++) { const d = distToSeg(P[i], a, b); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax > eps) { const l = rdp(P.slice(0, idx + 1), eps), r = rdp(P.slice(idx), eps); return l.slice(0, -1).concat(r); }
  return [a, b];
}
function angleAt(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!d) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180) / Math.PI;
}
function snapLine(a, b) {
  const L = dist(a, b);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const step = Math.PI / 4;
  const sn = Math.round(ang / step) * step;
  if (Math.abs(ang - sn) < (8 * Math.PI) / 180) return [a, { x: a.x + L * Math.cos(sn), y: a.y + L * Math.sin(sn) }];
  return [a, b];
}
const flat = (pts) => pts.flatMap((q) => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, 0.5]);

export function recognize(fp) {
  const P = [];
  for (let i = 0; i < fp.length; i += 3) P.push({ x: fp[i], y: fp[i + 1] });
  const n = P.length;
  if (n < 4) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of P) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  const w = x1 - x0, hh = y1 - y0, size = Math.max(w, hh);
  if (size < 12) return null;
  let len = 0;
  for (let i = 1; i < n; i++) len += dist(P[i - 1], P[i]);
  const closed = dist(P[0], P[n - 1]) < Math.max(18, len * 0.18) && len > size * 2.2;
  if (!closed) {
    const simp = rdp(P, Math.max(4, size * 0.07));
    if (simp.length === 2) return flat(snapLine(P[0], P[n - 1]));
    if (simp.length <= 5) return flat(simp);
    return null;
  }
  // شکل بسته
  let poly = rdp(P, size * 0.1);
  if (dist(poly[0], poly[poly.length - 1]) < size * 0.2) poly = poly.slice(0, -1);
  let changed = true;
  while (changed && poly.length > 3) {
    changed = false;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[(i - 1 + poly.length) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
      if (angleAt(a, b, c) > 150 || dist(a, b) < size * 0.08) { poly.splice(i, 1); changed = true; break; }
    }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ra = w / 2 || 1, rb = hh / 2 || 1;
  let err = 0;
  for (const q of P) err += Math.abs(Math.hypot((q.x - cx) / ra, (q.y - cy) / rb) - 1);
  err /= n;
  if (poly.length === 3 && err > 0.1) return flat([...poly, poly[0]]);
  if (poly.length === 4 && err > 0.09) {
    let axis = true;
    for (let i = 0; i < 4; i++) {
      const a = poly[i], b = poly[(i + 1) % 4];
      const ang = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 90;
      if (ang > 14 && ang < 76) axis = false;
    }
    if (axis) return flat([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }]);
    return flat([...poly, poly[0]]);
  }
  if (err < 0.2) {
    const pts = [];
    for (let i = 0; i <= 72; i++) { const t = (i / 72) * Math.PI * 2; pts.push({ x: cx + ra * Math.cos(t), y: cy + rb * Math.sin(t) }); }
    return flat(pts);
  }
  return null;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- صفحه‌ی دست‌نویس ----------
export class InkSurface {
  constructor(host, opts) {
    this.opts = Object.assign({ logicalWidth: 1000, bg: 'lines', lineGap: 36, scroll: true, objects: false }, opts);
    this.doc = opts.doc;
    this.doc.strokes ||= [];
    this.doc.objects ||= [];
    this.sy = 0; this.s = 1; this.dpr = 1;
    this.undoStack = []; this.redoStack = [];
    this.ptr = null; this.sel = null; this.activeObj = null;

    this.wrap = h('div', { class: 'ink-wrap' + (this.opts.cls ? ' ' + this.opts.cls : '') });
    this.content = h('div', { class: 'ink-content bg-' + this.opts.bg, style: { width: this.opts.logicalWidth + 'px', '--gap': this.opts.lineGap + 'px' } });
    this.objLayer = h('div', { class: 'ink-objs' });
    this.content.append(this.objLayer);
    this.base = h('canvas', { class: 'ink-base' });
    this.live = h('canvas', { class: 'ink-live' });
    this.selMenu = h('div', { class: 'ink-selmenu', hidden: true });
    this.sbar = h('div', { class: 'ink-sbar', hidden: true });
    this.wrap.append(this.content, this.base, this.live, this.selMenu, this.sbar);
    host.append(this.wrap);
    this.bctx = this.base.getContext('2d');
    this.lctx = this.live.getContext('2d');

    this._down = (e) => this.onDown(e);
    this._move = (e) => this.onMove(e);
    this._up = (e) => this.onUp(e, false);
    this._cancel = (e) => this.onUp(e, true);
    this.wrap.addEventListener('pointerdown', this._down);
    this.wrap.addEventListener('pointermove', this._move);
    this.wrap.addEventListener('pointerup', this._up);
    this.wrap.addEventListener('pointercancel', this._cancel);
    this.wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    this.wrap.addEventListener('wheel', (e) => {
      if (!this.opts.scroll) return;
      e.preventDefault();
      this.setScroll(this.sy + e.deltaY / this.s);
    }, { passive: false });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.wrap);
    this._unTheme = matchMedia('(prefers-color-scheme: dark)');
    this._themeCb = () => this.redraw();
    this._unTheme.addEventListener('change', this._themeCb);
    window.addEventListener('themechange', this._themeCb);
    this.renderObjects();
    this.resize();
    setActive(this);
  }

  destroy() {
    this.ro.disconnect();
    this._unTheme.removeEventListener('change', this._themeCb);
    window.removeEventListener('themechange', this._themeCb);
    cancelAnimationFrame(this._inertia);
    this.wrap.remove();
    if (active === this) setActive(null);
  }
  activate() { setActive(this); }

  // ---- اندازه و پیمایش ----
  resize() {
    const w = this.wrap.clientWidth, hh = this.wrap.clientHeight;
    if (!w || !hh) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.s = w / this.opts.logicalWidth;
    this.cw = w; this.ch = hh;
    this.viewH = hh / this.s;
    for (const c of [this.base, this.live]) {
      c.width = Math.round(w * this.dpr); c.height = Math.round(hh * this.dpr);
      c.style.width = w + 'px'; c.style.height = hh + 'px';
    }
    this.updateHeight();
    this.setScroll(this.sy, true);
  }
  contentBottom() {
    if (this._bottom != null) return this._bottom;
    let b = 0;
    for (const s of this.doc.strokes) b = Math.max(b, bbox(s).y1);
    for (const el of this.objLayer.children) b = Math.max(b, el.offsetTop + el.offsetHeight);
    return (this._bottom = b);
  }
  maxScroll() { return this.opts.scroll ? Math.max(0, this.viewH * ((this.opts.minPages || 1) - 1), this.contentBottom() - this.viewH * 0.45) : 0; }
  setLineGap(g) { this.opts.lineGap = g; this.content.style.setProperty('--gap', g + 'px'); this.updateHeight(); }
  updateBar() {
    const ms = this.maxScroll();
    if (!ms) { this.sbar.hidden = true; return; }
    const tot = ms + this.viewH;
    this.sbar.hidden = false;
    this.sbar.style.height = Math.max(24, (this.viewH / tot) * this.ch) + 'px';
    this.sbar.style.top = (this.sy / tot) * this.ch + 'px';
  }
  updateHeight() { this.content.style.height = Math.ceil(this.maxScroll() + this.viewH + this.opts.lineGap * 2) + 'px'; if (this.sbar) this.updateBar(); }
  setScroll(y, force) {
    const ny = Math.max(0, Math.min(this.maxScroll(), y));
    if (ny === this.sy && !force) return;
    this.sy = ny;
    this.content.style.transform = `translate3d(0, ${-ny * this.s}px, 0) scale(${this.s})`;
    this.updateBar();
    this.redraw();
    if (this.sel) this.showSel();
  }
  reveal(el) {
    const r = el.getBoundingClientRect(), w = this.wrap.getBoundingClientRect();
    if (r.bottom > w.bottom - 10) this.setScroll(this.sy + (r.bottom - w.bottom + 40) / this.s);
    else if (r.top < w.top) this.setScroll(this.sy - (w.top - r.top + 20) / this.s);
  }
  redraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.paint(); });
  }
  paint() {
    const c = this.bctx, k = this.dpr * this.s;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.base.width, this.base.height);
    c.setTransform(k, 0, 0, k, 0, -this.sy * k);
    const top = this.sy, bot = this.sy + this.viewH, ink = inkColor();
    for (const s of this.doc.strokes) {
      const b = bbox(s);
      if (b.y1 < top || b.y0 > bot) continue;
      drawStroke(c, s, ink);
    }
  }
  liveCtx() {
    const c = this.lctx, k = this.dpr * this.s;
    c.setTransform(k, 0, 0, k, 0, -this.sy * k);
    return c;
  }
  clearLive() {
    const c = this.lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.live.width, this.live.height);
  }
  toLogical(e) {
    const r = this.wrap.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.s, y: (e.clientY - r.top) / this.s + this.sy };
  }
  elementBelow(x, y) {
    this.base.style.pointerEvents = this.live.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y);
    this.base.style.pointerEvents = this.live.style.pointerEvents = '';
    return el && this.content.contains(el) ? el : null;
  }

  // ---- تاریخچه ----
  snapshot() {
    this.undoStack.push({ strokes: this.doc.strokes.slice(), objects: JSON.stringify(this.doc.objects) });
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
  }
  restore(st) {
    this.doc.strokes.splice(0, this.doc.strokes.length, ...st.strokes);
    this.doc.objects.splice(0, this.doc.objects.length, ...JSON.parse(st.objects));
    this.renderObjects();
    this.changed();
  }
  current() { return { strokes: this.doc.strokes.slice(), objects: JSON.stringify(this.doc.objects) }; }
  undo() { if (!this.undoStack.length) return; this.clearSel(); this.redoStack.push(this.current()); this.restore(this.undoStack.pop()); }
  redo() { if (!this.redoStack.length) return; this.clearSel(); this.undoStack.push(this.current()); this.restore(this.redoStack.pop()); }
  clearAll() { if (!this.doc.strokes.length) return; this.snapshot(); this.doc.strokes.length = 0; this.changed(); }

  changed() {
    this._bottom = null;
    this.updateHeight();
    this.redraw();
    this.opts.onChange?.(this.doc);
    activeSubs.forEach((f) => f(this));
  }

  // ---- اشیاء (متن، جدول، نمودار) ----
  renderObjects() {
    if (!this.opts.objects) return;
    const focused = document.activeElement && this.objLayer.contains(document.activeElement);
    if (focused) return; // در حال تایپ: بازسازی نکن
    this.objLayer.innerHTML = '';
    for (const o of this.doc.objects) this.objLayer.append(this.makeObj(o));
  }
  makeObj(o) {
    const el = this.opts.renderObject(o, this);
    el.classList.add('ink-obj');
    if (o.id === this.activeObj) el.classList.add('active');
    el.dataset.id = o.id;
    el.style.left = o.x + 'px'; el.style.top = o.y + 'px';
    if (o.w) el.style.width = o.w + 'px';
    return el;
  }
  refreshObj(id) {
    const o = this.doc.objects.find((x) => x.id === id);
    const old = this.objLayer.querySelector(`[data-id="${id}"]`);
    if (o && old) old.replaceWith(this.makeObj(o));
  }
  addObject(o) {
    this.snapshot();
    o.id ||= uid();
    o.x ??= Math.max(10, (this.opts.logicalWidth - (o.w || 400)) / 2);
    o.y ??= this.sy + 30;
    this.doc.objects.push(o);
    this.activeObj = o.id;
    this.objLayer.append(this.makeObj(o));
    this.changed();
    return o;
  }
  removeObject(id) {
    this.snapshot();
    const i = this.doc.objects.findIndex((x) => x.id === id);
    if (i >= 0) this.doc.objects.splice(i, 1);
    this.objLayer.querySelector(`[data-id="${id}"]`)?.remove();
    this.changed();
  }
  setActiveObj(id) {
    if (this.activeObj === id) return;
    this.activeObj = id;
    for (const el of this.objLayer.children) el.classList.toggle('active', el.dataset.id === id);
  }

  // ---- ورودی قلم/انگشت ----
  onDown(e) {
    if (e.target.closest('.ink-selmenu')) return;
    const type = e.pointerType;
    if (this.ptr) {
      // قلم بر کف دست اولویت دارد
      if (type === 'pen' && this.ptr.mode === 'pan') { this.ptr = null; }
      else return;
    }
    cancelAnimationFrame(this._inertia);
    setActive(this);
    e.preventDefault();
    const pt = this.toLogical(e);
    const under = this.elementBelow(e.clientX, e.clientY);
    const base = { id: e.pointerId, type, cx: e.clientX, cy: e.clientY, t: performance.now(), moved: false, under };
    const chromeBtn = under?.closest('.obj-chrome button, .obj-chrome select');
    if (chromeBtn) { this.ptr = { ...base, mode: 'btn', el: chromeBtn }; return; }
    const handle = under?.closest('.obj-handle');
    if (handle) {
      const id = handle.closest('.ink-obj').dataset.id;
      const o = this.doc.objects.find((x) => x.id === id);
      if (o) {
        this.snapshot();
        this.setActiveObj(id);
        this.ptr = { ...base, mode: 'obj', obj: o, start: pt, ox: o.x, oy: o.y, el: handle.closest('.ink-obj') };
        try { this.wrap.setPointerCapture(e.pointerId); } catch {}
        return;
      }
    }
    const fingerDraws = this.opts.fingerDraw ?? tool.finger;
    if (type === 'touch' && !fingerDraws) {
      this.ptr = { ...base, mode: 'pan', lastY: e.clientY, lastX: e.clientX, vy: 0, lt: base.t, axis: null };
      return;
    }
    if (type === 'mouse' && e.button !== 0) return;
    try { this.wrap.setPointerCapture(e.pointerId); } catch {}
    if (this.sel && pt.x >= this.sel.bb.x0 && pt.x <= this.sel.bb.x1 && pt.y >= this.sel.bb.y0 && pt.y <= this.sel.bb.y1) {
      this.beginMoveSel(base, pt);
      return;
    }
    if (this.sel) this.clearSel();
    const t = this.opts.forceTool || tool.name;
    const barrel = isBarrel(e) || (type === 'pen' && barrelRecently());
    if (barrel || t === 'eraser') {
      this.ptr = { ...base, mode: 'erase', last: pt, snap: false, removed: 0 };
      this.eraseSeg(pt, pt);
    } else if (t === 'lasso') {
      this.ptr = { ...base, mode: 'lasso', pts: [pt] };
    } else {
      const isHl = t === 'hl';
      const cfg = isHl ? tool.hl : tool.pen;
      const pr = type === 'pen' ? (e.pressure || 0.5) : 0.5;
      const s = { id: uid(), t: isHl ? 'h' : 'p', c: cfg.c, w: cfg.w, p: [r1(pt.x), r1(pt.y), r2(pr)] };
      this.ptr = { ...base, mode: 'draw', s, pr, anchor: pt, pending: type !== 'pen' };
      this.drawLive();
      this.armHold();
    }
  }

  onMove(e) {
    const P = this.ptr;
    if (!P || e.pointerId !== P.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const list = evs.length ? evs : [e];
    if (!P.moved && Math.hypot(e.clientX - P.cx, e.clientY - P.cy) > (P.type === 'pen' ? 3 : 8)) P.moved = true;
    switch (P.mode) {
      case 'pan': {
        const dx = e.clientX - P.cx, dy = e.clientY - P.cy;
        if (!P.axis && Math.hypot(dx, dy) > 12) P.axis = Math.abs(dx) > Math.abs(dy) * 1.3 && this.opts.onSwipe ? 'x' : 'y';
        if (P.axis !== 'x') {
          const now = performance.now();
          const d = e.clientY - P.lastY;
          this.setScroll(this.sy - d / this.s);
          const dt = Math.max(1, now - P.lt);
          P.vy = 0.8 * (d / dt) + 0.2 * P.vy;
          P.lt = now;
        }
        P.lastY = e.clientY; P.lastX = e.clientX;
        break;
      }
      case 'draw': {
        if (P.type === 'pen' && isBarrel(e) && !this.opts.forceTool) {
          // دکمه وسط نوشتن فشرده شد → پاک‌کن
          clearTimeout(this._hold);
          this.clearLive();
          Object.assign(P, { mode: 'erase', last: this.toLogical(e), snap: false, removed: 0 });
          break;
        }
        if (P.shaped) break;
        const s = P.s;
        for (const ev of list) {
          const pt = this.toLogical(ev);
          const n = s.p.length;
          if (Math.hypot(pt.x - s.p[n - 3], pt.y - s.p[n - 2]) < 0.9) continue;
          const raw = P.type === 'pen' ? (ev.pressure || P.pr) : 0.5;
          P.pr = P.pr * 0.55 + raw * 0.45;
          s.p.push(r1(pt.x), r1(pt.y), r2(P.pr));
          if (Math.hypot(pt.x - P.anchor.x, pt.y - P.anchor.y) > 3 / this.s) { P.anchor = pt; this.armHold(); }
        }
        this.drawLive();
        break;
      }
      case 'erase': {
        for (const ev of list) { const pt = this.toLogical(ev); this.eraseSeg(P.last, pt); P.last = pt; }
        this.drawEraser(P.last);
        break;
      }
      case 'lasso': {
        for (const ev of list) P.pts.push(this.toLogical(ev));
        this.drawLasso(P.pts);
        break;
      }
      case 'move': {
        const pt = this.toLogical(e);
        const dx = pt.x - P.last.x, dy = pt.y - P.last.y;
        P.last = pt;
        this.translateSel(dx, dy);
        break;
      }
      case 'obj': {
        const pt = this.toLogical(e);
        P.obj.x = Math.round(P.ox + pt.x - P.start.x);
        P.obj.y = Math.max(0, Math.round(P.oy + pt.y - P.start.y));
        P.el.style.left = P.obj.x + 'px'; P.el.style.top = P.obj.y + 'px';
        break;
      }
    }
  }

  onUp(e, cancelled) {
    const P = this.ptr;
    if (!P || e.pointerId !== P.id) return;
    this.ptr = null;
    clearTimeout(this._hold);
    switch (P.mode) {
      case 'pan': {
        if (!P.moved && !cancelled) { this.tapForward(e.clientX, e.clientY, P.under); break; }
        const dx = e.clientX - P.cx, dy = e.clientY - P.cy;
        if (P.axis === 'x' && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { this.opts.onSwipe(dx > 0 ? 'right' : 'left'); break; }
        if (Math.abs(P.vy) > 0.25 && performance.now() - P.lt < 80) this.inertia(P.vy);
        break;
      }
      case 'draw': {
        if (P.pending && !P.moved && P.under?.closest('[contenteditable="true"], input, textarea, button, select, a')) {
          this.clearLive();
          this.tapForward(e.clientX, e.clientY, P.under);
          break;
        }
        let s = P.s;
        if (!P.shaped && tool.shape && !this.opts.forceTool) {
          const r = recognize(s.p);
          if (r) s = { ...s, p: r, sh: 1 };
        }
        this.snapshot();
        this.doc.strokes.push(s);
        this.paintOne(s);
        this.clearLive();
        this.changed();
        break;
      }
      case 'erase': this.clearLive(); if (P.removed) this.changed(); break;
      case 'lasso': this.finishLasso(P.pts); break;
      case 'move': this.changed(); this.showSel(); break;
      case 'obj': this.changed(); break;
      case 'btn': if (!P.moved && !cancelled) { if (P.el.tagName === 'SELECT') { P.el.focus(); P.el.showPicker?.(); } else P.el.click(); } break;
    }
  }

  paintOne(s) {
    const c = this.bctx, k = this.dpr * this.s;
    c.setTransform(k, 0, 0, k, 0, -this.sy * k);
    drawStroke(c, s, inkColor());
  }

  inertia(v) {
    let vel = v, last = performance.now();
    const step = (now) => {
      const dt = now - last; last = now;
      this.setScroll(this.sy - (vel * dt) / this.s);
      vel *= Math.pow(0.94, dt / 16);
      if (Math.abs(vel) > 0.03 && this.sy > 0 && this.sy < this.maxScroll()) this._inertia = requestAnimationFrame(step);
    };
    this._inertia = requestAnimationFrame(step);
  }

  tapForward(x, y, under) {
    if (!under) { this.setActiveObj(null); if (document.activeElement && this.wrap.contains(document.activeElement)) document.activeElement.blur(); this.opts.onTap?.(); return; }
    under.dispatchEvent(new CustomEvent('inktap', { bubbles: true, detail: { x, y } }));
    const objEl = under.closest('.ink-obj');
    this.setActiveObj(objEl ? objEl.dataset.id : null);
    const btn = under.closest('button, a, input[type=checkbox]');
    if (btn) { btn.click(); return; }
    const sel = under.closest('select');
    if (sel) { sel.focus(); sel.showPicker?.(); return; }
    const ed = under.closest('[contenteditable="true"], input, textarea');
    if (ed) {
      ed.focus({ preventScroll: true });
      if (ed.isContentEditable && document.caretRangeFromPoint) {
        this.base.style.pointerEvents = this.live.style.pointerEvents = 'none';
        const r = document.caretRangeFromPoint(x, y);
        this.base.style.pointerEvents = this.live.style.pointerEvents = '';
        if (r && ed.contains(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      }
      setTimeout(() => this.reveal(ed), 400);
    }
  }

  // ---- رسم زنده ----
  drawLive() {
    const P = this.ptr, s = P.s;
    this.clearLive();
    const c = this.liveCtx();
    drawStroke(c, s, inkColor());
    invalidate(s);
  }
  armHold() {
    clearTimeout(this._hold);
    if (this.opts.forceTool) return;
    this._hold = setTimeout(() => {
      const P = this.ptr;
      if (!P || P.mode !== 'draw' || P.shaped || P.s.p.length < 15) return;
      const r = recognize(P.s.p);
      if (r) {
        P.s = { ...P.s, p: r, sh: 1 };
        P.shaped = true;
        this.drawLive();
        navigator.vibrate?.(12);
      }
    }, 550);
  }
  drawEraser(pt) {
    this.clearLive();
    const c = this.liveCtx();
    c.beginPath(); c.arc(pt.x, pt.y, this.eraseR(), 0, 7);
    c.lineWidth = 1 / this.s; c.strokeStyle = 'rgba(120,120,120,.8)'; c.fillStyle = 'rgba(160,160,160,.15)';
    c.fill(); c.stroke();
  }
  eraseR() { return 9 / this.s; }
  eraseSeg(a, b) {
    const r = this.eraseR();
    const x0 = Math.min(a.x, b.x) - r, x1 = Math.max(a.x, b.x) + r, y0 = Math.min(a.y, b.y) - r, y1 = Math.max(a.y, b.y) + r;
    const keep = [];
    let removed = 0;
    for (const s of this.doc.strokes) {
      const bb = bbox(s);
      if (bb.x1 < x0 || bb.x0 > x1 || bb.y1 < y0 || bb.y0 > y1) { keep.push(s); continue; }
      if (hitStroke(s, a, b, r)) removed++; else keep.push(s);
    }
    if (removed) {
      if (!this.ptr.snap) { this.snapshot(); this.ptr.snap = true; }
      this.ptr.removed += removed;
      this.doc.strokes.splice(0, this.doc.strokes.length, ...keep);
      this.paint();
    }
  }

  // ---- کمند و انتخاب ----
  drawLasso(pts) {
    this.clearLive();
    const c = this.liveCtx();
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (const q of pts) c.lineTo(q.x, q.y);
    c.lineWidth = 1.5 / this.s; c.setLineDash([6 / this.s, 5 / this.s]); c.strokeStyle = '#2f6fd6';
    c.stroke(); c.setLineDash([]);
  }
  finishLasso(pts) {
    this.clearLive();
    if (pts.length < 5) return;
    const strokes = this.doc.strokes.filter((s) => {
      const p = s.p, n = p.length / 3, step = Math.max(1, Math.floor(n / 20));
      let inn = 0, tot = 0;
      for (let i = 0; i < n; i += step) { tot++; if (pointInPoly(p[i * 3], p[i * 3 + 1], pts)) inn++; }
      return inn / tot >= 0.6;
    });
    const objs = [];
    for (const el of this.objLayer.children) {
      const cx = el.offsetLeft + el.offsetWidth / 2, cy = el.offsetTop + el.offsetHeight / 2;
      if (pointInPoly(cx, cy, pts)) objs.push(this.doc.objects.find((o) => o.id === el.dataset.id));
    }
    if (!strokes.length && !objs.length) return;
    this.sel = { strokes, objs: objs.filter(Boolean) };
    this.calcSelBB();
    this.showSel();
  }
  calcSelBB() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of this.sel.strokes) { const b = bbox(s); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
    for (const o of this.sel.objs) {
      const el = this.objLayer.querySelector(`[data-id="${o.id}"]`);
      if (!el) continue;
      x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + el.offsetWidth); y1 = Math.max(y1, o.y + el.offsetHeight);
    }
    const m = 6;
    this.sel.bb = { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
  }
  showSel() {
    if (!this.sel) return;
    this.clearLive();
    const c = this.liveCtx(), b = this.sel.bb;
    c.fillStyle = 'rgba(47,111,214,.07)'; c.strokeStyle = '#2f6fd6';
    c.lineWidth = 1.2 / this.s; c.setLineDash([5 / this.s, 4 / this.s]);
    c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    c.setLineDash([]);
    const m = this.selMenu;
    if (m.hidden) {
      m.innerHTML = '';
      const btn = (icon, label, fn) => h('button', { class: 'selbtn', title: label, onclick: (ev) => { ev.stopPropagation(); fn(); } }, h('span', { html: icon }), h('small', null, label));
      m.append(
        btn(ICON.trash, 'حذف', () => this.deleteSel()),
        btn(ICON.copy, 'تکثیر', () => this.dupSel()),
        ...PEN_COLORS.slice(0, 4).map((col) => h('button', { class: 'seldot', style: { background: col === 'k' ? 'var(--ink)' : col }, onclick: (ev) => { ev.stopPropagation(); this.colorSel(col); } })),
      );
      m.hidden = false;
    }
    let top = (b.y0 - this.sy) * this.s - 50;
    if (top < 4) top = (b.y1 - this.sy) * this.s + 8;
    const left = Math.max(4, Math.min(this.cw - m.offsetWidth - 4, b.x0 * this.s));
    m.style.top = Math.max(4, Math.min(this.ch - 48, top)) + 'px';
    m.style.left = left + 'px';
  }
  clearSel() { this.sel = null; this.selMenu.hidden = true; this.clearLive(); }
  beginMoveSel(base, pt) {
    this.snapshot();
    // جایگزینی با کپی تا تاریخچه سالم بماند
    const map = new Map();
    this.sel.strokes = this.sel.strokes.map((s) => { const c = { ...s, p: s.p.slice() }; map.set(s, c); return c; });
    this.doc.strokes = this.doc.strokes.map((s) => map.get(s) || s);
    this.ptr = { ...base, mode: 'move', last: pt };
  }
  translateSel(dx, dy) {
    for (const s of this.sel.strokes) {
      for (let i = 0; i < s.p.length; i += 3) { s.p[i] += dx; s.p[i + 1] += dy; }
      invalidate(s);
    }
    for (const o of this.sel.objs) {
      o.x += dx; o.y += dy;
      const el = this.objLayer.querySelector(`[data-id="${o.id}"]`);
      if (el) { el.style.left = o.x + 'px'; el.style.top = o.y + 'px'; }
    }
    const b = this.sel.bb; b.x0 += dx; b.x1 += dx; b.y0 += dy; b.y1 += dy;
    this.paint();
    this.showSel();
  }
  deleteSel() {
    this.snapshot();
    const set = new Set(this.sel.strokes);
    this.doc.strokes = this.doc.strokes.filter((s) => !set.has(s));
    const ids = new Set(this.sel.objs.map((o) => o.id));
    this.doc.objects.splice(0, this.doc.objects.length, ...this.doc.objects.filter((o) => !ids.has(o.id)));
    this.clearSel();
    this.renderObjects();
    this.changed();
  }
  dupSel() {
    this.snapshot();
    const off = 24;
    const ns = this.sel.strokes.map((s) => ({ ...s, id: uid(), p: s.p.map((v, i) => (i % 3 === 2 ? v : v + off)) }));
    const no = this.sel.objs.map((o) => ({ ...JSON.parse(JSON.stringify(o)), id: uid(), x: o.x + off, y: o.y + off }));
    this.doc.strokes.push(...ns);
    this.doc.objects.push(...no);
    for (const o of no) this.objLayer.append(this.makeObj(o));
    this.sel = { strokes: ns, objs: no };
    this.calcSelBB();
    this.changed();
    this.showSel();
  }
  colorSel(col) {
    this.snapshot();
    const map = new Map();
    this.sel.strokes = this.sel.strokes.map((s) => { const c = s.t === 'h' ? s : { ...s, c: col }; map.set(s, c); return c; });
    this.doc.strokes = this.doc.strokes.map((s) => map.get(s) || s);
    this.changed();
    this.showSel();
  }
}

// doc.strokes ممکن است با آرایه‌ی جدید جایگزین شود؛ همیشه از doc بخوان
function hitStroke(s, a, b, r) {
  const p = s.p, n = p.length / 3, rr = r + s.w / 2;
  for (let i = 0; i < n; i++) {
    const q = { x: p[i * 3], y: p[i * 3 + 1] };
    if (distToSeg(q, a, b) < rr) return true;
    if (i > 0 && distToSeg(a, { x: p[i * 3 - 3], y: p[i * 3 - 2] }, q) < rr) return true;
  }
  return false;
}
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- خط‌زدن کارها با قلم ----------
export function attachStrike(list, { rowSelector, onStrike }) {
  list.classList.add('strike-zone');
  let st = null, cv = null, ctx = null;
  const down = (e) => {
    if (st) return;
    if (e.pointerType === 'touch') {
      st = { mode: 'scroll', id: e.pointerId, y: e.clientY, lt: performance.now(), v: 0 };
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    st = { mode: 'pen', id: e.pointerId, pts: [[e.clientX, e.clientY]], moved: false };
  };
  const move = (e) => {
    if (!st || e.pointerId !== st.id) return;
    if (st.mode === 'scroll') {
      const now = performance.now(), d = e.clientY - st.y;
      list.scrollTop -= d;
      st.v = 0.8 * (d / Math.max(1, now - st.lt)) + 0.2 * st.v;
      st.y = e.clientY; st.lt = now;
      return;
    }
    const evs = e.getCoalescedEvents?.() || [e];
    for (const ev of evs.length ? evs : [e]) st.pts.push([ev.clientX, ev.clientY]);
    const [sx, sy] = st.pts[0];
    if (!st.moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) {
      st.moved = true;
      try { list.setPointerCapture(e.pointerId); } catch {}
      const r = list.getBoundingClientRect();
      cv = h('canvas', { class: 'strike-cv', style: { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' } });
      const dpr = devicePixelRatio || 1;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      document.body.append(cv);
      ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, -r.left * dpr, -r.top * dpr);
    }
    if (st.moved && ctx) {
      ctx.clearRect(-1e4, -1e4, 3e4, 3e4);
      ctx.beginPath();
      st.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = inkColor(); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };
  const up = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null;
    if (s.mode === 'scroll') {
      let v = s.v;
      if (Math.abs(v) < 0.2 || performance.now() - s.lt > 80) return;
      let last = performance.now();
      const step = (now) => { const dt = now - last; last = now; list.scrollTop -= v * dt; v *= Math.pow(0.94, dt / 16); if (Math.abs(v) > 0.03) requestAnimationFrame(step); };
      requestAnimationFrame(step);
      return;
    }
    if (!s.moved) return;
    const c = cv; cv = null; ctx = null;
    if (c) { c.classList.add('fade'); setTimeout(() => c.remove(), 350); }
    const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), hh = Math.max(...ys) - Math.min(...ys);
    if (w < 40 || hh > Math.max(30, w * 0.45)) return;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    for (const row of list.querySelectorAll(rowSelector)) {
      const r = row.getBoundingClientRect();
      if (my >= r.top && my <= r.bottom && w >= r.width * 0.28) { onStrike(row); navigator.vibrate?.(15); break; }
    }
  };
  list.addEventListener('pointerdown', down);
  list.addEventListener('pointermove', move);
  list.addEventListener('pointerup', up);
  list.addEventListener('pointercancel', up);
}
