import { state } from "./state.js";

export function postToPlateau(msg) {
  if (state.plateauWin && !state.plateauWin.closed) {
    try {
      state.plateauWin.postMessage(msg, "*");
    } catch (err) {
      console.error("postToPlateau error:", err);
    }
  }
}
