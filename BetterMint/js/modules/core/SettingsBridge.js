import { getAllDefaults, getDefault } from "../settings/SettingsSchema.js";

export class SettingsBridge {
  constructor() {
    this._cache = getAllDefaults();
    this._listeners = new Set();
    this._pending = new Map();
    this._pushListeners = new Map();
    this._seq = 0;
    this._ready = false;
    this._session = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    this._handshakeTimer = null;
    window.addEventListener("message", (e) => this._onMessage(e));
  }

  async init() {
    this._startHandshake();
    const settings = await this._request("settings.getAll", {}, 6000).catch(() => null);
    if (settings && !settings.error) {
      this._cache = { ...getAllDefaults(), ...settings };
    }
    this._ready = true;
    this._notify();
    return this._cache;
  }

  _startHandshake() {
    const hello = () => {
      if (this._handshaken) return;
      window.postMessage({ op: "hello", s: this._session }, "*");
      this._handshakeTimer = setTimeout(hello, 700);
    };
    hello();
  }

  get ready() { return this._ready; }
  get handshaken() { return this._handshaken; }

  get(key) {
    if (key in this._cache) return this._cache[key];
    return getDefault(key);
  }

  getAll() { return { ...this._cache }; }

  async set(key, value) {
    this._cache[key] = value;
    this._notify();
    await this._request("settings.set", { key, value }, 3000).catch(() => {});
  }

  async setMany(obj) {
    Object.assign(this._cache, obj);
    this._notify();
    await this._request("settings.setMany", { settings: obj }, 3000).catch(() => {});
  }

  async reset() {
    this._cache = getAllDefaults();
    this._notify();
    await this._request("settings.reset", {}, 3000).catch(() => {});
  }

  async exportJson() {
    return JSON.stringify(this._cache, null, 2);
  }

  async importJson(json) {
    const obj = JSON.parse(json);
    await this.setMany(obj);
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  onPush(action, fn) {
    if (!this._pushListeners.has(action)) this._pushListeners.set(action, new Set());
    this._pushListeners.get(action).add(fn);
    return () => this._pushListeners.get(action)?.delete(fn);
  }

  requestRaw(action, payload, timeout = 3000) {
    return this._request(action, payload, timeout);
  }

  async engineLocalStart(engineId, engineKey = "stockfish18") {
    return this._request("engine.local.start", { engineId, engineKey }, 4000);
  }

  async engineLocalCmd(engineId, cmd) {
    return this._request("engine.local.cmd", { engineId, cmd }, 2000);
  }

  async engineLocalStop(engineId) {
    return this._request("engine.local.stop", { engineId }, 2000);
  }

  // Sockets are opened in the engine host frame rather than here, because a
  // site's connect-src refuses any socket the page opens itself.
  async socketOpen(socketId, url) {
    return this._request("socket.open", { socketId, url }, 4000);
  }

  async socketSend(socketId, data) {
    return this._request("socket.send", { socketId, data }, 2000);
  }

  async socketClose(socketId) {
    return this._request("socket.close", { socketId }, 2000);
  }

  async proxyFetchJson(url, timeout = 6000, headers = null) {
    const options = headers ? { timeout, headers } : { timeout };
    const res = await this._request("fetch.proxy", { url, responseType: "json", options }, timeout + 1500);
    if (res?.ok && res.json !== undefined) return res.json;
    const err = new Error(res?.error || `fetch failed ${res?.status || ""}`);
    err.status = res?.status || 0;
    throw err;
  }

  _notify() {
    for (const fn of this._listeners) {
      try { fn(this._cache); } catch {}
    }
  }

  _request(action, payload, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const id = ++this._seq;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error("bridge timeout: " + action));
      }, timeout);
      this._pending.set(id, { resolve, timer });
      window.postMessage({ ["m" + this._session]: 1, op: "req", i: id, a: action, p: payload }, "*");
    });
  }

  _onMessage(e) {
    if (e.source !== window || !e.data || typeof e.data !== "object") return;
    const d = e.data;
    if (d["m" + this._session] !== 1) return;
    if (d.op === "ready") {
      this._handshaken = true;
      clearTimeout(this._handshakeTimer);
      return;
    }
    if (d.op === "res" && this._pending.has(d.i)) {
      const p = this._pending.get(d.i);
      clearTimeout(p.timer);
      this._pending.delete(d.i);
      p.resolve(d.p);
      return;
    }
    if (d.op === "push") {
      if (d.a === "settings.changed") {
        this._cache = { ...getAllDefaults(), ...(d.p || {}) };
        this._notify();
      }
      this._pushListeners.get(d.a)?.forEach((fn) => { try { fn(d.p); } catch {} });
    }
  }
}
