export const FeatureDocs = [
  {
    id: "multi-engine",
    title: "Multi-Engine Analysis",
    body: `BetterMint can run several chess engines at the same time and combines their output into a single ranked move list.

REMOTE ENGINES (EngineWS): run real UCI engines (Stockfish, Clover, Viridithas, Fairy-Stockfish…) on your PC via the EngineWS server. Download engines with one click from the EngineWS dashboard at http://127.0.0.1:8000 — no compiling, no file pickers.

LOCAL ENGINE: a bundled Stockfish 18 WASM build runs inside the extension itself, completely invisible to the website. It works even when EngineWS is offline.

PRIORITY MODE: the engine with priority P1 supplies the best move, P2 the second-best move, P3 the third, and so on. Drag engines up/down in the dashboard or extension to change who gives which rank.

SMART MODE: every engine's best move is collected and re-ranked purely by evaluation, regardless of priority.

Each move on the board and in the HUD is labeled #1/#2/#3 with the engine name that produced it.`,
  },
  {
    id: "humanizer",
    title: "Humanization Engine",
    body: `Makes engine-assisted play indistinguishable from human play, both statistically and behaviorally.

THINK-TIME MODEL: a Gaussian distribution around your configured mean/variance. The model automatically thinks LONGER after big evaluation swings (a human reacts to surprises), thinks faster in the opening, and enters time-pressure mode when your clock drops below the configured cutoff.

MISTAKE MODEL: with configurable probabilities, BetterMint intentionally plays the 2nd or 3rd best move, or a genuine blunder from the worst ranked line. A blunder cooldown prevents two blunders from ever clustering — a classic engine-tell.

ANTI-DETECTION NOTES: think times, move-choice entropy, and non-repeating patterns defeat server-side statistical detection. For input, prefer site-API moves (default) over synthetic mouse events, because synthetic events carry isTrusted=false which advanced anti-cheat can inspect.

Every single parameter is customizable in the Humanization tab — nothing is hardcoded. Presets (Beginner→Master) fill sensible values; switch to Custom to tweak freely.`,
  },
  {
    id: "books",
    title: "Opening Books & Endgame Tablebases",
    body: `BetterMint understands the three stages of a chess game and uses the right knowledge source for each.

GAME-STAGE DETECTION: OPENING (early plies with book coverage), MIDGAME, and ENDGAME (piece count at or below your threshold). A colored badge in the HUD always shows the current stage.

BOOK FORMATS: local polyglot .bin files load directly in the browser (binary-searched instantly). EngineWS serves larger polyglot books from disk, plus Syzygy and Gaviota tablebases. ChessBase CTG is not readable - convert it to polyglot .bin. If every local book misses, a cloud master database is queried as fallback — routed through the extension so the site never sees the request.

BOOK LINES UI: book moves render as dashed amber arrows with B1/B2/B3 labels and appear in the BOOK LINES panel with weights, play percentages, and real win/draw/loss statistics — visually unmistakable from engine lines.

TABLEBASES: in the endgame, Syzygy/Gaviota files via EngineWS, or a 7-piece online tablebase fallback, give perfect moves with WDL (win/draw/loss) badges and DTZ/DTM distances, drawn as dashed purple arrows.

VARIETY MODE avoids repeating identical lines; WEIGHTED PICK plays book moves proportionally to their real-world frequency.`,
  },
  {
    id: "auto-move",
    title: "Auto Move & Premoves",
    body: `Plays moves for you, with full control over strength and style.

RANK SELECTION: choose to always play the #1 move, or deliberately the 2nd/3rd best for a lower profile.

HUMANIZER INTEGRATION: when enabled, move timing and occasional mistakes follow the humanization model instead of a fixed delay.

BOOK-FIRST LOGIC: in the opening, book moves are played instantly (like a prepared human), then the engine takes over in the middlegame, and tablebases take over in the endgame.

COLOR CONTROLS: enable for White only, Black only, or both.`,
  },
  {
    id: "hand-brain",
    title: "Hand & Brain Mode",
    body: `Instead of showing you the exact move, BetterMint only announces WHICH PIECE to move — you find the square yourself.

A glowing banner appears at the top of the screen naming the piece ("MOVE THE ♞ KNIGHT"), and text-to-speech speaks it aloud with adjustable volume and rate. Optionally hides all arrows for a completely clean board.

Perfect for streaming (nothing suspicious on screen), for training piece intuition, and for staying under the radar while still playing at engine level.`,
  },
  {
    id: "overlay",
    title: "Stream-Proof Overlay",
    body: `Four display modes for move hints:

INTERNAL: arrows and highlights drawn on the page (invisible to site code — rendered inside closed shadow DOM).

EXTERNAL WINDOW: a completely separate OS window mirrors the board and draws the best moves. Exclude that window from OBS/game capture and your stream sees a clean board while you see everything. Opacity and scale are configurable.

BOTH: internal arrows + external window simultaneously.

STEALTH DOTS: tiny subtle dots on the origin/destination squares — visible to you, invisible to anyone glancing at your screen.`,
  },
  {
    id: "auto-queue",
    title: "Auto Queue",
    body: `Automatically queues your next game when one ends — works on chess.com, lichess, and any detected site.

Watches for game-over dialogs and clicks Rematch or New Game with a humanized random delay. Options: only queue after wins, stop after N games, adjustable delay and variance.`,
  },
  {
    id: "lua",
    title: "Lua Scripting",
    body: `A complete Lua 5.3 runtime (fengari) embedded in the extension. Write your own features without touching the extension code.

Scripts can: read the live game state, control engines and books, draw on the board, build custom UI panels (buttons, sliders, toggles, dropdowns, color pickers), manipulate the website's DOM, observe page changes, make HTTP requests, persist data, and react to events (moves, new games, stage changes).

Scripts run in isolated Lua states with the full BetterMint API injected. Enable/disable instantly, auto-run on page load, and manage everything from the Lua tab. See the API Docs sub-tab for the complete reference.`,
  },
  {
    id: "privacy",
    title: "Privacy & Anti-Detection",
    body: `BetterMint is engineered so websites cannot detect it:

NO GLOBALS: nothing is attached to window. The app instance lives behind a Symbol key invisible to property enumeration.

CLOSED SHADOW DOM: all UI (HUD, panels, overlay canvas) renders inside closed shadow roots — document.querySelector from the site cannot find any BetterMint element. Class names are randomized per session.

NO DOM INJECTION TRACES: code enters the page via chrome.scripting.executeScript — no <script> tags, no chrome-extension:// URLs anywhere a site's MutationObserver could spot.

ISOLATED ENGINE: the built-in Stockfish runs inside the extension's isolated world. The site cannot see its Worker, its network traffic, or its memory.

BRIDGE PROTOCOL: page↔extension messages use per-session random tokens and generic envelopes, indistinguishable from ordinary app messaging.

NETWORK STEALTH: cloud book/tablebase requests are proxied through the extension's background context where page anti-cheat cannot observe them.

CONSOLE HYGIENE: zero console output by default (sites can hook console methods). Debug logs are opt-in.`,
  },
  {
    id: "site-features",
    title: "Site-Specific Features",
    body: `Features that only activate on the site they target:

CHESS.COM — ANALYSIS UNLOCK: attempts to enable game review/analysis regardless of subscription status by intercepting the premium-gate in the page. Only appears on chess.com.

LICHESS — AUTO-QUEEN: always promotes to queen automatically, skipping the promotion dialog.

More site-specific modules can be added as Lua scripts that check bm.site.`,
  },
  {
    id: "detector",
    title: "Universal Board Detection",
    body: `Works on any chess website, not just the big two.

MULTI-STRATEGY SCAN: known web components (wc-chess-board, cg-board), 8×8 DOM grids with named squares, absolutely-positioned piece layers, and even canvas-only boards — each candidate is confidence-scored and the best wins.

FEN EXTRACTION: tries the site's own game API first, then FEN strings in the DOM, then reads piece positions directly off piece elements, and finally reconstructs the position from the move list (SAN) — so almost any board yields a live position.

SPA-AWARE: hooks history navigation and watches the DOM, so single-page-app navigation to a new game re-detects automatically.

ORIENTATION: detects whether you're playing White or Black from coordinate labels and flips all overlays accordingly.`,
  },
];
