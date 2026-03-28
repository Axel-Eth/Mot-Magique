import { gridEl, defBar } from "./dom.js";
import { state } from "./state.js";
import { beginExternalDucking, endExternalDucking, getPlateauMusicSource, pausePlateauMusic, playFx, playFxSequence, playMusic, playPlateauMusic, setDuckLevelOverride, sounds, stopAllFx, stopMusic } from "./audio.js";

const FLAG_ANTHEM_SRC = "sounds/hymnes_nationaux.mp3";
const PEOPLE_THEME_SRC = "sounds/guess_persona.mp3";
const FILMS_EXTRACTS_AUDIO_SRC = "sounds/extraits_films.mp3";
const GENERAL_QUESTION_MUSIC_SRC = "sounds/question_song.mp3";
const LETTERS_GAME_THEME_SRC = "sounds/lettres.mp3";
const NUMBERS_GAME_THEME_SRC = "sounds/chiffres.mp3";
const MISFORTUNE_WHEEL_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#84cc16", "#06b6d4", "#eab308", "#6366f1"
];
const TWO_PI = Math.PI * 2;
const FILMS_DUCK_LEVEL = 0.02;
const FILMS_OVERLAY_AUDIO_VOLUME = 0.12;
const FILMS_FADE_MS = 280;

let multiplierBadge = null;
let scoresOverlay = null;
let podiumOverlay = null;
let filmsOverlay = null;
let podiumConfettiCanvas = null;
let podiumConfettiCtx = null;
let podiumConfettiFrame = 0;
let podiumLastCelebratedStep = -1;
let podiumRestoreMusicSrc = null;
let podiumSuspenseActive = false;
let flagOverlay = null;
let generalQuestionOverlay = null;
let goldenFamilyOverlay = null;
let lettersGameOverlay = null;
let numbersGameOverlay = null;
let misfortuneWheelOverlay = null;
let flagLoadToken = 0;
let genericVideo = null;
let videoDuckingActive = false;
let currentVideoMode = null;
let mediaLifecycleBound = false;
let generalQuestionMusicActive = false;
let misfortuneWheelItems = [];
let misfortuneWheelAngle = 0;
let actionAnimationOverlay = null;
let actionAnimationTimer = 0;
let lettersGameDuckingActive = false;
let numbersGameDuckingActive = false;

function setLettersGameDucking(active) {
  if (active && !lettersGameDuckingActive) {
    beginExternalDucking();
    lettersGameDuckingActive = true;
    return;
  }
  if (!active && lettersGameDuckingActive) {
    endExternalDucking();
    lettersGameDuckingActive = false;
  }
}

function setNumbersGameDucking(active) {
  if (active && !numbersGameDuckingActive) {
    beginExternalDucking();
    numbersGameDuckingActive = true;
    return;
  }
  if (!active && numbersGameDuckingActive) {
    endExternalDucking();
    numbersGameDuckingActive = false;
  }
}

function bindMediaLifecycleEvents() {
  if (mediaLifecycleBound) return;
  mediaLifecycleBound = true;
  window.addEventListener("plateau:long-media-ended", () => {
    stopFilmsOverlayVideo();
  });
}

function fadeInVideo(vid) {
  vid.style.opacity = "0";
  vid.style.display = "block";
  window.requestAnimationFrame(() => {
    vid.style.opacity = "1";
  });
}

function fadeOutVideo(vid, done) {
  vid.style.opacity = "0";
  window.setTimeout(() => {
    if (vid.style.opacity === "0") {
      vid.style.display = "none";
      done?.();
    }
  }, FILMS_FADE_MS);
}

function setVideoDucking(active) {
  if (active && !videoDuckingActive) {
    beginExternalDucking();
    videoDuckingActive = true;
    return;
  }
  if (!active && videoDuckingActive) {
    endExternalDucking();
    videoDuckingActive = false;
  }
}

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

