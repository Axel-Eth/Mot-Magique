import { setAnalyser as setVisualizerAnalyser, start as startVisualizer, stop as stopVisualizer } from "./visualizerOverlay.js";

const FX_SOURCES = {
  ambient: "sounds/musique_plateau/musique_plateau.mp3",
  correct: "sounds/correct_answer.mp3",
  wrong: "sounds/fail_sound_effect.mp3",
  gridComplete: "sounds/correct_answer.mp3",
  timer: "sounds/Magic_Word_Countdown.mp3",
  reveal: "sounds/lettre_revele_regie.mp3",
  appear: "sounds/bruitage_apparition.mp3",
  fail: "sounds/fail_sound_effect.mp3",
  selectWord: "sounds/selection_mot_grille.mp3",
  magicSelect: "sounds/Magic_Word_Countdown.mp3",
  podiumVictory: "sounds/victory_podium_sound.mp3",
  podiumThird: "sounds/thrid_victory_sound.mp3",
  podiumSecond: "sounds/second_victory_sound.mp3",
  podiumFirst: "sounds/first_victory_sound.mp3"
};

const sounds = Object.fromEntries(Object.keys(FX_SOURCES).map((key) => [key, { key }]));

const plateauMusicPlayer = new Audio();
plateauMusicPlayer.loop = true;
plateauMusicPlayer.preload = "auto";
plateauMusicPlayer.crossOrigin = "anonymous";

const mediaPlayer = new Audio();
mediaPlayer.loop = false;
mediaPlayer.preload = "auto";
mediaPlayer.crossOrigin = "anonymous";

const fxPlayer = new Audio();
fxPlayer.loop = false;
fxPlayer.preload = "auto";
fxPlayer.crossOrigin = "anonymous";

let audioCtx = null;
let plateauGain = null;
let mediaSource = null;
let mediaAnalyser = null;
let duckCount = 0;
let currentFxKey = null;
let currentFxDucksMedia = false;
let currentFxToken = 0;
let fxStopTimer = null;
let mediaToken = 0;
let mediaVisualizerEnabled = false;
let plateauMusicWanted = null;
let plateauMusicRestartRequested = false;
let duckLevelOverride = null;

const DUCK_LEVEL = 0.02;
const BASE_LEVEL = 1;
const DUCK_ATTACK_MS = 30;
const DUCK_RELEASE_MS = 350;
const MEDIA_DUCK_FACTOR = 0.32;

let mediaBaseVolume = 1;
let mediaDuckCount = 0;

function ensureAudioGraph() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();

  const plateauSource = audioCtx.createMediaElementSource(plateauMusicPlayer);
  plateauGain = audioCtx.createGain();
  plateauGain.gain.value = BASE_LEVEL;
  plateauSource.connect(plateauGain).connect(audioCtx.destination);

  mediaSource = audioCtx.createMediaElementSource(mediaPlayer);
  mediaAnalyser = audioCtx.createAnalyser();
  mediaAnalyser.fftSize = 1024; // visualizer detail/perf
  mediaAnalyser.smoothingTimeConstant = 0.82;
  mediaSource.connect(audioCtx.destination);
  mediaSource.connect(mediaAnalyser);
  setVisualizerAnalyser(mediaAnalyser);
}

async function ensureAudioReady() {
  ensureAudioGraph();
  if (audioCtx && audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {}
  }
}

function smoothPlateauGain(target, ms) {
  if (!plateauGain || !audioCtx) {
    plateauMusicPlayer.volume = target;
    return;
  }
  const now = audioCtx.currentTime;
  const g = plateauGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(target, now + ms / 1000);
}

function applyMediaVolume() {
  mediaPlayer.volume = Math.max(
    0,
    Math.min(1, mediaBaseVolume * (mediaDuckCount > 0 ? MEDIA_DUCK_FACTOR : 1))
  );
}

function duckMediaOn() {
  mediaDuckCount += 1;
  applyMediaVolume();
}

function duckMediaOff() {
  mediaDuckCount = Math.max(0, mediaDuckCount - 1);
  applyMediaVolume();
}

function duckOn() {
  duckCount += 1;
  if (duckCount === 1) {
    smoothPlateauGain(duckLevelOverride ?? DUCK_LEVEL, DUCK_ATTACK_MS);
  }
}

function duckOff() {
  duckCount = Math.max(0, duckCount - 1);
  if (duckCount === 0) {
    smoothPlateauGain(BASE_LEVEL, DUCK_RELEASE_MS);
  }
}

