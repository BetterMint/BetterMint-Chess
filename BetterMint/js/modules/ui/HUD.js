import { ShadowHost } from "../core/ShadowHost.js";
import { rankColor } from "./RankColors.js";
import { COACHES, findCoach } from "../features/CoachData.js";
import { RiveAvatar } from "./RiveAvatar.js";

const STAGE_META = {
  opening: { label: "OPENING", color: "#ff9800" },
  middlegame: { label: "MIDGAME", color: "#38bdf8" },
  endgame: { label: "ENDGAME", color: "#7a5cff" },
};

export const HUD_THEMES = {
  obsidian: { surface: "#1e1e2d", surface2: "#2a2a3a", surface3: "#33334a", line: "#3a3a4a", deep: "#15151f", accent: "#7a5cff", accent2: "#5d3fd3", accentSoft: "rgba(122,92,255,0.35)", text: "#ffffff", dim: "#8a8a9e", chip: "#c3b4ff" },
  neon: { surface: "#0a0f1e", surface2: "#101a30", surface3: "#16233f", line: "#1d2d4d", deep: "#050912", accent: "#22d3ee", accent2: "#0891b2", accentSoft: "rgba(34,211,238,0.35)", text: "#e2fbff", dim: "#6b8fa3", chip: "#9beef9" },
  mint: { surface: "#12211a", surface2: "#1a2f24", surface3: "#234032", line: "#264835", deep: "#0a1610", accent: "#4ade80", accent2: "#16a34a", accentSoft: "rgba(74,222,128,0.35)", text: "#ecfdf5", dim: "#7ba394", chip: "#a7f3d0" },
  aurora: { surface: "#161033", surface2: "#221a49", surface3: "#2e2560", line: "#332a63", deep: "#0d0922", accent: "#a78bfa", accent2: "#14b8a6", accentSoft: "rgba(167,139,250,0.35)", text: "#f5f3ff", dim: "#9a8fc4", chip: "#ddd6fe" },
  mono: { surface: "#1a1a1a", surface2: "#242424", surface3: "#2f2f2f", line: "#383838", deep: "#101010", accent: "#d4d4d4", accent2: "#737373", accentSoft: "rgba(212,212,212,0.3)", text: "#fafafa", dim: "#a3a3a3", chip: "#e5e5e5" },
  blood: { surface: "#1f1113", surface2: "#2d1719", surface3: "#3d1e21", line: "#4a2226", deep: "#140a0b", accent: "#f87171", accent2: "#b91c1c", accentSoft: "rgba(248,113,113,0.35)", text: "#fef2f2", dim: "#b08a8c", chip: "#fecaca" },
};

export const THEME_TOKENS = [
  { key: "surface", label: "Panel background" },
  { key: "surface2", label: "Raised surface" },
  { key: "surface3", label: "Hover surface" },
  { key: "deep", label: "Deep background" },
  { key: "line", label: "Borders and dividers" },
  { key: "accent", label: "Accent" },
  { key: "accent2", label: "Accent (deep)" },
  { key: "text", label: "Primary text" },
  { key: "dim", label: "Muted text" },
  { key: "chip", label: "Chip / pill text" },
  { key: "success", label: "Success" },
  { key: "warning", label: "Warning" },
  { key: "danger", label: "Danger" },
  { key: "info", label: "Info" },
];

const SEMANTIC_DEFAULTS = { success: "#4caf50", warning: "#ff9800", danger: "#f44336", info: "#38bdf8" };

export function customThemeKey(token) {
  return `ui.custom.${token}`;
}

export function resolveTheme(settings) {
  const name = settings.get("ui.theme") || "obsidian";
  const base = { ...SEMANTIC_DEFAULTS, ...(HUD_THEMES[name] || HUD_THEMES.obsidian) };
  if (name !== "custom") return base;

  const out = { ...base };
  for (const { key } of THEME_TOKENS) {
    const v = settings.get(customThemeKey(key));
    if (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim())) out[key] = v.trim();
  }

  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(out.accent || "");
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
    out.accentSoft = `rgba(${r},${g},${b},0.35)`;
  }
  return out;
}

