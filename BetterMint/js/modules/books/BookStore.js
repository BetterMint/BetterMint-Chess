const DB_NAME = "bettermint";
const STORE = "books";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "name" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

export async function listBooks() {
  const db = await openDb();
  return tx(db, "readonly", (s) => {
    return new Promise((resolve) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result || []).map((b) => ({
        name: b.name, stage: b.stage, addedAt: b.addedAt, size: b.size,
      })));
      req.onerror = () => resolve([]);
    });
  });
}

export async function putBook(name, buffer, stage = "opening") {
  const db = await openDb();
  return tx(db, "readwrite", (s) => {
    s.put({ name, stage, addedAt: Date.now(), size: buffer.byteLength, buffer });
  });
}

export async function setBookStage(name, stage) {
  const db = await openDb();
  return tx(db, "readwrite", (s) => {
    const req = s.get(name);
    req.onsuccess = () => {
      const b = req.result;
      if (b) { b.stage = stage; s.put(b); }
    };
  });
}

export async function getBook(name) {
  const db = await openDb();
  return tx(db, "readonly", (s) => {
    return new Promise((resolve) => {
      const req = s.get(name);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  });
}

export async function deleteBook(name) {
  const db = await openDb();
  return tx(db, "readwrite", (s) => { s.delete(name); });
}

export function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
