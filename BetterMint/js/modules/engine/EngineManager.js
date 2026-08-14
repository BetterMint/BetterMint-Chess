import { makeSocket } from "./RelaySocket.js";

export const RankingMode = { PRIORITY: "priority", SMART: "smart", ROUNDROBIN: "roundrobin" };

const RANKED_EMIT_MS = 120;

export class RankedMove {
  constructor(move, engine, priority, scoreCp = null, scoreMate = null, pv = []) {
    this.move = move;
    this.engine = engine;
    this.priority = priority;
    this.scoreCp = scoreCp;
    this.scoreMate = scoreMate;
    this.pv = pv;
    this.rank = 0;
    this.multipv = 1;
    // UCI scores are relative to the side to move. `sign` flips them into the
    // perspective the user asked to see (white / player / raw engine).
    this.sign = 1;
  }
  get viewCp() {
    return this.scoreCp == null ? null : this.scoreCp * this.sign;
  }
  get viewMate() {
    return this.scoreMate == null ? null : this.scoreMate * this.sign;
  }
  get displayScore() {
    const mate = this.viewMate;
    if (mate != null) return `${mate > 0 ? "M" : "-M"}${Math.abs(mate)}`;
    const cp = this.viewCp;
    if (cp != null) return (cp >= 0 ? "+" : "") + (cp / 100).toFixed(2);
    return "?";
  }
}

// When a position is already decided an engine has no move to give, and they
// each say so differently: the UCI null move, a literal "(none)", or a move
// whose two squares are the same. None of these can be shown or played.
export function isNullMove(move) {
  if (!move) return true;
  const m = String(move).trim().toLowerCase();
  if (m === "0000" || m === "(none)" || m === "none" || m === "null") return true;
  if (!/^[a-h][1-8][a-h][1-8][qrbnk]?$/.test(m)) return true;
  return m.slice(0, 2) === m.slice(2, 4);
}

export function parseUciOption(line) {
  const m = /^option\s+name\s+(.+?)\s+type\s+(check|spin|combo|button|string)\b(.*)$/.exec(line.trim());
  if (!m) return null;
  const [, name, type, rest] = m;
  const opt = { name, type };
  const def = /(?:^|\s)default\s+(.*?)(?=\s+(?:min|max|var)\s|$)/.exec(rest);
  if (def) opt.def = def[1].trim();
  const min = /\smin\s+(-?\d+)/.exec(rest);
  const max = /\smax\s+(-?\d+)/.exec(rest);
  if (min) opt.min = Number(min[1]);
  if (max) opt.max = Number(max[1]);
  const vars = [...rest.matchAll(/\svar\s+(.+?)(?=\s+var\s|$)/g)].map((v) => v[1].trim());
  if (vars.length) opt.vars = vars;
  if (type === "check") opt.def = String(opt.def) === "true";
  else if (type === "spin") opt.def = opt.def != null && opt.def !== "" ? Number(opt.def) : 0;
  else if (type === "button") delete opt.def;
  else if (opt.def == null) opt.def = "";
  return opt;
}

export function clampToOption(options, name, value) {
  const o = options?.find((x) => x.name === name);
  if (!o) return value;
  let v = value;
  if (o.max != null) v = Math.min(v, o.max);
  if (o.min != null) v = Math.max(v, o.min);
  return v;
}

class RemoteEngine {
  constructor(manager, name, priority) {
    this.manager = manager;
    this.name = name;
    this.priority = priority;
    this.type = "remote";
    this.uciOptions = [];
    this.uciName = null;
    this.alive = true;
    this.busy = false;
    this.lastInfo = null;
    this.lastBestmove = null;
    this.ready = true;
  }
  async send(cmd) { this.manager._wsSend({ action: "raw", engine: this.name, cmd }); }
  async setOption(name, value) { this.manager._wsSend({ action: "setoption", engine: this.name, name, value }); }
  get linesWanted() {
    return this.lines > 0 ? this.lines : null;
  }

