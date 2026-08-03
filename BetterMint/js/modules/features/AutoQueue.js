const SITE_BUTTONS = {
  chesscom: {
    rematch: ["button[data-cy='rematch-button']", ".game-over-buttons-rematch", "button.rematch-button", "[data-cy='new-game-button']"],
    newGame: ["button[data-cy='new-game-button']", ".game-over-buttons-new-game", "button.new-game-button"],
    gameOver: [".game-over-modal", ".board-modal-container", "[data-cy='game-over-modal']"],
  },
  lichess: {
    rematch: [".rematch button", "button.rematch", ".follow-up .rematch"],
    newGame: [".follow-up a[href='/']", ".new-game", "a[href='/?fen=current']"],
    gameOver: [".game-over", ".result-wrap", ".status"],
  },
  generic: {
    rematch: ["button[class*='rematch']", "[class*='rematch' i]"],
    newGame: ["button[class*='new-game']", "button[class*='newgame']", "[class*='play-again' i]"],
    gameOver: ["[class*='game-over' i]", "[class*='gameover' i]", "[class*='result' i]"],
  },
};

const BUTTON_TEXT_RX = /rematch|new game|play again|new opponent|next game/i;

// Containers that genuinely belong to a rematch offer. The accept pass is
// scoped to these so we can never click an unrelated "Accept" button such as
// a cookie banner.
const REMATCH_SCOPES = [
  "[class*='rematch' i]", "[data-cy*='rematch' i]", ".follow-up",
  ".game-over-modal", "[class*='game-over' i]",
];
const ACCEPT_TEXT_RX = /^(accept|yes|rematch|ok)\b/i;

export class AutoQueue {
  constructor(settings) {
    this.settings = settings;
    this._observer = null;
    this._fired = false;
    this._gamesQueued = 0;
    this.onQueue = null;
    this._lastResult = null;
  }

  start(hostKind) {
    this.stop();
    this.hostKind = hostKind;
    this._observer = new MutationObserver(() => this._check());
    this._observer.observe(document.documentElement, { childList: true, subtree: true });
    this._check();
  }

  stop() {
    this._observer?.disconnect();
    this._observer = null;
    this._fired = false;
  }

  resetForNewGame() {
    this._fired = false;
  }

  _check() {
    if (!this.settings.get("queue.enabled") || this._fired) return;
    const stopAfter = this.settings.get("queue.stopAfter");
    if (stopAfter > 0 && this._gamesQueued >= stopAfter) return;
    const sel = SITE_BUTTONS[this.hostKind] || SITE_BUTTONS.generic;
    const result = this._readResult();
    const wantWinOnly = this.settings.get("queue.onlyWon");

    // An opponent's rematch offer can arrive after the game-over panel has
    // gone, so accepting one is checked on its own rather than being gated
    // behind that panel still being on screen.
    let target = null;
    if (this.settings.get("queue.rematch")) {
      target = this._findAcceptRematch();
      if (target && wantWinOnly && result && result !== "won") target = null;
    }

    if (!target) {
      const overVisible = sel.gameOver.some((s) => this._visible(document.querySelector(s)));
      if (!overVisible) return;
      if (wantWinOnly && result !== "won") return;
      if (this.settings.get("queue.rematch")) target = this._findButton(sel.rematch);
      if (!target && this.settings.get("queue.newGame")) target = this._findButton(sel.newGame);
    }
    if (!target) return;

    this._fired = true;
    const delay = this.settings.get("queue.delayMs") + Math.random() * this.settings.get("queue.delayVarianceMs");
    setTimeout(() => {
      target.click();
      this._gamesQueued++;
      this.onQueue?.({ gamesQueued: this._gamesQueued });
      setTimeout(() => { this._fired = false; }, 4000);
    }, delay);
  }

  _readResult() {
    const text = (document.querySelector(".game-over-modal, .result-wrap, .result, [class*='game-result']")?.textContent || "").toLowerCase();
    if (/you won|victory|won by/.test(text)) return "won";
    if (/you lost|defeat/.test(text)) return "lost";
    if (/draw/.test(text)) return "draw";
    return null;
  }

  // Accept a rematch the opponent has offered us.
  _findAcceptRematch() {
    for (const sel of REMATCH_SCOPES) {
      for (const scope of document.querySelectorAll(sel)) {
        if (!this._visible(scope)) continue;
        const mentionsRematch = /rematch/i.test(scope.className || "")
          || /rematch/i.test(scope.getAttribute?.("data-cy") || "")
          || /rematch/i.test(scope.textContent || "");
        if (!mentionsRematch) continue;

        if (scope.tagName === "BUTTON" || scope.getAttribute?.("role") === "button") return scope;
        for (const btn of scope.querySelectorAll("button, a.btn, [role='button']")) {
          if (!this._visible(btn)) continue;
          if (/decline|cancel|no\b/i.test(btn.textContent || "")) continue;
          if (ACCEPT_TEXT_RX.test((btn.textContent || "").trim())) return btn;
        }
      }
    }
    return null;
  }

  _findButton(selectors) {
    for (const s of selectors) {
      for (const el of document.querySelectorAll(s)) {
        if (this._visible(el)) return el;
      }
    }
    for (const btn of document.querySelectorAll("button, a.btn, [role='button']")) {
      if (this._visible(btn) && BUTTON_TEXT_RX.test(btn.textContent || "")) return btn;
    }
    return null;
  }

  _visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }
}
