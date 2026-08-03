// A stand-in for WebSocket that is actually opened inside the extension's
// engine host frame.
//
// connect-src decides which origins a document may open a socket to, and sites
// state it as an allowlist: lichess permits its own sockets and nothing else,
// so a connection the page opens is refused before it leaves the browser. That
// applies to the hosted socket engines and to ws://127.0.0.1:8000 alike, and it
// cannot be undone by rewriting response headers because lichess delivers the
// policy in a meta tag.
//
// The engine host frame is served from the extension, so it carries the
// extension's policy instead and can connect anywhere. This class forwards the
// small surface the engine code actually uses across that bridge.

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

let seq = 0;
const live = new Map();
let attachedBridge = null;

export function attachRelaySockets(bridge) {
  if (!bridge || attachedBridge === bridge) return;
  attachedBridge = bridge;
  bridge.onPush("socket.event", ({ socketId, event, data, code, reason }) => {
    live.get(socketId)?._handle(event, data, code, reason);
  });
}

export class RelaySocket {
  static get CONNECTING() { return CONNECTING; }
  static get OPEN() { return OPEN; }
  static get CLOSING() { return CLOSING; }
  static get CLOSED() { return CLOSED; }

  constructor(bridge, url) {
    this.url = url;
    this.readyState = CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this._bridge = bridge;
    this._id = `s${++seq}`;
    live.set(this._id, this);
    attachRelaySockets(bridge);

    bridge.socketOpen(this._id, url)
      .then((res) => {
        // the frame refused it outright, so nothing will ever arrive
        if (!res || res.ok === false) this._handle("error");
      })
      .catch(() => this._handle("error"));
  }

  _handle(event, data, code, reason) {
    if (event === "open") {
      this.readyState = OPEN;
      this.onopen?.({ type: "open" });
    } else if (event === "message") {
      this.onmessage?.({ data });
    } else if (event === "error") {
      // an error before opening is fatal, and no close will follow it
      this.onerror?.({ type: "error" });
      if (this.readyState === CONNECTING) this._handle("close", null, 1006, "failed to connect");
    } else if (event === "close") {
      if (this.readyState === CLOSED) return;
      this.readyState = CLOSED;
      live.delete(this._id);
      this.onclose?.({ code: code ?? 1006, reason: reason || "" });
    }
  }

  send(data) {
    if (this.readyState !== OPEN) return;
    this._bridge.socketSend(this._id, String(data)).catch(() => {});
  }

  close() {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSING;
    live.delete(this._id);
    this._bridge.socketClose(this._id).catch(() => {});
    this.readyState = CLOSED;
  }
}

// The relay is only needed inside a page. Anywhere already running on the
// extension's own origin can just use the real thing.
export function makeSocket(bridge, url) {
  if (bridge && typeof bridge.socketOpen === "function") return new RelaySocket(bridge, url);
  return new WebSocket(url);
}
