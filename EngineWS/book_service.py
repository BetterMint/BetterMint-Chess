import os
import threading
from typing import Optional

try:
    import chess
    import chess.polyglot
    HAS_CHESS = True
except ImportError:
    HAS_CHESS = False

try:
    import chess.ctg
    HAS_CTG = True
except ImportError:
    HAS_CTG = False

try:
    import chess.gaviota
    HAS_GAVIOTA = True
except ImportError:
    HAS_GAVIOTA = False

try:
    import chess.syzygy
    HAS_SYZYGY = True
except ImportError:
    HAS_SYZYGY = False


POLYGLOT_ENTRY = 16
# A book whose keys only fall out of order within this fraction of the end is
# treated as a good book with a junk footer rather than a broken one.
_TAIL_TOLERANCE = 0.01


def inspect_polyglot(path) -> tuple[Optional[str], Optional[str]]:
    """Judge a polyglot book, returning (fatal error, warning).

    A polyglot book is a flat array of 16 byte records sorted by zobrist key,
    and readers binary search it. Files that merely carry a .bin extension open
    without complaint and then answer every position with nothing, which is
    indistinguishable from an empty book unless we say why. Scanning the keys
    costs about 40 ms even for a 10 MB book, so it is done in full.
    """
    size = os.path.getsize(path)
    if size == 0:
        return "file is empty", None
    with open(path, "rb") as f:
        head = f.read(64)
        if size < 200 and head.startswith(b"version https://git-lfs"):
            return "git-lfs pointer, the real file was never downloaded", None
        f.seek(0)
        data = f.read()
    if size % POLYGLOT_ENTRY:
        return f"not a polyglot book: {size} bytes is not a multiple of {POLYGLOT_ENTRY}", None

    count = size // POLYGLOT_ENTRY
    # keys are big endian, so comparing the raw 8 bytes orders them correctly
    previous = b""
    broke_at = None
    for index in range(count):
        key = data[index * POLYGLOT_ENTRY:index * POLYGLOT_ENTRY + 8]
        if key < previous:
            broke_at = index
            break
        previous = key

    if broke_at is None:
        return None, None
    if broke_at >= count * (1 - _TAIL_TOLERANCE):
        return None, f"{count - broke_at} trailing record(s) are out of key order and will never be found"
    return "not a polyglot book: keys are not in sorted order (Rodent or ABK format?)", None


class BookEntry:
    def __init__(self, name, path, stage, fmt, weight=1.0, max_ply=None):
        self.name = name
        self.path = path
        self.stage = stage
        self.fmt = fmt
        self.weight = weight
        self.max_ply = max_ply
        self.reader = None
        self.lock = threading.Lock()
        self.available = False
        self.error = None
        self.warning = None
        self._open()

    def _open(self):
        if not HAS_CHESS:
            self.error = "python-chess not installed"
            return
        if not os.path.isfile(self.path):
            self.error = f"file not found: {self.path}"
            return
        try:
            if self.fmt == "polyglot":
                problem, warning = inspect_polyglot(self.path)
                if problem:
                    self.error = problem
                    return
                self.warning = warning
                self.reader = chess.polyglot.open_reader(self.path)
            elif self.fmt == "ctg":
                if not HAS_CTG:
                    # python-chess ships polyglot, syzygy and gaviota readers
                    # but no ctg one, so this is the normal case rather than a
                    # missing optional extra.
                    self.error = "ctg is not readable here: python-chess has no ctg reader, convert the book to polyglot .bin"
                    return
                self.reader = chess.ctg.open_reader(self.path)
            elif self.fmt == "abk":
                self.error = "abk direct read unsupported, convert to polyglot"
                return
            else:
                self.error = f"unknown format {self.fmt}"
                return
            self.available = True
        except Exception as e:
            self.error = str(e)
            self.reader = None

    def query(self, board):
        if not self.available or not self.reader:
            return []
        out = []
        try:
            with self.lock:
                if self.fmt == "polyglot":
                    for entry in self.reader.find_all(board):
                        out.append({
                            "move": entry.move.uci(),
                            "weight": entry.weight,
                            "learn": entry.learn,
                        })
                elif self.fmt == "ctg":
                    for entry in self.reader.find_all(board):
                        out.append({
                            "move": entry.move.uci(),
                            "weight": entry.weight,
                            "wins": getattr(entry, "wins", None),
                            "losses": getattr(entry, "losses", None),
                            "draws": getattr(entry, "draws", None),
                        })
        except Exception:
            return []
        return out

    def close(self):
        try:
            if self.reader:
                self.reader.close()
        except Exception:
            pass

    def info(self):
        return {
            "name": self.name,
            "path": self.path,
            "stage": self.stage,
            "format": self.fmt,
            "weight": self.weight,
            "max_ply": self.max_ply,
            "available": self.available,
            "error": self.error,
            "warning": self.warning,
        }


