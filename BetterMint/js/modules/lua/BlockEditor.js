import { BLOCK_DEFS, BLOCK_CATEGORIES, blockDef } from "./BlockDefs.js";
import { createBlock, validateWorkspace } from "./BlockCompiler.js";

const EDITOR_CSS = `
.be-host{container-type:inline-size}
.be{display:flex;gap:14px;min-height:680px;font-family:inherit}
.be-left{width:220px;flex-shrink:0;display:flex;flex-direction:column;gap:0;border-radius:14px;border:1px solid var(--border,#3a3a4a);background:rgba(255,255,255,0.025);overflow:hidden}
.be-pal-head{padding:10px 12px 8px;border-bottom:1px solid var(--border,#3a3a4a);background:rgba(0,0,0,0.18)}
.be-pal-title{font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--text,#fff);margin-bottom:8px;display:flex;align-items:center;gap:7px}
.be-pal-title::before{content:"";width:8px;height:8px;border-radius:3px;background:linear-gradient(135deg,#f7b731,#4ade80);box-shadow:0 0 8px rgba(122,92,255,0.6)}
.be-search{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid var(--border,#3a3a4a);background:rgba(0,0,0,0.28);color:var(--text,#fff);font-size:12px;padding:6px 10px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
.be-search:focus{border-color:var(--primary,#7a5cff);box-shadow:0 0 0 3px rgba(122,92,255,0.18)}
.be-palette{overflow-y:auto;max-height:62vh;padding:8px 10px 12px;flex:1}
.be-palette::-webkit-scrollbar{width:5px}
.be-palette::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.14);border-radius:3px}
.be-cat{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin:12px 0 6px;color:var(--text-muted)}
.be-cat i{width:8px;height:8px;border-radius:50%;background:var(--cc);box-shadow:0 0 7px var(--cc);flex-shrink:0}
.be-pal-item{display:block;width:100%;box-sizing:border-box;text-align:left;margin-bottom:5px;padding:7px 10px 7px 12px;border-radius:9px;border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--cc);font-size:12px;font-weight:600;color:#fff;cursor:grab;user-select:none;touch-action:none;background:linear-gradient(135deg,color-mix(in srgb,var(--cc) 82%,transparent),color-mix(in srgb,var(--cc) 58%,transparent));box-shadow:0 2px 6px rgba(0,0,0,0.25);transition:transform .14s cubic-bezier(.34,1.4,.64,1),box-shadow .14s}
.be-pal-item:hover{transform:translateX(4px) scale(1.015);box-shadow:0 5px 14px color-mix(in srgb,var(--cc) 40%,transparent)}
.be-pal-item:active{cursor:grabbing;transform:scale(0.98)}
.be-pal-item.be-hidden{display:none}
.be-canvas-wrap{flex:1;min-width:340px;display:flex;flex-direction:column;gap:8px}
.be-toolbar{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;border:1px solid var(--border,#3a3a4a);background:rgba(255,255,255,0.03)}
.be-tbtn{border:1px solid var(--border,#3a3a4a);background:rgba(255,255,255,0.05);color:var(--text,#fff);border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .14s;line-height:1.3}
.be-tbtn:hover{background:rgba(255,255,255,0.12);transform:translateY(-1px)}
.be-tbtn:disabled{opacity:0.35;cursor:default;transform:none}
.be-tsep{width:1px;height:18px;background:var(--border,#3a3a4a);margin:0 3px}
.be-zoomlvl{font-size:11px;font-weight:700;color:var(--text-muted);min-width:38px;text-align:center;font-variant-numeric:tabular-nums}
.be-stats{margin-left:auto;font-size:11px;color:var(--text-muted);font-weight:600}
.be-canvas{position:relative;border-radius:14px;border:1px solid var(--border,#3a3a4a);background:#14141f;overflow:auto;height:600px;outline:none}
.be-canvas:focus{border-color:var(--primary,#7a5cff);box-shadow:0 0 0 3px rgba(122,92,255,0.15)}
.be-canvas-inner{position:relative;width:2600px;height:1800px;transform-origin:0 0;background-image:radial-gradient(rgba(255,255,255,0.055) 1px,transparent 1px);background-size:24px 24px}
.be-canvas-inner::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(1200px 500px at 30% 0%,rgba(122,92,255,0.05),transparent)}
.be-stack-root{position:absolute;display:flex;flex-direction:column;align-items:flex-start;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35))}
.be-stack-root > .be-block + .be-nextzone + .be-block{margin-top:-6px}
.be-block{position:relative;border-radius:10px;border:1px solid rgba(0,0,0,0.4);color:#fff;font-size:12px;font-weight:600;min-width:158px;max-width:360px;user-select:none;background:linear-gradient(160deg,var(--bc),color-mix(in srgb,var(--bc) 72%,#000 8%))}
.be-block.stmt::before,.be-block.cblock::before{content:"";position:absolute;left:16px;top:-1px;width:26px;height:6px;background:rgba(0,0,0,0.3);border-radius:0 0 6px 6px}
.be-block.stmt::after,.be-block.cblock::after{content:"";position:absolute;left:16px;bottom:-6px;width:26px;height:7px;background:var(--bc);border-radius:0 0 6px 6px;border:1px solid rgba(0,0,0,0.4);border-top:none;z-index:-1}
.be-block.hat{border-radius:24px 24px 10px 10px;padding-top:5px}
.be-block.hat::after{content:"";position:absolute;left:16px;bottom:-6px;width:26px;height:7px;background:var(--bc);border-radius:0 0 6px 6px;border:1px solid rgba(0,0,0,0.4);border-top:none;z-index:-1}
.be-block.value{border-radius:999px;display:inline-block;min-width:0;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.35)}
.be-block.sel{box-shadow:0 0 0 2.5px #fff,0 0 20px var(--bc)}
.be-snap{animation:beSnap .2s cubic-bezier(.34,1.56,.64,1)}
@keyframes beSnap{0%{transform:scale(1.07)}100%{transform:scale(1)}}
.be-head{display:flex;align-items:center;gap:6px;padding:7px 10px;cursor:grab;touch-action:none;flex-wrap:wrap}
.be-head:active{cursor:grabbing}
.be-block.value .be-head{padding:5px 11px}
.be-head .be-lbl{white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.3)}
.be-flbl{font-size:10px;font-weight:700;opacity:0.75;text-transform:uppercase;letter-spacing:0.4px}
.be-field{border-radius:999px;border:none;background:rgba(255,255,255,0.94);color:#1a1a2a;font-size:11px;font-weight:700;padding:3px 9px;max-width:104px;font-family:inherit;box-shadow:inset 0 1px 3px rgba(0,0,0,0.18)}
.be-field:focus{outline:2px solid rgba(255,255,255,0.65)}
.be-field[type=color]{padding:1px;width:26px;height:20px;border-radius:50%;background:rgba(255,255,255,0.2);cursor:pointer;box-shadow:none}
select.be-field{padding:3px 5px;cursor:pointer}
input[type=number].be-field{-moz-appearance:textfield;appearance:textfield}
input[type=number].be-field::-webkit-inner-spin-button{display:none}
.be-acts{margin-left:auto;display:flex;gap:3px;flex-shrink:0}
.be-mini{background:rgba(0,0,0,0.25);border:none;color:rgba(255,255,255,0.8);border-radius:6px;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .12s}
.be-mini:hover{background:rgba(255,255,255,0.28);color:#fff}
.be-mini.be-del:hover{background:rgba(244,67,54,0.75)}
.be-body{margin:2px 8px 8px 16px;padding:6px 6px 6px 8px;border-radius:8px;background:rgba(0,0,0,0.24);min-height:34px;min-width:150px;box-shadow:inset 0 2px 5px rgba(0,0,0,0.3);transition:box-shadow .15s}
.be-body:empty::after{content:"drop blocks here";font-size:10px;opacity:0.4;font-weight:500;font-style:italic}
.be-elselbl{margin:0 10px;padding:1px 8px;font-size:10px;font-weight:800;letter-spacing:1.2px;opacity:0.7;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,0.3)}
.be-nextzone{height:10px;min-width:158px;margin-top:-4px;opacity:0;border-radius:4px;transition:opacity .1s}
.be-nextzone.be-over{opacity:1;background:rgba(255,255,255,0.3);box-shadow:0 0 0 2px #fff,0 0 14px rgba(255,255,255,0.5);margin-top:2px;height:14px}
.be-body.be-over{box-shadow:inset 0 0 0 2px #fff,0 0 16px rgba(255,255,255,0.35)}
.be-slot.be-over{box-shadow:0 0 0 2px #fff,0 0 10px rgba(255,255,255,0.5)}
.be-slot{display:inline-flex;align-items:center;gap:4px;border-radius:999px;border:1.5px dashed rgba(255,255,255,0.5);background:rgba(0,0,0,0.25);padding:2px 5px;min-width:46px;transition:box-shadow .15s}
.be-slot .be-slot-lbl{font-size:9px;opacity:0.75;text-transform:uppercase;letter-spacing:0.5px;padding-left:5px;font-weight:800}
.be-slot input{border:none;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;width:76px;background:rgba(255,255,255,0.94);color:#1a1a2a;font-family:inherit;box-shadow:inset 0 1px 3px rgba(0,0,0,0.18)}
.be-slot input:focus{outline:2px solid rgba(255,255,255,0.65)}
.be-slot .be-block{margin:0}
.be-slot .be-del,.be-slot .be-acts{display:none}
.be-slot-x{background:rgba(0,0,0,0.3);border:none;color:#fff;border-radius:50%;width:15px;height:15px;font-size:9px;cursor:pointer;line-height:1;transition:background .12s}
.be-slot-x:hover{background:rgba(244,67,54,0.75)}
.be-preview{width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:0;border-radius:14px;border:1px solid var(--border,#3a3a4a);overflow:hidden;background:#15151f}
.be-pv-head{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border,#3a3a4a);background:rgba(0,0,0,0.25);font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-muted)}
.be-pv-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 7px #4ade80;animation:bePvPulse 2s infinite}
@keyframes bePvPulse{50%{opacity:0.5}}
.be-pv-count{margin-left:auto;font-weight:600;text-transform:none;letter-spacing:0}
.be-preview pre{flex:1;overflow:auto;padding:12px 14px;font-size:11.5px;line-height:1.6;color:#c9d1d9;margin:0;max-height:60vh;white-space:pre-wrap;word-break:break-word;font-family:"Cascadia Code","JetBrains Mono",Consolas,monospace}
.be-preview pre::-webkit-scrollbar{width:5px}
.be-preview pre::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.14);border-radius:3px}
.be-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:0.88;transform:scale(1.02) rotate(0.5deg);filter:drop-shadow(0 10px 20px rgba(0,0,0,0.5))}
.be-empty{position:absolute;inset:0;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;color:var(--text-muted);font-size:13.5px;pointer-events:none;text-align:center;padding:20px}
.be-empty .be-empty-icon{font-size:34px;opacity:0.5;filter:grayscale(0.3)}
.be-empty .be-empty-sub{font-size:11.5px;opacity:0.65;max-width:340px;line-height:1.6}
.be-canvas::-webkit-scrollbar,.be-palette::-webkit-scrollbar,.be-preview pre::-webkit-scrollbar{width:10px;height:10px}
.be-canvas::-webkit-scrollbar-track,.be-palette::-webkit-scrollbar-track{background:rgba(0,0,0,0.22)}
.be-canvas::-webkit-scrollbar-thumb,.be-palette::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.14);border-radius:6px;border:2px solid transparent;background-clip:padding-box}
.be-canvas::-webkit-scrollbar-thumb:hover,.be-palette::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.26);background-clip:padding-box}
.be-canvas::-webkit-scrollbar-corner{background:transparent}

@container (max-width:1040px){
  .be{flex-wrap:wrap}
  .be-left{width:100%;order:1;flex:none}
  .be-palette{max-height:236px}
  .be-pal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;padding:0 2px 4px}
  .be-pal-item{margin-bottom:0}
  .be-canvas-wrap{order:2;width:100%;flex:1 1 100%}
  .be-canvas{height:520px}
  .be-preview{order:3;width:100%}
  .be-preview pre{max-height:280px}
}
`;

