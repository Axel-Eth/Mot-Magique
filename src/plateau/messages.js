import { state } from "./state.js";
import {
  animateWordReveal,
  applySelection,
  buildGridDOM,
  buildMagicWordCells,
  checkGridCompletion,
  isMagicWordCell,
  rebuildGrid,
  renderCell,
  resetTimer,
  showNumbersForLetter,
  startTimer
} from "./grid.js";
import {
  beginExternalDucking,
  endExternalDucking,
  playFx,
  playMusic,
  playPlateauMusic,
  requestRestartPlateauMusic,
  schedulePlateauMusicRestart,
  safePlay,
  safeStop,
  sounds,
  stopAllFx,
  stopMusic,
  stopRevealSound
} from "./audio.js";
import {
  FLAG_ANTHEM_SRC,
  PEOPLE_THEME_SRC,
  hideAllMedia,
  playBadVideo,
  playDoubleVideo,
  playGenericVideo,
  playTripleVideo,
  showFlag,
  toggleScores,
  updateMultiplierBadge
} from "./media.js";
import { scatterFloatingLetters } from "./letters.js";

const controlChannel = (() => {
  try {
    return new BroadcastChannel("avm_control");
  } catch {
    return null;
  }
})();

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    state.wantsFullscreen = true;
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    state.wantsFullscreen = false;
    document.exitFullscreen().catch(() => {});
  }
}

function broadcastReady() {
  if (!controlChannel) return;
  try {
    controlChannel.postMessage({ type: "PLATEAU_READY" });
  } catch {}
}

function forceActionDucking(durationMs = 900) {
  beginExternalDucking();
  window.setTimeout(() => {
    endExternalDucking();
  }, durationMs);
}

export function registerMessageHandlers() {
  if (controlChannel) {
    controlChannel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;

      if (msg.type === "PING_PLATEAU") {
        broadcastReady();
        return;
      }

      if (msg.type === "TOGGLE_FULLSCREEN") {
        toggleFullscreen();
      }
    };
  }

  broadcastReady();

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "LOAD_GRID":
        state.grid = rebuildGrid(msg.grid);
        state.grid.magicWordCells = buildMagicWordCells(state.grid.magicWordId);
        if (!state.grid.magicSolved) {
          for (const pos of state.grid.magicWordCells) {
            state.grid.revealed.set(pos, false);
          }
        }
        buildGridDOM();
        safeStop(sounds.ambient);
        break;

      case "RESET_REVEAL":
        for (const [pos] of state.grid.letters) {
          state.grid.revealed.set(pos, false);
          const [r, c] = pos.split(",").map(Number);
          renderCell(r, c);
        }
        state.grid.magicSolved = false;
        applySelection(null);
        updateMultiplierBadge(1);
        break;

      case "SET_MAGIC_WORD":
        state.grid.magicWordId = msg.wordId ?? null;
        state.grid.magicWordCells = buildMagicWordCells(state.grid.magicWordId);
        state.grid.magicSolved = false;
        for (const pos of state.grid.magicWordCells) {
          state.grid.revealed.set(pos, false);
        }
        for (const [pos] of state.grid.letters) {
          const [r, c] = pos.split(",").map(Number);
          renderCell(r, c);
        }
        break;

      case "REVEAL_LETTER":
        // Priorité à la révélation: on coupe le média en cours avant le son de lettre.
        hideAllMedia();
        stopAllFx("reveal");
        for (const [pos, letter] of state.grid.letters) {
          if (letter === msg.letter && !state.grid.revealed.get(pos) && (!isMagicWordCell(pos) || state.grid.magicSolved)) {
            state.grid.revealed.set(pos, true);
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

      case "PLAY_SFX":
        if (msg.key === "correct") {
          stopAllFx("correct");
          playFx(sounds.correct);
        } else if (msg.key === "fail") {
          stopAllFx("fail");
          playFx(sounds.fail);
        }
        break;

      case "SCORES_UPDATE":
        toggleScores(!!msg.show, msg.teams || []);
        break;

      case "SHOW_FLAG":
        if (msg.src) showFlag(msg.src, msg.alt || "Drapeau", FLAG_ANTHEM_SRC);
        break;

      case "SHOW_PEOPLE":
        if (msg.src) showFlag(msg.src, msg.alt || "Personnalite", PEOPLE_THEME_SRC);
        break;

      case "PLAY_MUSIC":
        playMusic(msg.src, { visualizer: !!msg.visualizer });
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
        const word = state.grid.words[msg.wordId];
        if (!word) return;

        stopAllFx("correct");
        forceActionDucking();
        requestRestartPlateauMusic();
        safePlay(sounds.correct);
        schedulePlateauMusicRestart(200);

        for (const p of word.cells) {
          const pos = `${p.r},${p.c}`;
          if (!isMagicWordCell(pos) || state.grid.magicSolved) {
            state.grid.revealed.set(pos, true);
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
        const word = state.grid.words[msg.wordId];
        if (!word) return;

        stopAllFx("correct");
        forceActionDucking();
        requestRestartPlateauMusic();
        safePlay(sounds.correct);
        schedulePlateauMusicRestart(200);
        state.grid.magicSolved = true;
        for (const [pos] of state.grid.letters) {
          state.grid.revealed.set(pos, true);
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
        const word = state.grid.words[msg.wordId];
        if (!word) return;
        stopAllFx("fail");
        forceActionDucking();
        requestRestartPlateauMusic();
        playFx(sounds.fail);
        schedulePlateauMusicRestart(200);

        const wordCells = new Set(word.cells.map((p) => `${p.r},${p.c}`));

        for (const [pos] of state.grid.letters) {
          if (!state.grid.revealed.get(pos) && wordCells.has(pos)) {
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
          const word = state.grid.words[msg.wordId];
          if (word) {
            // Une sélection de mot reprend la main: on coupe le média en cours.
            hideAllMedia();
            applySelection(word);
            startTimer(30);
          }
        }
        break;
      }

      case "TOGGLE_FULLSCREEN":
        toggleFullscreen();
        break;
    }
  });

  window.addEventListener("click", stopRevealSound, true);

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

  window.addEventListener("beforeunload", () => {
    const host = window.opener || (window.parent && window.parent !== window ? window.parent : null);
    try {
      if (host) host.postMessage({ type: "PLATEAU_CLOSED" }, "*");
    } catch {}
    if (controlChannel) {
      try {
        controlChannel.postMessage({ type: "PLATEAU_CLOSED" });
      } catch {}
    }
  });
}
