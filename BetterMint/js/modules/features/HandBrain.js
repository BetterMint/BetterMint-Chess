const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const GLYPHS = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };

export class HandBrain {
  constructor(settings) {
    this.settings = settings;
    this.onShow = null;
    this.onHide = null;
    this.onHighlight = null;
    this.currentPiece = null;
    this.currentFrom = null;
    this.currentMove = null;
    this.revealed = false;
    this.lastSpoken = null;
    this._lastKey = null;
    this._pieceNames = PIECE_NAMES;
    this._glyphs = GLYPHS;
  }

  get enabled() {
    return this.settings.get("handbrain.enabled");
  }

  get blocksAuto() {
    return this.enabled && this.settings.get("handbrain.blockAuto");
  }

  announceMove(uci, chess, fen = null) {
    if (!this.enabled || !uci || uci.length < 4) {
      return false;
    }
    const from = uci.slice(0, 2);
    let piece = null;
    try {
      const sq = chess.get(from);
      if (sq) piece = sq.type;
    } catch {}
    if (!piece) return false;

    const key = `${fen || ""}|${piece}`;
    if (key === this._lastKey) return false;
    this._lastKey = key;

    this.currentPiece = piece;
    this.currentFrom = from;
    this.currentMove = uci;
    this.revealed = false;

    if (this.settings.get("handbrain.showBanner")) {
      this.onShow?.(this._pieceNames[piece], this._glyphs[piece], { count: this._countOf(chess, piece) });
    }
    if (this.settings.get("handbrain.highlightPiece")) {
      this.onHighlight?.(this._squaresOf(chess, piece));
    }
    if (this.settings.get("handbrain.tts")) this._speak(piece);
    return true;
  }

  reveal() {
    if (!this.enabled || !this.currentMove) return null;
    this.revealed = true;
    return this.currentMove;
  }

  _squaresOf(chess, type) {
    const out = [];
    try {
      const board = chess.board();
      const turn = chess.turn();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sq = board[r][f];
          if (sq && sq.type === type && sq.color === turn) {
            out.push("abcdefgh"[f] + (8 - r));
          }
        }
      }
    } catch {}
    return out;
  }

  _countOf(chess, type) {
    return this._squaresOf(chess, type).length;
  }

  clear() {
    this.currentPiece = null;
    this.currentFrom = null;
    this.currentMove = null;
    this.revealed = false;
    this._lastKey = null;
    this.onHighlight?.([]);
    this.onHide?.();
  }

  _speak(piece) {
    const name = this._pieceNames[piece];
    if (name === this.lastSpoken && !this.settings.get("handbrain.ttsRepeat")) return;
    this.lastSpoken = name;
    const msg = new SpeechSynthesisUtterance(name);
    msg.volume = this.settings.get("handbrain.ttsVolume");
    msg.rate = this.settings.get("handbrain.ttsRate");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  }
}
