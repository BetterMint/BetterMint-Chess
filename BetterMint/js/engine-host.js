// Runs inside a hidden extension-origin iframe placed on the page.
//
// The engines compile WebAssembly, and whether that is allowed is decided by the
// Content-Security-Policy of whichever document creates the worker. Creating
// them from the page (even through a blob) inherits the site's policy, and
// lichess ships a policy in a meta tag that forbids WebAssembly on every page
// where it does not run an engine itself - a meta policy cannot be removed by
// modifying response headers, and a policy can never be relaxed by adding to it.
//
// Because this document is served from the extension it carries the extension's
// own policy instead, so the engines start on any site. Being same-origin with
// the extension also means workers can be created straight from their real URLs
// rather than through a blob shim.
(() => {
  const engines = new Map();
  const sockets = new Map();
  let parentOrigin = null;

  function post(msg) {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({ __bmEngineHost: true, ...msg }, parentOrigin || "*");
  }

  function line(engineId, text) {
    post({ op: "line", engineId, line: String(text) });
  }

  function fail(engineId, error) {
    post({ op: "error", engineId, error: String(error) });
  }

  // Workers are created straight from their real extension URLs. Nothing needs
  // to be rewritten: an Emscripten build resolves its wasm relative to its own
  // script location, which is correct once the script is loaded from where it
  // actually lives.
  function hashUrl(path, cfg) {
    return chrome.runtime.getURL(path) + "#" + encodeURIComponent(JSON.stringify(cfg));
  }

  function attach(engineId, worker) {
    worker.onmessage = (ev) => line(engineId, ev.data);
    worker.onerror = (ev) => {
      const where = ev.filename ? ` at ${ev.filename}:${ev.lineno}` : "";
      fail(engineId, (ev.message || "worker error") + where);
    };
    engines.set(engineId, worker);
  }

  function startClassic(engineId, files) {
    const jsUrl = chrome.runtime.getURL(files.js);
    // Some of these builds read their wasm path out of their own URL fragment,
    // which is why it is appended even though the default lookup also works.
    const wasmUrl = files.wasm ? chrome.runtime.getURL(files.wasm) : null;
    attach(engineId, new Worker(wasmUrl ? jsUrl + "#" + wasmUrl : jsUrl));
    return { ok: true };
  }

  // lila-stockfish-web is an ES module exposing uci()/listen instead of a
  // stdin/stdout worker, and it will not evaluate without its NNUE network.
  function startLila(engineId, files) {
    const worker = new Worker(
      hashUrl("js/engine-worker-lila.js", {
        js: chrome.runtime.getURL(files.js),
        nnue: files.nnue ? chrome.runtime.getURL(files.nnue) : null,
      }),
      { type: "module" },
    );
    attach(engineId, worker);
    return { ok: true };
  }

  // Chess.com's explanation engine sets itself up when imported into a worker,
  // taking its wasm location from the URL fragment. That fragment therefore has
  // to be exactly the wasm URL, so the wrapper is told where the bundle lives
  // through the query string instead.
  function startKtep(engineId, files) {
    const url =
      chrome.runtime.getURL("js/engine-worker-ktep.js") +
      "?js=" + encodeURIComponent(chrome.runtime.getURL(files.js)) +
      "#" + chrome.runtime.getURL(files.wasm);
    attach(engineId, new Worker(url));
    return { ok: true };
  }

  function start(engineId, files) {
    try {
      if (engines.has(engineId)) return { ok: true };
      if (files.needsSharedArrayBuffer && typeof SharedArrayBuffer === "undefined") {
        return { ok: false, error: "this engine needs SharedArrayBuffer, which this site does not enable" };
      }
      if (files.kind === "lila") return startLila(engineId, files);
      if (files.kind === "ktep") return startKtep(engineId, files);
      return startClassic(engineId, files);
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  function stop(engineId) {
    const w = engines.get(engineId);
    if (!w) return { ok: true };
    engines.delete(engineId);
    // Let it stop searching and tear down its own thread workers first;
    // terminating outright would orphan them.
    try {
      w.postMessage("stop");
      w.postMessage("quit");
      w.postMessage("__terminate__");
    } catch {}
    setTimeout(() => { try { w.terminate(); } catch {} }, 250);
    return { ok: true };
  }

  function cmd(engineId, command) {
    const w = engines.get(engineId);
    if (!w) return { ok: false, error: "engine not running" };
    w.postMessage(command);
    return { ok: true };
  }

  // Sockets are opened here for the same reason the engines are. connect-src
  // decides where a document may open a WebSocket, and lichess allows only its
  // own sockets, so a connection made from the page is refused before it is
  // attempted. This document is served from the extension and is bound by the
  // extension's policy instead, so the socket engines and EngineWS both work.
  function socketEvent(socketId, event, extra) {
    post({ op: "ws", socketId, event, ...extra });
  }

  function wsOpen(socketId, url) {
    if (sockets.has(socketId)) return { ok: true };
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
    sockets.set(socketId, ws);
    ws.onopen = () => socketEvent(socketId, "open");
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") socketEvent(socketId, "message", { data: ev.data });
    };
    ws.onerror = () => socketEvent(socketId, "error");
    ws.onclose = (ev) => {
      sockets.delete(socketId);
      socketEvent(socketId, "close", { code: ev.code, reason: ev.reason });
    };
    return { ok: true };
  }

  function wsSend(socketId, data) {
    const ws = sockets.get(socketId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return { ok: false, error: "socket not open" };
    try {
      ws.send(data);
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
    return { ok: true };
  }

  function wsClose(socketId) {
    const ws = sockets.get(socketId);
    sockets.delete(socketId);
    try { ws?.close(); } catch {}
    return { ok: true };
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || typeof d !== "object" || d.__bmEngineHost !== true) return;
    if (!parentOrigin) parentOrigin = e.origin;
    let res = { ok: false, error: "unknown op" };
    if (d.op === "start") res = start(d.engineId, d.files);
    else if (d.op === "cmd") res = cmd(d.engineId, d.cmd);
    else if (d.op === "stop") res = stop(d.engineId);
    else if (d.op === "ws_open") res = wsOpen(d.socketId, d.url);
    else if (d.op === "ws_send") res = wsSend(d.socketId, d.data);
    else if (d.op === "ws_close") res = wsClose(d.socketId);
    if (d.i != null) post({ op: "res", i: d.i, p: res });
  });

  post({
    op: "ready",
    // reported so the page side can explain itself if an engine cannot start
    wasm: (() => {
      try {
        new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
        return true;
      } catch (err) {
        return String(err?.message || err);
      }
    })(),
    sab: typeof SharedArrayBuffer !== "undefined",
  });
})();