export class BlockEditor {
  constructor(host, { workspace, onChange }) {
    this.host = host;
    this.ws = validateWorkspace(workspace || { blocks: {}, roots: [] });
    this.onChange = onChange || (() => {});
    this._drag = null;
    this._overEl = null;
    this._styleEl = null;
    this._sel = null;
    this._zoom = 1;
    this._searchQ = "";
    this._undoStack = [];
    this._redoStack = [];
    this._prevJson = JSON.stringify({ blocks: this.ws.blocks, roots: this.ws.roots });
  }

  mount() {
    this._styleEl = document.createElement("style");
    this._styleEl.textContent = EDITOR_CSS;
    document.head.appendChild(this._styleEl);
    this.host.innerHTML = "";
    this.host.classList.add("be-host");
    this._render();
  }

  destroy() {
    this._styleEl?.remove();
    this._endDrag();
  }

  _changed(snapId = null) {
    this._undoStack.push(this._prevJson);
    if (this._undoStack.length > 60) this._undoStack.shift();
    this._redoStack.length = 0;
    this._prevJson = JSON.stringify({ blocks: this.ws.blocks, roots: this.ws.roots });
    this._render();
    if (snapId) {
      const el = this._canvas?.querySelector(`.be-block[data-id="${snapId}"]`);
      if (el) el.classList.add("be-snap");
    }
    this.onChange(this.ws);
  }

