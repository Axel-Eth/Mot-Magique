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
const OPERATION_SYMBOLS = {
  "+": "+",
  "-": "-",
  "*": "×",
  "/": "÷"
};

let numbersGameKeyHandlerBound = false;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createRoundNumbers(values) {
  const seed = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return values.map((value, index) => ({
    id: `numbers-${seed}-${index}`,
    value: Number(value) || 0,
    used: false,
    derived: false
  }));
}

function getNumbersEntries() {
  return Array.isArray(state.numbersGameNumbers) ? state.numbersGameNumbers : [];
}

function getNumberEntryById(id) {
  return getNumbersEntries().find((entry) => entry?.id === id) || null;
}

function getSelectedBaseEntry() {
  return getNumberEntryById(state.numbersGameSelectedBaseId);
}

function getCurrentBaseValue() {
  return getSelectedBaseEntry()?.value ?? null;
}

function getUnusedEntries() {
  return getNumbersEntries().filter((entry) => entry && !entry.used);
}

function getKeyboardBuffer() {
  return String(state.numbersGameKeyboardBuffer || "");
}

function getUnusedEntryByValue(value) {
  const selectedBaseId = !state.numbersGameSteps.length && state.numbersGameCurrentOperation
    ? state.numbersGameSelectedBaseId
    : null;
  return getUnusedEntries().find((entry) => (
    Number(entry.value) === Number(value) && entry.id !== selectedBaseId
  )) || null;
}

function getAvailableSecondChoicesCount() {
  const unusedEntries = getUnusedEntries();
  if (!unusedEntries.length) return 0;
  if (!state.numbersGameSelectedBaseId) return 0;
  return unusedEntries.filter((entry) => entry.id !== state.numbersGameSelectedBaseId).length;
}

function formatOperationSymbol(operation) {
  return OPERATION_SYMBOLS[operation] || operation || "";
}

function formatStep(step) {
  if (!step) return "";
  return `${step.left} ${formatOperationSymbol(step.operation)} ${step.right} = ${step.result}`;
}

function getBestSubmission() {
  const submissions = Array.isArray(state.numbersGameSubmissions) ? state.numbersGameSubmissions : [];
  if (!submissions.length) return null;

  return submissions.reduce((best, submission) => {
    if (!best) return submission;
    if ((submission.distance ?? Infinity) < (best.distance ?? Infinity)) return submission;
    return best;
  }, null);
}

function getCurrentLineLabel() {
  const operation = state.numbersGameCurrentOperation || "";
  const symbol = formatOperationSymbol(operation);
  const baseValue = getCurrentBaseValue();
  const keyboardBuffer = getKeyboardBuffer();

  if (!Number.isInteger(baseValue)) {
    return keyboardBuffer ? keyboardBuffer : "";
  }
  if (!operation) {
    return keyboardBuffer ? keyboardBuffer : "";
  }
  return `${baseValue} ${symbol} ${keyboardBuffer || "?"}`;
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
    numbers: getNumbersEntries().map((entry) => ({
      id: entry.id,
      value: entry.value,
      used: !!entry.used
    })),
    steps: state.numbersGameSteps.map((step) => ({ ...step })),
    currentLine: getCurrentLineLabel()
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

function isRoundReady() {
  return Number.isInteger(state.numbersGameTarget) && getNumbersEntries().length >= NUMBERS_COUNT;
}

function calculateOperationResult(left, operation, right) {
  if (!Number.isInteger(left) || !Number.isInteger(right)) return null;
  switch (operation) {
    case "+":
      return left + right;
    case "-":
      return left > right ? left - right : null;
    case "*":
      return left * right;
    case "/":
      return right > 0 && left % right === 0 ? left / right : null;
    default:
      return null;
  }
}

function renderNumbersPool() {
  const numbersEl = $("numbersGameNumbers");
  if (!numbersEl) return;
  numbersEl.innerHTML = "";

  getNumbersEntries().forEach((entry) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "numbers-game-chip";
    chip.textContent = String(entry.value);
    chip.dataset.id = entry.id;
    chip.disabled = !isRoundReady() || entry.used;

    if (entry.used) chip.classList.add("used");
    if (entry.derived) chip.classList.add("derived");
    if (!entry.used && state.numbersGameSelectedBaseId === entry.id) chip.classList.add("selected");

    chip.addEventListener("click", () => {
      handleNumberSelection(entry.id);
    });
    numbersEl.appendChild(chip);
  });
}

