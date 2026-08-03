import asyncio
import json
import os
import secrets
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from engine_manager import EngineManager
from downloader import download_engine, list_known_engines
from book_service import BookService

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
DEFAULT_CONFIG_PATH = os.path.join(BASE_DIR, "config.default.json")
ENGINES_DIR = os.path.join(BASE_DIR, "engines")


# Paths in the config are written relative to this folder, but the process can
# be started from anywhere, and a relative path is resolved against the working
# directory. Anchoring them here means launching from another folder does not
# silently leave every engine and book "not found".
def resolve_path(path: str) -> str:
    if not path or os.path.isabs(path):
        return path
    return os.path.normpath(os.path.join(BASE_DIR, path))


def portable_path(path: str) -> str:
    """Undo resolve_path when writing the config back out.

    Saving the absolute form would bake this machine's folder layout into a
    file that ships with the app, so anything living under the app folder is
    stored relative to it again.
    """
    if not path:
        return path
    try:
        inside = os.path.commonpath([os.path.abspath(path), BASE_DIR]) == BASE_DIR
    except ValueError:
        return path
    if not inside:
        return path
    return os.path.relpath(path, BASE_DIR).replace(os.sep, "/")


def load_config() -> dict:
    # config.json is per-install: it ends up holding this machine's access token
    # and whatever engines the user enabled, so the repository ships the
    # defaults separately and the real file is created from them on first run.
    if not os.path.isfile(CONFIG_PATH) and os.path.isfile(DEFAULT_CONFIG_PATH):
        shutil.copyfile(DEFAULT_CONFIG_PATH, CONFIG_PATH)
        print("[EngineWS] created config.json from config.default.json")
    if os.path.isfile(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        for section in ("engines", "books", "tablebases"):
            for item in cfg.get(section, []) or []:
                if isinstance(item, dict) and item.get("path"):
                    item["path"] = resolve_path(item["path"])
        return cfg
    return {
        "server": {"host": "127.0.0.1", "port": 8000, "max_clients": 8},
        "engines": [],
        "books": [],
        "tablebases": [],
    }


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


CONFIG = load_config()


# A WebSocket is not subject to the same-origin policy, so without this any
# page you happen to be visiting could open ws://127.0.0.1:8000/ws, read back
# the engine list and know exactly what is running. The token turns that from
# a give-away into a closed door.
def _ensure_token() -> str:
    server = CONFIG.setdefault("server", {})
    if not server.get("require_token", True):
        return ""
    token = server.get("token")
    if not token:
        token = secrets.token_urlsafe(24)
        server["token"] = token
        save_config(CONFIG)
        print("[EngineWS] generated a new access token")
    return token


TOKEN = _ensure_token()


def _token_ok(supplied: str | None) -> bool:
    if not TOKEN:
        return True
    return bool(supplied) and secrets.compare_digest(supplied, TOKEN)


clients: set[WebSocket] = set()


# The dashboard cannot count the other connections for itself, so the number is
# pushed whenever it changes rather than left at whatever the page was built
# with.
async def broadcast_clients():
    payload = json.dumps({"type": "clients", "count": len(clients)})
    for ws in list(clients):
        try:
            await ws.send_text(payload)
        except Exception:
            clients.discard(ws)


async def broadcast(engine_name: str, line: str | None, extra: dict | None = None):
    if extra is not None:
        msg = {"engine": engine_name, **extra}
    else:
        msg = {"type": "raw", "engine": engine_name, "line": line}
        parsed = parse_uci_line(line)
        if parsed:
            msg.update(parsed)
    dead = []
    for ws in list(clients):
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)


def parse_uci_line(line: str) -> dict | None:
    if line.startswith("info "):
        parts = line.split()
        out = {"type": "info", "parsed": {}}
        p = out["parsed"]
        i = 1
        while i < len(parts):
            t = parts[i]
            if t == "depth":
                p["depth"] = int(parts[i + 1]); i += 2
            elif t == "seldepth":
                p["seldepth"] = int(parts[i + 1]); i += 2
            elif t == "multipv":
                p["multipv"] = int(parts[i + 1]); i += 2
            elif t == "score":
                if parts[i + 1] == "cp":
                    p["score_cp"] = int(parts[i + 2]); i += 3
                elif parts[i + 1] == "mate":
                    p["score_mate"] = int(parts[i + 2]); i += 3
                else:
                    i += 1
            elif t == "nodes":
                p["nodes"] = int(parts[i + 1]); i += 2
            elif t == "nps":
                p["nps"] = int(parts[i + 1]); i += 2
            elif t == "time":
                p["time"] = int(parts[i + 1]); i += 2
            elif t == "pv":
                p["pv"] = parts[i + 1:]
                break
            else:
                i += 1
        return out
    if line.startswith("bestmove"):
        parts = line.split()
        return {
            "type": "bestmove",
            "move": parts[1] if len(parts) > 1 else None,
            "ponder": parts[3] if len(parts) > 3 else None,
        }
    if line in ("readyok", "uciok"):
        return {"type": line}
    return None


