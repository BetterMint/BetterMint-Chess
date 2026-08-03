export const SOCKET_BASES = {
  public: "wss://ProtonnDev-engine.hf.space",
  local: "ws://127.0.0.1:7860",
};

export const SOCKET_DOCS = "https://github.com/ProtonDev-sys/bettermint-sockets";

const range = (from, to, step) => {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

export const STOCKFISH_VERSIONS = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export const FAIRY_VARIANTS = [
  { id: "fairy-stockfish", label: "Fairy-Stockfish", desc: "Variant engine: Chess960, atomic, horde, king of the hill, three-check, crazyhouse, antichess and more" },
  { id: "fairy-stockfish-14", label: "Fairy-Stockfish 14", desc: "Older Fairy build, slightly weaker but very stable" },
];

export const KOMODO_BUILDS = [
  { id: "komodo-dragon", label: "Komodo Dragon", desc: "Komodo's NNUE flagship. Very strong, distinctly positional style" },
  { id: "komodo-14", label: "Komodo 14", desc: "Classic Komodo evaluation - the engine chess.com used for its rated bots" },
  { id: "komodo-mcts", label: "Komodo MCTS", desc: "Monte-Carlo search variant. Picks human-looking practical moves over cold best play" },
];

export const MAIA_ELOS = range(1100, 1900, 100);

export const RODENT_PERSONALITIES = [
  { id: "default", label: "Default", desc: "Balanced Rodent III" },
  { id: "anand", label: "Anand", desc: "Fast, slight attacking bias, respects pawn structure" },
  { id: "anderssen", label: "Anderssen", desc: "Romantic era attacker" },
  { id: "botvinnik", label: "Botvinnik", desc: "Balanced, structural, tolerates doubled pawns" },
  { id: "fischer", label: "Fischer", desc: "Attacking, contemptuous, high mobility" },
  { id: "larsen", label: "Larsen", desc: "Tricky, unusual openings, speculative sacrifices" },
  { id: "marshall", label: "Marshall", desc: "Very high attack, sacrificial, loves knights" },
  { id: "nimzowitsch", label: "Nimzowitsch", desc: "Hypermodern blockading style" },
  { id: "petrosian", label: "Petrosian", desc: "Defensive, closed positions, exchange sacs" },
  { id: "reti", label: "Reti", desc: "Unorthodox placement, solid pawns" },
  { id: "rubinstein", label: "Rubinstein", desc: "Classical, defensive, rook play, endgame bound" },
  { id: "spassky", label: "Spassky", desc: "Defensive, space grabbing, structural" },
  { id: "steinitz", label: "Steinitz", desc: "Defensive, cramped positions, solid pawns" },
  { id: "tarrasch", label: "Tarrasch", desc: "Mobility and bishops, open games" },
  { id: "drunk", label: "Drunk (fun)", desc: "Huge random evaluation noise" },
  { id: "henny", label: "Henny (fun)", desc: "Novelty personality" },
  { id: "kinghunter", label: "King Hunter (fun)", desc: "Mad attacker, hunts the king" },
  { id: "remy", label: "Remy (fun)", desc: "Novelty personality" },
  { id: "tortoise", label: "Tortoise (fun)", desc: "Slow defender, loves blocked positions" },
];

export const PATRICIA_PRESETS = [1100, 1400, 1700, 2000, 2300, 2600, 2900, 3200];

export function socketCatalog() {
  const groups = [];

  groups.push({
    family: "stockfish",
    label: "Stockfish (versioned)",
    desc: "Every major Stockfish release. Older versions are a natural way to cap strength.",
    entries: STOCKFISH_VERSIONS.map((v) => ({
      id: `stockfish-${v}`,
      label: `Stockfish ${v}`,
      desc: v >= 16 ? "Modern NNUE, full strength" : v >= 12 ? "NNUE era" : "Classical handcrafted eval",
      recommendedDepth: null,
    })),
  });

  groups.push({
    family: "maia",
    label: "Maia (human-like neural net)",
    desc: "Trained on human games at each rating band. Plays human mistakes, not engine mistakes \u2014 the most natural-looking option.",
    entries: MAIA_ELOS.map((e) => ({
      id: `maia-${e}`,
      label: `Maia ${e}`,
      desc: `Human-like play around ${e} Elo`,
      recommendedDepth: 5,
      maxDepth: 7,
      elo: e,
    })),
  });

  groups.push({
    family: "rodent3",
    label: "Rodent III (personalities)",
    desc: "Style emulation of famous players plus joke personalities.",
    entries: RODENT_PERSONALITIES.map((p) => ({
      id: `rodent3-${p.id}`,
      label: `Rodent III \u2014 ${p.label}`,
      desc: p.desc,
      recommendedDepth: 12,
    })),
  });

  groups.push({
    family: "fairy",
    label: "Fairy-Stockfish (variants)",
    desc: "The only engines here that play non-standard variants correctly. Required for atomic, crazyhouse, horde, three-check, antichess and friends.",
    entries: FAIRY_VARIANTS.map((f) => ({
      id: f.id,
      label: f.label,
      desc: f.desc,
      recommendedDepth: 16,
      variantCapable: true,
    })),
  });

  groups.push({
    family: "komodo",
    label: "Komodo",
    desc: "Komodo builds, including the Dragon NNUE flagship and the MCTS variant that favours practical, human-looking choices.",
    entries: KOMODO_BUILDS.map((k) => ({
      id: k.id,
      label: k.label,
      desc: k.desc,
      recommendedDepth: 16,
    })),
  });

  groups.push({
    family: "patricia",
    label: "Patricia (hyper-aggressive)",
    desc: "One of the most attacking engines ever written. Any Elo from 1100 to 3200.",
    entries: PATRICIA_PRESETS.map((e) => ({
      id: `patricia-${e}`,
      label: `Patricia ${e}`,
      desc: `Aggressive attacking play at ${e} Elo`,
      recommendedDepth: 14,
      elo: e,
    })),
  });

  return groups;
}

export function resolveSocketBase(settings) {
  const mode = settings.get("ws.socketBase");
  if (mode === "custom") {
    const raw = String(settings.get("ws.socketBaseCustom") || "").trim();
    return raw.replace(/\/+$/, "") || SOCKET_BASES.public;
  }
  return SOCKET_BASES[mode] || SOCKET_BASES.public;
}

export function socketUrl(base, id) {
  const b = String(base || "").replace(/\/+$/, "");
  const path = String(id || "").replace(/^\/+/, "");
  return `${b}/${path}`;
}

export function maiaIdForElo(elo) {
  const target = Math.max(MAIA_ELOS[0], Math.min(MAIA_ELOS[MAIA_ELOS.length - 1], Number(elo) || 1500));
  let best = MAIA_ELOS[0];
  for (const e of MAIA_ELOS) {
    if (Math.abs(e - target) < Math.abs(best - target)) best = e;
  }
  return { id: `maia-${best}`, elo: best };
}

export function patriciaIdForElo(elo) {
  const clamped = Math.max(1100, Math.min(3200, Math.round(Number(elo) || 1500)));
  return { id: `patricia-${clamped}`, elo: clamped };
}

export function parseSocketList(json) {
  try {
    const arr = JSON.parse(json || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.id === "string")
      .map((e, i) => ({
        id: e.id,
        label: typeof e.label === "string" && e.label ? e.label : e.id,
        priority: Number.isFinite(e.priority) ? e.priority : i + 2,
        enabled: e.enabled !== false,
        depth: Number.isFinite(e.depth) ? e.depth : null,
        url: typeof e.url === "string" && e.url ? e.url : null,
      }));
  } catch {
    return [];
  }
}

export function stringifySocketList(list) {
  return JSON.stringify(
    (list || []).map((e) => ({
      id: e.id, label: e.label, priority: e.priority,
      enabled: e.enabled !== false, depth: e.depth ?? null, url: e.url || null,
    })),
  );
}
