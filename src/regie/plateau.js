import { state } from "./state.js";
import { postToPlateau } from "./bridge.js";
import { setActionButtonsEnabled, setPlateauLabel } from "./ui.js";
import { hideRegieScores, refreshRegieScores } from "./scores.js";

export function syncScoresToPlateau() {
  postToPlateau({
    type: "SCORES_UPDATE",
    show: state.showScores,
    mode: state.scoreboardMode || "scores",
    podiumStep: state.scoreboardPodiumStep || 0,
    teams: state.teams.map((t) => ({
      name: t.name || "Equipe",
      points: t.points ?? 0,
      color: t.color
    }))
  });

  if (state.showScores) {
    refreshRegieScores();
  } else {
    hideRegieScores();
  }
}

export function setScoreboardMode(mode) {
  state.scoreboardMode = mode === "podium" ? "podium" : "scores";
  if (state.scoreboardMode !== "podium") {
    state.scoreboardPodiumStep = 0;
  }
  syncScoresToPlateau();
}

export function advancePodiumStep() {
  state.scoreboardMode = "podium";
  state.scoreboardPodiumStep = Math.min(3, (state.scoreboardPodiumStep || 0) + 1);
  syncScoresToPlateau();
}

export function openPlateauWindow() {
  if (state.plateauWin && !state.plateauWin.closed) {
    state.plateauWin.focus();
    return;
  }
  const win = window.open("plateau.html", "avm_plateau_tab");
  state.plateauWin = win || null;
  setPlateauLabel();
  setActionButtonsEnabled(false);
}
