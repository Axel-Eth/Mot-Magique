import { setFullscreenEnabled, setPlateauLabel } from "./ui.js";
import { loadGridList } from "./grid-select.js";
import { loadSelectedGrid } from "./grid-actions.js";
import { renderTeams } from "./teams.js";
import { initLetterInput } from "./inputs.js";
import {
  loadCapitalesList,
  loadCapitalesNotes,
  loadFilmsList,
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
  try {
    await loadGridList();
    await loadCapitalesNotes();
    await loadCapitalesList();
    await loadMusicList();
    await loadPlateauMusicList();
    await loadFilmsList();
    await loadPeoplesList();
    await loadSelectedGrid();
    renderTeams();
    setPlateauLabel();
    setFullscreenEnabled(false);
    document.getElementById("letterInput")?.focus();
  } catch (err) {
    console.error(err);
    alert(String(err?.message ?? err));
  }
})();