export function updateMultiplierBadge(value) {
  const currentMultiplier = value || 1;
  const badge = getMultiplierBadge();
  if (currentMultiplier > 1) {
    badge.textContent = `x${currentMultiplier}`;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}

function ensureGenericVideo() {
  if (genericVideo) return genericVideo;
  bindMediaLifecycleEvents();

  const vid = document.createElement("video");
  vid.src = "sounds/generique_avm_new.mp4";
  vid.style.position = "fixed";
  vid.style.inset = "0";
  vid.style.width = "100vw";
  vid.style.height = "100vh";
  vid.style.objectFit = "cover";
  vid.style.backgroundColor = "#000";
  vid.style.zIndex = "2000";
  vid.style.display = "none";
  vid.style.opacity = "1";
  vid.style.transition = `opacity ${FILMS_FADE_MS}ms ease`;
  vid.autoplay = false;
  vid.controls = false;
  vid.playsInline = true;

  vid.addEventListener("ended", () => {
    setVideoDucking(false);
    vid.style.display = "none";
    vid.style.opacity = "1";
    vid.loop = false;
    vid.volume = 1;
    currentVideoMode = null;
    vid.src = "sounds/generique_avm_new.mp4";
    gridEl.style.visibility = "visible";
    defBar?.classList.remove("hidden");
  });
  vid.addEventListener("error", () => {
    setVideoDucking(false);
  });

  document.body.appendChild(vid);
  genericVideo = vid;
  return vid;
}

function playVideo(src, options = {}) {
  const { volume = 1, loop = false, mode = "default" } = options;
  const vid = ensureGenericVideo();
  if (!vid) return;

  stopAllFx();
  if (mode === "films_overlay") {
    setDuckLevelOverride(FILMS_DUCK_LEVEL);
  } else {
    setDuckLevelOverride(null);
  }
  setVideoDucking(true);
  currentVideoMode = mode;
  vid.loop = !!loop;
  vid.volume = Math.max(0, Math.min(1, volume));
  vid.src = src;
  vid.currentTime = 0;
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
  if (mode === "films_overlay") {
    fadeInVideo(vid);
  } else {
    vid.style.display = "block";
    vid.style.opacity = "1";
  }
  vid.play().catch(() => {
    setVideoDucking(false);
  });
}

export function playGenericVideo() {
  playVideo("sounds/generique_avm_new.mp4", { mode: "generic" });
}

export function playTripleVideo() {
  playVideo("sounds/mot_triple_new.mp4", { mode: "triple" });
}

export function playDoubleVideo() {
  playVideo("sounds/mot_double_new.mp4", { mode: "double" });
}

function ensureDoubleAnimationOverlay() {
  if (actionAnimationOverlay) return actionAnimationOverlay;
  const overlay = document.createElement("div");
  overlay.id = "actionAnimationOverlay";
  overlay.className = "word-animation-overlay";
  overlay.innerHTML = `
    <div class="word-animation-aura"></div>
    <div class="word-animation-ring ring-one"></div>
    <div class="word-animation-ring ring-two"></div>
    <div class="word-animation-stripe left"></div>
    <div class="word-animation-stripe right"></div>
    <div class="word-animation-content">
      <div class="word-animation-kicker" id="wordAnimationKicker">MOT</div>
      <div class="word-animation-main" id="wordAnimationMain">X2</div>
      <div class="word-animation-sub" id="wordAnimationSub">DOUBLE MOT</div>
    </div>
  `;
  document.body.appendChild(overlay);
  actionAnimationOverlay = overlay;
  return overlay;
}

function stopActionAnimation() {
  if (actionAnimationTimer) {
    window.clearTimeout(actionAnimationTimer);
    actionAnimationTimer = 0;
  }
  if (!actionAnimationOverlay) return;
  actionAnimationOverlay.classList.remove("active", "variant-double", "variant-triple", "variant-bad");
  gridEl.style.visibility = "visible";
  defBar?.classList.remove("hidden");
  setVideoDucking(false);
  currentVideoMode = null;
}

function playActionAnimation({ mode, variant, kicker, main, sub, soundDuration = 900, duration = 1900 }) {
  hideAllMedia();
  stopAllFx();
  const overlay = ensureDoubleAnimationOverlay();
  overlay.querySelector("#wordAnimationKicker").textContent = kicker;
  overlay.querySelector("#wordAnimationMain").textContent = main;
  overlay.querySelector("#wordAnimationSub").textContent = sub;
  setVideoDucking(true);
  currentVideoMode = mode;
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
  overlay.classList.remove("active", "variant-double", "variant-triple", "variant-bad");
  void overlay.offsetWidth;
  overlay.classList.add(variant);
  overlay.classList.add("active");
  playFx(sounds.appear, soundDuration);
  actionAnimationTimer = window.setTimeout(() => {
    stopActionAnimation();
  }, duration);
}

export function playDoubleAnimation() {
  playActionAnimation({
    mode: "double_animation",
    variant: "variant-double",
    kicker: "MOT",
    main: "X2",
    sub: "DOUBLE MOT"
  });
}

export function playTripleAnimation() {
  playActionAnimation({
    mode: "triple_animation",
    variant: "variant-triple",
    kicker: "MOT",
    main: "X3",
    sub: "TRIPLE MOT",
    duration: 2050
  });
}

export function playBadAnimation() {
  playActionAnimation({
    mode: "bad_animation",
    variant: "variant-bad",
    kicker: "MODE",
    main: "BAD",
    sub: "POINTS CONTRE VOUS",
    soundDuration: 1000,
    duration: 2100
  });
}

export function playBadVideo() {
  playVideo("sounds/bad_word_new.mp4", { mode: "bad" });
}

export function playFilmsOverlayVideo() {
  const overlay = ensureFilmsOverlay();
  stopAllFx();
  setDuckLevelOverride(FILMS_DUCK_LEVEL);
  setVideoDucking(true);
  currentVideoMode = "films_overlay";
  playMusic(FILMS_EXTRACTS_AUDIO_SRC, { loop: true, volume: FILMS_OVERLAY_AUDIO_VOLUME });
  overlay.classList.add("active");
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
}

export function stopFilmsOverlayVideo() {
  if (currentVideoMode !== "films_overlay") return;
  filmsOverlay?.classList.remove("active");
  currentVideoMode = null;
  setVideoDucking(false);
  setDuckLevelOverride(null);
  gridEl.style.visibility = "visible";
  defBar?.classList.remove("hidden");
}

function ensureFilmsOverlay() {
  if (filmsOverlay) return filmsOverlay;
  const overlay = document.createElement("div");
  overlay.id = "filmsOverlay";
  overlay.className = "films-overlay";
  overlay.innerHTML = `
    <div class="films-top-bar"></div>
    <div class="films-bottom-bar"></div>
    <div class="films-band">
      <div class="films-reel left"></div>
      <div class="films-reel right"></div>
      <div class="films-strip"></div>
    </div>
    <div class="films-flash"></div>
    <div class="films-title">EXTRAIT <span class="films-emoji" aria-hidden="true">📽️</span></div>
    <div class="films-vignette"></div>
  `;
  document.body.appendChild(overlay);
  filmsOverlay = overlay;
  return overlay;
}

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

function ensurePodiumOverlay() {
  if (podiumOverlay) return podiumOverlay;
  const overlay = document.createElement("div");
  overlay.id = "podiumOverlay";
  overlay.className = "podium-overlay";
  overlay.innerHTML = `
    <canvas class="podium-confetti" id="podiumConfettiCanvas" aria-hidden="true"></canvas>
    <div class="podium-title-stage">
      <p class="podium-kicker">Mot Magique</p>
      <h1 class="podium-title">Podium</h1>
    </div>
    <div class="podium-stage" id="podiumStage"></div>
  `;
  document.body.appendChild(overlay);
  podiumConfettiCanvas = overlay.querySelector("#podiumConfettiCanvas");
  podiumConfettiCtx = podiumConfettiCanvas?.getContext("2d") || null;
  podiumOverlay = overlay;
  return overlay;
}

function startPodiumSuspense() {
  if (podiumSuspenseActive) return;
  podiumRestoreMusicSrc = getPlateauMusicSource();
  podiumSuspenseActive = true;
  playPlateauMusic("sounds/selection_mot_grille.mp3");
}

function stopPodiumSuspense({ restore = true } = {}) {
  if (!podiumSuspenseActive && podiumRestoreMusicSrc == null) return;
  pausePlateauMusic();
  if (restore) {
    playPlateauMusic(podiumRestoreMusicSrc || null);
  } else {
    playPlateauMusic(null);
  }
  podiumSuspenseActive = false;
  if (restore) podiumRestoreMusicSrc = null;
}

function resizePodiumConfetti() {
  if (!podiumConfettiCanvas) return;
  podiumConfettiCanvas.width = window.innerWidth;
  podiumConfettiCanvas.height = window.innerHeight;
}

function stopPodiumConfetti() {
  if (podiumConfettiFrame) {
    window.cancelAnimationFrame(podiumConfettiFrame);
    podiumConfettiFrame = 0;
  }
  if (podiumConfettiCtx && podiumConfettiCanvas) {
    podiumConfettiCtx.clearRect(0, 0, podiumConfettiCanvas.width, podiumConfettiCanvas.height);
  }
}

function startPodiumConfetti() {
  ensurePodiumOverlay();
  resizePodiumConfetti();
  if (podiumConfettiFrame) return;

  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * (podiumConfettiCanvas?.width || window.innerWidth),
    y: Math.random() * -(podiumConfettiCanvas?.height || window.innerHeight),
    size: 4 + Math.random() * 8,
    speed: 2 + Math.random() * 4,
    drift: -1.5 + Math.random() * 3,
    color: ["#ff5fa2", "#ffd85a", "#7dd6ff", "#ffffff", "#8df0a9"][Math.floor(Math.random() * 5)],
    rotation: Math.random() * Math.PI,
    spin: -0.2 + Math.random() * 0.4
  }));

  const step = () => {
    if (!podiumConfettiCtx || !podiumConfettiCanvas) {
      podiumConfettiFrame = 0;
      return;
    }
    const ctx = podiumConfettiCtx;
    const { width, height } = podiumConfettiCanvas;
    ctx.clearRect(0, 0, width, height);

    for (const piece of pieces) {
      piece.y += piece.speed;
      piece.x += piece.drift;
      piece.rotation += piece.spin;
      if (piece.y > height + 20 || piece.x < -30 || piece.x > width + 30) {
        piece.x = Math.random() * width;
        piece.y = -20 - Math.random() * height * 0.3;
      }
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-(piece.size / 2), -(piece.size / 2), piece.size, piece.size * 0.7);
      ctx.restore();
    }

    if (podiumOverlay?.classList.contains("active")) {
      podiumConfettiFrame = window.requestAnimationFrame(step);
      return;
    }
    stopPodiumConfetti();
  };

  podiumConfettiFrame = window.requestAnimationFrame(step);
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

