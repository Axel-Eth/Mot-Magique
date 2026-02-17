import { $ } from "./dom.js";
import { state } from "./state.js";
import { stopSelectSound } from "./audio.js";
import { isMagicWordCell, updateMagicButtonState } from "./magic.js";
import { syncScoresToPlateau, openPlateauWindow } from "./plateau.js";
import { postToPlateau } from "./bridge.js";
import { renderTeams, addTeam } from "./teams.js";
import { renderRegieGrid, clearVisibleNumbers } from "./grid-view.js";
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
import { resetMediaForNewShow } from "./media.js";

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
    if (confirm("Reset les revelations ?")) resetReveal();
  });

  $("btnNewShow")?.addEventListener("click", () => {
    const ok = confirm("Reinitialiser la regie pour une nouvelle emission ? (equipes, scores, options rouges, selections, medias)");
    if (!ok) return;

    if (state.grid) resetReveal();

    state.selectedWordId = null;
    state.currentTeamId = null;
    state.pendingPenaltyPoints = 0;
    state.showScores = false;
    state.teams = [];
    clearVisibleNumbers();

    setMultiplier(1);
    setBadPointsActive(false);
    updateSelectedInfo();
    updateMagicButtonState();
    setActionButtonsEnabled(false);
    renderRegieGrid();
    renderTeams();
    syncScoresToPlateau();

    resetMediaForNewShow();

    const letterInput = $("letterInput");
    if (letterInput) letterInput.value = "";
    const lastLetter = $("lastLetter");
    if (lastLetter) lastLetter.textContent = "Lettre : -";
  });

  $("btnGeneric")?.addEventListener("click", () => {
    postToPlateau({ type: "PLAY_GENERIC" });
  });

  $("btnShuffleLetters")?.addEventListener("click", () => {
    postToPlateau({ type: "SHUFFLE_LETTERS" });
  });

  $("btnBad")?.addEventListener("click", () => {
    const next = !state.badPointsActive;
    setBadPointsActive(next);
    if (next) {
      postToPlateau({ type: "PLAY_BAD" });
    }
  });

  $("btnScores")?.addEventListener("click", () => {
    state.showScores = !state.showScores;
    syncScoresToPlateau();
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
    setMultiplier(1);
    setBadPointsActive(false);
    renderTeams();
    updateSelectedInfo();
    updateMagicButtonState();
    setActionButtonsEnabled(false);
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
    setMultiplier(1);
    setBadPointsActive(false);
    state.pendingPenaltyPoints = 0;
    renderTeams();
    updateSelectedInfo();
    updateMagicButtonState();
    setActionButtonsEnabled(false);
  });

  $("btnDouble")?.addEventListener("click", () => {
    const next = state.multiplier === 2 ? 1 : 2;
    setMultiplier(next);
    if (next === 2) {
      postToPlateau({ type: "PLAY_DOUBLE" });
    }
  });

  $("btnTriple")?.addEventListener("click", () => {
    const next = state.multiplier === 3 ? 1 : 3;
    setMultiplier(next);
    if (next === 3) {
      postToPlateau({ type: "PLAY_TRIPLE" });
    }
  });

  $("addTeam")?.addEventListener("click", addTeam);

  $("teamModalOk")?.addEventListener("click", () => {
    $("teamModal")?.classList.add("hidden");
  });

  $("teamModal")?.addEventListener("click", (e) => {
    if (e.target.id === "teamModal") {
      $("teamModal")?.classList.add("hidden");
    }
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
      } else {
        const w = state.grid?.words?.[state.selectedWordId];
        clearVisibleNumbers();
        if (w?.numberPos) state.visibleNumbers.add(`${w.numberPos.r},${w.numberPos.c}`);
      }
      updateSelectedInfo();
      updateMagicButtonState();

      const enabled = state.selectedWordId != null;
      setActionButtonsEnabled(enabled);
      renderRegieGrid();
      return;
    }
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
          alert("Choisis l'equipe a penaliser.");
        }
      }
    },
    true
  );
}
