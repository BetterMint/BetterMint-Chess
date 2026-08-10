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

import { COACHES, findCoach } from "./CoachData.js";
import { getDefault } from "../settings/SettingsSchema.js";

export const COACH_VOICE_MAP = {
  David_coach:    { name: "David", candidates: ["Microsoft David", "Microsoft Mark", "Microsoft Guy", "David", "Alex", "Fred", "Tom"], locale: "en-US", rate: 1.0,  pitch: 1.0,  gender: "male" },
  Sloane_coach:   { name: "Samantha", candidates: ["Microsoft Zira", "Microsoft Aria", "Microsoft Jenny", "Samantha", "Allison", "Victoria", "Google US English"], locale: "en-US", rate: 1.05, pitch: 1.05, gender: "female" },
  Magnus_coach:   { name: "Google UK English Male", candidates: ["Microsoft Ryan", "Microsoft George", "Google UK English Male", "Daniel", "Oliver", "Arthur"], locale: "en-GB", rate: 0.92, pitch: 0.9,  gender: "male" },
  Levy_coach:     { name: "Alex", candidates: ["Microsoft Mark", "Microsoft Guy", "Alex", "Tom", "Fred"], locale: "en-US", rate: 1.12, pitch: 1.0,  gender: "male" },
  Calvin_coach:   { name: "Daniel", candidates: ["Microsoft Guy", "Microsoft Mark", "Daniel", "Alex", "Fred"], locale: "en-US", rate: 1.08, pitch: 1.08, gender: "male" },
  Anna_coach:     { name: "Victoria", candidates: ["Microsoft Zira", "Microsoft Jenny", "Victoria", "Allison", "Samantha", "Google US English"], locale: "en-US", rate: 1.02, pitch: 1.05, gender: "female" },
  Tania_coach:    { name: "Karen", candidates: ["Microsoft Heera", "Microsoft Zira", "Karen", "Moira", "Tessa", "Google UK English Female"], locale: "en-US", rate: 1.04, pitch: 1.0,  gender: "female" },
  Danny_coach:    { name: "Tom", candidates: ["Microsoft David", "Microsoft Mark", "Tom", "Fred", "Alex"], locale: "en-US", rate: 1.1,  pitch: 0.95, gender: "male" },
  Botez_coach:    { name: "Samantha", candidates: ["Microsoft Zira", "Microsoft Aria", "Samantha", "Allison", "Google US English"], locale: "en-US", rate: 1.06, pitch: 1.08, gender: "female" },
  Ben_coach:      { name: "Arthur", candidates: ["Microsoft Ryan", "Microsoft George", "Arthur", "Oliver", "Google UK English Male"], locale: "en-GB", rate: 0.92, pitch: 0.88, gender: "male" },
  Anand_coach:    { name: "Rishi", candidates: ["Microsoft Ravi", "Rishi", "Microsoft Prabhat", "Google UK English Male"], locale: "en-IN", rate: 0.95, pitch: 0.95, gender: "male" },
};

const CHESS_AUDIO_BASE = "https://text-and-audio.chess.com/prod/released";

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

const LEARNING_LINES = {
  threatWarning: [
    "Watch out — your opponent is building pressure on the kingside.",
    "Be careful, there's a tactical threat brewing. Look for checks and captures.",
    "Your opponent is aiming for a fork. Keep your knight alert.",
    "The enemy queen is eyeing your weak squares. Stay vigilant.",
    "There's a pin forming against your knight. Consider breaking it.",
    "Your opponent's bishop is getting active. Don't let it dominate the diagonal.",
    "Watch the center — your opponent is trying to seize control.",
    "There's a discovered attack potential. Be mindful of their piece placement.",
    "Your king is looking exposed. Consider castling or consolidating.",
    "Your opponent is setting up a battery. Be ready to sidestep.",
  ],
  positionalAdvice: [
    "Control the center before launching an attack.",
    "Develop your pieces with purpose — every tempo matters.",
    "Don't move the same piece twice in the opening.",
    "Look for weak pawns in their camp you can target.",
    "Trade pieces when you're ahead in material, keep them when behind.",
    "Rooks belong on open files. Find one and double up.",
    "Bishops are stronger in open positions. Keep the diagonal pair.",
    "A knight on the rim is dim — keep them central.",
    "Don't rush. Take time to assess threats before committing.",
    "Every move should answer: what does this do, and what does it stop?",
  ],
  oppMoveAlert: [
    "Your opponent just played a waiting move. They're setting a trap.",
    "That was a provocative move from your opponent. Don't take the bait.",
    "Your opponent sacrificed material — calculate carefully before accepting.",
    "That move weakens their pawn structure. Exploit it later.",
    "Your opponent is overextending. Stay solid and let them over-commit.",
  ],
};