  _applyJson(json) {
    try {
      const ws = validateWorkspace(JSON.parse(json));
      this.ws.blocks = ws.blocks;
      this.ws.roots = ws.roots;
      this._prevJson = JSON.stringify({ blocks: this.ws.blocks, roots: this.ws.roots });
      this._sel = null;
      this._render();
      this.onChange(this.ws);
    } catch {}
  }

  _undo() {
    if (!this._undoStack.length) return;
    this._redoStack.push(this._prevJson);
    this._applyJson(this._undoStack.pop());
  }

  _redo() {
    if (!this._redoStack.length) return;
    this._undoStack.push(this._prevJson);
    this._applyJson(this._redoStack.pop());
  }

  _select(id) {
    this._sel = id;
    this._canvas?.querySelectorAll(".be-block.sel").forEach((el) => el.classList.remove("sel"));
    if (id) this._canvas?.querySelector(`.be-block[data-id="${id}"]`)?.classList.add("sel");
  }

  _setZoom(z) {
    this._zoom = Math.min(1.5, Math.max(0.5, z));
    if (this._inner) this._inner.style.transform = `scale(${this._zoom})`;
    const lvl = this.host.querySelector(".be-zoomlvl");
    if (lvl) lvl.textContent = Math.round(this._zoom * 100) + "%";
  }

