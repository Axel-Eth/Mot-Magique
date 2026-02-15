const FX_SOURCES = {
  ambient: "sounds/musique_plateau/musique_plateau.mp3",
  correct: "sounds/correct_answer.mp3",
  wrong: "sounds/fail_sound_effect.mp3",
  gridComplete: "sounds/correct_answer.mp3",
  timer: "sounds/Magic_Word_Countdown.mp3",
  reveal: "sounds/lettre_revele_regie.mp3",
  fail: "sounds/fail_sound_effect.mp3",
  selectWord: "sounds/selection_mot_grille.mp3",
  magicSelect: "sounds/Magic_Word_Countdown.mp3"
};

const FX_KEYS = ["selectWord", "magicSelect", "reveal", "correct", "wrong", "fail", "timer", "gridComplete"];
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
let duckCount = 0;
let currentFxKey = null;
let currentFxToken = 0;
let fxStopTimer = null;
let mediaToken = 0;
let plateauMusicWanted = null;
let plateauMusicRestartRequested = false;

const DUCK_LEVEL = 0.25;
const BASE_LEVEL = 1;
const DUCK_ATTACK_MS = 30;
const DUCK_RELEASE_MS = 350;

function ensureAudioGraph() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  const source = audioCtx.createMediaElementSource(plateauMusicPlayer);
  plateauGain = audioCtx.createGain();
  plateauGain.gain.value = BASE_LEVEL;
  source.connect(plateauGain).connect(audioCtx.destination);
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

function duckOn() {
  duckCount += 1;
  if (duckCount === 1) {
    smoothPlateauGain(DUCK_LEVEL, DUCK_ATTACK_MS);
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
  duckOff();
}

function getKeyFromAudioRef(audioRef) {
  if (!audioRef || typeof audioRef !== "object") return null;
  return typeof audioRef.key === "string" ? audioRef.key : null;
}

async function playFxByKey(key, maxDurationMs = null) {
  const src = FX_SOURCES[key];
  if (!src) return;

  stopCurrentFx();
  currentFxKey = key;
  const token = ++currentFxToken;
  duckOn();

  try {
    await ensureAudioReady();
    fxPlayer.src = src;
    fxPlayer.currentTime = 0;
    await fxPlayer.play();
  } catch {
    if (currentFxToken === token) {
      currentFxKey = null;
      duckOff();
    }
    return;
  }

  const cleanup = () => {
    if (currentFxToken !== token) return;
    clearFxTimer();
    currentFxKey = null;
    duckOff();
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
};
mediaPlayer.onpause = () => {
  if (!mediaPlayer.ended && mediaPlayer.currentTime > 0) {
    duckOff();
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
  } catch {}
  duckOff();
}

async function playMusic(src) {
  if (!src) return;
  stopMusic();
  duckOn();
  const token = ++mediaToken;
  try {
    await ensureAudioReady();
    mediaPlayer.src = src;
    mediaPlayer.currentTime = 0;
    await mediaPlayer.play();
  } catch {
    if (mediaToken === token) duckOff();
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

export {
  sounds,
  playMusic,
  stopMusic,
  playPlateauMusic,
  pausePlateauMusic,
  requestRestartPlateauMusic,
  resumePlateauMusic,
  restartPlateauMusicNow,
  schedulePlateauMusicRestart,
  safePlay,
  safeStop,
  playFx,
  stopAllFx,
  stopRevealSound
};