function renderPodium(teams, podiumStep = 0) {
  const overlay = ensurePodiumOverlay();
  const stage = overlay.querySelector("#podiumStage");
  if (!stage) return;
  stage.innerHTML = "";

  const ranked = [...(teams || [])]
    .sort((a, b) => {
      const pointsDiff = (b.points ?? 0) - (a.points ?? 0);
      if (pointsDiff !== 0) return pointsDiff;
      return String(a.name || "Equipe").localeCompare(String(b.name || "Equipe"), "fr", { sensitivity: "base" });
    })
    .slice(0, 3);

  const slots = [
    { rank: 2, className: "second" },
    { rank: 1, className: "first" },
    { rank: 3, className: "third" }
  ];
  const visibleRanks = podiumStep <= 0
    ? new Set()
    : podiumStep === 1
      ? new Set([3])
      : podiumStep === 2
        ? new Set([3, 2])
        : new Set([3, 2, 1]);
  const previousVisibleRanks = podiumLastCelebratedStep <= 0
    ? new Set()
    : podiumLastCelebratedStep === 1
      ? new Set([3])
      : podiumLastCelebratedStep === 2
        ? new Set([3, 2])
        : new Set([3, 2, 1]);

  slots.forEach((slot) => {
    const team = visibleRanks.has(slot.rank)
      ? ranked.find((entry, index) => index + 1 === slot.rank)
      : null;
    const block = document.createElement("div");
    const isNewlyRevealed = !!team && !previousVisibleRanks.has(slot.rank);
    block.className = `podium-block ${slot.className}${team ? "" : " empty"}${isNewlyRevealed ? " reveal" : ""}`;
    block.innerHTML = `
      <div class="podium-rank">${slot.rank}</div>
      <div class="podium-name">${team?.name || "-"}</div>
      <div class="podium-points">${team ? `${team.points ?? 0} PTS` : ""}</div>
    `;
    if (team?.color) block.style.setProperty("--podium-accent", team.color);
    stage.appendChild(block);
  });

  if (podiumStep === 1 && podiumLastCelebratedStep < 1) {
    stopAllFx();
    playFx(sounds.podiumThird);
    stopPodiumConfetti();
  } else if (podiumStep === 2 && podiumLastCelebratedStep < 2) {
    stopAllFx();
    playFx(sounds.podiumSecond);
    stopPodiumConfetti();
  } else if (podiumStep >= 3 && podiumLastCelebratedStep < 3) {
    stopPodiumSuspense({ restore: false });
    stopAllFx();
    playFxSequence([sounds.podiumFirst, sounds.podiumVictory]);
    startPodiumConfetti();
  } else if (podiumStep < 3) {
    stopPodiumConfetti();
  }
  podiumLastCelebratedStep = podiumStep;
}

