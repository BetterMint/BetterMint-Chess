// Detailed hover help for every setting. The schema's `desc` is the short
// inline line; this is the long-form explanation shown in the tooltip.
export const SettingsHelp = {
  // ---------------- engine ----------------
  "engine.wsUrl": "WebSocket address of the EngineWS companion app. EngineWS runs real desktop engines (Stockfish, Lc0, anything UCI) on your machine and streams their analysis here. Leave the default unless you changed the port in EngineWS.",
  "engine.useRemote": "Connect to the EngineWS companion app. This gives you full-strength desktop engines, disk-based polyglot books and Syzygy/Gaviota tablebases. Note that some sites' Content Security Policy blocks localhost WebSockets from the page, in which case the built-in engines still work normally.",
  "engine.useLocal": "Master switch for the engines that run inside your browser as isolated Web Workers. They never touch the page, so the site cannot see them. Turn this off if you only want EngineWS or socket engines.",
  "ws.socketsEnabled": "Enable engines hosted over a raw-UCI WebSocket. This is how you get Maia, Rodent personalities, Patricia, Fairy-Stockfish and every historical Stockfish version without downloading anything.",
  "ws.socketBase": "Which host serves your socket engines. Public is the shared ProtonDev host (convenient, shared with others). Self-hosted points at a copy you run yourself on port 7860. Custom lets you enter any base URL.",
  "ws.socketBaseCustom": "Base URL of your own socket engine host, for example wss://engines.example.com. The engine id is appended as a path, so Maia 1500 becomes wss://engines.example.com/maia-1500.",
  "ws.socketsJson": "Internal storage for your chosen socket engines. Managed from the Sockets tab.",
  "engine.depth": "How deep each engine searches, in plies. Higher is stronger but slower. Depth 1 is instant and very weak; 18 is a solid default; beyond about 30 the returns get small while the time cost grows sharply.",
  "engine.movetime": "Give every engine a fixed number of milliseconds per position instead of a depth target. Useful when you want predictable timing rather than predictable strength. Set to 0 to use depth instead.",
  "engine.nodes": "Stop the search after this many nodes. This is the most reproducible strength limiter because it does not depend on how fast your computer is. Overrides both depth and move time when non-zero.",
  "engine.multipv": "How many distinct best lines each engine reports. This is what feeds the multiple arrows and the ranked move list. Raising it costs search time, because the engine must properly evaluate several moves instead of just proving one is best.",
  "engine.threads": "CPU threads per engine. The bundled in-browser engines are single-threaded builds and will clamp this to 1. It mainly matters for EngineWS desktop engines.",
  "engine.hash": "Transposition table size in megabytes. More hash means fewer repeated calculations in long searches. In-browser engines are additionally capped by the separate WASM hash cap, because they cannot really allocate the huge values they advertise.",
  "engine.wasmHashCap": "Hard ceiling on hash memory for the in-browser WASM engines. They report limits like 32 GB that they cannot actually allocate, and asking for too much makes them abort with an out-of-memory crash mid-game. 64 MB is safe and fast.",
  "engine.rankingMode": "How moves from several engines are merged into one ranked list. Best evaluation first lets whichever engine finds the highest score take the top slot. Engine priority order fills slots strictly by engine priority. Round-robin gives every engine one move before any engine gets a second.",
  "engine.showAllMoves": "Show every engine's candidate moves in the HUD with rank labels, instead of only the single best move.",
  "engine.maxArrows": "Maximum number of move arrows drawn on the board at once. Ranks beyond this are still listed in the HUD, they are just not drawn.",

  // ---------------- humanizer ----------------
  "hum.enabled": "Master switch for humanisation. When on, auto-play stops behaving like a perfect engine: it varies its thinking time, sometimes picks the second or third best move, and occasionally blunders on purpose.",
  "hum.preset": "A bundled personality that sets the blunder rate, move-rank spread and thinking speed in one go. Choose Custom to tune the individual sliders yourself.",
  "hum.meanMs": "Average thinking time per move in milliseconds. The actual delay is drawn from a bell curve around this value, so no two moves take exactly the same time.",
  "hum.stdMs": "How much thinking time varies around the average. Larger values make timing less predictable, which looks more natural; very small values produce robotic, evenly spaced moves.",
  "hum.minMs": "Never move faster than this, no matter what the calculation says. Prevents instant replies that look obviously automated.",
  "hum.maxMs": "Never take longer than this on a single move, so the humaniser cannot accidentally sit and burn your whole clock.",
  "hum.timePressureCutoffMs": "When your remaining clock drops below this, the humaniser starts moving faster, the way a human speeds up in time trouble.",
  "hum.timePressureFactor": "How much to speed up once in time pressure. 0.35 means moves take about a third of their usual time.",
  "hum.blunderChance": "Probability of deliberately playing the worst move in the list. This is the single biggest lever on apparent strength.",
  "hum.rank2Chance": "Probability of playing the engine's second choice instead of the best move. Small evaluation losses like this are what separate a strong human from an engine.",
  "hum.rank3Chance": "Probability of playing the third choice.",
  "hum.rankDecay": "Controls every rank past the third. Each one gets this fraction of the rank above it, so at 0.4 the fourth choice is 40% as likely as the third, the fifth 40% of the fourth, and so on. This is what makes a wide pool behave sensibly when MultiPV is showing more than three lines. Set it to 0 to never pick deeper than the third best. Whatever these chances do not use up is the chance of playing the best move, shown live under the sliders.",
  "hum.blunderCooldownMoves": "Minimum number of moves between deliberate blunders. Without a cooldown, random chance can produce two disasters in a row, which looks nothing like human play.",
  "hum.evalSwingThreshold": "How large an evaluation swing, in pawns, counts as a critical moment. When the position changes by more than this, the humaniser spends noticeably longer thinking, as a human would.",
  "hum.openingInstantPlies": "Play the first N plies quickly, the way a human rattles off known opening theory instead of calculating from move one.",
  "hum.stealthInput": "Move pieces with synthetic mouse events instead of the site's own move API. WARNING: synthetic events carry isTrusted=false and can be detected by site anti-cheat. Leaving this off is safer. It also installs a page-wide event patch, which costs a little performance.",
  "hum.eloTarget": "Ask engines that support UCI_Elo to play at roughly this rating. Set to 0 to leave engines at full strength and rely on the humaniser instead.",

  // ---------------- auto move ----------------
  "auto.enabled": "Automatically play the chosen move for you. Everything else in this section shapes which move gets played and when.",
  "auto.useRank": "With the humaniser off, always play this exact rank. 1 is the engine's best move, 2 is the second best, and so on. Capped by how many lines your MultiPV setting produces.",
  "auto.useHumanizer": "Let the humaniser choose the move and the delay, instead of always playing a fixed rank instantly.",
  "auto.rankPoolSize": "How many of the shown lines the humaniser may choose between. 0 means use every line you have showing, so raising MultiPV automatically widens the pool.",
  "auto.fixedDelayMs": "Delay before auto-play moves when the humaniser is switched off. A flat, unvarying delay.",
  "auto.premove": "Predict the opponent's reply from the engine's principal variation and pre-load your answer, so it can be played the instant they move.",
  "auto.ourColorOnly": "Only auto-play when it is genuinely your turn. Turn this off on analysis boards where you want it to play both sides.",
  "auto.playWhite": "Allow auto-play when you are the white pieces.",
  "auto.playBlack": "Allow auto-play when you are the black pieces.",

  // ---------------- coach ----------------
  "coach.enabled": "Grade every move after it is played and explain why, using the same taxonomy as chess.com's game review: Brilliant, Great Find, Best, Excellent, Good, Book, Forced, Inaccuracy, Mistake, Missed Win and Blunder.",
  "coach.showTips": "Add a short coaching note under each grade explaining what went wrong or right, rather than just naming the grade.",
  "coach.suggestBetter": "When you miss the top line, name the move you should have played instead.",
  "coach.coachBoth": "Grade the opponent's moves as well as your own. Useful for studying a game; noisier during play.",
  "coach.speak": "Read each grade aloud using your browser's speech synthesis.",
  "coach.speakTips": "Also speak the explanation, not just the grade name. Slower, but hands-free.",
  "coach.speakOnlyBad": "Stay quiet on good moves and only speak up for Inaccuracy, Mistake, Missed Win and Blunder. Much less annoying during a game.",
  "coach.ttsVoice": "Name of the speech voice to use, for example 'Google UK English Female'. Partial matches work. Leave blank for your system default.",
  "coach.ttsRate": "Speaking speed. 1.0 is normal; higher is faster and gets the message out before your next move.",
  "coach.ttsPitch": "Voice pitch. 1.0 is normal.",
  "coach.ttsVolume": "Speech volume, from silent to full.",
  "coach.minDepth": "Wait until the engine reaches this depth before judging a move. Judging too shallow produces wrong grades; too deep means the grade arrives late.",
  "coach.accuracy": "Show a live accuracy percentage in the HUD, calculated from the grades you have earned so far this game.",

  // ---------------- books ----------------
  "book.enabled": "Use opening books. Book moves come from real master games rather than engine calculation, so they look natural and save time in the opening.",
  "book.preferOverEngine": "While still in book, show and play the book move instead of the engine's suggestion.",
  "book.showLines": "Show the book lines panel in the HUD, listing the available book moves and how often they are played.",
  "book.maxLines": "How many book moves to list at once.",
  "book.weightedPick": "Choose book moves in proportion to how often they occur in the database, instead of always taking the single most popular move. Produces natural variety.",
  "book.varietyMode": "Avoid repeating the same book line twice in a row, so you do not play identical openings every game.",
  "book.useCloud": "When your local books have nothing for a position, query an online database. Requests are routed through the extension, so the site never sees them.",
  "book.cloudSource": "Which online database to query. Masters is titled-player games and gives the most respectable moves; Lichess is all rated games and reflects what people actually play at your level.",
  "book.showStats": "Show win, draw and loss percentages next to each book move.",
  "tb.enabled": "Use endgame tablebases. In simple endings these give perfect play: the exact fastest win or the most stubborn defence, not an estimate.",
  "tb.preferOverEngine": "In tablebase positions, trust the tablebase over the engine. The tablebase is provably correct, so this should normally stay on.",
  "tb.showPanel": "Show the tablebase panel listing every legal move with its exact result and distance to mate.",
  "tb.useOnline": "Query the online 7-piece tablebase when local files do not cover the position.",
  "tb.maxPieces": "Only probe tablebases when the position has at most this many pieces. Online tables cover up to 7.",
  "stage.showIndicator": "Show whether the game is in the opening, middlegame or endgame. The stage decides whether books, engines or tablebases take priority.",
  "stage.endgameMaxPieces": "Treat the position as an endgame once it has this many pieces or fewer.",
  "stage.openingMaxPly": "Treat the game as still in the opening up to this ply count.",

  // ---------------- display ----------------
  "ui.evalPerspective": "Whose advantage the evaluation number represents. Engines natively report from the side-to-move's point of view, which means the sign flips every single ply and the eval looks like it is swinging wildly. 'Your advantage' keeps positive meaning you are better, always.",
  "ui.arrows": "Draw arrows on the board for the engine's suggested moves.",
  "ui.arrowColor1": "Colour of the best-move arrow.",
  "ui.arrowColor2": "Colour of the second-best arrow.",
  "ui.arrowColor3": "Colour of the third-best arrow.",
  "ui.arrowColorRest": "Ranks 4 and deeper fade from the third colour toward this one, so a five or ten line readout stays readable instead of collapsing into grey.",
  "ui.arrowOpacity": "How opaque arrows are. Lower values keep the pieces underneath readable.",
  "ui.arrowWidth": "Thickness of the arrow shaft.",
  "ui.arrowStyle": "Visual treatment for arrows, from plain solid through neon glow, animated plasma, laser and comet tails.",
  "ui.arrowGlow": "Outer glow radius for the styles that use one. Set to 0 for a flat look.",
  "ui.arrowAnimate": "Animate the arrows with a flowing pulse. Note this redraws every frame, so it costs a little performance on high refresh-rate displays.",
  "ui.arrowDash": "Draw arrows as dashed lines instead of solid.",
  "ui.highlights": "Highlight important squares, such as the piece the coach is commenting on.",
  "ui.evalBar": "Show the evaluation bar in the HUD.",
  "ui.depthIndicator": "Show how far the engine has searched, as a number and a progress bar.",
  "ui.moveLabels": "Print rank labels such as #1 and #2 on the arrows themselves.",
  "ui.bookArrows": "Draw arrows for book moves as well as engine moves.",
  "ui.tbArrows": "Draw arrows for tablebase moves.",
  "ui.hud": "Show the in-page HUD panel.",
  "ui.hudPosition": "Which side of the screen the HUD starts on. You can always drag it afterwards.",
  "ui.theme": "Colour theme for the HUD and this options page.",
  "ui.hudOpacity": "Overall HUD transparency. Lower values let the page show through.",
  "ui.glass": "Frosted-glass blur behind the HUD. Looks good over busy backgrounds; costs a little GPU.",
  "ui.accentGlow": "Soft coloured glow on accents and highlights. Turn off for a flatter, more discreet look.",
  "ui.compactHud": "Tighter spacing and smaller text, for a HUD that takes less screen space.",

  // ---------------- elo match ----------------
  "elo.matchEnabled": "Read the opponent's rating from the page and automatically tune your playing strength to sit near it, so you win convincingly without looking impossible.",
  "elo.offset": "How many rating points above or below the opponent to aim for. A small positive number wins most games while staying believable.",
  "elo.min": "Never drop the target below this rating, however weak the opponent is.",
  "elo.max": "Never raise the target above this rating, however strong the opponent is.",
  "elo.useMaia": "Prefer a Maia network at the matching rating band. Maia is trained on human games at that exact level, so its mistakes are human mistakes rather than engine mistakes.",
  "elo.announce": "Show a note in the HUD when the target rating changes.",

  // ---------------- variants ----------------
  "variant.autoDetect": "Detect the variant automatically from the site, the URL or the position, and configure the engines for it.",
  "variant.name": "Force a specific variant instead of relying on detection.",
  "variant.hudBadge": "Show the detected variant as a badge in the HUD.",
  "variant.warnNoEngine": "Warn when the position needs a variant-capable engine such as Fairy-Stockfish and none is connected, because standard engines will give confidently wrong answers.",

  // ---------------- hand & brain ----------------
  "handbrain.enabled": "Hand and Brain mode: instead of being told the move, you are told only which piece to move, and you have to find the move yourself. A genuine training tool.",
  "handbrain.showBanner": "Show the named piece in a banner over the board.",
  "handbrain.tts": "Speak the piece name aloud.",
  "handbrain.ttsVolume": "Volume of the spoken piece name.",
  "handbrain.ttsRate": "Speed of the spoken piece name.",
  "handbrain.ttsRepeat": "Repeat the announcement after this many seconds if you have not moved yet. Set to 0 to announce only once.",
  "handbrain.hideArrows": "Hide the move arrows in Hand and Brain mode, so the answer is not given away.",
  "handbrain.blockAuto": "Prevent auto-play from moving while Hand and Brain is active, so it cannot answer for you.",
  "handbrain.revealHotkey": "Key combination that reveals the full move when you are stuck.",

  // ---------------- overlay ----------------
  "ov.mode": "Where analysis is drawn. Internal draws on the page itself. Stealth draws only small discreet dots. External sends everything to a separate window that screen capture does not record.",
  "ov.externalOpacity": "Transparency of the external stream-proof window.",
  "ov.externalScale": "Size of the external window's board.",
  "ov.stealthDotSize": "Radius of the stealth-mode dots.",
  "ov.stealthDotColor": "Colour of the stealth-mode dots.",
  "ov.mirrorBoard": "Draw a full copy of the board in the external window, rather than only arrows.",
  "ov.showEval": "Include the evaluation bar in the external window.",
  "ov.showBook": "Include book and tablebase lines in the external window.",
  "ov.theme": "Colour theme for the external window.",

  // ---------------- auto queue ----------------
  "queue.enabled": "Automatically continue to the next game when one finishes.",
  "queue.rematch": "Accept or offer a rematch against the same opponent.",
  "queue.newGame": "Start a fresh game from the lobby instead of a rematch.",
  "queue.delayMs": "How long to wait after a game ends before queueing again. Instant requeues look automated.",
  "queue.delayVarianceMs": "Random variation added to the queue delay, so the timing is never identical twice.",
  "queue.onlyWon": "Only continue queueing while you are winning. Stops after a loss.",
  "queue.stopAfter": "Stop queueing after this many games. Set to 0 for no limit.",

  // ---------------- lua ----------------
  "lua.enabled": "Enable the Lua scripting runtime. Scripts can read the position, drive the engines, draw on the board and build their own UI panels.",
  "lua.autorun": "Automatically start scripts that are marked enabled whenever a chess page loads.",
  "lua.maxScripts": "How many scripts may run at the same time. A guard against a runaway script collection.",
  "lua.debugLog": "Print script output to the browser console for debugging.",

  // ---------------- extras / exploits ----------------
  "ex.pgnExport": "Add a button to copy the current game as PGN.",
  "ex.tts": "Speak the best move aloud as it is found.",
  "ex.ttsVolume": "Volume for spoken move announcements.",
  "ex.premove": "Work out the opponent's most likely reply from the engine's line and prepare your answer in advance.",
  "ex.premoveMinDepth": "Only trust a predicted reply once the engine has searched at least this deep, otherwise the prediction is guesswork.",
  "ex.timeScalp": "When the opponent is low on clock, switch to fast moves to pressure them into flagging.",
  "ex.timeScalpThreshold": "Opponent clock level, in seconds, that triggers time-pressure mode.",
  "ex.oppClockRead": "Read both clocks precisely from the site's own data rather than estimating from the on-screen text.",
  "ex.chesscom.autoPromote": "Chess.com: always promote to a queen without showing the promotion dialog.",
  "ex.chesscom.fastBoard": "Chess.com: disable board animations and sounds so moves register instantly.",
  "ex.chesscom.freeAnalysis": "Chess.com: flip the client-side flags that gate the analysis features.",
  "ex.chesscom.unlockBots": "Chess.com: flip the client-side flags that gate the locked bots.",
  "ex.chesscom.revealBot": "Chess.com: read the bot's true configuration - its skill level, search depth, opening book and personality - and show it in the HUD.",
  "ex.lichess.cloudEval": "Lichess: use their public cloud evaluation as an extra engine. It returns very deep analysis instantly and costs you no CPU at all.",
  "ex.lichess.socketMine": "Lichess: read the game's own WebSocket traffic for exact clock values and game events.",
  "ex.lichess.autoQueen": "Lichess: always auto-queen on promotion.",
  "ex.lichess.zenOff": "Lichess: force Zen mode off so ratings and clocks stay visible.",
  "ex.lichess.berserk": "Lichess: automatically click berserk at the start of arena games.",

  // ---------------- privacy ----------------
  "priv.panicHotkey": "Key combination that instantly tears everything down: closes the overlay, removes the HUD, stops all engines and detaches from the board.",
  "priv.panicWipes": "Make the panic hotkey also erase your stored settings and cached books, not just hide the interface.",
  "priv.autoHideOnBlur": "Hide all visuals whenever the tab loses focus or is switched away from, so nothing is on screen when you alt-tab.",
  "priv.hideOnScreenshare": "Detect when screen sharing or display capture starts and hide the visuals automatically.",
  "priv.stripOnUnload": "Remove every trace from the page when you navigate away or close the tab.",
  "stealth.debugLogs": "Print internal diagnostics to the console. Useful when reporting a problem, but it makes the extension noisy and easier to notice.",
};

