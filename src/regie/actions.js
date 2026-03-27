import { $ } from "./dom.js";
import { state } from "./state.js";
import { stopSelectSound } from "./audio.js";
import { isMagicWordCell, updateMagicButtonState } from "./magic.js";
import { syncScoresToPlateau, openPlateauWindow } from "./plateau.js";
import { postToPlateau } from "./bridge.js";
import { renderTeams, addTeam, hideTeamModal, showPenaltyRequiredModal, removeSelectedTeam } from "./teams.js";
import { showRegieScores } from "./scores.js";
import { renderRegieGrid, clearVisibleNumbers, refreshRegieGridLayout } from "./grid-view.js";
import { loadSelectedGrid, resetReveal } from "./grid-actions.js";
import { serializeGridForPlateau } from "./grid-data.js";
import {
  countRemainingLetters,
  setActionButtonsEnabled,
  setBadPointsActive,
  setMultiplier,
  setPlateauLabel,
  updateSelectedInfo
} from "./ui.js";
import { resetMediaForNewShow, syncPlateauBackgroundTheme } from "./media.js";
import { resetRegieTimer, startRegieTimer } from "./timer.js";
import { resetGoldenFamilyForNewShow } from "./golden-family.js";
import { resetLettersGameForNewShow } from "./letters-game.js";
import { resetNumbersGameForNewShow } from "./numbers-game.js";

const controlChannel = (() => {
  try {
    return new BroadcastChannel("avm_control");
  } catch {
    return null;
  }
})();

function broadcastToPlateau(msg) {
  if (!controlChannel || !msg) return;
  try {
    controlChannel.postMessage(msg);
  } catch {}
}

function openBonusModal() {
  $("bonusModal")?.classList.remove("hidden");
}

function closeBonusModal() {
  $("bonusModal")?.classList.add("hidden");
}

function isTypingTarget(target) {
  if (!target || !target.closest) return false;
  if (target.isContentEditable) return true;
  return !!target.closest("input, textarea, select, [contenteditable='true']");
}