export function toggleScores(show, teams, mode = "scores", podiumStep = 0) {
  const overlay = ensureScoresOverlay();
  const podium = ensurePodiumOverlay();
  const podiumWasActive = podium.classList.contains("active");
  renderScores(teams);
  renderPodium(teams, podiumStep);
  if (misfortuneWheelOverlay) misfortuneWheelOverlay.classList.remove("active");
  if (show) {
    overlay.classList.toggle("active", mode !== "podium");
    podium.classList.toggle("active", mode === "podium");
    if (mode === "podium" && !podiumWasActive) {
      startPodiumSuspense();
      stopAllFx("selectWord");
      playFx(sounds.selectWord);
    } else if (mode !== "podium" && podiumWasActive) {
      stopPodiumSuspense({ restore: true });
    }
    gridEl.style.display = "none";
    defBar?.classList.add("hidden");
  } else {
    overlay.classList.remove("active");
    podium.classList.remove("active");
    stopPodiumConfetti();
    podiumLastCelebratedStep = -1;
    stopPodiumSuspense({ restore: true });
    gridEl.style.display = "";
    defBar?.classList.remove("hidden");
  }
}

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

function ensureGeneralQuestionOverlay() {
  if (generalQuestionOverlay) return generalQuestionOverlay;
  const overlay = document.createElement("div");
  overlay.id = "generalQuestionOverlay";
  overlay.className = "general-question-overlay";
  overlay.innerHTML = `
    <div class="general-question-stage">
      <div class="general-question-window">
        <div class="general-question-text" id="generalQuestionText"></div>
      </div>
      <div class="general-choices-stage hidden" id="generalQuestionChoices">
        <div class="general-question-choice-window"><div class="general-question-choice" id="generalQuestionChoice0"></div></div>
        <div class="general-question-choice-window"><div class="general-question-choice" id="generalQuestionChoice1"></div></div>
        <div class="general-question-choice-window"><div class="general-question-choice" id="generalQuestionChoice2"></div></div>
        <div class="general-question-choice-window"><div class="general-question-choice" id="generalQuestionChoice3"></div></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  generalQuestionOverlay = overlay;
  return overlay;
}

function ensureGoldenFamilyOverlay() {
  if (goldenFamilyOverlay) return goldenFamilyOverlay;
  const overlay = document.createElement("div");
  overlay.id = "goldenFamilyOverlay";
  overlay.className = "golden-family-overlay";
  overlay.innerHTML = `
    <div class="golden-family-stage">
      <div class="golden-family-question" id="goldenFamilyQuestion"></div>
      <div class="golden-family-board" id="goldenFamilyBoard"></div>
      <div class="golden-family-footer">
        <div class="golden-family-points">
          <span class="label">BANQUE</span>
          <span id="goldenFamilyRoundPoints">0</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  goldenFamilyOverlay = overlay;
  return overlay;
}

