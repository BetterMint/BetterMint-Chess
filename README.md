<div align="center">

# BetterMint

**A universal chess analysis companion — multi-engine, book-aware, tablebase-backed, and undetectable by design.**

  <a href="https://github.com/BetterMint/BetterMint-Chess/releases"><img alt="Download BetterMint" src="https://img.shields.io/github/downloads/BetterMint/BetterMint/total?color=%2331c754&label=Downloads"></a>

[![Discord](https://img.shields.io/badge/Discord-Join%20the%20server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/bettermint)
[![Version](https://img.shields.io/badge/version-3.0.0-7a5cff?style=for-the-badge)](#)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4ade80?style=for-the-badge&logo=googlechrome&logoColor=white)](#)

</div>

---

## What it is

BetterMint runs real chess engines next to any chess site and shows you what they think — ranked moves, arrows on the board, an evaluation bar, opening-book lines and endgame tablebase results. Eight engines are bundled and run **inside your browser**, so the basic setup needs no install, no server and no downloads.

If you want desktop-grade strength, the optional **EngineWS** companion runs native UCI engines (Stockfish, Lc0, Torch, anything UCI) on your machine and streams their analysis back.

Everything is optional, everything is configurable, and nothing is hardcoded.

---

## Features

### Engines
- **Eight built-in WebAssembly engines**, no install required — Stockfish 18, Stockfish 18 NNUE, Torch 1, Torch 2, Stockfish 16 NNUE, Stockfish 16 (no SIMD), Stockfish Classic and an Explanation Engine.
- **Run several at once.** A priority order decides which engine supplies the #1, #2 and #3 move, so you can blend a tactical engine with a positional one.
- **EngineWS companion** for native desktop engines, with one-click downloads of the latest releases.
- **Socket engines** — Maia, Rodent personalities, Patricia, Fairy-Stockfish and every historical Stockfish version, over a raw-UCI WebSocket. No downloads.
- **Per-engine UCI options** are discovered automatically and exposed in the UI.

### Opening books and tablebases
- **Stage-aware knowledge.** BetterMint knows whether you are in the opening, middlegame or endgame and asks the right source for each.
- **Polyglot `.bin` books** load directly in the browser and are binary-searched instantly. Assign each book to a stage.
- **Larger books from disk** through EngineWS, plus **Syzygy** and **Gaviota** tablebases.
- **Online 7-piece tablebase fallback** that works with no setup at all, routed through the extension so the site never sees the request.
- Book moves render as dashed amber arrows with real win/draw/loss statistics.

### Playing like a person
- **Humanizer** — think time drawn from a bell curve, longer pauses at critical moments, faster play in time pressure, instant replies in known opening theory.
- **A visible move distribution.** Set the chance of the 2nd best, 3rd best and deeper moves, plus deliberate blunders with a cooldown, and see exactly what percentage the best move ends up with.
- **Elo Match Skill** scales strength, timing and mistake rate toward a target rating.
- **Auto move**, premoves and auto queue.
- **Hand & Brain** mode.

### Understanding the game
- **Coach mode** grades every move you play and explains why, using the familiar taxonomy — Brilliant, Great Find, Best, Excellent, Good, Book, Forced, Inaccuracy, Mistake, Missed Win, Blunder.
- **Text-to-speech** for moves and coaching, with an option to speak only mistakes.
- **In-game HUD** with an evaluation bar, ranked move list, depth readout and game-stage badge.
- **Stream-proof window** — a separate always-on-top window carrying the board, evaluation, engine lines and book lines, so nothing appears on the captured tab.

### Extending it
- **Lua scripting** with a documented API, worked examples and a built-in editor.
- **Variants and Chess960** support.
- **Automatic board detection** — it finds the board on chess sites it has never seen before.

---

## Installing

### The extension

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `BetterMint` folder.
4. Open any chess site. The HUD appears on its own.

That is the whole setup. The eight built-in engines work immediately.

### EngineWS (optional)

Only needed for native desktop engines, disk-based books and local tablebases.

**Requirements:** Python 3.10 or newer.

```bash
cd EngineWS
pip install -r requirements.txt
python main.py
```

Windows users can just double-click `run.bat`.

On first run EngineWS creates its own `config.json` and prints something like:

```
==============================================================
  BetterMint EngineWS v2.0
  Dashboard: http://127.0.0.1:8000
  Paste this into the extension's EngineWS address setting:
  ws://127.0.0.1:8000/ws?token=XXXXXXXXXXXXXXXXXXXXXXXX
==============================================================
```

Copy that whole `ws://` line into **Settings → Engine → EngineWS URL** in the extension.

> **Why a token?** WebSockets are not covered by the browser's same-origin policy, so without one *any* page you happened to be visiting could connect to your local server and list your engines. The token closes that. Set `"require_token": false` in `config.json` if you would rather turn it off.

Open <http://127.0.0.1:8000> for the dashboard: engine status, priority order, one-click engine downloads and book management.

---

## Using it

| What you want | Where to go |
| --- | --- |
| Turn features on and off quickly | **Dashboard → Quick Toggles** |
| Depth, MultiPV, threads, which engines run | **Settings → Engine** |
| Think time, blunder rate, move distribution | **Settings → Humanization** |
| Auto move, premoves, which rank gets played | **Settings → Auto Move** |
| Move grading and spoken feedback | **Settings → Coach Mode** |
| Upload books, assign game stages | **Books & TB** |
| Maia and other hosted engines | **Sockets** |
| Custom scripts | **Lua Scripting** |
| Full explanation of every feature | **Docs** |

**A tip worth knowing:** MultiPV controls how many distinct lines the engines report, and that is what feeds the arrows, the ranked list and the humanizer's choice of move. If MultiPV is 1 there is only ever one move to choose from, so the humanizer cannot vary anything.

---

## Verifying EngineWS

A smoke test ships with the server. Start EngineWS, then:

```bash
cd EngineWS
python smoke_test.py
```

It reports every enabled engine's best move, every book that answered, and any tablebase hit — so you can tell at a glance whether a book is actually loading or an engine is silently failing.

---

## Notes

- **Book files must be polyglot `.bin`.** ChessBase CTG cannot be read; convert it first.
- **Simulated mouse input is off by default and should stay off.** Synthetic events carry `isTrusted=false` and can be detected. The site-API path is the safe one.
- Engines run in isolated workers in an extension-origin frame, so a site's Content-Security-Policy cannot block them and the page cannot see them.

---

## Credits

This project is a collaborative effort made possible by:

- **[thedemons](https://github.com/thedemons)** — Original creator
- **[ProtonDev](https://github.com/ProtonDev-sys)** — API docs & public API host
- **BetterMint** — Development and maintenance

---

## License

See [LICENSE](LICENSE).

<div align="center">

**[Join the Discord](https://discord.gg/bettermint)**

*v3.0.0 · undetectable by design*

</div>
