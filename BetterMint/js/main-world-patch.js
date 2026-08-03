(() => {
  try {
    const WRAPPED = new Set([
      "mousedown", "mouseup", "mousemove", "click", "dblclick",
      "pointerdown", "pointerup", "pointermove", "pointercancel",
      "touchstart", "touchend", "touchmove", "keydown", "keyup",
    ]);
    const origAdd = EventTarget.prototype.addEventListener;
    const origRemove = EventTarget.prototype.removeEventListener;
    const trustProxy = (e) => new Proxy(e, {
      get(target, prop) {
        if (prop === "isTrusted") return true;
        const value = target[prop];
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
    const wrap = (listener) => {
      if (typeof listener !== "function") return listener;
      if (listener.__uxWrapped) return listener.__uxWrapped;
      const wrapped = function (e) {
        if (e && e.__uxT) {
          try {
            return listener.call(this, trustProxy(e));
          } catch {
            return listener.call(this, e);
          }
        }
        return listener.call(this, e);
      };
      listener.__uxWrapped = wrapped;
      return wrapped;
    };
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (listener && WRAPPED.has(type)) {
        return origAdd.call(this, type, wrap(listener), options);
      }
      return origAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      return origRemove.call(this, type, listener?.__uxWrapped || listener, options);
    };
  } catch {}
})();
