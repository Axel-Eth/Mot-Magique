import { setPlateauLabel } from "./ui.js";
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

registerActionEvents();
registerWindowEvents();
registerMediaEvents();
initLetterInput();

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

  await safeRun("loadGridList", loadGridList);
  await safeRun("loadCapitalesNotes", loadCapitalesNotes);
  await safeRun("loadCapitalesList", loadCapitalesList);
  await safeRun("loadMusicList", loadMusicList);
  await safeRun("loadPlateauMusicList", loadPlateauMusicList);
  await safeRun("loadFilmsList", loadFilmsList);
  await safeRun("loadPeoplesList", loadPeoplesList);
  await safeRun("loadGeneralQuestionsList", loadGeneralQuestionsList);
  await safeRun("loadSelectedGrid", loadSelectedGrid);
  await safeRun("renderTeams", () => renderTeams());
  await safeRun("setPlateauLabel", () => setPlateauLabel());

  document.getElementById("letterInput")?.focus();

  if (errors.length) {
    alert(`Initialisation partielle.\n\n${errors.join("\n")}`);
  }
})();
