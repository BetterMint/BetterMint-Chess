import { maiaIdForElo } from "../engine/SocketCatalog.js";

const RATING_RX = /\(?\b(\d{3,4})\b\)?/;
const PAREN_RATING_RX = /\((\d{3,4})\)/;

export class EloMatch {
  constructor(settings) {
    this.settings = settings;
    this.opponentRating = null;
    this.opponentName = null;
    this.target = null;
    this.source = null;
    this._lastApplied = null;
    this._apiCache = null;
    this._apiCacheTime = 0;
  }

  get enabled() {
    return !!this.settings.get("elo.matchEnabled");
  }

  computeTarget(rating) {
    if (!rating) return null;
    const manualTarget = Number(this.settings.get("elo.manualTarget")) || 0;
    if (manualTarget > 0) {
      const min = Number(this.settings.get("elo.min")) || 400;
      const max = Number(this.settings.get("elo.max")) || 3200;
      return Math.max(min, Math.min(max, manualTarget));
    }
    const offset = Number(this.settings.get("elo.offset")) || 0;
    const min = Number(this.settings.get("elo.min")) || 400;
    const max = Number(this.settings.get("elo.max")) || 3200;
    return Math.max(min, Math.min(max, Math.round(rating + offset)));
  }

  async detect(candidate) {
    const manualTarget = Number(this.settings.get("elo.manualTarget")) || 0;
    if (manualTarget > 0) {
      this.opponentRating = manualTarget;
      this.opponentName = null;
      this.source = "manual";
      this.target = this.computeTarget(manualTarget);
      return { rating: manualTarget, target: this.target, source: "manual" };
    }
    let found = this._fromBoardApi(candidate) || this._fromLichess() || this._fromLichessDom() || this._fromDom(candidate);
    if (!found?.rating) {
      found = await this._fromChessComApi(candidate);
    }
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
      if (!game) return null;
      const us = game.getPlayingAs?.() ?? game.playingAs;
      const players = game.getPlayers?.() || game.players;
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
      ".player-top .cc-user-rating-white", ".player-top .cc-user-rating-black",
      ".player-top .rating-score-rating",
      ".board-layout-top .cc-user-rating-white", ".board-layout-top .cc-user-rating-black",
      ".board-layout-top .rating-score-rating",
      ".player-bottom .cc-user-rating-white", ".player-bottom .cc-user-rating-black",
      ".player-bottom .rating-score-rating",
      ".board-layout-bottom .cc-user-rating-white", ".board-layout-bottom .cc-user-rating-black",
      ".board-layout-bottom .rating-score-rating",
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
    const scanResult = this._scanPlayerAreaForRating(candidate);
    if (scanResult) return scanResult;
    return null;
  }

  _scanPlayerAreaForRating(candidate) {
    const top = document.getElementById("board-layout-player-top") || document.querySelector(".player-top, .board-layout-top");
    if (!top) return null;
    const text = top.textContent || "";
    const m = PAREN_RATING_RX.exec(text);
    if (m) {
      const rating = Number(m[1]);
      if (rating >= 100 && rating <= 3600) return { rating, name: null, source: "dom-scan" };
    }
    const blocks = top.querySelectorAll(".cc-user-block-component, .cc-user-username-component");
    for (const block of blocks) {
      const blockText = block.textContent || "";
      const bm = PAREN_RATING_RX.exec(blockText) || RATING_RX.exec(blockText);
      if (bm) {
        const rating = Number(bm[1]);
        if (rating >= 100 && rating <= 3600) return { rating, name: null, source: "dom-scan" };
      }
    }
    return null;
  }

