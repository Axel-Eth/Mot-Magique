import { gridEl, defBar } from "./dom.js";
import { state } from "./state.js";
import { beginExternalDucking, endExternalDucking, playMusic, stopAllFx, stopMusic } from "./audio.js";

const FLAG_ANTHEM_SRC = "sounds/hymnes_nationaux.mp3";
const PEOPLE_THEME_SRC = "sounds/guess_persona.mp3";

let multiplierBadge = null;
let scoresOverlay = null;
let flagOverlay = null;
let genericVideo = null;
let videoDuckingActive = false;

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
    setVideoDucking(false);
    vid.style.display = "none";
    vid.src = "sounds/generique_avm.mp4";
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

function playVideo(src) {
  const vid = ensureGenericVideo();
  if (!vid) return;

  stopAllFx();
  setVideoDucking(true);
  vid.src = src;
  vid.currentTime = 0;
  gridEl.style.visibility = "hidden";
  defBar?.classList.add("hidden");
  vid.style.display = "block";
  vid.play().catch(() => {
    setVideoDucking(false);
  });
}

export function playGenericVideo() {
  playVideo("sounds/generique_avm.mp4");
}

export function playTripleVideo() {
  playVideo("sounds/mot_triple.mp4");
}

export function playDoubleVideo() {
  playVideo("sounds/mot_double.mp4");
}

export function playBadVideo() {
  playVideo("sounds/bad_word.mp4");
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

export function showFlag(src, altText = "Drapeau", mediaSrc = null) {
  const overlay = ensureFlagOverlay();
  const img = overlay.querySelector(".flag-image");
  if (img) {
    img.src = src;
    img.alt = altText;
  }
  overlay.classList.add("active");
  gridEl.style.display = "none";
  defBar?.classList.add("hidden");
  if (mediaSrc) {
    playMusic(mediaSrc);
  }
}

export { FLAG_ANTHEM_SRC, PEOPLE_THEME_SRC };

export function hideAllMedia() {
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
  setVideoDucking(false);
  gridEl.style.display = "";
  if (state.wantsFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}
