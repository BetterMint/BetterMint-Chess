// Worker wrapper for lichess's Stockfish 18 dev build (lila-stockfish-web).
//
// That build is an ES module exposing uci() and a listen callback rather than a
// stdin/stdout worker, and it refuses to evaluate a position without its NNUE
// network, so both are arranged here and plain UCI is accepted from outside.
//
// Being a real extension script rather than a blob keeps it on the extension's
// origin, which is what lets it import the module and spawn its own threads.
const cfg = JSON.parse(decodeURIComponent(self.location.hash.slice(1)));

const say = (text) => postMessage(String(text));

// Its threads are independent workers: terminating this one does not stop them,
// and with a network this size the memory they hold matters.
const kids = [];
const OrigWorker = self.Worker;
self.Worker = function (url, opts) {
  if (kids.length >= 32) throw new Error("engine requested too many threads");
  const w = new OrigWorker(url, opts);
  kids.push(w);
  return w;
};

let engine = null;
const pending = [];

(async () => {
  try {
    const mod = await import(cfg.js);
    const make = mod.default || mod.Stockfish || Object.values(mod).find((v) => typeof v === "function");
    if (typeof make !== "function") {
      say("info string stockfish 18 module exposed no factory");
      return;
    }
    engine = await make();
    engine.listen = say;
    engine.onError = (e) => say("info string " + (e && e.message ? e.message : e));
    if (cfg.nnue) {
      const res = await fetch(cfg.nnue);
      engine.setNnueBuffer(new Uint8Array(await res.arrayBuffer()));
    }
    for (const cmd of pending) engine.uci(cmd);
    pending.length = 0;
  } catch (err) {
    say("info string stockfish 18 init failed: " + (err && err.message ? err.message : err));
  }
})();

self.onmessage = (e) => {
  const cmd = String(e.data);
  if (cmd === "__terminate__") {
    for (const kid of kids) {
      try { kid.terminate(); } catch {}
    }
    kids.length = 0;
    engine = null;
    setTimeout(() => self.close(), 50);
    return;
  }
  if (engine) {
    try { engine.uci(cmd); } catch (err) { say("info string " + err.message); }
  } else {
    pending.push(cmd);
  }
};
