import { Chess } from "../../vendor/chess.js";
import { resolveTheme } from "../ui/HUD.js";
import { rankColor } from "../ui/RankColors.js";

const GLYPHS = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };

const WINDOW_NAME = "bm_notes_view";

const OPEN_FLAG = "bm.notes.open";

const THEMES = {
  dark: {
    bg: "#0e1117", panel: "#161b26", text: "#e6edf3", dim: "#8b949e", line: "#232a36",
    light: "#ebecd0", darkSq: "#739552", accent: "#4ade80", barBg: "#e6edf3", barFill: "#0e1117",
  },
  neon: {
    bg: "#07070f", panel: "#0e0e1c", text: "#c8f9ff", dim: "#5f7d90", line: "#1b2340",
    light: "#2a2f4a", darkSq: "#151a30", accent: "#22d3ee", barBg: "#22d3ee", barFill: "#07070f",
  },
  light: {
    bg: "#f5f6f8", panel: "#ffffff", text: "#1c2128", dim: "#6b7280", line: "#e2e5ea",
    light: "#f0d9b5", darkSq: "#b58863", accent: "#15803d", barBg: "#1c2128", barFill: "#f5f6f8",
  },
  contrast: {
    bg: "#000000", panel: "#0a0a0a", text: "#ffffff", dim: "#b0b0b0", line: "#333333",
    light: "#ffffff", darkSq: "#555555", accent: "#ffff00", barBg: "#ffffff", barFill: "#000000",
  },
};

const WINDOW_HTML = (title) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI Variable Text","SF Pro Text",-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
html,body{height:100%;overflow:hidden}
body{display:flex;flex-direction:column;padding:0}

#top{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid transparent;flex:0 0 auto}
#ttl{font-size:12px;font-weight:700;letter-spacing:.4px;opacity:.9}
#top .spacer{flex:1}
#badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
.badge{font-size:9px;font-weight:700;padding:3px 8px;border-radius:99px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}

#main{flex:1;display:flex;gap:14px;padding:14px;min-height:0}
#left{display:flex;gap:10px;align-items:flex-start;flex:0 0 auto}

#evalwrap{display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 auto}
#bar{position:relative;width:14px;border-radius:7px;overflow:hidden;display:block;box-shadow:0 0 8px rgba(0,0,0,.3),inset 0 0 0 1px rgba(255,255,255,.06)}
#barfill{position:absolute;left:0;right:0;bottom:0;transition:height .4s cubic-bezier(.34,1.56,.64,1)}
#evaltext{font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.2px;transition:color .3s,text-shadow .3s}
#evaltext.glow{text-shadow:0 0 6px currentColor}