async function tryPlayPlateauMusic() {
  if (!plateauMusicWanted) return;
  try {
    await ensureAudioReady();
    if (plateauMusicPlayer.src !== new URL(plateauMusicWanted, window.location.href).href) {
      plateauMusicPlayer.src = plateauMusicWanted;
    }
    if (plateauMusicPlayer.paused) {
      await plateauMusicPlayer.play();
    }
  } catch {}
}

function clearFxTimer() {
  if (!fxStopTimer) return;
  clearTimeout(fxStopTimer);
  fxStopTimer = null;
}

function stopCurrentFx() {
  clearFxTimer();
  if (!currentFxKey) return;
  currentFxToken += 1;
  try {
    fxPlayer.pause();
    fxPlayer.currentTime = 0;
  } catch {}
  currentFxKey = null;
  if (currentFxDucksMedia) duckMediaOff();
  currentFxDucksMedia = false;
  duckOff();
}

function getKeyFromAudioRef(audioRef) {
  if (!audioRef || typeof audioRef !== "object") return null;
  return typeof audioRef.key === "string" ? audioRef.key : null;
}

async function playFxByKey(key, maxDurationMs = null, options = {}) {
  const src = FX_SOURCES[key];
  if (!src) return;

  stopCurrentFx();
  currentFxKey = key;
  currentFxDucksMedia = !!options.duckMedia;
  const token = ++currentFxToken;
  duckOn();
  if (options.duckMedia) duckMediaOn();
  let finish = null;
  const done = new Promise((resolve) => {
    finish = resolve;
  });

  try {
    await ensureAudioReady();
    fxPlayer.src = src;
    fxPlayer.currentTime = 0;
    await fxPlayer.play();
  } catch {
    if (currentFxToken === token) {
      currentFxKey = null;
      duckOff();
      if (options.duckMedia) duckMediaOff();
      currentFxDucksMedia = false;
    }
    finish?.();
    return done;
  }

  const cleanup = () => {
    if (currentFxToken !== token) return;
    clearFxTimer();
    currentFxKey = null;
    duckOff();
    if (options.duckMedia) duckMediaOff();
    currentFxDucksMedia = false;
    finish?.();
  };

  fxPlayer.onended = cleanup;
  fxPlayer.onpause = () => {
    if (fxPlayer.currentTime > 0 && !fxPlayer.ended) cleanup();
  };

  if (typeof maxDurationMs === "number" && maxDurationMs > 0) {
    clearFxTimer();
    fxStopTimer = setTimeout(() => {
      if (currentFxToken !== token) return;
      try {
        fxPlayer.pause();
        fxPlayer.currentTime = 0;
      } catch {}
      cleanup();
    }, maxDurationMs);
  }

  return done;
}

window.addEventListener(
  "pointerdown",
  () => {
    void ensureAudioReady();
    void tryPlayPlateauMusic();
  },
  { passive: true }
);

mediaPlayer.onended = () => {
  duckOff();
  mediaVisualizerEnabled = false;
  stopVisualizer();
  window.dispatchEvent(new CustomEvent("plateau:long-media-ended"));
};

mediaPlayer.onpause = () => {
  if (!mediaPlayer.ended && mediaPlayer.currentTime > 0) {
    duckOff();
  }
  if (mediaVisualizerEnabled) {
    stopVisualizer();
  }
};

mediaPlayer.onplay = () => {
  if (mediaVisualizerEnabled) {
    startVisualizer();
  }
};

function safePlay(audioRef) {
  const key = getKeyFromAudioRef(audioRef);
  if (!key) return;
  void playFxByKey(key);
}

function safeStop(audioRef) {
  const key = getKeyFromAudioRef(audioRef);
  if (!key) return;
  if (key === currentFxKey) {
    stopCurrentFx();
  }
}

function playFx(audioRef, maxDurationMs = null) {
  const key = getKeyFromAudioRef(audioRef);
  if (!key) return;
  void playFxByKey(key, maxDurationMs);
}

function playFxSequence(audioRefs) {
  const keys = (audioRefs || []).map(getKeyFromAudioRef).filter(Boolean);
  if (!keys.length) return;
  void (async () => {
    for (const key of keys) {
      await playFxByKey(key);
    }
  })();
}

function playFxDuckingMedia(audioRef, maxDurationMs = null) {
  const key = getKeyFromAudioRef(audioRef);
  if (!key) return;
  void playFxByKey(key, maxDurationMs, { duckMedia: true });
}

