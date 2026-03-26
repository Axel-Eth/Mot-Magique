import { initWordSelectModalDrag, setPlateauLabel } from "./ui.js";
import { loadGridList } from "./grid-select.js";
import { loadSelectedGrid } from "./grid-actions.js";
import { renderTeams } from "./teams.js";
import { initLetterInput } from "./inputs.js";
import {
  loadGoldenFamilyList,
  loadCapitalesList,
  loadCapitalesNotes,
  loadFilmsList,
  loadFilmsMusicList,
  loadGeneralQuestionsList,
  loadMusicList,
  loadPeoplesList,
  loadPlateauMusicList,
  registerGoldenFamilyEvents,
  registerLettersGameEvents,
  registerNumbersGameEvents,
  registerMediaEvents
} from "./media.js";
import { registerActionEvents, registerWindowEvents } from "./actions.js";
import { initRegieTimerDrag } from "./timer.js";
import { initFloatingPanels } from "./floating-panels.js";

registerActionEvents();
registerWindowEvents();
registerMediaEvents();
registerGoldenFamilyEvents();
registerLettersGameEvents();
registerNumbersGameEvents();
initLetterInput();
initWordSelectModalDrag();
initRegieTimerDrag();
initFloatingPanels();

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
    ["loadFilmsMusicList", loadFilmsMusicList],
    ["loadPeoplesList", loadPeoplesList],
    ["loadGeneralQuestionsList", loadGeneralQuestionsList],
    ["loadGoldenFamilyList", loadGoldenFamilyList],
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
