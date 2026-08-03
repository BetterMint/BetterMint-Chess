function looksLikeFengari(o) {
  return !!(o && o.lua && o.lauxlib && o.lualib && o.to_luastring);
}

let loadPromise = null;

// The Lua runtime is a classic UMD web build. It is injected on demand as a
// real script (bypassing page CSP) rather than bundled, so pages that never
// run a script pay nothing for it.
function loadRuntime(bridge) {
  if (looksLikeFengari(window.fengari)) return Promise.resolve(window.fengari);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!bridge?.requestRaw) throw new Error("Lua runtime bridge unavailable");
    await bridge.requestRaw("lua.loadRuntime", {}, 8000);
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (looksLikeFengari(window.fengari)) return window.fengari;
      await new Promise((r) => setTimeout(r, 60));
    }
    throw new Error("Lua runtime failed to load");
  })();
  loadPromise.catch(() => { loadPromise = null; });
  return loadPromise;
}

async function ensureFengari(bridge) {
  if (looksLikeFengari(window.fengari)) return window.fengari;
  return loadRuntime(bridge);
}

export class LuaVM {
  constructor(bridge = null) {
    this.L = null;
    this.bridge = bridge;
  }

  async init() {
    await ensureFengari(this.bridge);
    const { lauxlib, lualib, interop, to_luastring } = window.fengari;
    this.L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.L);
    lauxlib.luaL_requiref(this.L, to_luastring("js"), interop.luaopen_js, 1);
    return this;
  }

  push(value) {
    const { interop } = window.fengari;
    interop.push(this.L, value);
  }

  read(idx) {
    const { lua, to_jsstring } = window.fengari;
    const L = this.L;
    switch (lua.lua_type(L, idx)) {
      case lua.LUA_TNIL:
      case lua.LUA_TNONE:
        return null;
      case lua.LUA_TBOOLEAN:
        return lua.lua_toboolean(L, idx);
      case lua.LUA_TNUMBER:
        return lua.lua_tonumber(L, idx);
      case lua.LUA_TSTRING:
        return to_jsstring(lua.lua_tostring(L, idx));
      case lua.LUA_TTABLE: {
        const out = {};
        lua.lua_pushnil(L);
        let isArray = true;
        let n = 0;
        while (lua.lua_next(L, idx < 0 ? idx - 1 : idx)) {
          const k = this.read(-2);
          const v = this.read(-1);
          out[k] = v;
          if (typeof k !== "number" || k !== ++n) isArray = false;
          lua.lua_pop(L, 1);
        }
        return isArray ? Object.values(out) : out;
      }
      default:
        return null;
    }
  }

  setGlobalTable(name, obj) {
    const { lua, to_luastring } = window.fengari;
    this.push(obj);
    lua.lua_setglobal(this.L, to_luastring(name));
  }

  setGlobal(name, value) {
    const { lua, to_luastring } = window.fengari;
    this.push(value);
    lua.lua_setglobal(this.L, to_luastring(name));
  }

  getGlobal(name) {
    const { lua, to_luastring } = window.fengari;
    lua.lua_getglobal(this.L, to_luastring(name));
    const v = this.read(-1);
    lua.lua_pop(this.L, 1);
    return v;
  }

  run(code, chunkName = "script") {
    const { lua, lauxlib, to_luastring, to_jsstring } = window.fengari;
    const L = this.L;
    const status = lauxlib.luaL_loadbuffer(L, to_luastring(code), code.length, to_luastring(chunkName));
    if (status !== lua.LUA_OK) {
      const err = to_jsstring(lua.lua_tostring(L, -1));
      lua.lua_pop(L, 1);
      return { ok: false, error: err };
    }
    const callStatus = lua.lua_pcall(L, 0, 1, 0);
    if (callStatus !== lua.LUA_OK) {
      const err = to_jsstring(lua.lua_tostring(L, -1));
      lua.lua_pop(L, 1);
      return { ok: false, error: err };
    }
    const result = this.read(-1);
    lua.lua_pop(L, 1);
    return { ok: true, result };
  }

  callFn(name, ...args) {
    const { lua, to_luastring, to_jsstring } = window.fengari;
    const L = this.L;
    lua.lua_getglobal(L, to_luastring(name));
    if (lua.lua_type(L, -1) !== lua.LUA_TFUNCTION) {
      lua.lua_pop(L, 1);
      return { ok: false, error: `${name} is not a function` };
    }
    for (const a of args) this.push(a);
    const status = lua.lua_pcall(L, args.length, 1, 0);
    if (status !== lua.LUA_OK) {
      const err = to_jsstring(lua.lua_tostring(L, -1));
      lua.lua_pop(L, 1);
      return { ok: false, error: err };
    }
    const result = this.read(-1);
    lua.lua_pop(L, 1);
    return { ok: true, result };
  }

  destroy() {
    if (this.L) {
      window.fengari.lua.lua_close(this.L);
      this.L = null;
    }
  }
}