const SUPPORTIVE_LINES = {
  encouragement: [
    "Great move! You're playing with confidence today.",
    "Stay focused — you've got this. Trust your calculation.",
    "Nice find! That's the kind of move that wins games.",
    "Don't worry about that last one. Reset and keep fighting.",
    "You're improving every game. Keep it up!",
    "That was a tough position but you handled it well.",
    "Believe in yourself. Your instincts are getting sharper.",
    "Every move is a chance to learn. You're doing great.",
    "Keep the pressure on — your opponent is feeling it.",
    "That's the spirit! Play your game, not theirs.",
  ],
  movePraise: {
    brilliant: ["Absolutely brilliant! That's a master-class sacrifice.", "What a move! You saw something special there."],
    great_find: ["Great find! Not many players would spot that.", "Excellent — that was the only move that kept the edge."],
    best: ["That's the engine's top choice. You're thinking like a computer!", "Perfect move. Right on the money."],
    excellent: ["Very strong play. You're in control here.", "Excellent choice — barely anything better."],
    good: ["Solid move. You're keeping your position healthy.", "Good instinct. No complaints from me."],
    book: ["Book move! You know your theory well.", "Right out of the textbook. Well prepared."],
  },
  moveConsolation: {
    inaccuracy: ["Small slip, but the position is still playable. Keep going.", "Not your best, but don't let it rattle you."],
    mistake: ["That stings, but we can still fight back. Stay focused.", "One mistake doesn't lose the game. Regroup."],
    missed_win: ["You missed a winning line, but there's more chances coming.", "So close! Keep looking for those tactics."],
    blunder: ["Tough break. But every champion bounces back. Let's go.", "That's a hard one to swallow. Shake it off and play on."],
  },
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

  notePosition(fen, { bestMove, evalCp, secondCp, legalCount, inBook, isTablebase } = {}) {
    if (!fen) return;
    const prev = this._positions.get(fen) || {};
    this._positions.set(fen, {
      bestMove: bestMove ?? prev.bestMove ?? null,
      evalCp: evalCp ?? prev.evalCp ?? null,
      secondCp: secondCp ?? prev.secondCp ?? null,
      legalCount: legalCount ?? prev.legalCount ?? null,
      inBook: inBook ?? prev.inBook ?? false,
      isTablebase: isTablebase ?? prev.isTablebase ?? false,
    });
    if (this._positions.size > 400) {
      this._positions.delete(this._positions.keys().next().value);
    }
  }

  classify({ before, after, move, played, materialDelta }) {
    if (!before || before.evalCp == null || after == null) return null;

    if (before.isTablebase) return null;
    if (before.inBook) return null;

    const bestCp = before.evalCp;
    const playedCp = -after;
    const loss = bestCp - playedCp;

    if (before.legalCount === 1) return "forced";

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

    const coach = this.getCoachData();
    const sign = coach?.name ? ` — ${coach.name}` : "";
    const modeParts = this._modeParts({ cls, isOpponent: !isOurs });
    const supportiveLine = modeParts.supportive.join(" ").trim() || "";
    const learningLine = modeParts.learning.join(" ").trim() || "";
    const modeLine = [supportiveLine, learningLine].filter(Boolean).join(" ");
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
      supportiveLine,
      learningLine,
      modeLine: modeLine ? modeLine + sign : "",
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
    report.alreadyGraded = already;

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

  _voiceCache = null;

  voices() {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return [];
      const list = synth.getVoices?.() || [];
      if (list.length) {
        this._voiceCache = list;
      } else if (!this._voiceCache && !this._voiceWarmHooked) {
        this._voiceWarmHooked = true;
        synth.addEventListener?.("voiceschanged", () => {
          try { this._voiceCache = synth.getVoices?.() || null; } catch {}
        }, { once: false });
      }
      return this._voiceCache || list;
    } catch { return this._voiceCache || []; }
  }

  getCoachData() {
    const id = this.settings.get("coach.select");
    return findCoach(id) || COACHES[0];
  }

  _bestVoice(voiceMap) {
    const voices = this.voices();
    if (!voices.length) return null;
    const byName = (needle) => voices.find((v) => v.name.toLowerCase().includes(String(needle).toLowerCase()));
    const override = String(this.settings.get("coach.ttsVoice") || "").trim();
    if (override) {
      const m = byName(override);
      if (m) return m;
    }
    for (const c of voiceMap.candidates || []) {
      const m = byName(c);
      if (m) return m;
    }
    if (voiceMap.name) {
      const m = byName(voiceMap.name);
      if (m) return m;
    }
    if (voiceMap.gender) {
      const g = voiceMap.gender.toLowerCase();
      const hints = g === "female"
        ? ["female", "zira", "aria", "jenny", "samantha", "victoria", "karen", "susan", "allison", "ava", "sonia", "libby", "heera"]
        : ["male", "david", "mark", "guy", "ryan", "george", "james", "ravi", "alex", "daniel", "tom", "fred", "arthur", "rishi", "oliver"];
      for (const h of hints) {
        const m = byName(h);
        if (m) return m;
      }
    }
    if (voiceMap.locale) {
      const sameLocale = voices.filter((v) => (v.lang || "").toLowerCase().startsWith(voiceMap.locale.toLowerCase()));
      if (sameLocale.length) return sameLocale[0];
    }
    return voices.find((v) => (v.lang || "").startsWith("en")) || voices[0];
  }

  _audioCache = new Map();
  _audioEl = null;

  async _playChessAudio(hash) {
    if (!hash) return false;
    const coach = this.getCoachData();
    const voiceId = coach?.voiceId;
    const locale = coach?.locale || "en-US";
    if (!voiceId) return false;
    const url = `${CHESS_AUDIO_BASE}/${voiceId}/${locale}/${hash}.mp3`;
    if (this._audioCache.has(url)) {
      this._audioCache.get(url).play();
      return true;
    }
    try {
      const resp = await fetch(url, { method: "HEAD" });
      if (!resp.ok) return false;
      const audio = new Audio(url);
      audio.volume = Number.isFinite(Number(this.settings.get("coach.ttsVolume")))
        ? Number(this.settings.get("coach.ttsVolume")) : 0.85;
      this._audioCache.set(url, audio);
      this._audioEl = audio;
      audio.onplay = () => { this.app.hud?.setCoachTalking?.(true); };
      audio.onended = () => { this.app.hud?.setCoachTalking?.(false); this._audioEl = null; };
      audio.onerror = () => { this.app.hud?.setCoachTalking?.(false); this._audioEl = null; };
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  _utter(text, voiceMap, volume = 0.85) {
    const synth = window.speechSynthesis;
    if (!synth || !text) return null;
    const u = new SpeechSynthesisUtterance(text);
    const v = this._bestVoice(voiceMap);
    if (v) u.voice = v;
    const rateVal = Number(this.settings.get("coach.ttsRate"));
    const pitchVal = Number(this.settings.get("coach.ttsPitch"));
    u.rate = Number.isFinite(rateVal) && rateVal !== Number(getDefault("coach.ttsRate"))
      ? rateVal
      : (voiceMap.rate || (Number.isFinite(rateVal) ? rateVal : 1.05));
    u.pitch = Number.isFinite(pitchVal) && pitchVal !== Number(getDefault("coach.ttsPitch"))
      ? pitchVal
      : (voiceMap.pitch || (Number.isFinite(pitchVal) ? pitchVal : 1));
    u.volume = Number.isFinite(Number(this.settings.get("coach.ttsVolume"))) ? Number(this.settings.get("coach.ttsVolume")) : volume;
    return u;
  }

  speak(report) {
    if (!report || !this.settings.get("coach.speak")) return;
    if (this.settings.get("coach.speakOnlyBad") && !Coach.BAD.has(report.cls)) return;
    try {
      const coach = this.getCoachData();
      const voiceMap = COACH_VOICE_MAP[coach.voiceId] || {};

      this._lastModeLine = report.modeLine || null;

      if (report.audioUrlHash) {
        this._playChessAudio(report.audioUrlHash).then((ok) => { if (ok) return; this._speakFallback(report, coach, voiceMap); });
        return;
      }
      this._speakFallback(report, coach, voiceMap);
    } catch {}
  }

  _speakFallback(report, coach, voiceMap) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;

      const parts = [];
      if (this.settings.get("coach.speakTips") && report.tip) parts.push(report.tip);
      if (this.settings.get("coach.supportiveMode") && report.supportiveLine) parts.push(report.supportiveLine);
      if (this.settings.get("coach.learningMode") && report.learningLine) parts.push(report.learningLine);

      const text = parts.join(" ").trim();
      if (!text) return;
      const u = this._utter(text, voiceMap);
      if (!u) return;
      u.onstart = () => { this.app.hud?.setCoachTalking?.(true); };
      u.onend = () => { this.app.hud?.setCoachTalking?.(false); };
      u.onerror = () => { this.app.hud?.setCoachTalking?.(false); };
      synth.cancel();
      synth.speak(u);
    } catch {}
  }

  testSpeak() {
    this.speak({ cls: "blunder", label: this.labelFor("blunder"), tip: TIPS.blunder[0] });
  }

  _speakText(text) {
    if (!text) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const coach = this.getCoachData();
      const voiceMap = COACH_VOICE_MAP[coach.voiceId] || {};
      const u = this._utter(text, voiceMap);
      if (!u) return;
      u.onstart = () => { this.app.hud?.setCoachTalking?.(true); };
      u.onend = () => { this.app.hud?.setCoachTalking?.(false); };
      u.onerror = () => { this.app.hud?.setCoachTalking?.(false); };
      synth.cancel();
      synth.speak(u);
    } catch {}
  }

  _lastModeLine = null;

  _modeParts(report) {
    const supportive = [];
    const learning = [];
    if (this.settings.get("coach.supportiveMode")) {
      const cls = report?.cls;
      if (cls && SUPPORTIVE_LINES.movePraise[cls] && !Coach.BAD.has(cls)) {
        supportive.push(pick(SUPPORTIVE_LINES.movePraise[cls], Date.now() % 1000));
      } else if (cls && SUPPORTIVE_LINES.moveConsolation[cls]) {
        supportive.push(pick(SUPPORTIVE_LINES.moveConsolation[cls], Date.now() % 1000));
      } else if (Math.random() < 0.25) {
        supportive.push(pick(SUPPORTIVE_LINES.encouragement, Date.now() % 1000));
      }
    }
    if (this.settings.get("coach.learningMode")) {
      const isOppMove = report?.isOpponent;
      if (isOppMove && Math.random() < 0.4) {
        learning.push(pick(LEARNING_LINES.oppMoveAlert, Date.now() % 1000));
      } else if (Math.random() < 0.3) {
        learning.push(pick(LEARNING_LINES.threatWarning, Date.now() % 1000));
      } else if (Math.random() < 0.2) {
        learning.push(pick(LEARNING_LINES.positionalAdvice, Date.now() % 1000));
      }
    }
    return { supportive, learning };
  }

  getModeLine(report) {
    const { supportive, learning } = this._modeParts(report);
    return [...supportive, ...learning].join(" ").trim();
  }

  speakMode(report) {
    if (!this._lastModeLine && report) this._lastModeLine = this.getModeLine(report);
    return this._lastModeLine || null;
  }

  getModeLabel() {
    const modes = [];
    if (this.settings.get("coach.learningMode")) modes.push("Learning");
    if (this.settings.get("coach.supportiveMode")) modes.push("Supportive");
    return modes.join(" + ");
  }
}
