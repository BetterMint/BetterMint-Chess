import { Chess } from "../../vendor/chess.js";
import { SettingsBridge } from "./SettingsBridge.js";
import { SiteDetector } from "../sites/SiteDetector.js";
import { EngineManager, RankingMode, RankedMove, clampToOption } from "../engine/EngineManager.js";
import { BuiltinEngines, enabledKey, priorityKey, linesKey } from "../engine/BuiltinEngines.js";
import { resolveSocketBase, socketUrl, parseSocketList, maiaIdForElo } from "../engine/SocketCatalog.js";
import { Humanizer } from "../engine/Humanizer.js";
import { BookManager } from "../books/BookManager.js";
import { BoardOverlay } from "../board/BoardOverlay.js";
import { VariantDetector, VARIANTS } from "../board/VariantDetector.js";
import { HUD } from "../ui/HUD.js";
import { AutoMove } from "../features/AutoMove.js";
import { AutoQueue } from "../features/AutoQueue.js";
import { HandBrain } from "../features/HandBrain.js";
import { EloMatch } from "../features/EloMatch.js";
import { OverlayWindow } from "../features/OverlayWindow.js";
import { Exploits } from "../features/Exploits.js";
import { Privacy } from "../features/Privacy.js";
import { Coach, COACH_VOICE_MAP } from "../features/Coach.js";
import { rankColor, rankAlpha } from "../ui/RankColors.js";
import { ScriptManager } from "../lua/ScriptManager.js";

class EventBus {
  constructor() { this._map = new Map(); }
  on(name, fn) {
    if (typeof fn !== "function") return () => {};
    if (!this._map.has(name)) this._map.set(name, new Set());
    this._map.get(name).add(fn);
    return () => this._map.get(name)?.delete(fn);
  }
  emit(name, data) {
    this._map.get(name)?.forEach((fn) => { try { fn(data); } catch {} });
  }
}

const START_BOARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

export class App {
  constructor() {
    this.settings = new SettingsBridge();
    this.events = new EventBus();
    this.detector = new SiteDetector();
    this.engineManager = new EngineManager(this.settings);
    this.humanizer = new Humanizer();
    this.bookManager = new BookManager(this.settings);
    this.overlay = new BoardOverlay(this.settings);
    this.hud = new HUD(this.settings);
    this.autoMove = new AutoMove(this.settings, this.humanizer);
    this.autoQueue = new AutoQueue(this.settings);
    this.handBrain = new HandBrain(this.settings);
    this.eloMatch = new EloMatch(this.settings);
    this.variants = new VariantDetector(this.settings);
    this.exploits = new Exploits(this);
    this.privacy = new Privacy(this);
    this.coach = new Coach(this);
    this.overlayWindow = new OverlayWindow(this.settings);
    this.scripts = new ScriptManager(this);
    this.chess = new Chess();
    this.hostKind = "generic";
    this.boardCandidate = null;
    this.currentFen = null;
    this.currentStage = null;
    this.lastBookQuery = null;
    this._fenTimer = null;
    this._scriptStore = {};
    this._debug = false;
    this._rankedPicked = null;
    this._toasts = [];
    this._lastRanked = null;
    this._oppAnalysis = { matches: 0, total: 0, warned: false };
  }

  async init() {
    await this.settings.init();
    this._debug = !!this.settings.get("stealth.debugLogs");
    this.settings.onChange(() => this._applySettings());

    this.hostKind = this.detector._hostKind();
    this.settings.requestRaw("site.present", { host: this.hostKind }, 3000).catch(() => {});
    this.detector.on("board", (r) => this._onBoardFound(r));
    this.detector.on("board-lost", () => this._onBoardLost());
    this.detector.start();

    this.engineManager.attachBridge(this.settings);
    this.bookManager.attachEngineWS(this.engineManager);
    this.bookManager.attachFetcher((url, timeout) => this._cloudFetch(url, timeout));

    this.hud.shadow.mount();
    this.hud.onMoveClick = (m) => this._spotlightMove(m);
    this.settings.requestRaw("assets.base", {}, 3000)
      .then((r) => { if (r?.base) this.hud.setLogo(`${r.base}img/logo-48.png`); })
      .catch(() => {});
    this.privacy.install();
    this._wireEngineEvents();
    this._applySettings();
    await this.scripts.init();
    this.autoQueue.start(this.hostKind);
    this._startFenWatcher();
    const adopted = () => {
      this._syncOverlayWindow();
      this._refreshActions();
    };
    if (this.overlayWindow.restore(adopted)) adopted();
    this.log("app initialized on", this.hostKind, "- engines idle until a board is found");
  }

  async _ensureEnginesStarted() {
    if (this._enginesStarted) return;
    this._enginesStarted = true;
    this.log("board present - starting engines and books");
    this._loadBooks();
    await this._connectEngines();
  }

  log(...args) {
    if (this._debug || this.settings.get("stealth.debugLogs")) {
      try { console.log("[BM]", ...args); } catch {}
    }
  }

  tagEvent(evt) {
    try { Object.defineProperty(evt, "__uxT", { value: 1, configurable: true }); } catch {}
    return evt;
  }

  luaLog(scriptName, text, isError = false) {
    if (this.settings.get("lua.debugLog") || isError) {
      try { console.log(`[lua:${scriptName}]`, text); } catch {}
    }
    this.events.emit("lualog", { script: scriptName, text, isError });
  }

