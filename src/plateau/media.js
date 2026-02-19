import { gridEl, defBar } from "./dom.js";
import { state } from "./state.js";
import { beginExternalDucking, endExternalDucking, playMusic, setDuckLevelOverride, stopAllFx, stopMusic } from "./audio.js";

const FLAG_ANTHEM_SRC = "sounds/hymnes_nationaux.mp3";
const PEOPLE_THEME_SRC = "sounds/guess_persona.mp3";
const FILMS_EXTRACTS_VIDEO_SRC = "sounds/extraits_films.mp4";
const FILMS_EXTRACTS_VIDEO_VOLUME = 0.08;
const FILMS_DUCK_LEVEL = 0.02;
const FILMS_FADE_MS = 280;

let multiplierBadge = null;
let scoresOverlay = null;
let flagOverlay = null;
let generalQuestionOverlay = null;
let flagLoadToken = 0;
let genericVideo = null;
let videoDuckingActive = false;
let currentVideoMode = null;
let mediaLifecycleBound = false;

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

export function playBadVideo() {
  playVideo("sounds/bad_word_new.mp4", { mode: "bad" });
}

export function playFilmsOverlayVideo() {
  playVideo(FILMS_EXTRACTS_VIDEO_SRC, {
    volume: FILMS_EXTRACTS_VIDEO_VOLUME,
    loop: true,
    mode: "films_overlay"
  });
}

export function stopFilmsOverlayVideo() {
  if (currentVideoMode !== "films_overlay") return;
  const vid = genericVideo;
  if (!vid) return;
  try {
    vid.pause();
    vid.currentTime = 0;
    vid.loop = false;
    vid.volume = 1;
  } catch {}
  fadeOutVideo(vid, () => {
    currentVideoMode = null;
    setVideoDucking(false);
    setDuckLevelOverride(null);
    gridEl.style.visibility = "visible";
    defBar?.classList.remove("hidden");
    vid.style.opacity = "1";
  });
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

export function toggleScores(show, teams) {
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

export function showFlag(src, altText = "Drapeau", mediaSrc = null, mode = "flag") {
  const overlay = ensureFlagOverlay();
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
    gridEl.style.display = "";
    defBar?.classList.remove("hidden");
    return;
  }

  overlay.classList.add("active");
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
  if (generalQuestionOverlay) generalQuestionOverlay.classList.remove("active");
  stopMusic();
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
  gridEl.style.display = "";
  if (state.wantsFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}