def detect_format(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".bin":
        return "polyglot"
    if ext == ".ctg":
        return "ctg"
    if ext == ".abk":
        return "abk"
    return "polyglot"


class TablebaseSet:
    def __init__(self, name, path, kind):
        self.name = name
        self.path = path
        self.kind = kind
        self.tb = None
        self.available = False
        self.error = None
        self._open()

    def _open(self):
        if not HAS_CHESS:
            self.error = "python-chess not installed"
            return
        if not os.path.isdir(self.path):
            self.error = f"directory not found: {self.path}"
            return
        try:
            if self.kind == "syzygy":
                if not HAS_SYZYGY:
                    self.error = "syzygy support unavailable"
                    return
                self.tb = chess.syzygy.open_tablebase(self.path)
            elif self.kind == "gaviota":
                if not HAS_GAVIOTA:
                    self.error = "gaviota support unavailable"
                    return
                self.tb = chess.gaviota.open_tablebase(self.path)
            else:
                self.error = f"unknown tablebase kind {self.kind}"
                return
            self.available = True
        except Exception as e:
            self.error = str(e)
            self.tb = None

    def probe(self, board):
        if not self.available or not self.tb:
            return None
        try:
            wdl = self.tb.probe_wdl(board)
        except Exception:
            return None
        result = {"wdl": wdl}
        try:
            if self.kind == "syzygy":
                result["dtz"] = self.tb.probe_dtz(board)
            elif self.kind == "gaviota":
                result["dtm"] = self.tb.probe_dtm(board)
        except Exception:
            pass
        return result

    def probe_moves(self, board):
        base = self.probe(board)
        if base is None:
            return None
        moves = []
        for move in board.legal_moves:
            board.push(move)
            child = self.probe(board)
            board.pop()
            if child is None:
                continue
            entry = {"move": move.uci(), "wdl": -child.get("wdl", 0)}
            if "dtz" in child:
                entry["dtz"] = -child["dtz"] if child["dtz"] != 0 else 0
            if "dtm" in child:
                entry["dtm"] = -child["dtm"] if child["dtm"] != 0 else 0
            moves.append(entry)
        order = {"syzygy": lambda m: (-m["wdl"], abs(m.get("dtz", 9999))), "gaviota": lambda m: (-m["wdl"], abs(m.get("dtm", 9999)))}
        moves.sort(key=order.get(self.kind, order["syzygy"]))
        return {"position": base, "moves": moves}

    def info(self):
        return {
            "name": self.name,
            "path": self.path,
            "kind": self.kind,
            "available": self.available,
            "error": self.error,
        }


class BookService:
    def __init__(self):
        self.books: dict[str, BookEntry] = {}
        self.tablebases: dict[str, TablebaseSet] = {}
        self.max_pieces = 7

    def load_config(self, cfg: dict):
        for b in cfg.get("books", []):
            fmt = b.get("format") or detect_format(b.get("path", ""))
            entry = BookEntry(
                name=b["name"],
                path=b["path"],
                stage=b.get("stage", "opening"),
                fmt=fmt,
                weight=b.get("weight", 1.0),
                max_ply=b.get("max_ply"),
            )
            self.books[entry.name] = entry
        for t in cfg.get("tablebases", []):
            tb = TablebaseSet(t["name"], t["path"], t.get("kind", "syzygy"))
            self.tablebases[tb.name] = tb

    def add_book(self, name, path, stage="opening", fmt=None, weight=1.0, max_ply=None):
        fmt = fmt or detect_format(path)
        entry = BookEntry(name, path, stage, fmt, weight, max_ply)
        self.books[name] = entry
        return entry.info()

    def remove_book(self, name):
        entry = self.books.pop(name, None)
        if entry:
            entry.close()
            return True
        return False

    def add_tablebase(self, name, path, kind="syzygy"):
        tb = TablebaseSet(name, path, kind)
        self.tablebases[name] = tb
        return tb.info()

    def remove_tablebase(self, name):
        return self.tablebases.pop(name, None) is not None

    def query_books(self, fen, stage=None, ply=None):
        if not HAS_CHESS:
            return {"error": "python-chess not installed"}
        try:
            board = chess.Board(fen)
        except Exception as e:
            return {"error": f"invalid fen: {e}"}
        results = []
        for entry in self.books.values():
            if not entry.available:
                continue
            if stage and entry.stage != stage and entry.stage != "any":
                continue
            if entry.max_ply is not None and ply is not None and ply > entry.max_ply:
                continue
            moves = entry.query(board)
            if moves:
                total = sum(m.get("weight", 1) for m in moves) or 1
                for m in moves:
                    m["pct"] = round(100.0 * m.get("weight", 1) / total, 1)
                results.append({
                    "book": entry.name,
                    "stage": entry.stage,
                    "format": entry.fmt,
                    "moves": sorted(moves, key=lambda m: -m.get("weight", 1)),
                })
        return {"results": results}

    def probe_tablebases(self, fen):
        if not HAS_CHESS:
            return {"error": "python-chess not installed"}
        try:
            board = chess.Board(fen)
        except Exception as e:
            return {"error": f"invalid fen: {e}"}
        piece_count = chess.popcount(board.occupied)
        if piece_count > self.max_pieces:
            return {"error": f"too many pieces ({piece_count} > {self.max_pieces})"}
        out = []
        for tb in self.tablebases.values():
            if not tb.available:
                continue
            probed = tb.probe_moves(board)
            if probed:
                out.append({
                    "tablebase": tb.name,
                    "kind": tb.kind,
                    "position": probed["position"],
                    "moves": probed["moves"],
                })
        return {"results": out, "piece_count": piece_count}

    def status(self):
        return {
            "python_chess": HAS_CHESS,
            "ctg": HAS_CTG,
            "gaviota": HAS_GAVIOTA,
            "syzygy": HAS_SYZYGY,
            "books": [b.info() for b in self.books.values()],
            "tablebases": [t.info() for t in self.tablebases.values()],
        }
