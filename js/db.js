// Accès à la base IndexedDB du téléphone : toutes les données de l'app y sont rangées.
import { DATA_STORES } from './model.js';

const DB_NAME = 'suivi-chantier';
export const DB_VERSION = 1;
const SAFETY_DB = 'suivi-chantier-secours';
const MAX_SNAPSHOTS = 10;

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

const txDone = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('Enregistrement annulé'));
});

function open(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const r = version ? indexedDB.open(name, version) : indexedDB.open(name);
    r.onupgradeneeded = (e) => upgrade?.(r.result, e.oldVersion);
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    r.onerror = () => reject(r.error);
  });
}

// Historique du schéma. Pour le faire évoluer : augmenter DB_VERSION et ajouter
// un bloc `if (oldVersion < N) { ... }`. Une copie de sécurité est faite avant (voir init).
function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('levels', { keyPath: 'id' });
    db.createObjectStore('rooms', { keyPath: 'id' }).createIndex('levelId', 'levelId');
    db.createObjectStore('lots', { keyPath: 'id' }).createIndex('roomId', 'roomId');
    const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
    tasks.createIndex('roomId', 'roomId');
    tasks.createIndex('lotId', 'lotId');
    tasks.createIndex('status', 'status');
    db.createObjectStore('meta', { keyPath: 'key' });
  }
}

async function readAll(db) {
  const names = [...db.objectStoreNames];
  const out = {};
  if (!names.length) return out;
  const tx = db.transaction(names, 'readonly');
  await Promise.all(names.map(async (n) => { out[n] = await req(tx.objectStore(n).getAll()); }));
  return out;
}

let dbPromise = null;

export function getDB() {
  dbPromise ??= init();
  return dbPromise;
}

async function init() {
  let current = 0;
  try {
    if (indexedDB.databases) current = (await indexedDB.databases()).find((d) => d.name === DB_NAME)?.version ?? 0;
  } catch { /* navigateur sans indexedDB.databases() */ }
  if (current && current < DB_VERSION) {
    const old = await open(DB_NAME, current);
    const data = await readAll(old);
    old.close();
    await storeSnapshot(data, `Avant mise à jour de la base (v${current} → v${DB_VERSION})`);
  }
  return open(DB_NAME, DB_VERSION, upgrade);
}

export async function all(store) {
  const db = await getDB();
  return req(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await getDB();
  return req(db.transaction(store).objectStore(store).get(key));
}

export async function byIndex(store, index, value) {
  const db = await getDB();
  return req(db.transaction(store).objectStore(store).index(index).getAll(value));
}

// Écrit plusieurs changements d'un coup : soit tout est enregistré, soit rien.
// ops = [{ store, put: objet }] ou [{ store, del: id }]
export async function write(ops) {
  if (!ops.length) return;
  const db = await getDB();
  const tx = db.transaction([...new Set(ops.map((o) => o.store))], 'readwrite');
  for (const o of ops) {
    const s = tx.objectStore(o.store);
    if ('put' in o) s.put(o.put);
    else s.delete(o.del);
  }
  return txDone(tx);
}

export const put = (store, value) => write([{ store, put: value }]);
export const putOps = (store, items) => items.map((x) => ({ store, put: x }));
export const delOps = (store, items) => items.map((x) => ({ store, del: x.id }));

export async function getMeta(key, fallback) {
  const r = await get('meta', key);
  return r ? r.value : fallback;
}

export const setMeta = (key, value) => put('meta', { key, value });

export async function exportAll() {
  const data = await readAll(await getDB());
  for (const s of DATA_STORES) data[s] ??= [];
  return data;
}

export async function replaceAll(data) {
  const db = await getDB();
  const tx = db.transaction(DATA_STORES, 'readwrite');
  for (const s of DATA_STORES) {
    const store = tx.objectStore(s);
    store.clear();
    for (const item of data[s] ?? []) store.put(item);
  }
  return txDone(tx);
}

// ---------- Copies de sécurité automatiques (base séparée) ----------

const openSafety = () => open(SAFETY_DB, 1, (db) => db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true }));

async function storeSnapshot(data, reason) {
  const db = await openSafety();
  const tx = db.transaction('snapshots', 'readwrite');
  const store = tx.objectStore('snapshots');
  store.add({ at: new Date().toISOString(), reason, data });
  const keys = store.getAllKeys();
  keys.onsuccess = () => keys.result.slice(0, Math.max(0, keys.result.length - MAX_SNAPSHOTS)).forEach((k) => store.delete(k));
  await txDone(tx);
  db.close();
}

export async function saveSnapshot(reason) {
  await storeSnapshot(await exportAll(), reason);
}

export async function listSnapshots() {
  const db = await openSafety();
  const list = await req(db.transaction('snapshots').objectStore('snapshots').getAll());
  db.close();
  return list.reverse().map(({ id, at, reason, data }) => ({
    id, at, reason, counts: { rooms: data.rooms?.length ?? 0, tasks: data.tasks?.length ?? 0 },
  }));
}

export async function restoreSnapshot(id) {
  const db = await openSafety();
  const snap = await req(db.transaction('snapshots').objectStore('snapshots').get(id));
  db.close();
  if (!snap) throw new Error('Copie de sécurité introuvable.');
  await saveSnapshot('Avant restauration d’une copie de sécurité');
  await replaceAll(snap.data);
}
