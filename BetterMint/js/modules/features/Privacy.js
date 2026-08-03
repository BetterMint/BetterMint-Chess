function parseHotkey(str) {
  const parts = String(str || "").split("+").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return null;
  const key = parts[parts.length - 1];
  return {
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    meta: parts.includes("meta") || parts.includes("cmd"),
    key,
  };
}

function matchesHotkey(e, hk) {
  if (!hk) return false;
  if (!!hk.ctrl !== e.ctrlKey || !!hk.shift !== e.shiftKey || !!hk.alt !== e.altKey || !!hk.meta !== e.metaKey) return false;
  const k = String(e.key || "").toLowerCase();
  return k === hk.key || (hk.key === "backspace" && k === "backspace");
}

export class Privacy {
  constructor(app) {
    this.app = app;
    this.settings = app.settings;
    this.hidden = false;
    this.panicked = false;
    this._listeners = [];
    this._captureTimer = null;
  }

  install() {
    this._onKey = (e) => this._handleKey(e);
    window.addEventListener("keydown", this._onKey, true);
    this._listeners.push(() => window.removeEventListener("keydown", this._onKey, true));

    this._onBlur = () => {
      if (this.settings.get("priv.autoHideOnBlur")) this.setHidden(true);
    };
    this._onFocus = () => {
      if (this.settings.get("priv.autoHideOnBlur") && !this.panicked) this.setHidden(false);
    };
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("focus", this._onFocus);
    this._listeners.push(() => {
      window.removeEventListener("blur", this._onBlur);
      window.removeEventListener("focus", this._onFocus);
    });

    this._onVisibility = () => {
      if (!this.settings.get("priv.autoHideOnBlur")) return;
      this.setHidden(document.visibilityState !== "visible");
    };
    document.addEventListener("visibilitychange", this._onVisibility);
    this._listeners.push(() => document.removeEventListener("visibilitychange", this._onVisibility));

    this._onUnload = () => {
      if (this.settings.get("priv.stripOnUnload")) this.scrub();
    };
    window.addEventListener("pagehide", this._onUnload);
    window.addEventListener("beforeunload", this._onUnload);
    this._listeners.push(() => {
      window.removeEventListener("pagehide", this._onUnload);
      window.removeEventListener("beforeunload", this._onUnload);
    });

    if (this.settings.get("priv.hideOnScreenshare")) this._watchScreenShare();
  }

  _handleKey(e) {
    const panic = parseHotkey(this.settings.get("priv.panicHotkey"));
    if (matchesHotkey(e, panic)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.panic();
      return;
    }
    const reveal = parseHotkey(this.settings.get("handbrain.revealHotkey"));
    if (this.app.handBrain?.enabled && matchesHotkey(e, reveal)) {
      e.preventDefault();
      const uci = this.app.handBrain.reveal();
      if (uci) {
        this.app.overlay.addArrow(uci.slice(0, 2), uci.slice(2, 4), this.settings.get("ui.arrowColor1"), { label: "!" });
        setTimeout(() => this.app.overlay.clearArrows(), 1600);
      }
    }
  }

  _watchScreenShare() {
    const md = navigator.mediaDevices;
    if (!md?.getDisplayMedia) return;
    const orig = md.getDisplayMedia.bind(md);
    md.getDisplayMedia = async (...args) => {
      const stream = await orig(...args);
      this.setHidden(true);
      this.app.log("[priv] display capture started — visuals hidden");
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", () => {
          if (!this.panicked) this.setHidden(false);
        });
      }
      return stream;
    };
    this._listeners.push(() => { md.getDisplayMedia = orig; });

    this._captureTimer = setInterval(() => {
      if (!this.settings.get("priv.hideOnScreenshare")) return;
      const sharing = document.querySelector("[class*='screen-share'],[class*='sharing-indicator']");
      if (sharing && !this.hidden) this.setHidden(true);
    }, 4000);
    this._listeners.push(() => clearInterval(this._captureTimer));
  }

  setHidden(hidden) {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    this.app.overlay.setHidden?.(hidden);
    this.app.hud.setVisible(hidden ? false : this.settings.get("ui.hud"));
  }

  panic() {
    this.panicked = true;
    this.app.log("[priv] PANIC");
    try { this.app.overlayWindow.close(); } catch {}
    try { this.app.overlay.clear(); } catch {}
    try { this.app.overlay.detach(); } catch {}
    try { this.app.hud.unmount(); } catch {}
    try { this.app.engineManager.destroyAll(); } catch {}
    try { this.app.detector.stop(); } catch {}
    try { this.app.exploits.destroy(); } catch {}
    try { clearInterval(this.app._fenTimer); } catch {}
    try { window.speechSynthesis.cancel(); } catch {}
    if (this.settings.get("priv.panicWipes")) this.wipe();
    this.scrub();
  }

  async wipe() {
    try {
      await this.settings.requestRaw("settings.reset", {}, 3000);
    } catch {}
    try {
      this.app.bookManager.clearCaches();
    } catch {}
    try {
      for (const k of Object.keys(localStorage)) {
        if (/bettermint|bm_|ux\.core/i.test(k)) localStorage.removeItem(k);
      }
    } catch {}
  }

  scrub() {
    for (const d of this._listeners.splice(0)) {
      try { d(); } catch {}
    }
    try { this.app.hud.shadow.unmount(); } catch {}
    try { this.app.overlay.shadow.unmount(); } catch {}
    try {
      delete window[Symbol.for("ux.core")];
    } catch {}
  }
}