#boardwrap{position:relative;flex:0 0 auto}
#board{position:relative;user-select:none;border-radius:10px;overflow:hidden;box-shadow:0 10px 36px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.04)}
.row{display:flex}
.sq{display:flex;align-items:center;justify-content:center;position:relative}
.sq .pc{line-height:1;font-weight:400;transition:opacity .15s ease,transform .15s ease}
.sq .pc:hover{transform:scale(1.08)}
.sq .cd{position:absolute;font-size:8px;font-weight:700;opacity:.5;pointer-events:none}
.sq .cd.f{right:2px;bottom:1px}
.sq .cd.r{left:2px;top:1px}
.pc.w{color:#fff;text-shadow:0 0 1px #000,0 0 2px #000,0 1px 4px rgba(0,0,0,.6)}
.pc.b{color:#1a1a1a;text-shadow:0 0 1px rgba(255,255,255,.7),0 1px 4px rgba(0,0,0,.5)}
canvas{position:absolute;top:0;left:0;pointer-events:none}

#side{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:10px;overflow-y:auto;overflow-x:hidden}
.card{border-radius:12px;padding:10px 11px;font-size:12px;flex:0 0 auto;transition:border-color .2s,box-shadow .2s}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.15)}
.card h4{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px;font-weight:800;display:flex;justify-content:space-between;align-items:center;gap:8px}
.card .tag{font-size:9px;padding:2px 7px;border-radius:99px;font-weight:800;white-space:nowrap}
.row2{display:flex;align-items:center;gap:8px;padding:4px 0;font-variant-numeric:tabular-nums;border-bottom:1px solid rgba(128,128,128,.12)}
.row2:last-child{border-bottom:none}
.row2 .pill{font-size:9px;font-weight:800;padding:2px 6px;border-radius:5px;color:#fff;min-width:22px;text-align:center;flex:0 0 auto}
.row2 .mv{font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row2 .sc{font-weight:800;flex:0 0 auto}
.row2 .meta{opacity:.6;font-size:10px;flex:0 0 auto;max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.empty{opacity:.4;font-style:italic;font-size:11px;padding:3px 0}
#side::-webkit-scrollbar{width:7px}
#side::-webkit-scrollbar-track{background:transparent}
#side::-webkit-scrollbar-thumb{border-radius:4px;background:rgba(128,128,128,.35)}
#side::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,.55)}

#top,#left,#side>.card{animation:panelIn .3s cubic-bezier(.4,0,.2,1) both}
#left{animation-delay:.04s}
#side>.card:nth-child(1){animation-delay:.08s}
#side>.card:nth-child(2){animation-delay:.12s}
#side>.card:nth-child(3){animation-delay:.16s}
@keyframes panelIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.row2{transition:background .16s}
.row2:hover{background:rgba(128,128,128,.10)}
.badge{transition:background .2s,color .2s}
#evaltext{transition:color .25s}

.sq .pc{transition:opacity .12s linear}

@media (prefers-reduced-motion: reduce){
  #top,#left,#side>.card{animation:none}
  #barfill,.row2,.badge,#evaltext,.sq .pc{transition-duration:.01ms}
}
</style></head><body>
<div id="top">
  <span id="ttl">${title}</span>
  <span class="spacer"></span>
  <div id="badges"></div>
</div>
<div id="main">
  <div id="left">
    <div id="evalwrap"><div id="evaltext"></div><div id="bar"><div id="barfill"></div></div></div>
    <div id="boardwrap"><div id="board"></div></div>
  </div>
  <div id="side">
    <div class="card" id="c-coach" style="display:none"><h4><span>Coach</span><span class="tag" id="t-coachmode"></span></h4><div id="d-coach" style="font-size:11px;line-height:1.6"></div></div>
    <div class="card" id="c-lines"><h4><span>Engine</span><span class="tag" id="t-depth"></span></h4><div id="d-lines"></div></div>
    <div class="card" id="c-tb"><h4><span>Tablebase</span><span class="tag" id="t-tb"></span></h4><div id="d-tb"></div></div>
    <div class="card" id="c-book"><h4><span>Book</span><span class="tag" id="t-book"></span></h4><div id="d-book"></div></div>
  </div>
</div>
</body></html>`;

export class OverlayWindow {
  constructor(settings) {
    this.settings = settings;
    this.win = null;
    this._chess = new Chess();
    this._lastData = null;
    this._lastCoachReport = null;
  }

  _esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  get isOpen() {
    return this.win && !this.win.closed;
  }

  get theme() {
    const name = this.settings.get("ov.theme");
    if (name === "custom") {

      const t = resolveTheme(this.settings);
      return {
        bg: t.deep, panel: t.surface, text: t.text, dim: t.dim, line: t.line,
        light: this.settings.get("ov.lightSquare") || "#ebecd0",
        darkSq: this.settings.get("ov.darkSquare") || "#739552",
        accent: t.accent, barBg: t.text, barFill: t.deep,
      };
    }
    return THEMES[name] || THEMES.dark;
  }

  open() {
    if (this.isOpen) {
      this.win.focus();
      return true;
    }
    const scale = this.settings.get("ov.externalScale");
    const size = Math.round(448 * scale);
    const title = String(this.settings.get("priv.disguiseName") || "Notes");

    const panels = this._anyPanel() ? 260 : 0;
    const width = size + 24 + 28 + panels + 28;
    const height = size + 48 + 28 + 16;
    this.win = window.open("", WINDOW_NAME, `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`);
    if (!this.win) return false;

    this.win.document.open();
    this.win.document.write(WINDOW_HTML(title));
    this.win.document.close();
    this.win.document.title = title;
    this._applyTheme();
    this._buildBoard();
    if (this._lastData) this.update(this._lastData);
    this._remember(true);
    return true;
  }

  restore(onAdopted) {
    if (!this.wasOpen || this.isOpen) return false;
    if (this.open()) return true;
    const retry = () => {
      window.removeEventListener("pointerdown", retry, true);
      window.removeEventListener("keydown", retry, true);
      if (this.wasOpen && !this.isOpen && this.open()) onAdopted?.();
    };
    window.addEventListener("pointerdown", retry, true);
    window.addEventListener("keydown", retry, true);
    return false;
  }

  get wasOpen() {
    try { return sessionStorage.getItem(OPEN_FLAG) === "1"; } catch { return false; }
  }

  _remember(open) {
    try {
      if (open) sessionStorage.setItem(OPEN_FLAG, "1");
      else sessionStorage.removeItem(OPEN_FLAG);
    } catch {}
  }

  _applyTheme() {
    const t = this.theme;
    const doc = this.win.document;
    const b = doc.body;
    b.style.background = t.bg;
    b.style.color = t.text;
    b.style.opacity = String(this.settings.get("ov.externalOpacity"));
    for (const card of doc.querySelectorAll(".card")) {
      card.style.background = t.panel;
      card.style.border = `1px solid ${t.line}`;
    }
    const top = doc.getElementById("top");
    if (top) {
      top.style.background = t.panel;
      top.style.borderBottomColor = t.line;
    }
    const ttl = doc.getElementById("ttl");
    if (ttl) ttl.style.color = t.dim;
    const evalText = doc.getElementById("evaltext");
    if (evalText) evalText.style.color = t.text;
    for (const h of doc.querySelectorAll(".card h4")) h.style.color = t.dim;
    for (const tag of doc.querySelectorAll(".tag")) {
      tag.style.background = t.line;
      tag.style.color = t.text;
    }

    const bar = doc.getElementById("bar");
    const fill = doc.getElementById("barfill");
    if (bar) bar.style.background = t.barFill;
    if (fill) fill.style.background = t.barBg;

    const white = this.settings.get("ov.pieceWhite") || "#ffffff";
    const black = this.settings.get("ov.pieceBlack") || "#1a1a1a";
    for (const p of doc.querySelectorAll(".pc.w")) p.style.color = white;
    for (const p of doc.querySelectorAll(".pc.b")) p.style.color = black;
    const side = doc.getElementById("side");
    if (side) side.style.display = this._anyPanel() ? "flex" : "none";
  }

  _anyPanel() {
    return !!(this.settings.get("ov.showLines") || this.settings.get("ov.showBook") || this.settings.get("ov.showTb"));
  }

  refreshTheme() {
    if (!this.isOpen) return;
    this._applyTheme();
    this._buildBoard();
    if (this._lastData) this.update(this._lastData);
  }

  close() {
    if (this.isOpen) this.win.close();
    this.win = null;
    this._remember(false);
  }

  _buildBoard() {
    const doc = this.win.document;
    const board = doc.getElementById("board");
    board.querySelectorAll(".row").forEach((r) => r.remove());
    const scale = this.settings.get("ov.externalScale");
    const sq = Math.round(56 * scale);
    for (let r = 0; r < 8; r++) {
      const row = doc.createElement("div");
      row.className = "row";
      for (let f = 0; f < 8; f++) {
        const cell = doc.createElement("div");
        const isLight = (r + f) % 2 === 0;
        cell.className = "sq " + (isLight ? "light" : "dark");
        cell.style.background = isLight ? this.theme.light : this.theme.darkSq;
        cell.style.width = sq + "px";
        cell.style.height = sq + "px";
        cell.dataset.r = r;
        cell.dataset.f = f;
        const pc = doc.createElement("span");
        pc.className = "pc";
        pc.style.fontSize = Math.round(sq * 0.78) + "px";
        cell.appendChild(pc);

        const flip = this._lastData?.flipped;
        if (f === 0) {
          const rank = doc.createElement("span");
          rank.className = "cd r";
          rank.textContent = String(flip ? r + 1 : 8 - r);
          rank.style.color = isLight ? this.theme.darkSq : this.theme.light;
          cell.appendChild(rank);
        }
        if (r === 7) {
          const file = doc.createElement("span");
          file.className = "cd f";
          file.textContent = "abcdefgh"[flip ? 7 - f : f];
          file.style.color = isLight ? this.theme.darkSq : this.theme.light;
          cell.appendChild(file);
        }
        row.appendChild(cell);
      }
      board.appendChild(row);
    }

    const bar = doc.getElementById("bar");
    if (bar) bar.style.height = sq * 8 + "px";

    const canvas = doc.createElement("canvas");
    canvas.width = sq * 8;
    canvas.height = sq * 8;
    canvas.style.width = sq * 8 + "px";
    canvas.style.height = sq * 8 + "px";
    board.appendChild(canvas);
    this._canvas = canvas;
  }

  update(data = {}) {
    this._lastData = { ...this._lastData, ...data };
    if (!this.isOpen) return;
    const {
      fen, moves = [], flipped = false, evalCp = null, evalMate = null,
      evalWhiteCp = null, evalWhiteMate = null, mirror = true,
      lines = [], bookLines = [], tbLines = [], depth = null, stage = null, variant = null,
      matchedElo = null, source = null,
    } = this._lastData;

    const doc = this.win.document;
    const t = this.theme;
    const scale = this.settings.get("ov.externalScale");
    const sq = Math.round(56 * scale);

    if (mirror && fen) {
      try {
        this._chess.load(fen);
        const board = this._chess.board();
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const rr = flipped ? 7 - r : r;
            const ff = flipped ? 7 - f : f;
            const piece = board[rr][ff];
            const cell = doc.querySelector(`.sq[data-r='${r}'][data-f='${f}'] .pc`);
            if (!cell) continue;
            cell.textContent = piece ? GLYPHS[piece.type] : "";
            cell.className = "pc" + (piece ? " " + piece.color : "");
          }
        }
      } catch {}
    }

    const ctx = this._canvas.getContext("2d");
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    const colors = [
      this.settings.get("ui.arrowColor1"), this.settings.get("ui.arrowColor2"),
      this.settings.get("ui.arrowColor3"), "#a855f7", "#ef4444", "#6b7280",
    ];
    const style = this.settings.get("ui.arrowStyle");
    const glow = Number(this.settings.get("ui.arrowGlow")) || 0;
    moves.forEach((m, i) => {
      const uci = typeof m === "string" ? m : m?.move;
      if (!uci || uci.length < 4) return;
      const from = this._sqToXY(uci.slice(0, 2), sq, flipped);
      const to = this._sqToXY(uci.slice(2, 4), sq, flipped);
      if (!from || !to) return;
      const color = (typeof m === "object" && m.color) || colors[i % colors.length];
      const label = (typeof m === "object" && m.label) || "#" + (i + 1);
      this._arrow(ctx, from, to, color, sq * 0.16, label, sq, { style, glow, from: uci.slice(0, 2), to: uci.slice(2, 4), flipped });
    });

    this._renderEval(doc, t, evalCp, evalMate, evalWhiteCp, evalWhiteMate, flipped);
    this._renderBadges(doc, t, { stage, variant, matchedElo, source, depth });
    this._renderLines(doc, t, lines, depth);
    this._renderTb(doc, t, tbLines);
    this._renderBook(doc, t, bookLines);
    this._renderCoach(doc, t);

    if (this.settings.get("ov.alwaysOnTop")) {
      try { this.win.focus(); } catch {}
    }
  }

  _renderEval(doc, t, evalCp, evalMate, whiteCp, whiteMate, flipped) {
    const wrap = doc.getElementById("evalwrap");
    if (wrap) wrap.style.display = this.settings.get("ov.showEval") ? "flex" : "none";
    const fill = doc.getElementById("barfill");
    const text = doc.getElementById("evaltext");
    if (!fill) return;

    const evalPerspective = this.settings.get("ui.evalPerspective") || "player";
    let barCp, barMate, labelCp, labelMate;
    if (evalPerspective === "white") {
      barCp = whiteCp != null ? whiteCp : evalCp;
      barMate = whiteMate != null ? whiteMate : evalMate;
      labelCp = barCp; labelMate = barMate;
    } else if (evalPerspective === "engine") {
      barCp = evalCp; barMate = evalMate;
      labelCp = barCp; labelMate = barMate;
    } else {
      barCp = evalCp; barMate = evalMate;
      labelCp = barCp; labelMate = barMate;
    }

    let pct = 50;
    let label = "\u2014";
    if (barMate != null) pct = barMate > 0 ? 100 : 0;
    else if (barCp != null) pct = 50 + 50 * (2 / (1 + Math.exp(-0.004 * barCp)) - 1);

    if (labelMate != null) label = (labelMate > 0 ? "+M" : "-M") + Math.abs(labelMate);
    else if (labelCp != null) label = (labelCp >= 0 ? "+" : "") + (labelCp / 100).toFixed(2);

    if (flipped) pct = 100 - pct;
    fill.style.height = pct + "%";
    fill.style.width = "100%";
    if (text) {
      text.textContent = label;
      text.style.color = labelCp != null && labelCp < -50 ? "#f87171" : t.accent;
    }
  }

  _renderBadges(doc, t, { stage, variant, matchedElo, source }) {
    const host = doc.getElementById("badges");
    if (!host) return;
    const items = [];
    if (variant && variant !== "chess") items.push({ text: variant, bg: "#7c3aed" });
    if (stage) items.push({ text: stage, bg: t.line });
    if (matchedElo) items.push({ text: `elo ${matchedElo}`, bg: "#0ea5e9" });
    if (source) items.push({ text: source, bg: source === "tablebase" ? "#c084fc" : "#fbbf24" });
    host.innerHTML = "";
    for (const it of items) {
      const el = doc.createElement("span");
      el.className = "badge";
      el.textContent = it.text;
      el.style.background = it.bg;
      el.style.color = it.bg === t.line ? t.text : "#0b0f14";
      host.appendChild(el);
    }
    host.style.display = items.length ? "flex" : "none";
  }

  _renderLines(doc, t, lines, depth) {
    const card = doc.getElementById("c-lines");
    const host = doc.getElementById("d-lines");
    const tag = doc.getElementById("t-depth");
    if (!card || !host) return;
    card.style.display = this.settings.get("ov.showLines") ? "block" : "none";
    if (tag) tag.textContent = depth ? "d" + depth : "";
    if (!lines.length) {
      host.innerHTML = '<div class="empty">no analysis yet</div>';
      return;
    }
    host.innerHTML = "";
    const deepest = lines.length ? lines[Math.min(lines.length, 6) - 1].rank || 0 : 0;
    for (const l of lines.slice(0, 6)) {
      const row = doc.createElement("div");
      row.className = "row2";

      const pill = doc.createElement("span");
      pill.className = "pill";
      pill.textContent = "#" + (l.rank || "?");

      pill.style.background = rankColor(this.settings, l.rank || 1, deepest);

      const mv = doc.createElement("span");
      mv.className = "mv";
      mv.textContent = l.san || l.move;
      mv.style.color = l.rank === 1 ? t.accent : t.text;

      const sc = doc.createElement("span");
      sc.className = "sc";
      sc.textContent = l.score || "";
      sc.style.color = l.rank === 1 ? t.accent : t.dim;

      const meta = doc.createElement("span");
      meta.className = "meta";
      meta.textContent = l.engine || "";

      row.append(pill, mv, sc, meta);
      host.appendChild(row);
    }
  }

  _renderTb(doc, t, tbLines) {
    const card = doc.getElementById("c-tb");
    const host = doc.getElementById("d-tb");
    const tag = doc.getElementById("t-tb");
    if (!card || !host) return;
    const show = this.settings.get("ov.showTb");
    card.style.display = show && tbLines.length ? "block" : "none";
    if (!show || !tbLines.length) return;
    const best = tbLines[0];
    if (tag) {
      tag.textContent = best.category || "";
      tag.style.background = best.wdl > 0 ? "#166534" : best.wdl === 0 ? t.line : "#7f1d1d";
      tag.style.color = "#fff";
    }
    host.innerHTML = "";
    for (const l of tbLines.slice(0, 6)) {
      const row = doc.createElement("div");
      row.className = "row2";
      const left = doc.createElement("span");
      left.className = "mv";
      left.textContent = l.san || l.move;
      left.style.color = l.wdl > 0 ? "#4ade80" : l.wdl === 0 ? t.text : "#f87171";
      const right = doc.createElement("span");
      right.className = "meta";

      const dist = l.wdl === 0 ? ""
        : l.dtm ? `mate in ${Math.abs(l.dtm)}`
        : l.dtz ? `dtz ${Math.abs(l.dtz)}`
        : "";
      right.textContent = [l.category, dist].filter(Boolean).join("  ·  ");
      row.append(left, right);
      host.appendChild(row);
    }
  }

  _renderBook(doc, t, bookLines) {
    const card = doc.getElementById("c-book");
    const host = doc.getElementById("d-book");
    const tag = doc.getElementById("t-book");
    if (!card || !host) return;
    const show = this.settings.get("ov.showBook");
    card.style.display = show && bookLines.length ? "block" : "none";
    if (!show || !bookLines.length) return;
    if (tag) tag.textContent = bookLines[0].bookName || bookLines[0].source || "";
    host.innerHTML = "";
    for (const l of bookLines.slice(0, 6)) {
      const row = doc.createElement("div");
      row.className = "row2";
      const left = doc.createElement("span");
      left.className = "mv";
      left.textContent = l.san || l.move;
      const right = doc.createElement("span");
      right.className = "meta";
      const stats = l.whiteWins != null && l.blackWins != null
        ? `${l.whiteWins}/${l.draws ?? 0}/${l.blackWins}`
        : l.pct != null ? `${Math.round(l.pct)}%` : l.weight != null ? `w${l.weight}` : "";
      right.textContent = stats;
      row.append(left, right);
      host.appendChild(row);
    }
  }

  _renderCoach(doc, t) {
    const card = doc.getElementById("c-coach");
    const host = doc.getElementById("d-coach");
    const tag = doc.getElementById("t-coachmode");
    if (!card || !host) return;
    const showInStreamproof = this.settings.get("coach.modeInStreamproof");
    const coachEnabled = this.settings.get("coach.enabled");
    if (!showInStreamproof || !coachEnabled) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";
    if (card.style) card.style.background = t.panel;
    const modes = [];
    if (this.settings.get("coach.learningMode")) modes.push("Learning");
    if (this.settings.get("coach.supportiveMode")) modes.push("Supportive");
    if (tag) {
      tag.textContent = modes.length ? modes.join(" + ") : "Coach";
      tag.style.background = t.line;
      tag.style.color = t.text;
    }
    const rep = this._lastCoachReport;
    if (!rep) {
      host.textContent = "Coach is watching...";
      return;
    }
    const parts = [
      `<b style="color:${rep.color}">${this._esc(rep.icon)} ${this._esc(rep.label)}</b>` +
        (rep.san ? ` <span style="opacity:.85">${this._esc(rep.san)}</span>` : ""),
      rep.tip ? `<span style="opacity:.8;font-style:italic">${this._esc(rep.tip)}</span>` : "",
      rep.supportiveLine ? `<span style="opacity:.75">${this._esc(rep.supportiveLine)}</span>` : "",
      rep.learningLine ? `<span style="opacity:.75">${this._esc(rep.learningLine)}</span>` : "",
      rep.showBetter && rep.bestSan ? `<span style="opacity:.75">Better: <b>${this._esc(rep.bestSan)}</b></span>` : "",
    ].filter(Boolean);
    host.innerHTML = parts.join("<br>");
  }

  setCoachReport(rep) {
    this._lastCoachReport = rep || null;
    if (!this.isOpen) return;
    const doc = this.win.document;
    this._renderCoach(doc, this.theme);
  }

  setCoachLine(line) {
    this._lastCoachReport = { ...this._lastCoachReport, modeLine: line };
    if (!this.isOpen) return;
    const doc = this.win.document;
    this._renderCoach(doc, this.theme);
  }

  _sqToXY(square, sq, flipped) {
    const file = "abcdefgh".indexOf(square[0]);
    const rank = 8 - Number(square[1]);
    if (file < 0 || rank < 0) return null;
    const f = flipped ? 7 - file : file;
    const r = flipped ? 7 - rank : rank;
    return { x: (f + 0.5) * sq, y: (r + 0.5) * sq };
  }

  _isKnightMove(from, to) {
    const df = Math.abs("abcdefgh".indexOf(to[0]) - "abcdefgh".indexOf(from[0]));
    const dr = Math.abs(Number(to[1]) - Number(from[1]));
    return (df === 2 && dr === 1) || (df === 1 && dr === 2);
  }

  _knightCorner(from, to) {
    const ff = "abcdefgh".indexOf(from[0]);
    const tf = "abcdefgh".indexOf(to[0]);
    const fr = from[1];
    const tr = to[1];
    const df = Math.abs(tf - ff);
    const dr = Math.abs(Number(tr) - Number(fr));
    if (df > dr) return "abcdefgh"[tf] + fr;
    return from[0] + tr;
  }

  _arrow(ctx, p1, p2, color, width, label, sq, opts = {}) {
    const from = opts.from, to = opts.to;
    const knight = from && to && this._isKnightMove(from, to);
    const cornerSq = knight ? this._knightCorner(from, to) : null;
    const cp = cornerSq ? this._sqToXY(cornerSq, sq, opts.flipped) : null;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    let headUx = dx / len, headUy = dy / len;
    if (knight && cp) {
      const ldx = p2.x - cp.x, ldy = p2.y - cp.y;
      const lLen = Math.hypot(ldx, ldy);
      if (lLen > 0) { headUx = ldx / lLen; headUy = ldy / lLen; }
    }
    const headLen = Math.min(sq * 0.5, len * 0.4);
    const headW = headLen * 0.8;
    const bx = p2.x - headUx * headLen;
    const by = p2.y - headUy * headLen;
    const style = opts.style || "solid";
    ctx.save();
    ctx.globalAlpha = 0.9;

    let stroke = color;
    if (style === "gradient" || style === "plasma" || style === "comet") {
      const g = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      g.addColorStop(0, style === "comet" ? "rgba(255,255,255,0)" : color);
      g.addColorStop(0.55, color);
      g.addColorStop(1, style === "plasma" ? "#ffffff" : color);
      stroke = g;
    }
    if (style === "neon" || style === "plasma" || style === "laser") {
      ctx.shadowColor = color;
      ctx.shadowBlur = opts.glow ?? 14;
    }
    if (style === "laser") width = Math.max(2, width * 0.45);
    if (style === "comet") width = Math.max(2, width * 0.8);
    if (style === "thin") width = Math.max(2, width * 0.4);
    if (style === "dart") width = Math.max(3, width * 0.6);
    if (style === "blocky") width = Math.max(6, width * 1.3);
    if (style === "hollow") width = Math.max(2, width * 0.5);

    if (style === "curved" && !knight) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const perpX = -headUy * sq * 0.3;
      const perpY = headUx * sq * 0.3;
      ctx.strokeStyle = stroke; ctx.fillStyle = color;
      ctx.lineWidth = width; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(mx + perpX, my + perpY, bx, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(bx - headUy * headW / 2, by + headUx * headW / 2);
      ctx.lineTo(bx + headUy * headW / 2, by - headUx * headW / 2);
      ctx.closePath();
      ctx.fill();
      if (label) {
        const lx = p2.x + sq * 0.28, ly = p2.y - sq * 0.28;
        const fs = Math.round(sq * 0.32);
        ctx.font = `bold ${fs}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = color; ctx.fillText(label, lx, ly);
      }
      ctx.restore();
      return;
    }

    if (style === "chevron") {
      ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(3, width);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      if (knight && cp) ctx.lineTo(cp.x, cp.y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      const chevW = headW * 1.2;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(bx - headUx * headLen * 0.5 - headUy * chevW, by - headUy * headLen * 0.5 + headUx * chevW);
      ctx.moveTo(bx - headUx * headLen * 0.3, by - headUy * headLen * 0.3);
      ctx.lineTo(bx - headUx * headLen * 0.5 + headUy * chevW, by - headUy * headLen * 0.5 - headUx * chevW);
      ctx.stroke();
      if (label) {
        const lx = p2.x + sq * 0.28, ly = p2.y - sq * 0.28;
        const fs = Math.round(sq * 0.32);
        ctx.font = `bold ${fs}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = color; ctx.fillText(label, lx, ly);
      }
      ctx.restore();
      return;
    }

    ctx.strokeStyle = stroke;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "miter";
    ctx.miterLimit = 3;
    if (style === "outline") {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, width * 0.3);
    }
    const w2 = width / 2;
    const hw2 = headW / 2;
    let points = [];
    if (knight && cp) {
      const l1 = Math.hypot(cp.x - p1.x, cp.y - p1.y);
      const d1x = (cp.x - p1.x) / l1;
      const d1y = (cp.y - p1.y) / l1;
      const l2 = Math.hypot(p2.x - cp.x, p2.y - cp.y);
      const d2x = (p2.x - cp.x) / l2;
      const d2y = (p2.y - cp.y) / l2;
      const p1px = -d1y, p1py = d1x;
      const p2px = -d2y, p2py = d2x;
      const cross = Math.abs(d1x * d2y - d1y * d2x);
      const miterScale = cross > 0.001 ? w2 / cross : 0;
      const mx = (p1px + p2px) * miterScale;
      const my = (p1py + p2py) * miterScale;
      const p1l = { x: p1.x + p1px * w2, y: p1.y + p1py * w2 };
      const p1r = { x: p1.x - p1px * w2, y: p1.y - p1py * w2 };
      const cpl = { x: cp.x + mx, y: cp.y + my };
      const cpr = { x: cp.x - mx, y: cp.y - my };
      const bxl = { x: bx + p2px * hw2, y: by + p2py * hw2 };
      const bxr = { x: bx - p2px * hw2, y: by - p2py * hw2 };
      points = [p1l, cpl, bxl, p2, bxr, cpr, p1r];
    } else {
      const ux = dx / len, uy = dy / len;
      const px = -uy, py = ux;
      const p1l = { x: p1.x + px * w2, y: p1.y + py * w2 };
      const p1r = { x: p1.x - px * w2, y: p1.y - py * w2 };
      const bxl = { x: bx + px * hw2, y: by + py * hw2 };
      const bxr = { x: bx - px * hw2, y: by - py * hw2 };
      points = [p1l, bxl, p2, bxr, p1r];
    }

    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (style === "outline") {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, width * 0.3);
      ctx.stroke();
    } else if (style === "hollow") {
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, width * 0.5);
      ctx.stroke();
    } else {
      ctx.fill();
    }
    if (style === "laser") {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, width * 0.34);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      if (knight && cp) ctx.lineTo(cp.x, cp.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }
    if (label) {
      ctx.font = `bold ${Math.round(sq * 0.3)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,.85)";
      ctx.strokeText(label, p2.x + sq * 0.25, p2.y - sq * 0.25);
      ctx.fillText(label, p2.x + sq * 0.25, p2.y - sq * 0.25);
    }
    ctx.restore();
  }
}