  _cleanUp() {
    if (!this.ws.roots.length) return;
    const heights = new Map();
    for (const id of this.ws.roots) {
      const el = this._canvas?.querySelector(`.be-block[data-id="${id}"]`)?.closest(".be-stack-root");
      heights.set(id, el ? el.getBoundingClientRect().height / this._zoom : 60);
    }
    let x = 24, y = 24, colBottom = 24;
    const sorted = [...this.ws.roots].sort((a, b) => (this.ws.blocks[a].y - this.ws.blocks[b].y) || (this.ws.blocks[a].x - this.ws.blocks[b].x));
    for (const id of sorted) {
      const blk = this.ws.blocks[id];
      const h = (heights.get(id) || 60) + 26;
      if (y + h > 1720) { x += 380; y = 24; }
      blk.x = x;
      blk.y = y;
      y += h;
      colBottom = Math.max(colBottom, y);
    }
    this._changed();
  }

  _render() {
    this.host.innerHTML = "";
    const root = document.createElement("div");
    root.className = "be";

    const left = document.createElement("div");
    left.className = "be-left";
    const palHead = document.createElement("div");
    palHead.className = "be-pal-head";
    palHead.innerHTML = `<div class="be-pal-title">Block library</div>`;
    const search = document.createElement("input");
    search.className = "be-search";
    search.placeholder = "Search blocks…";
    search.value = this._searchQ;
    search.addEventListener("input", () => {
      this._searchQ = search.value;
      this._filterPalette();
    });
    palHead.appendChild(search);
    left.appendChild(palHead);

    const palette = document.createElement("div");
    palette.className = "be-palette";
    for (const [catId, cat] of Object.entries(BLOCK_CATEGORIES)) {
      const h = document.createElement("div");
      h.className = "be-cat";
      h.dataset.cat = catId;
      h.innerHTML = `<i></i><span>${cat.label}</span>`;
      h.style.setProperty("--cc", cat.color);
      palette.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "be-pal-grid";
      grid.dataset.cat = catId;
      for (const [type, def] of Object.entries(BLOCK_DEFS)) {
        if (def.cat !== catId) continue;
        const b = document.createElement("button");
        b.className = "be-pal-item";
        b.style.setProperty("--cc", cat.color);
        b.textContent = this._paletteLabel(type, def);
        b.dataset.type = type;
        b.dataset.search = (def.label + " " + type).toLowerCase();
        b.addEventListener("pointerdown", (e) => this._startPaletteDrag(e, type));
        grid.appendChild(b);
      }
      palette.appendChild(grid);
    }
    left.appendChild(palette);
    this._palette = palette;

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "be-canvas-wrap";

    const toolbar = document.createElement("div");
    toolbar.className = "be-toolbar";
    const mkBtn = (label, title, fn, cls = "") => {
      const b = document.createElement("button");
      b.className = "be-tbtn" + (cls ? " " + cls : "");
      b.textContent = label;
      b.title = title;
      b.addEventListener("click", fn);
      return b;
    };
    toolbar.append(
      mkBtn("↩", "Undo (Ctrl+Z)", () => this._undo()),
      mkBtn("↪", "Redo (Ctrl+Shift+Z)", () => this._redo()),
      Object.assign(document.createElement("span"), { className: "be-tsep" }),
      mkBtn("⧉", "Duplicate selected (Ctrl+D)", () => this._sel && this._duplicateBlock(this._sel)),
      mkBtn("✦", "Clean up: neatly arrange all stacks", () => this._cleanUp()),
      Object.assign(document.createElement("span"), { className: "be-tsep" }),
      mkBtn("−", "Zoom out", () => this._setZoom(this._zoom - 0.1)),
    );
    const zoomLvl = document.createElement("span");
    zoomLvl.className = "be-zoomlvl";
    zoomLvl.textContent = "100%";
    toolbar.appendChild(zoomLvl);
    toolbar.append(
      mkBtn("+", "Zoom in", () => this._setZoom(this._zoom + 0.1)),
      mkBtn("1:1", "Reset zoom", () => this._setZoom(1)),
    );
    const stats = document.createElement("span");
    stats.className = "be-stats";
    stats.dataset.role = "be-stats";
    toolbar.appendChild(stats);
    canvasWrap.appendChild(toolbar);

    const canvas = document.createElement("div");
    canvas.className = "be-canvas";
    canvas.tabIndex = 0;
    canvas.dataset.dropzone = "canvas";
    canvas.addEventListener("keydown", (e) => this._onKey(e));
    canvas.addEventListener("pointerdown", (e) => {
      if (e.target === canvas || e.target.classList?.contains("be-canvas-inner")) this._select(null);
    });

    const inner = document.createElement("div");
    inner.className = "be-canvas-inner";
    inner.style.transform = `scale(${this._zoom})`;
    if (!this.ws.roots.length) {
      const empty = document.createElement("div");
      empty.className = "be-empty";
      empty.innerHTML = `<div class="be-empty-icon">🧩</div><div>Drag blocks from the library onto this canvas</div><div class="be-empty-sub">Start with a yellow <b>Events</b> block like “when a move is played”, then drop green <b>Actions</b> inside it. The Lua code on the right updates live and runs on every chess page.</div>`;
      inner.appendChild(empty);
    }
    for (const id of this.ws.roots) {
      const el = this._renderStack(id);
      if (el) inner.appendChild(el);
    }
    canvas.appendChild(inner);
    canvasWrap.appendChild(canvas);

    const preview = document.createElement("div");
    preview.className = "be-preview";
    const pvHead = document.createElement("div");
    pvHead.className = "be-pv-head";
    pvHead.innerHTML = `<span class="be-pv-dot"></span><span>Generated Lua</span><span class="be-pv-count"></span>`;
    preview.appendChild(pvHead);
    const pre = document.createElement("pre");
    pre.dataset.role = "be-code";
    preview.appendChild(pre);
    this._previewPre = pre;

    root.append(left, canvasWrap, preview);
    this.host.appendChild(root);
    this._canvas = canvas;
    this._inner = inner;
    this._filterPalette();
    this._updateStats();
    if (this._sel) {
      const selEl = this._canvas.querySelector(`.be-block[data-id="${this._sel}"]`);
      if (selEl) selEl.classList.add("sel"); else this._sel = null;
    }
  }

