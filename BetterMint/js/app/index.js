import { App } from "../modules/core/App.js";

(() => {
  const KEY = Symbol.for("ux.core");
  if (window[KEY]) return;
  const app = new App();
  Object.defineProperty(window, KEY, { value: app });
  const boot = () => {
    app.init().catch(() => {});
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
