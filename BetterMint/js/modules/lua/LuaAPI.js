import { ShadowHost, randomId } from "../core/ShadowHost.js";

const PANEL_CSS = `
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
.p{position:fixed;top:90px;left:90px;min-width:220px;max-width:340px;background:rgba(15,17,23,0.94);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#e6edf3;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,0.5);pointer-events:auto;overflow:hidden}
.pt{display:flex;align-items:center;padding:9px 12px;font-weight:700;font-size:12px;letter-spacing:0.5px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.07);cursor:grab;user-select:none}
.pt span{flex:1}
.px{cursor:pointer;color:#8b949e;padding:0 2px}
.px:hover{color:#f87171}
.pb{padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.h{font-size:11px;font-weight:700;color:#38bdf8;letter-spacing:1px;text-transform:uppercase}
.t{font-size:12px;color:#c9d1d9;line-height:1.4}
.b{padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#e6edf3;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
.b:hover{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.4)}
.row{display:flex;align-items:center;gap:8px;font-size:12px}
.row label{flex:1;color:#c9d1d9}
.tgl{width:36px;height:20px;border-radius:10px;background:rgba(255,255,255,0.12);position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.tgl::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s}
.tgl.on{background:#4ade80}
.tgl.on::after{left:18px}
.sld{flex:1;accent-color:#4ade80}
.inp{flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:7px;color:#e6edf3;padding:5px 8px;font-size:12px;outline:none}
.inp:focus{border-color:#38bdf8}
.sel{flex:1;background:#161b22;border:1px solid rgba(255,255,255,0.12);border-radius:7px;color:#e6edf3;padding:5px 8px;font-size:12px}
.clr{width:34px;height:24px;border:none;border-radius:6px;background:none;cursor:pointer}
.sep{height:1px;background:rgba(255,255,255,0.08);margin:2px 0}
.val{color:#4ade80;font-weight:600;font-size:11px;min-width:30px;text-align:right}
`;

const LUA_EVENTS = ["move", "newgame", "gameover", "fen", "stage", "boardfound"];

export class LuaAPI {
  constructor(app, scriptName) {
    this.app = app;
    this.scriptName = scriptName;
    this._cleanup = [];
    this._panels = [];
    this._timers = new Set();
  }

