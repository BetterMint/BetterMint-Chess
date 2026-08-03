import { listBooks, getBook, deleteBook, bufferToBase64 } from "./modules/books/BookStore.js";

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// The name, description and logo on chrome://extensions come from the manifest
// and are fixed for the life of the build. The toolbar button is the one piece
// of the extension's appearance that can be changed while running, so it is the
// one piece this can disguise: a plain grey puzzle tile that reads as any
// unremarkable extension.
const DISGUISE_SIZES = [16, 32, 48, 128];

function drawDisguisedIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 16;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#7b7f87";
  const r = 3 * s;
  const x = 2 * s;
  const y = 2 * s;
  const w = 12 * s;
  const h = 12 * s;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d7dae0";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 2.4 * s, 0, Math.PI * 2);
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

const REAL_ICONS = { 16: "img/logo-16.png", 48: "img/logo-48.png", 128: "img/logo-128.png" };

// A service worker cannot hand setIcon a packaged path, so the real logo has to
// be decoded here and passed as pixels the same way the disguised one is.
// Without this the icon could be disguised but never restored.
async function imageDataFromFile(path, size) {
  const res = await fetch(chrome.runtime.getURL(path));
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

async function applyIconDisguise(on, tooltip) {
  // each half is guarded on its own, so a failure to swap the image cannot
  // leave the tooltip stuck on the wrong one
  try {
    const imageData = {};
    if (on) {
      for (const size of DISGUISE_SIZES) imageData[size] = drawDisguisedIcon(size);
    } else {
      for (const [size, path] of Object.entries(REAL_ICONS)) {
        imageData[size] = await imageDataFromFile(path, Number(size));
      }
    }
    await chrome.action.setIcon({ imageData });
  } catch {}
  try {
    await chrome.action.setTitle({ title: on ? (tooltip || "Extension") : "BetterMint" });
  } catch {}
}

async function syncIconDisguise() {
  const cfg = await new Promise((res) => {
    chrome.storage.sync.get(["priv.disguiseIcon", "priv.disguiseTooltip"], res);
  }).catch(() => ({}));
  await applyIconDisguise(!!cfg?.["priv.disguiseIcon"], cfg?.["priv.disguiseTooltip"]);
}

chrome.runtime.onStartup.addListener(syncIconDisguise);
chrome.runtime.onInstalled.addListener(syncIconDisguise);
syncIconDisguise();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if ("priv.disguiseIcon" in changes || "priv.disguiseTooltip" in changes) syncIconDisguise();
});

const INJECTED = new Set();

function injectIntoTab(tabId) {
  chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ["dist/inject.js"],
    world: "MAIN",
    injectImmediately: true,
  }).catch(() => {});
}

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  if (!/^https?:\/\//.test(details.url)) return;
  injectIntoTab(details.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !tab.url) return;
  if (!/^https?:\/\//.test(tab.url)) return;
  injectIntoTab(tabId);
});

const sitePresence = new Map();

function hostKindFromUrl(url) {
  try {
    const h = new URL(url).hostname;
    if (/(^|\.)chess\.com$/.test(h)) return "chesscom";
    if (/(^|\.)lichess\.org$/.test(h)) return "lichess";
    if (/(^|\.)worldchess\.com$/.test(h) || /(^|\.)chessarena\.com$/.test(h)) return "worldchess";
    return "generic";
  } catch {
    return "generic";
  }
}

async function listPresentSites() {
  const kinds = new Set(sitePresence.values());
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const t of tabs) {
      if (sitePresence.has(t.id)) continue;
      const kind = hostKindFromUrl(t.url || "");
      if (kind !== "generic") kinds.add(kind);
    }
  } catch {}
  return [...kinds];
}

chrome.tabs.onRemoved.addListener((tabId) => sitePresence.delete(tabId));

const STEALTH_SCRIPT_ID = "ux-main-world-patch";

