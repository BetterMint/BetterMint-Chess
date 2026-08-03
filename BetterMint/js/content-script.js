(() => {
  const TOKEN_RX = /^[0-9a-f]{12,24}$/;
  let session = null;

  const ENGINE_FILES = {
    stockfish18: { js: "js/vendor/stockfish/stockfish.js", wasm: "js/vendor/stockfish/stockfish.wasm" },
    torch2: { js: "js/vendor/torch/torch-2-lite-single.js", wasm: "js/vendor/torch/torch-2-lite-single.wasm" },
    torch1: { js: "js/vendor/torch/torch-lite.js", wasm: "js/vendor/torch/torch-lite.wasm" },
    sf16nnue: { js: "js/vendor/stockfish16/stockfish-nnue-16-single.js", wasm: "js/vendor/stockfish16/stockfish-nnue-16-single.wasm" },
    sf16nosimd: { js: "js/vendor/stockfish16/stockfish-nnue-16-no-simd.js", wasm: "js/vendor/stockfish16/stockfish-nnue-16-no-simd.wasm" },
    sfclassic: { js: "js/vendor/stockfish-classic/stockfish-single.js", wasm: "js/vendor/stockfish-classic/stockfish-single.wasm" },
    // Lichess's own Stockfish 18 dev build. Unlike the others this is an ES
    // module with a bespoke API rather than a stdin/stdout UCI worker, and it
    // needs its NNUE network handed to it as a buffer.
    // The filenames must stay exactly as lichess ships them: the build spawns
    // its own pthread workers using its original script name.
    sf18nnue: {
      js: "js/vendor/stockfish18/sf_dev_relaxed-simd.js",
      wasm: "js/vendor/stockfish18/sf_dev_relaxed-simd.wasm",
      nnue: "js/vendor/stockfish18/nn-71d6d32cb962.nnue",
      kind: "lila",
      needsSharedArrayBuffer: true,
    },
    // Chess.com's Komodo-based explanation engine, which reaches its wasm
    // through a bespoke factory rather than worker messages.
    explanation: {
      js: "js/vendor/explanation/explanation-engine.js",
      wasm: "js/vendor/explanation/explanation-engine.wasm",
      kind: "ktep",
    },
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || typeof d !== "object") return;

    if (!session) {
      if (d.op === "hello" && typeof d.s === "string" && TOKEN_RX.test(d.s)) {
        session = d.s;
        postToPage({ op: "ready" });
      }
      return;
    }

    if (d["m" + session] !== 1 || d.op !== "req") return;
    handleRequest(d);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!session || !msg || typeof msg !== "object") return;
    if (msg.a === "settings.push") postToPage({ op: "push", a: "settings.changed", p: msg.p });
  });

  function postToPage(obj) {
    if (!session) return;
    window.postMessage({ ["m" + session]: 1, ...obj }, "*");
  }

  function handleRequest(d) {
    const { i, a, p } = d;
    if (a === "engine.local.start") {
      const files = ENGINE_FILES[p.engineKey];
      if (!files) return reply(i, { ok: false, error: "unknown engine: " + p.engineKey });
      return hostRequest({ op: "start", engineId: p.engineId, files })
        .then((res) => reply(i, res))
        .catch((err) => reply(i, { ok: false, error: String(err?.message || err) }));
    }
    if (a === "engine.local.cmd") {
      hostSend({ op: "cmd", engineId: p.engineId, cmd: p.cmd });
      return reply(i, { ok: true });
    }
    if (a === "engine.local.stop") {
      hostSend({ op: "stop", engineId: p.engineId });
      return reply(i, { ok: true });
    }
    // Sockets are opened in the engine host for the same CSP reason the engines
    // are: connect-src on sites like lichess refuses any socket the page itself
    // tries to open, including one to 127.0.0.1.
    if (a === "socket.open") {
      return hostRequest({ op: "ws_open", socketId: p.socketId, url: p.url })
        .then((res) => reply(i, res))
        .catch((err) => reply(i, { ok: false, error: String(err?.message || err) }));
    }
    if (a === "socket.send") {
      hostSend({ op: "ws_send", socketId: p.socketId, data: p.data });
      return reply(i, { ok: true });
    }
    if (a === "socket.close") {
      hostSend({ op: "ws_close", socketId: p.socketId });
      return reply(i, { ok: true });
    }
    // When the extension is updated or reloaded, this script keeps running in
    // the already-loaded page but loses its channel back. sendMessage then
    // throws synchronously rather than rejecting, so a .catch alone leaves an
    // uncaught error in the site's console on every request.
    try {
      chrome.runtime.sendMessage({ a, p })
        .then((payload) => reply(i, payload))
        .catch((err) => reply(i, { error: String(err?.message || err) }));
    } catch (err) {
      reply(i, { error: String(err?.message || err) });
    }
  }

  function reply(i, payload) {
    postToPage({ op: "res", i, p: payload });
  }

  // The engines live in a hidden extension-origin iframe rather than in workers
  // created here. A worker's ability to compile WebAssembly is governed by the
  // Content-Security-Policy of the document that creates it, and creating them
  // from the page inherits the site's policy: lichess forbids WebAssembly on
  // every page where it does not run an engine itself, and it delivers that
  // policy in a meta tag, which no amount of header rewriting can undo. The
  // iframe is served from the extension, so it carries the extension's policy
  // and the engines start anywhere.
  let hostFrame = null;
  let hostReady = null;
  let hostSeq = 0;
  const hostPending = new Map();

  function ensureHost() {
    if (hostReady) return hostReady;
    hostReady = new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.src = chrome.runtime.getURL("html/engine-host.html");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px";
      const timer = setTimeout(() => reject(new Error("engine host did not start")), 15000);
      const onReady = (e) => {
        if (e.source !== frame.contentWindow) return;
        const d = e.data;
        if (!d || typeof d !== "object" || d.__bmEngineHost !== true || d.op !== "ready") return;
        clearTimeout(timer);
        window.removeEventListener("message", onReady);
        hostFrame = frame;
        resolve(frame);
      };
      window.addEventListener("message", onReady);
      (document.body || document.documentElement).appendChild(frame);
    });
    hostReady.catch(() => { hostReady = null; });
    return hostReady;
  }

  window.addEventListener("message", (e) => {
    if (!hostFrame || e.source !== hostFrame.contentWindow) return;
    const d = e.data;
    if (!d || typeof d !== "object" || d.__bmEngineHost !== true) return;
    if (d.op === "line") {
      postToPage({ op: "push", a: "engine.local.line", p: { engineId: d.engineId, line: d.line } });
    } else if (d.op === "error") {
      postToPage({ op: "push", a: "engine.local.error", p: { engineId: d.engineId, error: d.error } });
    } else if (d.op === "ws") {
      postToPage({
        op: "push",
        a: "socket.event",
        p: { socketId: d.socketId, event: d.event, data: d.data, code: d.code, reason: d.reason },
      });
    } else if (d.op === "res" && hostPending.has(d.i)) {
      hostPending.get(d.i)(d.p);
      hostPending.delete(d.i);
    }
  });

  async function hostRequest(msg) {
    const frame = await ensureHost();
    const i = ++hostSeq;
    return new Promise((resolve) => {
      hostPending.set(i, resolve);
      frame.contentWindow.postMessage({ __bmEngineHost: true, i, ...msg }, "*");
      setTimeout(() => {
        if (!hostPending.has(i)) return;
        hostPending.delete(i);
        resolve({ ok: false, error: "engine host did not answer" });
      }, 20000);
    });
  }

  function hostSend(msg) {
    if (!hostFrame) return;
    hostFrame.contentWindow.postMessage({ __bmEngineHost: true, ...msg }, "*");
  }
})();
