/**
 * Rive runtime wrapper for animated coach avatars with lip-sync support.
 * Dynamically loads the Rive WASM runtime from CDN, creates a Rive canvas
 * instance for a given .riv file, and provides play/stop/talk controls.
 * Falls back gracefully to a static image if Rive fails to load.
 */

const RIVE_CDN = "https://unpkg.com/@rive-app/canvas@2.17.3";

let _rivePromise = null;
let _riveReady = false;

function _loadRive() {
  if (_rivePromise) return _rivePromise;
  if (_riveReady && typeof window.rive !== "undefined") return Promise.resolve(window.rive);
  _rivePromise = new Promise((resolve, reject) => {
    if (typeof window.rive !== "undefined") {
      _riveReady = true;
      resolve(window.rive);
      return;
    }
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = RIVE_CDN;
    script.async = true;
    script.onload = () => {
      if (typeof window.rive !== "undefined") {
        _riveReady = true;
        resolve(window.rive);
      } else {
        reject(new Error("Rive loaded but window.rive not available"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Rive runtime from CDN"));
    document.head.appendChild(script);
  });
  return _rivePromise;
}

const TALK_INPUT_NAMES = ["talk", "talking", "isTalking", "is_talking", "speak", "speaking", "isSpeaking", "mouth", "lipsync", "lipSync", "voice"];

export class RiveAvatar {
  /**
   * @param {HTMLElement} container - element to mount the canvas into
   * @param {object} opts
   * @param {string} opts.src - .riv file URL
   * @param {string} [opts.fallbackUrl] - static image URL if Rive fails
   * @param {string} [opts.alt] - alt text for fallback image
   * @param {string} [opts.stateMachine] - preferred state machine name
   * @param {string} [opts.animation] - preferred animation name
   * @param {boolean} [opts.autoplay] - default true
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { autoplay: true, ...opts };
    this._instance = null;
    this._canvas = null;
    this._failed = false;
    this._fallbackImg = null;
    this._talkInput = null;
    this._init();
  }

  async _init() {
    if (!this.opts.src) {
      this._showFallback();
      return;
    }
    try {
      const rive = await _loadRive();
      const RiveClass = rive.Rive || rive;
      if (typeof RiveClass !== "function") throw new Error("Rive constructor not available");
      const canvas = document.createElement("canvas");
      canvas.width = 120;
      canvas.height = 120;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      this._canvas = canvas;
      this.container.appendChild(canvas);

      const riveOpts = {
        src: this.opts.src,
        canvas,
        autoplay: this.opts.autoplay,
        layout: new rive.Layout({
          fit: rive.Fit.Contain,
          alignment: rive.Alignment.Center,
        }),
        onLoad: () => this._onRiveLoad(),
        onLoadError: (err) => { throw err; },
      };

      if (this.opts.stateMachine) {
        riveOpts.stateMachines = this.opts.stateMachine;
      } else if (this.opts.animation) {
        riveOpts.animations = this.opts.animation;
      } else {
        riveOpts.stateMachines = "State Machine";
      }

      this._instance = new rive.Rive(riveOpts);
    } catch (err) {
      this._failed = true;
      this._cleanup();
      this._showFallback();
    }
  }

  _onRiveLoad() {
    if (!this._instance) return;
    try {
      const names = this._instance.stateMachineNames || [];
      const anims = this._instance.animationNames || [];

      if (names.length) {
        const target = this.opts.stateMachine && names.includes(this.opts.stateMachine) ? this.opts.stateMachine : names[0];
        this._instance.play(target);
      } else if (anims.length) {
        const target = this.opts.animation && anims.includes(this.opts.animation) ? this.opts.animation : anims[0];
        this._instance.play(target);
      }

      this._findTalkInput();
    } catch {}
  }

  _findTalkInput() {
    this._talkInput = null;
    if (!this._instance) return;
    try {
      const names = this._instance.stateMachineNames || [];
      for (const smName of names) {
        let inputs = [];
        if (typeof this._instance.stateMachineInputs === "function") {
          inputs = this._instance.stateMachineInputs(smName) || [];
        } else if (this._instance.inputs) {
          inputs = this._instance.inputs;
        }
        for (const name of TALK_INPUT_NAMES) {
          const input = inputs.find((i) => (i.name || "").toLowerCase() === name.toLowerCase());
          if (input) {
            this._talkInput = input;
            return;
          }
        }
      }
    } catch {}
  }

  _showFallback() {
    if (!this.opts.fallbackUrl) return;
    this._cleanup();
    const img = document.createElement("img");
    img.src = this.opts.fallbackUrl;
    img.alt = this.opts.alt || "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.onerror = () => { img.style.display = "none"; };
    this._fallbackImg = img;
    this.container.appendChild(img);
  }

  _cleanup() {
    if (this._canvas) {
      this._canvas.remove();
      this._canvas = null;
    }
    if (this._fallbackImg) {
      this._fallbackImg.remove();
      this._fallbackImg = null;
    }
  }

  play(name) {
    if (this._instance && !this._failed) {
      try { this._instance.play(name); } catch {}
    }
  }

  pause(name) {
    if (this._instance && !this._failed) {
      try { this._instance.pause(name); } catch {}
    }
  }

  stop() {
    if (this._instance && !this._failed) {
      try { this._instance.stop(); } catch {}
    }
  }

  setTalk(value) {
    if (!this._talkInput) return;
    try {
      if (typeof this._talkInput.value === "number") {
        this._talkInput.value = value ? 1 : 0;
      } else if (typeof this._talkInput.fire === "function") {
        if (value) this._talkInput.fire();
      } else {
        this._talkInput.value = !!value;
      }
    } catch {}
  }

  destroy() {
    this.setTalk(false);
    if (this._instance) {
      try { this._instance.cleanup(); } catch {}
      this._instance = null;
    }
    this._cleanup();
  }

  get isAnimated() {
    return !!this._instance && !this._failed;
  }
}
