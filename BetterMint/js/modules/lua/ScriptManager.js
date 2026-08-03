import { LuaVM } from "./LuaVM.js";
import { LuaAPI } from "./LuaAPI.js";

export class ScriptManager {
  constructor(app) {
    this.app = app;
    this.scripts = [];
    this.running = new Map();
    this._listeners = new Set();
  }

  async init() {
    const res = await this.app.settings.requestRaw("scripts.list", {}, 4000).catch(() => null);
    this.scripts = Array.isArray(res) ? res : [];
    if (this.app.settings.get("lua.enabled") && this.app.settings.get("lua.autorun")) {
      for (const s of this.scripts) {
        if (s.enabled) this.run(s.id);
      }
    }
    this._notify();
  }

  list() {
    return this.scripts.map((s) => ({ ...s, running: this.running.has(s.id) }));
  }

  async create(name, code = "") {
    const script = {
      id: "lua-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || "Untitled",
      code,
      enabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.scripts.push(script);
    await this._persist(script);
    this._notify();
    return script;
  }

  async update(id, patch) {
    const s = this.scripts.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: Date.now() });
    await this._persist(s);
    this._notify();
  }

  async remove(id) {
    this.stop(id);
    this.scripts = this.scripts.filter((x) => x.id !== id);
    await this.app.settings.requestRaw("scripts.delete", { id }, 3000).catch(() => {});
    this._notify();
  }

  async setEnabled(id, enabled) {
    const s = this.scripts.find((x) => x.id === id);
    if (!s) return;
    s.enabled = enabled;
    await this._persist(s);
    if (enabled) this.run(id);
    else this.stop(id);
    this._notify();
  }

  async run(id) {
    if (this.running.has(id)) return { ok: true };
    const s = this.scripts.find((x) => x.id === id);
    if (!s) return { ok: false, error: "script not found" };
    if (s.site && s.site !== this.app.hostKind) {
      this.app.luaLog(s.name, `skipped: this script is ${s.site}-only, current site is ${this.app.hostKind}`);
      return { ok: false, error: `${s.site}-only script` };
    }
    const max = this.app.settings.get("lua.maxScripts");
    if (this.running.size >= max) return { ok: false, error: `max ${max} concurrent scripts` };

    const vm = new LuaVM(this.app.settings);
    await vm.init();
    const api = new LuaAPI(this.app, s.name);
    const globals = api.build();
    for (const [k, v] of Object.entries(globals)) vm.setGlobalTable("__raw_" + k, v);

    // fengari does not convert a Lua function into a callable JS value: it
    // arrives as nil, so every callback-taking API silently did nothing. The
    // real API is exposed through wrappers that proxy function arguments.
    const prelude = vm.run(buildCallbackBridge(globals), "bettermint-api");
    if (!prelude.ok) {
      api.destroy();
      vm.destroy();
      this.app.luaLog(s.name, "ERROR: could not install the API: " + prelude.error, true);
      return { ok: false, error: prelude.error };
    }

    const result = vm.run(s.code, s.name);
    if (!result.ok) {
      api.destroy();
      vm.destroy();
      this.app.luaLog(s.name, "ERROR: " + result.error, true);
      return { ok: false, error: result.error };
    }
    this.running.set(id, { vm, api, script: s });
    this.app.luaLog(s.name, "started");
    this._notify();
    return { ok: true };
  }

  stop(id) {
    const r = this.running.get(id);
    if (!r) return;
    r.api.destroy();
    r.vm.destroy();
    this.running.delete(id);
    this._notify();
  }

  stopAll() {
    for (const id of [...this.running.keys()]) this.stop(id);
  }

  callScriptFn(id, fnName, ...args) {
    const r = this.running.get(id);
    if (!r) return { ok: false, error: "not running" };
    return r.vm.callFn(fnName, ...args);
  }

  broadcastEvent(fnName, ...args) {
    for (const r of this.running.values()) {
      try { r.vm.callFn(fnName, ...args); } catch {}
    }
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    const list = this.list();
    for (const fn of this._listeners) {
      try { fn(list); } catch {}
    }
  }

  async _persist(script) {
    await this.app.settings.requestRaw("scripts.save", { script }, 3000).catch(() => {});
  }
}

// Builds the Lua-visible API from the raw tables that were pushed in. Each
// function is re-exposed through a wrapper that fixes two mismatches in how
// fengari bridges the two languages:
//   - it hands a JS function the first Lua argument as "this", which silently
//     shifted every argument of every call by one
//   - it converts a Lua function to nil, so callbacks never ran
// Values that are not functions are copied across as they are.
function buildCallbackBridge(globals) {
  const lines = [
    'local js = require("js")',
    "local createproxy = js.createproxy",
    "local unpack = table.unpack or unpack",
    "local function W(f)",
    "  return function(...)",
    '    local n = select("#", ...)',
    "    local a = {...}",
    "    for i = 1, n do",
    '      if type(a[i]) == "function" then a[i] = createproxy(a[i], "function") end',
    "    end",
    "    return f(nil, unpack(a, 1, n))",
    "  end",
    "end",
  ];

  for (const [ns, table] of Object.entries(globals)) {
    const raw = `__raw_${ns}`;
    lines.push(`${ns} = {}`);
    for (const key of Object.keys(table)) {
      const ref = `${raw}.${key}`;
      lines.push(typeof table[key] === "function" ? `${ns}.${key} = W(${ref})` : `${ns}.${key} = ${ref}`);
    }
  }
  return lines.join("\n");
}
