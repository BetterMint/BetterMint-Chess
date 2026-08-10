export class AutoMove {
  constructor(settings, humanizer) {
    this.settings = settings;
    this.humanizer = humanizer;
    this._timer = null;
    this._busy = false;
    this.onMovePlayed = null;
    this._ply = 0;
    this._lastPlayedFen = null;
    this._pendingFen = null;
  }

  get enabled() {
    return this.settings.get("auto.enabled");
  }

  newGame() {
    this._ply = 0;
    this._lastPlayedFen = null;
    this.cancel();
  }

  cancel() {
    clearTimeout(this._timer);
    this._timer = null;
    this._busy = false;
    this._pendingFen = null;
    this._readyWaited = 0;
  }

  _poolSize(available) {
    const raw = Number(this.settings.get("auto.rankPoolSize"));
    const wanted = Number.isFinite(raw) && raw > 0 ? raw : available;
    return Math.max(1, Math.min(wanted, available));
  }

  notePosition(fen) {
    if (!fen) return;
    if (this._pendingFen && fen !== this._pendingFen) {
      clearTimeout(this._timer);
      this._timer = null;
      this._pendingFen = null;
      this._busy = false;
      this._readyWaited = 0;
    }
    if (this._lastPlayedFen && fen !== this._lastPlayedFen) this._lastPlayedFen = null;
  }

  _pick(rankedMoves, bookPick, premove) {
    let chosen = null;
    let source = "engine";
    if (bookPick && this.settings.get("book.preferOverEngine")) {
      chosen = bookPick?.line?.move;
      if (!chosen) return { chosen: null, source };
      source = "book";
    } else if (this.settings.get("auto.useHumanizer") && this.humanizer.enabled && rankedMoves?.length) {
      const pick = this.humanizer.pickMove(rankedMoves, this._poolSize(rankedMoves.length));
      chosen = pick?.move;
      source = pick?.wasBlunder ? "blunder" : pick?.rankUsed > 1 ? "rank" : "engine";
    } else if (rankedMoves?.length) {
      const rank = Math.min(this.settings.get("auto.useRank"), rankedMoves.length);
      chosen = rankedMoves[rank - 1]?.move;
    }
    if (premove && rankedMoves?.[0]?.move === premove) {
      chosen = premove;
      source = "premove";
    }
    return { chosen, source };
  }

  async consider({ fen, chess, rankedMoves, bookPick, playMove, ourTurn, ourColor, timePressure = false, premove = null, verify = null, readyCheck = null, getRankedMoves = null }) {
    if (!this.enabled || this._busy || !rankedMoves?.length && !bookPick) return;
    if (fen && fen === this._lastPlayedFen) return;

    if (!ourTurn) return;
    if (ourColor === "w" && !this.settings.get("auto.playWhite")) return;
    if (ourColor === "b" && !this.settings.get("auto.playBlack")) return;

    let { chosen, source } = this._pick(rankedMoves, bookPick, premove);
    if (!chosen) return;

    let delay;
    if (timePressure || source === "premove") {
      delay = source === "premove" ? 0 : Math.max(60, Number(this.settings.get("auto.fixedDelayMs")) * 0.05);
    } else if (this.settings.get("auto.useHumanizer") && this.humanizer.enabled) {
      const evalCp = rankedMoves[0]?.scoreCp ?? null;
      delay = this.humanizer.computeThinkTime({
        ply: this._ply,
        evalCp,
        inBook: source === "book",
        onlyMove: rankedMoves.length === 1,
      });
    } else {
      delay = this.settings.get("auto.fixedDelayMs");
    }

    this._busy = true;
    this._lastPlayedFen = fen || null;
    this._pendingFen = fen || null;
    this._readyWaited = 0;
    const engineSourced = () => source === "engine" || source === "rank" || source === "blunder";
    const attemptPlay = async () => {
      this._timer = null;
      this._pendingFen = null;
      try {
        if (verify && !verify(fen, chosen)) {
          this._lastPlayedFen = null;
          return;
        }
        // The engine analysis may still be at a shallow depth. Book and
        // premove picks don't care, but an engine pick must wait until the
        // configured depth (or a final bestmove) is reached, re-checking in
        // short polls while the position stays unchanged.
        if (readyCheck && engineSourced() && !readyCheck()) {
          if (this._readyWaited < 10000) {
            this._readyWaited += 150;
            this._pendingFen = fen;
            this._timer = setTimeout(attemptPlay, 150);
            return;
          }
        }
        this._readyWaited = 0;
        // Re-pick from the freshest analysis so the played move reflects the
        // deepest computed line, not the first shallow one we saw.
        if (getRankedMoves && engineSourced()) {
          const fresh = getRankedMoves();
          if (fresh?.length) {
            const rePick = this._pick(fresh, null, null);
            if (rePick.chosen) {
              chosen = rePick.chosen;
              source = rePick.source;
            }
          }
        }
        if (verify && !verify(fen, chosen)) {
          this._lastPlayedFen = null;
          return;
        }
        const ok = await playMove(chosen);
        if (!ok) this._lastPlayedFen = null;
        if (ok) {
          this._ply++;
          this.humanizer.noteMovePlayed();
          this.humanizer.noteEval(rankedMoves[0]?.scoreCp ?? null);
          this.onMovePlayed?.({ move: chosen, source });
        }
      } finally {
        this._busy = false;
      }
    };
    this._timer = setTimeout(attemptPlay, delay);
  }
}