manager: EngineManager = None
books: BookService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global manager, books
    manager = EngineManager(broadcast)
    manager.load_from_config(CONFIG.get("engines", []))
    books = BookService()
    books.load_config(CONFIG)
    if manager.engines:
        await manager.start_all()
        live = sum(1 for e in manager.engines.values() if e.alive)
        configured = len(manager.engines)
        print(f"[EngineWS] {live} of {configured} configured engine(s) running")
        for eng in manager.all_by_priority():
            if eng.config.enabled and not eng.alive:
                print(f"[EngineWS]   {eng.config.name}: failed to start from {eng.config.path}")
    else:
        print("[EngineWS] no engines configured - add one via dashboard or config.json")
    book_count = len(books.books)
    tb_count = len(books.tablebases)
    print(f"[EngineWS] loaded {book_count} book(s), {tb_count} tablebase set(s)")
    yield
    if manager:
        await manager.stop_all()


app = FastAPI(title="BetterMint EngineWS", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # nothing here is cookie authenticated, and a wildcard origin combined with
    # credentials is rejected by browsers anyway
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    if not _token_ok(ws.query_params.get("token")):
        # refused before accept, so an unauthorised page learns nothing beyond
        # the fact that something declined it
        await ws.close(code=1008, reason="unauthorized")
        return
    max_clients = CONFIG.get("server", {}).get("max_clients", 8)
    if len(clients) >= max_clients:
        await ws.close(code=1001, reason="Max connections reached")
        return
    await ws.accept()
    clients.add(ws)
    await ws.send_text(json.dumps({
        "type": "engines",
        "engines": manager.status_list() if manager else [],
        "clients": len(clients),
    }))
    await broadcast_clients()
    try:
        while True:
            raw = await ws.receive_text()
            if not raw.startswith("{"):
                for eng in manager.by_priority():
                    await eng.send(raw)
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps({"type": "error", "message": "invalid JSON"}))
                continue
            await handle_message(ws, msg)
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)
        await broadcast_clients()


async def handle_message(ws: WebSocket, msg: dict):
    action = msg.get("action")
    if action == "list_engines":
        await ws.send_text(json.dumps({"type": "engines", "engines": manager.status_list()}))
    elif action == "analyze":
        fen = msg.get("fen")
        if not fen:
            await ws.send_text(json.dumps({"type": "error", "message": "analyze requires fen"}))
            return
        targets = _target_engines(msg.get("engines"))
        multipv = msg.get("multipv")
        depth = msg.get("depth")
        movetime = msg.get("movetime")
        nodes = msg.get("nodes")
        for eng in targets:
            if multipv:
                await eng.send(f"setoption name MultiPV value {int(multipv)}")
            await eng.send("stop")
            await eng.send(f"position fen {fen}")
            await eng.send(_go_command(eng, depth, movetime, nodes))
    elif action == "stop":
        for eng in _target_engines(msg.get("engines")):
            await eng.stop_analysis()
    elif action == "newgame":
        for eng in _target_engines(msg.get("engines")):
            await eng.send("ucinewgame")
            await eng.send("isready")
    elif action == "setoption":
        eng = manager.get(msg.get("engine"))
        if eng:
            await eng.send(f"setoption name {msg.get('name')} value {msg.get('value')}")
    elif action == "raw":
        eng = manager.get(msg.get("engine"))
        if eng:
            await eng.send(msg.get("cmd", ""))
    elif action == "set_priority":
        order = msg.get("order", [])
        for idx, name in enumerate(order, start=1):
            eng = manager.get(name)
            if eng:
                eng.config.priority = idx
        _persist_engines()
        await broadcast("", None, extra={"type": "engines", "engines": manager.status_list()})
    elif action == "set_skill":
        eng = manager.get(msg.get("engine"))
        if eng:
            if msg.get("skill_level") is not None:
                await eng.send(f"setoption name Skill Level value {int(msg['skill_level'])}")
            if msg.get("uci_elo") is not None:
                await eng.send("setoption name UCI_LimitStrength value true")
                await eng.send(f"setoption name UCI_Elo value {int(msg['uci_elo'])}")
    elif action == "book_query":
        result = books.query_books(msg.get("fen", ""), msg.get("stage"), msg.get("ply"))
        await ws.send_text(json.dumps({"type": "book_result", "request_id": msg.get("request_id"), **result}))
    elif action == "tablebase_probe":
        result = books.probe_tablebases(msg.get("fen", ""))
        await ws.send_text(json.dumps({"type": "tablebase_result", "request_id": msg.get("request_id"), **result}))
    else:
        await ws.send_text(json.dumps({"type": "error", "message": f"unknown action: {action}"}))