function triggerButtonClick(id) {
  const button = $(id);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function handleRegieShortcut(e) {
  if (!e.ctrlKey) return false;
  if (e.altKey || e.metaKey) return false;
  if (isTypingTarget(e.target)) return false;

  const isAnimated = !!e.shiftKey;
  const keyCode = e.code;

  if (keyCode === "Digit1") {
    e.preventDefault();
    return triggerButtonClick("btnGeneric");
  }
  if (keyCode === "Digit2") {
    e.preventDefault();
    return triggerButtonClick(isAnimated ? "btnDoubleAnimated" : "btnDouble");
  }
  if (keyCode === "Digit3") {
    e.preventDefault();
    return triggerButtonClick(isAnimated ? "btnTripleAnimated" : "btnTriple");
  }
  if (keyCode === "Digit4") {
    e.preventDefault();
    return triggerButtonClick(isAnimated ? "btnBadAnimated" : "btnBad");
  }

  return false;
}

export function registerActionEvents() {
  $("openPlateau")?.addEventListener("click", () => {
    openPlateauWindow();
  });

  const openEditorBtn = document.getElementById("openEditor");
  if (openEditorBtn) {
    openEditorBtn.addEventListener("click", () => {
      const win = window.open("editor.html", "avm_editor", "width=1400,height=900");
      if (!win) {
        window.location.href = "editor.html";
      }
    });
  }

  $("gridSelect")?.addEventListener("change", async () => {
    await loadSelectedGrid();
    renderTeams();
  });

  $("btnReset")?.addEventListener("click", () => {
    if (!state.grid) return;
    if (confirm("Reset les revelations ?")) {
      resetReveal();
      resetRegieTimer();
    }
  });

  $("btnNewShow")?.addEventListener("click", () => {
    const ok = confirm("Reinitialiser la regie pour une nouvelle emission ? (equipes, scores, options rouges, selections, medias)");
    if (!ok) return;

    if (state.grid) resetReveal();

    state.selectedWordId = null;
    state.currentTeamId = null;
    state.pendingPenaltyPoints = 0;
    state.showScores = false;
    state.scoreboardMode = "scores";
    state.scoreboardPodiumStep = 0;
    state.teams = [];
    clearVisibleNumbers();

    setMultiplier(1);
    state.doubleMode = null;
    state.tripleMode = null;
    state.badMode = null;
    setBadPointsActive(false);
    updateSelectedInfo();
    updateMagicButtonState();
    setActionButtonsEnabled(false);
    renderRegieGrid();
    renderTeams();
    syncScoresToPlateau();

    resetMediaForNewShow();
    resetGoldenFamilyForNewShow();
    resetLettersGameForNewShow();
    resetNumbersGameForNewShow();

    const letterInput = $("letterInput");
    if (letterInput) letterInput.value = "";
    const lastLetter = $("lastLetter");
    if (lastLetter) lastLetter.textContent = "-";
    resetRegieTimer();
    closeBonusModal();
  });

  $("btnBonus")?.addEventListener("click", () => {
    openBonusModal();
  });

  $("btnBonusClose")?.addEventListener("click", () => {
    closeBonusModal();
  });

  $("btnGeneric")?.addEventListener("click", () => {
    postToPlateau({ type: "PLAY_GENERIC" });
    closeBonusModal();
  });

  $("btnShuffleLetters")?.addEventListener("click", () => {
    postToPlateau({ type: "SHUFFLE_LETTERS" });
  });

  $("btnBad")?.addEventListener("click", () => {
    const next = !(state.badPointsActive && state.badMode === "video");
    state.badMode = next ? "video" : null;
    setBadPointsActive(next);
    if (next) {
      postToPlateau({ type: "PLAY_BAD" });
    }
    closeBonusModal();
  });

  $("btnBadAnimated")?.addEventListener("click", () => {
    const next = !(state.badPointsActive && state.badMode === "animation");
    state.badMode = next ? "animation" : null;
    setBadPointsActive(next);
    if (next) {
      postToPlateau({ type: "PLAY_BAD_ANIMATION" });
    }
    closeBonusModal();
  });

  $("btnScores")?.addEventListener("click", () => {
    state.showScores = !state.showScores;
    if (state.showScores) {
      state.scoreboardMode = "scores";
      state.scoreboardPodiumStep = 0;
    }
    syncScoresToPlateau();
    if (state.showScores) showRegieScores();
  });

  $("btnCorrect")?.addEventListener("click", () => {
    if (state.selectedWordId == null) return;
    stopSelectSound();
    const isMagic = state.selectedWordId === state.magicWordId;
    if (state.grid) {
      const word = state.grid.words[state.selectedWordId];
      if (word) {
        let gain = 0;
        if (isMagic) {
          gain = 10 + countRemainingLetters();
          state.magicSolved = true;
          state.grid.magicSolved = true;
          for (const [pos] of state.grid.letters) {
            state.grid.revealed.set(pos, true);
          }
        } else {
          gain = word.cells.length * state.multiplier;
          for (const p of word.cells) {
            const pos = `${p.r},${p.c}`;
            if (!isMagicWordCell(pos) || state.magicSolved) {
              state.grid.revealed.set(pos, true);
            }
          }
        }
        if (state.currentTeamId) {
          const team = state.teams.find((t) => t.id === state.currentTeamId);
          if (team) {
            if (state.badPointsActive) {
              state.pendingPenaltyPoints = gain;
            } else {
              team.points = (team.points ?? 0) + gain;
            }
            renderTeams();
          }
        }
        clearVisibleNumbers();
        renderRegieGrid();
      }
    }
    postToPlateau({
      type: isMagic ? "CORRECT_MAGIC_WORD" : "CORRECT_WORD",
      wordId: state.selectedWordId
    });
    state.selectedWordId = null;
    state.currentTeamId = null;
    state.doubleMode = null;
    state.tripleMode = null;
    state.badMode = null;
    setMultiplier(1);
    setBadPointsActive(false);
    renderTeams();
    if (state.pendingPenaltyPoints > 0) {
      showPenaltyRequiredModal();
    }
    updateSelectedInfo();
    updateMagicButtonState();
    setActionButtonsEnabled(false);
    resetRegieTimer();
  });

  $("btnNop")?.addEventListener("click", () => {
    const wordId = state.selectedWordId;
    if (wordId == null) return;
    const isMagicFail = wordId === state.magicWordId;

    stopSelectSound();

    if (isMagicFail && state.currentTeamId) {
      const team = state.teams.find((t) => t.id === state.currentTeamId);
      if (team) {
        team.points = (team.points ?? 0) - 5;
      }
    }

    postToPlateau({ type: "NOP_WORD", wordId });

    state.selectedWordId = null;
    state.currentTeamId = null;
    clearVisibleNumbers();
    renderRegieGrid();
    state.doubleMode = null;
    state.tripleMode = null;
    state.badMode = null;
    setMultiplier(1);
    setBadPointsActive(false);
    state.pendingPenaltyPoints = 0;
    renderTeams();
    updateSelectedInfo();
    updateMagicButtonState();
    setActionButtonsEnabled(false);
    resetRegieTimer();
  });

  $("btnDouble")?.addEventListener("click", () => {
    const next = state.multiplier === 2 && state.doubleMode === "video" ? 1 : 2;
    state.doubleMode = next === 2 ? "video" : null;
    if (next === 2) state.tripleMode = null;
    setMultiplier(next);
    if (next === 2) {
      postToPlateau({ type: "PLAY_DOUBLE" });
    }
    closeBonusModal();
  });

  $("btnDoubleAnimated")?.addEventListener("click", () => {
    const next = state.multiplier === 2 && state.doubleMode === "animation" ? 1 : 2;
    state.doubleMode = next === 2 ? "animation" : null;
    if (next === 2) state.tripleMode = null;
    setMultiplier(next);
    if (next === 2) {
      postToPlateau({ type: "PLAY_DOUBLE_ANIMATION" });
    }
    closeBonusModal();
  });

  $("btnTriple")?.addEventListener("click", () => {
    const next = state.multiplier === 3 && state.tripleMode === "video" ? 1 : 3;
    state.tripleMode = next === 3 ? "video" : null;
    if (next === 3) state.doubleMode = null;
    setMultiplier(next);
    if (next === 3) {
      postToPlateau({ type: "PLAY_TRIPLE" });
    }
    closeBonusModal();
  });

  $("btnTripleAnimated")?.addEventListener("click", () => {
    const next = state.multiplier === 3 && state.tripleMode === "animation" ? 1 : 3;
    state.tripleMode = next === 3 ? "animation" : null;
    if (next === 3) state.doubleMode = null;
    setMultiplier(next);
    if (next === 3) {
      postToPlateau({ type: "PLAY_TRIPLE_ANIMATION" });
    }
    closeBonusModal();
  });

  $("addTeam")?.addEventListener("click", addTeam);

  $("teamModalOk")?.addEventListener("click", () => {
    hideTeamModal();
  });

  $("teamModal")?.addEventListener("click", (e) => {
    if (e.target.id === "teamModal" && state.pendingPenaltyPoints <= 0) hideTeamModal();
  });

  setMultiplier(1, true);
  setBadPointsActive(false);
}

export function registerWindowEvents() {
  if (controlChannel) {
    controlChannel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || !msg.type) return;

      if (msg.type === "PLATEAU_READY") {
        return;
      }

      if (msg.type === "PLATEAU_CLOSED") {
        return;
      }
    };

    broadcastToPlateau({ type: "PING_PLATEAU" });
  }

  window.addEventListener("message", (ev) => {
    const msg = ev.data;
    if (!msg || !msg.type) return;

    if (msg.type === "PLATEAU_READY") {
      if (ev.source) {
        state.plateauWin = ev.source;
      }
      setPlateauLabel();
      setActionButtonsEnabled(false);

      if (state.grid) {
        postToPlateau({ type: "LOAD_GRID", grid: serializeGridForPlateau(state.grid) });
      }
      syncScoresToPlateau();
      syncPlateauBackgroundTheme();
      return;
    }

    if (msg.type === "PLATEAU_CLOSED") {
      setPlateauLabel();
      setActionButtonsEnabled(false);
      return;
    }

    if (msg.type === "WORD_SELECTED") {
      state.selectedWordId = msg.wordId ?? null;
      if (state.selectedWordId == null) {
        clearVisibleNumbers();
        resetRegieTimer();
      } else {
        const w = state.grid?.words?.[state.selectedWordId];
        clearVisibleNumbers();
        if (w?.numberPos) state.visibleNumbers.add(`${w.numberPos.r},${w.numberPos.c}`);
        startRegieTimer(30);
      }
      updateSelectedInfo();
      updateMagicButtonState();

      const enabled = state.selectedWordId != null;
      setActionButtonsEnabled(enabled);
      renderRegieGrid();
      return;
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    if (handleRegieShortcut(e)) return;
    if (state.pendingPenaltyPoints > 0) return;
    if (isTypingTarget(e.target)) return;

    const isDeleteKey = e.key === "Delete" || e.key === "Backspace";
    if (!isDeleteKey) return;

    if (removeSelectedTeam()) {
      e.preventDefault();
    }
  });

  window.addEventListener("resize", () => {
    refreshRegieGridLayout();
  });

  window.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      const isTeamInteraction =
        !!(target && target.closest) &&
        (
          target.closest(".team-square") ||
          target.closest(".team-name-input") ||
          target.closest("#addTeam") ||
          target.closest("#teamsContainer") ||
          target.closest("#teamModal") ||
          target.closest("#teamModalOk") ||
          target.closest("#regieTimerWindow") ||
          target.closest("#regieTimerClose") ||
          target.closest(".modal-card")
        );

      const opensTeamRequiredModal =
        !!(target && target.closest) &&
        !!target.closest("#regieGrid") &&
        !state.currentTeamId;

      if (!isTeamInteraction && !opensTeamRequiredModal) {
        postToPlateau({ type: "STOP_REVEAL_SOUND" });
      }

      if (state.pendingPenaltyPoints > 0) {
        const onTeam = e.target.closest && e.target.closest(".team-square");
        if (!onTeam) {
          return;
        }
      }
    },
    true
  );
}