async function syncStealthInputPatch() {
  if (!chrome.scripting?.registerContentScripts) return;
  let wanted = false;
  try {
    // Sites built on chessground (lichess and friends) ignore synthetic
    // events, so the trust patch is REQUIRED for auto-move to work there -
    // not just for the optional "simulated mouse input" mode. It must be
    // registered at document_start, before the site binds its listeners.
    const got = await chrome.storage.sync.get(["hum.stealthInput", "auto.enabled"]);
    wanted = got["hum.stealthInput"] === true || got["auto.enabled"] === true;
  } catch {}
  let registered = [];
  try {
    registered = await chrome.scripting.getRegisteredContentScripts({ ids: [STEALTH_SCRIPT_ID] });
  } catch {}
  const has = registered.length > 0;
  try {
    if (wanted && !has) {
      await chrome.scripting.registerContentScripts([{
        id: STEALTH_SCRIPT_ID,
        js: ["js/main-world-patch.js"],
        matches: ["http://*/*", "https://*/*"],
        runAt: "document_start",
        allFrames: false,
        world: "MAIN",
      }]);
    } else if (!wanted && has) {
      await chrome.scripting.unregisterContentScripts({ ids: [STEALTH_SCRIPT_ID] });
    }
  } catch {}
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if ("hum.stealthInput" in changes || "auto.enabled" in changes) syncStealthInputPatch();
});

// Nothing here rewrites the response headers of the chess sites any more. The
// engines used to need it: a worker created from the page inherits the page's
// Content-Security-Policy, and SharedArrayBuffer is only handed to documents
// that are cross-origin isolated, so both had to be forced onto the site. They
// now run inside an extension-origin iframe that carries the extension's own
// policy and isolation instead, which leaves the sites untouched.

// Earlier versions added those rules dynamically, so any left over from a
// previous run are cleared out.
const RETIRED_HEADER_RULE_IDS = [9001, 9002];

async function dropRetiredHeaderRules() {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) return;
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const stale = existing.filter((r) => RETIRED_HEADER_RULE_IDS.includes(r.id)).map((r) => r.id);
    if (stale.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: stale });
  } catch {}
}

// Built-in engines are remembered by key, so renaming one silently orphans
// whatever the user had switched on: the old key keeps its "enabled" flag, the
// new key is never looked at, and the engine simply stops appearing with no
// indication why. Keys that were renamed are carried across; keys for engines
// that no longer exist are dropped so they cannot look enabled forever.
const RENAMED_BUILTIN_ENGINES = { torch2new: "torch2" };
const REMOVED_BUILTIN_ENGINES = ["komodo"];
const BUILTIN_FIELDS = ["enabled", "priority", "lines"];

async function migrateBuiltinEngineKeys() {
  let all;
  try {
    all = await chrome.storage.sync.get(null);
  } catch {
    return;
  }
  const write = {};
  const drop = [];
  for (const [from, to] of Object.entries(RENAMED_BUILTIN_ENGINES)) {
    for (const field of BUILTIN_FIELDS) {
      const oldKey = `engine.builtin.${from}.${field}`;
      if (!(oldKey in all)) continue;
      const newKey = `engine.builtin.${to}.${field}`;
      // an engine the user deliberately switched on must survive the rename,
      // even though the new key already holds a default
      if (field === "enabled" ? all[oldKey] === true : !(newKey in all)) {
        write[newKey] = all[oldKey];
      }
      drop.push(oldKey);
    }
  }
  for (const gone of REMOVED_BUILTIN_ENGINES) {
    for (const field of BUILTIN_FIELDS) {
      const key = `engine.builtin.${gone}.${field}`;
      if (key in all) drop.push(key);
    }
  }
  if (!drop.length) return;
  try {
    if (Object.keys(write).length) await chrome.storage.sync.set(write);
    await chrome.storage.sync.remove(drop);
  } catch {}
}

const LEGACY_ENGINE_KEYS = ["built-in", "builtin", "Komodo"];

async function pruneLegacyUciOptions() {
  const all = (await storageLocalGet("uciOptions")) || {};
  let changed = false;
  for (const key of LEGACY_ENGINE_KEYS) {
    if (key in all) {
      delete all[key];
      changed = true;
    }
  }
  if (changed) await storageLocalSet({ uciOptions: all });
}

chrome.runtime.onInstalled.addListener(() => {
  injectAllTabs();
  pruneLegacyUciOptions();
  migrateBuiltinEngineKeys();
  syncStealthInputPatch();
  dropRetiredHeaderRules();
});
chrome.runtime.onStartup.addListener(() => {
  injectAllTabs();
  pruneLegacyUciOptions();
  migrateBuiltinEngineKeys();
  syncStealthInputPatch();
  dropRetiredHeaderRules();
});

// the service worker can be respawned without either lifecycle event firing
dropRetiredHeaderRules();
migrateBuiltinEngineKeys();

