export const VARIANTS = {
  chess: { uci: "chess", label: "Standard", fairyOnly: false },
  chess960: { uci: "chess", label: "Chess960", fairyOnly: false, chess960: true },
  crazyhouse: { uci: "crazyhouse", label: "Crazyhouse", fairyOnly: true },
  atomic: { uci: "atomic", label: "Atomic", fairyOnly: true },
  horde: { uci: "horde", label: "Horde", fairyOnly: true },
  kingofthehill: { uci: "kingofthehill", label: "King of the Hill", fairyOnly: true },
  "3check": { uci: "3check", label: "Three-check", fairyOnly: true },
  antichess: { uci: "antichess", label: "Antichess", fairyOnly: true },
  racingkings: { uci: "racingkings", label: "Racing Kings", fairyOnly: true },
};

const ALIASES = {
  "standard": "chess", "chess": "chess", "fromposition": "chess",
  "chess960": "chess960", "960": "chess960", "fischerandom": "chess960", "fischer random": "chess960",
  "crazyhouse": "crazyhouse", "bughouse": "crazyhouse",
  "atomic": "atomic", "horde": "horde",
  "kingofthehill": "kingofthehill", "king of the hill": "kingofthehill", "kingpawn": "kingofthehill",
  "threecheck": "3check", "three-check": "3check", "3check": "3check", "3 check": "3check",
  "antichess": "antichess", "giveaway": "antichess", "losers": "antichess",
  "racingkings": "racingkings", "racing kings": "racingkings",
};

const STANDARD_CASTLING = /^[KQkq-]+$/;

export function normalizeVariant(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().replace(/[_]+/g, "").trim();
  return ALIASES[key] || (VARIANTS[key] ? key : null);
}

export class VariantDetector {
  constructor(settings) {
    this.settings = settings;
    this.current = "chess";
    this.chess960 = false;
    this.source = null;
  }

  detect(candidate, fen) {
    const forced = this.settings.get("variant.name");
    if (forced && forced !== "auto") {
      return this._set(forced, "manual");
    }
    if (!this.settings.get("variant.autoDetect")) return this._set("chess", "default");

    const found =
      this._fromLichess() ||
      this._fromChesscom(candidate) ||
      this._fromUrl() ||
      this._fromFen(fen) ||
      null;

    return this._set(found?.variant || "chess", found?.source || "default");
  }

  _set(variant, source) {
    const v = normalizeVariant(variant) || "chess";
    const changed = v !== this.current;
    this.current = v;
    this.chess960 = v === "chess960";
    this.source = source;
    return { variant: v, chess960: this.chess960, changed, source, meta: VARIANTS[v] };
  }

  _fromLichess() {
    try {
      const data = window.lichess?.round?.data || window.lichess?.analysis?.data;
      const key = data?.game?.variant?.key;
      const v = normalizeVariant(key);
      if (v) return { variant: v, source: "lichess-data" };
      const el = document.querySelector(".variant-link, .game__meta__infos .setup");
      const v2 = normalizeVariant(el?.textContent?.split("•").pop());
      if (v2) return { variant: v2, source: "lichess-dom" };
    } catch {}
    return null;
  }

  _fromChesscom(candidate) {
    try {
      const game = candidate?.el?.game;
      const type = game?.getVariant?.() || game?.getOptions?.()?.variant || game?.getGameType?.();
      const v = normalizeVariant(type);
      if (v) return { variant: v, source: "chesscom-api" };
      if (game?.getOptions?.()?.isChess960 || game?.getIsChess960?.()) {
        return { variant: "chess960", source: "chesscom-api" };
      }
    } catch {}
    return null;
  }

  _fromUrl() {
    const segments = location.pathname.toLowerCase().split("/").filter(Boolean);
    const params = new URLSearchParams(location.search.toLowerCase());
    const candidates = [...segments, params.get("variant") || "", params.get("gametype") || ""]
      .map((s) => s.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean);
    for (const seg of candidates) {
      const v = normalizeVariant(seg);
      if (v && v !== "chess") return { variant: v, source: "url" };
      if (seg === "960" || seg === "chess960" || seg === "fischerandom") {
        return { variant: "chess960", source: "url" };
      }
    }
    return null;
  }

  _fromFen(fen) {
    if (!fen) return null;
    const castling = fen.split(" ")[2];
    if (castling && castling !== "-" && !STANDARD_CASTLING.test(castling)) {
      return { variant: "chess960", source: "fen-castling" };
    }
    const board = fen.split(" ")[0] || "";
    if (board.includes("[") || /\/[^/]*\[/.test(fen)) {
      return { variant: "crazyhouse", source: "fen-pockets" };
    }
    return null;
  }

  needsFairy() {
    if (this.settings.get("variant.forceFairy")) return true;
    return !!VARIANTS[this.current]?.fairyOnly;
  }

  uciOptionsFor(engine) {
    const out = {};
    const opts = engine?.uciOptions || [];
    const meta = VARIANTS[this.current] || VARIANTS.chess;
    if (opts.some((o) => o.name === "UCI_Chess960")) {
      out.UCI_Chess960 = this.chess960 ? "true" : "false";
    }
    const variantOpt = opts.find((o) => o.name === "UCI_Variant");
    if (variantOpt) {
      const supported = variantOpt.vars || [];
      if (!supported.length || supported.includes(meta.uci)) out.UCI_Variant = meta.uci;
    }
    return out;
  }
}