// Per-engine rows are generated from the engine registry, so their help is
// generated to match rather than being listed key by key.
function generatedHelp(key) {
  const prio = /^engine\.builtin\.(.+)\.priority$/.exec(key);
  if (prio) {
    return "Where this engine sits in the ordering. Priority 1 is consulted first. In 'Engine priority order' ranking mode this decides which engine fills the #1 move slot; in the other modes it only breaks ties.";
  }
  const lines = /^engine\.builtin\.(.+)\.lines$/.exec(key);
  if (lines) {
    return "How many of the displayed moves this engine is allowed to contribute. 0 means it uses the global MultiPV value. Lower it to stop one strong engine from filling every slot and crowding the others out.";
  }
  const enabled = /^engine\.builtin\.(.+)\.enabled$/.exec(key);
  if (enabled) {
    return "Run this engine in the browser as an isolated Web Worker. Each additional engine costs CPU and memory, so enable the ones you actually want ranked.";
  }
  const opt = /^engineOpt::(.+?)::(.+)$/.exec(key);
  if (opt) {
    return `Raw UCI option "${opt[2]}" sent directly to ${opt[1]}. These are the engine's own settings, discovered from the engine itself.`;
  }
  return "";
}

export function helpFor(item) {
  if (!item) return "";
  return SettingsHelp[item.key] || generatedHelp(item.key) || item.desc || "";
}