  toast(text) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;bottom:20px;right:20px;background:rgba(13,17,23,0.95);color:#e6edf3;padding:10px 16px;border-radius:10px;border:1px solid rgba(74,222,128,0.4);font:600 13px system-ui;z-index:1;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.3s;";
    el.textContent = String(text);
    this.hud.shadow.container.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, 2400);
    setTimeout(() => el.remove(), 2800);
  }

  async _loadBooks() {
    try {
      const list = await this.settings.requestRaw("books.list", {}, 4000);
      if (!Array.isArray(list)) return;
      for (const meta of list) {
        const full = await this.settings.requestRaw("books.get", { name: meta.name }, 20000);
        if (full?.base64) {
          this.bookManager.addLocalBook(full.name, this._base64ToBuffer(full.base64), full.stage || "opening");
        }
      }
      this.log("books loaded:", list.length);
    } catch {}
  }

  _base64ToBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  _engineWsHttp() {
    try {
      const u = new URL(this.settings.get("engine.wsUrl"));
      const scheme = u.protocol === "wss:" ? "https:" : "http:";
      return { base: `${scheme}//${u.host}`, token: u.searchParams.get("token") || "" };
    } catch {
      return null;
    }
  }

  async _cloudFetch(url, timeout = 4000) {
    if (this.engineManager.wsConnected) {
      try {
        const u = new URL(url);
        const fenMatch = u.search.match(/fen=([^&]+)/);
        const isExplorer = /explorer\.lichess\.ovh\/(masters|lichess|player)/.test(url);
        const isTb = /tablebase\.lichess\.ovh/.test(url);
        const ws = this._engineWsHttp();
        let endpoint = null;
        if (ws) {
          const tok = ws.token ? `&token=${encodeURIComponent(ws.token)}` : "";
          if (isExplorer) endpoint = `${ws.base}/api/explorer?fen=${fenMatch ? fenMatch[1] : ""}&source=${u.pathname.split("/").pop()}&moves=${(u.search.match(/moves=(\d+)/) || [])[1] || 12}${tok}`;
          if (isTb) endpoint = `${ws.base}/api/tablebase?fen=${fenMatch ? fenMatch[1] : ""}${tok}`;
        }
        if (endpoint) {

          const data = await this.settings.proxyFetchJson(endpoint, timeout);
          if (data && !data.error) return data;
        }
      } catch {}
    }

    let headers = null;
    if (/explorer\.lichess\.(ovh|org)/.test(url)) {
      const token = String(this.settings.get("book.lichessToken") || "").trim();
      if (token) headers = { Authorization: `Bearer ${token}` };
      else if (!this._warnedExplorerToken) {
        this._warnedExplorerToken = true;
        this.log("lichess opening explorer needs a personal API token — set it in Books, or cloud book lines stay empty");
      }
    }
    return this.settings.proxyFetchJson(url, timeout, headers);
  }

  async _connectEngines() {
    const cfg = () => this.engineManager.configure({
      depth: this.settings.get("engine.depth"),
      multipv: this.settings.get("engine.multipv"),
      movetime: this.settings.get("engine.movetime") || null,
      nodes: this.settings.get("engine.nodes") || null,
      mode: this.settings.get("engine.rankingMode"),
    });
    cfg();

    if (this.settings.get("engine.useRemote")) {
      this.engineManager.connectEngineWS(this.settings.get("engine.wsUrl")).then((ok) => {
        this.log("EngineWS connected:", ok);
      });
    }
    await this._syncBuiltinEngines();
    await this._syncSocketEngines();
  }

  async _syncSocketEngines() {
    const enabled = this.settings.get("ws.socketsEnabled");
    const base = resolveSocketBase(this.settings);
    const wanted = enabled ? parseSocketList(this.settings.get("ws.socketsJson")).filter((e) => e.enabled) : [];
    const wantedNames = new Set(wanted.map((e) => e.label));

    for (const name of this.engineManager.socketEngineNames()) {
      if (!wantedNames.has(name)) this.engineManager.removeEngine(name);
    }

    for (const entry of wanted) {
      const url = entry.url || socketUrl(base, entry.id);
      const ok = await this.engineManager.addSocketEngine(entry.label, url, entry.priority, {
        socketId: entry.id,
        maxDepth: entry.depth || (entry.id.startsWith("maia-") ? 7 : null),
      });
      this.log("socket engine", entry.id, ok ? "connected" : "failed", url);
      if (ok) this._applyEngineOptions(entry.label);
    }
  }

  async _syncBuiltinEngines() {
    const master = this.settings.get("engine.useLocal");
    let added = false;
    for (const e of BuiltinEngines) {
      const want = master && !!this.settings.get(enabledKey(e.key));
      const priority = this.settings.get(priorityKey(e.key)) || e.defPriority;
      const lines = Number(this.settings.get(linesKey(e.key))) || 0;
      const existing = this.engineManager.engines.get(e.name);
      if (want && !existing) {
        if (e.needsSharedArrayBuffer && typeof SharedArrayBuffer === "undefined") {
          this.log("built-in engine", e.key, "skipped: SharedArrayBuffer not available");
          continue;
        }
        const ok = await this.engineManager.addLocalEngine(e.name, priority, e.key);
        this.log("built-in engine", e.key, ok ? "started" : "failed");
        if (ok) {
          const eng = this.engineManager.engines.get(e.name);
          if (eng) eng.lines = lines;
          this._applyEngineOptions(e.name);
          added = true;
        }
      } else if (!want && existing && existing.type === "local") {
        this.engineManager.removeEngine(e.name);
      } else if (want && existing) {
        if (existing.priority !== priority) {
          existing.priority = priority;
          this.engineManager._emit("engines", this.engineManager.statusList());
        }
        existing.lines = lines;
      }
    }
    if (added && this.currentFen) this.engineManager.analyze(this.currentFen);
  }

  _engineOptionValues(engineName) {
    const prefix = `engineOpt::${engineName}::`;
    const out = {};
    for (const [k, v] of Object.entries(this.settings.getAll())) {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    }
    return out;
  }

  _applyEngineOptions(engineName) {
    const eng = this.engineManager.engines.get(engineName);
    if (!eng) return;
    const opts = eng.uciOptions || [];
    if (opts.some((o) => o.name === "Threads")) {
      let threads = this.settings.get("engine.threads");
      if (eng.type === "local" && typeof SharedArrayBuffer === "undefined") threads = 1;
      eng.setOption("Threads", clampToOption(opts, "Threads", threads)).catch(() => {});
    }
    if (opts.some((o) => o.name === "Hash")) {
      let hash = Number(this.settings.get("engine.hash"));
      if (eng.type === "local") {
        let cap = Number(this.settings.get("engine.wasmHashCap")) || 32;
        if (this._isMobile()) cap = Math.min(cap, Number(this.settings.get("stealth.mobileHashCap")) || 16);
        hash = Math.min(hash, cap);
      }
      eng.setOption("Hash", clampToOption(opts, "Hash", hash)).catch(() => {});
    }
    this.engineManager.applyOptionValues(engineName, this._engineOptionValues(engineName));
  }

  _wireEngineEvents() {
    this.engineManager.on("ranked", (moves) => this._onRankedMoves(moves));
    this.engineManager.on("eval", ({ scoreCp, scoreMate, depth }) => {
      const sign = this._evalSign();
      this.hud.setEval(
        scoreCp == null ? null : scoreCp * sign,
        scoreMate == null ? null : scoreMate * sign,
        depth,
        this.settings.get("engine.depth"),
      );

      this._lastEval = { scoreCp, scoreMate, depth };
      this._syncOverlayWindow();
    });
    this.engineManager.on("engines", (list) => this.hud.setEngines(list));
    this.engineManager.on("bestmove", () => {});
    this.engineManager.on("uciOptions", ({ engine, uciName, options }) => {
      this.settings.requestRaw("uci.saveOptions", { engine, uciName, options }, 4000).catch(() => {});
      this._applyEngineOptions(engine);
      this.log("uci options discovered:", engine, options.length);
    });
  }

  _onBoardFound(result) {
    this.boardCandidate = result.board;
    this._ensureEnginesStarted();
    this.exploits.attach(result.host);
    this.overlay.attach(this.boardCandidate.el, this.boardCandidate.flipped);
    this.hud.mount();
    this.hud.refreshPosition();
    this.hud.setFlipped(this.boardCandidate.flipped);
    this.events.emit("boardfound", { host: result.host });

    const adopted = () => {
      this._syncOverlayWindow();
      this._refreshActions();
    };
    if (this.overlayWindow.restore(adopted)) adopted();
    this._refreshActions();
    this._updatePosition(true);
  }

  _onBoardLost() {
    this.boardCandidate = null;
    this.overlay.detach();
    this.currentFen = null;
  }

  _startFenWatcher() {
    let lastFen = null;
    let pending = null;
    let stable = 0;

    this._fenTimer = setInterval(() => {
      if (!this.boardCandidate) return;
      const fen = this.detector.extractFEN(this.boardCandidate);
      if (!fen || !this._fenPlausible(fen)) return;

      if (fen !== pending) {
        pending = fen;
        stable = 1;
        return;
      }
      stable++;
      if (stable < 2) return;

      if (fen !== lastFen) {
        lastFen = fen;
        this._onNewFen(fen);
        return;
      }
      this._checkAnalysisStall();
      this._checkAutoMoveStall();
    }, 180);
  }

  _fenPlausible(fen) {
    const placement = String(fen).split(/\s+/)[0] || "";
    let white = 0;
    let black = 0;
    for (const ch of placement) {
      if (ch === "K") white++;
      else if (ch === "k") black++;
    }
    return white === 1 && black === 1;
  }

  _checkAutoMoveStall() {
    if (!this.settings.get("auto.enabled") || !this.currentFen) return;
    if (this.autoMove._busy || this.autoMove._timer) return;
    if (this.handBrain.blocksAuto || !this.isOurTurn()) return;
    const moves = this.engineManager.rankedMoves;
    if (!moves.length) return;

    if (this._autoStallFen !== this.currentFen) {
      this._autoStallFen = this.currentFen;
      this._autoStallSince = Date.now();
      this._autoStallTries = 0;
      return;
    }
    const budget = 3000 + Number(this.settings.get("auto.fixedDelayMs") || 0);
    if (Date.now() - (this._autoStallSince || 0) < budget) return;
    if ((this._autoStallTries || 0) >= 3) return;
    this._autoStallTries = (this._autoStallTries || 0) + 1;
    this._autoStallSince = Date.now();
    this.log("auto-move idle on our turn - retry", this._autoStallTries);

    this.autoMove._lastPlayedFen = null;
    this.autoMove.consider({
      fen: this.currentFen,
      chess: this.chess,
      rankedMoves: moves,
      bookPick: null,
      ourTurn: true,
      ourColor: this._ourColor(),
      playMove: (uci) => this.playMove(uci),
      verify: (atFen, uci) => this._autoMoveStillValid(atFen, uci),
      timePressure: this.exploits.opponentInTimePressure(),
    });
  }

  _checkAnalysisStall() {
    if (!this.settings.get("auto.enabled") || !this.currentFen) return;
    if (!this.isOurTurn() || this.autoMove._busy) return;

    if (!this._engineAnswering) return;
    const since = this._analyzeStartedAt ? Date.now() - this._analyzeStartedAt : 0;
    if (since < 8000) return;
    if (this.engineManager.rankedMoves.length) return;
    if ((this._stallRetries || 0) >= 2) return;
    this._stallRetries = (this._stallRetries || 0) + 1;
    this.log("analysis stalled for", since, "ms — restarting engines, attempt", this._stallRetries);
    this._analyzeStartedAt = Date.now();
    this.engineManager.stopAll();
    this._syncBuiltinEngines().then(() => this.engineManager.analyze(this.currentFen));
  }

  async _onNewFen(fen) {
    const prevFen = this.currentFen;
    this.currentFen = fen;
    this.autoMove.notePosition(fen);
    if (prevFen && prevFen !== fen) this._queueCoachReport(prevFen, fen);
    try { this.chess.load(fen); } catch {}
    this._bindCoachToGame();
    this._maybeEmitGameOver();
    this.events.emit("fen", { fen });
    this._syncVariant(fen);
    this._maybeApplyEloMatch();
    this._trackOppAnalysis(prevFen, fen);
    try {

      const atStart = String(fen).split(" ")[0] === START_BOARD;
      if (atStart && this._hadMoves) {
        this.events.emit("newgame", {});
        this.autoQueue.resetForNewGame();
        this.engineManager.newGameAll();
        this.autoMove.newGame();
        this.coach.resetGame();
        this._oppAnalysis = { matches: 0, total: 0, warned: false };
        this._lastRanked = null;
      }
      this._hadMoves = !atStart;
    } catch {}
    this._updatePosition(false);
  }

  async _updatePosition(isNewBoard) {
    if (!this.currentFen || !this.boardCandidate) return;
    const fen = this.currentFen;

    this.overlay.setFlipped(this.boardCandidate.flipped);
    this.hud.setFlipped(this.boardCandidate.flipped);

    const bookQuery = await this.bookManager.queryLines(fen);
    this.lastBookQuery = bookQuery;
    this.currentStage = bookQuery.stage;
    this.hud.setStage(bookQuery.stage);
    this.hud.setBookLines(bookQuery.lines);
    if (bookQuery.stage !== this._lastStage) {
      this._lastStage = bookQuery.stage;
      this.events.emit("stage", { stage: bookQuery.stage });
    }

    const bookPick = this.bookManager.pickMove(bookQuery);
    const useBook = bookPick && this.settings.get("book.preferOverEngine");
    this._lastPickSource = bookPick?.source || null;

    this._engineAnswering = !useBook;
    if (!useBook) {
      this._analyzeStartedAt = Date.now();
      this._stallRetries = 0;
      this.engineManager.analyze(fen);
      this._considerCloudEval(fen).catch(() => {});
    } else {
      this.engineManager.stopAll();

      this.engineManager.clearAnalysis(fen);
      this._lastEval = null;
    }

    this._drawBoardHints(bookQuery, useBook);
    this._syncOverlayWindow();

    if (!this.isOurTurn()) this.handBrain.clear();

    if (this.isOurTurn() && !this.handBrain.blocksAuto) {
      const movesForAuto = this.engineManager.rankedMoves.length
        ? this.engineManager.rankedMoves
        : (bookQuery.lines.length ? bookQuery.lines.filter((l) => l?.move).map((l, i) => ({ move: l.move, rank: i + 1 })) : []);
      this.autoMove.consider({
        fen,
        chess: this.chess,
        rankedMoves: movesForAuto,
        bookPick,
        ourTurn: this.isOurTurn(),
        ourColor: this._ourColor(),
        playMove: (uci) => this.playMove(uci),
        verify: (atFen, uci) => this._autoMoveStillValid(atFen, uci),
        timePressure: this.exploits.opponentInTimePressure(),
      });
    }
  }

  _tryMoveBetween(fenBefore, targetBoard) {
    try {
      const tmp = new Chess(fenBefore);
      for (const m of tmp.moves({ verbose: true })) {
        const probe = new Chess(fenBefore);
        probe.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
        if (probe.fen().split(" ")[0] === targetBoard) {
          return { uci: m.from + m.to + (m.promotion || ""), san: m.san, color: m.color };
        }
      }
    } catch {}
    return null;
  }

  _flipTurn(fen) {
    const parts = String(fen || "").split(" ");
    if (parts.length < 2) return null;
    parts[1] = parts[1] === "w" ? "b" : "w";
    return parts.join(" ");
  }

  _moveBetween(fenBefore, fenAfter) {
    const targetBoard = String(fenAfter || "").split(" ")[0];
    if (!targetBoard) return null;
    const direct = this._tryMoveBetween(fenBefore, targetBoard);
    if (direct) return direct;

    const flipped = this._flipTurn(fenBefore);
    return flipped ? this._tryMoveBetween(flipped, targetBoard) : null;
  }

  _materialOf(fen) {
    const vals = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let score = 0;
    for (const ch of (fen.split(" ")[0] || "")) {
      const v = vals[ch.toLowerCase()];
      if (v == null) continue;
      score += ch === ch.toUpperCase() ? v : -v;
    }
    return score;
  }

  _queueCoachReport(fenBefore, fenAfter) {
    if (!this.coach.enabled) return;

    let info = this._moveBetween(fenBefore, fenAfter);
    if (!info && this._lastGoodFen && this._lastGoodFen !== fenBefore) {
      info = this._moveBetween(this._lastGoodFen, fenAfter);
      if (info) fenBefore = this._lastGoodFen;
    }
    if (!info) return;
    this._lastGoodFen = fenAfter;
    const ours = this._ourColor();
    const isOurs = info.color === ours;
    if (!this.settings.get("coach.coachBoth") && !isOurs) return;
    const sign = info.color === "w" ? 1 : -1;
    const materialDelta = (this._materialOf(fenAfter) - this._materialOf(fenBefore)) * sign;
    this._pendingCoach = { fenBefore, fenAfter, move: info.uci, san: info.san, materialDelta, isOurs };
  }

  _noteCoachPosition(moves) {
    if (!this.coach.enabled || !this.currentFen || !moves?.length) return;
    let legalCount = null;
    try { legalCount = this.chess.moves().length; } catch {}
    const lines = this.lastBookQuery?.lines || [];
    this.coach.notePosition(this.currentFen, {
      bestMove: moves[0].move,
      evalCp: moves[0].scoreCp ?? (moves[0].scoreMate != null ? (moves[0].scoreMate > 0 ? 2000 : -2000) : null),
      secondCp: moves[1]?.scoreCp ?? null,
      legalCount,
      inBook: !!lines.length && !lines.every((l) => l.isTablebase),
      isTablebase: !!lines.length && lines.every((l) => l.isTablebase),
    });
  }

  _maybeEmitCoach(depth) {
    const p = this._pendingCoach;
    if (!p || !this.coach.enabled) return;
    if (this.currentFen !== p.fenAfter) return;
    if ((depth || 0) < Number(this.settings.get("coach.minDepth"))) return;
    const top = this.engineManager.rankedMoves[0];
    if (!top) return;
    const evalAfter = top.scoreCp ?? (top.scoreMate != null ? (top.scoreMate > 0 ? 2000 : -2000) : null);
    if (evalAfter == null) return;
    this._pendingCoach = null;
    const rep = this.coach.report({ ...p, evalAfter });
    if (!rep) return;
    this.hud.setCoach(rep, this.coach.accuracy());

    if (rep.isOurs && !rep.alreadyGraded) {
      this.coach.speak(rep);
      this.overlayWindow.setCoachReport?.(rep);
      this.overlay.addHighlight?.(p.move.slice(2, 4), rep.color, { style: "ring", alpha: 0.9 });
      setTimeout(() => this.overlay.clearHighlights?.(), 2200);
    } else if (!rep.alreadyGraded) {
      this.overlayWindow.setCoachReport?.(rep);
    }
  }

  _whiteSign() {
    try { return this.chess.turn() === "w" ? 1 : -1; } catch { return 1; }
  }

  _evalSign() {
    const mode = this.settings.get("ui.evalPerspective") || "player";
    if (mode === "engine") return 1;
    const fen = this.currentFen || "";
    const parts = fen.split(" ");
    const turn = parts[1] || "w";
    if (mode === "white") return turn === "w" ? 1 : -1;
    const ours = this._ourColor() || "w";
    return turn === ours ? 1 : -1;
  }

  _spotlightMove(m) {
    if (!m?.move || !this.boardCandidate) return;
    const uci = this._normalizeUci(m.move);
    const color = this.settings.get("ui.arrowColor1");
    this.overlay.clearArrows();
    this.overlay.clearHighlights();
    this.overlay.addArrow(uci.slice(0, 2), uci.slice(2, 4), color, { label: m.san || "" });

    const pv = Array.isArray(m.pv) ? m.pv.slice(1, 4).map((u) => this._normalizeUci(u)) : [];
    const dim = this.settings.get("ui.arrowColor3");
    pv.forEach((u, i) => {
      if (!u || u.length < 4) return;
      this.overlay.addArrow(u.slice(0, 2), u.slice(2, 4), dim, { alphaScale: 0.5 - i * 0.12 });
    });

    clearTimeout(this._spotlightTimer);
    this._spotlightTimer = setTimeout(() => this._drawBoardHints(this.lastBookQuery), 3500);
  }

  _legalUciSet() {
    const fen = this.currentFen;
    if (this._legalFen === fen && this._legalSet) return this._legalSet;
    const set = new Set();
    try {
      for (const m of this.chess.moves({ verbose: true })) {
        set.add(m.from + m.to);
        set.add(m.from + m.to + (m.promotion || ""));
        if (m.promotion) set.add(m.from + m.to);
      }
    } catch {
      return null;
    }
    this._legalFen = fen;
    this._legalSet = set;
    return set;
  }

  _filterLegal(moves) {
    const legal = this._legalUciSet();
    if (!legal || !legal.size) return moves;
    const kept = [];
    let dropped = 0;
    for (const m of moves) {
      const uci = this._normalizeUci(String(m.move || ""));
      m.move = uci;
      if (legal.has(uci) || legal.has(uci.slice(0, 4))) kept.push(m);
      else dropped++;
    }
    if (dropped) this.log("dropped", dropped, "illegal/stale engine move(s) for this position");
    kept.forEach((m, i) => { m.rank = i + 1; });
    return kept;
  }

  _onRankedMoves(rawMoves) {
    if (!this.boardCandidate) return;
    const moves = this._filterLegal(rawMoves || []);
    if (!moves.length) return;
    if (moves.length) this._stallRetries = 0;
    this._lastRanked = { fen: this.currentFen, moves };
    this._noteCoachPosition(moves);
    this._maybeEmitCoach(this._lastEval?.depth);
    for (const m of moves) {
      if (!m.san) m.san = this.uciToSan(m.move);
    }
    const sign = this._evalSign();
    for (const m of moves) m.sign = sign;
    this.hud.setMoves(moves, this._rankedPicked);
    this._maybeQueuePremove(moves);
    const top = moves[0];
    if (top && top.move !== this._lastAnnounced && this.isOurTurn()) {
      this._lastAnnounced = top.move;
      this.notifyBestMove(top.move);
    }
    if (top && this.isOurTurn() && !this.autoMove._busy && !this.handBrain.blocksAuto) {
      this.autoMove.consider({
        fen: this.currentFen,
        chess: this.chess,
        rankedMoves: moves,
        bookPick: null,
        ourTurn: this.isOurTurn(),
        ourColor: this._ourColor(),
        playMove: (uci) => this.playMove(uci),
        verify: (atFen, uci) => this._autoMoveStillValid(atFen, uci),
        timePressure: this.exploits.opponentInTimePressure(),
        premove: this.exploits.consumePremove((uci) => moves.some((m) => m.move === uci)),
      });
    }
    this._drawBoardHints(this.lastBookQuery);
    this._syncOverlayWindow();
  }

  async _considerCloudEval(fen) {
    if (this.hostKind !== "lichess" || !this.settings.get("ex.lichess.cloudEval")) return false;
    if (this.exploits.cloudBlocked) return false;

    const cloud = await this.exploits.cloudEval(fen, this.settings.get("engine.multipv"));
    if (!cloud?.lines?.length) return false;

    if (fen !== this.currentFen) return false;

    const localDepth = this._lastEval?.depth || 0;
    if (this.engineManager.rankedMoves.length && localDepth >= (cloud.depth || 0)) return false;

    let turn = "w";
    try { turn = this.chess.turn(); } catch {}
    const toStm = turn === "w" ? 1 : -1;

    const moves = cloud.lines.map((l) => {
      const norm = this._normalizeUci(l.move);
      const cp = l.scoreCp == null ? null : l.scoreCp * toStm;
      const mate = l.scoreMate == null ? null : l.scoreMate * toStm;
      const m = new RankedMove(norm, "lichess-cloud", 0, cp, mate, l.pv);
      m.rank = l.rank;
      m.depth = cloud.depth;
      return m;
    });

    this._lastEval = { scoreCp: moves[0].scoreCp, scoreMate: moves[0].scoreMate, depth: cloud.depth };
    const sign = this._evalSign();
    this.hud.setEval(
      moves[0].scoreCp == null ? null : moves[0].scoreCp * sign,
      moves[0].scoreMate == null ? null : moves[0].scoreMate * sign,
      cloud.depth,
      this.settings.get("engine.depth"),
    );
    this._onRankedMoves(moves);
    this.log("cloud eval hit, depth", cloud.depth);
    return true;
  }

  _maybeQueuePremove(moves) {
    if (!this.settings.get("ex.premove") || this.isOurTurn()) return;
    const top = moves?.[0];
    const reply = this._normalizeUci(this.exploits.predictReply(top?.pv));
    if (!reply) return;
    if (this.exploits.setPremove(reply, this._lastEval?.depth)) {
      this.overlay.addArrow(reply.slice(0, 2), reply.slice(2, 4), this.settings.get("ui.arrowColor3"), {
        style: "book", alphaScale: 0.6, label: "pre",
      });
    }
  }

  _syncVariant(fen) {
    const res = this.variants.detect(this.boardCandidate, fen);
    this.currentVariant = res.variant;
    if (!res.changed) return;

    this.hud.setVariant?.(res.variant);
    this.events.emit("variant", res);
    this.log("variant:", res.variant, "via", res.source);

    for (const eng of this.engineManager.engines.values()) {
      const opts = this.variants.uciOptionsFor(eng);
      for (const [name, value] of Object.entries(opts)) eng.setOption(name, value);
    }

    if (this.variants.needsFairy() && !this._hasVariantEngine()) {
      this.log("variant needs Fairy-Stockfish — no variant-capable engine is connected");
      this.hud.setVariantWarning?.(VARIANTS[res.variant]?.label || res.variant);
    } else {
      this.hud.setVariantWarning?.(null);
    }
  }

  _hasVariantEngine() {
    for (const eng of this.engineManager.engines.values()) {
      if (!eng.alive) continue;
      if ((eng.uciOptions || []).some((o) => o.name === "UCI_Variant")) return true;
      if (/fairy/i.test(eng.uciName || eng.name || "")) return true;
    }
    return false;
  }

  async _maybeApplyEloMatch() {
    if (!this.eloMatch.enabled) {
      if (this._matchedElo) {
        this._matchedElo = null;
        this.hud.setMatchedElo?.(null);
      }
      return;
    }
    const found = await this.eloMatch.detect(this.boardCandidate);
    if (!found?.target) return;
    if (found.target === this._matchedElo) return;

    this._matchedElo = found.target;
    this.log("elo match:", found.source, "opponent", found.opponent ?? found.rating, "-> target", found.target);

    if (this.settings.get("elo.announce")) {
      this.hud.setMatchedElo?.({ opponent: found.rating, target: found.target });
    }

    if (this.settings.get("elo.applyHumanizer")) {
      await this.settings.setMany(this.eloMatch.humanizerProfile(found.target));
    }

    if (this.settings.get("elo.applyEngineLimit")) {
      const { elo } = this.eloMatch.uciTargets(found.target);
      for (const eng of this.engineManager.engines.values()) {
        const opts = eng.uciOptions || [];
        if (opts.some((o) => o.name === "UCI_LimitStrength")) {
          eng.setOption("UCI_LimitStrength", "true");
          eng.setOption("UCI_Elo", clampToOption(opts, "UCI_Elo", elo));
        } else if (opts.some((o) => o.name === "Skill Level")) {
          const skill = Math.max(0, Math.min(20, Math.round((found.target - 800) / 100)));
          eng.setOption("Skill Level", skill);
        }
      }
    }

    if (this.settings.get("elo.useMaia") && this.settings.get("ws.socketsEnabled")) {
      const { id, elo } = this.eloMatch.maiaTarget(found.target);
      const base = resolveSocketBase(this.settings);
      const name = `Maia ${elo}`;
      for (const existing of this.engineManager.socketEngineNames()) {
        if (existing.startsWith("Maia ") && existing !== name) this.engineManager.removeEngine(existing);
      }
      await this.engineManager.addSocketEngine(name, socketUrl(base, id), 1, { socketId: id, maxDepth: 7 });
      this.log("elo match routed to", id);
    }

    this._syncOverlayWindow();
  }

  _syncOverlayWindow() {
    if (!this.overlayWindow.isOpen) return;
    const maxArrows = this.settings.get("engine.maxArrows");
    const bookLines = this.lastBookQuery?.lines?.filter((l) => !l.isTablebase) || [];
    const tbLines = this.lastBookQuery?.lines?.filter((l) => l.isTablebase) || [];
    const ranked = this.engineManager.rankedMoves || [];

    const deepestRank = ranked.length ? ranked[Math.min(ranked.length, maxArrows) - 1]?.rank || 0 : 0;
    let arrows = ranked.slice(0, maxArrows).map((m) => ({
      move: m.move,
      color: rankColor(this.settings, m.rank, deepestRank),
      label: "#" + m.rank,
    }));

    if (tbLines.length && this.settings.get("tb.preferOverEngine")) {
      const color = this.settings.get("ui.tbArrowColor");
      arrows = tbLines.slice(0, maxArrows).map((l, i) => ({ move: l.move, color, label: "T" + (i + 1) }));
    } else if (bookLines.length && this.settings.get("book.preferOverEngine")) {
      const color = this.settings.get("ui.bookArrowColor");
      arrows = bookLines.slice(0, maxArrows).map((l, i) => ({ move: l.move, color, label: "B" + (i + 1) }));
    }

    this.overlayWindow.update({
      fen: this.currentFen,
      moves: arrows,
      flipped: this.boardCandidate?.flipped || false,
      mirror: this.settings.get("ov.mirrorBoard"),

      evalCp: this._lastEval?.scoreCp == null ? null : this._lastEval.scoreCp * this._evalSign(),
      evalMate: this._lastEval?.scoreMate == null ? null : this._lastEval.scoreMate * this._evalSign(),
      evalWhiteCp: this._lastEval?.scoreCp == null ? null : this._lastEval.scoreCp * this._whiteSign(),
      evalWhiteMate: this._lastEval?.scoreMate == null ? null : this._lastEval.scoreMate * this._whiteSign(),
      depth: this._lastEval?.depth ?? null,
      lines: ranked.slice(0, 6).map((m) => ({
        move: m.move, san: this.uciToSan(m.move), rank: m.rank,
        score: m.displayScore, engine: m.engine,
      })),
      bookLines: bookLines.slice(0, 6),
      tbLines: tbLines.slice(0, 6),
      stage: this.lastBookQuery?.stage || null,
      variant: this.currentVariant || null,
      matchedElo: this._matchedElo || null,
      source: this._lastPickSource || null,
    });
  }

  _drawBoardHints(bookQuery, useBook = null) {
    if (!this.settings.get("ui.arrows") || (this.handBrain.enabled && this.settings.get("handbrain.hideArrows"))) {
      this.overlay.clearArrows();
      return;
    }
    const maxArrows = this.settings.get("engine.maxArrows");
    this.overlay.clearArrows();

    const bookLines = bookQuery?.lines?.filter((l) => !l.isTablebase) || [];
    const tbLines = bookQuery?.lines?.filter((l) => l.isTablebase) || [];
    const bookLeads = useBook == null
      ? bookLines.length > 0 && this.settings.get("book.preferOverEngine")
      : useBook;

    if (bookLeads && bookLines.length && this.settings.get("ui.bookArrows")) {
      const color = this.settings.get("ui.bookArrowColor");
      bookLines.slice(0, maxArrows).forEach((l, i) => {
        this._drawMove(l.move, color, { label: "B" + (i + 1), alphaScale: 1 - i * 0.2 }, i + 1);
      });
      return;
    }

    if (tbLines.length && this.settings.get("tb.preferOverEngine") && this.settings.get("ui.tbArrows")) {
      const color = this.settings.get("ui.tbArrowColor");
      tbLines.slice(0, maxArrows).forEach((l, i) => {
        this._drawMove(l.move, color, { label: "T" + (i + 1) }, i + 1);
      });
      return;
    }

    const moves = this.engineManager.rankedMoves.slice(0, maxArrows);
    const deepest = moves.length ? moves[moves.length - 1].rank : 0;
    moves.forEach((m, i) => {
      const color = rankColor(this.settings, m.rank, deepest);
      this._drawMove(m.move, color, { label: "#" + m.rank, alphaScale: rankAlpha(m.rank, deepest) }, m.rank);
    });
  }

  _drawMove(uci, color, opts, rank) {
    uci = this._normalizeUci(uci);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const mode = this.settings.get("ov.mode");
    if (mode === "stealth") {
      this.overlay.addStealthDot(to, rank);
      this.overlay.addStealthDot(from, rank + 3);
    } else {
      this.overlay.addArrow(from, to, color, opts);
    }
  }

  _bindCoachToGame() {
    const key = this.gameKey();
    if (!key || key === this._coachGameKey) return;
    this._coachGameKey = key;
    const restored = this.coach.bindGame(key);
    if (restored) {
      this.log("coach restored for", key, "graded:", this.coach.gradedCount);
      this.hud.setCoach(this.coach.lastReport, this.coach.accuracy());
    }
  }

  gameKey() {
    const host = this.hostKind || "generic";
    const path = location.pathname || "";
    const m = path.match(/\/(?:game\/(?:live|daily)\/)?([a-z0-9]{6,14})(?:\/|$)/i);
    const id = m && !/^(analysis|play|computer|online|puzzles|training|new)$/i.test(m[1]) ? m[1] : null;
    if (id) return `${host}.${id}`;
    if (/analysis/i.test(path)) return null;
    return `${host}.${path.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`;
  }

  _autoMoveStillValid(atFen, uci) {
    if (atFen && this.currentFen && atFen !== this.currentFen) return false;
    if (!this.isOurTurn()) return false;
    return this.moveIsOurs(uci);
  }

  moveIsOurs(uci) {
    uci = this._normalizeUci(uci);
    if (!uci || uci.length < 4) return false;
    const fen = this.currentFen;
    if (!fen) return false;
    try {
      const probe = new Chess(fen);
      const piece = probe.get(uci.slice(0, 2));
      if (!piece) return false;
      if (piece.color !== probe.turn()) return false;
      const ours = this._ourColor();
      if (ours && piece.color !== ours) return false;
      return probe.moves({ verbose: true })
        .some((m) => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4));
    } catch {
      return false;
    }
  }

  isOurTurn() {
    if (!this.boardCandidate) return false;
    const ours = this._ourColor();
    const apiTurn = this.boardCandidate.strategies?.turn?.();
    if (apiTurn) return apiTurn === ours;

    const stm = String(this.currentFen || "").split(" ")[1];
    if (stm === "w" || stm === "b") return stm === ours;
    try {
      return this.chess.turn() === ours;
    } catch {

      return false;
    }
  }

  _ourColor() {
    const api = this.boardCandidate?.strategies?.playingAs?.();
    if (api) return api;
    return this.boardCandidate?.flipped ? "b" : "w";
  }

  _turn(fen) {
    try {
      const tmp = new Chess(fen);
      return tmp.turn();
    } catch { return null; }
  }

  _uciBetweenFens(fromFen, toFen) {
    try {
      const c = new Chess(fromFen);
      const legal = c.moves({ verbose: true });
      for (const m of legal) {
        const probe = new Chess(fromFen);
        probe.move(m.san);
        if (probe.fen() === toFen) return m.from + m.to + (m.promotion || "");
      }
    } catch {}
    return null;
  }

  _trackOppAnalysis(prevFen, fen) {
    if (!this.settings.get("ex.oppAnalysis") || !prevFen || !fen) return;
    const ourColor = this._ourColor();
    if (!ourColor) return;
    if (this._turn(fen) !== ourColor) return;
    if (this._lastRanked?.fen !== prevFen) return;
    const uci = this._uciBetweenFens(prevFen, fen);
    if (!uci) return;
    const top = this._lastRanked.moves?.[0]?.move;
    if (!top) return;
    this._oppAnalysis.total++;
    if (uci === top) this._oppAnalysis.matches++;
    if (!this._oppAnalysis.warned && this._oppAnalysis.total >= 8 && this._oppAnalysis.matches / this._oppAnalysis.total >= 0.8) {
      this._oppAnalysis.warned = true;
      const pct = (100 * this._oppAnalysis.matches / this._oppAnalysis.total).toFixed(0);
      try { this.toast(`Opponent matched engine top move ${pct}% (${this._oppAnalysis.matches}/${this._oppAnalysis.total})`); } catch {}
    }
  }

  _normalizeUci(uci) {
    if (!uci || uci.length < 4) return uci;
    const base = uci.slice(0, 4);
    const rest = uci.slice(4);
    const standard = {
      e1h1: "e1g1", e1a1: "e1c1",
      e8h8: "e8g8", e8a8: "e8c8",
    }[base];
    return standard ? standard + rest : uci;
  }

  uciToSan(uci) {
    uci = this._normalizeUci(uci);
    const fen = this.currentFen || "";
    if (this._sanCacheFen !== fen) {
      this._sanCacheFen = fen;
      this._sanCache = new Map();
    }
    const hit = this._sanCache?.get(uci);
    if (hit !== undefined) return hit;
    let san = uci;
    try {
      const tmp = new Chess(this.chess.fen());
      const m = tmp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
      if (m?.san) san = m.san;
    } catch {}
    this._sanCache.set(uci, san);
    return san;
  }

  _trustPatchActive() {
    if (this._trustProbe !== undefined) return this._trustProbe;
    try {
      const probe = function () {};
      document.addEventListener("mousemove", probe);
      document.removeEventListener("mousemove", probe);
      this._trustProbe = !!probe.__uxWrapped;
    } catch {
      this._trustProbe = false;
    }
    return this._trustProbe;
  }

  async playMove(uci, { force = false } = {}) {
    uci = this._normalizeUci(uci);
    if (!this.boardCandidate) return false;

    if (!force && !this.moveIsOurs(uci)) {
      this.log("refused move", uci, "- not a legal move for us in", this.currentFen);
      return false;
    }
    const c = this.boardCandidate;

    if (!c.strategies.apiMove && !this._trustPatchActive() && !this._warnedTrust) {
      this._warnedTrust = true;
      this.log("auto-move needs the input trust patch on this site - reload the page after enabling auto move");
      this.toast?.("Reload the page to enable auto-move on this site");
    }
    const san = this.uciToSan(uci);
    const fenBefore = this.detector.extractFEN(c) || this.currentFen;
    const promotion = uci.length > 4 ? uci[4].toLowerCase() : null;

    let dispatched = false;
    try {
      if (this.humanizer.stealthInput && this.settings.get("hum.stealthInput")) {
        dispatched = await this.humanizer.executeMove(uci, {
          squareToPoint: (sq) => this.detector.squareToPoint(c, sq),
          playMoveUci: (u) => this._fallbackSiteMove(c, u),
          dispatch: (type, point, extra) => this._fireInput(type, point, extra),
        });
      } else {
        dispatched = await this._fallbackSiteMove(c, uci);
      }
    } catch {
      dispatched = false;
    }

    if (dispatched && promotion) {
      const picked = await this._resolvePromotion(promotion, 2500);
      this.log("promotion picker", promotion, picked ? "clicked" : "not shown");
    }

    if (dispatched && (await this._waitForFenChange(c, fenBefore, promotion ? 3500 : 1600))) {
      this.events.emit("move", { move: uci, san });
      return true;
    }

    if (c.strategies.apiMove && c.strategies.apiMove(uci)) {
      if (await this._waitForFenChange(c, fenBefore, 800)) {
        this.log("input move did not register, used board api for", uci);
        this.events.emit("move", { move: uci, san });
        return true;
      }
    }
    this.log("move failed to register:", uci);
    return false;
  }

  _promotionTarget(letter) {
    const names = { q: "queen", r: "rook", b: "bishop", n: "knight" };
    const name = names[letter] || "queen";
    const coded = this._ourColor() + letter;
    const visible = (el) => el && el.offsetParent !== null;

    for (const host of document.querySelectorAll("cg-promotion")) {
      if (getComputedStyle(host).visibility === "hidden") continue;
      for (const el of host.querySelectorAll("*")) {
        const cls = String(el.className || "").toLowerCase();
        const tokens = cls.split(/\s+/);
        if (tokens.includes(coded) || tokens.includes(letter) || cls.includes(name)) return el;
      }
    }

    for (const el of document.querySelectorAll(".promotion-window .promotion-piece, .promotion-piece")) {
      const cls = String(el.className || "").toLowerCase();
      if (visible(el) && (cls.includes(coded) || cls.includes(name))) return el;
    }
    for (const sq of document.querySelectorAll("#promotion-choice square, .promotion-choice square, #promotion-choice > *")) {
      const inner = sq.querySelector("piece") || sq;
      const cls = String(inner.className || "").toLowerCase();
      if (visible(sq) && cls.includes(name)) return sq;
    }
    for (const el of document.querySelectorAll("[class*='promotion'] *, [id*='promotion'] *")) {
      const cls = String(el.className || "").toLowerCase();
      if (visible(el) && (cls.includes(coded) || cls.includes(name))) return el;
    }
    return null;
  }

  async _resolvePromotion(letter, timeoutMs = 2500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const el = this._promotionTarget(letter);
      if (el) {
        const r = el.getBoundingClientRect();
        const point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        this._fireInput("pointerdown", point, { buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true }, el);
        this._fireInput("mousedown", point, { buttons: 1 }, el);
        await this._sleep(40);
        this._fireInput("pointerup", point, { pointerId: 1, pointerType: "mouse", isPrimary: true }, el);
        this._fireInput("mouseup", point, {}, el);
        this._fireInput("click", point, {}, el);
        return true;
      }
      await this._sleep(80);
    }
    return false;
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  _fireInput(type, point, extra = {}, target = null) {
    const el = target || document.elementFromPoint(point.x, point.y);
    if (!el) return false;
    const opts = {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: point.x, clientY: point.y, screenX: point.x, screenY: point.y,
      button: 0, detail: 1, ...extra,
    };
    const evt = type.startsWith("pointer") ? new PointerEvent(type, opts) : new MouseEvent(type, opts);
    el.dispatchEvent(this.tagEvent(evt));
    return true;
  }

  _waitForFenChange(candidate, fenBefore, timeoutMs = 1600) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const now = this.detector.extractFEN(candidate);
        if (now && now !== fenBefore) return resolve(true);
        if (Date.now() - started >= timeoutMs) return resolve(false);
        setTimeout(tick, 90);
      };
      tick();
    });
  }

  async _fallbackSiteMove(candidate, uci) {
    const pFrom = this.detector.squareToPoint(candidate, uci.slice(0, 2));
    const pTo = this.detector.squareToPoint(candidate, uci.slice(2, 4));
    if (!pFrom || !pTo) return false;
    const down = { buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true };
    const up = { pointerId: 1, pointerType: "mouse", isPrimary: true };

    this._fireInput("pointerdown", pFrom, down);
    this._fireInput("mousedown", pFrom, { buttons: 1 });
    await this._sleep(40 + Math.random() * 50);
    this._fireInput("pointerup", pFrom, up);
    this._fireInput("mouseup", pFrom);
    await this._sleep(70 + Math.random() * 90);
    this._fireInput("pointerdown", pTo, down);
    this._fireInput("mousedown", pTo, { buttons: 1 });
    await this._sleep(30 + Math.random() * 40);
    this._fireInput("pointerup", pTo, up);
    this._fireInput("mouseup", pTo);
    return true;
  }

  analyzePosition(fen, depth = null) {
    if (depth) this.engineManager.configure({ depth });
    this.engineManager.analyze(fen || this.currentFen);
  }

  scriptStorageGet(scriptName, key, def = null) {
    return this._scriptStore[scriptName + ":" + key] ?? def;
  }

  scriptStorageSet(scriptName, key, value) {
    this._scriptStore[scriptName + ":" + key] = value;
  }

  async scriptHttpGet(url) {
    try {
      const res = await this.settings.proxyFetchJson(url, 5000);
      return typeof res === "string" ? res : JSON.stringify(res);
    } catch {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const t = await r.text();
        try { return JSON.stringify(JSON.parse(t)); } catch { return t; }
      } catch {
        return null;
      }
    }
  }

  _applySettings() {
    const s = this.settings;
    const sig = {
      engine: [
        s.get("engine.depth"), s.get("engine.multipv"), s.get("engine.movetime"),
        s.get("engine.nodes"), s.get("engine.rankingMode"),
      ].join("|"),
      engineOpts: JSON.stringify(
        Object.entries(s.getAll()).filter(([k]) => k.startsWith("engineOpt::")).sort()
      ),
      local: !!s.get("engine.useLocal"),
      builtins: BuiltinEngines.map((e) => `${e.key}:${s.get(enabledKey(e.key)) ? 1 : 0}:${s.get(priorityKey(e.key))}:${s.get(linesKey(e.key))}`).join(","),
      sockets: [s.get("ws.socketsEnabled") ? 1 : 0, s.get("ws.socketBase"), s.get("ws.socketBaseCustom"), s.get("ws.socketsJson")].join("|"),
      remote: !!s.get("engine.useRemote"),
      wsUrl: s.get("engine.wsUrl"),
      perf: [s.get("engine.threads"), s.get("engine.hash"), s.get("engine.wasmHashCap")].join("|"),
      elo: s.get("hum.eloTarget"),
      hudPos: s.get("ui.hudPosition"),
    };
    const prev = this._appliedSig || {};
    const first = !Object.keys(prev).length;
    this._appliedSig = sig;

    const preset = this.settings.get("hum.preset");
    if (preset && preset !== "custom") this.humanizer.applyPreset(preset);
    const humKeys = {
      meanMs: "hum.meanMs", stdMs: "hum.stdMs", minMs: "hum.minMs", maxMs: "hum.maxMs",
      timePressureCutoffMs: "hum.timePressureCutoffMs", timePressureFactor: "hum.timePressureFactor",
      blunderChance: "hum.blunderChance", rank2Chance: "hum.rank2Chance", rank3Chance: "hum.rank3Chance",
      rankDecay: "hum.rankDecay", rankPoolSize: "auto.rankPoolSize",
      blunderCooldownMoves: "hum.blunderCooldownMoves", evalSwingThreshold: "hum.evalSwingThreshold",
      openingInstantPlies: "hum.openingInstantPlies", stealthInput: "hum.stealthInput",
    };
    const skipPreset = new Set(["meanMs", "stdMs", "blunderChance", "rank2Chance", "rank3Chance"]);
    for (const [prop, key] of Object.entries(humKeys)) {
      if (preset && preset !== "custom" && skipPreset.has(prop)) continue;
      this.humanizer[prop] = this.settings.get(key);
    }
    this.humanizer.enabled = this.settings.get("hum.enabled");

    if (this._lastEval) {
      const sign = this._evalSign();
      this.hud.setEval(
        this._lastEval.scoreCp == null ? null : this._lastEval.scoreCp * sign,
        this._lastEval.scoreMate == null ? null : this._lastEval.scoreMate * sign,
        this._lastEval.depth,
        s.get("engine.depth"),
      );
      const moves = this.engineManager.rankedMoves;
      if (moves?.length) {
        for (const m of moves) m.sign = sign;
        this.hud.setMoves(moves, this._rankedPicked);
      }
    }

    this.hud.setVisible(s.get("ui.hud"));
    if (sig.hudPos !== prev.hudPos) this.hud.refreshPosition();
    this.hud.rerender();

    if (sig.engine !== prev.engine) {
      this.engineManager.configure({
        depth: s.get("engine.depth"),
        multipv: s.get("engine.multipv"),
        movetime: s.get("engine.movetime") || null,
        nodes: s.get("engine.nodes") || null,
        mode: s.get("engine.rankingMode"),
      });
      if (!first && this.currentFen) {
        this.engineManager.analyze(this.currentFen);
        this.log("engine reconfigured live:", sig.engine);
      }
    }

    if (!first && this._enginesStarted && (sig.local !== prev.local || sig.builtins !== prev.builtins)) {
      this._syncBuiltinEngines();
    }

    if (!first && this._enginesStarted && sig.sockets !== prev.sockets) {
      this._syncSocketEngines();
    }

    if (!first && this._enginesStarted && (sig.remote !== prev.remote || sig.wsUrl !== prev.wsUrl)) {
      if (sig.remote) this.engineManager.connectEngineWS(sig.wsUrl);
      else this.engineManager.disconnectEngineWS();
    }

    if (!first && (sig.perf !== prev.perf || sig.engineOpts !== prev.engineOpts)) {
      for (const eng of this.engineManager.engines.values()) {
        this._applyEngineOptions(eng.name);
      }
    }

    if (first || sig.elo !== prev.elo) {
      for (const eng of this.engineManager.engines.values()) {
        if (sig.elo > 0) this.engineManager.setSkill(eng.name, { uciElo: sig.elo });
        else if (eng.type === "local") eng.setOption("UCI_LimitStrength", "false");
      }
    }

    this._refreshActions();
    this.overlay.render();
    if (this.boardCandidate) this._drawBoardHints(this.lastBookQuery);
    const extEnabled = !!s.get("ov.externalEnabled");
    if (extEnabled && !this.overlayWindow.isOpen) this.overlayWindow.open();
    if (!extEnabled && this.overlayWindow.isOpen) this.overlayWindow.close();
    if (this.overlayWindow.isOpen) this.overlayWindow.refreshTheme();
    if (!first) this.hud.flashSync();
  }

  _isMobile() {
    try {
      const ua = navigator.userAgent || "";
      if (/Android|iPhone|iPad|iPod|Mobile|CriOS/i.test(ua)) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
      return false;
    } catch { return false; }
  }

  _maybeEmitGameOver() {
    try {
      if (!this.chess || typeof this.chess.isGameOver !== "function") return;
      if (!this.chess.isGameOver()) return;
      let reason = "draw";
      let result = "1/2-1/2";
      if (this.chess.isCheckmate()) {
        reason = "checkmate";
        result = this.chess.turn() === "w" ? "0-1" : "1-0";
      } else if (this.chess.isStalemate()) {
        reason = "stalemate";
      } else if (this.chess.isThreefoldRepetition()) {
        reason = "threefold";
      } else if (this.chess.isInsufficientMaterial()) {
        reason = "insufficient";
      } else if (this.chess.isDraw()) {
        reason = "draw";
      }
      if (this._lastGameOverFen !== this.currentFen) {
        this._lastGameOverFen = this.currentFen;
        this.events.emit("gameover", { result, reason, fen: this.currentFen });
      }
    } catch {}
  }

  _refreshActions() {
    this.hud.setActions([
      {
        label: "Auto",
        title: "Toggle auto move",
        active: this.settings.get("auto.enabled"),
        onClick: async () => {
          await this.settings.set("auto.enabled", !this.settings.get("auto.enabled"));
          this._refreshActions();
        },
      },
      {
        label: "H&B",
        title: "Hand & Brain mode",
        active: this.settings.get("handbrain.enabled"),
        onClick: async () => {
          await this.settings.set("handbrain.enabled", !this.settings.get("handbrain.enabled"));
          this._refreshActions();
        },
      },
      {
        label: "Overlay",
        title: "Stream-proof external window",
        active: this.overlayWindow.isOpen,
        onClick: () => {
          if (this.overlayWindow.isOpen) this.overlayWindow.close();
          else this.overlayWindow.open();
          this._refreshActions();
        },
      },
      {
        label: "Queue",
        title: "Auto queue next game",
        active: this.settings.get("queue.enabled"),
        onClick: async () => {
          await this.settings.set("queue.enabled", !this.settings.get("queue.enabled"));
          this._refreshActions();
        },
      },
    ]);

    this.handBrain.onShow = (name, glyph, meta) => this.hud.showHandBrain(name, glyph, meta);
    this.handBrain.onHide = () => this.hud.hideHandBrain();
    this.handBrain.onHighlight = (squares) => {
      this.overlay.clearHandBrainMarks?.();
      for (const sq of squares || []) this.overlay.addHandBrainMark?.(sq);
    };
  }

  notifyBestMove(uci) {
    this.handBrain.announceMove(uci, this.chess, this.currentFen);
    if (this.settings.get("ex.tts")) {
      const msg = new SpeechSynthesisUtterance(this.uciToSan(uci));
      msg.volume = this.settings.get("ex.ttsVolume");
      const coach = this.coach?.getCoachData?.();
      if (coach) {
        const voiceMap = COACH_VOICE_MAP?.[coach.voiceId];
        const override = String(this.settings.get("coach.ttsVoice") || "").trim();
        if (override) {
          const v = this.coach.voices().find((v) => v.name.toLowerCase().includes(override.toLowerCase()));
          if (v) msg.voice = v;
        } else if (voiceMap?.name) {
          const v = this.coach.voices().find((v) => v.name.toLowerCase().includes(voiceMap.name.toLowerCase()));
          if (v) msg.voice = v;
        }
        msg.rate = Number(this.settings.get("coach.ttsRate")) || voiceMap?.rate || 1.05;
        msg.pitch = Number(this.settings.get("coach.ttsPitch")) || voiceMap?.pitch || 1;
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(msg);
    }
  }
}
