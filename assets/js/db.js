/* 数据层：IndexedDB 封装 + 首次运行种子数据 + 备份导入导出 */

import { uid, dateStr, nowStr } from './util.js';

const DB_NAME = 'bobo-petlog';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pet')) db.createObjectStore('pet', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('records')) {
        const s = db.createObjectStore('records', { keyPath: 'id' });
        s.createIndex('by_at', 'at');
        s.createIndex('by_type', 'type');
      }
      if (!db.objectStoreNames.contains('reminders')) {
        const s = db.createObjectStore('reminders', { keyPath: 'id' });
        s.createIndex('by_at', 'at');
      }
      if (!db.objectStoreNames.contains('supplies')) db.createObjectStore('supplies', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return open().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

export async function all(store) {
  const s = await tx(store);
  return new Promise((res, rej) => {
    const r = s.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}

export async function get(store, key) {
  const s = await tx(store);
  return new Promise((res, rej) => {
    const r = s.get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function put(store, value) {
  const s = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = s.put(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function del(store, key) {
  const s = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = s.delete(key);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

export async function clear(store) {
  const s = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = s.clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

/* ---------------- 照片 ---------------- */
const photoURLs = new Map();

export async function savePhoto(blob) {
  const id = uid('ph_');
  await put('photos', { id, blob, at: nowStr() });
  return id;
}

export async function getPhotoURL(id) {
  if (!id) return '';
  if (photoURLs.has(id)) return photoURLs.get(id);
  const rec = await get('photos', id);
  if (!rec || !rec.blob) return '';
  const url = URL.createObjectURL(rec.blob);
  photoURLs.set(id, url);
  return url;
}

export async function deletePhoto(id) {
  if (!id) return;
  const url = photoURLs.get(id);
  if (url) { URL.revokeObjectURL(url); photoURLs.delete(id); }
  await del('photos', id);
}

export function revokeAllPhotoURLs() {
  for (const [id, url] of photoURLs) { URL.revokeObjectURL(url); photoURLs.delete(id); }
}

/* ---------------- 首次运行 ---------------- */
export async function seedIfEmpty() {
  const pets = await all('pet');
  if (pets.length) return pets[0];

  const pet = {
    id: 'pet_bobo',
    name: '波波',
    species: '猫',
    breed: '英国长毛猫',
    variety: '长毛蓝金渐层',
    sex: '公',
    birthday: '2026-08-08',
    homeDate: '2026-11-14',
    weightBirth: 0.98,
    avatarPhotoId: null,
    microchip: '',
    vet: '',
    notes: '',
    createdAt: nowStr(),
    updatedAt: nowStr()
  };
  await put('pet', pet);

  // 把已知的出生体重作为第一条记录，图表一开始就有起点
  await put('records', {
    id: uid('r_'),
    type: 'weight',
    at: '2026-11-14T20:00',
    data: { kg: 0.98 },
    note: '刚到家',
    photos: [],
    createdAt: nowStr(),
    updatedAt: nowStr()
  });

  await put('meta', { k: 'seeded', v: 1 });
  return pet;
}

/* ---------------- 备份 ---------------- */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportBackup() {
  const [pet, records, reminders, supplies, photos] = await Promise.all([
    all('pet'), all('records'), all('reminders'), all('supplies'), all('photos')
  ]);
  const photoData = [];
  for (const p of photos) {
    if (!p.blob) continue;
    photoData.push({ id: p.id, at: p.at, data: await blobToBase64(p.blob) });
  }
  return {
    format: 'bobo-petlog',
    version: 1,
    exportedAt: new Date().toISOString(),
    pet, records, reminders, supplies, photos: photoData
  };
}

export async function importBackup(data) {
  if (!data || data.format !== 'bobo-petlog') throw new Error('文件格式不对，不是波波日记的备份');
  if (!Array.isArray(data.records)) throw new Error('备份文件缺少记录数据');
  const stores = ['pet', 'records', 'reminders', 'supplies', 'photos'];
  for (const s of stores) await clear(s);

  for (const p of data.pet || []) await put('pet', p);
  for (const r of data.records) await put('records', r);
  for (const r of data.reminders || []) await put('reminders', r);
  for (const s of data.supplies || []) await put('supplies', s);
  for (const ph of data.photos || []) {
    if (!ph.data) continue;
    await put('photos', { id: ph.id, at: ph.at || nowStr(), blob: base64ToBlob(ph.data) });
  }
  revokeAllPhotoURLs();
}
