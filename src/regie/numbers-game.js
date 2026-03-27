import { $ } from "./dom.js";
import { state } from "./state.js";
import { postToPlateau } from "./bridge.js";
import { renderTeams, showTeamAwardModal } from "./teams.js";
import { syncScoresToPlateau } from "./plateau.js";

const TARGET_MIN = 101;
const TARGET_MAX = 999;
const NUMBERS_COUNT = 6;
const WINNER_POINTS = 15;
const NUMBERS_POOL = [
  1, 1,
  2, 2,
  3, 3,
  4, 4,
  5, 5,
  6, 6,
  7, 7,
  8, 8,
  9, 9,
  10, 10,
  25,
  50,
  75,
  100
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setNumbersStatus(message, isError = false) {
  const el = $("numbersGameStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", !!isError);
}

function buildNumbersPayload() {
  return {
    type: "SHOW_NUMBERS_GAME",
    visible: !!state.numbersGameVisible && Number.isInteger(state.numbersGameTarget),
    target: state.numbersGameTarget,
    revealCount: state.numbersGameRevealCount || 0,
    numbers: [...(state.numbersGameNumbers || [])]
  };
}

function sendNumbersToPlateau() {
  postToPlateau(buildNumbersPayload());
}

function drawNumbersFromPool(count = NUMBERS_COUNT) {
  const pool = [...NUMBERS_POOL];
  const numbers = [];

  for (let index = 0; index < count && pool.length; index += 1) {
    const pickedIndex = randomInt(0, pool.length - 1);
    numbers.push(pool[pickedIndex]);
    pool.splice(pickedIndex, 1);
  }

  return numbers;
}

function renderNumbersGameCard() {
  const card = $("numbersGameCard");
  const targetEl = $("numbersGameTarget");
  const numbersEl = $("numbersGameNumbers");
  const showBtn = $("btnNumbersGameShow");
  const awardBtn = $("btnNumbersGameAward");
  const hasRound = Number.isInteger(state.numbersGameTarget) && (state.numbersGameNumbers || []).length === NUMBERS_COUNT;

  if (card) card.classList.remove("hidden");
  if (targetEl) {
    targetEl.textContent = hasRound ? String(state.numbersGameTarget) : "-";
  }
  if (numbersEl) {
    numbersEl.innerHTML = "";
    (state.numbersGameNumbers || []).forEach((number) => {
      const chip = document.createElement("span");
      chip.className = "numbers-game-chip";
      chip.textContent = String(number);
      numbersEl.appendChild(chip);
    });
  }
  if (showBtn) {
    showBtn.disabled = !hasRound;
    if (!hasRound) {
      showBtn.textContent = "Afficher nombre";
    } else if ((state.numbersGameRevealCount || 0) < (NUMBERS_COUNT + 1)) {
      showBtn.textContent = "Afficher nombre";
    } else {
      showBtn.textContent = "Tout affiche";
    }
  }
  if (awardBtn) {
    awardBtn.disabled = !hasRound;
  }
}

function generateNumbersRound() {
  state.numbersGameTarget = randomInt(TARGET_MIN, TARGET_MAX);
  state.numbersGameNumbers = drawNumbersFromPool();
  state.numbersGameRevealCount = 0;
  setNumbersStatus(`Manche generee: cible ${state.numbersGameTarget}, ${NUMBERS_COUNT} plaques.`);
  renderNumbersGameCard();

  if (state.numbersGameVisible) {
    postToPlateau({ type: "HIDE_MEDIA" });
    sendNumbersToPlateau();
  }
}

function awardNumbersWinner() {
  const hasRound = Number.isInteger(state.numbersGameTarget) && (state.numbersGameNumbers || []).length === NUMBERS_COUNT;
  if (!hasRound) {
    setNumbersStatus("Genere d'abord une manche.", true);
    return;
  }

  showTeamAwardModal({
    points: WINNER_POINTS,
    answer: `Cible ${state.numbersGameTarget}`,
    onSelect: (team) => {
      if (!team) return;
      state.currentTeamId = team.id;
      team.points = (team.points ?? 0) + WINNER_POINTS;
      renderTeams();
      syncScoresToPlateau();
      setNumbersStatus(`${team.name || "Equipe"} prend ${WINNER_POINTS} points.`);
    }
  });
}

export function hideNumbersGameDisplay() {
  state.numbersGameVisible = false;
  const showBtn = $("btnNumbersGameShow");
  if (showBtn) showBtn.textContent = "Afficher nombre";
  postToPlateau({ type: "SHOW_NUMBERS_GAME", visible: false, target: null, numbers: [], revealCount: 0 });
}

export function resetNumbersGameForNewShow() {
  state.numbersGameTarget = null;
  state.numbersGameNumbers = [];
  state.numbersGameVisible = false;
  state.numbersGameRevealCount = 0;
  setNumbersStatus("");
  renderNumbersGameCard();
  hideNumbersGameDisplay();
}

export function registerNumbersGameEvents() {
  $("btnNumbersGame")?.addEventListener("click", () => {
    $("numbersGameModal")?.classList.toggle("hidden");
  });

  $("numbersGameModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "numbersGameModal") {
      $("numbersGameModal")?.classList.add("hidden");
    }
  });

  $("btnNumbersGameGenerate")?.addEventListener("click", () => {
    generateNumbersRound();
  });

  $("btnNumbersGameShow")?.addEventListener("click", () => {
    const hasRound = Number.isInteger(state.numbersGameTarget) && (state.numbersGameNumbers || []).length === NUMBERS_COUNT;
    if (!hasRound) return;
    if ((state.numbersGameRevealCount || 0) >= (NUMBERS_COUNT + 1)) return;
    const wasVisible = !!state.numbersGameVisible;
    state.numbersGameVisible = true;
    state.numbersGameRevealCount = Math.min(NUMBERS_COUNT + 1, (state.numbersGameRevealCount || 0) + 1);
    renderNumbersGameCard();
    if (!wasVisible) {
      postToPlateau({ type: "HIDE_MEDIA" });
    }
    sendNumbersToPlateau();
  });

  $("btnNumbersGameAward")?.addEventListener("click", () => {
    awardNumbersWinner();
  });

  $("btnNumbersGameReset")?.addEventListener("click", () => {
    resetNumbersGameForNewShow();
  });

  renderNumbersGameCard();
}
