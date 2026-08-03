// Worker wrapper for chess.com's explanation engine (Komodo TEP).
//
// The bundle already knows how to be a worker: when imported into one it reads
// its wasm location from the URL fragment, creates the engine, and installs its
// own message handler that dispatches commands synchronously (its asynchronous
// path schedules a property of its handler that does not exist, so commands sent
// that way are silently dropped). All of that is left to it. This file only
// arranges the two things it cannot do for itself here:
//
//   - it builds one function from a string, which an extension may not permit
//   - it announces itself with a banner rather than a UCI id line
//
// The engine bundle's own location is passed in the query string, because the
// fragment has to stay exactly the wasm URL for the bundle to find it.
(() => {
  const jsUrl = new URLSearchParams(self.location.search).get("js");

  // Emscripten's embind builds a named wrapper for a generated error class by
  // evaluating a string. Evaluating strings is forbidden here and cannot be
  // allowed - an extension may not ask for unsafe-eval - but the constructor is
  // looked up on the global object, and the body being wrapped is handed in as
  // an argument, so an equivalent that evaluates nothing loses only the name.
  const NativeFunction = self.Function;
  const ShimFunction = function (...args) {
    const source = String(args[args.length - 1] || "");
    const named = /return function\s*([A-Za-z0-9_$]*)\s*\(/.exec(source);
    if (args.length === 2 && args[0] === "body" && named) {
      return function (body) {
        const wrapper = function () {
          return body.apply(this, arguments);
        };
        try {
          Object.defineProperty(wrapper, "name", { value: named[1] || "_unknown" });
        } catch {}
        return wrapper;
      };
    }
    throw new EvalError("building a function from a string is not available here");
  };
  ShimFunction.prototype = NativeFunction.prototype;
  self.Function = ShimFunction;

  // Everything the engine reports goes out through postMessage, so wrapping it
  // is enough to turn its banner into an id name line and have the engine name
  // itself in the interface like every other one.
  const nativePost = self.postMessage.bind(self);
  let named = false;
  self.postMessage = (data, ...rest) => {
    if (typeof data === "string" && !named && /^Explanation Engine\s/i.test(data)) {
      named = true;
      nativePost("id name " + data.replace(/\s*\(C\).*$/i, "").trim());
    }
    return nativePost(data, ...rest);
  };

  // The bundle owns onmessage, so shutdown is observed alongside it rather than
  // by replacing it.
  self.addEventListener("message", (e) => {
    if (String(e.data) !== "__terminate__") return;
    setTimeout(() => self.close(), 50);
  });

  try {
    importScripts(jsUrl);
  } catch (e) {
    nativePost("info string explanation engine failed to load: " + (e && e.message ? e.message : e));
  }
})();
