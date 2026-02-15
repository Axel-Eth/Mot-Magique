import { gridEl } from "./dom.js";

const FORBIDDEN_RECT = 24;
const LETTER_REPULSE_MARGIN = 14;
const LETTER_REPULSE_STRENGTH = 0.16;
const LETTER_FRICTION = 0.88;

let floatingLettersRoot = null;
const letterPhysics = new WeakMap();
let lettersPhysicsHandle = null;

function ensureFloatingLettersRoot() {
  if (floatingLettersRoot) return floatingLettersRoot;
  const root = document.createElement("div");
  root.className = "floating-letters";
  const host = document.getElementById("lettersLayer") || document.body;
  host.appendChild(root);
  floatingLettersRoot = root;
  return root;
}

function getForbiddenRect() {
  const rect = gridEl?.getBoundingClientRect();
  if (!rect) return null;
  return {
    left: rect.left - FORBIDDEN_RECT,
    right: rect.right + FORBIDDEN_RECT,
    top: rect.top - FORBIDDEN_RECT,
    bottom: rect.bottom + FORBIDDEN_RECT
  };
}

function isPointInsideRect(x, y, rect) {
  return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function projectPointOutsideRect(x, y, rect) {
  if (!rect) return { x, y };
  const distLeft = Math.abs(x - rect.left);
  const distRight = Math.abs(rect.right - x);
  const distTop = Math.abs(y - rect.top);
  const distBottom = Math.abs(rect.bottom - y);
  const min = Math.min(distLeft, distRight, distTop, distBottom);

  if (min === distLeft) return { x: rect.left - 1, y };
  if (min === distRight) return { x: rect.right + 1, y };
  if (min === distTop) return { x, y: rect.top - 1 };
  return { x, y: rect.bottom + 1 };
}

function clampToViewport(x, y, w, h) {
  const maxX = Math.max(0, window.innerWidth - w);
  const maxY = Math.max(0, window.innerHeight - h);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY)
  };
}

function findValidPosition(w, h) {
  const rect = getForbiddenRect();
  const tries = 20;
  for (let i = 0; i < tries; i++) {
    const x = Math.random() * Math.max(0, window.innerWidth - w);
    const y = Math.random() * Math.max(0, window.innerHeight - h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (!isPointInsideRect(cx, cy, rect)) return { x, y };
  }
  const cx = Math.random() * window.innerWidth;
  const cy = Math.random() * window.innerHeight;
  const projected = projectPointOutsideRect(cx, cy, rect);
  return clampToViewport(projected.x - w / 2, projected.y - h / 2, w, h);
}

function nudgeElementOutsideForbidden(el, fallbackSize) {
  const rect = getForbiddenRect();
  if (!rect) return;
  const rectEl = el.getBoundingClientRect();
  const w = rectEl.width || fallbackSize;
  const h = rectEl.height || fallbackSize;
  const cx = rectEl.left + w / 2;
  const cy = rectEl.top + h / 2;
  if (!isPointInsideRect(cx, cy, rect)) return;
  const projected = projectPointOutsideRect(cx, cy, rect);
  const target = clampToViewport(projected.x - w / 2, projected.y - h / 2, w, h);
  el.style.left = `${target.x}px`;
  el.style.top = `${target.y}px`;
}

export function scatterFloatingLetters() {
  const elements = document.querySelectorAll(".floating-letter, .draggable-letter");
  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const w = rect.width || 160;
    const h = rect.height || 160;
    const pos = findValidPosition(w, h);
    el.style.transition = "left 1.2s ease-in-out, top 1.2s ease-in-out";
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    window.setTimeout(() => {
      el.style.transition = "";
    }, 1300);
  });
}

function getLetterState(el) {
  let state = letterPhysics.get(el);
  if (!state) {
    state = { x: 0, y: 0, vx: 0, vy: 0 };
    letterPhysics.set(el, state);
  }
  return state;
}

function tickLettersPhysics() {
  const elements = Array.from(document.querySelectorAll(".floating-letter, .draggable-letter"));
  const items = elements.map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      el,
      rect,
      dragging: el.classList.contains("dragging"),
      state: getLetterState(el)
    };
  });

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const ax = a.rect.left + a.rect.width / 2;
      const ay = a.rect.top + a.rect.height / 2;
      const bx = b.rect.left + b.rect.width / 2;
      const by = b.rect.top + b.rect.height / 2;
      let dx = bx - ax;
      let dy = by - ay;
      let dist = Math.hypot(dx, dy);
      const minDist = a.rect.width / 2 + b.rect.width / 2 + LETTER_REPULSE_MARGIN;

      if (dist < 0.001) {
        dx = (Math.random() - 0.5) * 0.01;
        dy = (Math.random() - 0.5) * 0.01;
        dist = Math.hypot(dx, dy);
      }

      if (dist < minDist) {
        const overlap = minDist - dist;
        const force = (overlap / minDist) * LETTER_REPULSE_STRENGTH;
        const nx = dx / dist;
        const ny = dy / dist;

        if (!a.dragging) {
          a.state.vx -= nx * force;
          a.state.vy -= ny * force;
        }
        if (!b.dragging) {
          b.state.vx += nx * force;
          b.state.vy += ny * force;
        }
      }
    }
  }

  items.forEach((item) => {
    if (item.dragging) {
      item.state.vx = 0;
      item.state.vy = 0;
      return;
    }
    item.state.vx *= LETTER_FRICTION;
    item.state.vy *= LETTER_FRICTION;
    item.state.x += item.state.vx;
    item.state.y += item.state.vy;
    item.el.style.translate = `${item.state.x}px ${item.state.y}px`;
  });

  lettersPhysicsHandle = requestAnimationFrame(tickLettersPhysics);
}

