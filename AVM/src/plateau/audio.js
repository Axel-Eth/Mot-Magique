

// Je vais abondament, et même de manière abusive commenter mon code pour le comrpendre au mieux

// Création d'un objet sounds ayant en propriété des objets Audio qui sont en fait les différents bruitages de ma régie ; l'ambiance du plateau, la bonne réponse, la mauvaise réponse, la grille complète, etc.

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

// On active la propriété loop qui permet à un objet audio d'être joué en boucle lorsqu'il est appelé avec la fonction .play().

sounds.ambient.loop = true;

// Création d'une constante musicPlayer qui est objet audio vide pour le moment et on désactive sa proriété loop.

const musicPlayer = new Audio();
musicPlayer.loop = false;

// Création d'une constante pour la musique du plateau avec une initialisation vide et une propriété de loop désactivée. Je ne comprends pas encore pourquoi.

const plateauMusicPlayer = new Audio();
plateauMusicPlayer.loop = true;

let plateauMusicWanted = null;
let fxActiveCount = 0;
let plateauMusicRestartRequested = false;

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
  try {
    plateauMusicPlayer.pause();
    plateauMusicPlayer.currentTime = 0;
    plateauMusicPlayer.play();
  } catch {}
}

function resumePlateauMusic() {
  if (!plateauMusicWanted || fxActiveCount > 0) return;
  try {
    plateauMusicPlayer.play();
  } catch {}
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

function schedulePlateauMusicRestart(delayMs = 200) {
  if (!plateauMusicWanted) return;
  setTimeout(() => {
    if (plateauMusicRestartRequested && fxActiveCount === 0) {
      plateauMusicRestartRequested = false;
      restartPlateauMusicNow();
    }
  }, delayMs);
}

musicPlayer.addEventListener("play", notifyFxStart);
musicPlayer.addEventListener("ended", notifyFxEnd);

plateauMusicPlayer.addEventListener("ended", () => {
  if (plateauMusicWanted && fxActiveCount === 0) {
    resumePlateauMusic();
  }
});

const FX_KEYS = ["selectWord", "magicSelect", "reveal", "correct", "wrong", "fail", "timer"];

FX_KEYS.forEach((key) => {
  const audio = sounds[key];
  if (!audio) return;
  audio.addEventListener("play", notifyFxStart);
  audio.addEventListener("ended", notifyFxEnd);
});

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

function stopAllFx(exceptKey = null) {
  for (const key of FX_KEYS) {
    if (key === exceptKey) continue;
    safeStop(sounds[key]);
  }
}

function stopRevealSound() {
  safeStop(sounds.reveal);
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