function ensureLettersGameOverlay() {
  if (lettersGameOverlay) return lettersGameOverlay;
  const overlay = document.createElement("div");
  overlay.id = "lettersGameOverlay";
  overlay.className = "letters-game-overlay";
  overlay.innerHTML = `
    <div class="letters-game-stage">
      <div class="letters-game-board" id="lettersGameBoard"></div>
      <div class="letters-game-current-word" id="lettersGameCurrentWord"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  lettersGameOverlay = overlay;
  return overlay;
}

function countWordLetters(word) {
  const counts = new Map();
  for (const letter of String(word || "")) {
    counts.set(letter, (counts.get(letter) || 0) + 1);
  }
  return counts;
}

function ensureNumbersGameOverlay() {
  if (numbersGameOverlay) return numbersGameOverlay;
  const overlay = document.createElement("div");
  overlay.id = "numbersGameOverlay";
  overlay.className = "numbers-game-overlay";
  overlay.innerHTML = `
    <div class="numbers-game-stage">
      <div class="numbers-game-board">
        <div class="numbers-game-board-target-wrap">
          <div class="numbers-game-board-target" id="numbersGameBoardTarget"></div>
        </div>
        <div class="numbers-game-board-pool-wrap">
          <div class="numbers-game-board-pool" id="numbersGameBoardPool"></div>
        </div>
      </div>
      <div class="numbers-game-calculation" id="numbersGameCalculation"></div>
      <div class="numbers-game-current-line hidden" id="numbersGameCurrentLine"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  numbersGameOverlay = overlay;
  return overlay;
}

