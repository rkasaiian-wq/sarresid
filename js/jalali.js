// تبدیل تاریخ شمسی/میلادی (الگوریتم jalaali)
import { fa } from './util.js';

const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

function jalCal(jy) {
  const bl = breaks.length, gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jm, jump = 0, n, i;
  for (i = 1; i < bl; i++) {
    jm = breaks[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f, jm, jd;
  if (k >= 0) {
    if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy, jm, jd }; }
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30); jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
export const WD_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const pad = (n) => String(n).padStart(2, '0');
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => keyOf(new Date());
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); }
export function diffDays(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }
export function jOf(k) { const [y, m, d] = k.split('-').map(Number); return d2j(g2d(y, m, d)); }
export function keyFromJ(jy, jm, jd) { const g = d2g(j2d(jy, jm, jd)); return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`; }
export const isLeapJ = (jy) => jalCal(jy).leap === 0;
export const monthLen = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : isLeapJ(jy) ? 30 : 29);
export const weekdayIdx = (k) => (parseKey(k).getDay() + 1) % 7; // ۰ = شنبه

export function fmtLong(k) {
  const j = jOf(k);
  return `${WEEKDAYS[weekdayIdx(k)]} ${fa(j.jd)} ${MONTHS[j.jm - 1]} ${fa(j.jy)}`;
}
export function fmtShort(k) {
  const j = jOf(k), t = jOf(todayKey());
  return `${fa(j.jd)} ${MONTHS[j.jm - 1]}${j.jy !== t.jy ? ' ' + fa(j.jy) : ''}`;
}
export function fmtNum(k) { const j = jOf(k); return fa(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`); }
export function relLabel(k) {
  const d = diffDays(todayKey(), k);
  if (d === 0) return 'امروز';
  if (d === 1) return 'فردا';
  if (d === -1) return 'دیروز';
  return fmtShort(k);
}
export function fmtTime(ms) {
  const d = new Date(ms);
  return fa(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
}
export function fmtDateTime(ms) { return `${relLabel(keyOf(new Date(ms)))} ساعت ${fmtTime(ms)}`; }
