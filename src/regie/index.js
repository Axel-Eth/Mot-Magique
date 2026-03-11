import { initWordSelectModalDrag, setPlateauLabel } from "./ui.js";
import { loadGridList } from "./grid-select.js";
import { loadSelectedGrid } from "./grid-actions.js";
import { renderTeams } from "./teams.js";
import { initLetterInput } from "./inputs.js";
import {
  loadCapitalesList,
  loadCapitalesNotes,
  loadFilmsList,
  loadGeneralQuestionsList,
  loadMusicList,
  loadPeoplesList,
  loadPlateauMusicList,
  registerMediaEvents
} from "./media.js";
import { registerActionEvents, registerWindowEvents } from "./actions.js";
import { initRegieTimerDrag } from "./timer.js";

registerActionEvents();
registerWindowEvents();
registerMediaEvents();
initLetterInput();
initWordSelectModalDrag();
initRegieTimerDrag();

(async function init() {
  const errors = [];
  const safeRun = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      console.error(`[regie:init] ${label}`, err);
      errors.push(`${label}: ${String(err?.message ?? err)}`);
    }
  };
  const bootSteps = [
    ["loadGridList", loadGridList],
    ["loadCapitalesNotes", loadCapitalesNotes],
    ["loadCapitalesList", loadCapitalesList],
    ["loadMusicList", loadMusicList],
    ["loadPlateauMusicList", loadPlateauMusicList],
    ["loadFilmsList", loadFilmsList],
    ["loadPeoplesList", loadPeoplesList],
    ["loadGeneralQuestionsList", loadGeneralQuestionsList],
    ["loadSelectedGrid", loadSelectedGrid],
    ["renderTeams", () => renderTeams()],
    ["setPlateauLabel", () => setPlateauLabel()]
  ];

  for (const [label, fn] of bootSteps) {
    await safeRun(label, fn);
  }

  document.getElementById("letterInput")?.focus();

  if (errors.length) {
    alert(`Initialisation partielle.\n\n${errors.join("\n")}`);
  }
})();