def _target_engines(names):
    if not names:
        return manager.by_priority()
    return [manager.get(n) for n in names if manager.get(n)]


def _go_command(eng, depth, movetime, nodes) -> str:
    """Build the search command for one engine.

    Engines in the same set are rarely the same speed. Asking every one of
    them for the same depth lets the slowest sit there for minutes while the
    rest have long finished, so it never contributes a move at all. depth_cap
    and nodes_limit exist per engine for exactly this, and are applied here.
    """
    if nodes:
        limit = int(nodes)
        if eng.config.nodes_limit:
            limit = min(limit, eng.config.nodes_limit)
        return f"go nodes {limit}"
    if movetime:
        return f"go movetime {int(movetime)}"
    wanted = int(depth or 15)
    if eng.config.depth_cap:
        wanted = min(wanted, eng.config.depth_cap)
    if eng.config.nodes_limit:
        return f"go depth {wanted} nodes {eng.config.nodes_limit}"
    return f"go depth {wanted}"


def _persist_engines():
    previous = {e.get("name"): e for e in CONFIG.get("engines", [])}
    CONFIG["engines"] = [
        {
            "name": e.config.name,
            # keep any friendly label the entry already carried
            **({"display": previous[e.config.name]["display"]}
               if previous.get(e.config.name, {}).get("display") else {}),
            "path": portable_path(e.config.path),
            "priority": e.config.priority,
            "enabled": e.config.enabled,
            "options": e.config.options,
            "skill_level": e.config.skill_level,
            "uci_elo": e.config.uci_elo,
            "nodes_limit": e.config.nodes_limit,
            "depth_cap": e.config.depth_cap,
        }
        for e in manager.all_by_priority()
    ]
    save_config(CONFIG)


class BookAddRequest(BaseModel):
    name: str
    path: str
    stage: str = "opening"
    format: str | None = None
    weight: float = 1.0
    max_ply: int | None = None


class TablebaseAddRequest(BaseModel):
    name: str
    path: str
    kind: str = "syzygy"


@app.middleware("http")
async def guard_api(request, call_next):
    if request.url.path.startswith("/api/"):
        supplied = request.query_params.get("token") or request.headers.get("x-bm-token")
        if not _token_ok(supplied):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/api/health")
async def health():
    return {"ok": True, "clients": len(clients), "engines": manager.status_list() if manager else []}


@app.get("/api/engines")
async def get_engines():
    return {"engines": manager.status_list() if manager else []}


@app.get("/api/downloadable")
async def get_downloadable():
    return {"engines": list_known_engines()}


@app.post("/api/download/{key}")
async def api_download(key: str):
    try:
        display, exe_path = await asyncio.to_thread(download_engine, key, ENGINES_DIR)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
    priorities = [e.config.priority for e in manager.engines.values()] or [0]
    name = os.path.splitext(os.path.basename(exe_path))[0].lower().replace(" ", "-")
    entry = {
        "name": name,
        "display": display,
        "path": exe_path,
        "priority": max(priorities) + 1,
        "enabled": True,
        "options": {"Threads": 4, "Hash": 256},
    }
    CONFIG.setdefault("engines", []).append(entry)
    save_config(CONFIG)
    manager.load_from_config([entry])
    await manager.get(name).start()
    await broadcast("", None, extra={"type": "engines", "engines": manager.status_list()})
    return {"ok": True, "name": name, "path": exe_path, "display": display}


@app.post("/api/engine/{name}/toggle")
async def toggle_engine(name: str):
    """Turn a configured engine on or off without editing config.json."""
    eng = manager.get(name)
    if not eng:
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    eng.config.enabled = not eng.config.enabled
    if eng.config.enabled:
        started = await eng.start()
        if not started:
            eng.config.enabled = False
            _persist_engines()
            return JSONResponse(
                {"ok": False, "error": f"could not start {name}, check the path"},
                status_code=500,
            )
    else:
        await eng.quit()
    _persist_engines()
    await broadcast("", None, extra={"type": "engines", "engines": manager.status_list()})
    return {"ok": True, "enabled": eng.config.enabled}


@app.post("/api/engine/{name}/restart")
async def restart_engine(name: str):
    eng = manager.get(name)
    if not eng:
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    await eng.quit()
    ok = await eng.start()
    return {"ok": ok}


