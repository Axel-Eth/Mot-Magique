import { hostWindow } from "./bridge.js";
import { initDraggableLetters, initFloatingLetters, startLettersPhysics } from "./letters.js";
import { initBackgroundTheme } from "./background.js";
import { registerMessageHandlers } from "./messages.js";
import { initTitleDrag } from "./title.js";

registerMessageHandlers();
initBackgroundTheme();
initFloatingLetters();
initDraggableLetters();
startLettersPhysics();
initTitleDrag();

const host = hostWindow();
if (host) {
  host.postMessage({ type: "PLATEAU_READY" }, "*");
}
