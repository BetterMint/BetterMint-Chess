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
    }
    if (this._lastPlayedFen && fen !== this._lastPlayedFen) this._lastPlayedFen = null;
  }

  async consider({ fen, chess, rankedMoves, bookPick, playMove, ourTurn, ourColor, timePressure = false, premove = null, verify = null }) {
    if (!this.enabled || this._busy || !rankedMoves?.length && !bookPick) return;
    if (fen && fen === this._lastPlayedFen) return;
    // Moving when it is not our turn is a premove, never something we want by
    // accident, so this guard is unconditional rather than opt-in.
    if (!ourTurn) return;
    if (ourColor === "w" && !this.settings.get("auto.playWhite")) return;
    if (ourColor === "b" && !this.settings.get("auto.playBlack")) return;

    let chosen = null;
    let source = "engine";
    if (bookPick && this.settings.get("book.preferOverEngine")) {
      chosen = bookPick.line.move;
      source = "book";
    } else if (this.settings.get("auto.useHumanizer") && this.humanizer.enabled) {
      const pick = this.humanizer.pickMove(rankedMoves, this._poolSize(rankedMoves.length));
      chosen = pick?.move;
      source = pick?.wasBlunder ? "blunder" : pick?.rankUsed > 1 ? "rank" : "engine";
    } else {
      const rank = Math.min(this.settings.get("auto.useRank"), rankedMoves.length);
      chosen = rankedMoves[rank - 1]?.move;
    }
    if (premove && rankedMoves?.[0]?.move === premove) {
      chosen = premove;
      source = "premove";
    }
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
    this._timer = setTimeout(async () => {
      this._timer = null;
      this._pendingFen = null;
      try {
        // the board can move under us during the think delay, so confirm the
        // position and the turn are still what we decided on
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
    }, delay);
  }
}
