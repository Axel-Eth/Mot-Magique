import { state } from "./state.js";
import { postToPlateau } from "./bridge.js";
import { setActionButtonsEnabled, setPlateauLabel } from "./ui.js";

export function syncScoresToPlateau() {
  postToPlateau({
    type: "SCORES_UPDATE",
    show: state.showScores,
    teams: state.teams.map((t) => ({
      name: t.name || "Equipe",
      points: t.points ?? 0,
      color: t.color
    }))
  });
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
