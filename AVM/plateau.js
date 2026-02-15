/* ============================================================
   À vos mots ! — plateau.js
   Logique complète du plateau d'affichage
   ============================================================ */

/* ---------- Sélecteurs DOM ---------- */
const gridEl = document.getElementById("grid");
const defBar = document.getElementById("definitionBar");
const defText = document.getElementById("definitionText");
const timerEl = document.getElementById("plateauTimer");

/* ---------- Floating letters ---------- */
const FORBIDDEN_RECT = 24;
let floatingLettersRoot = null;
const LETTER_REPULSE_MARGIN = 14;
const LETTER_REPULSE_STRENGTH = 0.16;
const LETTER_FRICTION = 0.88;
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

function scatterFloatingLetters() {
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

function startLettersPhysics() {
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
    const fallback = html.match(/([\\w\\-]+\\.png)/gi) || [];
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

async function initFloatingLetters() {
  const files = await loadLetterImages();
  if (!files.length) return;
  const count = Math.min(14, Math.max(8, files.length));
  for (let i = 0; i < count; i++) {
    const src = files[Math.floor(Math.random() * files.length)];
    spawnFloatingLetter(src);
  }
}

function initBackgroundBubbles() {
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

function createDraggableLetter(src, left, top) {
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

async function initDraggableLetters() {
  const files = await loadLetterImages();
  if (!files.length) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const count = Math.min(files.length, 12);
  for (let i = 0; i < count; i++) {
    const src = files[i];
    const left = 20 + Math.random() * (vw - 160);
    const top = 40 + Math.random() * (vh - 200);
    createDraggableLetter(src, left, top);
  }
}

/* ---------- État ---------- */
let grid = null;                 // Grille courante (Maps reconstruites)
let selectedWordId = null;       // Mot actuellement sélectionné
let tempNumbers = new Set();     // Numéros affichés temporairement
let gridCompletePlayed = false;  // Pour éviter rejouer l'anim finale
let timerHandle = null;
let timerEndsAt = 0;

/* ---------- Sons ---------- */
const sounds = {
  ambient: new Audio("sounds/ambiance.wav"),
  correct: new Audio("sounds/correct_answer.mp3"),
  wrong: new Audio("sounds/wrong.wav"),
  gridComplete: new Audio("sounds/grid_complete.wav"),
  timer: new Audio("sounds/timer.wav"),
  reveal: new Audio("sounds/lettre_revele_regie.mp3"),
  fail: new Audio("sounds/fail_sound_effect.mp3"),
  selectWord: new Audio("sounds/selection_mot_grille.mp3"),
  magicSelect: new Audio("sounds/Magic_Word_Countdown.mp3")
};

sounds.ambient.loop = true;

const musicPlayer = new Audio();
musicPlayer.loop = false;
musicPlayer.addEventListener("play", notifyFxStart);
musicPlayer.addEventListener("ended", notifyFxEnd);

const plateauMusicPlayer = new Audio();
plateauMusicPlayer.loop = true;
let plateauMusicWanted = null;
let fxActiveCount = 0;
let plateauMusicRestartRequested = false;

function pausePlateauMusic() {
  if (!plateauMusicWanted) return;
  try { plateauMusicPlayer.pause(); } catch {}
}

function requestRestartPlateauMusic() {
  if (!plateauMusicWanted) return;
  plateauMusicRestartRequested = true;
}

function restartPlateauMusicNow() {
  if (!plateauMusicWanted) return;
  try {
    plateauMusicPlayer.pause();
    plateauMusicPlayer.currentTime = 0;
    plateauMusicPlayer.play();
  } catch {}
}

function resumePlateauMusic() {
  if (!plateauMusicWanted || fxActiveCount > 0) return;
  try { plateauMusicPlayer.play(); } catch {}
}

function playPlateauMusic(src) {
  plateauMusicWanted = src || null;
  plateauMusicRestartRequested = false;
  if (!plateauMusicWanted) {
    try {
      plateauMusicPlayer.pause();
      plateauMusicPlayer.currentTime = 0;
    } catch {}
    return;
  }
  try {
    plateauMusicPlayer.pause();
    plateauMusicPlayer.currentTime = 0;
    plateauMusicPlayer.src = plateauMusicWanted;
    if (fxActiveCount === 0) {
      plateauMusicPlayer.play();
    }
  } catch {}
}

function playMusic(src) {
  if (!src) return;
  try {
    musicPlayer.pause();
    musicPlayer.currentTime = 0;
    musicPlayer.src = src;
    musicPlayer.play();
  } catch {}
}

function stopMusic() {
  try {
    if (!musicPlayer.paused) notifyFxEnd();
    musicPlayer.pause();
    musicPlayer.currentTime = 0;
  } catch {}
}

plateauMusicPlayer.addEventListener("ended", () => {
  if (plateauMusicWanted && fxActiveCount === 0) {
    resumePlateauMusic();
  }
});

/* ---------- Badge multiplicateur ---------- */
let currentMultiplier = 1;
let multiplierBadge = null;

function getMultiplierBadge() {
  if (multiplierBadge) return multiplierBadge;
  const badge = document.createElement("div");
  badge.id = "multiplierBadge";
  badge.className = "multiplier-badge";
  badge.style.display = "none";
  document.body.appendChild(badge);
  multiplierBadge = badge;
  return badge;
}

function updateMultiplierBadge(value) {
  currentMultiplier = value || 1;
  const badge = getMultiplierBadge();
  if (currentMultiplier > 1) {
    badge.textContent = `x${currentMultiplier}`;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}

/* ---------- Video generique ---------- */
let genericVideo = null;

function ensureGenericVideo() {
  if (genericVideo) return genericVideo;

  const vid = document.createElement("video");
  vid.src = "sounds/generique_avm.mp4";
  vid.style.position = "fixed";
  vid.style.inset = "0";
  vid.style.width = "100vw";
  vid.style.height = "100vh";
  vid.style.objectFit = "cover";
  vid.style.backgroundColor = "#000";
  vid.style.zIndex = "2000";
  vid.style.display = "none";
  vid.autoplay = false;
  vid.controls = false;
  vid.playsInline = true;

  vid.addEventListener("ended", () => {
    vid.style.display = "none";
    vid.src = "sounds/generique_avm.mp4";
    gridEl.style.visibility = "visible";
    defBar?.classList.remove("hidden");
  });

  document.body.appendChild(vid);
  genericVideo = vid;
  return vid;
}

function playGenericVideo() {
  const vid = ensureGenericVideo();
  if (!vid) return;

  stopAllFx();
  vid.currentTime = 0;
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
  vid.style.display = "block";
  vid.play().catch(() => {});
}

function playTripleVideo() {
  const vid = ensureGenericVideo();
  if (!vid) return;

  stopAllFx();
  vid.src = "sounds/mot_triple.mp4";
  vid.currentTime = 0;
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
  vid.style.display = "block";
  vid.play().catch(() => {});
}

function playDoubleVideo() {
  const vid = ensureGenericVideo();
  if (!vid) return;

  stopAllFx();
  vid.src = "sounds/mot_double.mp4";
  vid.currentTime = 0;
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
  vid.style.display = "block";
  vid.play().catch(() => {});
}

function playBadVideo() {
  const vid = ensureGenericVideo();
  if (!vid) return;

  stopAllFx();
  vid.src = "sounds/bad_word.mp4";
  vid.currentTime = 0;
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
  vid.style.display = "block";
  vid.play().catch(() => {});
}

/* ---------- Scores ---------- */
let scoresOverlay = null;
let wantsFullscreen = false;

function ensureScoresOverlay() {
  if (scoresOverlay) return scoresOverlay;
  const overlay = document.createElement("div");
  overlay.id = "scoresOverlay";
  overlay.className = "scores-overlay";
  overlay.innerHTML = `
    <div class="scores-title">TABLEAU DES SCORES</div>
    <div class="scores-grid" id="scoresGrid"></div>
  `;
  document.body.appendChild(overlay);
  scoresOverlay = overlay;
  return overlay;
}

function renderScores(teams) {
  const overlay = ensureScoresOverlay();
  const grid = overlay.querySelector("#scoresGrid");
  if (!grid) return;
  grid.innerHTML = "";
  (teams || []).forEach((team) => {
    const card = document.createElement("div");
    card.className = "score-card";
    card.style.background = team.color || "#3ea6ff";
    card.innerHTML = `
      <div class="score-name">${team.name}</div>
      <div class="score-points">${team.points} PTS</div>
    `;
    grid.appendChild(card);
  });
}

function toggleScores(show, teams) {
  const overlay = ensureScoresOverlay();
  renderScores(teams);
  if (show) {
    overlay.classList.add("active");
    gridEl.style.display = "none";
    defBar?.classList.add("hidden");
  } else {
    overlay.classList.remove("active");
    gridEl.style.display = "";
  }
}

/* ---------- Flags ---------- */
let flagOverlay = null;

function ensureFlagOverlay() {
  if (flagOverlay) return flagOverlay;
  const overlay = document.createElement("div");
  overlay.id = "flagOverlay";
  overlay.className = "flag-overlay";
  overlay.innerHTML = '<img class="flag-image" alt="Drapeau" />';
  document.body.appendChild(overlay);
  flagOverlay = overlay;
  return overlay;
}

function showFlag(src, altText = "Drapeau") {
  const overlay = ensureFlagOverlay();
  const img = overlay.querySelector(".flag-image");
  if (img) {
    img.src = src;
    img.alt = altText;
  }
  overlay.classList.add("active");
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
}

function hideAllMedia() {
  if (flagOverlay) flagOverlay.classList.remove("active");
  if (scoresOverlay) scoresOverlay.classList.remove("active");
  stopMusic();
  const vid = genericVideo;
  if (vid) {
    vid.pause();
    vid.currentTime = 0;
    vid.style.display = "none";
    gridEl.style.visibility = "visible";
    defBar?.classList.remove("hidden");
  }
  gridEl.style.display = "";
  if (wantsFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

/* ---------- Helpers audio ---------- */
function safePlay(audio) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play();
  } catch {}
}

function safeStop(audio) {
  if (!audio) return;
  try {
    if (!audio.paused) notifyFxEnd();
    audio.pause();
    audio.currentTime = 0;
  } catch {}
}

const fxStopTimers = new WeakMap();
function playFx(audio, maxDurationMs = null) {
  if (!audio) return;

  const existing = fxStopTimers.get(audio);
  if (existing) {
    clearTimeout(existing);
    fxStopTimers.delete(audio);
  }

  safePlay(audio);

  if (typeof maxDurationMs === "number" && maxDurationMs > 0) {
    const timer = setTimeout(() => {
      fxStopTimers.delete(audio);
      safeStop(audio);
    }, maxDurationMs);
    fxStopTimers.set(audio, timer);

    audio.addEventListener(
      "ended",
      () => {
        const t = fxStopTimers.get(audio);
        if (t) clearTimeout(t);
        fxStopTimers.delete(audio);
      },
      { once: true }
    );
  }
}

function stopRevealSound() {
  safeStop(sounds.reveal);
}

const FX_KEYS = ["selectWord", "magicSelect", "reveal", "correct", "wrong", "fail", "timer"];
function stopAllFx(exceptKey = null) {
  for (const key of FX_KEYS) {
    if (key === exceptKey) continue;
    safeStop(sounds[key]);
  }
}

function notifyFxStart() {
  fxActiveCount += 1;
  pausePlateauMusic();
}

function notifyFxEnd() {
  fxActiveCount = Math.max(0, fxActiveCount - 1);
  if (fxActiveCount === 0) {
    if (plateauMusicRestartRequested) {
      plateauMusicRestartRequested = false;
      restartPlateauMusicNow();
    } else {
      resumePlateauMusic();
    }
  }
}

FX_KEYS.forEach((key) => {
  const audio = sounds[key];
  if (!audio) return;
  audio.addEventListener("play", notifyFxStart);
  audio.addEventListener("ended", notifyFxEnd);
});

/* ---------- Utils ---------- */
function key(r, c) {
  return `${r},${c}`;
}

function buildMagicWordCells(wordId) {
  const set = new Set();
  if (!grid || wordId == null) return set;
  const word = grid.words?.[wordId];
  if (!word) return set;
  word.cells.forEach((p) => {
    set.add(`${p.r},${p.c}`);
  });
  return set;
}

function isMagicWordCell(pos) {
  return grid?.magicWordCells && grid.magicWordCells.has(pos);
}

function isMagicHighlightCell(pos) {
  return (grid?.magic && grid.magic.has(pos)) || (grid?.magicWordCells && grid.magicWordCells.has(pos));
}

function setMagicWord(wordId) {
  if (!grid) return;
  const prevCells = grid.magicWordCells || new Set();
  grid.magicWordId = wordId;
  grid.magicWordCells = buildMagicWordCells(wordId);
  grid.magicSolved = false;
  if (wordId == null) {
    for (const [pos] of grid.letters) {
      const [r, c] = pos.split(",").map(Number);
      renderCell(r, c);
    }
    return;
  }
  const refresh = new Set([...prevCells, ...grid.magicWordCells]);
  for (const pos of refresh) {
    if (grid.magicWordCells.has(pos)) {
      grid.revealed.set(pos, false);
    }
    const [r, c] = pos.split(",").map(Number);
    renderCell(r, c);
  }
}

function isMagicWordSelection(word) {
  if (!word || !grid?.magicWordCells || !grid.magicWordCells.size) return false;
  if (word.id === grid.magicWordId) return true;
  if (!Array.isArray(word.cells) || word.cells.length !== grid.magicWordCells.size) return false;
  return word.cells.every((p) => grid.magicWordCells.has(key(p.r, p.c)));
}

/* ---------- Reconstruction Maps depuis la régie ---------- */
function rebuildGrid(payload) {
  return {
    url: payload.url,
    bounds: payload.bounds,
    letters: new Map(payload.letters),
    numbers: new Map(payload.numbers),
    revealed: new Map(payload.revealed),
    magic: new Set(payload.magic || []),
    words: payload.words,
    cellToWords: new Map(payload.cellToWords),
    numberPosToWord: new Map(payload.numberPosToWord),
    magicWordId: payload.magicWordId ?? null,
    magicWordCells: new Set(),
    magicSolved: !!payload.magicSolved
  };
}

/* ---------- Définitions ---------- */
function showDefinition(text) {
  if (!text) {
    defBar.classList.add("hidden");
    defText.textContent = "";
    return;
  }
  defBar.classList.remove("hidden");
  defText.textContent = text;
}

/* ---------- Grille DOM ---------- */
function buildGridDOM() {
  gridEl.innerHTML = "";
  selectedWordId = null;
  tempNumbers.clear();
  gridCompletePlayed = false;
  showDefinition("");

  const { minRow, maxRow, minCol, maxCol } = grid.bounds;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  gridEl.style.gridTemplateRows = `repeat(${rows}, var(--cell))`;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const pos = key(r, c);
      const hasLetter = grid.letters.has(pos);
      const hasNumber = grid.numbers.has(pos);

      const cell = document.createElement("div");
      cell.dataset.pos = pos;

      if (hasLetter) {
        cell.className = "cell letter";
        cell.addEventListener("click", () => onLetterCellClick(r, c));
        gridEl.appendChild(cell);
        renderCell(r, c);
        continue;
      }

      if (hasNumber) {
        cell.className = "cell number";
        renderNumberCell(r, c);
        cell.addEventListener("click", () => onNumberCellClick(r, c));
        gridEl.appendChild(cell);
        continue;
      }

      cell.className = "cell empty";
      cell.setAttribute("aria-hidden", "true");
      gridEl.appendChild(cell);
    }
  }
}

/* ---------- Rendu cellule ---------- */
function renderCell(r, c) {
  const pos = key(r, c);
  const el = document.querySelector(`[data-pos="${pos}"]`);
  if (!el) return;

  if (grid.letters.has(pos)) {
    const revealed = grid.revealed.get(pos);
    const magicWordCell = isMagicWordCell(pos);
    const canReveal = !magicWordCell || grid.magicSolved;
    el.classList.remove("revealed", "dim", "nop", "orange", "magic");
    if (isMagicHighlightCell(pos)) el.classList.add("magic");

    if (revealed && canReveal) {
      el.classList.add("revealed");
      el.textContent = grid.letters.get(pos);
    } else {
      el.textContent = "";
    }
  }
}

/* ---------- Sélection / surbrillance ---------- */
function clearHighlight() {
  for (const [pos] of grid.letters) {
    const el = document.querySelector(`[data-pos="${pos}"]`);
    if (!el) continue;

    const magicWordCell = isMagicWordCell(pos);
    const canReveal = !magicWordCell || grid.magicSolved;
    el.classList.remove("dim", "nop", "orange", "magic");
    if (isMagicHighlightCell(pos)) el.classList.add("magic");

    if (grid.revealed.get(pos) && canReveal) {
      el.classList.add("revealed");
      el.textContent = grid.letters.get(pos);
    } else {
      el.textContent = "";
    }
  }
}

function applySelection(word) {
  clearHighlight();
  tempNumbers.clear();

  if (!word) {
    selectedWordId = null;
    showDefinition("");
    stopAllFx();
    notifySelection(null);
    refreshNumberCells();
    resetTimer();
    return;
  }

  selectedWordId = word.id;
  const wordCells = new Set(word.cells.map(p => key(p.r, p.c)));

  for (const [pos] of grid.letters) {
    const el = document.querySelector(`[data-pos="${pos}"]`);
    if (!el) continue;

    if (!wordCells.has(pos)) {
      el.classList.add("dim");
    }
  }

  const isMagic = isMagicWordSelection(word);
  showDefinition(isMagic ? "Mot Magique" : word.definition);
  stopAllFx("timer");
  safePlay(sounds.timer);
  if (word.numberPos) {
    tempNumbers.add(key(word.numberPos.r, word.numberPos.c));
  }
  if (isMagic) {
    safeStop(sounds.selectWord);
    stopAllFx("magicSelect");
    safePlay(sounds.magicSelect);
  } else {
    stopAllFx("selectWord");
    safePlay(sounds.selectWord);
  }
  refreshNumberCells();
  notifySelection(word.id);
}

/* ---------- Clics ---------- */
function onLetterCellClick(r, c) {
  stopRevealSound();
  const pos = key(r, c);
  const ids = grid.cellToWords.get(pos);
  if (!ids || !ids.length) {
    applySelection(null);
    return;
  }
  applySelection(grid.words[ids[0]]);
}

function onNumberCellClick(r, c) {
  stopRevealSound();
  const pos = key(r, c);
  const wid = grid.numberPosToWord.get(pos);
  if (wid == null) {
    applySelection(null);
    return;
  }
  applySelection(grid.words[wid]);
}

function showNumbersForLetter(letter) {
  if (!grid) return;
  tempNumbers.clear();
  for (const [pos, ltr] of grid.letters) {
    if (ltr === letter) {
      const ids = grid.cellToWords.get(pos);
      if (ids) {
        ids.forEach((wid) => {
          const w = grid.words[wid];
          if (w?.numberPos) tempNumbers.add(key(w.numberPos.r, w.numberPos.c));
        });
      }
    }
  }
  refreshNumberCells();
}

function startTimer(seconds) {
  if (!timerEl) return;
  clearTimeout(timerHandle);
  timerEl.classList.remove("hidden");
  timerEndsAt = Date.now() + seconds * 1000;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  if (!timerEl) return;
  const remaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  timerEl.textContent = `${mm}:${ss}`;
  if (remaining <= 0) {
    resetTimer();
    return;
  }
  timerHandle = setTimeout(updateTimerDisplay, 250);
}

function resetTimer() {
  if (!timerEl) return;
  clearTimeout(timerHandle);
  timerHandle = null;
  timerEl.classList.add("hidden");
}

/* ---------- Animations ---------- */
function animateWordReveal(word) {
  const cells = word.cells.map(p => key(p.r, p.c));
  let i = 0;

  function step() {
    if (i >= cells.length) return;
    const pos = cells[i];
    const el = document.querySelector(`[data-pos="${pos}"]`);
    if (el) {
      el.classList.add("orange");
      el.textContent = grid.letters.get(pos);
    }
    i++;
    setTimeout(step, 80);
  }

  setTimeout(step, 500);
}

function checkGridCompletion() {
  for (const [pos] of grid.letters) {
    if (!grid.revealed.get(pos)) return;
  }

  if (!gridCompletePlayed) {
    gridCompletePlayed = true;
    safePlay(sounds.gridComplete);
  }
}

/* ---------- Messages depuis la régie ---------- */
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "LOAD_GRID":
      grid = rebuildGrid(msg.grid);
      grid.magicWordCells = buildMagicWordCells(grid.magicWordId);
      if (!grid.magicSolved) {
        for (const pos of grid.magicWordCells) {
          grid.revealed.set(pos, false);
        }
      }
      buildGridDOM();
      safeStop(sounds.ambient);
      break;

    case "RESET_REVEAL":
      for (const [pos] of grid.letters) {
        grid.revealed.set(pos, false);
        const [r, c] = pos.split(",").map(Number);
        renderCell(r, c);
      }
      grid.magicSolved = false;
      applySelection(null);
      updateMultiplierBadge(1);
      break;

    case "SET_MAGIC_WORD":
      setMagicWord(msg.wordId ?? null);
      break;

    case "REVEAL_LETTER":
      stopAllFx("reveal");
      for (const [pos, letter] of grid.letters) {
        if (letter === msg.letter && !grid.revealed.get(pos) && (!isMagicWordCell(pos) || grid.magicSolved)) {
          grid.revealed.set(pos, true);
          const [r, c] = pos.split(",").map(Number);
          renderCell(r, c);
        }
      }
      showNumbersForLetter(msg.letter);
      safePlay(sounds.reveal);
      startTimer(20);
      break;

    case "STOP_REVEAL_SOUND":
      stopRevealSound();
      break;

    case "PLAY_SFX": {
      if (msg.key === "correct") {
        stopAllFx("correct");
        playFx(sounds.correct);
      } else if (msg.key === "fail") {
        stopAllFx("fail");
        playFx(sounds.fail);
      }
      break;
    }

    case "SCORES_UPDATE":
      toggleScores(!!msg.show, msg.teams || []);
      break;

    case "SHOW_FLAG":
      if (msg.src) showFlag(msg.src, msg.alt || "Drapeau");
      break;

    case "SHOW_PEOPLE":
      if (msg.src) showFlag(msg.src, msg.alt || "Personnalite");
      break;

    case "PLAY_MUSIC":
      playMusic(msg.src);
      break;

    case "PLAY_PLATEAU_MUSIC":
      playPlateauMusic(msg.src);
      break;

    case "STOP_MUSIC":
      stopMusic();
      break;

    case "HIDE_MEDIA":
      hideAllMedia();
      break;

    case "SET_MULTIPLIER":
      updateMultiplierBadge(msg.value || 1);
      break;

    case "PLAY_TRIPLE":
      playTripleVideo();
      break;

    case "PLAY_DOUBLE":
      playDoubleVideo();
      break;

    case "PLAY_BAD":
      playBadVideo();
      break;

    case "PLAY_GENERIC":
      playGenericVideo();
      break;

    case "SHUFFLE_LETTERS":
      scatterFloatingLetters();
      break;

    case "CORRECT_WORD": {
      const word = grid.words[msg.wordId];
      if (!word) return;

      stopAllFx("correct");
      requestRestartPlateauMusic();
      safePlay(sounds.correct);
      setTimeout(() => {
        if (plateauMusicRestartRequested && fxActiveCount === 0) {
          plateauMusicRestartRequested = false;
          restartPlateauMusicNow();
        }
      }, 200);

      for (const p of word.cells) {
        const pos = key(p.r, p.c);
        if (!isMagicWordCell(pos) || grid.magicSolved) {
          grid.revealed.set(pos, true);
        }
        renderCell(p.r, p.c);
      }

      animateWordReveal(word);
      applySelection(null);
      updateMultiplierBadge(1);
      checkGridCompletion();
      break;
    }

    case "CORRECT_MAGIC_WORD": {
      const word = grid.words[msg.wordId];
      if (!word) return;

      stopAllFx("correct");
      requestRestartPlateauMusic();
      safePlay(sounds.correct);
      setTimeout(() => {
        if (plateauMusicRestartRequested && fxActiveCount === 0) {
          plateauMusicRestartRequested = false;
          restartPlateauMusicNow();
        }
      }, 200);
      grid.magicSolved = true;
      for (const [pos] of grid.letters) {
        grid.revealed.set(pos, true);
        const [r, c] = pos.split(",").map(Number);
        renderCell(r, c);
      }
      animateWordReveal(word);
      applySelection(null);
      updateMultiplierBadge(1);
      checkGridCompletion();
      break;
    }

    case "NOP_WORD": {
      const word = grid.words[msg.wordId];
      if (!word) return;
      stopAllFx("fail");
      // Joue le fail comme un FX: pause/duck le fond puis restaure automatiquement
      requestRestartPlateauMusic();
      playFx(sounds.fail);
      setTimeout(() => {
        if (plateauMusicRestartRequested && fxActiveCount === 0) {
          plateauMusicRestartRequested = false;
          restartPlateauMusicNow();
        }
      }, 200);

      const wordCells = new Set(word.cells.map(p => key(p.r, p.c)));

      for (const [pos] of grid.letters) {
        if (!grid.revealed.get(pos) && wordCells.has(pos)) {
          const el = document.querySelector(`[data-pos="${pos}"]`);
          if (el) el.classList.add("nop");
        }
      }

      applySelection(null);
      updateMultiplierBadge(1);
      break;
    }

    case "SELECT_WORD": {
      if (msg.wordId == null) {
        applySelection(null);
      } else {
        const word = grid.words[msg.wordId];
        if (word) {
          applySelection(word);
          startTimer(30);
        }
      }
      break;
    }

    case "TOGGLE_FULLSCREEN":
      if (!document.fullscreenElement) {
        wantsFullscreen = true;
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        wantsFullscreen = false;
        document.exitFullscreen().catch(() => {});
      }
      break;
  }
});

