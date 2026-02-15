import { CHANNEL_NAME } from "./constants.js";

export class Comm {
  constructor() {
    this.bc = new BroadcastChannel(CHANNEL_NAME);
    this._listeners = new Set();

    this.bc.onmessage = (ev) => {
      for (const fn of this._listeners) fn(ev.data);
    };

    // fallback sync inter-tabs via storage event (si besoin)
    window.addEventListener("storage", (e) => {
      if (e.key === null) return;
      // on ne spam pas; la vraie sync d’état passe par messages explicites
    });
  }

  send(msg) {
    this.bc.postMessage(msg);
  }

  onMessage(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}
