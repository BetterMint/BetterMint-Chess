const SITE_BUTTONS = {
  chesscom: {
    rematch: ["button[data-cy='rematch-button']", ".game-over-buttons-rematch", "button.rematch-button"],
    newGame: ["button[data-cy='new-game-button']", ".game-over-buttons-new-game", "button.new-game-button", ".game-over-new-game-button-component", "button[data-cy='new-game']", "button[class*='new-game']", "button[class*='play-again']", "a[class*='new-game']", "button[class*='next-game']"],
    gameOver: [".game-over-modal", ".board-modal-container", "[data-cy='game-over-modal']", ".game-over-modal-shell-container", ".board-modal-component"],
  },
  lichess: {
    rematch: [".rematch button", "button.rematch", ".follow-up .rematch"],
    newGame: [".follow-up a[href='/']", ".new-game", "a[href='/?fen=current']"],
    gameOver: [".game-over", ".result-wrap", ".status"],
  },
  generic: {
    rematch: ["button[class*='rematch']", "[class*='rematch' i]"],
    newGame: ["button[class*='new-game']", "button[class*='newgame']", "[class*='play-again' i]", "button[class*='new-game-button']"],
    gameOver: ["[class*='game-over' i]", "[class*='gameover' i]", "[class*='result' i]"],
  },
};

const BUTTON_TEXT_RX = /rematch|new game|play again|new opponent|next game|next match|start game|start match|start playing|new\s+\d+\s*(min|sec|bot|game|match)?|new bot|play\s*\d+|rematch\s*\?/i;
const NEW_GAME_TEXT_RX = /new\s+\d+\s*(min|sec|bot|game|match)?|new game|play again|new opponent|next game|next match|start game|start match|start playing|new bot|play\s*\d+/i;
const REMATCH_TEXT_RX = /rematch|new opponent/i;

// Containers that genuinely belong to a rematch offer. The accept pass is
// scoped to these so we can never click an unrelated "Accept" button such as
// a cookie banner.
const REMATCH_SCOPES = [
  "[class*='rematch' i]", "[data-cy*='rematch' i]", ".follow-up",
  ".game-over-modal", "[class*='game-over' i]", ".game-over-modal-shell-container", ".board-modal-component", ".quick-analysis-wrapper",
];
const ACCEPT_TEXT_RX = /^(accept|yes|rematch|ok)\b/i;

const EXCLUDE_CONTAINERS = [
  ".game-buttons-container-component",
  ".move-controls",
  "[class*='navigation' i]",
  "[class*='move-buttons' i]",
];

function _isExcluded(el) {
  if (!el) return false;
  if (el.disabled) return true;
  if (el.getAttribute?.("aria-label") && /^(first|previous|next|last)\s+move|play\s*\/\s*pause/i.test(el.getAttribute("aria-label"))) return true;
  for (const sel of EXCLUDE_CONTAINERS) {
    if (el.closest?.(sel)) return true;
  }
  return false;
}

export class AutoQueue {
  constructor(settings) {
    this.settings = settings;
    this._observer = null;
    this._poll = null;
    this._fired = false;
    this._gamesQueued = 0;
    this._warnedDeadConfig = false;
    this.onQueue = null;
    this.onNothingEnabled = null;
    this._lastResult = null;
  }

  start(hostKind) {
    this.stop();
    this.hostKind = hostKind;
    this._observer = new MutationObserver(() => this._check());
    this._observer.observe(document.documentElement, { childList: true, subtree: true });
    this._poll = setInterval(() => this._check(), 1200);
    this._check();
  }

  stop() {
    this._observer?.disconnect();
    this._observer = null;
    clearInterval(this._poll);
    this._poll = null;
    this._fired = false;
  }

  recheck() {
    if (this._observer) this._check();
  }

  resetForNewGame() {
    this._fired = false;
  }