/* ---------- Communication régie ---------- */
function hostWindow() {
  if (window.opener) return window.opener;
  if (window.parent && window.parent !== window) return window.parent;
  return null;
}

function notifySelection(wordId) {
  const host = hostWindow();
  if (host) {
    host.postMessage(
      { type: "WORD_SELECTED", wordId },
      "*"
    );
  }
}

function renderNumberCell(r, c) {
  const pos = key(r, c);
  const el = document.querySelector(`[data-pos="${pos}"]`);
  if (!el) return;
  const visible = tempNumbers.has(pos);
  if (visible) {
    el.className = "cell number";
    el.textContent = grid.numbers.get(pos);
    el.removeAttribute("aria-hidden");
    el.style.pointerEvents = "auto";
  } else {
    el.className = "cell hidden-number";
    el.textContent = "";
    el.setAttribute("aria-hidden", "true");
    el.style.pointerEvents = "none";
  }
}

function refreshNumberCells() {
  if (!grid) return;
  for (const [pos] of grid.numbers) {
    const [r, c] = pos.split(",").map(Number);
    renderNumberCell(r, c);
  }
}

function initTitleDrag() {
  const logo = document.querySelector(".title-logo");
  if (!logo) {
    return;
  }

  logo.draggable = false;
  logo.style.touchAction = "none";

  logo.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    const rect = logo.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    logo.style.left = `${rect.left}px`;
    logo.style.top = `${rect.top}px`;
    logo.style.transform = "none";

    const onMove = (moveEvent) => {
      logo.style.left = `${moveEvent.clientX - offsetX}px`;
      logo.style.top = `${moveEvent.clientY - offsetY}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      logo.releasePointerCapture(event.pointerId);
    };

    logo.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

/* ---------- Cycle de vie ---------- */
window.addEventListener("beforeunload", () => {
  const host = hostWindow();
  try {
    if (host) host.postMessage({ type: "PLATEAU_CLOSED" }, "*");
  } catch {}
});

window.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
});

// Stop la musique de révélation dès qu'on clique quelque part (fluidité)
window.addEventListener("click", stopRevealSound, true);

/* ---------- Init ---------- */
(function init() {
  initBackgroundBubbles();
  initFloatingLetters();
  initDraggableLetters();
  startLettersPhysics();
  initTitleDrag();
  const host = hostWindow();
  if (host) {
    host.postMessage({ type: "PLATEAU_READY" }, "*");
  }
})();