function renderNumbersSteps() {
  const stepsEl = $("numbersGameSteps");
  if (!stepsEl) return;
  stepsEl.innerHTML = "";

  if (!state.numbersGameSteps.length) {
    stepsEl.innerHTML = '<div class="numbers-game-empty-hint">Le calcul apparaitra ici.</div>';
    return;
  }

  state.numbersGameSteps.forEach((step) => {
    const block = document.createElement("div");
    block.className = "numbers-game-step-block";
    block.textContent = formatStep(step);
    stepsEl.appendChild(block);
  });
}

function renderNumbersSubmissions() {
  const submissionsEl = $("numbersGameSubmissions");
  if (!submissionsEl) return;
  submissionsEl.innerHTML = "";

  if (!state.numbersGameSubmissions.length) {
    return;
  }

  const title = document.createElement("div");
  title.className = "numbers-game-submissions-title";
  title.textContent = "Resultats equipes";
  submissionsEl.appendChild(title);

  state.numbersGameSubmissions
    .slice()
    .reverse()
    .forEach((submission) => {
      const row = document.createElement("div");
      row.className = "numbers-game-submission-row";
      if (submission.id === state.numbersGameAwardedSubmissionId) {
        row.classList.add("winner");
      }
      row.innerHTML = `
        <span class="numbers-game-submission-team">${submission.teamName || "Equipe"}</span>
        <span class="numbers-game-submission-result">${submission.result}</span>
        <span class="numbers-game-submission-distance">ecart ${submission.distance}</span>
      `;
      submissionsEl.appendChild(row);
    });
}

function renderCurrentState() {
  const currentStateEl = $("numbersGameCurrentState");
  if (!currentStateEl) return;

  const baseValue = getCurrentBaseValue();
  const operation = state.numbersGameCurrentOperation || "";
  const symbol = formatOperationSymbol(operation);
  const keyboardBuffer = getKeyboardBuffer();

  if (!isRoundReady()) {
    currentStateEl.textContent = "Genere une manche pour commencer.";
    return;
  }
  if (keyboardBuffer && !Number.isInteger(baseValue)) {
    currentStateEl.textContent = `Plaque saisie : ${keyboardBuffer}`;
    return;
  }
  if (Number.isInteger(baseValue) && operation) {
    currentStateEl.textContent = `Operation en cours : ${baseValue} ${symbol} ${keyboardBuffer || "?"}`;
    return;
  }
  if (Number.isInteger(baseValue)) {
    currentStateEl.textContent = `Base selectionnee : ${baseValue}`;
    return;
  }
  currentStateEl.textContent = "Choisis une premiere plaque.";
}

function renderNumbersGameCard() {
  const card = $("numbersGameCard");
  const targetEl = $("numbersGameTarget");
  const showBtn = $("btnNumbersGameShow");
  const awardBtn = $("btnNumbersGameAward");
  const assignBtn = $("btnNumbersGameAssign");
  const clearCalcBtn = $("btnNumbersGameClearCalc");
  const hasRound = isRoundReady();
  const bestSubmission = getBestSubmission();
  const selectedBaseEntry = getSelectedBaseEntry();

  if (card) card.classList.remove("hidden");
  if (targetEl) {
    targetEl.textContent = hasRound ? String(state.numbersGameTarget) : "-";
  }

  renderNumbersPool();
  renderCurrentState();
  renderNumbersSteps();
  renderNumbersSubmissions();

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
    awardBtn.disabled = !hasRound || !bestSubmission || !!state.numbersGameAwardedSubmissionId;
  }
  if (assignBtn) {
    assignBtn.disabled = !hasRound || !selectedBaseEntry || selectedBaseEntry.used || !state.numbersGameSteps.length || !!state.numbersGameCurrentOperation;
  }
  if (clearCalcBtn) {
    clearCalcBtn.disabled = !hasRound || (!state.numbersGameSteps.length && !state.numbersGameSelectedBaseId && !state.numbersGameCurrentOperation);
  }
}

function syncNumbersView() {
  renderNumbersGameCard();
  if (state.numbersGameVisible) {
    sendNumbersToPlateau();
  }
}