const HUD_CSS = `
*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI Variable Text","SF Pro Text",-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.hud{position:fixed;width:280px;background:#1e1e2d;border:1px solid #3a3a4a;border-radius:12px;color:#fff;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,0.45);overflow:hidden;pointer-events:auto;user-select:none;animation:hudIn 0.35s cubic-bezier(0.4,0,0.2,1)}
@keyframes hudIn{from{opacity:0;transform:translateY(-10px) scale(0.98)}to{opacity:1;transform:none}}
.hud.pos-right{top:80px;right:16px}
.hud.pos-left{top:80px;left:16px}
.body{max-height:64vh;overflow-y:auto;overflow-x:hidden;transition:max-height 0.28s cubic-bezier(0.4,0,0.2,1),opacity 0.2s}
.hud.collapsed .body{max-height:0;opacity:0}
.hud.collapsed .actions{display:none}
.body::-webkit-scrollbar{width:6px}
.body::-webkit-scrollbar-track{background:transparent}
.body::-webkit-scrollbar-thumb{background:#5d3fd3;border-radius:3px}
.sec{padding:10px 12px;border-bottom:1px solid rgba(58,58,74,0.55)}
.sec:last-child{border-bottom:none}
.sec.hide{display:none}
.lbl{font-size:9px;font-weight:700;letter-spacing:1.2px;color:#8a8a9e;margin-bottom:7px;display:flex;align-items:center;gap:6px}
.lbl .dot{width:5px;height:5px;border-radius:50%;background:#7a5cff;box-shadow:0 0 6px rgba(122,92,255,0.8)}
.lbl.amber .dot{background:#ff9800;box-shadow:0 0 6px rgba(255,152,0,0.8)}
.hdr{display:flex;align-items:center;gap:8px;padding:11px 12px;background:linear-gradient(135deg,#5d3fd3,#4a30a8);box-shadow:0 2px 12px rgba(93,63,211,0.28)}
.mark{width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.25) inset}
.markfb{font-size:10px;font-weight:800;letter-spacing:-0.3px;text-shadow:0 1px 2px rgba(0,0,0,0.3)}
.marklogo{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35))}
.title{font-weight:600;font-size:14px;letter-spacing:0.2px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.25);flex:1}
.sync{width:6px;height:6px;border-radius:50%;background:#4caf50;opacity:0;transition:opacity 0.25s;flex-shrink:0}
.sync.on{opacity:1;animation:syncPulse 0.9s ease}
@keyframes syncPulse{0%{box-shadow:0 0 0 0 rgba(76,175,80,0.65)}70%{box-shadow:0 0 0 8px rgba(76,175,80,0)}100%{box-shadow:0 0 0 0 rgba(76,175,80,0)}}
.stage{font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:0.8px;background:rgba(0,0,0,0.25);border:1px solid transparent}
.vbadge{font-size:8px;font-weight:800;padding:3px 7px;border-radius:20px;letter-spacing:0.9px;background:rgba(255,255,255,0.18);color:#fff}
.vwarn{margin:8px 10px 0;padding:6px 9px;border-radius:8px;font-size:10px;font-weight:600;color:#fde68a;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.35)}
.acc{margin-left:auto;font-size:9px;font-weight:700;letter-spacing:0.4px;color:var(--dim);background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:20px}
.ccard{border-radius:8px;padding:7px 9px;background:color-mix(in srgb, var(--cc) 14%, transparent);border:1px solid color-mix(in srgb, var(--cc) 45%, transparent);animation:coachIn 0.28s cubic-bezier(0.34,1.56,0.64,1)}
@keyframes coachIn{from{opacity:0;transform:translateY(-4px) scale(0.98)}to{opacity:1;transform:none}}
.cavatar-row{display:flex;gap:6px;align-items:flex-start}
.cavatar-wrap{width:32px;height:32px;flex-shrink:0;border-radius:50%;overflow:hidden;position:relative;border:2px solid color-mix(in srgb, var(--cc) 60%, transparent);background:rgba(0,0,0,0.2)}
.cavatar-wrap.gold{border-color:gold}
.cavatar-wrap canvas,.cavatar-wrap img{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}
.cavatar{width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid color-mix(in srgb, var(--cc) 60%, transparent);background:rgba(0,0,0,0.2)}
.cavatar.celeb{border-color:gold}
.cbody{flex:1;min-width:0}
.cname-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.cbubble{margin-top:5px;padding:5px 8px;border-radius:9px 9px 9px 3px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);font-size:10px;line-height:1.45;color:var(--text);position:relative;word-wrap:break-word}
.cbubble:empty{display:none}
.cbubble .cursor{display:inline-block;width:2px;height:10px;background:var(--accent);margin-left:1px;animation:blink 0.7s steps(1) infinite;vertical-align:middle}
@keyframes blink{50%{opacity:0}}
.chead{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cicon{font-weight:800;font-size:11px;color:var(--cc);min-width:16px;text-align:center;line-height:1}
.cname{font-weight:700;font-size:11px;color:var(--cc);letter-spacing:0.2px}
.cmove{font-size:10px;font-weight:600;color:var(--text);background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px}
.closs{margin-left:auto;font-size:9px;font-weight:700;color:#ff8a80}
.cwho{font-size:8px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;padding:1px 5px;border-radius:20px;background:rgba(255,255,255,0.1);color:var(--dim)}
.cmodes{margin-top:5px;font-size:9.5px;line-height:1.45;color:var(--dim);font-style:italic}
.cmodes b{font-weight:700;color:var(--cc)}
.ctip{margin-top:5px;font-size:10px;line-height:1.45;color:var(--dim)}
.cbetter{margin-top:4px;font-size:10px;color:var(--dim)}
.cbetter b{color:var(--accent)}
.mini{display:none;align-items:center;gap:6px;margin-left:auto}
.hud.collapsed .mini{display:flex}
.mini .mev{font-size:11px;font-weight:800;color:#fff;background:rgba(0,0,0,0.28);padding:2px 7px;border-radius:6px;font-variant-numeric:tabular-nums}
.mini .mev.dim{opacity:0.55;font-weight:600}
.mini .mmv{font-size:11px;font-weight:700;color:#fff;background:rgba(255,255,255,0.18);padding:2px 7px;border-radius:6px}
.chev{cursor:pointer;color:rgba(255,255,255,0.75);font-size:11px;line-height:1;padding:2px;transition:transform 0.25s cubic-bezier(0.4,0,0.2,1),color 0.2s}
.chev:hover{color:#fff}
.hud.collapsed .chev{transform:rotate(-90deg)}
.grip{cursor:grab;color:rgba(255,255,255,0.5);font-size:13px;padding:0 2px;transition:color 0.2s}
.grip:hover{color:#fff}
.grip:active{cursor:grabbing}
.engines{display:flex;flex-wrap:wrap;gap:5px}
.eng{font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px;background:rgba(93,63,211,0.2);color:#c3b4ff;border:1px solid rgba(122,92,255,0.35);display:flex;align-items:center;gap:5px;transition:all 0.18s}
.eng.dead{background:rgba(244,67,54,0.13);color:#ff8a80;border-color:rgba(244,67,54,0.3)}
.eng .prio{font-size:8px;font-weight:800;background:rgba(255,255,255,0.14);padding:1px 4px;border-radius:5px}
.eng .think{width:4px;height:4px;border-radius:50%;background:#4caf50;box-shadow:0 0 6px rgba(76,175,80,0.9);animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:0.2}}
.eng-none{font-size:11px;color:#8a8a9e;font-style:italic}
.evalwrap{display:flex;align-items:center;gap:11px}
.evalnum{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-0.6px;min-width:64px;transition:color 0.25s}
.evalcol{flex:1;min-width:0}
.evalbar{height:8px;border-radius:20px;background:#2a2a2a;position:relative;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.55)}
.evalbar:after{content:'';position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.2)}
.evalfill{height:100%;border-radius:20px;transition:width 0.35s cubic-bezier(0.4,0,0.2,1),background 0.3s}
.depthrow{display:flex;align-items:center;gap:7px;margin-top:8px}
.dtxt{font-size:10px;color:#8a8a9e;font-variant-numeric:tabular-nums;white-space:nowrap}
.dbar{flex:1;height:3px;border-radius:2px;background:#15151f;overflow:hidden}
.dfill{display:block;height:100%;border-radius:2px;background:#7a5cff;box-shadow:0 0 6px rgba(122,92,255,0.6);transition:width 0.3s}
.row{display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:9px;margin-bottom:4px;background:#2a2a3a;border:1px solid transparent;transition:all 0.18s cubic-bezier(0.4,0,0.2,1)}
.row:last-child{margin-bottom:0}
.row:hover{background:#33334a;transform:translateX(2px)}
.row.picked{border-color:rgba(122,92,255,0.55);box-shadow:0 0 0 1px rgba(122,92,255,0.22),0 3px 12px rgba(93,63,211,0.22)}
.row.book{background:rgba(255,152,0,0.09);border-color:rgba(255,152,0,0.24);border-style:dashed;cursor:pointer}
.row.book:hover{background:rgba(255,152,0,0.17)}
.row.tb{background:rgba(122,92,255,0.1);border-color:rgba(122,92,255,0.28);border-style:dashed;cursor:pointer}
.row.tb:hover{background:rgba(122,92,255,0.19)}
.pill{font-size:9px;font-weight:800;min-width:21px;height:18px;padding:0 5px;border-radius:6px;color:#14141c;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.san{font-weight:600;font-size:13px;flex:1;letter-spacing:0.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.score{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
.who{font-size:9px;color:#8a8a9e;max-width:58px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stats{font-size:9px;color:#8a8a9e;font-variant-numeric:tabular-nums}
.pct{font-size:10px;font-weight:700;color:#ff9800}
.src{font-size:9px;opacity:0.55}
.wdl{font-size:8px;font-weight:800;padding:2px 6px;border-radius:5px;border:1px solid}
.empty{font-size:11px;color:#8a8a9e;font-style:italic}
.actions{display:flex;gap:6px;padding:10px 12px;background:rgba(0,0,0,0.2);border-top:1px solid #3a3a4a;flex-wrap:wrap}
.abtn{flex:1;min-width:58px;padding:7px 4px;font-size:11px;font-weight:600;border-radius:8px;border:1px solid #3a3a4a;background:#2a2a3a;color:#c9c9d6;cursor:pointer;font-family:inherit;transition:all 0.18s cubic-bezier(0.4,0,0.2,1)}
.abtn:hover{background:#33334a;color:#fff;transform:translateY(-1px)}
.abtn.active{background:linear-gradient(135deg,#5d3fd3,#4a30a8);border-color:#7a5cff;color:#fff;box-shadow:0 3px 12px rgba(93,63,211,0.4)}
.abtn.active:hover{box-shadow:0 5px 16px rgba(93,63,211,0.52)}
.hb{position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:11px 24px;background:#1e1e2d;border:1px solid rgba(122,92,255,0.5);border-radius:14px;color:#fff;box-shadow:0 8px 30px rgba(93,63,211,0.4);z-index:1}
.hb.bottom{top:auto;bottom:14px}
.hb-label{font-size:11px;letter-spacing:2px;color:#8a8a9e;font-weight:700}
.hb-piece{font-size:34px;line-height:1;color:#b9a8ff;text-shadow:0 0 20px rgba(122,92,255,0.8)}
.hb-name{font-size:16px;font-weight:800;letter-spacing:1px;background:linear-gradient(90deg,#7a5cff,#b9a8ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hb.pop{animation:hbpop 0.4s ease}
@keyframes hbpop{0%{transform:translateX(-50%) scale(0.8)}60%{transform:translateX(-50%) scale(1.06)}100%{transform:translateX(-50%) scale(1)}}

.abtn:active{transform:translateY(1px) scale(0.985)}
.abtn:focus-visible,.chev:focus-visible{outline:2px solid #7a5cff;outline-offset:2px}
.row:active{transform:translateX(1px) scale(0.997)}

.lbl{animation:fadeSlide 0.22s cubic-bezier(0.4,0,0.2,1)}
.row.book,.row.tb{animation:fadeSlide 0.22s cubic-bezier(0.4,0,0.2,1)}
@keyframes fadeSlide{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}

.body::-webkit-scrollbar{width:7px}
.body::-webkit-scrollbar-track{background:transparent}
.body::-webkit-scrollbar-thumb{border-radius:4px;background:rgba(255,255,255,0.14)}
.body::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.26)}

@media (prefers-reduced-motion: reduce){
  .hud,.ccard,.lbl,.row.book,.row.tb,.hb.pop{animation:none}
  *{transition-duration:0.01ms !important}
}
`;

