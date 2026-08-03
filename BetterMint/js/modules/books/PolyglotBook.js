import { POLYGLOT_RANDOM_ARRAY } from "./polyglotKeys.js";

const MASK64 = 0xffffffffffffffffn;
const FILES = "abcdefgh";

function squareIndex(file, rank) {
  return rank * 8 + file;
}

function pieceAt(boardChar) {
  const map = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
  return map[boardChar.toLowerCase()] ?? -1;
}

// Polyglot numbers squares from white's side: a1 is 0 and h8 is 63. A FEN is
// written the other way round, starting at rank 8, so reading it straight into
// a square index mirrors the board and every key comes out wrong.
function fenToBoardArray(boardStr) {
  const out = new Array(64).fill(null);
  let index = 0;
  for (const ch of boardStr) {
    if (ch === "/") continue;
    if (ch >= "1" && ch <= "8") {
      index += Number(ch);
      continue;
    }
    out[squareIndex(index % 8, 7 - Math.floor(index / 8))] = ch;
    index++;
  }
  return out;
}

export function polyglotHash(fen) {
  const parts = fen.trim().split(/\s+/);
  const board = fenToBoardArray(parts[0] || "");
  const turn = parts[1] || "w";
  const castling = parts[2] || "-";
  const ep = parts[3] || "-";
  let hash = 0n;

  for (let sq = 0; sq < 64; sq++) {
    const ch = board[sq];
    if (!ch) continue;
    const kind = pieceAt(ch);
    if (kind < 0) continue;
    const isWhite = ch === ch.toUpperCase();
    const pieceIndex = isWhite ? kind * 2 + 1 : kind * 2;
    hash ^= POLYGLOT_RANDOM_ARRAY[64 * pieceIndex + sq];
  }

  if (castling.includes("K")) hash ^= POLYGLOT_RANDOM_ARRAY[768];
  if (castling.includes("Q")) hash ^= POLYGLOT_RANDOM_ARRAY[769];
  if (castling.includes("k")) hash ^= POLYGLOT_RANDOM_ARRAY[770];
  if (castling.includes("q")) hash ^= POLYGLOT_RANDOM_ARRAY[771];

  // The en passant file only counts when the side to move actually has a pawn
  // beside the passing pawn, otherwise the position hashes as if there were no
  // capture available.
  if (ep !== "-") {
    const file = FILES.indexOf(ep[0]);
    const epRank = Number(ep[1]);
    const usable = (turn === "w" && epRank === 6) || (turn === "b" && epRank === 3);
    if (file >= 0 && usable) {
      const rank = turn === "w" ? 4 : 3;
      const ourPawn = turn === "w" ? "P" : "p";
      let canCapture = false;
      for (const df of [-1, 1]) {
        const f = file + df;
        if (f < 0 || f > 7) continue;
        if (board[squareIndex(f, rank)] === ourPawn) {
          canCapture = true;
          break;
        }
      }
      if (canCapture) hash ^= POLYGLOT_RANDOM_ARRAY[772 + file];
    }
  }

  if (turn === "w") hash ^= POLYGLOT_RANDOM_ARRAY[780];
  return hash & MASK64;
}

// The rows in a polyglot move are counted from white's side as well, so row 0
// is rank 1 rather than rank 8.
export function decodePolyglotMove(raw) {
  const to = raw & 0x3f;
  const from = (raw >> 6) & 0x3f;
  const promo = (raw >> 12) & 0x7;
  const promoChar = ["", "n", "b", "r", "q"][promo] || "";
  const fromSq = FILES[from & 7] + String((from >> 3) + 1);
  const toSq = FILES[to & 7] + String((to >> 3) + 1);
  return fromSq + toSq + promoChar;
}

export class PolyglotBook {
  constructor(name = "book", buffer = null) {
    this.name = name;
    this.entries = null;
    this.count = 0;
    this.loadedAt = null;
    if (buffer) this.load(buffer);
  }

  load(buffer) {
    const view = new DataView(buffer);
    const count = Math.floor(buffer.byteLength / 16);
    this.entries = new DataView(buffer);
    this.count = count;
    this.loadedAt = Date.now();
  }

  get loaded() {
    return this.entries !== null && this.count > 0;
  }

  _readKey(i) {
    const off = i * 16;
    const hi = this.entries.getUint32(off);
    const lo = this.entries.getUint32(off + 4);
    return (BigInt(hi) << 32n) | BigInt(lo);
  }

  query(fen) {
    if (!this.loaded) return [];
    const key = polyglotHash(fen);
    let lo = 0;
    let hi = this.count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this._readKey(mid) < key) lo = mid + 1;
      else hi = mid;
    }
    const out = [];
    for (let i = lo; i < this.count; i++) {
      if (this._readKey(i) !== key) break;
      const off = i * 16;
      const rawMove = this.entries.getUint16(off + 8);
      const weight = this.entries.getUint16(off + 10);
      const learn = this.entries.getUint32(off + 12);
      out.push({
        move: decodePolyglotMove(rawMove),
        weight,
        learn,
      });
    }
    const total = out.reduce((s, m) => s + (m.weight || 1), 0) || 1;
    for (const m of out) m.pct = Math.round(((m.weight || 1) / total) * 1000) / 10;
    out.sort((a, b) => (b.weight || 1) - (a.weight || 1));
    return out;
  }

  has(fen) {
    return this.query(fen).length > 0;
  }

  static pickWeighted(moves, rng = Math.random) {
    if (!moves.length) return null;
    const total = moves.reduce((s, m) => s + (m.weight || 1), 0);
    let r = rng() * total;
    for (const m of moves) {
      r -= m.weight || 1;
      if (r <= 0) return m;
    }
    return moves[moves.length - 1];
  }
}
