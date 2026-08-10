export const SkillPresets = {
  beginner:     { blunderChance: 0.18, rank2: 0.30, rank3: 0.15, meanMs: 2600, stdMs: 1400 },
  intermediate: { blunderChance: 0.08, rank2: 0.22, rank3: 0.08, meanMs: 3200, stdMs: 1800 },
  advanced:     { blunderChance: 0.03, rank2: 0.15, rank3: 0.04, meanMs: 3800, stdMs: 2000 },
  master:       { blunderChance: 0.01, rank2: 0.08, rank3: 0.02, meanMs: 4500, stdMs: 2400 },
  custom:       null,
};

export class Humanizer {
  constructor() {
    this.meanMs = 3000;
    this.stdMs = 1600;
    this.minMs = 400;
    this.maxMs = 15000;
    this.timePressureCutoffMs = 30000;
    this.timePressureFactor = 0.35;
    this.preset = "intermediate";
    this.blunderChance = 0.08;
    this.rank2Chance = 0.22;
    this.rank3Chance = 0.08;
    this.rankDecay = 0.4;
    this.rankPoolSize = 3;
    this.blunderCooldownMoves = 4;
    this._movesSinceBlunder = 999;
    this.enabled = true;
    this.stealthInput = true;
    this.openingInstantPlies = 10;
    this.evalSwingThreshold = 1.5;
    this._lastEval = null;
    this._stats = { movesPlayed: 0, blunders: 0, avgThinkMs: 0, _thinkSum: 0 };
  }

  applyPreset(name) {
    const p = SkillPresets[name];
    if (!p) return;
    this.preset = name;
    this.blunderChance = p.blunderChance;
    this.rank2Chance = p.rank2;
    this.rank3Chance = p.rank3;
    this.meanMs = p.meanMs;
    this.stdMs = p.stdMs;
  }

  computeThinkTime(ctx = {}) {
    if (!this.enabled) return 0;
    if (ctx.inBook || (ctx.ply != null && ctx.ply <= this.openingInstantPlies && ctx.ply % 2 === 0)) {
      return this._clamp(this._gauss(700, 350));
    }
    if (ctx.onlyMove) return this._clamp(this._gauss(900, 400));
    let t = this._gauss(this.meanMs, this.stdMs);
    if (ctx.evalCp != null && this._lastEval != null) {
      const swing = Math.abs(ctx.evalCp - this._lastEval) / 100;
      if (swing >= this.evalSwingThreshold) t *= 1.4 + Math.min(swing / 10, 0.6);
    }
    if (ctx.opponentJustBlundered) t *= 1.25;
    if (ctx.clockMs != null && ctx.clockMs < this.timePressureCutoffMs) {
      t *= this.timePressureFactor;
    }
    const result = this._clamp(t);
    this._stats._thinkSum += result;
    return result;
  }

  noteEval(evalCp) { this._lastEval = evalCp; }

  // Weight for every rank from 2 down to the bottom of the pool. Ranks 2 and 3
  // are set directly; anything deeper is the rank above it scaled by rankDecay,
  // which is what makes a pool of 5 or 10 lines behave sensibly instead of
  // stopping dead at 3.
  rankWeights(poolSize) {
    const count = Math.max(1, Math.floor(poolSize || this.rankPoolSize || 1));
    if (count < 2) return [];
    const r2 = Math.max(0, Number(this.rank2Chance) || 0);
    const r3 = Math.max(0, Number(this.rank3Chance) || 0);
    const decay = Math.max(0, Math.min(1, Number(this.rankDecay) ?? 0.4));
    const out = [];
    for (let rank = 2; rank <= count; rank++) {
      if (rank === 2) out.push(r2);
      else if (rank === 3) out.push(r3);
      else out.push(out[out.length - 1] * decay);
    }
    return out;
  }

  // The chance of actually playing the top move is whatever the mistakes do not
  // take, so it is derived rather than set. Exposing it means the number can be
  // shown in the UI instead of the user having to infer it.
  distribution(poolSize, { ignoreCooldown = true } = {}) {
    const canBlunder = ignoreCooldown || this._movesSinceBlunder >= this.blunderCooldownMoves;
    let blunder = canBlunder ? Math.max(0, Number(this.blunderChance) || 0) : 0;
    let weights = this.enabled ? this.rankWeights(poolSize) : [];
    if (!this.enabled) blunder = 0;
    const total = blunder + weights.reduce((a, b) => a + b, 0);
    if (total > 1) {
      const scale = 1 / total;
      blunder *= scale;
      weights = weights.map((w) => w * scale);
    }
    return {
      best: Math.max(0, 1 - blunder - weights.reduce((a, b) => a + b, 0)),
      ranks: weights,
      blunder,
    };
  }