  async analyze(fen, opts) {
    this.busy = true;
    this.manager._wsSend({
      action: "analyze", engines: [this.name], fen,
      depth: opts.depth, movetime: opts.movetime, nodes: opts.nodes,
      multipv: this.linesWanted || opts.multipv,
    });
  }
  async stop() { this.manager._wsSend({ action: "stop", engines: [this.name] }); this.busy = false; }
  async newGame() { this.manager._wsSend({ action: "newgame", engines: [this.name] }); }
}

class UciEngine {
  constructor(manager, name, priority, type) {
    this.manager = manager;
    this.name = name;
    this.priority = priority;
    this.type = type;
    this.alive = false;
    this.busy = false;
    this.lastInfo = null;
    this.lastBestmove = null;
    this.ready = false;
    this._readyResolve = null;
    this._searching = false;
    this._idleWaiters = new Set();
    this._analyzeSeq = 0;
    this.uciOptions = [];
    this.uciName = null;
  }

  onLine(line) {
    if (!this.alive && (line === "uciok" || line === "readyok" || line.startsWith("info ") || line.startsWith("bestmove"))) {
      this.alive = true;
      this.manager._emit("engines", this.manager.statusList());
    }
    if (line.startsWith("option name ")) {
      const opt = parseUciOption(line);
      if (opt && !this.uciOptions.some((o) => o.name === opt.name)) this.uciOptions.push(opt);
    } else if (line.startsWith("id name ")) {
      this.uciName = line.slice(8).trim();
    } else if (line === "uciok") {
      this.manager._emit("uciOptions", { engine: this.name, uciName: this.uciName, options: this.uciOptions });
    }
    if (line === "readyok") { this.ready = true; this._readyResolve?.(); }
    if (line.startsWith("info ")) this.manager._handleInfo(this.name, line);
    if (line.startsWith("bestmove")) {
      const parts = line.split(" ");
      this.busy = false;
      this._searching = false;
      this._flushIdle();
      this.lastBestmove = parts[1] || null;
      this.manager._handleBestmove(this.name, parts[1], parts[3]);
    }
  }

  _flushIdle() {
    for (const resolve of [...this._idleWaiters]) resolve();
    this._idleWaiters.clear();
  }

  _whenIdle(timeoutMs = 2000) {
    if (!this._searching) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this._idleWaiters.delete(finish);
        resolve();
      };
      this._idleWaiters.add(finish);
      setTimeout(finish, timeoutMs);
    });
  }

  async _goIdle() {
    if (!this._searching) return;
    this.send("stop");
    await this._whenIdle();
    this._searching = false;
  }

  async setOption(name, value) {
    await this._goIdle();
    this.send(`setoption name ${name} value ${value}`);
  }

  get linesWanted() {
    return this.lines > 0 ? this.lines : null;
  }

  async analyze(fen, opts) {
    if (!this.alive) return;
    const seq = ++this._analyzeSeq;
    await this._goIdle();
    if (seq !== this._analyzeSeq) return;
    this.busy = true;
    const mpv = this.linesWanted || opts.multipv;
    if (mpv && this.uciOptions.some((o) => o.name === "MultiPV")) {
      this.send(`setoption name MultiPV value ${clampToOption(this.uciOptions, "MultiPV", mpv)}`);
    }
    this.send(`position fen ${fen}`);
    const depth = this.maxDepth ? Math.min(opts.depth || 15, this.maxDepth) : (opts.depth || 15);
    this._searching = true;
    if (opts.nodes) this.send(`go nodes ${opts.nodes}`);
    else if (opts.movetime) this.send(`go movetime ${opts.movetime}`);
    else this.send(`go depth ${depth}`);
  }

  async stop() { this.send("stop"); this.busy = false; }

  async newGame() {
    await this._goIdle();
    this.send("ucinewgame");
    this.send("isready");
  }

  async _handshake(timeoutMs) {
    this.send("uci");
    this.send("isready");
    try {
      await Promise.race([
        new Promise((resolve) => { this._readyResolve = resolve; }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("handshake timeout")), timeoutMs)),
      ]);
      this.ready = true;
      return true;
    } catch {
      return false;
    }
  }
}

