import { Chess } from "../../vendor/chess.js";
import { PolyglotBook } from "./PolyglotBook.js";

export const GameStage = { OPENING: "opening", MIDGAME: "middlegame", ENDGAME: "endgame" };

const LICHESS_EXPLORER = "https://explorer.lichess.ovh";
const LICHESS_TABLEBASE = "https://tablebase.lichess.ovh/standard";

export class BookLine {
  constructor(move, source, data = {}) {
    this.move = move;
    this.san = data.san || null;
    this.source = source;
    this.weight = data.weight ?? null;
    this.pct = data.pct ?? null;
    this.wdl = data.wdl ?? null;
    this.dtz = data.dtz ?? null;
    this.dtm = data.dtm ?? null;
    this.whiteWins = data.whiteWins ?? null;
    this.draws = data.draws ?? null;
    this.blackWins = data.blackWins ?? null;
    this.bookName = data.bookName || null;
    this.isTablebase = data.isTablebase || false;
    this.category = data.category || (this.isTablebase ? wdlCategory(this.wdl) : null);
  }
}

const CHILD_CATEGORY_TO_OUR_WDL = {
  win: -2, "cursed-win": -1, draw: 0, "blessed-loss": 1, loss: 2,
  "variant-win": -2, "variant-loss": 2,
};

export function ourWdlFromChild(move) {
  if (typeof move.wdl === "number") return move.wdl === 0 ? 0 : -move.wdl;
  const cat = String(move.category || "").toLowerCase();
  return cat in CHILD_CATEGORY_TO_OUR_WDL ? CHILD_CATEGORY_TO_OUR_WDL[cat] : null;
}

export function tbDistance(line) {
  const v = line.dtm ?? line.dtz;
  return v == null ? 9999 : Math.abs(v);
}

export function wdlCategory(wdl) {
  if (wdl == null) return null;
  if (wdl >= 2) return "win";
  if (wdl === 1) return "cursed-win";
  if (wdl === 0) return "draw";
  if (wdl === -1) return "blessed-loss";
  return "loss";
}

export class BookManager {
  constructor(settings) {
    this.settings = settings;
    this.enginews = null;
    this.fetcher = null;
    this.books = new Map();
    this._chess = new Chess();
    this._cloudCache = new Map();
    this._tbCache = new Map();
    this._recentLines = [];
    this._listeners = new Map();
    this._requestSeq = 0;
    this._pendingRemote = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }

  _emit(event, data) {
    this._listeners.get(event)?.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
  }

  attachEngineWS(enginews) {
    this.enginews = enginews;
    enginews.on("wsmsg", (msg) => this.handleEngineWSMessage(msg));
  }

  attachFetcher(fetcher) {
    this.fetcher = fetcher;
  }

