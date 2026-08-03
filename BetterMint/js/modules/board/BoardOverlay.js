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
      for (const a of this.arrows) this._drawArrow(a, size);
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

  _drawArrow(a, size) {
    const p1 = this.squareCenter(a.from);
    const p2 = this.squareCenter(a.to);
    if (!p1 || !p2) return;
    const sq = size / 8;
    const opacity = this.settings.get("ui.arrowOpacity");
    let width = a.width ?? this.settings.get("ui.arrowWidth");
    const visual = this.settings.get("ui.arrowStyle") || "solid";
    const glow = Number(this.settings.get("ui.arrowGlow")) || 0;
    const dashed = a.style === "book" || a.style === "tb" || this.settings.get("ui.arrowDash");
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const ux = dx / len;
    const uy = dy / len;
    const headLen = Math.min(sq * 0.55, len * 0.4);
    const headW = headLen * 0.8;
    const ex = p2.x - ux * headLen * 0.6;
    const ey = p2.y - uy * headLen * 0.6;
    this.ctx.save();
    this.ctx.globalAlpha = opacity * (a.alphaScale ?? 1);

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

    this.ctx.strokeStyle = stroke;
    this.ctx.fillStyle = a.color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = "round";
    if (dashed) {
      const offset = this.settings.get("ui.arrowAnimate") ? this._phase * sq * 0.39 : 0;
      this.ctx.setLineDash([sq * 0.25, sq * 0.14]);
      this.ctx.lineDashOffset = -offset;
    }
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(ex, ey);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.lineDashOffset = 0;
    if (visual === "laser") {
      this.ctx.save();
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = Math.max(1, width * 0.34);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(ex, ey);
      this.ctx.stroke();
      this.ctx.restore();
    }
    const bx = p2.x - ux * headLen;
    const by = p2.y - uy * headLen;
    this.ctx.beginPath();
    this.ctx.moveTo(p2.x, p2.y);
    this.ctx.lineTo(bx - uy * headW / 2, by + ux * headW / 2);
    this.ctx.lineTo(bx + uy * headW / 2, by - ux * headW / 2);
    this.ctx.closePath();
    this.ctx.fill();
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
