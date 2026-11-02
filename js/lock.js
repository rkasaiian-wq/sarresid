// قفل با رمز و پوسته
import { h, fa, toEn } from './util.js';
import { settings } from './db.js';

export function applyTheme() {
  const t = settings.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#17191d' : '#ece6da');
  window.dispatchEvent(new Event('themechange'));
}

export async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + toEn(pin)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// صفحه‌کلید عددی؛ check(pin) اگر true برگرداند بسته می‌شود
function keypad({ title, check, cancellable }) {
  return new Promise((res) => {
    let pin = '';
    const dots = h('div', { class: 'pin-dots' });
    const msg = h('div', { class: 'pin-msg' });
    const back = h('div', { class: 'lock-screen' });
    const draw = () => { dots.innerHTML = ''; for (let i = 0; i < Math.max(4, pin.length); i++) dots.append(h('i', { class: i < pin.length ? 'on' : '' })); };
    const submit = async () => {
      if (pin.length < 4) return;
      const ok = await check(pin);
      if (ok) { back.remove(); document.removeEventListener('keydown', onKey); res(pin); }
      else { msg.textContent = 'رمز اشتباه است'; pin = ''; draw(); back.querySelector('.pin-pad').classList.add('shake'); setTimeout(() => back.querySelector('.pin-pad')?.classList.remove('shake'), 400); }
    };
    const press = (k) => {
      msg.textContent = '';
      if (k === 'del') pin = pin.slice(0, -1);
      else if (k === 'ok') return submit();
      else if (pin.length < 8) pin += k;
      draw();
    };
    const onKey = (e) => { if (/^\d$/.test(toEn(e.key))) press(toEn(e.key)); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('ok'); else if (e.key === 'Escape' && cancellable) { back.remove(); document.removeEventListener('keydown', onKey); res(null); } };
    document.addEventListener('keydown', onKey);
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    back.append(h('div', { class: 'pin-pad' },
      h('div', { class: 'pin-title' }, title), dots, msg,
      h('div', { class: 'pin-keys' }, keys.map((k) => h('button', { class: 'pin-key ' + k, onclick: () => press(k) }, k === 'del' ? '⌫' : k === 'ok' ? '✓' : fa(k)))),
      cancellable ? h('button', { class: 'btn ghost', onclick: () => { back.remove(); document.removeEventListener('keydown', onKey); res(null); } }, 'انصراف') : null));
    draw();
    document.body.append(back);
  });
}

export const askPin = (title) => keypad({ title, check: () => true, cancellable: true });

let locked = false;
export async function lockNow() {
  if (!settings.pinHash || locked) return;
  locked = true;
  await keypad({ title: 'سررسید قفل است', check: async (p) => (await hashPin(p, settings.pinSalt)) === settings.pinHash });
  locked = false;
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > (settings.lockAfter || 1) * 60000) lockNow();
});
