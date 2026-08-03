export const LuaApiDocs = [
  {
    group: "bm",
    desc: "Core utilities",
    fns: [
      { sig: "bm.version", doc: "BetterMint version string." },
      { sig: "bm.site", doc: "Current site: 'chesscom', 'lichess', or 'generic'." },
      { sig: "bm.log(...)", doc: "Log to the script console (enable debug logging to see)." },
      { sig: "bm.notify(text)", doc: "Show a toast notification." },
      { sig: "bm.set_timeout(fn, ms)", doc: "Run fn once after ms. Returns timer id." },
      { sig: "bm.set_interval(fn, ms)", doc: "Run fn repeatedly every ms. Returns timer id." },
      { sig: "bm.clear(id)", doc: "Cancel a timer." },
    ],
  },
  {
    group: "settings",
    desc: "Read and write BetterMint settings",
    fns: [
      { sig: "settings.get(key)", doc: "Read a setting value, e.g. settings.get('engine.depth')." },
      { sig: "settings.set(key, value)", doc: "Write a setting and persist it." },
      { sig: "settings.all()", doc: "Table of all settings." },
    ],
  },
  {
    group: "game",
    desc: "Live game state",
    fns: [
      { sig: "game.fen()", doc: "Current position FEN." },
      { sig: "game.stage()", doc: "'opening', 'middlegame', or 'endgame'." },
      { sig: "game.turn()", doc: "'w' or 'b'." },
      { sig: "game.moves()", doc: "Array of played moves in SAN." },
      { sig: "game.move_number()", doc: "Current full-move number." },
      { sig: "game.piece_at(sq)", doc: "Piece on square, e.g. 'wn', 'bk', or nil. sq like 'e4'." },
      { sig: "game.is_my_turn()", doc: "True when it is your turn." },
      { sig: "game.play(uci)", doc: "Play a move, e.g. game.play('e2e4')." },
      { sig: "game.san(uci)", doc: "Convert UCI to SAN in the current position." },
    ],
  },
  {
    group: "engine",
    desc: "Control engines and read analysis",
    fns: [
      { sig: "engine.analyze(fen?, depth?)", doc: "Start analysis of a position (defaults to current)." },
      { sig: "engine.stop()", doc: "Stop all engines." },
      { sig: "engine.moves()", doc: "Ranked move list: {move, rank, engine, score}." },
      { sig: "engine.bestmove()", doc: "Top ranked move {move, engine, score} or nil." },
      { sig: "engine.list()", doc: "All engines with status." },
      { sig: "engine.set_priority(order)", doc: "Set priority order, e.g. {'stockfish','built-in'}." },
      { sig: "engine.set_skill(name, level)", doc: "Set Skill Level 0-20 on an engine." },
      { sig: "engine.set_elo(name, elo)", doc: "Cap engine strength via UCI_Elo." },
      { sig: "engine.set_depth(d)", doc: "Set analysis depth." },
      { sig: "engine.on_bestmove(fn)", doc: "Called with {move, engine, rank} on each bestmove." },
      { sig: "engine.on_eval(fn)", doc: "Called with eval updates {engine, depth, scoreCp, scoreMate}." },
    ],
  },
  {
    group: "book",
    desc: "Opening books and tablebases",
    fns: [
      { sig: "book.lines()", doc: "Current book lines {move, san, pct, source, book}." },
      { sig: "book.stage()", doc: "Current game stage." },
      { sig: "book.pick()", doc: "Pick a book move (respects weighting) or nil." },
    ],
  },
  {
    group: "board",
    desc: "Draw on the board overlay",
    fns: [
      { sig: "board.arrow(from, to, color?, label?)", doc: "Draw an arrow, e.g. board.arrow('e2','e4','#ff0000','!')." },
      { sig: "board.clear_arrows()", doc: "Remove all arrows." },
      { sig: "board.highlight(sq, color?)", doc: "Fill a square with a translucent color." },
      { sig: "board.ring(sq, color?)", doc: "Draw a ring border on a square." },
      { sig: "board.clear()", doc: "Clear all drawings." },
      { sig: "board.flipped(v)", doc: "Force board orientation." },
    ],
  },
  {
    group: "ui",
    desc: "Build custom UI panels",
    fns: [
      { sig: "ui.panel(title)", doc: "Create a draggable panel. Returns panel handle." },
      { sig: "panel:heading(text)", doc: "Add a section heading." },
      { sig: "panel:text(text)", doc: "Add text." },
      { sig: "panel:button(text, fn)", doc: "Add a button that runs fn on click." },
      { sig: "panel:toggle(label, default, fn)", doc: "Add a switch. Returns {get(), set(v)}." },
      { sig: "panel:slider(label, min, max, default, fn)", doc: "Add a slider. Returns {get(), set(v)}." },
      { sig: "panel:input(label, default, fn)", doc: "Add a text input. Returns {get(), set(v)}." },
      { sig: "panel:dropdown(label, options, default, fn)", doc: "Add a dropdown. Returns {get(), set(v)}." },
      { sig: "panel:color(label, default, fn)", doc: "Add a color picker. Returns {get(), set(v)}." },
      { sig: "panel:separator()", doc: "Add a divider line." },
      { sig: "panel:destroy()", doc: "Remove the panel." },
      { sig: "ui.notify(text)", doc: "Toast notification." },
    ],
  },
  {
    group: "site",
    desc: "Manipulate the website itself",
    fns: [
      { sig: "site.name()", doc: "Current site kind." },
      { sig: "site.query(sel)", doc: "First element matching CSS selector (or nil)." },
      { sig: "site.query_all(sel)", doc: "Array of matching elements." },
      { sig: "site.click(sel)", doc: "Click an element." },
      { sig: "site.text(sel) / site.set_text(sel, t)", doc: "Read or set element text." },
      { sig: "site.html(sel) / site.set_html(sel, h)", doc: "Read or set inner HTML." },
      { sig: "site.attr(sel, name) / site.set_attr(sel, name, v)", doc: "Read or set attributes." },
      { sig: "site.css(sel, prop, value)", doc: "Set an inline style property." },
      { sig: "site.add_css(css)", doc: "Inject a stylesheet into the page." },
      { sig: "site.remove(sel)", doc: "Remove an element from the page." },
      { sig: "site.on_appear(sel, fn)", doc: "Run fn whenever a matching element appears." },
      { sig: "site.on_url_change(fn)", doc: "Run fn on SPA navigation: fn(newUrl, oldUrl)." },
    ],
  },
  {
    group: "events",
    desc: "React to BetterMint events",
    fns: [
      { sig: "events.on('move', fn)", doc: "A move was played: fn({move, san})." },
      { sig: "events.on('newgame', fn)", doc: "A new game started." },
      { sig: "events.on('gameover', fn)", doc: "Game ended: fn(result)." },
      { sig: "events.on('fen', fn)", doc: "Position changed: fn({fen})." },
      { sig: "events.on('stage', fn)", doc: "Game stage changed: fn({stage})." },
      { sig: "events.on('boardfound', fn)", doc: "A board was detected: fn({host})." },
    ],
  },
  {
    group: "storage",
    desc: "Per-script persistent storage (session)",
    fns: [
      { sig: "storage.get(key, default?)", doc: "Read a stored value." },
      { sig: "storage.set(key, value)", doc: "Store a value." },
    ],
  },
  {
    group: "http",
    desc: "Network access",
    fns: [
      { sig: "http.get(url, fn)", doc: "Fetch a URL (async). fn(body) receives the response text. Routed via the extension when possible." },
    ],
  },
];

export const LuaExampleScript = `-- BetterMint example script
local p = ui.panel("My Script")
p:heading("Engine control")
p:text("Best move on demand")

p:button("Analyze", function()
  engine.analyze(game.fen(), 20)
  bm.notify("Analyzing at depth 20")
end)

local tgl = p:toggle("Auto depth 25", false, function(on)
  if on then engine.set_depth(25) end
end)

events.on("fen", function(e)
  local best = engine.bestmove()
  if best then
    board.arrow(best.move:sub(1,2), best.move:sub(3,4), "#ff00ff", "L")
  end
end)

bm.log("script loaded on", bm.site)
`;
