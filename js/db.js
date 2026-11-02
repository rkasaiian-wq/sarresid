// ذخیره‌سازی محلی با IndexedDB + نگهداری در حافظه
const STORES = ['tasks', 'people', 'agreements', 'notes', 'days', 'files', 'meta'];
export const CACHED = ['tasks', 'people', 'agreements', 'notes', 'days'];
let dbp;

function openDB() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('sarresid', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function run(store, mode, fn) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
export const idb = {
  all: (s) => run(s, 'readonly', (st) => st.getAll()),
  get: (s, id) => run(s, 'readonly', (st) => st.get(id)),
  put: (s, o) => run(s, 'readwrite', (st) => st.put(o)),
  del: (s, id) => run(s, 'readwrite', (st) => st.delete(id)),
  clear: (s) => run(s, 'readwrite', (st) => st.clear()),
};

export const data = Object.fromEntries(CACHED.map((s) => [s, new Map()]));
export let settings = {};

const listeners = {};
export function on(store, fn) { (listeners[store] ||= new Set()).add(fn); return () => listeners[store].delete(fn); }
function emit(store, obj) { listeners[store]?.forEach((f) => f(obj)); listeners['*']?.forEach((f) => f(store, obj)); }

export async function loadAll() {
  for (const s of CACHED) {
    const rows = await idb.all(s);
    data[s] = new Map(rows.map((r) => [r.id, r]));
  }
  settings = (await idb.get('meta', 'settings')) || { id: 'settings' };
  try { if (navigator.storage?.persist) settings._persisted = await navigator.storage.persist(); } catch {}
}

export function save(store, obj, { silent = false } = {}) {
  obj.updatedAt = Date.now();
  if (!obj.createdAt) obj.createdAt = obj.updatedAt;
  data[store].set(obj.id, obj);
  idb.put(store, obj).catch((e) => console.error('save failed', e));
  if (!silent) emit(store, obj);
  return obj;
}
export function remove(store, id) {
  data[store].delete(id);
  idb.del(store, id);
  emit(store, { id, _deleted: true });
}
export function saveSettings(patch) {
  Object.assign(settings, patch);
  const { _persisted, ...rest } = settings;
  idb.put('meta', rest);
  emit('settings', settings);
}

// فایل‌ها (عکس پیوست‌ها)
export const putFile = (id, blob, name) => idb.put('files', { id, blob, name });
export const getFileRec = (id) => idb.get('files', id);
export const getFile = async (id) => (await idb.get('files', id))?.blob;
export const delFile = (id) => idb.del('files', id);

const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const dataURLToBlob = async (u) => (await fetch(u)).blob();

export async function exportAll() {
  const out = { app: 'sarresid', version: 1, exportedAt: Date.now() };
  for (const s of CACHED) out[s] = [...data[s].values()];
  const files = await idb.all('files');
  out.files = [];
  for (const f of files) out.files.push({ id: f.id, name: f.name, data: await blobToDataURL(f.blob) });
  out.settings = { ...settings, _persisted: undefined, pinHash: undefined, pinSalt: undefined };
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

export async function importAll(json) {
  const obj = JSON.parse(json);
  if (obj.app !== 'sarresid') throw new Error('فایل پشتیبان معتبر نیست');
  for (const s of CACHED) {
    await idb.clear(s);
    for (const row of obj[s] || []) await idb.put(s, row);
  }
  await idb.clear('files');
  for (const f of obj.files || []) await idb.put('files', { id: f.id, name: f.name, blob: await dataURLToBlob(f.data) });
  if (obj.settings) {
    const keep = { pinHash: settings.pinHash, pinSalt: settings.pinSalt };
    await idb.put('meta', { ...obj.settings, ...keep, id: 'settings' });
  }
}
