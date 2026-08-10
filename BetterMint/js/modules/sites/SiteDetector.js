import { Chess } from "../../vendor/chess.js";

const SAN_RX = /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O(-O)?)[+#]?$/;
const FEN_RX = /\b(?:[rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+ [wb] [KQkq-]{1,4} [a-h1-8-]{1,2}(?: \d+ \d+)?\b/;
const PIECE_NAME_RX = /\b(white|black)[\s_-]?(king|queen|rook|bishop|knight|pawn)\b/i;
const PIECE_CODE_RX = /^([wb])([kqrbnp])$/i;
const SHORT_PIECE_RX = /^[kqrbnp]$/i;

const PIECE_CODES = ["k", "q", "r", "b", "n", "p"].flatMap((t) => [`w${t}`, `b${t}`]);
const PIECE_SELECTOR = [
  "piece",
  "[class*='piece']",
  "img[src*='piece']",
  ...PIECE_CODES.map((c) => `[class~="${c}"]`),
].join(",");

export class SiteDetector {
  constructor() {
    this.result = null;
    this._listeners = new Map();
    this._rescanTimer = null;
    this._failStreak = 0;
    this._stopped = false;
    this._lastUrl = location.href;
    this._scanInterval = null;
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }

  _emit(event, data) {
    this._listeners.get(event)?.forEach((fn) => { try { fn(data); } catch {} });
  }

  start() {
    this._stopped = false;
    this._scan("initial");
    if (!this._navHooked) {
      this._navHooked = true;
      this._hookNavigation();
    }
    this._scheduleRescan();
    clearInterval(this._scanInterval);
    this._scanInterval = setInterval(() => {
      if (location.href !== this._lastUrl) {
        this._lastUrl = location.href;
        this._failStreak = 0;
        this._scan("url-change");
      }
    }, 800);
  }

  stop() {
    clearTimeout(this._rescanTimer);
    clearInterval(this._scanInterval);
    this._stopped = true;
  }

  _hookNavigation() {
    const fire = () => setTimeout(() => {
      this._failStreak = 0;
      this._scan("nav");
    }, 300);
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...a) { origPush.apply(this, a); fire(); };
    history.replaceState = function (...a) { origReplace.apply(this, a); fire(); };
    window.addEventListener("popstate", fire);
    window.addEventListener("hashchange", fire);
  }

  _scheduleRescan() {
    clearTimeout(this._rescanTimer);
    if (this._stopped) return;
    const delay = this.result ? 2500 : Math.min(1200 * 2 ** (this._failStreak || 0), 20000);
    this._rescanTimer = setTimeout(() => {
      this._scan("poll");
      this._scheduleRescan();
    }, delay);
  }

  _scan(reason) {
    const candidates = this.allCandidates();
    let board = candidates[0] || null;
    if (board && this._hostKind() === "generic") {
      board = candidates.find((c) => this._hasChessEvidence(c)) || null;
    }
    const prev = this.result;
    this._failStreak = board ? 0 : Math.min((this._failStreak || 0) + 1, 5);

    if (!board) {
      if (prev) {
        this.result = null;
        this._emit("board-lost", {});
      }
      return;
    }

    if (!prev) {
      this.result = { host: this._hostKind(), board, detectedAt: Date.now(), reason };
      this._emit("board", this.result);
      return;
    }

    if (prev.board.el === board.el) {
      prev.board.rect = board.rect;
      prev.board.size = board.size;
      prev.board.score = board.score;
      prev.board.flipped = board.flipped;
      return;
    }

    const current = candidates.find((c) => c.el === prev.board.el);
    const currentDead = !current || !document.contains(prev.board.el) || current.size < 50;
    if (currentDead || board.score > current.score + 5) {
      this.result = { host: this._hostKind(), board, detectedAt: Date.now(), reason: `${reason}-upgrade` };
      this._emit("board", this.result);
    }
  }

  _hasChessEvidence(c) {
    if (c.strategies?.apiFen) {
      try {
        const fen = c.strategies.apiFen();
        if (fen && FEN_RX.test(fen)) return true;
      } catch {}
    }
    if (c.strategies?.pieceLayer) {
      try {
        if (this._plausibleBoard(c.strategies.pieceLayer())) return true;
      } catch {}
    }
    try { if (this._fenFromDom()) return true; } catch {}
    return false;
  }

  _plausibleBoard(b) {
    if (!Array.isArray(b) || b.length !== 64) return false;
    let wk = 0, bk = 0, n = 0;
    for (const p of b) {
      if (!p) continue;
      n++;
      if (p === "K") wk++;
      else if (p === "k") bk++;
    }
    return wk === 1 && bk === 1 && n >= 2 && n <= 64;
  }

  _hostKind() {
    const h = location.hostname;
    if (/(^|\.)chess\.com$/.test(h)) return "chesscom";
    if (/(^|\.)lichess\.org$/.test(h)) return "lichess";
    if (/(^|\.)worldchess\.com$/.test(h) || /(^|\.)chessarena\.com$/.test(h)) return "worldchess";
    return "generic";
  }

  allCandidates() {
    const candidates = [];
    candidates.push(...this._detectWebComponents());
    candidates.push(...this._detectGridBoards());
    candidates.push(...this._detectPieceLayerBoards());
    candidates.push(...this._detectCanvasBoards());
    for (const c of candidates) c.score += this._prominence(c);
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  findBestBoard() {
    return this.allCandidates()[0] || null;
  }

  _prominence(c) {
    const rect = c.el.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    const offscreen = rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw;
    if (offscreen) return -40;

    let bonus = Math.min(30, size / 24);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(cx - vw / 2, cy - vh / 2) / Math.hypot(vw / 2, vh / 2);
    bonus += (1 - Math.min(1, dist)) * 8;
    if (size < 200) bonus -= 12;
    return bonus;
  }

  _baseCandidate(el, score, strategies) {
    const rect = el.getBoundingClientRect();
    return {
      el, rect, score, strategies,
      flipped: this._detectFlipped(el),
      size: Math.min(rect.width, rect.height),
    };
  }

  _detectWebComponents() {
    const out = [];
    const selectors = ["wc-chess-board", "chess-board", "cg-board", "cg-container", "chessboard", "l-chess-board"];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 100 || r.height < 100) continue;
        const c = this._baseCandidate(el, 60, {});
        if (el.game && typeof el.game.getFEN === "function") {
          c.score += 40;
          c.strategies.apiFen = () => el.game.getFEN();
          c.strategies.apiMove = (uci) => {
            try {
              el.game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
              return true;
            } catch { return false; }
          };
          if (typeof el.game.getPlayingAs === "function") {
            c.strategies.playingAs = () => {
              try {
                const v = el.game.getPlayingAs();
                return v === 2 ? "b" : v === 1 ? "w" : null;
              } catch { return null; }
            };
          }
          if (typeof el.game.getTurn === "function") {
            c.strategies.turn = () => {
              try {
                const v = el.game.getTurn();
                return v === 2 ? "b" : v === 1 ? "w" : null;
              } catch { return null; }
            };
          }
          if (this._hostKind() === "chesscom") {
            // el.game.move() applies the move to chess.com's local game object
            // but never submits it through their live pipeline - the server,
            // opponent and move list never see it. In live games (playingAs
            // known) the synthetic input path is the only real move channel.
            c.strategies.inputFirst = true;
            c.strategies.siteAck = (san) => {
              try {
                const norm = (s) => String(s || "").replace(/[+#!?]/g, "").trim();
                const target = norm(san);
                if (!target) return false;
                const lists = document.querySelectorAll("wc-simple-move-list, .vertical-move-list, [class*='move-list'], [class*='movelist']");
                for (const list of lists) {
                  const nodes = list.querySelectorAll(".node, .move-node, [class*='node'], [data-ply], .move");
                  if (!nodes.length) continue;
                  const last = nodes[nodes.length - 1];
                  const txt = norm(last.textContent);
                  if (txt === target) return true;
                  // figurine notation: piece letter may be an icon, leaving e.g. "f3"
                  if (txt === target.slice(1) && /^[KQRBN]/.test(target) && last.querySelector("[class*='piece'], [class*='figure'], span, svg, img")) return true;
                }
                return false;
              } catch { return false; }
            };
          }
        }
        if (sel === "cg-container" || el.querySelector("cg-board")) {
          c.score += 25;
          c.strategies.pieceLayer = this._makePieceLayerReader(el);
          // Lichess exposes no playing-as API, so board orientation was being
          // used as a guess. Inside a real game lichess always orients the
          // board to the player's own colour, which makes it authoritative -
          // but only while we are actually a player, not spectating.
          if (this._hostKind() === "lichess") {
            c.strategies.playingAs = () => {
              try {
                // must be scoped to THIS board - lichess pages can hold other
                // mini boards whose orientation says nothing about our game
                const wrap = el.closest(".cg-wrap") || el.querySelector(".cg-wrap");
                if (!wrap || !wrap.closest(".round__app")) return null;
                if (wrap.classList.contains("orientation-black")) return "b";
                if (wrap.classList.contains("orientation-white")) return "w";
                return null;
              } catch { return null; }
            };
          }
        }
        out.push(c);
      }
    }
    return out;
  }

  _detectGridBoards() {
    const out = [];
    const grids = document.querySelectorAll("[class*='board'],[id*='board'],[class*='chessboard']");
    for (const el of grids) {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || Math.abs(r.width - r.height) > r.width * 0.15) continue;
      const kids = el.children.length === 64 ? el.children : el.querySelectorAll("[class*='square'],[data-square]");
      if (kids.length !== 64) continue;
      let named = 0;
      for (const k of kids) {
        if (k.dataset?.square || /[a-h][1-8]/.test(k.className)) named++;
      }
      const score = 45 + (named > 32 ? 25 : named > 8 ? 15 : 0);
      const c = this._baseCandidate(el, score, {});
      c.squareGrid = [...kids];
      c.strategies.gridMove = true;
      out.push(c);
    }
    return out;
  }

  _detectPieceLayerBoards() {
    const out = [];
    const nodes = document.querySelectorAll(PIECE_SELECTOR);
    if (nodes.length < 4) return out;

    const groups = new Map();
    for (const p of nodes) {
      const root = this._boardRootFor(p);
      if (!root) continue;
      groups.set(root, (groups.get(root) || 0) + 1);
    }

    for (const [root, count] of groups) {
      if (count < 6 || count > 64) continue;
      const reader = this._makePieceLayerReader(root);
      if (!reader || !reader()) continue;
      out.push(this._baseCandidate(root, 55 + Math.min(20, count), { pieceLayer: reader }));
    }
    return out;
  }

  _boardRootFor(pieceEl) {
    let el = pieceEl.parentElement;
    let hops = 0;
    while (el && hops++ < 8) {
      const r = el.getBoundingClientRect();
      const square = r.width >= 120 && Math.abs(r.width - r.height) <= r.width * 0.12;
      if (square && el.querySelectorAll(PIECE_SELECTOR).length >= 6) return el;
      el = el.parentElement;
    }
    return null;
  }

  _detectCanvasBoards() {
    const out = [];
    for (const el of document.querySelectorAll("canvas")) {
      const r = el.getBoundingClientRect();
      if (r.width < 160 || Math.abs(r.width - r.height) > r.width * 0.12) continue;
      const cls = el.getAttribute("class") || "";
      let score = 25;
      if (/board|chess/i.test(cls)) score += 15;
      if (el.parentElement && /board|chess/i.test(el.parentElement.className || "")) score += 10;
      const c = this._baseCandidate(el, score, {});
      c.canvasOnly = true;
      out.push(c);
    }
    return out;
  }

  _detectFlipped(el) {
    const wrap = el.closest?.(".cg-wrap") || el.querySelector?.(".cg-wrap");
    if (wrap) {
      if (wrap.classList.contains("orientation-black")) return true;
      if (wrap.classList.contains("orientation-white")) return false;
    }
    const hostEl = el.closest?.("wc-chess-board, chess-board") || (el.matches?.("wc-chess-board, chess-board") ? el : null);
    if (hostEl?.classList?.contains("flipped")) return true;
    const coords = el.querySelectorAll("[class*='coord'], .file, .rank, text");
    for (const c of coords) {
      const t = (c.textContent || "").trim();
      if (t === "a" || t === "1") {
        const cr = c.getBoundingClientRect();
        const br = el.getBoundingClientRect();
        if (t === "a") return cr.left > br.left + br.width / 2;
        return cr.top < br.top + br.height / 2;
      }
    }
    const nums = [...el.querySelectorAll("*")].filter((n) => n.children.length === 0 && n.textContent?.trim() === "8");
    if (nums.length) {
      const nr = nums[0].getBoundingClientRect();
      const br = el.getBoundingClientRect();
      return nr.top > br.top + br.height / 2;
    }
    return false;
  }

  _isVisible(el) {
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    }
    return el.offsetParent !== null;
  }

  _makePieceLayerReader(root) {
    const read = () => {
      const pieces = root.querySelectorAll(PIECE_SELECTOR);
      if (!pieces.length) return null;
      const br = root.getBoundingClientRect();
      if (br.width < 50) return null;
      const sq = br.width / 8;
      const board = new Array(64).fill(null);
      let count = 0;
      for (const p of pieces) {
        const cls = (p.className || "").toString();
        if (/\b(ghost|fading|dragging|anim)\b/i.test(cls)) continue;
        if (p.closest("cg-promotion, #promotion-choice, [class*='promotion'], [id*='promotion']")) continue;
        if (!this._isVisible(p)) continue;
        let color = null, type = null;
        const m = cls.match(PIECE_NAME_RX);
        if (m) {
          color = m[1].toLowerCase() === "white" ? "w" : "b";
          type = m[2][0].toLowerCase();
          if (/knight/i.test(m[2])) type = "n";
        } else {
          for (const part of cls.split(/[\s_/-]+/).filter(Boolean)) {
            const code = part.match(PIECE_CODE_RX);
            if (code) {
              color = code[1].toLowerCase();
              type = code[2].toLowerCase();
              break;
            }
            if (SHORT_PIECE_RX.test(part)) type = part.toLowerCase();
          }
        }
        if (!type || !"kqrbnp".includes(type)) continue;
        const pr = p.getBoundingClientRect();
        const cx = pr.left + pr.width / 2 - br.left;
        const cy = pr.top + pr.height / 2 - br.top;
        const file = Math.max(0, Math.min(7, Math.floor(cx / sq)));
        const rank = Math.max(0, Math.min(7, Math.floor(cy / sq)));
        if (!color) color = pr.top < br.top + br.height / 2 ? "b" : "w";
        board[rank * 8 + file] = color === "w" ? type.toUpperCase() : type;
        count++;
      }
      if (count < 2) return null;
      return board;
    };
    return read;
  }

  extractFEN(candidate) {
    if (candidate.strategies.apiFen) {
      try {
        const fen = candidate.strategies.apiFen();
        if (fen && FEN_RX.test(fen)) return fen;
      } catch {}
    }
    const docText = this._fenFromDom();
    if (docText) return docText;
    if (candidate.strategies.pieceLayer) {
      const board = candidate.strategies.pieceLayer();
      if (board) {
        // inference is called unconditionally so it keeps tracking the board
        // even while a more authoritative source is available
        const inferred = this._inferTurnFromBoard(board);
        // Order matters: prefer sources that describe the position actually on
        // screen. The move list describes the whole game, so while the user is
        // browsing history it reports the turn for the final position instead
        // of the one being displayed - it is only a last resort.
        const turn = candidate.strategies.turn?.()
          || this._turnFromLastMove(candidate.el)
          || inferred
          || this._turnFromMoveList();
        const fen = this._boardArrayToFen(board, candidate.flipped, turn);
        if (fen) return fen;
      }
    }
    const fromMoves = this._fenFromMoveList();
    if (fromMoves) return fromMoves;
    return null;
  }

  _fenFromDom() {
    for (const input of document.querySelectorAll("input[value*='/']")) {
      const v = input.value || "";
      const m = v.match(FEN_RX);
      if (m) return m[0];
    }
    for (const el of document.querySelectorAll("[data-fen], [fen]")) {
      const v = el.dataset?.fen || el.getAttribute("fen") || "";
      if (FEN_RX.test(v)) return v.match(FEN_RX)[0];
    }
    return null;
  }

  _collectSans() {
    const moveNodes = document.querySelectorAll(
      ".move san, .move .node, .moves san, move, [class*='move'] span, .tview2 move, .notation-move"
    );
    const sans = [];
    for (const n of moveNodes) {
      const t = (n.textContent || "").trim();
      if (SAN_RX.test(t)) sans.push(t);
    }
    return sans;
  }

  _turnFromMoveList() {
    const sans = this._collectSans();
    if (!sans.length) return null;
    return sans.length % 2 === 0 ? "w" : "b";
  }

  // Chessground boards (lichess and friends) mark the last move's two squares
  // and position everything with the same transform, so the piece standing on
  // the destination square tells us who just moved. This is the only reliable
  // turn source on the very first read, before we have two boards to compare.
  _turnFromLastMove(root) {
    try {
      const scope = root && root.querySelector ? root : document;
      const squares = scope.querySelectorAll("square.last-move");
      if (squares.length !== 2) return null;

      const keyOf = (el) => {
        const m = /translate\(\s*(-?[\d.]+)px[,\s]+(-?[\d.]+)px/.exec(el.getAttribute("style") || "");
        return m ? `${Math.round(parseFloat(m[1]))},${Math.round(parseFloat(m[2]))}` : null;
      };

      const occupied = new Map();
      for (const p of scope.querySelectorAll("piece")) {
        const k = keyOf(p);
        if (k) occupied.set(k, p);
      }

      for (const sq of squares) {
        const k = keyOf(sq);
        const piece = k ? occupied.get(k) : null;
        if (!piece) continue;
        // the side that just moved is the one sitting on the destination
        if (piece.classList.contains("white")) return "b";
        if (piece.classList.contains("black")) return "w";
      }
      return null;
    } catch {
      return null;
    }
  }

  // Sites that expose no turn API and no scrapeable move list (lichess games,
  // for one) used to fall through to a hardcoded "white to move". That made
  // every black-to-move position analyse as white and made auto-move believe
  // it was always our turn. Watching which colour actually moved between two
  // board reads gives the side to move without needing any site cooperation.
  _inferTurnFromBoard(board) {
    const START = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
    const sig = board.map((p) => p || ".").join("");
    const prevSig = this._turnPrevSig;
    const prevArr = this._turnPrevArr;
    this._turnPrevSig = sig;
    this._turnPrevArr = board.slice();

    const normalised = sig.replace(/\./g, ".");
    if (normalised === START || normalised === [...START].reverse().join("")) {
      this._inferredTurn = "w";
      return "w";
    }
    if (!prevArr || sig === prevSig) return this._inferredTurn || null;

    let changed = 0;
    let mover = null;
    for (let i = 0; i < 64; i++) {
      const before = prevArr[i] || null;
      const after = board[i] || null;
      if (before === after) continue;
      changed++;
      // a piece arriving on a square identifies who just moved
      if (after) mover = after === after.toUpperCase() ? "w" : "b";
    }
    // a board flip or a whole new game changes far more than one move can
    if (!changed || changed > 5 || !mover) return this._inferredTurn || null;

    this._inferredTurn = mover === "w" ? "b" : "w";
    return this._inferredTurn;
  }

  _fenFromMoveList() {
    const sans = this._collectSans();
    if (!sans.length) return null;
    const key = `${sans.length}|${sans[sans.length - 1]}`;
    if (this._moveListKey === key) return this._moveListFen;
    let fen = null;
    try {
      const chess = new Chess();
      for (const san of sans) chess.move(san);
      fen = chess.fen();
    } catch {
      fen = null;
    }
    this._moveListKey = key;
    this._moveListFen = fen;
    return fen;
  }

  _boardArrayToFen(board, flipped, turn = null) {
    const rows = [];
    // squares in reading order, rank 8 first, regardless of how the board is
    // oriented on screen
    const squares = new Array(64).fill(null);
    for (let r = 0; r < 8; r++) {
      let row = "";
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const idx = flipped ? (7 - r) * 8 + (7 - f) : r * 8 + f;
        const p = board[idx];
        squares[r * 8 + f] = p || null;
        if (!p) empty++;
        else {
          if (empty) { row += empty; empty = 0; }
          row += p;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return `${rows.join("/")} ${turn === "b" ? "b" : "w"} ${this._castlingFrom(squares)} - 0 1`;
  }

  // Reading the pieces off the screen says nothing about whether castling is
  // still allowed, and claiming it never is would be its own mistake: the
  // engines would refuse to castle and every opening book lookup would miss,
  // because the rights are part of the position's identity. A king and rook
  // still sitting on their starting squares is the best evidence available.
  _castlingFrom(squares) {
    const at = (file, rank) => squares[(8 - rank) * 8 + "abcdefgh".indexOf(file)];
    let rights = "";
    if (at("e", 1) === "K") {
      if (at("h", 1) === "R") rights += "K";
      if (at("a", 1) === "R") rights += "Q";
    }
    if (at("e", 8) === "k") {
      if (at("h", 8) === "r") rights += "k";
      if (at("a", 8) === "r") rights += "q";
    }
    return rights || "-";
  }

  squareToPoint(candidate, square) {
    const file = "abcdefgh".indexOf(square[0]);
    const rank = 8 - Number(square[1]);
    if (file < 0 || rank < 0) return null;
    const rect = candidate.el.getBoundingClientRect();
    const sq = Math.min(rect.width, rect.height) / 8;
    const f = candidate.flipped ? 7 - file : file;
    const r = candidate.flipped ? 7 - rank : rank;
    return { x: rect.left + (f + 0.5) * sq, y: rect.top + (r + 0.5) * sq };
  }
}
