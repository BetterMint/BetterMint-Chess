import { ShadowHost } from "../core/ShadowHost.js";

export class BoardOverlay {
  constructor(settings) {
    this.settings = settings;
    this.shadow = new ShadowHost();
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;";
    this.shadow.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.boardEl = null;
    this.flipped = false;
    this.arrows = [];
    this.highlights = [];
    this.stealthDots = [];
    this.hbMarks = [];
    this._resizeObserver = null;
    this._repositionHandler = null;
    this._attached = false;
    this._raf = null;
    this._animating = false;
    this._phase = 0;
    this._hidden = false;
  }

  setHidden(hidden) {
    this._hidden = !!hidden;
    this.shadow.container.style.visibility = this._hidden ? "hidden" : "";
  }

  attach(boardEl, flipped = false) {
    this.detach();
    this.boardEl = boardEl;
    this.flipped = flipped;
    this.shadow.mount();
    this._reposition();
    this._resizeObserver = new ResizeObserver(() => this._reposition());
    this._resizeObserver.observe(boardEl);
    this._repositionHandler = () => this._reposition();
    window.addEventListener("scroll", this._repositionHandler, { capture: true, passive: true });
    window.addEventListener("resize", this._repositionHandler, { passive: true });
    this._attached = true;
  }

  setFlipped(f) {
    if (this.flipped !== f) {
      this.flipped = f;
      this.render();
    }
  }

  detach() {
    this._stopAnimation();
    this._resizeObserver?.disconnect();
    if (this._repositionHandler) {
      window.removeEventListener("scroll", this._repositionHandler, { capture: true });
      window.removeEventListener("resize", this._repositionHandler);
    }
    this.shadow.unmount();
    this.boardEl = null;
    this._attached = false;
  }

