import { hostWindow } from "./bridge.js";
import { initBackgroundBubbles, initDraggableLetters, initFloatingLetters, startLettersPhysics } from "./letters.js";
import { registerMessageHandlers } from "./messages.js";
import { initTitleDrag } from "./title.js";

registerMessageHandlers();
initBackgroundBubbles();
initFloatingLetters();
initDraggableLetters();
startLettersPhysics();
initTitleDrag();

const host = hostWindow();
if (host) {
  host.postMessage({ type: "PLATEAU_READY" }, "*");
}