export class HUD {
  constructor(settings) {
    this.settings = settings;
    this.shadow = new ShadowHost();
    this.shadow.setCSS(HUD_CSS + this.themeCss());
    this.root = null;
    this._refs = {};
    this._drag = null;
    this._position = null;
    this._mounted = false;
    this._syncTimer = null;
    this._data = {
      stage: null,
      engines: [],
      eval: { scoreCp: null, scoreMate: null, depth: null, maxDepth: null },
      bookLines: [],
      moves: [],
      pick: null,
      actions: [],
      matchedElo: null,
      variant: null,
    };
  }

  mount() {
    if (this._mounted) return;
    this.shadow.mount();
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="hdr">
        <span class="mark" data-r="mark"><span class="markfb">BM</span></span>
        <span class="title">BetterMint</span>
        <span class="sync" data-r="sync" title="settings synced"></span>
        <span class="vbadge" data-r="vbadge" style="display:none"></span>
        <span class="stage" data-r="stage">—</span>
        <span class="mini" data-r="mini"></span>
        <span class="chev" data-r="chev" title="Collapse">▼</span>
        <span class="grip" data-r="grip" title="Drag">⠿</span>
      </div>
      <div class="body" data-r="body">
        <div class="sec hide" data-r="secElo">
          <div class="lbl"><span class="dot"></span>ELO MATCH</div>
          <div data-r="elo"></div>
        </div>
        <div class="sec" data-r="secEngines">
          <div class="lbl"><span class="dot"></span>ENGINES</div>
          <div class="engines" data-r="engines"></div>
        </div>
        <div class="sec" data-r="secEval">
          <div class="lbl"><span class="dot"></span>EVALUATION</div>
          <div class="evalwrap">
            <div class="evalnum" data-r="evalnum">0.00</div>
            <div class="evalcol">
              <div class="evalbar" data-r="evalbar"><div class="evalfill" data-r="evalfill" style="width:50%"></div></div>
              <div class="depthrow" data-r="depthrow"><span class="dtxt" data-r="dtxt"></span><span class="dbar"><span class="dfill" data-r="dfill"></span></span></div>
            </div>
          </div>
        </div>
        <div class="sec hide" data-r="secCoach">
          <div class="lbl"><span class="dot"></span>COACH<span class="acc" data-r="acc"></span><span class="mode-label" data-r="modeLabel" style="display:none;font-size:10px;font-weight:600;margin-left:6px;opacity:.85"></span></div>
          <div class="coach" data-r="coach"></div>
        </div>
        <div class="sec hide" data-r="secBook"><div data-r="book"></div></div>
        <div class="sec" data-r="secMoves">
          <div class="lbl"><span class="dot"></span>ENGINE MOVES</div>
          <div data-r="moves"><span class="empty">waiting for engine…</span></div>
        </div>
      </div>
      <div class="actions" data-r="actions"></div>`;
    this.shadow.container.appendChild(this.root);
    for (const el of this.root.querySelectorAll("[data-r]")) this._refs[el.dataset.r] = el;
    this.shadow.setInteractive(true);
    this.shadow.host.style.pointerEvents = "none";
    this.root.style.pointerEvents = "auto";
    this._applyPosition();
    this._makeDraggable();
    this._refs.chev.addEventListener("click", () => this.root.classList.toggle("collapsed"));
    this.setVisible(this.settings.get("ui.hud"));
    this._mounted = true;
    if (this._logoUrl) this.setLogo(this._logoUrl);
    this.rerender();
  }

  rerender() {
    if (!this.root) return;
    this.applyTheme();
    this._renderStage();
    this._renderElo();
    this._renderEngines();
    this._renderEval();
    this._renderBook();
    this._renderCoach();
    this._renderMoves();
    this._renderActions();
  }

  setCoach(report, accuracy = null) {
    this._data.coach = report || null;
    this._data.accuracy = accuracy;
    this._renderCoach();
  }

  _renderCoach() {
    const sec = this._refs.secCoach;
    const box = this._refs.coach;
    if (!sec || !box) return;
    const rep = this._data.coach;
    const on = !!rep && this.settings.get("coach.enabled");
    sec.classList.toggle("hide", !on);
    if (!on) return;

    const acc = this._refs.acc;
    if (acc) {
      const showAcc = this.settings.get("coach.accuracy") && this._data.accuracy != null;
      acc.style.display = showAcc ? "inline-block" : "none";
      if (showAcc) acc.textContent = `${this._data.accuracy}% acc`;
    }

    const modeLabel = this._refs.modeLabel;
    if (modeLabel) {
      modeLabel.style.display = "none";
      modeLabel.textContent = "";
    }

    const showAvatar = this.settings.get("coach.showAvatar");
    const showBubble = this.settings.get("coach.speechBubble");
    const coachId = this.settings.get("coach.select");
    const coach = findCoach(coachId) || COACHES[0];

    box.innerHTML = "";
    const card = document.createElement("div");
    card.className = "ccard";
    card.style.setProperty("--cc", rep.color);

    if (showAvatar && coach?.iconUrl) {
      const row = document.createElement("div");
      row.className = "cavatar-row";

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "cavatar-wrap" + (coach.isCelebrity ? " gold" : "");

      if (coach.riveAnimationUrl) {
        const riveAvatar = new RiveAvatar(avatarWrap, {
          src: coach.riveAnimationUrl,
          fallbackUrl: coach.iconUrl,
          alt: coach.titledName || coach.name,
          fit: "contain",
          alignment: "center",
          autoplay: true,
        });
        if (this._riveAvatar) this._riveAvatar.destroy();
        this._riveAvatar = riveAvatar;
      } else {
        const img = document.createElement("img");
        img.src = coach.iconUrl;
        img.alt = coach.titledName || coach.name;
        img.onerror = () => { img.style.display = "none"; };
        avatarWrap.appendChild(img);
      }
      row.appendChild(avatarWrap);

      const body = document.createElement("div");
      body.className = "cbody";

      const nameRow = document.createElement("div");
      nameRow.className = "cname-row";
      const head = document.createElement("div");
      head.className = "chead";
      head.innerHTML = `<span class="cicon">${this._esc(rep.icon)}</span>`;
      const name = document.createElement("span");
      name.className = "cname";
      name.textContent = rep.label;
      const mv = document.createElement("span");
      mv.className = "cmove";
      mv.textContent = rep.san;
      head.append(name, mv);
      if (rep.isOurs === false) {
        const who = document.createElement("span");
        who.className = "cwho";
        who.textContent = "opponent";
        head.appendChild(who);
      }
      if (rep.lossCp > 0) {
        const loss = document.createElement("span");
        loss.className = "closs";
        loss.textContent = `-${(rep.lossCp / 100).toFixed(2)}`;
        head.appendChild(loss);
      }
      nameRow.appendChild(head);
      body.appendChild(nameRow);

      if (!showBubble && rep.tip) {
        const tip = document.createElement("div");
        tip.className = "ctip";
        tip.textContent = rep.tip;
        body.appendChild(tip);
      }
      if (rep.showBetter && rep.bestSan) {
        const better = document.createElement("div");
        better.className = "cbetter";
        better.innerHTML = `better: <b>${this._esc(rep.bestSan)}</b>`;
        body.appendChild(better);
      }

      const bubbleParts = [];
      if (rep.tip) bubbleParts.push(rep.tip);
      if (rep.supportiveLine) bubbleParts.push(rep.supportiveLine);
      if (rep.learningLine) bubbleParts.push(rep.learningLine);
      const bubbleText = bubbleParts.join("  •  ");
      if (showBubble && bubbleText) {
        const bubble = document.createElement("div");
        bubble.className = "cbubble";
        bubble.setAttribute("data-r", "cbubble");
        body.appendChild(bubble);
        this._typewriter(bubble, bubbleText);
      } else if (rep.modeLine) {
        const modes = document.createElement("div");
        modes.className = "cmodes";
        modes.textContent = rep.modeLine;
        body.appendChild(modes);
      }

      row.appendChild(body);
      card.appendChild(row);
    } else {
      const head = document.createElement("div");
      head.className = "chead";
      head.innerHTML = `<span class="cicon">${this._esc(rep.icon)}</span>`;
      const name = document.createElement("span");
      name.className = "cname";
      name.textContent = rep.label;
      const mv = document.createElement("span");
      mv.className = "cmove";
      mv.textContent = rep.san;
      head.append(name, mv);
      if (rep.isOurs === false) {
        const who = document.createElement("span");
        who.className = "cwho";
        who.textContent = "opponent";
        head.appendChild(who);
      }
      if (rep.lossCp > 0) {
        const loss = document.createElement("span");
        loss.className = "closs";
        loss.textContent = `-${(rep.lossCp / 100).toFixed(2)}`;
        head.appendChild(loss);
      }
      card.appendChild(head);

      if (!showBubble && rep.tip) {
        const tip = document.createElement("div");
        tip.className = "ctip";
        tip.textContent = rep.tip;
        card.appendChild(tip);
      }
      if (rep.showBetter && rep.bestSan) {
        const better = document.createElement("div");
        better.className = "cbetter";
        better.innerHTML = `better: <b>${this._esc(rep.bestSan)}</b>`;
        card.appendChild(better);
      }

      const bubbleParts2 = [];
      if (rep.tip) bubbleParts2.push(rep.tip);
      if (rep.supportiveLine) bubbleParts2.push(rep.supportiveLine);
      if (rep.learningLine) bubbleParts2.push(rep.learningLine);
      const bubbleText2 = bubbleParts2.join("  •  ");
      if (showBubble && bubbleText2) {
        const bubble = document.createElement("div");
        bubble.className = "cbubble";
        bubble.setAttribute("data-r", "cbubble");
        card.appendChild(bubble);
        this._typewriter(bubble, bubbleText2);
      } else if (rep.modeLine) {
        const modes = document.createElement("div");
        modes.className = "cmodes";
        modes.textContent = rep.modeLine;
        card.appendChild(modes);
      }
    }
    box.appendChild(card);
  }

  _typewriter(el, text) {
    if (!el || !text) return;
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    el.textContent = "";
    let i = 0;
    const cursor = document.createElement("span");
    cursor.className = "cursor";
    el.appendChild(cursor);
    this._typeTimer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(this._typeTimer);
        this._typeTimer = null;
        cursor.remove();
        return;
      }
      cursor.insertAdjacentText("beforebegin", text[i]);
      i++;
    }, 28);
  }

  setCoachTalking(value) {
    this._riveAvatar?.setTalk?.(!!value);
  }

  setLogo(url) {
    this._logoUrl = url || null;
    const mark = this._refs.mark;
    if (!mark || !this._logoUrl) return;
    mark.innerHTML = "";
    const img = document.createElement("img");
    img.src = this._logoUrl;
    img.alt = "";
    img.className = "marklogo";
    img.onerror = () => { mark.innerHTML = '<span class="markfb">BM</span>'; };
    mark.appendChild(img);
  }

  setVariant(name) {
    this._data.variant = name || null;
    this._renderVariant();
  }

  setVariantWarning(label) {
    const existing = this.shadow.container.querySelector(".vwarn");
    existing?.remove();
    if (!label || !this.root) return;
    const el = document.createElement("div");
    el.className = "vwarn";
    el.textContent = `${label}: connect Fairy-Stockfish for correct play`;
    this.root.querySelector(".body")?.prepend(el);
  }

  _renderVariant() {
    const el = this._refs.vbadge;
    if (!el) return;
    const name = this._data.variant;
    const show = name && name !== "chess" && this.settings.get("variant.hudBadge");
    el.style.display = show ? "inline-block" : "none";
    if (show) el.textContent = String(name).toUpperCase();
  }

  _renderElo() {
    const sec = this._refs.secElo;
    const host = this._refs.elo;
    if (!sec || !host) return;
    const info = this._data.matchedElo;
    const show = !!info && this.settings.get("elo.announce");
    sec.classList.toggle("hide", !show);
    if (!show) return;
    host.innerHTML = "";
    const chip = document.createElement("div");
    chip.className = "elochip";
    chip.innerHTML = `<span>opp ${this._esc(info.opponent ?? "?")}</span><span class="arrow">→</span><span>playing ${this._esc(info.target)}</span>`;
    host.appendChild(chip);
  }

  flashSync() {
    const el = this._refs.sync;
    if (!el) return;
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => el.classList.remove("on"), 950);
  }

  unmount() {
    this.shadow.unmount();
    this._mounted = false;
    this.root = null;
    this._refs = {};
  }

  setVisible(v) {
    if (this.root) this.root.style.display = v ? "block" : "none";
  }

  _applyPosition() {
    const pos = this.settings.get("ui.hudPosition");
    this.root.classList.remove("pos-right", "pos-left");
    if (pos === "float") {
      if (!this._position) {
        const rx = this.settings.get("ui.hudFloatX");
        const ry = this.settings.get("ui.hudFloatY");
        if (typeof rx === "number" && Number.isFinite(rx) && typeof ry === "number" && Number.isFinite(ry)) {
          this._position = { x: rx, y: ry };
        }
      }
      if (this._position) {
        this._position = this._clampToBounds(this._position);
        this.root.style.left = this._position.x + "px";
        this.root.style.top = this._position.y + "px";
        this.root.style.right = "auto";
      } else {
        this.root.classList.add("pos-right");
        this.root.style.left = "";
        this.root.style.top = "";
        this.root.style.right = "";
      }
    } else {
      this.root.classList.add("pos-" + (pos === "left" ? "left" : "right"));
      this.root.style.left = "";
      this.root.style.top = "";
      this.root.style.right = "";
    }
  }

  refreshPosition() {
    if (this.root) this._applyPosition();
  }

  _clampToBounds(pos) {
    const r = this.root.getBoundingClientRect();
    const w = r.width || 280;
    const h = r.height || 200;
    const margin = 8;
    const maxX = window.innerWidth - w - margin;
    const maxY = window.innerHeight - h - margin;
    return {
      x: Math.max(margin, Math.min(pos.x, maxX)),
      y: Math.max(margin, Math.min(pos.y, maxY)),
    };
  }

  _makeDraggable() {
    this._refs.grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const r = this.root.getBoundingClientRect();
      this.root.style.left = r.left + "px";
      this.root.style.top = r.top + "px";
      this.root.style.right = "auto";
      this.root.classList.remove("pos-right", "pos-left");
      this._drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      const move = (ev) => {
        if (!this._drag) return;
        this._position = this._clampToBounds({
          x: ev.clientX - this._drag.dx,
          y: ev.clientY - this._drag.dy,
        });
        this.root.style.left = this._position.x + "px";
        this.root.style.top = this._position.y + "px";
        this.root.style.right = "auto";
      };
      const up = () => {
        this._drag = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (this._position) {
          this.settings.set("ui.hudFloatX", Math.round(this._position.x));
          this.settings.set("ui.hudFloatY", Math.round(this._position.y));
          if (this.settings.get("ui.hudPosition") !== "float") this.settings.set("ui.hudPosition", "float");
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    this._refs.grip.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this._position = null;
      this.settings.set("ui.hudFloatX", null);
      this.settings.set("ui.hudFloatY", null);
      const r = this.root.getBoundingClientRect();
      this._position = this._clampToBounds({
        x: window.innerWidth - r.width - 20,
        y: 20,
      });
      this.root.style.left = this._position.x + "px";
      this.root.style.top = this._position.y + "px";
      this.root.style.right = "auto";
      this.settings.set("ui.hudFloatX", Math.round(this._position.x));
      this.settings.set("ui.hudFloatY", Math.round(this._position.y));
      if (this.settings.get("ui.hudPosition") !== "float") this.settings.set("ui.hudPosition", "float");
    });
  }

  setStage(stage) {
    this._data.stage = stage;
    this._renderStage();
  }

  _renderStage() {
    const el = this._refs.stage;
    if (!el) return;
    if (!this.settings.get("stage.showIndicator") || !this._data.stage) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    const meta = STAGE_META[this._data.stage] || STAGE_META.middlegame;
    el.textContent = meta.label;
    el.style.color = meta.color;
    el.style.borderColor = meta.color + "66";
  }

  setEngines(list) {
    this._data.engines = list || [];
    this._renderEngines();
  }

  _renderEngines() {
    const el = this._refs.engines;
    if (!el) return;
    const list = this._data.engines;
    if (!list.length) {
      el.innerHTML = `<span class="eng-none">no engines connected</span>`;
      return;
    }
    el.innerHTML = list.map((e) => `<span class="eng${e.alive ? "" : " dead"}" title="${this._esc(e.name)} · ${e.type}${e.alive ? "" : " · offline"}"><span class="prio">P${e.priority}</span>${this._esc(e.name)}${e.busy ? '<span class="think"></span>' : ""}</span>`).join("");
  }

  setEval(scoreCp, scoreMate, depth, maxDepth) {
    this._data.eval = { scoreCp, scoreMate, depth, maxDepth };
    this._renderEval();
    this._renderMini();
  }

  setFlipped(flipped) {
    this._flipped = !!flipped;
    this._renderEval();
  }

  _renderEval() {
    const sec = this._refs.secEval;
    if (!sec) return;
    if (!this.settings.get("ui.evalBar")) {
      sec.classList.add("hide");
      return;
    }
    sec.classList.remove("hide");
    const { scoreCp, scoreMate, depth, maxDepth } = this._data.eval;
    let pct = 50;
    let text = "0.00";
    let good = true;
    if (scoreMate != null) {
      good = scoreMate > 0;
      pct = good ? 100 : 0;
      text = "M" + Math.abs(scoreMate);
    } else if (scoreCp != null) {
      good = scoreCp >= 0;
      const pawns = scoreCp / 100;
      pct = 50 + 50 * (2 / (1 + Math.exp(-0.004 * scoreCp)) - 1);
      text = (pawns >= 0 ? "+" : "") + pawns.toFixed(2);
    }
    this._refs.evalfill.style.width = pct.toFixed(1) + "%";
    this._refs.evalfill.style.cssFloat = this._flipped ? "right" : "left";
    const flipped = this._flipped;
    const fillLight = "#e8e8e8";
    const fillDark = "#2a2a2a";
    if (good) {
      this._refs.evalfill.style.background = flipped ? fillDark : fillLight;
      this._refs.evalbar.style.background = flipped ? fillLight : fillDark;
    } else {
      this._refs.evalfill.style.background = flipped ? fillLight : fillDark;
      this._refs.evalbar.style.background = flipped ? fillDark : fillLight;
    }
    this._refs.evalnum.textContent = text;
    this._refs.evalnum.style.color = good ? "#4caf50" : "#ff6b6b";

    const showDepth = this.settings.get("ui.depthIndicator") && depth != null;
    this._refs.depthrow.style.display = showDepth ? "" : "none";
    if (showDepth) {
      const target = maxDepth || depth;
      this._refs.dtxt.textContent = `depth ${depth}${maxDepth ? " / " + maxDepth : ""}`;
      this._refs.dfill.style.width = Math.min(100, (depth / (target || 1)) * 100).toFixed(0) + "%";
    }
  }

  setBookLines(lines) {
    this._data.bookLines = lines || [];
    this._renderBook();
  }

  _renderBook() {
    const el = this._refs.book;
    const sec = this._refs.secBook;
    if (!el || !sec) return;
    const lines = this._data.bookLines;
    const showBook = this.settings.get("book.showLines");
    const showTb = this.settings.get("tb.showPanel");
    const bookLines = lines.filter((l) => !l.isTablebase);
    const tbLines = lines.filter((l) => l.isTablebase);
    const renderBook = showBook && bookLines.length;
    const renderTb = showTb && tbLines.length;
    if (!renderBook && !renderTb) {
      sec.classList.add("hide");
      el.innerHTML = "";
      return;
    }
    sec.classList.remove("hide");
    let html = "";
    if (renderBook) {
      html += `<div class="lbl amber"><span class="dot"></span>BOOK LINES</div>` + bookLines.map((l, i) => this._bookLineHtml(l, i)).join("");
    }
    if (renderTb) {
      html += `<div class="lbl" style="margin-top:${renderBook ? "9px" : "0"}"><span class="dot"></span>TABLEBASE</div>` + tbLines.map((l, i) => this._tbLineHtml(l, i)).join("");
    }
    el.innerHTML = html;
  }

  _bookLineHtml(l, i) {
    const stats = this.settings.get("book.showStats") && l.whiteWins != null
      ? `<span class="stats">${this._fmtNum(l.whiteWins)}/${this._fmtNum(l.draws)}/${this._fmtNum(l.blackWins)}</span>`
      : "";
    const pct = l.pct != null ? `<span class="pct">${l.pct}%</span>` : "";
    const src = l.source === "cloud" ? "☁" : l.source === "remote-book" ? "⚙" : "▤";

    const from = l.source === "cloud" ? "Lichess explorer" : l.bookName || (l.source === "remote-book" ? "EngineWS book" : "opening book");
    return `<div class="row book" data-move="${l.move}" title="${this._esc(from)}"><span class="pill" style="background:#ff9800">B${i + 1}</span><span class="san">${this._esc(l.san || l.move)}</span>${stats}${pct}<span class="src">${src}</span></div>`;
  }

  _tbLineHtml(l, i) {
    const wdl = l.wdl != null ? this._wdlBadge(l.wdl) : "";
    const dtz = l.dtz != null ? `<span class="pct" style="color:#b9a8ff">DTZ ${l.dtz}</span>` : l.dtm != null ? `<span class="pct" style="color:#b9a8ff">DTM ${l.dtm}</span>` : "";
    return `<div class="row tb" data-move="${l.move}"><span class="pill" style="background:#7a5cff;color:#fff">T${i + 1}</span><span class="san">${this._esc(l.san || l.move)}</span>${wdl}${dtz}</div>`;
  }

  _wdlBadge(wdl) {
    const map = { 2: ["WIN", "#4ade80"], 1: ["CWIN", "#a3e635"], 0: ["DRAW", "#8b949e"], [-1]: ["CLOSS", "#fb923c"], [-2]: ["LOSS", "#f87171"] };
    const [label, color] = map[wdl] || ["?", "#8b949e"];
    return `<span class="wdl" style="color:${color};border-color:${color}44;background:${color}15">${label}</span>`;
  }

  _fmtNum(n) {
    if (n == null) return "-";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  setMoves(rankedMoves, pickInfo = null) {
    this._data.moves = rankedMoves || [];
    this._data.pick = pickInfo;
    this._renderMoves();
  }

  _renderMoves() {
    const el = this._refs.moves;
    if (!el) return;
    const all = this._data.moves;
    if (!all.length) {
      el.innerHTML = `<span class="empty">waiting for engine…</span>`;
      this._renderMini();
      return;
    }
    const list = this.settings.get("engine.showAllMoves") ? all : all.slice(0, 1);
    const deepest = list.length ? list[list.length - 1].rank : 0;
    const pick = this._data.pick;
    el.innerHTML = "";
    for (const m of list) {
      const color = rankColor(this.settings, m.rank, deepest);
      const row = document.createElement("div");
      row.className = "row" + (pick && pick.move === m.move ? " picked" : "");
      row.title = m.pv?.length ? m.pv.slice(0, 8).join(" ") : "";
      row.innerHTML = `<span class="pill" style="background:${color}">#${m.rank}</span>`;
      const san = document.createElement("span");
      san.className = "san";
      san.textContent = m.san || m.move;
      const score = document.createElement("span");
      score.className = "score";
      score.style.color = color;
      score.textContent = m.displayScore;
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = m.engine;
      row.append(san, score, who);
      row.onclick = () => this.onMoveClick?.(m);
      el.appendChild(row);
    }
    this._renderMini();
  }

  _miniEvalText() {
    const ev = this._data.eval;
    if (!ev) return null;
    if (ev.scoreMate != null) return `M${Math.abs(ev.scoreMate)}`;
    if (ev.scoreCp == null) return null;
    const p = ev.scoreCp / 100;
    return (p > 0 ? "+" : "") + p.toFixed(2);
  }

  _renderMini() {
    const el = this._refs.mini;
    if (!el) return;
    el.innerHTML = "";
    const top = this._data.moves?.[0];
    const evText = this._miniEvalText();
    if (evText) {
      const s = document.createElement("span");
      s.className = "mev";
      s.textContent = evText;
      el.appendChild(s);
    }
    if (top) {
      const s = document.createElement("span");
      s.className = "mmv";
      s.textContent = top.san || top.move;
      el.appendChild(s);
    }
    if (!el.childNodes.length) {
      const s = document.createElement("span");
      s.className = "mev dim";
      s.textContent = "idle";
      el.appendChild(s);
    }
  }

  setActions(actions) {
    this._data.actions = actions || [];
    this._renderActions();
  }

  _renderActions() {
    const el = this._refs.actions;
    if (!el) return;
    el.innerHTML = "";
    for (const a of this._data.actions) {
      const btn = document.createElement("button");
      btn.className = "abtn" + (a.active ? " active" : "");
      btn.textContent = a.label;
      btn.title = a.title || "";
      btn.onclick = a.onClick;
      el.appendChild(btn);
    }
  }

  themeCss() {
    const t = resolveTheme(this.settings);
    const glass = this.settings.get("ui.glass");
    const glow = this.settings.get("ui.accentGlow");
    const compact = this.settings.get("ui.compactHud");
    const opacity = Number(this.settings.get("ui.hudOpacity"));
    return `
.hud{background:${glass ? this._alpha(t.surface, 0.82) : t.surface};border-color:${t.line};color:${t.text};opacity:${Number.isFinite(opacity) ? opacity : 1};
  ${glass ? "backdrop-filter:blur(18px) saturate(1.35);-webkit-backdrop-filter:blur(18px) saturate(1.35);" : ""}
  ${glow ? `box-shadow:0 10px 34px rgba(0,0,0,0.5),0 0 0 1px ${t.accentSoft},0 0 26px -6px ${t.accentSoft};` : "box-shadow:0 10px 30px rgba(0,0,0,0.45);"}}
.hdr{background:linear-gradient(135deg,${t.accent2},${t.surface2});${glow ? `box-shadow:0 2px 14px ${t.accentSoft};` : ""}}
.sec{border-bottom-color:${this._alpha(t.line, 0.6)};${compact ? "padding:7px 10px;" : ""}}
.lbl{color:${t.dim};${compact ? "font-size:8px;margin-bottom:5px;" : ""}}
.lbl .dot{background:${t.accent};box-shadow:0 0 6px ${t.accentSoft}}
.body::-webkit-scrollbar-thumb{background:${t.accent}}
.eng{background:${this._alpha(t.accent2, 0.22)};color:${t.chip};border-color:${t.accentSoft}}
.row{background:${t.surface2}}
.row:hover{background:${t.surface3}}
.row.picked{border-color:${t.accentSoft};box-shadow:0 0 0 1px ${t.accentSoft},0 3px 12px ${this._alpha(t.accent2, 0.25)}}
.evalbar,.dbar{background:${t.deep}}
.dfill{background:${t.accent};box-shadow:0 0 6px ${t.accentSoft}}
.dtxt,.eng-none{color:${t.dim}}
.stage{background:${this._alpha(t.deep, 0.55)}}
.elochip{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:${t.chip};background:${this._alpha(t.accent2, 0.2)};border:1px solid ${t.accentSoft};padding:3px 8px;border-radius:20px}
.elochip .arrow{color:${t.accent}}
.hb-count{font-size:9px;opacity:.75;letter-spacing:.06em}
${compact ? ".hud{width:250px;font-size:12px}.evalnum{font-size:19px}" : ""}
`;
  }

  _alpha(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex));
    if (!m) return hex;
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
    return `rgba(${r},${g},${b},${a})`;
  }

  applyTheme() {
    this.shadow.setCSS(HUD_CSS + this.themeCss());
  }

  setMatchedElo(info) {
    this._data.matchedElo = info || null;
    this.rerender();
  }

  showHandBrain(piece, glyph, meta = {}) {
    this.hideHandBrain();
    const el = document.createElement("div");
    const animate = this.settings.get("handbrain.animate") !== false;
    const bottom = this.settings.get("handbrain.bannerPosition") === "bottom";
    el.className = "hb" + (animate ? " pop" : "") + (bottom ? " bottom" : "");
    el.dataset.r = "hb";
    const count = Number(meta.count) || 0;
    const hint = count > 1 ? `<span class="hb-count">${count} available</span>` : "";
    const label = String(this.settings.get("handbrain.customLabel") || "MOVE THE");
    el.innerHTML = `<span class="hb-label">${this._esc(label)}</span><span class="hb-piece">${glyph}</span><span class="hb-name">${this._esc(piece).toUpperCase()}</span>${hint}`;
    this.shadow.container.appendChild(el);
    clearTimeout(this._hbHideTimer);
    const dur = Math.max(0, Number(this.settings.get("handbrain.bannerDurationMs")) || 0);
    if (dur > 0) this._hbHideTimer = setTimeout(() => this.hideHandBrain(), dur);
  }

  hideHandBrain() {
    clearTimeout(this._hbHideTimer);
    this.shadow.container.querySelector(".hb")?.remove();
  }

  _esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
}