class LocalEngine extends UciEngine {
  constructor(manager, name, priority, engineKey = "stockfish18") {
    super(manager, name, priority, "local");
    this.engineKey = engineKey;
    this.engineId = "le-" + Math.random().toString(36).slice(2, 10);
  }
  async start() {
    const bridge = this.manager.bridge;
    if (!bridge) return false;
    let res = null;
    try {
      res = await bridge.engineLocalStart(this.engineId, this.engineKey);
    } catch {}
    if (!res?.ok) {
      this.alive = false;
      return false;
    }
    this.alive = true;
    return this._handshake(45000);
  }
  async send(cmd) { this.manager.bridge?.engineLocalCmd(this.engineId, cmd); }
  destroy() { this.manager.bridge?.engineLocalStop(this.engineId); this.alive = false; }
}

class SocketEngine extends UciEngine {
  constructor(manager, name, priority, url, opts = {}) {
    super(manager, name, priority, "socket");
    this.url = url;
    this.socketId = opts.socketId || null;
    this.maxDepth = opts.maxDepth || null;
    this.autoReconnect = opts.autoReconnect !== false;
    this._ws = null;
    this._backoff = 2000;
    this._closed = false;
    this._queue = [];
  }

  async start() {
    const ok = await this._connect();
    if (!ok) return false;
    return this._handshake(20000);
  }

  _connect() {
    return new Promise((resolve) => {
      let ws;
      try {
        ws = makeSocket(this.manager.bridge, this.url);
      } catch {
        this.alive = false;
        resolve(false);
        return;
      }
      this._ws = ws;
      const timer = setTimeout(() => { this.alive = false; resolve(false); }, 8000);
      ws.onopen = () => {
        clearTimeout(timer);
        this.alive = true;
        this._backoff = 2000;
        const pending = this._queue.splice(0);
        for (const cmd of pending) {
          try { ws.send(cmd); } catch {}
        }
        this.manager._emit("engines", this.manager.statusList());
        resolve(true);
      };
      ws.onmessage = (ev) => {
        const data = String(ev.data || "");
        for (const line of data.split(/\r?\n/)) {
          const t = line.trim();
          if (t) this.onLine(t);
        }
      };
      ws.onerror = () => { clearTimeout(timer); resolve(false); };
      ws.onclose = () => {
        this.alive = false;
        this.ready = false;
        this.busy = false;
        this.manager._emit("engines", this.manager.statusList());
        if (this._closed || !this.autoReconnect) return;
        const delay = this._backoff;
        this._backoff = Math.min(this._backoff * 2, 30000);
        setTimeout(() => {
          if (this._closed) return;
          this._connect().then(async (ok) => {
            if (!ok) return;
            await this._handshake(20000);
            // it has been away, so it knows nothing about the current position
            this.manager.catchUp(this);
          });
        }, delay + Math.random() * 800);
      };
    });
  }

  async send(cmd) {
    if (this._ws && this._ws.readyState === 1) {
      try { this._ws.send(cmd); } catch {}
      return;
    }
    if (this._queue.length < 40) this._queue.push(cmd);
  }

  destroy() {
    this._closed = true;
    this.alive = false;
    try { this._ws?.close(); } catch {}
    this._ws = null;
  }
}

export class EngineManager {
  constructor(bridge = null) {
    this.bridge = bridge;
    this.engines = new Map();
    this.mode = RankingMode.PRIORITY;
    this.rankedMoves = [];
    this.currentFen = null;
    this.depth = 15;
    this.multipv = 1;
    this.movetime = null;
    this.nodes = null;
    this._ws = null;
    this._wsUrl = null;
    this._wsConnected = false;
    this._wsBackoff = 2000;
    this._wsEverConnected = false;
    this._listeners = new Map();
    this._infoByEngine = new Map();
  }

