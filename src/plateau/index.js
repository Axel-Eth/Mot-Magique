import { hostWindow } from "./bridge.js";
import { applyFloatingDecorTheme, startLettersPhysics } from "./letters.js";
import { initBackgroundTheme } from "./background.js";
import { registerMessageHandlers } from "./messages.js";
import { initTitleDrag } from "./title.js";

registerMessageHandlers();
const theme = initBackgroundTheme();
applyFloatingDecorTheme(theme);
startLettersPhysics();
initTitleDrag();

const host = hostWindow();
if (host) {
  host.postMessage({ type: "PLATEAU_READY" }, "*");
}
