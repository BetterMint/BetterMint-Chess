import json
import os
import re
import zipfile
import urllib.request

GITHUB_API = "https://api.github.com/repos/{repo}/releases/latest"

KNOWN_ENGINES = {
    "stockfish": {
        "repo": "official-stockfish/Stockfish",
        "assets": [
            (r"stockfish-windows-x86-64-avx2\.zip", "stockfish-avx2", "Stockfish (AVX2)"),
            (r"stockfish-windows-x86-64\.zip", "stockfish-x64", "Stockfish (x64)"),
        ],
    },
    "fairy-stockfish": {
        "repo": "fairy-stockfish/Fairy-Stockfish",
        "assets": [
            (r"fairy-stockfish-largeboard_x86-64-modern\.exe", "fairy-stockfish.exe", "Fairy-Stockfish"),
            (r"fairy-stockfish_x86-64\.exe", "fairy-stockfish.exe", "Fairy-Stockfish"),
        ],
    },
    # Both of these publish bare .exe files rather than archives, and
    # Viridithas labels its Windows builds "win" rather than "windows". The
    # most broadly compatible build is listed first, because the first pattern
    # that matches is the one that gets installed.
    "clover": {
        "repo": "lucametehau/CloverEngine",
        "assets": [
            (r"Clover.*avx2.*\.exe", "clover-avx2.exe", "Clover (AVX2)"),
            (r"Clover.*old.*\.exe", "clover-old.exe", "Clover (older CPUs)"),
            (r"Clover.*avx512.*\.exe", "clover-avx512.exe", "Clover (AVX512)"),
            (r"Clover.*\.exe", "clover.exe", "Clover"),
        ],
    },
    "viridithas": {
        "repo": "cosmobobak/viridithas",
        "assets": [
            (r"viridithas.*win.*x86-64-v3.*\.exe", "viridithas-v3.exe", "Viridithas (x86-64-v3)"),
            (r"viridithas.*win.*x86-64-v4.*\.exe", "viridithas-v4.exe", "Viridithas (x86-64-v4)"),
            (r"viridithas.*win.*\.exe", "viridithas.exe", "Viridithas"),
        ],
    },
}

UA = {"User-Agent": "BetterMint-EngineWS/2.0"}


def _get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def _download(url, dest, progress=None):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if progress and total:
                progress(done, total)


def _find_exe(folder):
    for root, _dirs, files in os.walk(folder):
        for name in files:
            if name.lower().endswith(".exe"):
                return os.path.join(root, name)
    return None


def download_engine(key, engines_dir, progress=None):
    spec = KNOWN_ENGINES.get(key)
    if not spec:
        raise RuntimeError(f"unknown engine key: {key}")
    os.makedirs(engines_dir, exist_ok=True)
    release = _get_json(GITHUB_API.format(repo=spec["repo"]))
    assets = release.get("assets", [])
    last_err = None
    for pattern, out_name, display in spec["assets"]:
        rx = re.compile(pattern, re.IGNORECASE)
        match = next((a for a in assets if rx.search(a.get("name", ""))), None)
        if not match:
            last_err = f"no asset matching {pattern} in {spec['repo']} latest release"
            continue
        try:
            url = match["browser_download_url"]
            tmp = os.path.join(engines_dir, match["name"])
            _download(url, tmp, progress)
            if tmp.lower().endswith(".zip"):
                extract_dir = os.path.join(engines_dir, out_name)
                os.makedirs(extract_dir, exist_ok=True)
                with zipfile.ZipFile(tmp) as zf:
                    zf.extractall(extract_dir)
                os.remove(tmp)
                exe = _find_exe(extract_dir)
            else:
                exe = os.path.join(engines_dir, out_name if out_name.endswith(".exe") else out_name + ".exe")
                os.replace(tmp, exe)
            if not exe or not os.path.isfile(exe):
                last_err = "downloaded archive contained no .exe"
                continue
            return display, exe
        except Exception as e:
            last_err = str(e)
            continue
    raise RuntimeError(last_err or "download failed")


def list_known_engines():
    out = []
    for key, spec in KNOWN_ENGINES.items():
        out.append({
            "key": key,
            "repo": spec["repo"],
            "choices": [c[2] for c in spec["assets"]],
        })
    return out
