import { $ } from "./dom.js";

let timerHandle = null;
let timerEndsAt = 0;

function updateDisplay() {
  const text = $("regieTimerText");
  if (!text) return;
  const remaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  text.textContent = `${mm}:${ss}`;
  if (remaining <= 0) {
    resetRegieTimer();
    return;
  }
  timerHandle = window.setTimeout(updateDisplay, 250);
}

export function startRegieTimer(seconds) {
  const win = $("regieTimerWindow");
  if (!win) return;
  if (timerHandle) clearTimeout(timerHandle);
  timerHandle = null;
  timerEndsAt = Date.now() + Number(seconds || 0) * 1000;
  win.classList.remove("hidden");
  updateDisplay();
}

export function resetRegieTimer() {
  const win = $("regieTimerWindow");
  if (timerHandle) clearTimeout(timerHandle);
  timerHandle = null;
  timerEndsAt = 0;
  win?.classList.add("hidden");
}

export function initRegieTimerDrag() {
  const win = $("regieTimerWindow");
  const handle = $("regieTimerHandle");
  const closeBtn = $("regieTimerClose");
  if (!win || !handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const left = Math.max(8, e.clientX - offsetX);
    const top = Math.max(8, e.clientY - offsetY);
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.style.right = "auto";
    win.style.bottom = "auto";
  };

  const stop = () => {
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", stop);
  };

  handle.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const rect = win.getBoundingClientRect();
    dragging = true;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetRegieTimer();
  });
}
