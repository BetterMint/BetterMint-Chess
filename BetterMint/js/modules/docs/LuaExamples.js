export const LuaExamples = [
  {
    id: "hello-panel",
    name: "1. Hello Panel (start here)",
    site: null,
    blurb: "The smallest useful script: a draggable panel with a button, a toggle and a slider. Shows how UI controls hand values back to you.",
    code: `-- Your first BetterMint script.
-- Every control returns a handle with :get() and :set(v).

local panel = ui.panel("Hello BetterMint")

panel:heading("Where am I?")
panel:text("Site: " .. site.name())
panel:text("Version: " .. bm.version)

panel:separator()

local loud = panel:toggle("Announce moves", false, function(on)
  bm.notify(on and "Announcements ON" or "Announcements OFF")
end)

local depth = panel:slider("Analysis depth", 1, 30, settings.get("engine.depth"), function(v)
  settings.set("engine.depth", v)
end)

panel:button("Show best move", function()
  local best = engine.bestmove()
  if best then
    bm.notify("Best: " .. game.san(best.move) .. " (" .. best.engine .. ")")
  else
    bm.notify("No analysis yet")
  end
end)

events.on("move", function(m)
  if loud.get() then bm.notify("Played " .. m.san) end
end)

bm.log("hello-panel ready, depth slider at", depth.get())`,
  },

  {
    id: "threat-arrows",
    name: "2. Threat & Blunder Arrows",
    site: null,
    blurb: "Draws the engine's top three moves in fading colors and rings the piece that is about to be captured. Teaches board drawing plus the eval hook.",
    code: `-- Colour the top 3 engine moves, and warn on big eval drops.

local COLORS = { "#22c55e", "#eab308", "#f97316" }
local lastEval = nil

local function redraw()
  board.clear_arrows()
  local moves = engine.moves()
  for i = 1, math.min(3, #moves) do
    local m = moves[i]
    local from = string.sub(m.move, 1, 2)
    local to = string.sub(m.move, 3, 4)
    board.arrow(from, to, COLORS[i], tostring(i))
  end
end

engine.on_eval(function(e)
  redraw()
  if e.scoreCp == nil then return end
  if lastEval ~= nil then
    local drop = lastEval - e.scoreCp
    -- eval swung more than 1.5 pawns against the side to move
    if drop >= 150 then
      bm.notify("Eval dropped " .. string.format("%.1f", drop / 100) .. " - careful")
    end
  end
  lastEval = e.scoreCp
end)

events.on("fen", function()
  lastEval = nil
  board.clear()
end)

bm.log("threat-arrows running")`,
  },

  {
    id: "opening-trainer",
    name: "3. Opening Trainer (book vs engine)",
    site: null,
    blurb: "Compares your move against the opening book and tells you if you left theory. A practical example of book.lines() and the move event.",
    code: `-- Tells you when you leave opening theory.

local panel = ui.panel("Opening Trainer")
panel:heading("Book status")
local status = panel:text("waiting for a move...")
local strict = panel:toggle("Warn on any deviation", true)

local function bookMoves()
  local names = {}
  for _, line in ipairs(book.lines()) do
    names[line.san] = line.pct or 0
  end
  return names
end

local expected = bookMoves()

events.on("move", function(m)
  local pct = expected[m.san]
  if pct then
    bm.notify("Book move: " .. m.san .. " (" .. math.floor(pct) .. "%)")
  elseif strict.get() and game.stage() == "opening" then
    bm.notify("Out of book: " .. m.san)
  end
  expected = bookMoves()
end)

events.on("stage", function(s)
  bm.notify("Now in the " .. s.stage)
end)

bm.set_interval(function()
  local n = #book.lines()
  if n > 0 then
    bm.log("book lines available:", n)
  end
end, 5000)`,
  },

  {
    id: "chesscom-tidy",
    name: "4. Chess.com: Tidy Board",
    site: "chesscom",
    blurb: "Chess.com only. Hides ads and the chat box, and adds a one-click button to flip the board. Demonstrates the site.* DOM helpers.",
    code: `-- Chess.com only: declutter the play screen.
-- site.add_css survives SPA navigation, unlike inline styles.

site.add_css([[
  .ad-banner, [class*="ad-unit"], #board-layout-ad, .sidebar-ad { display: none !important; }
  .live-chat, .chat-board { opacity: 0.35; transition: opacity .2s; }
  .live-chat:hover, .chat-board:hover { opacity: 1; }
]])

local panel = ui.panel("Chess.com Tools")

panel:button("Flip board", function()
  site.click(".board-controls-flip, [data-cy='board-controls-flip']")
end)

panel:button("Copy FEN", function()
  bm.notify(game.fen())
  bm.log("FEN:", game.fen())
end)

panel:toggle("Dim the move list", false, function(on)
  site.css(".move-list-wrapper, wc-move-list", "opacity", on and "0.4" or "1")
end)

-- React to SPA navigation instead of assuming a fresh page load
site.on_url_change(function(url)
  bm.log("navigated to", url)
end)

bm.log("chesscom-tidy loaded")`,
  },

  {
    id: "lichess-clock",
    name: "5. Lichess: Clock & Cloud Eval",
    site: "lichess",
    blurb: "Lichess only. Reads both clocks from the DOM and pulls Lichess's own cloud evaluation over HTTP. Shows site.text() plus http.get().",
    code: `-- Lichess only: clock watch + free cloud eval lookups.

local panel = ui.panel("Lichess Helper")
panel:heading("Clocks")
local mine = panel:text("you: -")
local theirs = panel:text("opponent: -")

bm.set_interval(function()
  local nodes = site.query_all(".rclock .time")
  if #nodes >= 2 then
    theirs.set("opponent: " .. (site.text(".rclock-top .time") or "-"))
    mine.set("you: " .. (site.text(".rclock-bottom .time") or "-"))
  end
end, 1000)

panel:separator()
panel:heading("Cloud eval")

panel:button("Look up this position", function()
  local fen = game.fen()
  local url = "https://lichess.org/api/cloud-eval?fen=" .. fen:gsub(" ", "%%20") .. "&multiPv=3"
  http.get(url, function(body)
    if not body or body == "" then
      bm.notify("Position not in the cloud")
      return
    end
    bm.log("cloud eval:", body)
    bm.notify("Cloud eval received - see script log")
  end)
end)

events.on("newgame", function()
  bm.notify("New Lichess game")
end)`,
  },

  {
    id: "auto-safety",
    name: "6. Auto-Play Safety Net",
    site: null,
    blurb: "A guard script: pauses auto-move when the eval says you are winning easily, and stops it entirely in the endgame. Shows reading and writing settings live.",
    code: `-- Keeps auto-play from running up an absurd score.

local panel = ui.panel("Auto Safety")
local guard = panel:toggle("Enable guard", true)
local cap = panel:slider("Pause above (pawns)", 1, 15, 6)
local wasOn = settings.get("auto.enabled")

local function setAuto(on)
  if settings.get("auto.enabled") ~= on then
    settings.set("auto.enabled", on)
    bm.notify(on and "Auto-play resumed" or "Auto-play paused")
  end
end

engine.on_eval(function(e)
  if not guard.get() then return end
  if e.scoreMate ~= nil then
    setAuto(false)
    return
  end
  if e.scoreCp == nil then return end
  local pawns = e.scoreCp / 100
  if pawns >= cap.get() then
    setAuto(false)
  elseif wasOn then
    setAuto(true)
  end
end)

events.on("stage", function(s)
  if guard.get() and s.stage == "endgame" then
    setAuto(false)
    bm.notify("Endgame reached - auto-play off")
  end
end)

panel:button("Re-arm", function()
  wasOn = true
  setAuto(true)
end)`,
  },
];

export function exampleById(id) {
  return LuaExamples.find((e) => e.id === id) || null;
}