  _updateStats() {
    const el = this.host.querySelector("[data-role=be-stats]");
    if (!el) return;
    const n = Object.keys(this.ws.blocks).length;
    el.textContent = `${n} block${n === 1 ? "" : "s"}`;
  }

  _filterPalette() {
    if (!this._palette) return;
    const q = this._searchQ.trim().toLowerCase();
    for (const item of this._palette.querySelectorAll(".be-pal-item")) {
      item.classList.toggle("be-hidden", !!q && !item.dataset.search.includes(q));
    }
    for (const h of this._palette.querySelectorAll(".be-cat")) {
      const grid = this._palette.querySelector(`.be-pal-grid[data-cat="${h.dataset.cat}"]`);
      const any = !!grid && [...grid.querySelectorAll(".be-pal-item")].some((el) => !el.classList.contains("be-hidden"));
      h.style.display = q && !any ? "none" : "";
    }
  }

  _onKey(e) {
    if (e.target.closest("input,select,textarea")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); this._undo(); }
    else if ((mod && e.shiftKey && e.key.toLowerCase() === "z") || (mod && e.key.toLowerCase() === "y")) { e.preventDefault(); this._redo(); }
    else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); if (this._sel) this._duplicateBlock(this._sel); }
    else if ((e.key === "Delete" || e.key === "Backspace") && this._sel) { e.preventDefault(); this._deleteBlock(this._sel); }
  }

  setCode(text) {
    if (this._previewPre) this._previewPre.textContent = text;
    const count = this.host.querySelector(".be-pv-count");
    if (count) count.textContent = "live";
    this._updateStats();
  }

  _paletteLabel(type, def) {
    const parts = [def.label || type];
    for (const f of def.fields || []) if (f.label) parts.push(`[${f.label}]`);
    for (const i of def.inputs || []) parts.push(`(${i.label})`);
    if (def.kind === "cblock") parts.push("{ ... }");
    return parts.join(" ").trim();
  }

  _renderStack(id) {
    const blk = this.ws.blocks[id];
    if (!blk) return null;
    const stack = document.createElement("div");
    stack.className = "be-stack-root";
    stack.style.left = (blk.x || 24) + "px";
    stack.style.top = (blk.y || 24) + "px";
    let cur = id;
    let guard = 0;
    while (cur && guard++ < 500) {
      const curBlk = this.ws.blocks[cur];
      const el = this._renderBlock(cur);
      if (!el) break;
      stack.appendChild(el);
      if (blockDef(curBlk?.type)?.kind !== "hat") {
        const nz = document.createElement("div");
        nz.className = "be-nextzone";
        nz.dataset.dropzone = "next";
        nz.dataset.parent = cur;
        stack.appendChild(nz);
      }
      cur = curBlk?.next;
    }
    return stack;
  }

  _renderBlock(id) {
    const blk = this.ws.blocks[id];
    const def = blk && blockDef(blk.type);
    if (!def) return null;
    const cat = BLOCK_CATEGORIES[def.cat];
    const el = document.createElement("div");
    el.className = `be-block ${def.kind}` + (this._sel === id ? " sel" : "");
    el.dataset.id = id;
    el.style.setProperty("--bc", cat.color);

    const head = document.createElement("div");
    head.className = "be-head";
    head.addEventListener("pointerdown", (e) => this._startBlockDrag(e, id));
    if (def.label) {
      const lbl = document.createElement("span");
      lbl.className = "be-lbl";
      lbl.textContent = def.label;
      head.appendChild(lbl);
    }
    for (const f of def.fields || []) {
      head.appendChild(this._fieldEl(blk, f));
      if (f.label) {
        const s = document.createElement("span");
        s.className = "be-flbl";
        s.textContent = f.label;
        head.appendChild(s);
      }
    }
    for (const inp of def.inputs || []) head.appendChild(this._slotEl(blk, inp));

    const acts = document.createElement("span");
    acts.className = "be-acts";
    const dup = document.createElement("button");
    dup.className = "be-mini be-dup";
    dup.textContent = "⧉";
    dup.title = "Duplicate (Ctrl+D)";
    dup.addEventListener("pointerdown", (e) => e.stopPropagation());
    dup.addEventListener("click", (e) => { e.stopPropagation(); this._duplicateBlock(id); });
    const del = document.createElement("button");
    del.className = "be-mini be-del";
    del.textContent = "✕";
    del.title = "Delete (Del)";
    del.addEventListener("pointerdown", (e) => e.stopPropagation());
    del.addEventListener("click", (e) => { e.stopPropagation(); this._deleteBlock(id); });
    acts.append(dup, del);
    head.appendChild(acts);
    el.appendChild(head);

    if (def.kind === "cblock" || def.kind === "hat") {
      const body = document.createElement("div");
      body.className = "be-body";
      body.dataset.dropzone = "body";
      body.dataset.parent = id;
      for (const cid of blk.body || []) {
        body.appendChild(this._renderBlock(cid));
        if (blockDef(this.ws.blocks[cid]?.type)?.kind !== "hat") {
          const nz = document.createElement("div");
          nz.className = "be-nextzone";
          nz.dataset.dropzone = "next";
          nz.dataset.parent = cid;
          body.appendChild(nz);
        }
      }
      el.appendChild(body);
      if (def.hasElse) {
        const lbl = document.createElement("div");
        lbl.className = "be-elselbl";
        lbl.textContent = "else";
        el.appendChild(lbl);
        const ebody = document.createElement("div");
        ebody.className = "be-body";
        ebody.dataset.dropzone = "else";
        ebody.dataset.parent = id;
        for (const cid of blk.else || []) {
          ebody.appendChild(this._renderBlock(cid));
          if (blockDef(this.ws.blocks[cid]?.type)?.kind !== "hat") {
            const nz = document.createElement("div");
            nz.className = "be-nextzone";
            nz.dataset.dropzone = "next";
            nz.dataset.parent = cid;
            ebody.appendChild(nz);
          }
        }
        el.appendChild(ebody);
      }
    }
    return el;
  }

  _fieldEl(blk, f) {
    let inp;
    if (f.hint === "select") {
      inp = document.createElement("select");
      for (const o of f.options || []) {
        const opt = document.createElement("option");
        opt.value = o.v;
        opt.textContent = o.l;
        inp.appendChild(opt);
      }
      inp.value = String(blk.fields?.[f.name] ?? f.def);
    } else {
      inp = document.createElement("input");
      inp.type = f.hint === "number" ? "number" : f.hint === "color" ? "color" : "text";
      inp.value = blk.fields?.[f.name] ?? f.def ?? "";
      if (f.hint === "number") inp.step = "any";
    }
    inp.className = "be-field";
    if (f.label) inp.title = f.label;
    inp.addEventListener("pointerdown", (e) => e.stopPropagation());
    inp.addEventListener("change", () => {
      blk.fields[f.name] = f.hint === "number" ? Number(inp.value) : inp.value;
      this._changed();
    });
    return inp;
  }

  _slotEl(blk, spec) {
    const slot = document.createElement("span");
    slot.className = "be-slot";
    slot.dataset.dropzone = "slot";
    slot.dataset.parent = blk.id;
    slot.dataset.slot = spec.name;
    if (spec.label) {
      const l = document.createElement("span");
      l.className = "be-slot-lbl";
      l.textContent = spec.label;
      slot.appendChild(l);
    }
    const childId = blk.inputs?.[spec.name];
    const child = childId ? this.ws.blocks[childId] : null;
    const childDef = child && blockDef(child.type);
    if (child && childDef?.kind === "value") {
      slot.appendChild(this._renderBlock(child.id));
      const x = document.createElement("button");
      x.className = "be-slot-x";
      x.textContent = "✕";
      x.title = "Detach";
      x.addEventListener("pointerdown", (e) => e.stopPropagation());
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        delete blk.inputs[spec.name];
        child.x = (blk.x || 24) + 40;
        child.y = (blk.y || 24) + 60;
        this.ws.roots.push(child.id);
        this._changed();
      });
      slot.appendChild(x);
    } else {
      if (childId) delete blk.inputs[spec.name];
      const inp = document.createElement("input");
      inp.type = spec.hint === "number" ? "number" : "text";
      if (spec.hint === "number") inp.step = "any";
      inp.value = blk.fields?.[spec.name] ?? spec.def ?? "";
      inp.addEventListener("pointerdown", (e) => e.stopPropagation());
      inp.addEventListener("change", () => {
        blk.fields[spec.name] = inp.value;
        this._changed();
      });
      slot.appendChild(inp);
    }
    return slot;
  }

  _deleteBlock(id) {
    const blk = this.ws.blocks[id];
    if (!blk) return;
    const collected = [];
    const collect = (bid) => {
      const b = this.ws.blocks[bid];
      if (!b) return;
      collected.push(bid);
      for (const c of Object.values(b.inputs || {})) if (c) collect(c);
      for (const c of b.body || []) collect(c);
      for (const c of b.else || []) collect(c);
      if (b.next) collect(b.next);
    };
    collect(id);

    for (const b of Object.values(this.ws.blocks)) {
      if (collected.includes(b.id)) continue;
      if (b.next === id) b.next = null;
      for (const [k, v] of Object.entries(b.inputs || {})) if (v === id) delete b.inputs[k];
      if (b.body) b.body = b.body.filter((x) => x !== id);
      if (b.else) b.else = b.else.filter((x) => x !== id);
    }
    this.ws.roots = this.ws.roots.filter((x) => x !== id);
    for (const bid of collected) delete this.ws.blocks[bid];
    if (this._sel && collected.includes(this._sel)) this._sel = null;
    this._changed();
  }

  _detach(id) {
    const blk = this.ws.blocks[id];
    if (!blk) return false;
    for (const b of Object.values(this.ws.blocks)) {
      if (b.next === id) { b.next = null; return true; }
      for (const [k, v] of Object.entries(b.inputs || {})) {
        if (v === id) { delete b.inputs[k]; return true; }
      }
      if (b.body?.includes(id)) { b.body = b.body.filter((x) => x !== id); return true; }
      if (b.else?.includes(id)) { b.else = b.else.filter((x) => x !== id); return true; }
    }
    const ri = this.ws.roots.indexOf(id);
    if (ri >= 0) { this.ws.roots.splice(ri, 1); return true; }
    return false;
  }

  _startPaletteDrag(e, type) {
    if (e.button !== 0) return;
    e.preventDefault();
    const blk = createBlock(type);
    this._drag = { id: null, newBlock: blk, def: blockDef(type), startX: e.clientX, startY: e.clientY, moved: false };
    this._trackDrag(e);
  }

  _startBlockDrag(e, id) {
    if (e.button !== 0) return;
    if (e.target.closest("input,select,button")) return;
    e.preventDefault();
    this._select(id);
    const blk = this.ws.blocks[id];
    if (!blk) return;
    this._canvas?.focus({ preventScroll: true });
    this._drag = { id, startX: e.clientX, startY: e.clientY, wasRoot: this.ws.roots.includes(id), moved: false, def: blockDef(blk.type) };
    this._trackDrag(e);
  }

  _trackDrag(e) {
    const move = (ev) => this._dragMove(ev);
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this._dragEnd(ev);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this._dragMove(e);
  }

  _spawnGhost(type) {
    const def = blockDef(type);
    const cat = BLOCK_CATEGORIES[def.cat];
    const g = document.createElement("div");
    g.className = `be-block ${def.kind} be-ghost`;
    g.style.setProperty("--bc", cat.color);
    g.innerHTML = `<div class="be-head"><span class="be-lbl">${this._paletteLabel(type, def)}</span></div>`;
    document.body.appendChild(g);
    this._ghost = g;
  }

  _canvasPos(e) {
    const r = this._inner?.getBoundingClientRect();
    if (!r) return { x: 24, y: 24 };
    return {
      x: (e.clientX - r.left) / this._zoom,
      y: (e.clientY - r.top) / this._zoom,
    };
  }

  _dragMove(e) {
    const d = this._drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    if (!d.moved) {
      d.moved = true;
      if (d.newBlock) this._spawnGhost(d.newBlock.type);
      else if (!d.wasRoot) { d.detachedVisual = true; this._spawnGhost(this.ws.blocks[d.id].type); }
    }
    if (d.ghost) {
      d.ghost.style.left = e.clientX + 8 + "px";
      d.ghost.style.top = e.clientY + 8 + "px";
    }
    if (!d.ghost && d.id && d.wasRoot) {
      const blk = this.ws.blocks[d.id];
      const p = this._canvasPos(e);
      blk.x = Math.max(0, p.x - (d.grabDX ?? 20));
      blk.y = Math.max(0, p.y - (d.grabDY ?? 12));
      const el = this._inner?.querySelector(`.be-stack-root > .be-block[data-id="${d.id}"]`)?.closest(".be-stack-root");
      if (el) {
        el.style.left = blk.x + "px";
        el.style.top = blk.y + "px";
      }
    }
    const over = document.elementFromPoint(e.clientX, e.clientY);
    const zone = over?.closest?.("[data-dropzone]");
    if (this._overEl && this._overEl !== zone) this._overEl.classList.remove("be-over");
    if (zone && zone.dataset.dropzone !== "canvas") zone.classList.add("be-over");
    this._overEl = zone || null;
  }

  _dragEnd(e) {
    const d = this._drag;
    if (!d) return;
    this._overEl?.classList.remove("be-over");
    this._overEl = null;
    this._ghost?.remove();
    this._ghost = null;

    const over = document.elementFromPoint(e.clientX, e.clientY);
    const zone = over?.closest?.("[data-dropzone]");

    let blk;
    if (d.newBlock) {
      blk = d.newBlock;
      if (!d.moved) { this._drag = null; return; }
      this.ws.blocks[blk.id] = blk;
    } else {
      blk = this.ws.blocks[d.id];
      if (!blk) { this._drag = null; return; }
      if (!d.moved) { this._drag = null; return; }
      if (!d.wasRoot || (zone && zone.dataset.dropzone !== "canvas")) this._detach(d.id);
    }

    const selfIds = new Set([blk.id]);
    const collectDesc = (bid) => {
      const b = this.ws.blocks[bid];
      if (!b) return;
      for (const c of Object.values(b.inputs || {})) if (c) { selfIds.add(c); collectDesc(c); }
      for (const c of b.body || []) { selfIds.add(c); collectDesc(c); }
      for (const c of b.else || []) { selfIds.add(c); collectDesc(c); }
      if (b.next) { selfIds.add(b.next); collectDesc(b.next); }
    };
    collectDesc(blk.id);

    let placed = false;
    if (zone && this._canvas?.contains(zone)) {
      const kind = zone.dataset.dropzone;
      const parent = this.ws.blocks[zone.dataset.parent];
      if (parent && !selfIds.has(parent.id)) {
        if (kind === "next" && blockDef(parent.type)?.kind !== "hat") {
          const tail = this._tailOf(blk.id);
          this.ws.blocks[tail].next = parent.next;
          parent.next = blk.id;
          placed = true;
        } else if ((kind === "body" || kind === "else") && blockDef(blk.type)?.kind !== "hat") {
          parent[kind === "body" ? "body" : "else"].push(blk.id);
          placed = true;
        } else if (kind === "slot" && blockDef(blk.type)?.kind === "value") {
          parent.inputs[zone.dataset.slot] = blk.id;
          placed = true;
        }
      }
    }
    if (!placed) {
      if (d.newBlock || !d.wasRoot) {
        const p = this._canvasPos(e);
        blk.x = Math.max(4, p.x - 20);
        blk.y = Math.max(4, p.y - 12);
      }
      if (!this.ws.roots.includes(blk.id)) this.ws.roots.push(blk.id);
    }
    this._drag = null;
    this._changed(blk.id);
  }

  _duplicateBlock(id) {
    const src = this.ws.blocks[id];
    if (!src) return;
    const clone = (bid) => {
      const b = this.ws.blocks[bid];
      if (!b) return null;
      const nb = createBlock(b.type);
      nb.fields = JSON.parse(JSON.stringify(b.fields || {}));
      nb.inputs = {};
      for (const [k, v] of Object.entries(b.inputs || {})) {
        const c = v ? clone(v) : null;
        if (c) nb.inputs[k] = c;
      }
      if (b.body) nb.body = b.body.map(clone).filter(Boolean);
      if (b.else) nb.else = b.else.map(clone).filter(Boolean);
      nb.next = b.next ? clone(b.next) : null;
      this.ws.blocks[nb.id] = nb;
      return nb.id;
    };
    const newId = clone(id);
    if (!newId) return;
    const nb = this.ws.blocks[newId];

    let ax = (src.x || 24) + 36;
    let ay = (src.y || 24) + 36;
    if (!this.ws.roots.includes(id)) {
      for (const rid of this.ws.roots) {
        const seen = new Set();
        const contains = (bid) => {
          if (bid === id) return true;
          const b = this.ws.blocks[bid];
          if (!b || seen.has(bid)) return false;
          seen.add(bid);
          return Object.values(b.inputs || {}).some((v) => v && contains(v))
            || (b.body || []).some(contains)
            || (b.else || []).some(contains)
            || (b.next ? contains(b.next) : false);
        };
        if (contains(rid)) {
          const rb = this.ws.blocks[rid];
          ax = (rb.x || 24) + 44;
          ay = (rb.y || 24) + 44;
          break;
        }
      }
    }
    nb.x = ax;
    nb.y = ay;
    this.ws.roots.push(newId);
    this._sel = newId;
    this._changed(newId);
  }

  _tailOf(id) {
    let cur = id;
    let guard = 0;
    while (this.ws.blocks[cur]?.next && guard++ < 500) cur = this.ws.blocks[cur].next;
    return cur;
  }

  _endDrag() {
    this._ghost?.remove();
    this._ghost = null;
    this._drag = null;
  }
}
