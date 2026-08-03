export const CLASSES = {
  brilliant: { label: "Brilliant", icon: "!!", color: "#26c2a3", weight: 10 },
  great_find: { label: "Great Find", icon: "!", color: "#5b8baf", weight: 9 },
  best: { label: "Best", icon: "★", color: "#81b64c", weight: 8 },
  excellent: { label: "Excellent", icon: "✓", color: "#81b64c", weight: 7 },
  good: { label: "Good", icon: "✓", color: "#95b776", weight: 6 },
  book: { label: "Book", icon: "▤", color: "#a88865", weight: 5 },
  forced: { label: "Forced", icon: "=", color: "#8b8987", weight: 4 },
  inaccuracy: { label: "Inaccuracy", icon: "?!", color: "#f7c631", weight: 3 },
  mistake: { label: "Mistake", icon: "?", color: "#ffa459", weight: 2 },
  missed_win: { label: "Missed Win", icon: "??", color: "#ff7769", weight: 1 },
  blunder: { label: "Blunder", icon: "??", color: "#fa412d", weight: 0 },
};

const TIPS = {
  brilliant: [
    "A sacrifice that works. You gave up material and the position still favours you.",
    "Material down but winning — the tactics justify it.",
  ],
  great_find: [
    "Only move that holds. Anything else loses ground.",
    "Sharp find — the alternatives were clearly worse.",
  ],
  best: ["Engine's top choice.", "Nothing better exists here."],
  excellent: ["Practically the best move.", "Barely a hair off the top line."],
  good: ["Solid. Keeps your position healthy.", "Reasonable — a small concession only."],
  book: ["Known theory.", "Still following the opening book."],
  forced: ["No real choice here.", "Only legal continuation."],
  inaccuracy: [
    "Slightly loose. There was a cleaner option.",
    "Playable, but it hands over a little something.",
  ],
  mistake: [
    "This costs real ground. Look for the tactic you missed.",
    "A better move was available — check forcing lines first.",
  ],
  missed_win: [
    "You had a winning line and let it slip.",
    "The win was there — look for forcing moves before quiet ones.",
  ],
  blunder: [
    "Serious error. Check what your opponent threatens now.",
    "This loses material or the game. Always scan captures and checks.",
  ],
};

function pick(list, seed) {
  if (!list?.length) return "";
  return list[Math.abs(seed) % list.length];
}