  build() {
    const app = this.app;
    const api = {
      bm: {
        version: "3.0.0",
        site: app.hostKind,
        log: (...a) => app.luaLog(this.scriptName, a.map(String).join(" ")),
        notify: (text) => app.toast(String(text)),
        set_timeout: (fn, ms) => this._timeout(fn, ms),
        set_interval: (fn, ms) => this._interval(fn, ms),
        clear: (id) => this._clearTimer(id),
      },
      settings: {
        get: (k) => app.settings.get(String(k)),
        set: (k, v) => app.settings.set(String(k), v),
        all: () => app.settings.getAll(),
        reset: () => { try { app.settings.reset(); } catch {} },
      },
      game: {
        fen: () => app.currentFen,
        stage: () => app.currentStage,
        turn: () => { try { return app.chess.turn(); } catch { return null; } },
        moves: () => { try { return app.chess.history(); } catch { return []; } },
        move_number: () => { try { return app.chess.moveNumber(); } catch { return 0; } },
        piece_at: (sq) => { try { const p = app.chess.get(String(sq)); return p ? p.color + p.type : null; } catch { return null; } },
        is_my_turn: () => app.isOurTurn(),
        play: (uci) => app.playMove(String(uci)),
        san: (uci) => app.uciToSan(String(uci)),
        legal_moves: () => { try { return app.chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || "")); } catch { return []; } },
        in_check: () => { try { return app.chess.inCheck(); } catch { return false; } },
        is_checkmate: () => { try { return app.chess.isCheckmate(); } catch { return false; } },
        is_stalemate: () => { try { return app.chess.isStalemate(); } catch { return false; } },
        is_draw: () => { try { return app.chess.isDraw(); } catch { return false; } },
        is_threefold: () => { try { return app.chess.isThreefoldRepetition(); } catch { return false; } },
        is_insufficient: () => { try { return app.chess.isInsufficientMaterial(); } catch { return false; } },
        result: () => { try { if (!app.chess.isGameOver()) return null; if (app.chess.isCheckmate()) return app.chess.turn() === "w" ? "0-1" : "1-0"; return "1/2-1/2"; } catch { return null; } },
        history_san: () => { try { return app.chess.history({ verbose: true }).map((m) => m.san); } catch { return []; } },
        clock: () => { try { return app.exploits?.opponentClock?.() ?? null; } catch { return null; } },
        move_count: () => { try { return app.chess.history().length; } catch { return 0; } },
        fen_after: (uci) => { try { const tmp = new (app.chess.constructor)(app.chess.fen()); tmp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" }); return tmp.fen(); } catch { return null; } },
      },
      engine: {
        analyze: (fen, depth) => app.analyzePosition(String(fen || app.currentFen), depth),
        stop: () => app.engineManager.stopAll(),
        moves: () => app.engineManager.rankedMoves.map((m) => ({ move: m.move, rank: m.rank, engine: m.engine, score: m.displayScore })),
        bestmove: () => { const m = app.engineManager.getBestMove(); return m ? { move: m.move, engine: m.engine, score: m.displayScore } : null; },
        list: () => app.engineManager.statusList(),
        set_priority: (order) => app.engineManager.setPriorityOrder(Array.isArray(order) ? order.map(String) : []),
        set_skill: (name, lvl) => app.engineManager.setSkill(String(name), { skillLevel: Number(lvl) }),
        set_elo: (name, elo) => app.engineManager.setSkill(String(name), { uciElo: Number(elo) }),
        set_depth: (d) => app.engineManager.configure({ depth: Number(d) }),
        on_bestmove: (fn) => this._sub(app.engineManager.on("bestmove", (e) => this._call(fn, { move: e.move, engine: e.engine, rank: e.rank }))),
        on_eval: (fn) => this._sub(app.engineManager.on("eval", (e) => this._call(fn, e))),
        on_line: (fn) => this._sub(app.engineManager.on("ranked", (moves) => this._call(fn, moves.map((m) => ({ move: m.move, rank: m.rank, engine: m.engine, score: m.displayScore }))))),
      },
      book: {
        lines: () => (app.lastBookQuery?.lines || []).map((l) => ({ move: l.move, san: l.san, pct: l.pct, source: l.source, book: l.bookName })),
        stage: () => app.currentStage,
        pick: () => { const p = app.bookManager.pickMove(app.lastBookQuery); return p?.line?.move || null; },
      },
      board: {
        arrow: (from, to, color, label) => app.overlay.addArrow(String(from), String(to), String(color || "#4ade80"), { label: label ? String(label) : undefined }),
        clear_arrows: () => app.overlay.clearArrows(),
        highlight: (sq, color) => app.overlay.addHighlight(String(sq), String(color || "#4ade80")),
        ring: (sq, color) => app.overlay.addHighlight(String(sq), String(color || "#4ade80"), { style: "ring" }),
        clear: () => app.overlay.clear(),
        clear_highlights: () => app.overlay.clearHighlights(),
        flipped: (v) => app.overlay.setFlipped(!!v),
      },
      ui: {
        panel: (title) => this._makePanel(String(title || this.scriptName)),
        notify: (text) => app.toast(String(text)),
        toast: (text) => app.toast(String(text)),
      },
      site: {
        name: () => app.hostKind,
        query: (sel) => { try { return document.querySelector(String(sel)); } catch { return null; } },
        query_all: (sel) => { try { return [...document.querySelectorAll(String(sel))]; } catch { return []; } },
        click: (sel) => { const el = this._q(sel); if (el) el.click(); },
        text: (sel) => this._q(sel)?.textContent || null,
        set_text: (sel, t) => { const el = this._q(sel); if (el) el.textContent = String(t); },
        html: (sel) => this._q(sel)?.innerHTML || null,
        set_html: (sel, h) => { const el = this._q(sel); if (el) el.innerHTML = String(h); },
        attr: (sel, name) => this._q(sel)?.getAttribute(String(name)) || null,
        set_attr: (sel, name, v) => { const el = this._q(sel); if (el) el.setAttribute(String(name), String(v)); },
        css: (sel, prop, v) => { const el = this._q(sel); if (el) el.style.setProperty(String(prop), String(v)); },
        add_css: (css) => this._addStyle(String(css)),
        remove: (sel) => { const el = this._q(sel); if (el) el.remove(); },
        on_appear: (sel, fn) => this._onAppear(String(sel), fn),
        on_url_change: (fn) => this._subUrl(fn),
      },
      events: {
        on: (name, fn) => this._onEvent(String(name), fn),
      },
      storage: {
        get: (k, def) => app.scriptStorageGet(this.scriptName, String(k), def),
        set: (k, v) => app.scriptStorageSet(this.scriptName, String(k), v),
      },
      http: {
        get: (url, fn) => { app.scriptHttpGet(String(url)).then((body) => this._call(fn, body)); },
      },
    };
    return api;
  }

