"""End to end check that a running EngineWS answers the way the extension expects.

Start the server first, then run:  python smoke_test.py
"""
import asyncio
import json
import os
import sys
import urllib.parse

import websockets


def _ws_url() -> str:
    """Read the token straight out of config.json so the test needs no setup."""
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        with open(os.path.join(here, "config.json"), encoding="utf-8") as f:
            server = json.load(f).get("server", {})
    except OSError:
        server = {}
    host = server.get("host", "127.0.0.1")
    port = server.get("port", 8000)
    token = server.get("token") if server.get("require_token", True) else None
    suffix = f"?token={urllib.parse.quote(token)}" if token else ""
    return f"ws://{host}:{port}/ws{suffix}"


WS_URL = _ws_url()
START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
ITALIAN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
# king and pawn against king, well inside tablebase range
ENDGAME = "8/8/4k3/8/8/4K3/4P3/8 w - - 0 1"


async def main() -> int:
    failures = []
    async with websockets.connect(WS_URL) as ws:
        hello = json.loads(await ws.recv())
        engines = [e["name"] for e in hello.get("engines", []) if e.get("enabled")]
        print(f"connected, {len(engines)} enabled engine(s): {', '.join(engines) or 'none'}")
        if not engines:
            failures.append("no enabled engines")

        await ws.send(json.dumps({"action": "book_query", "fen": START, "request_id": "b"}))
        await ws.send(json.dumps({"action": "tablebase_probe", "fen": ENDGAME, "request_id": "t"}))
        await ws.send(json.dumps({"action": "analyze", "fen": ITALIAN, "depth": 12}))

        best, book_results, tb_result = {}, None, None
        loop = asyncio.get_event_loop()
        deadline = loop.time() + 40
        while loop.time() < deadline:
            if len(best) >= len(engines) and book_results is not None and tb_result is not None:
                break
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            except asyncio.TimeoutError:
                continue
            kind = msg.get("type")
            if kind == "book_result":
                book_results = msg.get("results", [])
            elif kind == "tablebase_result":
                tb_result = msg
            elif kind == "bestmove" and msg.get("engine"):
                best[msg["engine"]] = msg.get("move")

    print("\nbooks")
    if not book_results:
        failures.append("no book results for the start position")
        print("  none")
    for entry in book_results or []:
        moves = entry["moves"][:3]
        preview = ", ".join(f"{m['move']} {m['pct']}%" for m in moves)
        print(f"  {entry['book']:<10} {len(entry['moves']):>3} moves   {preview}")

    print("\ntablebase")
    results = (tb_result or {}).get("results") or []
    if results:
        for entry in results:
            top = entry["moves"][0]
            print(f"  {entry['tablebase']:<10} {len(entry['moves'])} moves, best {top['move']} wdl={top['wdl']}")
    else:
        reason = (tb_result or {}).get("error", "no local tablebase configured")
        print(f"  none ({reason})")

    print("\nengines")
    for name in engines:
        move = best.get(name)
        if not move:
            failures.append(f"{name} returned no bestmove")
        print(f"  {name:<11} {move or 'NO ANSWER'}")

    print()
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
