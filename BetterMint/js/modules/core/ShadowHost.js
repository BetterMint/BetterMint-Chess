const ADJECTIVES = ["swift", "calm", "bright", "deep", "prime", "nova", "flux", "onyx", "zen", "arc"];
const NOUNS = ["view", "wrap", "box", "zone", "cell", "grid", "pane", "dock", "slot", "unit"];
const randomToken = () => {
  const a = ADJECTIVES[(Math.random() * ADJECTIVES.length) | 0];
  const n = NOUNS[(Math.random() * NOUNS.length) | 0];
  const num = (Math.random() * 0xffff) | 0;
  return `${a}-${n}-${num.toString(36)}`;
};

export class ShadowHost {
  constructor(tagName = "div") {
    this.className = randomToken();
    this.host = document.createElement(tagName);
    this.host.className = this.className;
    // z-index:auto left the HUD underneath site chrome (worldchess paints up
    // to 1401), so it has to sit above the page to be usable at all.
    this.host.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;pointer-events:none;";
    this.root = this.host.attachShadow({ mode: "closed" });
    this.styleEl = document.createElement("style");
    this.root.appendChild(this.styleEl);
    this.container = document.createElement("div");
    this.root.appendChild(this.container);
  }

  setCSS(css) {
    this.styleEl.textContent = css;
  }

  addCSS(css) {
    this.styleEl.textContent += "\n" + css;
  }

  // documentElement rather than body: single-page apps re-render the body
  // subtree when you navigate into a game and take our host with it.
  mount(parent = document.documentElement) {
    this._parent = parent;
    parent.appendChild(this.host);
    this._keepMounted();
    return this;
  }

  // If the site's framework detaches us anyway, put ourselves back.
  _keepMounted() {
    if (this._watchTimer) return;
    this._watchTimer = setInterval(() => {
      if (document.contains(this.host)) return;
      const parent = this._parent && document.contains(this._parent)
        ? this._parent
        : document.documentElement;
      try { parent.appendChild(this.host); } catch {}
    }, 700);
  }

  unmount() {
    clearInterval(this._watchTimer);
    this._watchTimer = null;
    this.host.remove();
  }

  setInteractive(on) {
    this.host.style.pointerEvents = on ? "auto" : "none";
  }

  setPosition({ left, top, right, bottom, width, height } = {}) {
    const s = this.host.style;
    if (left != null) s.left = typeof left === "number" ? left + "px" : left;
    if (top != null) s.top = typeof top === "number" ? top + "px" : top;
    if (right != null) s.right = typeof right === "number" ? right + "px" : right;
    if (bottom != null) s.bottom = typeof bottom === "number" ? bottom + "px" : bottom;
    if (width != null) s.width = typeof width === "number" ? width + "px" : width;
    if (height != null) s.height = typeof height === "number" ? height + "px" : height;
  }
}

export function randomId(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10);
}