  _check() {
    if (!this.settings.get("queue.enabled")) return;
    if (this._fired) {
      if (!this._gameOverVisible()) this._fired = false;
      return;
    }
    const canRematch = !!this.settings.get("queue.rematch");
    const canNewGame = !!this.settings.get("queue.newGame");
    if (!canRematch && !canNewGame) {
      if (!this._warnedDeadConfig) {
        this._warnedDeadConfig = true;
        this.onNothingEnabled?.();
      }
      return;
    }
    this._warnedDeadConfig = false;
    const stopAfter = this.settings.get("queue.stopAfter");
    if (stopAfter > 0 && this._gamesQueued >= stopAfter) return;
    const wantWinOnly = this.settings.get("queue.onlyWon");
    const result = this._readResult();
    const sel = SITE_BUTTONS[this.hostKind] || SITE_BUTTONS.generic;

    let target = null;
    if (canRematch) {
      target = this._findAcceptRematch();
      if (target && wantWinOnly && result && result !== "won") target = null;
    }
    if (!target && wantWinOnly && result !== "won") return;

    if (!target && canRematch) target = this._findButton(sel.rematch);
    if (!target && canNewGame) target = this._findNewGameButton(sel);
    if (!target) return;

    this._fired = true;
    const delay = this.settings.get("queue.delayMs") + Math.random() * this.settings.get("queue.delayVarianceMs");
    setTimeout(() => {
      target.click();
      this._gamesQueued++;
      this.onQueue?.({ gamesQueued: this._gamesQueued });
    }, delay);
  }

  _gameOverVisible() {
    const sel = SITE_BUTTONS[this.hostKind] || SITE_BUTTONS.generic;
    for (const gs of sel.gameOver || []) {
      for (const el of document.querySelectorAll(gs)) {
        if (this._visible(el)) return true;
      }
    }
    return false;
  }

  _readResult() {
    const sources = document.querySelectorAll(".game-over-modal, .board-modal-container, .game-over-modal-shell-container, .board-modal-component, .result-wrap, .result, [class*='game-result'], [class*='gameover'], [class*='game-over'], [class*='post-game'], .status");
    const text = [...sources].map((el) => el.textContent).join(" ").toLowerCase();
    if (/you won|victory|won by|1-0/i.test(text)) return "won";
    if (/you lost|defeat|0-1/i.test(text)) return "lost";
    if (/draw|stalemate|1\/2-1\/2/i.test(text)) return "draw";
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

        if (scope.tagName === "BUTTON" || scope.getAttribute?.("role") === "button") {
          if (!_isExcluded(scope)) return scope;
        }
        for (const btn of scope.querySelectorAll("button, a.btn, [role='button']")) {
          if (!this._visible(btn)) continue;
          if (_isExcluded(btn)) continue;
          if (/decline|cancel|no\b/i.test(btn.textContent || "")) continue;
          if (ACCEPT_TEXT_RX.test((btn.textContent || "").trim())) return btn;
        }
      }
    }
    return null;
  }

  _findButton(selectors, opts = {}) {
    const { isNewGame = false, scope = null } = opts;
    const root = scope || document;
    for (const s of selectors) {
      for (const el of root.querySelectorAll(s)) {
        if (!this._visible(el)) continue;
        if (_isExcluded(el)) continue;
        if (isNewGame && REMATCH_TEXT_RX.test(el.textContent || "")) continue;
        return el;
      }
    }
    const allBtns = root.querySelectorAll("button, a.btn, [role='button']");
    for (const btn of allBtns) {
      if (!this._visible(btn)) continue;
      if (_isExcluded(btn)) continue;
      const text = (btn.textContent || "").trim();
      if (isNewGame) {
        if (REMATCH_TEXT_RX.test(text)) continue;
        if (NEW_GAME_TEXT_RX.test(text)) return btn;
      } else {
        if (BUTTON_TEXT_RX.test(text)) return btn;
      }
    }
    return null;
  }

  _findNewGameButton(sel) {
    const gameOverSelectors = sel.gameOver || SITE_BUTTONS.generic.gameOver;
    for (const gs of gameOverSelectors) {
      for (const scope of document.querySelectorAll(gs)) {
        if (!this._visible(scope)) continue;
        const target = this._findButton(sel.newGame, { isNewGame: true, scope });
        if (target) return target;
      }
    }
    return this._findButton(sel.newGame, { isNewGame: true });
  }

  _visible(el) {
    if (!el) return false;
    if (el.disabled) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }
}
