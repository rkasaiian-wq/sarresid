// تنظیمات، پشتیبان‌گیری و رمز
import { h, ICON, toast, confirmDialog, fa, modal } from '../util.js';
import { settings, saveSettings, exportAll, importAll, data } from '../db.js';
import { tool, setTool } from '../ink.js';
import { fmtNum, todayKey, fmtDateTime } from '../jalali.js';
import { applyTheme, hashPin, askPin } from '../lock.js';
import { segmented } from '../pickers.js';

export const VERSION = '1.0.0';

export function renderSettings(main) {
  const card = (title, ...kids) => h('div', { class: 'card' }, h('h4', null, title), ...kids);
  const row = (label, ctrl, hint) => h('div', { class: 'set-row' }, h('div', null, h('div', null, label), hint ? h('small', { class: 'muted' }, hint) : null), ctrl);
  const toggle = (val, fn) => { const b = h('button', { class: 'toggle' + (val ? ' on' : ''), onclick: () => { val = !val; b.classList.toggle('on', val); fn(val); } }, h('i')); return b; };

  const backup = async () => {
    const blob = await exportAll();
    const a = h('a', { href: URL.createObjectURL(blob), download: `sarresid-${fmtNum(todayKey()).replace(/\//g, '-')}.json` });
    document.body.append(a); a.click(); a.remove();
    saveSettings({ lastBackup: Date.now() });
    toast('فایل پشتیبان ذخیره شد (پوشه‌ی Downloads)');
    render();
  };
  const restore = () => {
    const inp = h('input', { type: 'file', accept: 'application/json,.json', onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!(await confirmDialog('همه‌ی اطلاعات فعلی با محتوای فایل پشتیبان جایگزین می‌شود. ادامه می‌دهید؟', 'بازگردانی', true))) return;
      try { await importAll(await f.text()); toast('بازگردانی انجام شد'); setTimeout(() => location.reload(), 600); }
      catch (err) { toast('خطا: ' + err.message); }
    } });
    inp.click();
  };
  const setPin = async () => {
    const p1 = await askPin('رمز جدید (۴ تا ۸ رقم)');
    if (!p1) return;
    const p2 = await askPin('تکرار رمز');
    if (p1 !== p2) { toast('رمزها یکسان نبودند'); return; }
    const salt = crypto.getRandomValues(new Uint8Array(8)).join('');
    saveSettings({ pinSalt: salt, pinHash: await hashPin(p1, salt) });
    toast('رمز فعال شد');
    render();
  };

  const root = h('div', { class: 'view settings-view scroll-y' });
  const render = () => {
    root.innerHTML = '';
    const counts = `${fa(data.tasks.size)} کار · ${fa(data.people.size)} شخص · ${fa(data.agreements.size)} توافق · ${fa(data.notes.size)} یادداشت`;
    root.append(
      h('div', { class: 'view-head' }, h('h2', null, 'تنظیمات')),
      h('div', { class: 'settings-grid' },
        card('ظاهر',
          row('پوسته', segmented([{ value: 'auto', label: 'خودکار' }, { value: 'light', label: 'روشن' }, { value: 'dark', label: 'تیره' }], settings.theme || 'auto', (v) => { saveSettings({ theme: v }); applyTheme(); })),
          row('کاغذ پیش‌فرض یادداشت', segmented([{ value: 'lines', label: 'خط‌دار' }, { value: 'grid', label: 'شطرنجی' }, { value: 'dots', label: 'نقطه‌ای' }, { value: 'blank', label: 'سفید' }], settings.noteBg || 'lines', (v) => saveSettings({ noteBg: v })))),
        card('قلم',
          row('نوشتن با انگشت', toggle(tool.finger, (v) => setTool({ finger: v })), 'خاموش = فقط S Pen می‌نویسد و انگشت صفحه را جابه‌جا می‌کند (پیشنهادی)'),
          h('p', { class: 'muted small' }, 'دکمه‌ی کنار S Pen را نگه دارید تا پاک‌کن شود. برای صاف شدن شکل، بعد از کشیدن، قلم را لحظه‌ای نگه دارید.')),
        card('امنیت',
          row('قفل با رمز', settings.pinHash
            ? h('div', { class: 'row gap' }, h('button', { class: 'btn small', onclick: setPin }, 'تغییر رمز'), h('button', { class: 'btn small danger ghost', onclick: async () => { if (await confirmDialog('رمز برداشته شود؟', 'بله', true)) { saveSettings({ pinHash: null, pinSalt: null }); render(); } } }, 'برداشتن'))
            : h('button', { class: 'btn small primary', onclick: setPin }, 'تعیین رمز'), 'با باز کردن اپ رمز خواسته می‌شود'),
          settings.pinHash ? row('قفل خودکار پس از', segmented([{ value: 1, label: '۱ دقیقه' }, { value: 5, label: '۵ دقیقه' }, { value: 30, label: '۳۰ دقیقه' }], settings.lockAfter || 1, (v) => saveSettings({ lockAfter: v }))) : null),
        card('یادآوری‌ها',
          row('اعلان‌ها', 'Notification' in window && Notification.permission === 'granted'
            ? h('span', { class: 'badge ok' }, 'فعال')
            : h('button', { class: 'btn small primary', onclick: async () => { await Notification.requestPermission(); render(); } }, 'اجازه‌ی اعلان'),
          'در این نسخه، یادآوری وقتی اپ باز است یا به‌تازگی باز شده نمایش داده می‌شود. در نسخه‌ی APK یادآوری کاملاً زمان‌بندی‌شده خواهد بود.')),
        card('پشتیبان‌گیری',
          h('p', { class: 'muted small' }, counts),
          row('دریافت فایل پشتیبان', h('button', { class: 'btn small primary', onclick: backup }, h('span', { html: ICON.download }), 'ذخیره'),
            settings.lastBackup ? 'آخرین پشتیبان: ' + fmtDateTime(settings.lastBackup) : 'هنوز پشتیبانی گرفته نشده'),
          row('بازگردانی از فایل', h('button', { class: 'btn small', onclick: restore }, h('span', { html: ICON.upload }), 'انتخاب فایل')),
          row('ذخیره‌ی ماندگار', h('span', { class: 'badge ' + (settings._persisted ? 'ok' : 'soon') }, settings._persisted ? 'فعال' : 'نامشخص'),
            'اطلاعات فقط روی همین گوشی ذخیره می‌شود؛ هر چند وقت یک بار فایل پشتیبان بگیرید.')),
        card('درباره', h('p', { class: 'muted small' }, `سررسید · نسخه‌ی ${fa(VERSION)}`)),
      ));
  };
  render();
  main.append(root);
  return () => {};
}