function clearCurrentCalculation({ keepStatus = false } = {}) {
  getNumbersEntries().forEach((entry) => {
    entry.used = false;
  });
  state.numbersGameSelectedBaseId = null;
  state.numbersGameCurrentOperation = "";
  state.numbersGameKeyboardBuffer = "";
  state.numbersGameSteps = [];
  state.numbersGameNumbers = getNumbersEntries().filter((entry) => !entry?.derived);
  if (!keepStatus) {
    setNumbersStatus("");
  }
  syncNumbersView();
}

function undoLastNumbersStep() {
  if (state.numbersGameSteps.length) {
    const lastStep = state.numbersGameSteps[state.numbersGameSteps.length - 1];
    const leftEntry = getNumberEntryById(lastStep.leftId);
    const rightEntry = getNumberEntryById(lastStep.rightId);

    if (leftEntry) leftEntry.used = false;
    if (rightEntry) rightEntry.used = false;

    state.numbersGameNumbers = getNumbersEntries().filter((entry) => entry?.id !== lastStep.resultId);
    state.numbersGameSteps = state.numbersGameSteps.slice(0, -1);
    state.numbersGameSelectedBaseId = leftEntry?.id || null;
    state.numbersGameCurrentOperation = "";
    state.numbersGameKeyboardBuffer = "";
    setNumbersStatus("Derniere operation annulee.");
    syncNumbersView();
    return;
  }

  if (state.numbersGameSelectedBaseId || state.numbersGameCurrentOperation || state.numbersGameKeyboardBuffer) {
    state.numbersGameSelectedBaseId = null;
    state.numbersGameCurrentOperation = "";
    state.numbersGameKeyboardBuffer = "";
    setNumbersStatus("Selection en cours annulee.");
    syncNumbersView();
  }
}

function generateNumbersRound() {
  state.numbersGameTarget = randomInt(TARGET_MIN, TARGET_MAX);
  state.numbersGameNumbers = createRoundNumbers(drawNumbersFromPool());
  state.numbersGameRevealCount = 0;
  state.numbersGameSubmissions = [];
  state.numbersGameAwardedSubmissionId = null;
  clearCurrentCalculation({ keepStatus: true });
  setNumbersStatus(`Manche generee: cible ${state.numbersGameTarget}, ${NUMBERS_COUNT} plaques.`);

  if (state.numbersGameVisible) {
    postToPlateau({ type: "HIDE_MEDIA" });
    sendNumbersToPlateau();
  }
}

function awardNumbersWinner() {
  if (!isRoundReady()) {
    setNumbersStatus("Genere d'abord une manche.", true);
    return;
  }
  if (state.numbersGameAwardedSubmissionId) {
    setNumbersStatus("Les 15 points ont deja ete attribues pour cette manche.", true);
    return;
  }

  const bestSubmission = getBestSubmission();
  if (!bestSubmission) {
    setNumbersStatus("Aucun resultat valide a comparer.", true);
    return;
  }

  const team = state.teams.find((entry) => entry.id === bestSubmission.teamId);
  if (!team) {
    setNumbersStatus("Equipe introuvable pour la meilleure proposition.", true);
    return;
  }

  state.currentTeamId = team.id;
  team.points = (team.points ?? 0) + WINNER_POINTS;
  state.numbersGameAwardedSubmissionId = bestSubmission.id;
  renderTeams();
  syncScoresToPlateau();
  renderNumbersGameCard();
  setNumbersStatus(`${team.name || "Equipe"} prend automatiquement ${WINNER_POINTS} points avec ${bestSubmission.result} (ecart ${bestSubmission.distance}).`);
}