// Accuracy is measured the way the big sites do it: convert the evaluation to
// a win percentage, see how much of it a move gave away, and score that drop.
// Counting grade labels instead made the number lurch every time a single move
// was classified, which is not what "game accuracy" means.
function winPercent(cp) {
  const c = Math.max(-1000, Math.min(1000, Number(cp) || 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

function moveAccuracy(wpBefore, wpAfter) {
  const drop = Math.max(0, wpBefore - wpAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export class Coach {
  constructor(app) {
    this.app = app;
    this.settings = app.settings;
    this._positions = new Map();
    this._lastReport = null;
    this._tally = {};
    this._oppTally = {};
    this._graded = new Set();
    this._accSamples = [];
    this._storeKey = null;
  }

  // ---- persistence -------------------------------------------------
  // A page refresh used to wipe the running accuracy. The grades already
  // earned are kept per game so a reload picks up exactly where it left off
  // instead of restarting the tally from zero.

  bindGame(key) {
    const next = key ? `bm.coach.${key}` : null;
    if (next === this._storeKey) return false;
    this._storeKey = next;
    this.reset();
    return this._load();
  }

  _load() {
    if (!this._storeKey) return false;
    let raw = null;
    try { raw = sessionStorage.getItem(this._storeKey); } catch { return false; }
    if (!raw) return false;
    try {
      const s = JSON.parse(raw);
      this._tally = s.tally && typeof s.tally === "object" ? s.tally : {};
      this._oppTally = s.oppTally && typeof s.oppTally === "object" ? s.oppTally : {};
      this._graded = new Set(Array.isArray(s.graded) ? s.graded : []);
      this._accSamples = Array.isArray(s.acc) ? s.acc.filter((n) => Number.isFinite(n)) : [];
      return this._graded.size > 0 || Object.keys(this._tally).length > 0;
    } catch {
      return false;
    }
  }

  _save() {
    if (!this._storeKey) return;
    try {
      sessionStorage.setItem(this._storeKey, JSON.stringify({
        tally: this._tally,
        oppTally: this._oppTally,
        graded: [...this._graded].slice(-400),
        acc: this._accSamples.slice(-400),
        at: Date.now(),
      }));
    } catch {}
  }

  get gradedCount() {
    return Object.values(this._tally).reduce((a, b) => a + b, 0);
  }

  get enabled() {
    return !!this.settings.get("coach.enabled");
  }

  reset() {
    this._positions.clear();
    this._lastReport = null;
    this._tally = {};
    this._oppTally = {};
    this._graded = new Set();
    this._accSamples = [];
  }

  // wipe both the live tally and anything remembered for this game
  resetGame() {
    this.reset();
    if (this._storeKey) {
      try { sessionStorage.removeItem(this._storeKey); } catch {}
    }
  }

  get lastReport() {
    return this._lastReport;
  }

  get tally() {
    return { ...this._tally };
  }

  get opponentTally() {
    return { ...(this._oppTally || {}) };
  }

  siteLabel(key) {
    if (this.app.hostKind !== "chesscom") return null;
    try {
      const t = window.chesscom_translations;
      const buckets = t ? Object.values(t) : [];
      for (const b of buckets) {
        if (b && typeof b === "object" && typeof b[key] === "string") return b[key];
      }
    } catch {}
    return null;
  }

  labelFor(cls) {
    const base = CLASSES[cls] || CLASSES.good;
    return this.siteLabel(`insights.${cls}`) || base.label;
  }

  notePosition(fen, { bestMove, evalCp, secondCp, legalCount, inBook } = {}) {
    if (!fen) return;
    const prev = this._positions.get(fen) || {};
    this._positions.set(fen, {
      bestMove: bestMove ?? prev.bestMove ?? null,
      evalCp: evalCp ?? prev.evalCp ?? null,
      secondCp: secondCp ?? prev.secondCp ?? null,
      legalCount: legalCount ?? prev.legalCount ?? null,
      inBook: inBook ?? prev.inBook ?? false,
    });
    if (this._positions.size > 400) {
      this._positions.delete(this._positions.keys().next().value);
    }
  }

  classify({ before, after, move, played, materialDelta }) {
    if (!before || before.evalCp == null || after == null) return null;

    const bestCp = before.evalCp;
    const playedCp = -after;
    const loss = bestCp - playedCp;

    if (before.legalCount === 1) return "forced";
    if (before.inBook) return "book";

    const isBest = move && before.bestMove && move === before.bestMove;

    if (isBest && materialDelta != null && materialDelta <= -200 && playedCp >= 50) {
      return "brilliant";
    }
    if (isBest && before.secondCp != null && bestCp - before.secondCp >= 200) {
      return "great_find";
    }
    if (isBest) return "best";

    if (bestCp >= 300 && playedCp < 100) return "missed_win";

    if (loss <= 10) return "excellent";
    if (loss <= 50) return "good";
    if (loss <= 100) return "inaccuracy";
    if (loss <= 250) return "mistake";
    return "blunder";
  }

  report({ fenBefore, fenAfter, move, san, evalAfter, materialDelta, isOurs = true }) {
    if (!this.enabled) return null;
    const before = this._positions.get(fenBefore);
    const cls = this.classify({ before, after: evalAfter, move, materialDelta });
    if (!cls) return null;

    const meta = CLASSES[cls];
    const seed = (move || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const bestSan = before?.bestMove ? this.app.uciToSan(before.bestMove) : null;
    const lossCp = before?.evalCp != null && evalAfter != null
      ? Math.max(0, Math.round(before.evalCp - -evalAfter))
      : null;

    const report = {
      cls,
      label: this.labelFor(cls),
      icon: meta.icon,
      color: meta.color,
      move,
      san: san || move,
      bestMove: before?.bestMove || null,
      bestSan,
      lossCp,
      tip: this.settings.get("coach.showTips") ? pick(TIPS[cls], seed) : "",
      showBetter: this.settings.get("coach.suggestBetter") && cls !== "best" && cls !== "brilliant" && !!bestSan,
      at: Date.now(),
    };

    // A refresh replays positions we may already have graded, so each move is
    // counted at most once per game.
    const stamp = `${(fenBefore || "").split(" ").slice(0, 2).join(" ")}|${move}`;
    const already = this._graded.has(stamp);
    if (!already) this._graded.add(stamp);

    // Only our own moves count toward our accuracy. Grading the opponent is
    // optional and must never pollute the player's score.
    report.isOurs = isOurs;
    report.counted = !already;

    // Score this single move on the win-percentage scale so the running
    // average is a real game accuracy rather than a label count.
    let sample = null;
    if (before?.evalCp != null && evalAfter != null) {
      sample = moveAccuracy(winPercent(before.evalCp), winPercent(-evalAfter));
      report.moveAccuracy = Math.round(sample * 10) / 10;
    }

    if (!already) {
      if (isOurs) {
        this._tally[cls] = (this._tally[cls] || 0) + 1;
        if (sample != null) this._accSamples.push(sample);
      } else {
        this._oppTally = this._oppTally || {};
        this._oppTally[cls] = (this._oppTally[cls] || 0) + 1;
      }
      this._save();
    }
    this._lastReport = report;
    this.app.events.emit("coach", report);
    return report;
  }

  _accuracyOf(tally) {
    const entries = Object.entries(tally || {});
    if (!entries.length) return null;
    let total = 0;
    let scored = 0;
    for (const [cls, n] of entries) {
      const w = CLASSES[cls]?.weight ?? 5;
      scored += w * n;
      total += 10 * n;
    }
    return total ? Math.round((scored / total) * 100) : null;
  }

  // Your accuracy across the whole game, from your moves only. This is the
  // mean of every move's win-percentage score, so one bad move moves it by
  // roughly 1/n instead of swinging the whole figure.
  accuracy() {
    const s = this._accSamples;
    if (s && s.length) {
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      return Math.round(mean);
    }
    // nothing sampled yet (no evals captured) - fall back to the label mix
    return this._accuracyOf(this._tally);
  }

  opponentAccuracy() {
    return this._accuracyOf(this._oppTally);
  }

  static BAD = new Set(["inaccuracy", "mistake", "missed_win", "blunder"]);

  voices() {
    try { return window.speechSynthesis?.getVoices?.() || []; } catch { return []; }
  }

  speak(report) {
    if (!report || !this.settings.get("coach.speak")) return;
    if (this.settings.get("coach.speakOnlyBad") && !Coach.BAD.has(report.cls)) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      let text = report.label;
      if (this.settings.get("coach.speakTips") && report.tip) text += `. ${report.tip}`;

      const u = new SpeechSynthesisUtterance(text);
      u.rate = Number(this.settings.get("coach.ttsRate")) || 1.05;
      u.pitch = Number(this.settings.get("coach.ttsPitch")) || 1;
      const vol = Number(this.settings.get("coach.ttsVolume"));
      u.volume = Number.isFinite(vol) ? vol : 0.85;

      const wanted = String(this.settings.get("coach.ttsVoice") || "").trim().toLowerCase();
      if (wanted) {
        const match = this.voices().find((v) => v.name.toLowerCase().includes(wanted));
        if (match) u.voice = match;
      }
      synth.cancel();
      synth.speak(u);
    } catch {}
  }

  testSpeak() {
    this.speak({ cls: "blunder", label: this.labelFor("blunder"), tip: TIPS.blunder[0] });
  }
}
