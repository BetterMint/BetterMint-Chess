import { BuiltinEngines, enabledKey, priorityKey, linesKey } from "../engine/BuiltinEngines.js";
import { THEME_TOKENS, HUD_THEMES, customThemeKey } from "../ui/HUD.js";
import { COACHES } from "../features/CoachData.js";

const themeItems = () => THEME_TOKENS.map((t) => ({
  key: customThemeKey(t.key),
  label: t.label,
  type: "color",
  def: HUD_THEMES.obsidian[t.key] || "#7a5cff",
  group: "custom theme colours",
  desc: `Used everywhere: the in-page HUD, this options menu and the stream-proof window. Only applied while the theme is set to Custom.`,
}));

const builtinItems = () => {
  const items = [];
  for (const e of BuiltinEngines) {
    items.push({
      key: enabledKey(e.key), label: e.label, type: "bool", def: e.defEnabled,
      desc: e.desc, group: "built-in engines",
    });
    items.push({
      key: priorityKey(e.key), label: `${e.name} priority`, type: "range",
      def: e.defPriority, min: 1, max: 16, step: 1, group: "built-in engines",
      desc: "Lower number wins ties — priority 1 supplies the #1 move",
    });
    items.push({
      key: linesKey(e.key), label: `${e.name} lines`, type: "range",
      def: 0, min: 0, max: 16, step: 1, group: "built-in engines",
      desc: "How many of the shown moves this engine may contribute. 0 = use the global MultiPV",
    });
  }
  return items;
};