  _q(sel) {
    try { return document.querySelector(String(sel)); } catch { return null; }
  }

  _call(fn, ...args) {
    if (typeof fn !== "function") {
      this.app.luaLog(this.scriptName, "ERROR: expected a function callback", true);
      return undefined;
    }
    try {
      return fn(...args);
    } catch (e) {
      this.app.luaLog(this.scriptName, "ERROR in callback: " + (e?.message || e), true);
      return undefined;
    }
  }

  _sub(unsub) {
    this._cleanup.push(unsub);
    return unsub;
  }

  _timeout(fn, ms) {
    const id = setTimeout(() => { this._timers.delete(id); this._call(fn); }, Number(ms) || 0);
    this._timers.add(id);
    return id;
  }

  _interval(fn, ms) {
    const id = setInterval(() => this._call(fn), Math.max(16, Number(ms) || 16));
    this._timers.add(id);
    return id;
  }

  _clearTimer(id) {
    clearTimeout(id);
    clearInterval(id);
    this._timers.delete(id);
  }

  _addStyle(css) {
    const el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
    this._cleanup.push(() => el.remove());
    return el;
  }

  _onAppear(sel, fn) {
    let seen = false;
    const obs = new MutationObserver(() => {
      const el = this._q(sel);
      if (el && !seen) { seen = true; this._call(fn, el); }
      if (!el) seen = false;
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    this._cleanup.push(() => obs.disconnect());
    return () => obs.disconnect();
  }

  _subUrl(fn) {
    let last = location.href;
    const id = setInterval(() => {
      if (location.href !== last) {
        const prev = last;
        last = location.href;
        this._call(fn, last, prev);
      }
    }, 500);
    this._timers.add(id);
    return () => clearInterval(id);
  }

  _onEvent(name, fn) {

    if (!LUA_EVENTS.includes(name)) {
      this.app.luaLog(
        this.scriptName,
        `ERROR: unknown event "${name}" - expected one of: ${LUA_EVENTS.join(", ")}`,
        true,
      );
      return () => {};
    }
    const unsub = this.app.events.on(name, (...args) => this._call(fn, ...args));
    this._cleanup.push(unsub);
    return unsub;
  }

  _makePanel(title) {
    const shadow = new ShadowHost();
    shadow.setCSS(PANEL_CSS);
    shadow.mount();
    const panel = document.createElement("div");
    panel.className = "p";
    const header = document.createElement("div");
    header.className = "pt";
    const titleSpan = document.createElement("span");
    titleSpan.textContent = title;
    const closeBtn = document.createElement("div");
    closeBtn.className = "px";
    closeBtn.textContent = "✕";
    const body = document.createElement("div");
    body.className = "pb";
    header.appendChild(titleSpan);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    panel.appendChild(body);
    shadow.container.appendChild(panel);
    this._panels.push(shadow);

    header.addEventListener("pointerdown", (e) => {
      if (e.target === closeBtn) return;
      const r = panel.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      const move = (ev) => { panel.style.left = (ev.clientX - dx) + "px"; panel.style.top = (ev.clientY - dy) + "px"; };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });

    const api = {
      heading: (t) => { const el = document.createElement("div"); el.className = "h"; el.textContent = String(t); body.appendChild(el); return api; },
      text: (t) => { const el = document.createElement("div"); el.className = "t"; el.textContent = String(t); body.appendChild(el); return api; },
      button: (t, fn) => { const el = document.createElement("button"); el.className = "b"; el.textContent = String(t); el.onclick = () => { try { fn(); } catch {} }; body.appendChild(el); return api; },
      separator: () => { const el = document.createElement("div"); el.className = "sep"; body.appendChild(el); return api; },
      toggle: (label, def, fn) => {
        const row = document.createElement("div"); row.className = "row";
        const lab = document.createElement("label"); lab.textContent = String(label);
        const tgl = document.createElement("div"); tgl.className = "tgl" + (def ? " on" : "");
        let state = !!def;
        tgl.onclick = () => { state = !state; tgl.classList.toggle("on", state); try { fn && fn(state); } catch {} };
        row.appendChild(lab); row.appendChild(tgl); body.appendChild(row);
        return { get: () => state, set: (v) => { state = !!v; tgl.classList.toggle("on", state); } };
      },
      slider: (label, min, max, def, fn) => {
        const row = document.createElement("div"); row.className = "row";
        const lab = document.createElement("label"); lab.textContent = String(label);
        const sld = document.createElement("input"); sld.type = "range"; sld.className = "sld";
        sld.min = min; sld.max = max; sld.value = def;
        const val = document.createElement("span"); val.className = "val"; val.textContent = def;
        sld.oninput = () => { val.textContent = sld.value; try { fn && fn(Number(sld.value)); } catch {} };
        row.appendChild(lab); row.appendChild(sld); row.appendChild(val); body.appendChild(row);
        return { get: () => Number(sld.value), set: (v) => { sld.value = v; val.textContent = v; } };
      },
      input: (label, def, fn) => {
        const row = document.createElement("div"); row.className = "row";
        const lab = document.createElement("label"); lab.textContent = String(label);
        const inp = document.createElement("input"); inp.className = "inp"; inp.value = def ?? "";
        inp.onchange = () => { try { fn && fn(inp.value); } catch {} };
        row.appendChild(lab); row.appendChild(inp); body.appendChild(row);
        return { get: () => inp.value, set: (v) => { inp.value = v; } };
      },
      dropdown: (label, options, def, fn) => {
        const row = document.createElement("div"); row.className = "row";
        const lab = document.createElement("label"); lab.textContent = String(label);
        const sel = document.createElement("select"); sel.className = "sel";
        for (const o of options) { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; sel.appendChild(opt); }
        sel.value = def;
        sel.onchange = () => { try { fn && fn(sel.value); } catch {} };
        row.appendChild(lab); row.appendChild(sel); body.appendChild(row);
        return { get: () => sel.value, set: (v) => { sel.value = v; } };
      },
      color: (label, def, fn) => {
        const row = document.createElement("div"); row.className = "row";
        const lab = document.createElement("label"); lab.textContent = String(label);
        const inp = document.createElement("input"); inp.type = "color"; inp.className = "clr"; inp.value = def || "#4ade80";
        inp.oninput = () => { try { fn && fn(inp.value); } catch {} };
        row.appendChild(lab); row.appendChild(inp); body.appendChild(row);
        return { get: () => inp.value, set: (v) => { inp.value = v; } };
      },
      destroy: () => { shadow.unmount(); },
    };
    closeBtn.onclick = () => api.destroy();
    return api;
  }

  destroy() {
    for (const fn of this._cleanup) { try { fn(); } catch {} }
    for (const id of this._timers) { clearTimeout(id); clearInterval(id); }
    for (const p of this._panels) p.unmount();
    this._cleanup = [];
    this._timers.clear();
    this._panels = [];
  }
}