function applyStep({ left, operation, right, rightId }) {
  const result = calculateOperationResult(left, operation, right);
  if (!Number.isInteger(result) || result <= 0) {
    setNumbersStatus("Operation invalide: resultat entier positif requis.", true);
    return;
  }

  const rightEntry = getNumberEntryById(rightId);
  if (!rightEntry || rightEntry.used) {
    setNumbersStatus("Cette plaque n'est plus disponible.", true);
    return;
  }

  const baseEntry = getSelectedBaseEntry();
  if (!baseEntry || baseEntry.used) {
    setNumbersStatus("Choisis d'abord une premiere plaque valide.", true);
    return;
  }
  if (baseEntry.id === rightEntry.id) {
    setNumbersStatus("Choisis une seconde plaque differente.", true);
    return;
  }

  baseEntry.used = true;

  rightEntry.used = true;
  state.numbersGameSteps = [
    ...state.numbersGameSteps,
    {
      leftId: baseEntry.id,
      left,
      operation,
      rightId: rightEntry.id,
      right,
      resultId: `numbers-result-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      result
    }
  ];
  const lastStep = state.numbersGameSteps[state.numbersGameSteps.length - 1];
  state.numbersGameNumbers = [
    ...getNumbersEntries(),
    {
      id: lastStep.resultId,
      value: result,
      used: false,
      derived: true
    }
  ];
  state.numbersGameCurrentOperation = "";
  state.numbersGameSelectedBaseId = state.numbersGameNumbers[state.numbersGameNumbers.length - 1].id;
  state.numbersGameKeyboardBuffer = "";
  setNumbersStatus(`Etape ajoutee: ${formatStep(state.numbersGameSteps[state.numbersGameSteps.length - 1])}. Continue avec une operation puis une plaque.`);
  syncNumbersView();
}

function handleNumberSelection(numberId) {
  if (!isRoundReady()) return;
  const entry = getNumberEntryById(numberId);
  if (!entry || entry.used) return;

  if (!state.numbersGameCurrentOperation) {
    state.numbersGameSelectedBaseId = state.numbersGameSelectedBaseId === numberId ? null : numberId;
    setNumbersStatus(state.numbersGameSelectedBaseId ? `Base selectionnee: ${entry.value}` : "Selection de base annulee.");
    syncNumbersView();
    return;
  }

  const baseEntry = getSelectedBaseEntry();
  if (!baseEntry) {
    setNumbersStatus("Choisis d'abord une premiere plaque.", true);
    return;
  }

  applyStep({
    left: baseEntry.value,
    operation: state.numbersGameCurrentOperation,
    right: entry.value,
    rightId: numberId
  });
}

function chooseOperation(operation) {
  if (!isRoundReady()) return;
  const baseValue = getCurrentBaseValue();
  if (!Number.isInteger(baseValue)) {
    setNumbersStatus("Choisis d'abord une base.", true);
    return;
  }
  if (getAvailableSecondChoicesCount() <= 0) {
    setNumbersStatus("Aucune plaque disponible pour continuer.", true);
    return;
  }
  state.numbersGameCurrentOperation = state.numbersGameCurrentOperation === operation ? "" : operation;
  setNumbersStatus(state.numbersGameCurrentOperation ? `Operation choisie: ${formatOperationSymbol(operation)}` : "Operation annulee.");
  syncNumbersView();
}

function appendKeyboardDigit(digit) {
  if (!isRoundReady()) return;
  const nextBuffer = `${getKeyboardBuffer()}${digit}`.slice(0, 3);
  state.numbersGameKeyboardBuffer = nextBuffer;
  setNumbersStatus(`Saisie pavé numérique: ${nextBuffer}`);
  syncNumbersView();
}

function removeKeyboardDigit() {
  if (!getKeyboardBuffer()) return;
  state.numbersGameKeyboardBuffer = getKeyboardBuffer().slice(0, -1);
  setNumbersStatus(state.numbersGameKeyboardBuffer ? `Saisie pavé numérique: ${state.numbersGameKeyboardBuffer}` : "Saisie effacee.");
  syncNumbersView();
}

function clearKeyboardBuffer() {
  if (!getKeyboardBuffer()) return;
  state.numbersGameKeyboardBuffer = "";
  syncNumbersView();
}

function commitKeyboardBuffer() {
  const buffer = getKeyboardBuffer();
  if (!buffer) return true;

  const value = Number.parseInt(buffer, 10);
  if (!Number.isInteger(value)) {
    setNumbersStatus("Saisie invalide.", true);
    return false;
  }

  const entry = getUnusedEntryByValue(value);
  if (!entry) {
    setNumbersStatus(`La plaque ${value} n'est pas disponible.`, true);
    return false;
  }

  state.numbersGameKeyboardBuffer = "";
  handleNumberSelection(entry.id);
  return true;
}

function assignNumbersResult() {
  const baseEntry = getSelectedBaseEntry();
  if (!isRoundReady()) {
    setNumbersStatus("Genere d'abord une manche.", true);
    return;
  }
  if (!state.numbersGameSteps.length || !baseEntry || !Number.isInteger(baseEntry.value) || baseEntry.used) {
    setNumbersStatus("Construis d'abord un calcul valide.", true);
    return;
  }

  const result = baseEntry.value;
  const distance = Math.abs((state.numbersGameTarget || 0) - result);
  const steps = state.numbersGameSteps.map((step) => ({ ...step }));

  showTeamAwardModal({
    answer: `Resultat ${result} (ecart ${distance})`,
    onSelect: (team) => {
      if (!team) return;
      state.currentTeamId = team.id;
      state.numbersGameSubmissions = [
        ...state.numbersGameSubmissions,
        {
          id: `numbers-submission-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          teamId: team.id,
          teamName: team.name || "Equipe",
          result,
          distance,
          steps
        }
      ];
      clearCurrentCalculation({ keepStatus: true });
      setNumbersStatus(`${team.name || "Equipe"} valide ${result} (ecart ${distance}).`);
      renderTeams();
      syncNumbersView();
    }
  });
}

export function hideNumbersGameDisplay() {
  state.numbersGameVisible = false;
  const showBtn = $("btnNumbersGameShow");
  if (showBtn) showBtn.textContent = "Afficher nombre";
  postToPlateau({
    type: "SHOW_NUMBERS_GAME",
    visible: false,
    target: null,
    numbers: [],
    revealCount: 0,
    steps: [],
    currentLine: ""
  });
}

export function resetNumbersGameForNewShow() {
  state.numbersGameTarget = null;
  state.numbersGameNumbers = [];
  state.numbersGameVisible = false;
  state.numbersGameRevealCount = 0;
  state.numbersGameSelectedBaseId = null;
  state.numbersGameCurrentOperation = "";
  state.numbersGameKeyboardBuffer = "";
  state.numbersGameSteps = [];
  state.numbersGameSubmissions = [];
  state.numbersGameAwardedSubmissionId = null;
  setNumbersStatus("");
  renderNumbersGameCard();
  hideNumbersGameDisplay();
}

function bindNumbersGameKeyboard() {
  if (numbersGameKeyHandlerBound) return;
  numbersGameKeyHandlerBound = true;

  document.addEventListener("keydown", (event) => {
    if ($("numbersGameModal")?.classList.contains("hidden")) return;
    if (!$("teamModal")?.classList.contains("hidden")) return;

    const target = event.target;
    const tagName = target?.tagName?.toUpperCase?.() || "";
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
      return;
    }

    const code = String(event.code || "");
    const key = String(event.key || "");

    if (event.ctrlKey && !event.shiftKey && !event.altKey && key.toLowerCase() === "z") {
      event.preventDefault();
      undoLastNumbersStep();
      return;
    }

    if (/^Numpad[0-9]$/.test(code)) {
      event.preventDefault();
      appendKeyboardDigit(key);
      return;
    }

    if (code === "NumpadAdd" || code === "NumpadSubtract" || code === "NumpadMultiply" || code === "NumpadDivide") {
      event.preventDefault();
      if (!commitKeyboardBuffer()) return;
      const operation = code === "NumpadAdd"
        ? "+"
        : code === "NumpadSubtract"
          ? "-"
          : code === "NumpadMultiply"
            ? "*"
            : "/";
      chooseOperation(operation);
      return;
    }

    if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      removeKeyboardDigit();
      return;
    }

    if (code === "NumpadDecimal" || key === ".") {
      event.preventDefault();
      clearKeyboardBuffer();
      setNumbersStatus("Saisie annulee.");
      return;
    }

    if (key !== "Enter" && code !== "NumpadEnter") return;
    event.preventDefault();
    if (getKeyboardBuffer()) {
      if (!commitKeyboardBuffer()) return;
    }
  });
}

export function registerNumbersGameEvents() {
  $("btnNumbersGame")?.addEventListener("click", () => {
    $("numbersGameModal")?.classList.toggle("hidden");
  });

  $("numbersGameModal")?.addEventListener("click", (event) => {
    if (event.target?.id === "numbersGameModal") {
      $("numbersGameModal")?.classList.add("hidden");
    }
  });

  $("btnNumbersGameGenerate")?.addEventListener("click", () => {
    generateNumbersRound();
  });

  $("btnNumbersGameShow")?.addEventListener("click", () => {
    if (!isRoundReady()) return;
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

  $("btnNumbersGameClearCalc")?.addEventListener("click", () => {
    clearCurrentCalculation();
    setNumbersStatus("Calcul efface.");
  });

  $("btnNumbersGameAssign")?.addEventListener("click", () => {
    assignNumbersResult();
  });

  $("btnNumbersGameAward")?.addEventListener("click", () => {
    awardNumbersWinner();
  });

  bindNumbersGameKeyboard();
  renderNumbersGameCard();
}
