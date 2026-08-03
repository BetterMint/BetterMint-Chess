export const BuiltinEngines = [
  {
    key: "stockfish18",
    name: "Stockfish 18",
    label: "Stockfish 18 Lite",
    desc: "Bundled WASM build. Strongest all-round option, single-threaded so it runs anywhere.",
    defEnabled: true,
    defPriority: 1,
  },
  {
    key: "sf18nnue",
    name: "Stockfish 18 NNUE",
    label: "Stockfish 18 NNUE (dev)",
    desc: "Lichess's own Stockfish 18 dev build with the full 86 MB network - the strongest engine here. Multi-threaded. Takes a few seconds longer to start than the others because of the size of the network.",
    defEnabled: false,
    defPriority: 2,
    needsSharedArrayBuffer: true,
  },
  {
    key: "torch2",
    name: "Torch 2",
    label: "Torch 2 Lite",
    desc: "Chess.com's own NNUE engine (Torch 2, 2024). Same binary their site runs.",
    defEnabled: false,
    defPriority: 3,
  },
  {
    key: "torch1",
    name: "Torch 1",
    label: "Torch Lite (legacy)",
    desc: "Older Torch build shipped in chess.com's app bundle. Multi-threaded.",
    defEnabled: false,
    defPriority: 4,
  },
  {
    key: "sf16nnue",
    name: "Stockfish 16 NNUE",
    label: "Stockfish 16 NNUE",
    desc: "Full NNUE evaluation, single-threaded. The exact build chess.com serves for its own analysis.",
    defEnabled: false,
    defPriority: 5,
  },
  {
    key: "sf16nosimd",
    name: "Stockfish 16 (no SIMD)",
    label: "Stockfish 16 NNUE (no SIMD, threaded)",
    desc: "The same NNUE engine built without SIMD, and multi-threaded. Useful on hardware or browsers where the SIMD build will not start. It reserves 512 MB up front, so expect a slower start.",
    defEnabled: false,
    defPriority: 6,
  },
  {
    key: "sfclassic",
    name: "Stockfish Classic",
    label: "Stockfish (classic eval)",
    desc: "Handcrafted-evaluation Stockfish from chess.com's bundle. Different playing character to NNUE - useful for variety and for humanised play.",
    defEnabled: false,
    defPriority: 7,
  },
  {
    key: "explanation",
    name: "Explanation Engine",
    label: "Chess.com Explanation Engine",
    desc: "The engine behind chess.com's own coach and Game Review. It searches with Torch and evaluates with Komodo, and additionally carries their move classification, themes and coach commentary options. Roughly 25 MB, so it takes a moment to start.",
    defEnabled: false,
    defPriority: 8,
  },
];

export const builtinKeys = () => BuiltinEngines.map((e) => e.key);

export const builtinByKey = (key) => BuiltinEngines.find((e) => e.key === key) || null;

export const enabledKey = (key) => `engine.builtin.${key}.enabled`;

export const priorityKey = (key) => `engine.builtin.${key}.priority`;

export const linesKey = (key) => `engine.builtin.${key}.lines`;