function injectAllTabs() {
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
    for (const t of tabs) injectIntoTab(t.id);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  const respond = (p) => { try { sendResponse(p); } catch {} };
  (async () => {
    switch (msg.a) {
      case "settings.getAll":
        return respond(await storageGet(null));
      case "settings.set": {
        await storageSet({ [msg.p.key]: msg.p.value });
        return respond({ ok: true });
      }
      case "settings.setMany": {
        await storageSet(msg.p.settings || {});
        return respond({ ok: true });
      }
      case "settings.reset":
        await chrome.storage.sync.clear();
        return respond({ ok: true });
      case "uci.saveOptions": {
        const all = (await storageLocalGet("uciOptions")) || {};
        all[msg.p.engine] = {
          uciName: msg.p.uciName || null,
          options: msg.p.options || [],
          ts: Date.now(),
        };
        await storageLocalSet({ uciOptions: all });
        return respond({ ok: true });
      }
      case "site.present": {
        const tabId = sender?.tab?.id;
        if (tabId != null) sitePresence.set(tabId, msg.p?.host || "generic");
        return respond({ ok: true });
      }
      case "site.list":
        return respond({ sites: await listPresentSites() });
      case "assets.base":
        return respond({ base: chrome.runtime.getURL("") });
      case "lua.loadRuntime": {
        const tabId = sender?.tab?.id;
        if (tabId == null) return respond({ ok: false, error: "no tab" });
        try {
          await chrome.scripting.executeScript({
            target: { tabId, allFrames: false },
            files: ["js/vendor/fengari-web.js"],
            world: "MAIN",
          });
          return respond({ ok: true });
        } catch (e) {
          return respond({ ok: false, error: String(e?.message || e) });
        }
      }
      case "uci.getOptions":
        return respond((await storageLocalGet("uciOptions")) || {});
      case "scripts.list":
        return respond((await storageLocalGet("luaScripts")) || []);
      case "scripts.save": {
        const scripts = (await storageLocalGet("luaScripts")) || [];
        const idx = scripts.findIndex((s) => s.id === msg.p.script.id);
        if (idx >= 0) scripts[idx] = msg.p.script;
        else scripts.push(msg.p.script);
        await storageLocalSet({ luaScripts: scripts });
        return respond({ ok: true, scripts });
      }
      case "scripts.delete": {
        const scripts = ((await storageLocalGet("luaScripts")) || []).filter((s) => s.id !== msg.p.id);
        await storageLocalSet({ luaScripts: scripts });
        return respond({ ok: true, scripts });
      }
      case "fetch.proxy":
        return respond(await proxyFetch(msg.p));
      case "books.list":
        return respond(await listBooks());
      case "books.get": {
        const b = await getBook(msg.p.name);
        if (!b) return respond({ error: "not found" });
        return respond({ name: b.name, stage: b.stage, size: b.size, base64: bufferToBase64(b.buffer) });
      }
      case "books.delete":
        await deleteBook(msg.p.name);
        return respond({ ok: true });
      default:
        return respond({ error: "unknown action" });
    }
  })().catch((e) => respond({ error: String(e?.message || e) }));
  return true;
});

function storageGet(keys) {
  return new Promise((res) => chrome.storage.sync.get(keys, res));
}

function storageSet(items) {
  return new Promise((res) => chrome.storage.sync.set(items, res));
}

function storageLocalGet(key) {
  return new Promise((res) => chrome.storage.local.get(key, (r) => res(r[key])));
}

function storageLocalSet(items) {
  return new Promise((res) => chrome.storage.local.set(items, res));
}

function broadcastSettings(exceptTabId, settings) {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id === exceptTabId) continue;
      chrome.tabs.sendMessage(t.id, { a: "settings.push", p: settings }).catch(() => {});
    }
  });
}

let syncTimer = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    broadcastSettings(null, await storageGet(null));
  }, 40);
});

chrome.tabs.onRemoved.addListener((tabId) => INJECTED.delete(tabId));

async function proxyFetch({ url, options = {}, responseType = "json" }) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 6000);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, status: res.status };
    if (responseType === "arraybuffer") {
      const buf = await res.arrayBuffer();
      return { ok: true, status: res.status, base64: arrayBufferToBase64(buf) };
    }
    if (responseType === "text") {
      return { ok: true, status: res.status, text: await res.text() };
    }
    return { ok: true, status: res.status, json: await res.json() };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