  _reposition() {
    if (!this.boardEl) return;
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width, r.height);
    this.shadow.setPosition({ left: r.left, top: r.top });
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = size + "px";
    this.canvas.style.height = size + "px";
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  squareRect(square) {
    if (!this.boardEl) return null;
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width, r.height);
    const sq = size / 8;
    const file = "abcdefgh".indexOf(square[0]);
    const rank = 8 - Number(square[1]);
    if (file < 0 || rank < 0) return null;
    const f = this.flipped ? 7 - file : file;
    const rr = this.flipped ? 7 - rank : rank;
    return { x: f * sq, y: rr * sq, w: sq, h: sq };
  }

  squareCenter(square) {
    const r = this.squareRect(square);
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  }

  clear() {
    this.arrows = [];
    this.highlights = [];
    this.stealthDots = [];
    this.hbMarks = [];
    this.render();
  }

  clearHandBrainMarks() {
    this.hbMarks = [];
    this.render();
  }

  addHandBrainMark(square) {
    if (!this.hbMarks.includes(square)) this.hbMarks.push(square);
    this.render();
  }

  clearArrows() {
    this.arrows = [];
    this.stealthDots = [];
    this.render();
  }

  addArrow(from, to, color, opts = {}) {
    const key = from + to;
    this.arrows = this.arrows.filter((a) => a.from + a.to !== key);
    this.arrows.push({ from, to, color, ...opts });
    this.render();
  }

  addHighlight(square, color, opts = {}) {
    this.highlights = this.highlights.filter((h) => h.square !== square);
    this.highlights.push({ square, color, ...opts });
    this.render();
  }

  clearHighlights() {
    if (!this.highlights.length) return;
    this.highlights = [];
    this.render();
  }

  addStealthDot(square, rank) {
    this.stealthDots = this.stealthDots.filter((d) => d.square !== square);
    this.stealthDots.push({ square, rank });
    this.render();
  }

  render() {
    this._drawFrame();
    this._syncAnimation();
  }

  _drawFrame() {
    if (!this.boardEl) return;
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width, r.height);
    this.ctx.clearRect(0, 0, size, size);
    const mode = this.settings.get("ov.mode");
    const stealthOnly = mode === "stealth";
    const showInternal = mode === "internal" || mode === "both" || mode === "stealth";
    if (this.settings.get("ui.highlights")) {
      for (const h of this.highlights) this._drawHighlight(h, size);
    }
    for (const sq of this.hbMarks) this._drawHandBrainMark(sq, size);
    if (stealthOnly) {
      for (const d of this.stealthDots) this._drawStealthDot(d, size);
    } else if (showInternal && this.settings.get("ui.arrows")) {
      const n = this.arrows.length;
      for (let i = 0; i < n; i++) {
        const a = this.arrows[i];
        const orig = a.color;
        a.color = this._resolveColor(a, i, n);
        this._drawArrow(a, size, i);
        a.color = orig;
      }
    }
  }

  _wantsAnimation() {
    return !!(this.settings.get("ui.arrowAnimate") && this.arrows.length && !this._hidden && this.boardEl);
  }

  _syncAnimation() {
    const wants = this._wantsAnimation();
    if (wants && !this._animating) this._startAnimation();
    else if (!wants && this._animating) this._stopAnimation();
  }

  _startAnimation() {
    this._animating = true;
    const tick = () => {
      this._raf = null;
      if (!this._animating) return;
      if (!this._wantsAnimation()) {
        this._stopAnimation();
        return;
      }
      this._phase = (this._phase + 0.035) % 1;
      this._drawFrame();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _stopAnimation() {
    this._animating = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _drawHandBrainMark(square, size) {
    const r = this.squareRect(square);
    if (!r) return;
    const ctx = this.ctx;
    const pulse = 0.55 + 0.25 * Math.sin(this._phase * Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = this.settings.get("ui.arrowAnimate") ? pulse : 0.7;
    ctx.strokeStyle = this.settings.get("ui.arrowColor1");
    ctx.lineWidth = Math.max(2.5, r.w * 0.07);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    const inset = r.w * 0.1;
    ctx.beginPath();
    ctx.roundRect?.(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2, r.w * 0.16);
    if (!ctx.roundRect) ctx.rect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2);
    ctx.stroke();
    ctx.restore();
  }

  _fade(color, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(color).replace("#", "#"));
    if (!m) return color;
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  _hexToRgb(color) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(color).replace("#", "#"));
    if (!m) return { r: 128, g: 128, b: 128 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  _lerpColor(c1, c2, t) {
    const a = this._hexToRgb(c1), b = this._hexToRgb(c2);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  _resolveColor(a, i, n) {
    const mode = this.settings.get("ui.arrowColorMode") || "rank";
    if (mode === "rank" || !mode) return a.color;
    if (mode === "single") return this.settings.get("ui.arrowCustomColor") || a.color;
    if (mode === "gradient") {
      const start = this.settings.get("ui.arrowGradientStart") || a.color;
      const end = this.settings.get("ui.arrowGradientEnd") || a.color;
      return n <= 1 ? start : this._lerpColor(start, end, i / (n - 1));
    }
    if (mode === "rainbow") {
      const hue = Math.round((i / (n || 1)) * 360);
      return `hsl(${hue}, 80%, 60%)`;
    }
    return a.color;
  }

  _drawHighlight(h) {
    const r = this.squareRect(h.square);
    if (!r) return;
    this.ctx.save();
    this.ctx.globalAlpha = h.alpha ?? 0.35;
    this.ctx.fillStyle = h.color;
    if (h.style === "ring") {
      this.ctx.strokeStyle = h.color;
      this.ctx.lineWidth = Math.max(2, r.w * 0.06);
      this.ctx.globalAlpha = 0.9;
      this.ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    } else {
      this.ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    this.ctx.restore();
  }

  _drawStealthDot(d, size) {
    const c = this.squareCenter(d.square);
    if (!c) return;
    const dotSize = this.settings.get("ov.stealthDotSize");
    const color = this.settings.get("ov.stealthDotColor");
    this.ctx.save();
    this.ctx.globalAlpha = 0.75;
    this.ctx.fillStyle = color;
    const offset = (d.rank - 1) * (dotSize * 1.6);
    this.ctx.beginPath();
    this.ctx.arc(c.x - size / 16 + offset / 2, c.y - size / 16, dotSize / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
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

  _drawArrow(a, size, i) {
    const p1 = this.squareCenter(a.from);
    const p2 = this.squareCenter(a.to);
    if (!p1 || !p2) return;
    const sq = size / 8;
    const opacity = this.settings.get("ui.arrowOpacity");
    let width = a.width ?? this.settings.get("ui.arrowWidth");
    const visual = this.settings.get("ui.arrowStyle") || "solid";
    const glow = Number(this.settings.get("ui.arrowGlow")) || 0;
    const anim = this.settings.get("ui.arrowAnimationType") || "pulse";
    const dashed = a.dashed || this.settings.get("ui.arrowDash") || anim === "flow";
    const knight = this._isKnightMove(a.from, a.to);
    const cornerSq = knight ? this._knightCorner(a.from, a.to) : null;
    const cp = cornerSq ? this.squareCenter(cornerSq) : null;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    let headUx = dx / len;
    let headUy = dy / len;
    if (knight && cp) {
      const ldx = p2.x - cp.x;
      const ldy = p2.y - cp.y;
      const lLen = Math.hypot(ldx, ldy);
      if (lLen > 0) { headUx = ldx / lLen; headUy = ldy / lLen; }
    }
    const headLen = Math.min(sq * 0.55, len * 0.4);
    const headW = headLen * 0.8;
    const bx = p2.x - headUx * headLen;
    const by = p2.y - headUy * headLen;
    this.ctx.save();
    let pulse = 1;
    if (this.settings.get("ui.arrowAnimate")) {
      if (anim === "pulse") pulse = 0.8 + 0.2 * Math.sin(this._phase * Math.PI * 2);
      if (anim === "breath") {
        const breath = 1 + 0.15 * Math.sin(this._phase * Math.PI * 2);
        width = Math.max(1, width * breath);
      }
      if (anim === "rainbow") this.ctx.filter = `hue-rotate(${this._phase * 360}deg)`;
    }
    this.ctx.globalAlpha = opacity * (a.alphaScale ?? 1) * pulse;

    let stroke = a.color;
    if (visual === "gradient" || visual === "plasma" || visual === "comet") {
      const g = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      if (visual === "comet") {
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, a.color);
        g.addColorStop(1, a.color);
      } else if (visual === "plasma") {
        const shift = this.settings.get("ui.arrowAnimate") ? this._phase : 0;
        g.addColorStop(Math.max(0, shift - 0.35), a.color);
        g.addColorStop(shift, "#ffffff");
        g.addColorStop(Math.min(1, shift + 0.35), a.color);
      } else {
        g.addColorStop(0, this._fade(a.color, 0.35));
        g.addColorStop(1, a.color);
      }
      stroke = g;
    }
    if (visual === "neon" || visual === "plasma" || visual === "laser") {
      this.ctx.shadowColor = a.color;
      this.ctx.shadowBlur = glow;
    }
    if (visual === "laser") width = Math.max(2, width * 0.5);
    if (visual === "outline") width = Math.max(1.5, width * 0.34);
    if (visual === "thin") width = Math.max(2, width * 0.4);
    if (visual === "dart") width = Math.max(3, width * 0.6);
    if (visual === "blocky") width = Math.max(6, width * 1.3);
    if (visual === "hollow") width = Math.max(2, width * 0.5);

    if (visual === "curved" && !knight) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const perpX = -headUy * sq * 0.3;
      const perpY = headUx * sq * 0.3;
      this.ctx.strokeStyle = stroke;
      this.ctx.fillStyle = a.color;
      this.ctx.lineWidth = width;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.quadraticCurveTo(mx + perpX, my + perpY, bx, by);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(p2.x, p2.y);
      this.ctx.lineTo(bx - headUy * headW / 2, by + headUx * headW / 2);
      this.ctx.lineTo(bx + headUy * headW / 2, by - headUx * headW / 2);
      this.ctx.closePath();
      this.ctx.fill();
      if (a.label && this.settings.get("ui.moveLabels")) {
        const lx = p2.x + sq * 0.28, ly = p2.y - sq * 0.28;
        const fs = Math.round(sq * 0.32);
        this.ctx.font = `bold ${fs}px system-ui, sans-serif`;
        this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        this.ctx.lineWidth = 4; this.ctx.strokeStyle = "rgba(0,0,0,0.85)";
        this.ctx.globalAlpha = 1;
        this.ctx.strokeText(a.label, lx, ly);
        this.ctx.fillStyle = a.color;
        this.ctx.fillText(a.label, lx, ly);
      }
      this.ctx.restore();
      return;
    }

    if (visual === "chevron") {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = Math.max(3, width);
      this.ctx.lineCap = "round"; this.ctx.lineJoin = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      if (knight && cp) this.ctx.lineTo(cp.x, cp.y);
      this.ctx.lineTo(bx, by);
      this.ctx.stroke();
      const chevW = headW * 1.2;
      this.ctx.beginPath();
      this.ctx.moveTo(p2.x, p2.y);
      this.ctx.lineTo(bx - headUx * headLen * 0.5 - headUy * chevW, by - headUy * headLen * 0.5 + headUx * chevW);
      this.ctx.moveTo(bx - headUx * headLen * 0.3, by - headUy * headLen * 0.3);
      this.ctx.lineTo(bx - headUx * headLen * 0.5 + headUy * chevW, by - headUy * headLen * 0.5 - headUx * chevW);
      this.ctx.stroke();
      if (a.label && this.settings.get("ui.moveLabels")) {
        const lx = p2.x + sq * 0.28, ly = p2.y - sq * 0.28;
        const fs = Math.round(sq * 0.32);
        this.ctx.font = `bold ${fs}px system-ui, sans-serif`;
        this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        this.ctx.lineWidth = 4; this.ctx.strokeStyle = "rgba(0,0,0,0.85)";
        this.ctx.globalAlpha = 1;
        this.ctx.strokeText(a.label, lx, ly);
        this.ctx.fillStyle = a.color;
        this.ctx.fillText(a.label, lx, ly);
      }
      this.ctx.restore();
      return;
    }

    this.ctx.strokeStyle = stroke;
    this.ctx.fillStyle = a.color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "miter";
    this.ctx.miterLimit = 3;
    if (dashed) {
      const offset = this.settings.get("ui.arrowAnimate") ? this._phase * sq * 0.39 : 0;
      this.ctx.setLineDash([sq * 0.25, sq * 0.14]);
      this.ctx.lineDashOffset = -offset;
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

    if (dashed) {
      const offset = this.settings.get("ui.arrowAnimate") ? this._phase * sq * 0.39 : 0;
      this.ctx.setLineDash([sq * 0.25, sq * 0.14]);
      this.ctx.lineDashOffset = -offset;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      if (knight && cp) this.ctx.lineTo(cp.x, cp.y);
      this.ctx.lineTo(bx, by);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.lineDashOffset = 0;
      this.ctx.beginPath();
      this.ctx.moveTo(p2.x, p2.y);
      this.ctx.lineTo(bx - headUy * headW / 2, by + headUx * headW / 2);
      this.ctx.lineTo(bx + headUy * headW / 2, by - headUx * headW / 2);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = stroke;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) this.ctx.lineTo(points[i].x, points[i].y);
      this.ctx.closePath();
      if (visual === "outline") {
        this.ctx.strokeStyle = a.color;
        this.ctx.lineWidth = Math.max(1.5, width * 0.34);
        this.ctx.stroke();
      } else if (visual === "hollow") {
        this.ctx.globalAlpha = 0.25;
        this.ctx.fill();
        this.ctx.globalAlpha = 0.9;
        this.ctx.strokeStyle = a.color;
        this.ctx.lineWidth = Math.max(1.5, width * 0.5);
        this.ctx.stroke();
      } else {
        this.ctx.fill();
      }
      if (visual === "laser") {
        this.ctx.save();
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = Math.max(1, width * 0.34);
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        if (knight && cp) this.ctx.lineTo(cp.x, cp.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }
    if (a.label && this.settings.get("ui.moveLabels")) {
      const lx = p2.x + sq * 0.28;
      const ly = p2.y - sq * 0.28;
      const fs = Math.round(sq * 0.32);
      this.ctx.font = `bold ${fs}px system-ui, sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = "rgba(0,0,0,0.85)";
      this.ctx.globalAlpha = 1;
      this.ctx.strokeText(a.label, lx, ly);
      this.ctx.fillStyle = a.color;
      this.ctx.fillText(a.label, lx, ly);
    }
    this.ctx.restore();
  }
}