function playFxSequenceDuckingMedia(audioRefs) {
  const keys = (audioRefs || []).map(getKeyFromAudioRef).filter(Boolean);
  if (!keys.length) return;
  void (async () => {
    for (const key of keys) {
      await playFxByKey(key, null, { duckMedia: true });
    }
  })();
}

function stopAllFx(exceptKey = null) {
  if (currentFxKey && currentFxKey !== exceptKey) {
    stopCurrentFx();
  }
}

function stopRevealSound() {
  if (currentFxKey === "reveal") {
    stopCurrentFx();
  }
}

function pausePlateauMusic() {
  if (!plateauMusicWanted) return;
  try {
    plateauMusicPlayer.pause();
  } catch {}
}

function requestRestartPlateauMusic() {
  if (!plateauMusicWanted) return;
  plateauMusicRestartRequested = true;
}

function restartPlateauMusicNow() {
  if (!plateauMusicWanted) return;
  plateauMusicRestartRequested = false;
  try {
    plateauMusicPlayer.currentTime = 0;
  } catch {}
  void tryPlayPlateauMusic();
}

function resumePlateauMusic() {
  void tryPlayPlateauMusic();
}

function schedulePlateauMusicRestart(delayMs = 200) {
  if (!plateauMusicWanted) return;
  window.setTimeout(() => {
    if (plateauMusicRestartRequested) restartPlateauMusicNow();
  }, delayMs);
}

function stopMusic() {
  mediaToken += 1;
  try {
    mediaPlayer.pause();
    mediaPlayer.currentTime = 0;
    mediaPlayer.loop = false;
  } catch {}
  mediaBaseVolume = 1;
  mediaDuckCount = 0;
  applyMediaVolume();
  mediaVisualizerEnabled = false;
  stopVisualizer();
  duckOff();
  window.dispatchEvent(new CustomEvent("plateau:long-media-stopped"));
}

async function playMusic(src, options = {}) {
  if (!src) return;
  stopMusic();
  duckOn();
  const token = ++mediaToken;
  mediaVisualizerEnabled = !!options.visualizer;
  mediaPlayer.loop = !!options.loop;
  mediaBaseVolume = typeof options.volume === "number"
    ? Math.max(0, Math.min(1, options.volume))
    : 1;
  applyMediaVolume();
  try {
    await ensureAudioReady();
    if (mediaVisualizerEnabled && mediaAnalyser) {
      setVisualizerAnalyser(mediaAnalyser);
    }
    mediaPlayer.src = src;
    mediaPlayer.currentTime = 0;
    await mediaPlayer.play();
  } catch {
    if (mediaToken === token) duckOff();
    mediaVisualizerEnabled = false;
    stopVisualizer();
  }
}

function playPlateauMusic(src) {
  plateauMusicWanted = src || null;
  plateauMusicRestartRequested = false;
  if (!plateauMusicWanted) {
    try {
      plateauMusicPlayer.pause();
      plateauMusicPlayer.currentTime = 0;
      plateauMusicPlayer.removeAttribute("src");
      plateauMusicPlayer.load();
    } catch {}
    return;
  }

  if (plateauMusicPlayer.src !== new URL(plateauMusicWanted, window.location.href).href) {
    try {
      plateauMusicPlayer.pause();
      plateauMusicPlayer.src = plateauMusicWanted;
      plateauMusicPlayer.currentTime = 0;
    } catch {}
  }
  void tryPlayPlateauMusic();
}

function getPlateauMusicSource() {
  return plateauMusicWanted;
}

function beginExternalDucking() {
  duckOn();
}

function endExternalDucking() {
  duckOff();
}

function setDuckLevelOverride(level = null) {
  duckLevelOverride = typeof level === "number" ? Math.max(0, Math.min(1, level)) : null;
  if (duckCount > 0) {
    smoothPlateauGain(duckLevelOverride ?? DUCK_LEVEL, DUCK_ATTACK_MS);
  }
}

export {
  sounds,
  playMusic,
  stopMusic,
  playPlateauMusic,
  getPlateauMusicSource,
  pausePlateauMusic,
  requestRestartPlateauMusic,
  resumePlateauMusic,
  restartPlateauMusicNow,
  schedulePlateauMusicRestart,
  safePlay,
  safeStop,
  playFx,
  playFxSequence,
  playFxDuckingMedia,
  playFxSequenceDuckingMedia,
  stopAllFx,
  stopRevealSound,
  beginExternalDucking,
  endExternalDucking,
  setDuckLevelOverride
};