  on(event, fn) {
    if (typeof fn !== "function") return () => {};
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }
  _emit(event, data) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      if (typeof fn !== "function") { set.delete(fn); continue; }
      try {
        fn(data);
      } catch (e) {
        set.delete(fn);
        try { console.warn("[BM] listener removed after error on", event, e?.message || e); } catch {}
      }
    }
  }

  connectEngineWS(url = "ws://127.0.0.1:8000/ws") {
    this._wsUrl = url;
    return new Promise((resolve) => {
      try {
        this._ws = makeSocket(this.bridge, url);
      } catch { resolve(false); return; }
      const timeout = setTimeout(() => { this._wsConnected = false; resolve(false); }, 4000);
      this._ws.onopen = () => {
        clearTimeout(timeout);
        this._wsConnected = true;
        this._wsEverConnected = true;
        this._wsBackoff = 2000;
        this._wsSend({ action: "list_engines" });
        this._emit("ws", { connected: true });
        resolve(true);
      };
      this._ws.onclose = () => {
        this._wsConnected = false;
        this._emit("ws", { connected: false });
        for (const e of this.engines.values()) if (e.type === "remote") e.alive = false;
        this._emit("engines", this.statusList());
        const delay = this._wsBackoff;
        this._wsBackoff = Math.min(this._wsBackoff * 2, 30000);
        setTimeout(() => { if (this._wsUrl) this.connectEngineWS(this._wsUrl); }, delay + Math.random() * 1000);
      };
      this._ws.onerror = () => { clearTimeout(timeout); resolve(false); };
      this._ws.onmessage = (ev) => this._onWsMessage(ev.data);
    });
  }

  disconnectEngineWS() {
    this._wsUrl = null;
    try { this._ws?.close(); } catch {}
    this._ws = null;
    this._wsConnected = false;
    for (const [name, eng] of [...this.engines]) {
      if (eng.type === "remote") this.engines.delete(name);
    }
    this._emit("ws", { connected: false });
    this._emit("engines", this.statusList());
  }

  get wsConnected() { return this._wsConnected; }

  _wsSend(obj) {
    if (this._ws && this._ws.readyState === 1) this._ws.send(JSON.stringify(obj));
  }

  sendWs(obj) {
    this._wsSend(obj);
  }

  _onWsMessage(data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    this._emit("wsmsg", msg);
    switch (msg.type) {
      case "engines":
        this._syncRemoteEngines(msg.engines || []);
        break;
      case "info":
        this._handleInfo(msg.engine, msg.raw || "", msg.parsed);
        break;
      case "bestmove":
        this._handleBestmove(msg.engine, msg.move, msg.ponder);
        break;
      case "engine_died":
      case "engine_restarted":
        this._wsSend({ action: "list_engines" });
        break;
    }
  }

  _syncRemoteEngines(serverEngines) {
    const seen = new Set();
    for (const se of serverEngines) {
      seen.add(se.name);
      let eng = this.engines.get(se.name);
      if (!eng || eng.type !== "remote") {
        eng = new RemoteEngine(this, se.name, se.priority);
        this.engines.set(se.name, eng);
      }
      eng.alive = se.alive;
      eng.busy = se.busy;
      eng.priority = se.priority;
      eng.lastBestmove = se.last_bestmove;
    }
    for (const [name, eng] of [...this.engines]) {
      if (eng.type === "remote" && !seen.has(name)) this.engines.delete(name);
    }
    this._emit("engines", this.statusList());
  }

  async addLocalEngine(name, priority = null, engineKey = "stockfish18") {
    const prio = priority ?? this._nextPriority();
    const eng = new LocalEngine(this, name, prio, engineKey);
    this.engines.set(name, eng);
    const ok = await eng.start();
    // it may have missed the position that was set while it was starting
    if (ok) this.catchUp(eng);
    this._emit("engines", this.statusList());
    return ok;
  }

  async addSocketEngine(name, url, priority = null, opts = {}) {
    const prio = priority ?? this._nextPriority();
    const existing = this.engines.get(name);
    if (existing) {
      if (existing.url === url) {
        existing.priority = prio;
        this._emit("engines", this.statusList());
        return existing.alive;
      }
      this.removeEngine(name);
    }
    const eng = new SocketEngine(this, name, prio, url, opts);
    this.engines.set(name, eng);
    const ok = await eng.start();
    if (ok) this.catchUp(eng);
    this._emit("engines", this.statusList());
    return ok;
  }

  socketEngineNames() {
    return [...this.engines.values()].filter((e) => e.type === "socket").map((e) => e.name);
  }

  attachBridge(bridge) {
    this.bridge = bridge;
    bridge.onPush("engine.local.line", ({ engineId, line }) => {
      for (const eng of this.engines.values()) {
        if (eng.type === "local" && eng.engineId === engineId) eng.onLine(line);
      }
    });
    bridge.onPush("engine.local.error", ({ engineId }) => {
      for (const eng of this.engines.values()) {
        if (eng.type !== "local" || eng.engineId !== engineId) continue;
        if (eng.ready) continue;
        eng.alive = false;
        this._emit("engines", this.statusList());
      }
    });
  }

  removeEngine(name) {
    const eng = this.engines.get(name);
    if (!eng) return;
    if (eng.type === "local") eng.destroy();
    this.engines.delete(name);
    this._emit("engines", this.statusList());
  }

  setPriorityOrder(names) {
    names.forEach((n, i) => {
      const eng = this.engines.get(n);
      if (eng) eng.priority = i + 1;
    });
    if (this._wsConnected) this._wsSend({ action: "set_priority", order: names });
    this._emit("engines", this.statusList());
    this._rerank();
  }

  setSkill(name, { skillLevel = null, uciElo = null } = {}) {
    const eng = this.engines.get(name);
    if (!eng) return;
    if (eng.type === "remote") {
      this._wsSend({ action: "set_skill", engine: name, skill_level: skillLevel, uci_elo: uciElo });
    } else {
      if (skillLevel != null) eng.setOption("Skill Level", skillLevel);
      if (uciElo != null) {
        eng.setOption("UCI_LimitStrength", "true");
        eng.setOption("UCI_Elo", uciElo);
      }
    }
  }

  _nextPriority() {
    const ps = [...this.engines.values()].map((e) => e.priority);
    return ps.length ? Math.max(...ps) + 1 : 1;
  }

  statusList() {
    return [...this.engines.values()]
      .sort((a, b) => a.priority - b.priority)
      .map((e) => ({
        name: e.name, type: e.type, priority: e.priority,
        alive: e.alive, busy: e.busy, ready: e.ready,
        lastBestmove: e.lastBestmove,
      }));
  }

  optionsFor(engineName) {
    return this.engines.get(engineName)?.uciOptions || [];
  }

  applyOptionValues(engineName, values = {}) {
    const eng = this.engines.get(engineName);
    if (!eng) return;
    for (const [name, raw] of Object.entries(values)) {
      if (raw == null || raw === "") continue;
      const opt = eng.uciOptions.find((o) => o.name === name);
      if (opt?.type === "button") continue;
      let v = raw;
      if (opt?.type === "spin") v = clampToOption(eng.uciOptions, name, Number(raw));
      else if (opt?.type === "check") v = raw === true || raw === "true" ? "true" : "false";
      eng.setOption(name, v).catch(() => {});
    }
  }

  configure({ depth, multipv, movetime, nodes, mode } = {}) {
    if (depth != null) this.depth = depth;
    if (multipv != null) this.multipv = multipv;
    if (movetime !== undefined) this.movetime = movetime;
    if (nodes !== undefined) this.nodes = nodes;
    if (mode) this.mode = mode;
  }

  analyze(fen) {
    this.currentFen = fen;
    this.rankedMoves = [];
    this._infoByEngine.clear();
    this._lastOpts = { depth: this.depth, movetime: this.movetime, nodes: this.nodes, multipv: this.multipv };
    for (const eng of this.engines.values()) {
      if (!eng.alive) continue;
      eng.searchFen = fen;
      eng.analyze(fen, this._lastOpts);
    }
  }

  // An engine that was not up when the position arrived never got told about
  // it, and nothing used to go back for it. That is why the opening move often
  // produced nothing at all - at page load every engine is still starting, so
  // the request was dropped by all of them - and why a engine that died and
  // came back would sit on a stale search while the game moved on.
  _scheduleCatchUp(engine) {
    if (!engine || engine._catchUpQueued) return;
    engine._catchUpQueued = true;
    setTimeout(() => {
      engine._catchUpQueued = false;
      this.catchUp(engine);
    }, 150);
  }

  catchUp(engine = null) {
    const fen = this.currentFen;
    if (!fen) return false;
    const opts = this._lastOpts || {
      depth: this.depth, movetime: this.movetime, nodes: this.nodes, multipv: this.multipv,
    };
    const targets = engine ? [engine] : [...this.engines.values()];
    let started = false;
    for (const eng of targets) {
      if (!eng || !eng.alive || eng.searchFen === fen) continue;
      eng.searchFen = fen;
      eng.analyze(fen, opts);
      started = true;
    }
    return started;
  }

  stopAll() {
    for (const eng of this.engines.values()) eng.stop();
  }

  // Used when something other than the engines is answering, such as the book.
  // The engines are stopped, so whatever they last reported belongs to an
  // earlier position: leaving it in place makes the readout look like it is
  // stuck on the previous move, and lets auto play choose a move that is not
  // legal in the position actually on the board.
  clearAnalysis(fen = null) {
    this.currentFen = fen;
    this.rankedMoves = [];
    this._infoByEngine.clear();
    for (const eng of this.engines.values()) eng.searchFen = null;
    this._emit("ranked", []);
  }

  destroyAll() {
    for (const eng of [...this.engines.values()]) {
      try { eng.stop(); } catch {}
      try { eng.destroy?.(); } catch {}
    }
    this.engines.clear();
    this.rankedMoves = [];
    this._infoByEngine.clear();
    this.disconnectEngineWS();
    this._emit("engines", this.statusList());
    this._emit("ranked", []);
  }

  newGameAll() {
    for (const eng of this.engines.values()) eng.newGame();
    this.rankedMoves = [];
    this._infoByEngine.clear();
    this._emit("ranked", []);
  }

  _handleInfo(engineName, rawLine, parsed = null) {
    const p = parsed || this._parseInfo(rawLine);
    if (!p) return;
    const mpv = p.multipv || 1;
    let byMpv = this._infoByEngine.get(engineName);
    if (!byMpv) {
      byMpv = new Map();
      this._infoByEngine.set(engineName, byMpv);
    }
    const eng0 = this.engines.get(engineName);
    if (eng0 && eng0.searchFen && eng0.searchFen !== this.currentFen) {
      // It is still working on a position we have moved on from, so its output
      // is useless and dropping it is right. Dropping it forever is not: an
      // engine that missed a position stays on it and goes quiet for the rest
      // of the game, which is what made analysis look stuck on the opponent's
      // move. Point it at the live position instead.
      this._scheduleCatchUp(eng0);
      return;
    }
    p.fen = eng0?.searchFen || this.currentFen;
    const prev = byMpv.get(mpv);
    if (prev && (p.depth || 0) < (prev.depth || 0)) return;
    byMpv.set(mpv, p);
    const eng = this.engines.get(engineName);
    if (eng && mpv === 1) eng.lastInfo = p;
    if (mpv === 1 && (p.scoreCp != null || p.scoreMate != null)) {
      this._emit("eval", {
        engine: engineName,
        depth: p.depth, scoreCp: p.scoreCp ?? null, scoreMate: p.scoreMate ?? null,
        nodes: p.nodes, nps: p.nps, time: p.time,
      });
    }
    this._rerank();
  }

  _parseInfo(line) {
    const parts = line.split(" ");
    const p = {};
    for (let i = 1; i < parts.length; i++) {
      switch (parts[i]) {
        case "depth": p.depth = +parts[++i]; break;
        case "multipv": p.multipv = +parts[++i]; break;
        case "score":
          if (parts[i + 1] === "cp") { p.scoreCp = +parts[i + 2]; i += 2; }
          else if (parts[i + 1] === "mate") { p.scoreMate = +parts[i + 2]; i += 2; }
          break;
        case "nodes": p.nodes = +parts[++i]; break;
        case "nps": p.nps = +parts[++i]; break;
        case "time": p.time = +parts[++i]; break;
        case "pv": p.pv = parts.slice(i + 1); i = parts.length; break;
      }
    }
    return p.depth != null ? p : null;
  }

  _handleBestmove(engineName, move, ponder) {
    const eng = this.engines.get(engineName);
    if (eng) {
      eng.busy = false;
      eng.lastBestmove = move;
      eng.lastBestmoveFen = eng.searchFen || null;
    }
    if (!isNullMove(move)) {
      this._emit("bestmove", { engine: engineName, move, ponder, rank: this._rankOf(engineName) });
    }
    this._rerank();
    this._emit("engines", this.statusList());
  }

  _rankOf(engineName) {
    const eng = this.engines.get(engineName);
    return eng ? eng.priority : 99;
  }

  _movesByEngine() {
    const perEngine = [];
    for (const [name, eng] of this.engines) {
      const list = [];
      const byMpv = this._infoByEngine.get(name);
      if (byMpv && byMpv.size) {
        const sorted = [...byMpv.entries()].sort((a, b) => a[0] - b[0]);
        for (const [mpv, info] of sorted) {
          const move = info.pv?.[0];
          if (isNullMove(move)) continue;
          if (info.fen && this.currentFen && info.fen !== this.currentFen) continue;
          const rm = new RankedMove(move, name, eng.priority, info.scoreCp ?? null, info.scoreMate ?? null, info.pv || []);
          rm.multipv = mpv;
          rm.depth = info.depth ?? null;
          list.push(rm);
        }
      } else if (!isNullMove(eng.lastBestmove) && eng.lastBestmoveFen === this.currentFen) {
        const rm = new RankedMove(eng.lastBestmove, name, eng.priority, null, null, []);
        rm.multipv = 1;
        list.push(rm);
      }
      if (!list.length) continue;
      const cap = eng.linesWanted || this.multipv || 1;
      perEngine.push({ eng, moves: list.slice(0, cap) });
    }
    perEngine.sort((a, b) => a.eng.priority - b.eng.priority);
    return perEngine;
  }

  _rerank() {
    const perEngine = this._movesByEngine();
    if (!perEngine.length) return;

    let ordered = [];
    if (this.mode === RankingMode.SMART) {
      ordered = perEngine.flatMap((p) => p.moves);
      ordered.sort((a, b) => this._scoreValue(b) - this._scoreValue(a));
    } else if (this.mode === RankingMode.ROUNDROBIN) {
      const depth = Math.max(...perEngine.map((p) => p.moves.length));
      for (let i = 0; i < depth; i++) {
        for (const p of perEngine) {
          if (p.moves[i]) ordered.push(p.moves[i]);
        }
      }
    } else {
      ordered = perEngine.flatMap((p) => p.moves);
    }

    const seen = new Set();
    const deduped = [];
    for (const m of ordered) {
      if (seen.has(m.move)) continue;
      seen.add(m.move);
      m.rank = deduped.length + 1;
      deduped.push(m);
    }
    this.rankedMoves = deduped;
    this._emitRankedThrottled();
  }

  _emitRankedThrottled() {
    const now = Date.now();
    const elapsed = now - (this._lastRankedEmit || 0);
    if (elapsed >= RANKED_EMIT_MS) {
      this._lastRankedEmit = now;
      this._emit("ranked", this.rankedMoves);
      return;
    }
    if (this._rankedEmitTimer) return;
    this._rankedEmitTimer = setTimeout(() => {
      this._rankedEmitTimer = null;
      this._lastRankedEmit = Date.now();
      this._emit("ranked", this.rankedMoves);
    }, RANKED_EMIT_MS - elapsed);
  }

  _scoreValue(m) {
    if (m.scoreMate != null) return m.scoreMate > 0 ? 100000 + m.scoreMate : -100000 + m.scoreMate;
    return m.scoreCp ?? 0;
  }

  getBestMove() { return this.rankedMoves[0] || null; }
  getMoveAtRank(rank) { return this.rankedMoves.find((m) => m.rank === rank) || null; }
}