export const SettingsSchema = [
  {
    category: "engine", label: "Engine",
    items: [
      { key: "engine.wsUrl", label: "EngineWS URL", type: "text", def: "ws://127.0.0.1:8000/ws", desc: "Local engine server endpoint. EngineWS prints the full address including its access token when it starts - paste that whole line here" },
      { key: "engine.useRemote", label: "Use EngineWS (local engines)", type: "bool", def: true, desc: "Connect to local EngineWS server for real engines" },
      { key: "engine.useLocal", label: "Use built-in engines", type: "bool", def: true, desc: "Master switch for the in-browser engines below (they run isolated, invisible to the site)" },
      { key: "ws.socketsEnabled", label: "Use socket engines", type: "bool", def: false, desc: "Connect to raw-UCI WebSocket engines (Maia, Rodent personalities, Patricia, any Stockfish version)" },
      { key: "ws.socketBase", label: "Socket host", type: "select", def: "public", options: [
        { v: "public", l: "Public (ProtonDev hosted)" }, { v: "local", l: "Self-hosted (127.0.0.1:7860)" }, { v: "custom", l: "Custom base URL" },
      ], desc: "Self-hosting instructions are in the Sockets tab" },
      { key: "ws.socketBaseCustom", label: "Custom socket base", type: "text", def: "", desc: "e.g. wss://my-host.example.com — the engine id is appended as a path" },
      { key: "ws.socketsJson", label: "Socket engine list", type: "text", def: "[]", hidden: true },
      { key: "engine.depth", label: "Analysis depth", type: "range", def: 18, min: 1, max: 99, step: 1, desc: "UCI go depth — 1 is legal and instant, 99 is the practical Stockfish ceiling" },
      { key: "engine.movetime", label: "Move time (ms, 0 = use depth)", type: "range", def: 0, min: 0, max: 60000, step: 50 },
      { key: "engine.nodes", label: "Node limit (0 = off)", type: "range", def: 0, min: 0, max: 50000000, step: 100000, desc: "Overrides depth and move time when set" },
      { key: "engine.multipv", label: "MultiPV lines", type: "range", def: 1, min: 1, max: 32, step: 1, desc: "Number of distinct best lines each engine reports" },
      { key: "engine.threads", label: "Threads", type: "range", def: 4, min: 1, max: 128, step: 1, desc: "Clamped per engine to its reported UCI max" },
      { key: "engine.hash", label: "Hash (MB)", type: "range", def: 256, min: 1, max: 32768, step: 1, desc: "Clamped per engine to its reported UCI max" },
      { key: "engine.wasmHashCap", label: "Hash cap for in-browser engines (MB)", type: "range", def: 32, min: 8, max: 512, step: 8, desc: "The bundled WASM engines advertise huge hash limits they cannot actually allocate and will abort with an out-of-memory crash. This caps them safely. Raise only if your engines stay stable" },
      { key: "engine.rankingMode", label: "Move ranking mode", type: "select", def: "smart", options: [
        { v: "smart", l: "Best evaluation first" },
        { v: "priority", l: "Engine priority order" },
        { v: "roundrobin", l: "Round-robin (one per engine)" },
      ], desc: "smart: whichever engine finds the best eval takes #1. priority: engines fill slots in priority order. roundrobin: each engine contributes its top move before any engine gets a second slot" },
      { key: "engine.showAllMoves", label: "Show all engine moves", type: "bool", def: true, desc: "Display moves from every engine with rank labels" },
      { key: "engine.maxArrows", label: "Max move arrows", type: "range", def: 3, min: 1, max: 32, step: 1 },
      ...builtinItems(),
    ],
  },
  {
    category: "humanizer", label: "Humanization",
    items: [
      { key: "hum.enabled", label: "Enable humanization", type: "bool", def: true },
      { key: "hum.preset", label: "Skill preset", type: "select", def: "intermediate", options: [
        { v: "beginner", l: "Beginner (~600)" }, { v: "intermediate", l: "Intermediate (~1400)" },
        { v: "advanced", l: "Advanced (~1900)" }, { v: "master", l: "Master (~2300)" }, { v: "custom", l: "Custom" },
      ], desc: "Presets fill the sliders below; Custom keeps your values" },
      { key: "hum.meanMs", label: "Avg think time (ms)", type: "range", def: 3200, min: 200, max: 20000, step: 100, group: "timing" },
      { key: "hum.stdMs", label: "Think time variance (ms)", type: "range", def: 1800, min: 0, max: 8000, step: 100, group: "timing" },
      { key: "hum.minMs", label: "Min think time (ms)", type: "range", def: 400, min: 0, max: 5000, step: 50, group: "timing" },
      { key: "hum.maxMs", label: "Max think time (ms)", type: "range", def: 15000, min: 1000, max: 60000, step: 500, group: "timing" },
      { key: "hum.timePressureCutoffMs", label: "Time pressure below (ms)", type: "range", def: 30000, min: 5000, max: 120000, step: 1000, group: "timing" },
      { key: "hum.timePressureFactor", label: "Time pressure speed factor", type: "range", def: 0.35, min: 0.05, max: 1, step: 0.05, float: true, group: "timing" },
      { key: "hum.blunderChance", label: "Blunder chance", type: "range", def: 0.08, min: 0, max: 0.5, step: 0.01, float: true, group: "mistakes" },
      { key: "hum.rank2Chance", label: "2nd-best move chance", type: "range", def: 0.22, min: 0, max: 0.8, step: 0.01, float: true, group: "mistakes" },
      { key: "hum.rank3Chance", label: "3rd-best move chance", type: "range", def: 0.08, min: 0, max: 0.5, step: 0.01, float: true, group: "mistakes" },
      { key: "hum.rankDecay", label: "4th-best and deeper falloff", type: "range", def: 0.4, min: 0, max: 1, step: 0.05, float: true, group: "mistakes", desc: "Each rank past the 3rd gets this fraction of the one above it. 0 means never go deeper than the 3rd best" },
      { key: "hum.blunderCooldownMoves", label: "Blunder cooldown (moves)", type: "range", def: 4, min: 0, max: 20, step: 1, group: "mistakes" },
      { key: "hum.evalSwingThreshold", label: "Eval swing think trigger (pawns)", type: "range", def: 1.5, min: 0.2, max: 5, step: 0.1, float: true, group: "timing" },
      { key: "hum.openingInstantPlies", label: "Instant opening plies", type: "range", def: 10, min: 0, max: 30, step: 1, group: "timing" },
      { key: "hum.stealthInput", label: "Simulated mouse input", type: "bool", def: false, desc: "WARNING: synthetic events have isTrusted=false and CAN be detected by site anti-cheat. Site-API moves are safer." },
      { key: "hum.eloTarget", label: "Target Elo (0 = off)", type: "range", def: 0, min: 0, max: 3000, step: 25, desc: "Caps engine strength via UCI_Elo where supported" },
    ],
  },
  {
    category: "automove", label: "Auto Move",
    items: [
      { key: "auto.enabled", label: "Auto move enabled", type: "bool", def: false },
      { key: "auto.useRank", label: "Play move rank", type: "range", def: 1, min: 1, max: 32, step: 1, desc: "Humanizer off: always play this rank. 1 = best move, 2 = second best… Capped by how many lines the engines report (MultiPV)" },
      { key: "auto.useHumanizer", label: "Use humanizer for auto move", type: "bool", def: true },
      { key: "auto.rankPoolSize", label: "Lines the humanizer may pick from", type: "range", def: 0, min: 0, max: 32, step: 1, desc: "Humanizer on: how many of the shown lines auto move can choose between. 0 = use every line you have showing. Rank 2 and 3 use their own chances and deeper ranks decay from there" },
      { key: "auto.fixedDelayMs", label: "Fixed delay (ms, humanizer off)", type: "range", def: 1500, min: 0, max: 15000, step: 100 },
      { key: "auto.premove", label: "Premove in opening", type: "bool", def: false },
      { key: "auto.ourColorOnly", label: "Only when it's our turn", type: "bool", def: true },
      { key: "auto.playWhite", label: "Auto play as white", type: "bool", def: true },
      { key: "auto.playBlack", label: "Auto play as black", type: "bool", def: true },
    ],
  },
  {
    category: "coach", label: "Coach Mode",
    items: [
      { key: "coach.enabled", label: "Enable coach", type: "bool", def: false, desc: "Grades every move you play and explains why, using the same taxonomy as chess.com's review (Brilliant, Great Find, Best, Excellent, Good, Book, Forced, Inaccuracy, Mistake, Missed Win, Blunder)" },
      { key: "coach.select", label: "Coach avatar", type: "select", def: COACHES[0].id, options: COACHES.map((c) => ({ v: c.id, l: c.titledName })), desc: "Choose your chess coach — each has their own avatar and voice" },
      { key: "coach.showAvatar", label: "Show coach avatar in HUD", type: "bool", def: true, desc: "Display the coach avatar image next to the grade card" },
      { key: "coach.speechBubble", label: "Show speech bubble", type: "bool", def: true, desc: "Display coach messages in a speech bubble with typewriter animation" },
      { key: "coach.showTips", label: "Show explanations", type: "bool", def: true, desc: "Add a short coaching note under each grade" },
      { key: "coach.suggestBetter", label: "Show the better move", type: "bool", def: true, desc: "When you miss the top line, name the move you should have played" },
      { key: "coach.coachBoth", label: "Also grade the opponent", type: "bool", def: false, desc: "Grade both sides instead of only your moves" },
      { key: "coach.speak", label: "Speak the grade (TTS)", type: "bool", def: false, desc: "Read each grade aloud using the coach voice" },
      { key: "coach.speakTips", label: "TTS: also read the explanation", type: "bool", def: false, desc: "Speak the coaching note as well as the grade name" },
      { key: "coach.speakOnlyBad", label: "TTS: only speak mistakes", type: "bool", def: true, desc: "Stay quiet on good moves — only speak Inaccuracy, Mistake, Missed Win and Blunder" },
      { key: "coach.ttsVoice", label: "TTS voice override", type: "text", def: "", desc: "Override the coach's default voice. Voice name, e.g. 'Google UK English Male'. Leave blank to use the coach voice" },
      { key: "coach.ttsRate", label: "TTS speed", type: "range", def: 1.05, min: 0.5, max: 2, step: 0.05, float: true },
      { key: "coach.ttsPitch", label: "TTS pitch", type: "range", def: 1, min: 0, max: 2, step: 0.1, float: true },
      { key: "coach.ttsVolume", label: "TTS volume", type: "range", def: 0.85, min: 0, max: 1, step: 0.05, float: true },
      { key: "coach.minDepth", label: "Minimum depth to grade", type: "range", def: 12, min: 4, max: 40, step: 1, desc: "Wait until the engine reaches this depth before judging a move" },
      { key: "coach.accuracy", label: "Show running accuracy", type: "bool", def: true, desc: "Display a live accuracy percentage in the HUD" },
      { key: "coach.learningMode", label: "Learning mode", type: "bool", def: false, desc: "Coach analyses opponent threats and suggests what to watch for — spoken via TTS" },
      { key: "coach.supportiveMode", label: "Supportive mode", type: "bool", def: false, desc: "Coach gives random encouragement and comments on your moves — spoken via TTS" },
      { key: "coach.modeInStreamproof", label: "Show coach modes in stream-proof", type: "bool", def: true, desc: "Display coach mode commentary in the stream-proof overlay window" },
    ],
  },
  {
    category: "books", label: "Books & TB",
    items: [
      { key: "book.enabled", label: "Use opening books", type: "bool", def: true },
      { key: "book.preferOverEngine", label: "Prefer book moves over engine", type: "bool", def: true, desc: "In the opening, show/play book lines before engine analysis" },
      { key: "book.showLines", label: "Show book lines panel", type: "bool", def: true },
      { key: "book.maxLines", label: "Max book lines shown", type: "range", def: 5, min: 1, max: 12, step: 1 },
      { key: "book.weightedPick", label: "Weighted random book pick", type: "bool", def: true, desc: "Pick book moves proportional to their weight instead of always top" },
      { key: "book.varietyMode", label: "Variety mode", type: "bool", def: false, desc: "Avoid repeating the same book line twice in a row" },
      { key: "book.useCloud", label: "Cloud explorer fallback", type: "bool", def: true, desc: "Query online master databases when local books miss (routed through the extension, invisible to the site)" },
      { key: "book.cloudSource", label: "Cloud source", type: "select", def: "masters", options: [
        { v: "masters", l: "Masters database" }, { v: "lichess", l: "Lichess players" },
      ]},
      { key: "book.lichessToken", label: "Lichess API token", type: "text", def: "", desc: "Since March 2026 the lichess opening explorer rejects requests without one, so cloud book lines stay empty until this is set. Create a free token at lichess.org/account/oauth/token — no scopes need to be ticked. The tablebase does not need it." },
      { key: "book.showStats", label: "Show win/draw stats", type: "bool", def: true },
      { key: "tb.enabled", label: "Use endgame tablebases", type: "bool", def: true },
      { key: "tb.preferOverEngine", label: "Prefer tablebase over engine", type: "bool", def: true },
      { key: "tb.showPanel", label: "Show tablebase panel", type: "bool", def: true },
      { key: "tb.useOnline", label: "Online tablebase fallback", type: "bool", def: true, desc: "Query 7-piece online tablebase when local files miss" },
      { key: "tb.maxPieces", label: "Tablebase piece limit", type: "range", def: 7, min: 3, max: 7, step: 1, desc: "Probe only when the position has at most this many pieces (online tables cover 7)" },
      { key: "stage.showIndicator", label: "Show game stage indicator", type: "bool", def: true },
      { key: "stage.endgameMaxPieces", label: "Endgame piece threshold", type: "range", def: 7, min: 3, max: 12, step: 1 },
      { key: "stage.openingMaxPly", label: "Opening max ply", type: "range", def: 20, min: 2, max: 40, step: 1 },
    ],
  },
  {
    category: "display", label: "Board Display",
    items: [
      { key: "ui.evalPerspective", label: "Evaluation perspective", type: "select", def: "player", options: [
        { v: "player", l: "Always your advantage (recommended)" },
        { v: "white", l: "Always White (like chess.com / lichess)" },
        { v: "engine", l: "Raw engine (side to move)" },
      ], desc: "Engines report the score from the side-to-move's point of view, so on the opponent's turn the raw number is THEIR advantage and the eval appears to swing wildly every ply. 'Your advantage' keeps a positive number meaning you are better, always" },
      { key: "ui.arrows", label: "Show move arrows", type: "bool", def: true },
      { key: "ui.arrowColor1", label: "Best move color", type: "color", def: "#4ade80" },
      { key: "ui.arrowColor2", label: "2nd move color", type: "color", def: "#38bdf8" },
      { key: "ui.arrowColor3", label: "3rd move color", type: "color", def: "#fbbf24" },
      { key: "ui.arrowColorRest", label: "Deeper ranks color", type: "color", def: "#8b5cf6", desc: "Ranks 4 and beyond fade from the 3rd colour toward this one, so a 5 or 10 line readout stays readable instead of turning grey" },
      { key: "ui.arrowOpacity", label: "Arrow opacity", type: "range", def: 0.85, min: 0.1, max: 1, step: 0.05, float: true },
      { key: "ui.arrowWidth", label: "Arrow width", type: "range", def: 10, min: 4, max: 20, step: 1 },
      { key: "ui.arrowStyle", label: "Arrow style", type: "select", def: "gradient", options: [
        { v: "solid", l: "Solid" }, { v: "neon", l: "Neon (outer glow)" }, { v: "plasma", l: "Plasma (animated gradient)" },
        { v: "gradient", l: "Gradient fade" }, { v: "outline", l: "Outline only" }, { v: "laser", l: "Laser (thin + core)" },
        { v: "comet", l: "Comet (tapered tail)" },
        { v: "chevron", l: "Chevron (double arrowhead)" }, { v: "dart", l: "Dart (slim pointed)" },
        { v: "blocky", l: "Blocky (thick square head)" }, { v: "thin", l: "Thin line + small head" },
        { v: "curved", l: "Curved (arc path)" }, { v: "hollow", l: "Hollow outline + fill" },
      ], desc: "Rendering style for engine arrows — includes both visual effects and arrow shapes" },
      { key: "ui.arrowGlow", label: "Glow strength", type: "range", def: 14, min: 0, max: 40, step: 1, desc: "Outer glow radius for neon/plasma/laser styles" },
      { key: "ui.arrowAnimate", label: "Animate arrows", type: "bool", def: false, desc: "Pulse/flow effect on the best-move arrow" },
      { key: "ui.arrowAnimationType", label: "Animation type", type: "select", def: "pulse", options: [
        { v: "pulse", l: "Pulse (opacity)" }, { v: "flow", l: "Flow (dash march)" }, { v: "breath", l: "Breath (scale)" }, { v: "rainbow", l: "Rainbow (hue shift)" },
      ], desc: "Animation style when arrow animation is enabled" },
      { key: "ui.arrowColorMode", label: "Color mode", type: "select", def: "rank", options: [
        { v: "rank", l: "By rank (1st=green, 2nd=blue...)" }, { v: "gradient", l: "Gradient (best→worst)" }, { v: "single", l: "Single color" }, { v: "rainbow", l: "Rainbow cycle" },
      ], desc: "How arrow colors are assigned when multiple lines are shown" },
      { key: "ui.arrowCustomColor", label: "Custom single color", type: "color", def: "#4ade80", desc: "Used when color mode is 'Single color'" },
      { key: "ui.arrowGradientStart", label: "Gradient start color", type: "color", def: "#4ade80", desc: "Start color for gradient mode" },
      { key: "ui.arrowGradientEnd", label: "Gradient end color", type: "color", def: "#8b5cf6", desc: "End color for gradient mode" },
      { key: "ui.arrowDash", label: "Dashed arrows", type: "bool", def: false },
      { key: "ui.highlights", label: "Square highlights", type: "bool", def: true },
      { key: "ui.evalBar", label: "Evaluation bar", type: "bool", def: true },
      { key: "ui.depthIndicator", label: "Depth indicator", type: "bool", def: true },
      { key: "ui.moveLabels", label: "Rank labels on arrows", type: "bool", def: true },
      { key: "ui.bookArrows", label: "Book move arrows", type: "bool", def: true, desc: "Draw book lines as distinct dashed arrows" },
      { key: "ui.bookArrowColor", label: "Book arrow color", type: "color", def: "#ff9800", desc: "Book arrows are dashed and labelled B1, B2... Keep this away from your engine rank colours so a book move is obvious at a glance" },
      { key: "ui.tbArrowColor", label: "Tablebase arrow color", type: "color", def: "#c084fc", desc: "Tablebase arrows are dashed and labelled T1, T2..." },
      { key: "ui.tbArrows", label: "Tablebase arrows", type: "bool", def: true },
      { key: "ui.hud", label: "In-game HUD panel", type: "bool", def: true },
      { key: "ui.hudPosition", label: "HUD position", type: "select", def: "right", options: [
        { v: "right", l: "Right of board" }, { v: "left", l: "Left of board" }, { v: "float", l: "Floating / draggable" },
      ]},
      { key: "ui.theme", label: "Theme", type: "select", def: "obsidian", options: [
        { v: "obsidian", l: "Obsidian (dark slate)" }, { v: "neon", l: "Neon (cyber)" }, { v: "mint", l: "Mint (fresh green)" },
        { v: "aurora", l: "Aurora (purple/teal)" }, { v: "mono", l: "Mono (grayscale)" }, { v: "blood", l: "Crimson" },
        { v: "custom", l: "Custom (pick every colour)" },
      ], desc: "Applies to the in-game HUD, this settings menu and the stream-proof window. Choose Custom to unlock the full colour palette below" },
      ...themeItems(),
      { key: "ui.glass", label: "Glass blur panels", type: "bool", def: true, desc: "Frosted backdrop blur on HUD and menu surfaces" },
      { key: "ui.accentGlow", label: "Accent glow", type: "bool", def: true, desc: "Soft neon edge lighting on panels and buttons" },
      { key: "ui.compactHud", label: "Compact HUD", type: "bool", def: false, desc: "Tighter spacing, smaller type" },
      { key: "ui.hudOpacity", label: "HUD opacity", type: "range", def: 0.97, min: 0.3, max: 1, step: 0.01, float: true },
      { key: "ui.hudFloatX", label: "HUD float X", type: "range", def: null, min: 0, max: 4096, step: 1, hidden: true },
      { key: "ui.hudFloatY", label: "HUD float Y", type: "range", def: null, min: 0, max: 4096, step: 1, hidden: true },
    ],
  },
  {
    category: "elomatch", label: "Elo Match Skill",
    items: [
      { key: "elo.matchEnabled", label: "Match opponent Elo", type: "bool", def: false, desc: "Read the opponent's rating from the page and cap your play just above it" },
      { key: "elo.manualTarget", label: "Manual target Elo (0 = auto-detect)", type: "range", def: 0, min: 0, max: 3200, step: 10, desc: "Set a specific elo to play at. 0 means auto-detect from opponent." },
      { key: "elo.accuracyRange", label: "Accuracy variance %", type: "range", def: 0, min: 0, max: 100, step: 5, desc: "Higher = more blunders and inaccuracies. 0 = play at full strength for the target elo." },
      { key: "elo.offset", label: "Play this far above them", type: "range", def: 50, min: -600, max: 600, step: 10, desc: "Target = opponent rating + this. 50 means you edge them out convincingly but not absurdly." },
      { key: "elo.min", label: "Never go below", type: "range", def: 800, min: 250, max: 3000, step: 50 },
      { key: "elo.max", label: "Never go above", type: "range", def: 2600, min: 500, max: 3600, step: 50 },
      { key: "elo.applyHumanizer", label: "Drive humanizer timing/blunders", type: "bool", def: true, desc: "Scales think time, blunder rate and inaccuracy to the target rating" },
      { key: "elo.applyEngineLimit", label: "Limit engine strength (UCI_Elo)", type: "bool", def: true, desc: "Sets UCI_LimitStrength + UCI_Elo on engines that support it" },
      { key: "elo.useMaia", label: "Route to Maia at matched rating", type: "bool", def: false, desc: "Switches the remote socket engine to the nearest Maia bucket (human-like neural net)" },
      { key: "elo.announce", label: "Show matched rating in HUD", type: "bool", def: true },
    ],
  },
  {
    category: "variants", label: "Variants & 960",
    items: [
      { key: "variant.autoDetect", label: "Auto-detect variant", type: "bool", def: true, desc: "Reads the game type from the page and configures the engine (960, atomic, horde, ...)" },
      { key: "variant.name", label: "Variant", type: "select", def: "auto", options: [
        { v: "auto", l: "Auto" }, { v: "chess", l: "Standard" }, { v: "chess960", l: "Chess960" },
        { v: "crazyhouse", l: "Crazyhouse" }, { v: "atomic", l: "Atomic" }, { v: "horde", l: "Horde" },
        { v: "kingofthehill", l: "King of the Hill" }, { v: "3check", l: "Three-check" },
        { v: "antichess", l: "Antichess" }, { v: "racingkings", l: "Racing Kings" },
      ]},
      { key: "variant.forceFairy", label: "Always use Fairy-Stockfish", type: "bool", def: false, desc: "Fairy handles every variant; standard chess is slightly weaker than Stockfish 18" },
      { key: "variant.hudBadge", label: "Show variant badge in HUD", type: "bool", def: true },
    ],
  },
  {
    category: "handbrain", label: "Hand & Brain",
    items: [
      { key: "handbrain.enabled", label: "Hand & Brain mode", type: "bool", def: false, desc: "Only tells you WHICH piece to move, never where. Trains piece intuition while staying discreet." },
      { key: "handbrain.announceDelayMs", label: "Announce after engines settle (ms)", type: "range", def: 800, min: 0, max: 3000, step: 100, desc: "Waits for the top move to stay unchanged this long before naming the piece, so the banner does not flap while engines are still thinking. 0 = announce immediately" },
      { key: "handbrain.showBanner", label: "Show piece banner", type: "bool", def: true },
      { key: "handbrain.animate", label: "Banner pop animation", type: "bool", def: true },
      { key: "handbrain.bannerPosition", label: "Banner position", type: "select", def: "top", options: [
        { v: "top", l: "Top of screen" }, { v: "bottom", l: "Bottom of screen" },
      ]},
      { key: "handbrain.customLabel", label: "Banner label text", type: "text", def: "MOVE THE", desc: "Words before the piece name, e.g. 'PLAY THE'" },
      { key: "handbrain.bannerDurationMs", label: "Banner auto-hide (ms, 0 = never)", type: "range", def: 0, min: 0, max: 15000, step: 250 },
      { key: "handbrain.tts", label: "Speak piece name (TTS)", type: "bool", def: true },
      { key: "handbrain.ttsVolume", label: "TTS volume", type: "range", def: 0.8, min: 0, max: 1, step: 0.05, float: true },
      { key: "handbrain.ttsRate", label: "TTS speed", type: "range", def: 1.1, min: 0.5, max: 2, step: 0.1, float: true },
      { key: "handbrain.ttsRepeat", label: "Speak even if same piece twice", type: "bool", def: false },
      { key: "handbrain.hideArrows", label: "Hide move arrows in H&B mode", type: "bool", def: true },
      { key: "handbrain.blockAuto", label: "Block auto-move while H&B is on", type: "bool", def: true, desc: "Auto-move would defeat the point of Hand & Brain, so it is suspended" },
      { key: "handbrain.highlightPiece", label: "Highlight that piece on the board", type: "bool", def: true, desc: "Marks every square holding the named piece type — you still choose which one and where" },
      { key: "handbrain.revealHotkey", label: "Reveal-move hotkey", type: "text", def: "Ctrl+Shift+R", desc: "Press when stuck to flash the full engine move once" },
    ],
  },
  {
    category: "overlay", label: "Stream-Proof",
    items: [
      { key: "ov.mode", label: "Overlay mode", type: "select", def: "internal", options: [
        { v: "internal", l: "Internal (on-page arrows)" },
        { v: "external", l: "External window (stream-proof)" },
        { v: "both", l: "Both" },
        { v: "stealth", l: "Stealth dots (subtle)" },
      ], desc: "External renders hints in a separate window you exclude from capture in OBS" },
      { key: "ov.externalOpacity", label: "External opacity", type: "range", def: 0.92, min: 0.2, max: 1, step: 0.02, float: true },
      { key: "ov.externalScale", label: "External board scale", type: "range", def: 1, min: 0.4, max: 1.5, step: 0.05, float: true },
      { key: "ov.stealthDotSize", label: "Stealth dot size", type: "range", def: 6, min: 2, max: 16, step: 1 },
      { key: "ov.stealthDotColor", label: "Stealth dot color", type: "color", def: "#4ade80" },
      { key: "ov.mirrorBoard", label: "Mirror full board in external window", type: "bool", def: true },
      { key: "ov.showEval", label: "External: evaluation bar", type: "bool", def: true },
      { key: "ov.showLines", label: "External: engine line list", type: "bool", def: true, desc: "PV list with score, depth and the engine that produced it" },
      { key: "ov.showBook", label: "External: book moves", type: "bool", def: true },
      { key: "ov.showTb", label: "External: tablebase moves", type: "bool", def: true, desc: "Shows WDL and distance-to-zeroing for each legal move" },
      { key: "ov.theme", label: "External window theme", type: "select", def: "dark", options: [
        { v: "dark", l: "Dark" }, { v: "neon", l: "Neon" }, { v: "light", l: "Light" }, { v: "contrast", l: "High contrast" },
        { v: "custom", l: "Custom (uses your palette)" },
      ], desc: "Choose Custom to reuse the same colour palette as the HUD and menu, with the board squares set separately below" },
      { key: "ov.lightSquare", label: "Board light square", type: "color", def: "#ebecd0", desc: "Light square colour in the stream-proof window. Used when its theme is set to Custom" },
      { key: "ov.darkSquare", label: "Board dark square", type: "color", def: "#739552", desc: "Dark square colour in the stream-proof window. Used when its theme is set to Custom" },
      { key: "ov.pieceWhite", label: "White piece colour", type: "color", def: "#ffffff", desc: "Fill colour for white pieces drawn in the stream-proof window" },
      { key: "ov.pieceBlack", label: "Black piece colour", type: "color", def: "#1a1a1a", desc: "Fill colour for black pieces drawn in the stream-proof window" },
      { key: "ov.alwaysOnTop", label: "Keep external window focused", type: "bool", def: false, desc: "Refocuses the helper window after updates (can steal focus)" },
      { key: "ov.externalEnabled", label: "Stream-Proof Overlay", type: "bool", def: false, desc: "Open the external stream-proof overlay window" },
    ],
  },
  {
    category: "autoqueue", label: "Auto Queue",
    items: [
      { key: "queue.enabled", label: "Auto queue enabled", type: "bool", def: false, desc: "Automatically accept rematches / start new games" },
      { key: "queue.rematch", label: "Auto-accept rematch", type: "bool", def: true },
      { key: "queue.newGame", label: "Auto new game after end", type: "bool", def: false },
      { key: "queue.delayMs", label: "Queue click delay (ms)", type: "range", def: 2500, min: 500, max: 15000, step: 100 },
      { key: "queue.delayVarianceMs", label: "Delay variance (ms)", type: "range", def: 1500, min: 0, max: 8000, step: 100 },
      { key: "queue.onlyWon", label: "Only queue after a win", type: "bool", def: false },
      { key: "queue.stopAfter", label: "Stop after N games (0 = never)", type: "range", def: 0, min: 0, max: 100, step: 1 },
    ],
  },
  {
    category: "lua", label: "Lua Scripts",
    items: [
      { key: "lua.enabled", label: "Enable Lua scripting", type: "bool", def: true },
      { key: "lua.autorun", label: "Auto-run enabled scripts", type: "bool", def: true },
      { key: "lua.maxScripts", label: "Max concurrent scripts", type: "range", def: 10, min: 1, max: 50, step: 1 },
      { key: "lua.debugLog", label: "Script debug logging", type: "bool", def: false },
    ],
  },
  {
    category: "extras", label: "Extras",
    items: [
      { key: "ex.oppAnalysis", label: "Opponent engine-correlation meter", type: "bool", def: false, desc: "Flags opponents whose moves suspiciously match engine choices" },
      { key: "ex.pgnExport", label: "PGN export button", type: "bool", def: true },
      { key: "ex.tts", label: "Text-to-speech moves", type: "bool", def: false },
      { key: "ex.ttsVolume", label: "TTS volume", type: "range", def: 0.7, min: 0, max: 1, step: 0.05, float: true },
      { key: "ex.coachMode", label: "Coach hints", type: "bool", def: false, desc: "Explain in plain words why the top move is strong" },
    ],
  },
  {
    category: "exploits", label: "Exploits",
    items: [
      { key: "ex.premove", label: "Predictive premove", type: "bool", def: false, site: "both", desc: "Premoves the engine's expected reply the instant you move. In bullet this plays back in ~0ms and can win on time alone." },
      { key: "ex.premoveMinDepth", label: "Premove: min ponder depth", type: "range", def: 12, min: 4, max: 40, step: 1, site: "both", desc: "Only premove when the predicted reply came from at least this depth" },
      { key: "ex.timeScalp", label: "Time-pressure mode", type: "bool", def: false, site: "both", desc: "When the opponent's clock drops below the threshold, switch to instant blitz-out moves to flag them" },
      { key: "ex.timeScalpThreshold", label: "Time-pressure trigger (s)", type: "range", def: 20, min: 2, max: 120, step: 1, site: "both" },
      { key: "ex.oppClockRead", label: "Read opponent clock precisely", type: "bool", def: true, site: "both", desc: "Pulls exact centisecond clocks from the site's own game state instead of the rendered text" },
      { key: "ex.chesscom.autoPromote", label: "Chess.com: skip promotion dialog", type: "bool", def: true, site: "chesscom", desc: "Flips the board's own autoPromote flag so promotions resolve instantly with no picker" },
      { key: "ex.chesscom.fastBoard", label: "Chess.com: kill animations + sounds", type: "bool", def: false, site: "chesscom", desc: "Zero animation time means moves register the moment they are sent — measurable edge in bullet" },
      { key: "ex.chesscom.freeAnalysis", label: "Chess.com: unlock analysis", type: "bool", def: true, site: "chesscom", desc: "Enables the analysis/review UI without a paid membership" },
      { key: "ex.chesscom.revealBot", label: "Chess.com: reveal bot settings", type: "bool", def: true, site: "chesscom", desc: "Exposes the bot's real skill level, search depth and personality from the client config" },
      { key: "ex.chesscom.unlockBots", label: "Chess.com: unlock locked bots", type: "bool", def: false, site: "chesscom", desc: "Clears client-side membership locks on the bot roster" },
      { key: "ex.chesscom.moveList", label: "Chess.com: mine live game state", type: "bool", def: true, site: "chesscom", desc: "Reads the authoritative move list, clocks and ratings straight from the board component" },
      { key: "ex.lichess.cloudEval", label: "Lichess: cloud eval engine", type: "bool", def: true, site: "lichess", desc: "Free deep Stockfish evaluations from Lichess's own cloud, instantly, with zero local CPU" },
      { key: "ex.lichess.berserk", label: "Lichess: auto-berserk in arenas", type: "bool", def: false, site: "lichess", desc: "Clicks berserk at game start for double tournament points" },
      { key: "ex.lichess.autoQueen", label: "Lichess: always auto-queen", type: "bool", def: false, site: "lichess" },
      { key: "ex.lichess.socketMine", label: "Lichess: mine game socket", type: "bool", def: true, site: "lichess", desc: "Taps the site's own websocket for exact clocks, ratings and opponent events" },
      { key: "ex.lichess.zenOff", label: "Lichess: force zen mode off", type: "bool", def: false, site: "lichess", desc: "Zen mode hides ratings and clocks the overlay wants to read" },
    ],
  },
  {
    category: "privacy", label: "Privacy & Stealth",
    items: [
      { key: "stealth.debugLogs", label: "Debug console logs", type: "bool", def: false, desc: "OFF in normal use: sites can hook console methods. Only enable when troubleshooting." },
      { key: "stealth.routeCloudViaExtension", label: "Route network via extension", type: "bool", def: true, desc: "Book/tablebase cloud requests run in the extension context where page anti-cheat cannot observe them" },
      { key: "priv.memoryOnly", label: "Memory-only mode", type: "bool", def: false, desc: "Nothing is written to disk: settings live in RAM for this session only and vanish when the browser closes" },
      { key: "priv.panicHotkey", label: "Panic hotkey", type: "text", def: "Ctrl+Shift+Backspace", desc: "Instantly tears down every overlay, window, engine and listener, leaving a clean page" },
      { key: "priv.panicWipes", label: "Panic also wipes stored data", type: "bool", def: false, desc: "The panic hotkey additionally clears all saved settings and cached books" },
      { key: "priv.autoHideOnBlur", label: "Hide overlays when tab loses focus", type: "bool", def: false, desc: "Arrows and HUD disappear the moment you alt-tab or share your screen" },
      { key: "priv.hideOnScreenshare", label: "Hide when screen sharing starts", type: "bool", def: true, desc: "Detects an active display capture and pulls all visuals off the page" },
      { key: "priv.disguiseName", label: "Disguise window title", type: "text", def: "Notes", desc: "Title used by the helper window and any injected surfaces" },
      { key: "priv.disguiseIcon", label: "Disguise toolbar icon", type: "bool", def: false, desc: "Replaces the pinned toolbar icon and its tooltip with a plain grey one. Note the name and logo on chrome://extensions come from the manifest and cannot be changed while running." },
      { key: "priv.disguiseTooltip", label: "Disguised tooltip", type: "text", def: "Extension", desc: "Hover text shown on the toolbar button while the icon is disguised" },
      { key: "priv.stripOnUnload", label: "Remove all traces on page unload", type: "bool", def: true, desc: "Deletes injected nodes, globals and observers before the page goes away" },
      { key: "stealth.mobileHashCap", label: "Mobile hash cap (MB)", type: "range", def: 16, min: 4, max: 128, step: 4, desc: "Maximum hash size for in-browser engines on mobile devices to prevent WASM out-of-memory crashes" },
    ],
  },
];

const flat = {};
for (const cat of SettingsSchema) {
  for (const item of cat.items) flat[item.key] = item;
}

export function getDefault(key) {
  return flat[key]?.def;
}

export function getAllDefaults() {
  const out = {};
  for (const [k, v] of Object.entries(flat)) out[k] = v.def;
  return out;
}

export function getMeta(key) {
  return flat[key] || null;
}