  async _fetchJson(url, timeout = 3000) {
    if (this.fetcher) return this.fetcher(url, timeout);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  addLocalBook(name, arrayBuffer, stage = GameStage.OPENING) {
    const book = new PolyglotBook(name, arrayBuffer);
    this.books.set(name, { book, stage, enabled: true, size: arrayBuffer.byteLength });
    this._emit("books", this.bookList());
    return book.loaded;
  }

  removeLocalBook(name) {
    this.books.delete(name);
    this._emit("books", this.bookList());
  }

  setBookEnabled(name, enabled) {
    const e = this.books.get(name);
    if (e) e.enabled = enabled;
    this._emit("books", this.bookList());
  }

  setBookStage(name, stage) {
    const e = this.books.get(name);
    if (e) e.stage = stage;
    this._emit("books", this.bookList());
  }

  bookList() {
    return [...this.books.entries()].map(([name, e]) => ({
      name, stage: e.stage, enabled: e.enabled,
      entries: e.book.count, size: e.size,
    }));
  }

  plyFromFen(fen) {
    const parts = fen.trim().split(/\s+/);
    const fullmove = parseInt(parts[5] || "1", 10) || 1;
    const turn = parts[1] || "w";
    return (fullmove - 1) * 2 + (turn === "b" ? 1 : 0);
  }

  pieceCount(fen) {
    const placement = String(fen || "").split(/\s+/)[0] || "";
    let n = 0;
    for (const ch of placement) if (/[pnbrqkPNBRQK]/.test(ch)) n++;
    return n;
  }

  detectStage(fen) {
    const pieces = this.pieceCount(fen);
    const maxTbPieces = this.settings.get("stage.endgameMaxPieces");
    const openingMaxPly = this.settings.get("stage.openingMaxPly");
    const ply = this.plyFromFen(fen);
    if (pieces <= maxTbPieces) return GameStage.ENDGAME;
    if (ply <= openingMaxPly) return GameStage.OPENING;
    return GameStage.MIDGAME;
  }

  _anyBookHas(fen, stage = null) {
    for (const e of this.books.values()) {
      if (!e.enabled) continue;
      if (stage && e.stage !== stage && e.stage !== "any") continue;
      if (e.book.has(fen)) return true;
    }
    return false;
  }

  async queryLines(fen) {
    const stage = this.detectStage(fen);
    const lines = [];
    const seenMoves = new Set();
    const push = (line) => {
      if (seenMoves.has(line.move)) return;
      seenMoves.add(line.move);
      lines.push(line);
    };

    // A board read taken mid-render or mid-animation can describe an illegal
    // position. There is nothing worth looking up for one, and letting
    // chess.js throw would reject this whole query.
    try {
      this._chess.load(fen);
    } catch {
      return lines;
    }
    const toSan = (uci) => {
      try {
        const m = this._chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
        this._chess.undo();
        return m ? m.san : null;
      } catch {
        return null;
      }
    };

    if (this.settings.get("book.enabled")) {
      for (const [name, e] of this.books) {
        if (!e.enabled) continue;
        if (e.stage !== stage && e.stage !== "any") continue;
        for (const m of e.book.query(fen)) {
          push(new BookLine(m.move, "local-book", {
            san: toSan(m.move), weight: m.weight, pct: m.pct, bookName: name,
          }));
        }
      }

      if (this.enginews?.wsConnected) {
        const remote = await this._remoteBookQuery(fen, stage);
        for (const r of remote) {
          for (const m of r.moves || []) {
            push(new BookLine(m.move, "remote-book", {
              san: toSan(m.move), weight: m.weight, pct: m.pct, bookName: r.book,
              whiteWins: m.wins, draws: m.draws, blackWins: m.losses,
            }));
          }
        }
      }

      if (!lines.length && this.settings.get("book.useCloud")) {
        const cloud = await this._cloudExplorer(fen);
        for (const m of cloud) {
          push(new BookLine(m.uci, "cloud", {
            san: m.san, weight: m.white + m.draws + m.black,
            whiteWins: m.white, draws: m.draws, blackWins: m.black,
          }));
        }
      }
    }

    let tbResult = null;
    if (this.settings.get("tb.enabled") && this.pieceCount(fen) <= this.settings.get("tb.maxPieces")) {
      tbResult = await this._probeTablebases(fen, toSan);
      for (const l of tbResult) push(l);
    }

    const maxLines = this.settings.get("book.maxLines");
    const limited = lines.slice(0, Math.max(maxLines, tbResult?.length || 0));
    const result = { fen, stage, lines: limited, hasBook: lines.some((l) => !l.isTablebase), hasTablebase: !!tbResult?.length };
    this._emit("lines", result);
    return result;
  }

  async _remoteBookQuery(fen, stage) {
    return new Promise((resolve) => {
      const id = ++this._requestSeq;
      const timer = setTimeout(() => { this._pendingRemote.delete(id); resolve([]); }, 1500);
      this._pendingRemote.set(id, { resolve, timer, kind: "book" });
      this.enginews.sendWs({ action: "book_query", request_id: id, fen, stage, ply: this.plyFromFen(fen) });
    });
  }

  handleEngineWSMessage(msg) {
    if (msg.type === "book_result" && msg.request_id && this._pendingRemote.has(msg.request_id)) {
      const p = this._pendingRemote.get(msg.request_id);
      clearTimeout(p.timer);
      this._pendingRemote.delete(msg.request_id);
      p.resolve(msg.results || []);
    }
    if (msg.type === "tablebase_result" && msg.request_id && this._pendingRemote.has(msg.request_id)) {
      const p = this._pendingRemote.get(msg.request_id);
      clearTimeout(p.timer);
      this._pendingRemote.delete(msg.request_id);
      p.resolve(msg.results || []);
    }
  }

  async _cloudExplorer(fen) {
    if (this._cloudCache.has(fen)) return this._cloudCache.get(fen);
    const source = this.settings.get("book.cloudSource");
    try {
      const data = await this._fetchJson(`${LICHESS_EXPLORER}/${source}?fen=${encodeURIComponent(fen)}&moves=12`, 4000);
      const moves = (data.moves || []).map((m) => ({
        uci: m.uci, san: m.san, white: m.white, draws: m.draws, black: m.black,
      }));
      this._cloudCache.set(fen, moves);
      return moves;
    } catch {
      return [];
    }
  }

  async _probeTablebases(fen, toSan) {
    const out = [];
    if (this._tbCache.has(fen)) return this._tbCache.get(fen);

    if (this.enginews?.wsConnected) {
      const remote = await new Promise((resolve) => {
        const id = ++this._requestSeq;
        const timer = setTimeout(() => { this._pendingRemote.delete(id); resolve([]); }, 2000);
        this._pendingRemote.set(id, { resolve, timer, kind: "tb" });
        this.enginews.sendWs({ action: "tablebase_probe", request_id: id, fen });
      });
      for (const r of remote) {
        for (const m of r.moves || []) {
          out.push(new BookLine(m.move, "local-tb", {
            san: toSan(m.move), wdl: m.wdl, dtz: m.dtz, dtm: m.dtm,
            bookName: r.tablebase, isTablebase: true,
          }));
        }
      }
    }

    if (!out.length && this.settings.get("tb.useOnline")) {
      try {
        const data = await this._fetchJson(`${LICHESS_TABLEBASE}?fen=${encodeURIComponent(fen)}`, 4000);
        const flip = (v) => (v == null ? null : v === 0 ? 0 : -v);
        let idx = 0;
        for (const m of data.moves || []) {
          const wdl = ourWdlFromChild(m);
          const line = new BookLine(m.uci, "online-tb", {
            san: m.san,
            wdl,
            dtz: flip(m.dtz),
            dtm: flip(m.dtm),
            category: wdlCategory(wdl),
            isTablebase: true,
          });
          line.apiIndex = idx++;
          out.push(line);
        }
      } catch {}
    }

    out.sort((a, b) => {
      const wa = a.wdl, wb = b.wdl;
      if (wa == null && wb == null) return (a.apiIndex ?? 0) - (b.apiIndex ?? 0);
      if (wa == null) return 1;
      if (wb == null) return -1;
      if (wa !== wb) return wb - wa;
      const da = tbDistance(a), db = tbDistance(b);
      if (da !== db) return wa > 0 ? da - db : db - da;
      return (a.apiIndex ?? 0) - (b.apiIndex ?? 0);
    });
    this._tbCache.set(fen, out);
    return out;
  }

  pickMove(queryResult) {
    if (!queryResult?.lines?.length) return null;
    const bookLines = queryResult.lines.filter((l) => !l.isTablebase);
    const tbLines = queryResult.lines.filter((l) => l.isTablebase);

    if (tbLines.length && this.settings.get("tb.preferOverEngine")) {
      const bestWdl = tbLines[0].wdl;
      let best = tbLines.filter((l) => l.wdl === bestWdl);
      const target = bestWdl > 0
        ? Math.min(...best.map(tbDistance))
        : Math.max(...best.map(tbDistance));
      const optimal = best.filter((l) => tbDistance(l) === target);
      if (optimal.length) best = optimal;
      return { line: best[Math.floor(Math.random() * best.length)], source: "tablebase" };
    }

    if (!bookLines.length || !this.settings.get("book.preferOverEngine")) return null;

    let candidates = bookLines;
    if (this.settings.get("book.varietyMode") && bookLines.length > 1) {
      const fresh = bookLines.filter((l) => !this._recentLines.includes(l.move));
      if (fresh.length) candidates = fresh;
    }

    let picked;
    if (this.settings.get("book.weightedPick")) {
      picked = PolyglotBook.pickWeighted(candidates);
    } else {
      picked = candidates[0];
    }
    if (picked) {
      this._recentLines.push(picked.move);
      if (this._recentLines.length > 4) this._recentLines.shift();
      return { line: picked, source: "book" };
    }
    return null;
  }

  clearCaches() {
    this._cloudCache.clear();
    this._tbCache.clear();
    this._recentLines = [];
  }
}
