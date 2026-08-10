const CATS = {
  events: { label: "Events", color: "#f7b731" },
  control: { label: "Control", color: "#ff8c42" },
  actions: { label: "Actions", color: "#4ade80" },
  board: { label: "Board", color: "#38bdf8" },
  values: { label: "Values", color: "#b9a8ff" },
  logic: { label: "Logic", color: "#f472b6" },
  vars: { label: "Variables", color: "#fb7185" },
};

const luaStr = (v) => JSON.stringify(String(v ?? ""));
const luaNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "0";
};

export const BLOCK_DEFS = {
  ev_start: {
    cat: "events", kind: "hat", label: "when script starts",
    code: (c) => c.body(),
  },
  ev_move: {
    cat: "events", kind: "hat", label: "when a move is played",
    code: (c) => `events.on("move", function(m)\n  local ev_move = m and m.move\n  local ev_san = m and m.san\n${c.body()}\nend)`,
  },
  ev_newgame: {
    cat: "events", kind: "hat", label: "when a new game starts",
    code: (c) => `events.on("newgame", function()\n${c.body()}\nend)`,
  },
  ev_gameover: {
    cat: "events", kind: "hat", label: "when the game ends",
    code: (c) => `events.on("gameover", function(g)\n  local ev_result = g and g.result\n  local ev_reason = g and g.reason\n${c.body()}\nend)`,
  },
  ev_fen: {
    cat: "events", kind: "hat", label: "when the position changes",
    code: (c) => `events.on("fen", function(f)\n  local ev_fen = f and f.fen\n${c.body()}\nend)`,
  },
  ev_stage: {
    cat: "events", kind: "hat", label: "when the game stage changes",
    code: (c) => `events.on("stage", function(s)\n  local ev_stage = s and s.stage\n${c.body()}\nend)`,
  },
  ev_boardfound: {
    cat: "events", kind: "hat", label: "when a board is found",
    code: (c) => `events.on("boardfound", function(b)\n  local ev_host = b and b.host\n${c.body()}\nend)`,
  },
  ev_bestmove: {
    cat: "events", kind: "hat", label: "when an engine reports a move",
    code: (c) => `engine.on_bestmove(function(e)\n  local ev_move = e and e.move\n  local ev_engine = e and e.engine\n  local ev_rank = e and e.rank\n${c.body()}\nend)`,
  },
  ev_every: {
    cat: "events", kind: "hat", label: "every",
    fields: [{ name: "ms", hint: "number", def: 1000, label: "ms" }],
    code: (c) => `bm.set_interval(function()\n${c.body()}\nend, ${luaNum(c.field("ms"))})`,
  },

  ctl_if: {
    cat: "control", kind: "cblock", label: "if",
    inputs: [{ name: "cond", label: "condition", hint: "any" }],
    hasElse: true,
    code: (c) => {
      const b = c.body();
      const e = c.elseBody();
      let out = `if ${c.input("cond")} then`;
      out += b ? `\n${b}` : "";
      if (e) out += `\nelse\n${e}`;
      return out + `\nend`;
    },
  },
  ctl_repeat: {
    cat: "control", kind: "cblock", label: "repeat",
    fields: [{ name: "n", hint: "number", def: 3, label: "times" }],
    code: (c) => `for _i = 1, ${luaNum(c.field("n"))} do\n${c.body()}\nend`,
  },
  ctl_after: {
    cat: "control", kind: "cblock", label: "after",
    fields: [{ name: "ms", hint: "number", def: 1000, label: "ms" }],
    code: (c) => `bm.set_timeout(function()\n${c.body()}\nend, ${luaNum(c.field("ms"))})`,
  },

  act_notify: {
    cat: "actions", kind: "stmt", label: "notify",
    inputs: [{ name: "text", label: "text", hint: "text", def: "Hello!" }],
    code: (c) => `bm.notify(tostring(${c.input("text")}))`,
  },
  act_log: {
    cat: "actions", kind: "stmt", label: "log",
    inputs: [{ name: "text", label: "text", hint: "text", def: "debug" }],
    code: (c) => `bm.log(tostring(${c.input("text")}))`,
  },
  act_speak: {
    cat: "actions", kind: "stmt", label: "speak",
    inputs: [{ name: "text", label: "text", hint: "text", def: "your move" }],
    code: (c) => `bm.speak(tostring(${c.input("text")}))`,
  },
  act_play: {
    cat: "actions", kind: "stmt", label: "play move",
    inputs: [{ name: "uci", label: "uci", hint: "text", def: "e2e4" }],
    code: (c) => `do local _uci = ${c.input("uci")}\n  if _uci ~= nil then game.play(tostring(_uci)) end\nend`,
  },
  act_arrow: {
    cat: "board", kind: "stmt", label: "draw arrow",
    inputs: [
      { name: "from", label: "from", hint: "text", def: "e2" },
      { name: "to", label: "to", hint: "text", def: "e4" },
    ],
    fields: [{ name: "color", hint: "color", def: "#4ade80", label: "color" }],
    code: (c) => `board.arrow(tostring(${c.input("from")}), tostring(${c.input("to")}), ${luaStr(c.field("color"))})`,
  },
  act_clear_arrows: {
    cat: "board", kind: "stmt", label: "clear arrows",
    code: () => `board.clear_arrows()`,
  },
  act_highlight: {
    cat: "board", kind: "stmt", label: "highlight square",
    inputs: [{ name: "sq", label: "square", hint: "text", def: "e4" }],
    fields: [{ name: "color", hint: "color", def: "#4ade80", label: "color" }],
    code: (c) => `board.highlight(tostring(${c.input("sq")}), ${luaStr(c.field("color"))})`,
  },
  act_clear_highlights: {
    cat: "board", kind: "stmt", label: "clear highlights",
    code: () => `board.clear_highlights()`,
  },
  act_set_setting: {
    cat: "actions", kind: "stmt", label: "set setting",
    fields: [{ name: "key", hint: "text", def: "auto.enabled", label: "key" }],
    inputs: [{ name: "value", label: "value", hint: "any", def: "" }],
    code: (c) => `settings.set(${luaStr(c.field("key"))}, ${c.input("value")})`,
  },
  act_analyze: {
    cat: "actions", kind: "stmt", label: "analyze at depth",
    fields: [{ name: "depth", hint: "number", def: 18, label: "depth" }],
    code: (c) => `engine.analyze(nil, ${luaNum(c.field("depth"))})`,
  },
  act_stop_engines: {
    cat: "actions", kind: "stmt", label: "stop all engines",
    code: () => `engine.stop()`,
  },
  act_set_var: {
    cat: "vars", kind: "stmt", label: "set variable",
    fields: [{ name: "name", hint: "text", def: "score", label: "name" }],
    inputs: [{ name: "value", label: "value", hint: "any", def: "0" }],
    code: (c) => `_v[${luaStr(c.field("name"))}] = ${c.input("value")}`,
  },
  act_change_var: {
    cat: "vars", kind: "stmt", label: "change variable",
    fields: [{ name: "name", hint: "text", def: "score", label: "name" }],
    inputs: [{ name: "delta", label: "by", hint: "number", def: "1" }],
    code: (c) => {
      const k = luaStr(c.field("name"));
      return `_v[${k}] = (_v[${k}] or 0) + ${c.input("delta")}`;
    },
  },
  act_comment: {
    cat: "control", kind: "stmt", label: "note",
    fields: [{ name: "text", hint: "text", def: "my note", label: "" }],
    code: (c) => `-- ${String(c.field("text")).replace(/\n/g, " ")}`,
  },

  val_text: {
    cat: "values", kind: "value", label: "text",
    fields: [{ name: "v", hint: "text", def: "hello", label: "" }],
    expr: (c) => luaStr(c.field("v")),
  },
  val_number: {
    cat: "values", kind: "value", label: "number",
    fields: [{ name: "v", hint: "number", def: 1, label: "" }],
    expr: (c) => luaNum(c.field("v")),
  },
  val_bool: {
    cat: "values", kind: "value", label: "",
    fields: [{ name: "v", hint: "select", def: "true", label: "", options: [{ v: "true", l: "true" }, { v: "false", l: "false" }] }],
    expr: (c) => (String(c.field("v")) === "false" ? "false" : "true"),
  },
  val_join: {
    cat: "values", kind: "value", label: "join",
    inputs: [
      { name: "a", label: "a", hint: "any", def: "" },
      { name: "b", label: "b", hint: "any", def: "" },
    ],
    expr: (c) => `(tostring(${c.input("a")}) .. tostring(${c.input("b")}))`,
  },
  val_compare: {
    cat: "logic", kind: "value", label: "compare",
    inputs: [
      { name: "a", label: "a", hint: "any", def: "" },
      { name: "b", label: "b", hint: "any", def: "" },
    ],
    fields: [{ name: "op", hint: "select", def: "==", label: "", options: [
      { v: "==", l: "=" }, { v: "~=", l: "≠" }, { v: "<", l: "<" }, { v: ">", l: ">" }, { v: "<=", l: "≤" }, { v: ">=", l: "≥" },
    ] }],
    expr: (c) => `(${c.input("a")} ${c.field("op")} ${c.input("b")})`,
  },
  val_logic: {
    cat: "logic", kind: "value", label: "",
    inputs: [
      { name: "a", label: "a", hint: "any", def: "" },
      { name: "b", label: "b", hint: "any", def: "" },
    ],
    fields: [{ name: "op", hint: "select", def: "and", label: "", options: [{ v: "and", l: "and" }, { v: "or", l: "or" }] }],
    expr: (c) => `(${c.input("a")} ${c.field("op")} ${c.input("b")})`,
  },
  val_not: {
    cat: "logic", kind: "value", label: "not",
    inputs: [{ name: "a", label: "", hint: "any", def: "" }],
    expr: (c) => `(not ${c.input("a")})`,
  },
  val_var: {
    cat: "vars", kind: "value", label: "variable",
    fields: [{ name: "name", hint: "text", def: "score", label: "" }],
    expr: (c) => `_v[${luaStr(c.field("name"))}]`,
  },
  val_fen: { cat: "values", kind: "value", label: "current position (FEN)", expr: () => `game.fen()` },
  val_turn: { cat: "values", kind: "value", label: "side to move", expr: () => `game.turn()` },
  val_my_turn: { cat: "values", kind: "value", label: "is it my turn?", expr: () => `game.is_my_turn()` },
  val_in_check: { cat: "values", kind: "value", label: "am I in check?", expr: () => `game.in_check()` },
  val_checkmate: { cat: "values", kind: "value", label: "is checkmate?", expr: () => `game.is_checkmate()` },
  val_stalemate: { cat: "values", kind: "value", label: "is stalemate?", expr: () => `game.is_stalemate()` },
  val_draw: { cat: "values", kind: "value", label: "is a draw?", expr: () => `game.is_draw()` },
  val_gameover: { cat: "values", kind: "value", label: "is the game over?", expr: () => `(game.result() ~= nil)` },
  val_result: { cat: "values", kind: "value", label: "game result", expr: () => `game.result()` },
  val_move_count: { cat: "values", kind: "value", label: "moves played", expr: () => `game.move_count()` },
  val_stage: { cat: "values", kind: "value", label: "game stage", expr: () => `game.stage()` },
  val_bestmove: { cat: "values", kind: "value", label: "engine best move (uci)", expr: () => `((function() local ok, b = pcall(engine.bestmove); if ok and b then return b.move end; return nil end)())` },
  val_setting: {
    cat: "values", kind: "value", label: "get setting",
    fields: [{ name: "key", hint: "text", def: "auto.enabled", label: "" }],
    expr: (c) => `settings.get(${luaStr(c.field("key"))})`,
  },
  val_storage: {
    cat: "vars", kind: "value", label: "stored value",
    fields: [{ name: "key", hint: "text", def: "mykey", label: "" }],
    expr: (c) => `storage.get(${luaStr(c.field("key"))}, nil)`,
  },
  val_random: {
    cat: "values", kind: "value", label: "random 1 to",
    fields: [{ name: "n", hint: "number", def: 10, label: "" }],
    expr: (c) => `math.random(1, ${luaNum(c.field("n"))})`,
  },
  val_event: {
    cat: "values", kind: "value", label: "event:",
    fields: [{ name: "which", hint: "select", def: "move", label: "", options: [
      { v: "move", l: "move (uci)" }, { v: "san", l: "move (san)" }, { v: "result", l: "result" },
      { v: "reason", l: "end reason" }, { v: "stage", l: "stage" }, { v: "fen", l: "fen" },
      { v: "engine", l: "engine name" }, { v: "rank", l: "engine rank" }, { v: "host", l: "site" },
    ] }],
    expr: (c) => `ev_${c.field("which")}`,
  },
};

export const BLOCK_CATEGORIES = CATS;

export function blockDef(type) {
  return BLOCK_DEFS[type] || null;
}