export function startLettersPhysics() {
  if (lettersPhysicsHandle) return;
  lettersPhysicsHandle = requestAnimationFrame(tickLettersPhysics);
}

async function loadLetterImages() {
  try {
    const res = await fetch("illustrations/lettres/", { cache: "no-store" });
    if (!res.ok) return [];
    const html = await res.text();
    const regex = /href="([^"]+\.png)"/gi;
    const files = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const clean = raw.replace(/[#?].*$/, "");
      const name = clean.split("/").pop();
      if (!name) continue;
      files.push(`illustrations/lettres/${name}`);
    }
    if (!files.length) {
      const fallback = html.match(/([\w\-]+\.png)/gi) || [];
      fallback.forEach((name) => {
        files.push(`illustrations/lettres/${name}`);
      });
    }
    return [...new Set(files)];
  } catch {
    return [];
  }
}

function spawnFloatingLetter(src) {
  const root = ensureFloatingLettersRoot();
  const img = document.createElement("img");
  img.className = "floating-letter";
  img.src = src;
  img.draggable = false;
  const size = 140 + Math.random() * 200;
  img.style.width = `${size}px`;
  const pos = findValidPosition(size, size);
  img.style.left = `${pos.x}px`;
  img.style.top = `${pos.y}px`;
  img.style.animationDelay = `${Math.random() * 6}s`;
  img.style.animationDuration = `${10 + Math.random() * 10}s`;
  img.style.opacity = "1";
  img.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    const rect = img.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    img.style.left = `${rect.left}px`;
    img.style.top = `${rect.top}px`;
    img.classList.add("dragging");

    const onMove = (moveEvent) => {
      img.style.left = `${moveEvent.clientX - offsetX}px`;
      img.style.top = `${moveEvent.clientY - offsetY}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      img.releasePointerCapture(event.pointerId);
      img.classList.remove("dragging");
      nudgeElementOutsideForbidden(img, size);
    };

    img.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
  root.appendChild(img);
}

export async function initFloatingLetters() {
  const files = await loadLetterImages();
  if (!files.length) return;
  const count = Math.min(14, Math.max(8, files.length));
  for (let i = 0; i < count; i++) {
    const src = files[Math.floor(Math.random() * files.length)];
    spawnFloatingLetter(src);
  }
}

export function initBackgroundBubbles() {
  const root = document.querySelector("#bg .bg-bubbles");
  if (!root) return;
  root.innerHTML = "";
  const colors = [
    "rgba(102,212,255,.85)",
    "rgba(255,214,102,.85)",
    "rgba(255,153,204,.85)",
    "rgba(168,120,255,.85)"
  ];
  for (let i = 0; i < 40; i++) {
    const bubble = document.createElement("div");
    bubble.className = "bg-bubble";
    const size = 90 + Math.random() * 220;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    bubble.style.top = `${Math.random() * 100}%`;
    bubble.style.background = `radial-gradient(circle at 30% 30%, ${colors[i % colors.length]}, rgba(255,255,255,0) 70%)`;
    bubble.style.setProperty("--dx", `${-30 + Math.random() * 60}px`);
    bubble.style.setProperty("--dy", `${-40 + Math.random() * 80}px`);
    bubble.style.setProperty("--dur", `${3 + Math.random() * 5}s`);
    bubble.style.setProperty("--delay", `${Math.random() * 2}s`);
    root.appendChild(bubble);
  }
}

function createDraggableLetter(src) {
  const box = document.createElement("div");
  box.className = "draggable-letter";
  const img = document.createElement("img");
  img.src = src;
  img.alt = "Lettre";
  box.appendChild(img);
  const host = document.getElementById("lettersLayer") || document.body;
  host.appendChild(box);
  const size = 220;
  const pos = findValidPosition(size, size);
  box.style.left = `${pos.x}px`;
  box.style.top = `${pos.y}px`;
  box.style.transform = `rotate(${(-12 + Math.random() * 24).toFixed(1)}deg)`;
  box.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  box.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = box.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    box.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.max(0, e.clientX - offsetX);
    const y = Math.max(0, e.clientY - offsetY);
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    box.classList.remove("dragging");
    nudgeElementOutsideForbidden(box, size);
  });
}

export async function initDraggableLetters() {
  const files = await loadLetterImages();
  if (!files.length) return;
  const count = Math.min(files.length, 12);
  for (let i = 0; i < count; i++) {
    const src = files[i];
    createDraggableLetter(src);
  }
}