  _fromLichessDom() {
    try {
      if (!location.hostname.includes("lichess.org")) return null;
      const top = document.querySelector(".ruser-top, .player-top");
      if (!top) return null;
      const ratingEl = top.querySelector("rating, .rating");
      if (ratingEl) {
        const m = RATING_RX.exec(ratingEl.textContent || "");
        if (m) {
          const rating = Number(m[1]);
          if (rating >= 100 && rating <= 3600) return { rating, name: null, source: "lichess-dom" };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async _fromChessComApi(candidate) {
    try {
      if (!location.hostname.includes("chess.com")) return null;
      const now = Date.now();
      if (this._apiCache && now - this._apiCacheTime < 30000) return this._apiCache;
      const url = location.pathname.match(/\/game\/(?:live\/)?(\d+)/);
      if (url) {
        const gameId = url[1];
        try {
          const resp = await fetch(`https://www.chess.com/callback/live/game/${gameId}`, { credentials: "include" });
          if (resp.ok) {
            const data = await resp.json();
            const myUsername = this._myUsername();
            const players = data.game?.players || data.players || {};
            for (const side of ["white", "black"]) {
              const p = players[side];
              if (p && p.username !== myUsername) {
                const r = Number(p.rating || p.elo);
                if (r) {
                  const result = { rating: r, name: p.username || p.name, source: "chesscom-api" };
                  this._apiCache = result;
                  this._apiCacheTime = now;
                  return result;
                }
              }
            }
          }
        } catch {}
      }
      const oppName = this._opponentUsernameFromDom();
      if (oppName) {
        try {
          const resp = await fetch(`https://www.chess.com/callback/${oppName}/stats`, { credentials: "include" });
          if (resp.ok) {
            const stats = await resp.json();
            const rt = this._ratingTypeFromDom() || "blitz";
            const r = Number(stats[rt]?.last?.rating || stats[rt]?.rating);
            if (r) {
              const result = { rating: r, name: oppName, source: "chesscom-stats" };
              this._apiCache = result;
              this._apiCacheTime = now;
              return result;
            }
          }
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  }

  _myUsername() {
    try {
      const scripts = document.querySelectorAll("script:not([src])");
      for (const s of scripts) {
        const m = s.textContent.match(/"username"\s*:\s*"([^"]+)"/);
        if (m) return m[1];
      }
    } catch {}
    return document.querySelector("[data-test-element='user-tagline-username']")?.textContent?.trim() || "";
  }

  _opponentUsernameFromDom() {
    try {
      const top = document.getElementById("board-layout-player-top") || document.querySelector(".player-top, .board-layout-top");
      if (top) {
        const nameEl = top.querySelector("[data-test-element='user-tagline-username'], .cc-user-username-component");
        if (nameEl) {
          const name = nameEl.textContent.trim();
          if (name && name !== "Opponent" && name.length > 1) return name;
        }
      }
      const bottom = document.getElementById("board-layout-player-bottom") || document.querySelector(".player-bottom, .board-layout-bottom");
      if (bottom) {
        const nameEl = bottom.querySelector("[data-test-element='user-tagline-username'], .cc-user-username-component");
        if (nameEl) {
          const name = nameEl.textContent.trim();
          if (name && name !== "Opponent" && name.length > 1) return name;
        }
      }
    } catch {}
    return null;
  }

  _ratingTypeFromDom() {
    try {
      const block = document.querySelector(".cc-user-block-component[rating-type]");
      if (block) return block.getAttribute("rating-type") || "blitz";
    } catch {}
    return "blitz";
  }

  _topPlayerNode(candidate) {
    if (!candidate?.el) return null;
    const rect = candidate.el.getBoundingClientRect();
    const nodes = [...document.querySelectorAll("rating, .user-rating, .cc-user-rating, .cc-user-rating-white, .cc-user-rating-black, .rating-score-rating, .ruser rating")];
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
    const accuracyRange = Number(this.settings.get("elo.accuracyRange")) || 0;
    if (accuracyRange > 0) {
      const blunderBoost = clamp01(accuracyRange / 100);
      return {
        "hum.preset": "custom",
        "hum.eloTarget": t,
        "hum.blunderChance": Number((weak * 0.18 + blunderBoost * 0.12).toFixed(3)),
        "hum.rank2Chance": Number((0.08 + weak * 0.34 + blunderBoost * 0.15).toFixed(3)),
        "hum.rank3Chance": Number((weak * 0.18 + blunderBoost * 0.10).toFixed(3)),
        "hum.blunderCooldownMoves": Math.max(1, Math.round(2 + (1 - weak) * 6 - blunderBoost * 2)),
        "hum.meanMs": Math.round(1200 + weak * 3200 + blunderBoost * 800),
        "hum.stdMs": Math.round(500 + weak * 1800 + blunderBoost * 600),
        "hum.openingInstantPlies": Math.round(4 + (1 - weak) * 8 - blunderBoost * 3),
      };
    }
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