function normalizeWheelAngle(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function ensureMisfortuneWheelOverlay() {
  if (misfortuneWheelOverlay) return misfortuneWheelOverlay;
  const overlay = document.createElement("div");
  overlay.id = "misfortuneWheelOverlay";
  overlay.className = "misfortune-wheel-overlay";
  overlay.innerHTML = `
    <div class="misfortune-wheel-stage plateau-wheel-stage">
      <div class="misfortune-wheel-pointer" aria-hidden="true"></div>
      <canvas id="plateauMisfortuneWheelCanvas" width="600" height="600" aria-label="Roue des categories"></canvas>
    </div>
    <div id="plateauMisfortuneWheelResult" class="misfortune-wheel-result plateau-wheel-result">Roue de l'infortune</div>
  `;
  document.body.appendChild(overlay);
  misfortuneWheelOverlay = overlay;
  return overlay;
}

function drawMisfortuneWheel() {
  const overlay = ensureMisfortuneWheelOverlay();
  const canvas = overlay.querySelector("#plateauMisfortuneWheelCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.width;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  const items = misfortuneWheelItems.length ? misfortuneWheelItems : ["Aucune categorie"];

  ctx.clearRect(0, 0, size, size);
  const slice = TWO_PI / items.length;

  for (let i = 0; i < items.length; i++) {
    const start = misfortuneWheelAngle + i * slice - Math.PI / 2;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius - 10, start, end);
    ctx.closePath();
    ctx.fillStyle = MISFORTUNE_WHEEL_COLORS[i % MISFORTUNE_WHEEL_COLORS.length];
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    const label = items[i].length > 22 ? `${items[i].slice(0, 22)}...` : items[i];
    ctx.fillText(label, radius - 28, 8);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, TWO_PI);
  ctx.fillStyle = "#102c40";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#f3f4f6";
  ctx.stroke();

  ctx.fillStyle = "#f9fafb";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GO", cx, cy);
}

export function showMisfortuneWheel(payload = {}) {
  const overlay = ensureMisfortuneWheelOverlay();
  misfortuneWheelItems = Array.isArray(payload.items)
    ? payload.items.map((item) => String(item || "").trim()).filter(Boolean)
    : misfortuneWheelItems;
  misfortuneWheelAngle = Number.isFinite(Number(payload.angle))
    ? normalizeWheelAngle(Number(payload.angle))
    : misfortuneWheelAngle;
  drawMisfortuneWheel();
  overlay.classList.add("active");
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
}

export function updateMisfortuneWheel(payload = {}) {
  if (Array.isArray(payload.items)) {
    misfortuneWheelItems = payload.items.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (payload.angle != null && Number.isFinite(Number(payload.angle))) {
    misfortuneWheelAngle = normalizeWheelAngle(Number(payload.angle));
  }
  drawMisfortuneWheel();
}

export function showMisfortuneWheelResult(payload = {}) {
  const overlay = ensureMisfortuneWheelOverlay();
  const resultEl = overlay.querySelector("#plateauMisfortuneWheelResult");
  if (resultEl) resultEl.textContent = "Roue de l'infortune";
}

export function hideMisfortuneWheel() {
  if (!misfortuneWheelOverlay) return;
  misfortuneWheelOverlay.classList.remove("active");
}

export function showFlag(src, altText = "Drapeau", mediaSrc = null, mode = "flag") {
  const overlay = ensureFlagOverlay();
  if (misfortuneWheelOverlay) misfortuneWheelOverlay.classList.remove("active");
  const img = overlay.querySelector(".flag-image");
  const token = ++flagLoadToken;
  if (img) {
    // Hard reset: retire immediatement l'ancien media de l'ecran.
    img.style.transition = "none";
    img.style.opacity = "0";
    img.removeAttribute("src");
    // Force le navigateur a appliquer le reset avant le nouveau src.
    void img.offsetWidth;
    img.style.transition = "";
    img.alt = altText;
    const preload = new Image();
    preload.decoding = "async";
    preload.onload = () => {
      if (token !== flagLoadToken) return;
      img.src = src;
      img.alt = altText;
      window.requestAnimationFrame(() => {
        if (token === flagLoadToken) img.style.opacity = "1";
      });
    };
    preload.onerror = () => {
      if (token !== flagLoadToken) return;
      img.src = src;
      img.style.opacity = "1";
    };
    preload.src = src;
  }
  overlay.classList.toggle("flag-mode", mode === "flag");
  overlay.classList.toggle("people-mode", mode === "people");
  overlay.classList.add("active");
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
  if (mediaSrc) {
    playMusic(mediaSrc);
  }
}

export function showGeneralQuestion(payload = {}) {
  if (misfortuneWheelOverlay) misfortuneWheelOverlay.classList.remove("active");
  const overlay = ensureGeneralQuestionOverlay();
  const text = overlay.querySelector("#generalQuestionText");
  const questionWindow = overlay.querySelector(".general-question-window");
  const choicesStage = overlay.querySelector("#generalQuestionChoices");
  if (text) text.textContent = String(payload.question || "").trim() || "Question indisponible";
  const showQuestion = payload.showQuestion !== false;
  if (questionWindow) {
    const wasHidden = questionWindow.classList.contains("hidden");
    questionWindow.classList.toggle("hidden", !showQuestion);
    if (showQuestion && wasHidden) {
      questionWindow.classList.remove("question-reveal-anim");
      void questionWindow.offsetWidth;
      questionWindow.classList.add("question-reveal-anim");
      playFx(sounds.appear);
    }
  }

  const options = Array.isArray(payload.options)
    ? payload.options.filter((x) => String(x || "").trim())
    : [];

  if (choicesStage) {
    const requestedCount = Number(payload.choicesRevealCount);
    const revealCount = Number.isInteger(requestedCount)
      ? Math.max(0, Math.min(options.length, requestedCount))
      : (payload.showChoices ? options.length : 0);

    if (payload.showChoices && revealCount > 0 && options.length) {
      for (let i = 0; i < 4; i++) {
        const win = overlay.querySelector(`#generalQuestionChoice${i}`)?.closest(".general-question-choice-window");
        const box = overlay.querySelector(`#generalQuestionChoice${i}`);
        if (!win || !box) continue;
        const value = options[i] || "";
        box.textContent = value;
        box.classList.remove("answer-correct", "answer-wrong");
        win.classList.remove("answer-correct", "answer-wrong");
        const shouldShow = !!value && i < revealCount;
        const wasHidden = win.classList.contains("hidden");
        win.classList.toggle("hidden", !shouldShow);
        if (shouldShow && wasHidden) {
          win.classList.remove("choice-reveal-anim");
          void win.offsetWidth;
          win.classList.add("choice-reveal-anim");
          playFx(sounds.appear);
        }
      }
      choicesStage.classList.remove("hidden");
    } else {
      choicesStage.classList.add("hidden");
      for (let i = 0; i < 4; i++) {
        const win = overlay.querySelector(`#generalQuestionChoice${i}`)?.closest(".general-question-choice-window");
        if (!win) continue;
        win.classList.remove("choice-reveal-anim");
        win.classList.add("hidden");
      }
    }
  }

  const showChoices = !!(payload.showChoices && options.length);
  if (!showQuestion && !showChoices) {
    overlay.classList.remove("active");
    if (generalQuestionMusicActive) {
      stopMusic();
      generalQuestionMusicActive = false;
    }
    gridEl.style.display = "";
    defBar?.classList.remove("hidden");
    return;
  }

  overlay.classList.add("active");
  if (!generalQuestionMusicActive) {
    generalQuestionMusicActive = true;
    playMusic(GENERAL_QUESTION_MUSIC_SRC, { visualizer: false });
  }
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
}

export function showGoldenFamily(payload = {}) {
  const overlay = ensureGoldenFamilyOverlay();
  const questionEl = overlay.querySelector("#goldenFamilyQuestion");
  const boardEl = overlay.querySelector("#goldenFamilyBoard");
  const pointsEl = overlay.querySelector("#goldenFamilyRoundPoints");
  const visible = !!payload.visible;

  if (!visible) {
    overlay.classList.remove("active");
    gridEl.style.display = "";
    defBar?.classList.remove("hidden");
    return;
  }

  if (questionEl) {
    questionEl.textContent = String(payload.question || "").trim() || "Question";
  }

  if (boardEl) {
    boardEl.innerHTML = "";
    const answers = Array.isArray(payload.answers) ? payload.answers.slice(0, 8) : [];
    answers.forEach((answer, index) => {
      const cell = document.createElement("div");
      cell.className = `golden-family-cell${answer?.revealed ? " revealed" : ""}`;
      const rank = Number(answer?.rank) || index + 1;
      const label = answer?.revealed ? String(answer?.answer || "") : "";
      const score = answer?.revealed ? Number(answer?.score) || 0 : "";

      const rankEl = document.createElement("div");
      rankEl.className = "golden-family-cell-rank";
      rankEl.textContent = `${rank}`;

      const answerEl = document.createElement("div");
      answerEl.className = "golden-family-cell-answer";
      answerEl.textContent = label || " ";

      const scoreEl = document.createElement("div");
      scoreEl.className = "golden-family-cell-score";
      scoreEl.textContent = score === "" ? " " : `${score}`;

      cell.appendChild(rankEl);
      cell.appendChild(answerEl);
      cell.appendChild(scoreEl);
      boardEl.appendChild(cell);
    });
  }

  if (pointsEl) {
    pointsEl.textContent = `${Number(payload.roundPoints) || 0}`;
  }

  overlay.classList.add("active");
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
}

export function showLettersGame(payload = {}) {
  const overlay = ensureLettersGameOverlay();
  const boardEl = overlay.querySelector("#lettersGameBoard");
  const wordEl = overlay.querySelector("#lettersGameCurrentWord");
  const visible = !!payload.visible;
  const wasActive = overlay.classList.contains("active");

  if (!visible) {
    overlay.classList.remove("active");
    setLettersGameDucking(false);
    if (wasActive) stopMusic();
    gridEl.style.display = "";
    defBar?.classList.remove("hidden");
    return;
  }

  if (boardEl) {
    const letters = Array.isArray(payload.letters) ? payload.letters.slice(0, 10) : [];
    const revealCount = Math.max(0, Math.min(letters.length, Number(payload.revealCount) || 0));
    const usedCounts = countWordLetters(payload.currentWord || "");

    if (boardEl.children.length !== letters.length) {
      boardEl.innerHTML = "";
      letters.forEach((letter) => {
        const chip = document.createElement("div");
        chip.className = "letters-game-board-chip hidden";
        chip.textContent = String(letter || "");
        boardEl.appendChild(chip);
      });
    }

    [...boardEl.children].forEach((chip, index) => {
      chip.textContent = String(letters[index] || "");
      const shouldShow = index < revealCount;
      const wasHidden = chip.classList.contains("hidden");
      chip.classList.remove("used");
      if (shouldShow) {
        const letter = String(letters[index] || "");
        const remaining = usedCounts.get(letter) || 0;
        if (remaining > 0) {
          chip.classList.add("used");
          usedCounts.set(letter, remaining - 1);
        }
      }
      chip.classList.toggle("hidden", !shouldShow);
      if (shouldShow && wasHidden) {
        chip.classList.remove("chip-reveal-anim");
        void chip.offsetWidth;
        chip.classList.add("chip-reveal-anim");
        playFx(sounds.appear);
      }
    });
  }

  if (wordEl) {
    const currentWord = String(payload.currentWord || "").trim();
    wordEl.innerHTML = "";
    wordEl.classList.toggle("hidden", !currentWord);
    [...currentWord].forEach((letter) => {
      const chip = document.createElement("div");
      chip.className = "letters-game-current-word-chip";
      chip.textContent = letter;
      wordEl.appendChild(chip);
    });
  }

  overlay.classList.add("active");
  setLettersGameDucking(true);
  if (!wasActive) {
    playMusic(LETTERS_GAME_THEME_SRC, { visualizer: false });
  }
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
}

export function showNumbersGame(payload = {}) {
  const overlay = ensureNumbersGameOverlay();
  const targetEl = overlay.querySelector("#numbersGameBoardTarget");
  const poolEl = overlay.querySelector("#numbersGameBoardPool");
  const calculationEl = overlay.querySelector("#numbersGameCalculation");
  const currentLineEl = overlay.querySelector("#numbersGameCurrentLine");
  const visible = !!payload.visible;
  const wasActive = overlay.classList.contains("active");

  if (!visible) {
    overlay.classList.remove("active");
    setNumbersGameDucking(false);
    if (wasActive) stopMusic();
    gridEl.style.display = "";
    defBar?.classList.remove("hidden");
    return;
  }

    const numbers = Array.isArray(payload.numbers) ? payload.numbers.slice(0, 6) : [];
    const revealCount = Math.max(0, Math.min(numbers.length + 1, Number(payload.revealCount) || 0));

  if (targetEl) {
    const shouldShowTarget = revealCount >= 1;
    const wasHidden = targetEl.classList.contains("hidden");
    targetEl.textContent = Number.isInteger(Number(payload.target)) ? String(payload.target) : "-";
    targetEl.classList.toggle("hidden", !shouldShowTarget);
    if (shouldShowTarget && wasHidden) {
      targetEl.classList.remove("chip-reveal-anim");
      void targetEl.offsetWidth;
      targetEl.classList.add("chip-reveal-anim");
      playFx(sounds.appear);
    }
  }

  if (poolEl) {
    if (poolEl.children.length !== numbers.length) {
      poolEl.innerHTML = "";
      numbers.forEach((number) => {
        const chip = document.createElement("div");
        chip.className = "numbers-game-board-chip hidden";
        chip.textContent = String(number ?? "");
        poolEl.appendChild(chip);
      });
    }

    [...poolEl.children].forEach((chip, index) => {
      const entry = numbers[index];
      const value = typeof entry === "object" && entry !== null ? entry.value : entry;
      const used = !!(typeof entry === "object" && entry !== null && entry.used);
      chip.textContent = String(value ?? "");
      chip.classList.toggle("used", used);
      const shouldShow = index < Math.max(0, revealCount - 1);
      const wasHidden = chip.classList.contains("hidden");
      chip.classList.toggle("hidden", !shouldShow);
      if (shouldShow && wasHidden) {
        chip.classList.remove("chip-reveal-anim");
        void chip.offsetWidth;
        chip.classList.add("chip-reveal-anim");
        playFx(sounds.appear);
      }
    });
  }

  if (calculationEl) {
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    calculationEl.innerHTML = "";
    calculationEl.classList.toggle("hidden", !steps.length);
    steps.forEach((step) => {
      const block = document.createElement("div");
      block.className = "numbers-game-calculation-step";
      const operation = step?.operation === "*" ? "×" : step?.operation === "/" ? "÷" : step?.operation || "";
      block.textContent = `${step?.left ?? ""}${operation}${step?.right ?? ""} = ${step?.result ?? ""}`;
      calculationEl.appendChild(block);
    });
  }

  if (currentLineEl) {
    const currentLine = String(payload.currentLine || "").trim();
    currentLineEl.textContent = currentLine;
    currentLineEl.classList.toggle("hidden", !currentLine);
  }

  overlay.classList.add("active");
  setNumbersGameDucking(true);
  if (!wasActive) {
    playMusic(NUMBERS_GAME_THEME_SRC, { visualizer: false });
  }
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
}

export function markGeneralAnswer(index, isCorrect) {
  const overlay = ensureGeneralQuestionOverlay();
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;

  const box = overlay.querySelector(`#generalQuestionChoice${idx}`);
  const win = box?.closest(".general-question-choice-window");
  if (!box || !win || win.classList.contains("hidden")) return;

  box.classList.remove("answer-correct", "answer-wrong");
  win.classList.remove("answer-correct", "answer-wrong");
  if (isCorrect) {
    box.classList.add("answer-correct");
    win.classList.add("answer-correct");
  } else {
    box.classList.add("answer-wrong");
    win.classList.add("answer-wrong");
  }
}

export { FLAG_ANTHEM_SRC, PEOPLE_THEME_SRC };

export function hideAllMedia() {
  if (flagOverlay) {
    flagOverlay.classList.remove("active");
    flagOverlay.classList.remove("flag-mode");
    flagOverlay.classList.remove("people-mode");
    const img = flagOverlay.querySelector(".flag-image");
    if (img) img.style.opacity = "1";
  }
  if (scoresOverlay) scoresOverlay.classList.remove("active");
  if (podiumOverlay) podiumOverlay.classList.remove("active");
  if (filmsOverlay) filmsOverlay.classList.remove("active");
  stopPodiumConfetti();
  podiumLastCelebratedStep = -1;
  stopPodiumSuspense({ restore: true });
  stopAllFx();
  if (generalQuestionOverlay) generalQuestionOverlay.classList.remove("active");
  if (goldenFamilyOverlay) goldenFamilyOverlay.classList.remove("active");
  if (lettersGameOverlay) lettersGameOverlay.classList.remove("active");
  if (numbersGameOverlay) numbersGameOverlay.classList.remove("active");
  setLettersGameDucking(false);
  setNumbersGameDucking(false);
  if (misfortuneWheelOverlay) misfortuneWheelOverlay.classList.remove("active");
  generalQuestionMusicActive = false;
  stopMusic();
  stopActionAnimation();
  const vid = genericVideo;
  if (vid) {
    vid.pause();
    vid.currentTime = 0;
    vid.style.display = "none";
    vid.loop = false;
    vid.volume = 1;
    currentVideoMode = null;
    gridEl.style.visibility = "visible";
    defBar?.classList.remove("hidden");
  }
  setVideoDucking(false);
  setDuckLevelOverride(null);
  currentVideoMode = null;
  gridEl.style.display = "";
  if (state.wantsFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}
