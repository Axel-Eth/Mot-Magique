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