@app.post("/api/engine/{name}/remove")
async def remove_engine(name: str):
    eng = manager.get(name)
    if not eng:
        return JSONResponse({"ok": False, "error": "not found"}, status_code=404)
    await eng.quit()
    del manager.engines[name]
    CONFIG["engines"] = [e for e in CONFIG.get("engines", []) if e.get("name") != name]
    save_config(CONFIG)
    await broadcast("", None, extra={"type": "engines", "engines": manager.status_list()})
    return {"ok": True}


@app.get("/api/books")
async def get_books():
    return books.status()


@app.post("/api/books/add")
async def add_book(req: BookAddRequest):
    info = books.add_book(req.name, req.path, req.stage, req.format, req.weight, req.max_ply)
    if info["available"]:
        CONFIG.setdefault("books", []).append({
            "name": req.name, "path": req.path, "stage": req.stage,
            "format": req.format, "weight": req.weight, "max_ply": req.max_ply,
        })
        save_config(CONFIG)
    return info


@app.post("/api/books/{name}/remove")
async def remove_book(name: str):
    ok = books.remove_book(name)
    if ok:
        CONFIG["books"] = [b for b in CONFIG.get("books", []) if b.get("name") != name]
        save_config(CONFIG)
    return {"ok": ok}


@app.post("/api/books/query")
async def query_books(body: dict):
    return books.query_books(body.get("fen", ""), body.get("stage"), body.get("ply"))


@app.post("/api/tablebases/add")
async def add_tablebase(req: TablebaseAddRequest):
    info = books.add_tablebase(req.name, req.path, req.kind)
    if info["available"]:
        CONFIG.setdefault("tablebases", []).append({"name": req.name, "path": req.path, "kind": req.kind})
        save_config(CONFIG)
    return info


@app.post("/api/tablebases/{name}/remove")
async def remove_tablebase(name: str):
    ok = books.remove_tablebase(name)
    if ok:
        CONFIG["tablebases"] = [t for t in CONFIG.get("tablebases", []) if t.get("name") != name]
        save_config(CONFIG)
    return {"ok": ok}


@app.post("/api/tablebases/probe")
async def probe_tablebases(body: dict):
    return books.probe_tablebases(body.get("fen", ""))


@app.get("/api/explorer")
async def explorer_proxy(fen: str, source: str = "masters", moves: int = 12):
    url = f"https://explorer.lichess.ovh/{source}?fen={urllib.parse.quote(fen)}&moves={moves}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BetterMint-EngineWS/3.0"}
    # Lichess began requiring a token on the opening explorer in March 2026, so
    # without one every lookup is refused. Put a personal token from
    # lichess.org/account/oauth/token in config.json under server.lichess_token.
    token = str(CONFIG.get("server", {}).get("lichess_token") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return JSONResponse(
                {"error": "lichess explorer needs a token: set server.lichess_token in config.json", "moves": []},
                status_code=502,
            )
        return JSONResponse({"error": f"HTTP {e.code}", "moves": []}, status_code=502)
    except Exception as e:
        return JSONResponse({"error": str(e), "moves": []}, status_code=502)


@app.get("/api/tablebase")
async def tablebase_proxy(fen: str):
    url = f"https://tablebase.lichess.ovh/standard?fen={urllib.parse.quote(fen)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BetterMint-EngineWS/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return JSONResponse({"error": str(e), "moves": []}, status_code=502)


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    html_path = os.path.join(BASE_DIR, "dashboard.html")
    if not os.path.isfile(html_path):
        return "<h1>EngineWS dashboard.html missing</h1>"
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    # the dashboard is served by this process, so it is handed the token
    # directly rather than asking the user to paste it into their own page
    inject = f'<script>window.BM_TOKEN={json.dumps(TOKEN)};</script>'
    return html.replace("</head>", inject + "</head>", 1)


if __name__ == "__main__":
    import uvicorn
    server_cfg = CONFIG.get("server", {})
    host = server_cfg.get("host", "127.0.0.1")
    port = server_cfg.get("port", 8000)
    print("=" * 62)
    print("  BetterMint EngineWS v3.0")
    print(f"  Dashboard: http://{host}:{port}")
    if TOKEN:
        print("  Paste this into the extension's EngineWS address setting:")
        print(f"  ws://{host}:{port}/ws?token={TOKEN}")
    else:
        print("  WARNING: require_token is off, any page you visit can reach this")
    print("=" * 62)
    uvicorn.run(
        app,
        host=server_cfg.get("host", "127.0.0.1"),
        port=server_cfg.get("port", 8000),
        log_level="warning",
    )
