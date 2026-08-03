// Checks the polyglot hash against the reference keys published with the
// format. Run with: node tools/polyglot-check.mjs
import { polyglotHash, decodePolyglotMove } from "../js/modules/books/PolyglotBook.js";

const CASES = [
  ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "463b96181691fc9c", "start"],
  ["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", "823c9b50fd114196", "1.e4"],
  ["rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2", "0756b94461c50fb0", "1.e4 d5"],
  ["rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2", "662fafb965db29d4", "2.e5"],
  ["rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3", "22a48b5a8e47ff78", "2...f5 (en passant available)"],
  ["rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPPKPPP/RNBQ1BNR b kq - 0 3", "652a607ca3f242c1", "3.Ke2 (castling rights lost)"],
  ["rnbq1bnr/ppp1pkpp/8/3pPp2/8/8/PPPPKPPP/RNBQ1BNR w - - 0 4", "00fdd303c946bdd9", "3...Kf7"],
  ["rnbqkbnr/p1pppppp/8/8/PpP4P/8/1P1PPPP1/RNBQKBNR b KQkq c3 0 3", "3c8123ea7b067637", "en passant capturable"],
  ["rnbqkbnr/p1pppppp/8/8/P6P/R1p5/1P1PPPP1/1NBQKBNR b Kkq - 0 4", "5c3f9b829b279560", "rook moved, one right left"],
];

let failures = 0;
for (const [fen, expected, label] of CASES) {
  const got = polyglotHash(fen).toString(16).padStart(16, "0");
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${got}  ${label}${ok ? "" : `  (expected ${expected})`}`);
}

// A move is packed as to-file, to-row, from-file, from-row, with row 0 = rank 1.
const MOVES = [
  [(4 << 6) | (1 << 9) | 4 | (3 << 3), "e2e4"],
  [(4 << 6) | (6 << 9) | 4 | (7 << 3), "e7e8"],
  [(0 << 6) | (0 << 9) | 7 | (0 << 3), "a1h1"],
];
for (const [raw, expected] of MOVES) {
  const got = decodePolyglotMove(raw);
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${got}  move decode${ok ? "" : `  (expected ${expected})`}`);
}

console.log(failures === 0 ? "\nall polyglot reference checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
