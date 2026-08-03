import { maiaIdForElo } from "../engine/SocketCatalog.js";

const RATING_RX = /\(?\b(\d{3,4})\b\)?/;

export class EloMatch {
  constructor(settings) {
    this.settings = settings;
    this.opponentRating = null;
    this.opponentName = null;
    this.target = null;
    this.source = null;
    this._lastApplied = null;
  }

  get enabled() {
    return !!this.settings.get("elo.matchEnabled");
  }

  computeTarget(rating) {
    if (!rating) return null;
    const offset = Number(this.settings.get("elo.offset")) || 0;
    const min = Number(this.settings.get("elo.min")) || 400;
    const max = Number(this.settings.get("elo.max")) || 3200;
    return Math.max(min, Math.min(max, Math.round(rating + offset)));
  }

  detect(candidate) {
    const found = this._fromBoardApi(candidate) || this._fromLichess() || this._fromDom(candidate);
    if (!found?.rating) return null;
    this.opponentRating = found.rating;
    this.opponentName = found.name || null;
    this.source = found.source;
    this.target = this.computeTarget(found.rating);
    return { ...found, target: this.target };
  }

  _fromBoardApi(candidate) {
    try {
      const game = candidate?.el?.game;
      if (!game?.getPlayingAs) return null;
      const us = game.getPlayingAs();
      const players = game.getPlayers?.();
      if (!players) return null;
      const opp = us === 1 || us === "white" ? players.bottom || players.black : players.top || players.white;
      const list = [players.top, players.bottom, players.white, players.black].filter(Boolean);
      const oppEntry = opp || list.find((p) => p && p.color && p.color !== us);
      const rating = Number(oppEntry?.rating || oppEntry?.elo);
      if (!rating) return null;
      return { rating, name: oppEntry?.username || oppEntry?.name || null, source: "board-api" };
    } catch {
      return null;
    }
  }

  _fromLichess() {
    try {
      const data = window.lichess?.analysis?.data || window.lichess?.round?.data;
      if (!data?.player || !data?.opponent) return null;
      const rating = Number(data.opponent.rating);
      if (!rating) return null;
      return { rating, name: data.opponent.user?.name || data.opponent.name || null, source: "lichess-data" };
    } catch {
      return null;
    }
  }

  _fromDom(candidate) {
    const selectors = [
      ".player-top .user-rating", ".player-component.player-top .user-rating",
      ".board-player-top .cc-user-rating", "[data-test-element='user-tagline-rating']",
      ".ruser-top rating", ".ruser-top .rating", ".game__meta__players .black rating",
    ];
    const boardTop = this._topPlayerNode(candidate);
    const nodes = [];
    for (const sel of selectors) nodes.push(...document.querySelectorAll(sel));
    if (boardTop) nodes.unshift(boardTop);
    for (const node of nodes) {
      const m = RATING_RX.exec(node?.textContent || "");
      const rating = m ? Number(m[1]) : null;
      if (rating && rating >= 100 && rating <= 3600) {
        return { rating, name: null, source: "dom" };
      }
    }
    return null;
  }

  _topPlayerNode(candidate) {
    if (!candidate?.el) return null;
    const rect = candidate.el.getBoundingClientRect();
    const nodes = [...document.querySelectorAll("rating, .user-rating, .cc-user-rating, .ruser rating")];
    let best = null;
    let bestY = Infinity;
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      if (!r.width) continue;
      if (r.bottom <= rect.top + rect.height / 2 && r.top < bestY) {
        bestY = r.top;
        best = n;
      }
    }
    return best;
  }

  humanizerProfile(target) {
    const t = Math.max(400, Math.min(3200, target));
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const weak = clamp01(1 - (t - 600) / 2000);
    return {
      "hum.preset": "custom",
      "hum.eloTarget": t,
      "hum.blunderChance": Number((weak * 0.18).toFixed(3)),
      "hum.rank2Chance": Number((0.08 + weak * 0.34).toFixed(3)),
      "hum.rank3Chance": Number((weak * 0.18).toFixed(3)),
      "hum.blunderCooldownMoves": Math.max(1, Math.round(2 + (1 - weak) * 6)),
      "hum.meanMs": Math.round(1200 + weak * 3200),
      "hum.stdMs": Math.round(500 + weak * 1800),
      "hum.openingInstantPlies": Math.round(4 + (1 - weak) * 8),
    };
  }

  uciTargets(target) {
    return { limitStrength: true, elo: Math.max(1320, Math.min(3190, target)) };
  }

  maiaTarget(target) {
    return maiaIdForElo(target);
  }

  describe() {
    if (!this.opponentRating) return null;
    return {
      opponent: this.opponentRating,
      target: this.target,
      name: this.opponentName,
      source: this.source,
    };
  }
}