  pickMove(rankedMoves, poolSize = null) {
    if (!rankedMoves || !rankedMoves.length) return null;
    if (!this.enabled || rankedMoves.length === 1) {
      return { move: rankedMoves[0].move, rankUsed: 1, wasBlunder: false };
    }
    const pool = Math.max(1, Math.min(Number(poolSize) || this.rankPoolSize || 3, rankedMoves.length));
    const roll = Math.random();
    const canBlunder = this._movesSinceBlunder >= this.blunderCooldownMoves;
    let blunderP = canBlunder ? this.blunderChance : 0;

    let weights = this.rankWeights(pool);
    const total = blunderP + weights.reduce((a, b) => a + b, 0);
    if (total > 1) {
      const scale = 1 / total;
      blunderP *= scale;
      weights = weights.map((w) => w * scale);
    }

    const worst = rankedMoves[rankedMoves.length - 1];
    if (roll < blunderP && rankedMoves.length >= 2) {
      this._movesSinceBlunder = 0;
      this._stats.blunders++;
      return { move: worst.move, rankUsed: worst.rank ?? rankedMoves.length, wasBlunder: true };
    }

    this._movesSinceBlunder++;
    let cum = blunderP;
    for (let i = 0; i < weights.length; i++) {
      cum += weights[i];
      const mv = rankedMoves[i + 1];
      if (roll < cum && mv) return { move: mv.move, rankUsed: mv.rank ?? i + 2, wasBlunder: false };
    }
    return { move: rankedMoves[0].move, rankUsed: rankedMoves[0].rank ?? 1, wasBlunder: false };
  }

  async executeMove(uci, boardApi) {
    if (!uci || uci.length < 4) return false;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    if (!this.stealthInput) {
      return boardApi.playMoveUci(uci);
    }
    const pFrom = boardApi.squareToPoint(from);
    const pTo = boardApi.squareToPoint(to);
    if (!pFrom || !pTo) {
      return boardApi.playMoveUci(uci);
    }
    try {
      await this._humanClickDrag(pFrom, pTo, boardApi.dispatch);
      return true;
    } catch (e) {
      console.warn("[Humanizer] stealth input failed, falling back:", e);
      return boardApi.playMoveUci(uci);
    }
  }

  async _humanClickDrag(pFrom, pTo, dispatch = null) {
    const jitter = (v, amt) => v + (Math.random() - 0.5) * amt;
    const from = { x: jitter(pFrom.x, 6), y: jitter(pFrom.y, 6) };
    const to = { x: jitter(pTo.x, 6), y: jitter(pTo.y, 6) };
    const send = (type, p) => this._dispatchMouse(type, p, dispatch);
    if (Math.random() < 0.4) {
      await send("pointerdown", from);
      await send("mousedown", from);
      await this._sleep(this._gauss(45, 15));
      await send("pointerup", from);
      await send("mouseup", from);
      await this._sleep(this._gauss(140, 60));
      await send("pointerdown", to);
      await send("mousedown", to);
      await this._sleep(this._gauss(40, 12));
      await send("pointerup", to);
      await send("mouseup", to);
    } else {
      await send("pointerdown", from);
      await send("mousedown", from);
      const path = this._bezierPath(from, to, 8 + Math.floor(Math.random() * 6));
      for (const p of path) {
        await send("pointermove", p);
        await send("mousemove", p);
        await this._sleep(this._gauss(12, 5));
      }
      await this._sleep(this._gauss(35, 12));
      await send("pointerup", to);
      await send("mouseup", to);
    }
  }

  async _dispatchMouse(type, p, dispatch = null) {
    const isUp = type.endsWith("up");
    const extra = type.startsWith("pointer")
      ? { buttons: isUp ? 0 : 1, pointerId: 1, pointerType: "mouse", isPrimary: true }
      : { buttons: isUp ? 0 : 1 };
    if (dispatch) return dispatch(type, p, extra);
    const el = document.elementFromPoint(p.x, p.y) || document.body;
    const opts = {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: p.x, clientY: p.y, screenX: p.x, screenY: p.y, button: 0, detail: 1, ...extra,
    };
    const evt = type.startsWith("pointer") ? new PointerEvent(type, opts) : new MouseEvent(type, opts);
    el.dispatchEvent(evt);
    if (type === "pointerup" || type === "pointercancel") {
      let n = el;
      let hops = 0;
      while (n && hops++ < 6) {
        try { if (n.hasPointerCapture?.(1)) n.releasePointerCapture(1); } catch {}
        n = n.parentElement;
      }
    }
  }

  _bezierPath(a, b, steps) {
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = (Math.random() - 0.5) * len * 0.25;
    const cx = midX - (dy / len) * off;
    const cy = midY + (dx / len) * off;
    const pts = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      pts.push({
        x: mt * mt * a.x + 2 * mt * t * cx + t * t * b.x,
        y: mt * mt * a.y + 2 * mt * t * cy + t * t * b.y,
      });
    }
    return pts;
  }

  _gauss(mean, std) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  _clamp(t) { return Math.max(this.minMs, Math.min(this.maxMs, Math.round(t))); }
  _sleep(ms) { return new Promise((r) => setTimeout(r, Math.max(1, ms))); }

  get stats() {
    return {
      ...this._stats,
      avgThinkMs: this._stats.movesPlayed ? Math.round(this._stats._thinkSum / this._stats.movesPlayed) : 0,
    };
  }

  noteMovePlayed() { this._stats.movesPlayed++; }
}
