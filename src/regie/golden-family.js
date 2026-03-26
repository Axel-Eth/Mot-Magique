import { $ } from "./dom.js";
import { state } from "./state.js";
import { postToPlateau } from "./bridge.js";
import { syncScoresToPlateau } from "./plateau.js";
import { renderTeams, showTeamAwardModal } from "./teams.js";

const GOLDEN_FAMILY_BASE = "questions/golden_family/";
const GOLDEN_FAMILY_DATA_FILE = "golden_family.json";

function getAnyKey(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  }
  return undefined;
}

function normalizeGoldenAnswer(entry, index) {
  if (!entry || typeof entry !== "object") return null;
  const answer = String(getAnyKey(entry, ["answer", "text", "label", "name"]) || "").trim();
  if (!answer) return null;
  const rankRaw = Number(getAnyKey(entry, ["rank", "position", "order"]));
  const scoreRaw = Number(getAnyKey(entry, ["score", "points", "value"]));
  return {
    rank: Number.isFinite(rankRaw) && rankRaw > 0 ? Math.floor(rankRaw) : index + 1,
    answer,
    score: Number.isFinite(scoreRaw) ? Math.max(0, Math.floor(scoreRaw)) : 0
  };
}

function normalizeGoldenQuestion(entry, sourceName, index) {
  if (!entry || typeof entry !== "object") return null;
  const question = String(getAnyKey(entry, ["question", "title", "prompt"]) || "").trim();
  if (!question) return null;
  const rawAnswers = getAnyKey(entry, ["answers", "responses", "items"]);
  if (!Array.isArray(rawAnswers) || !rawAnswers.length) return null;

  const answers = rawAnswers
    .map((answer, answerIndex) => normalizeGoldenAnswer(answer, answerIndex))
    .filter(Boolean)
    .sort((a, b) => {
      const rankDiff = (a.rank ?? 0) - (b.rank ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return (b.score ?? 0) - (a.score ?? 0);
    })
    .slice(0, 8);

  if (!answers.length) return null;

  return {
    id: String(getAnyKey(entry, ["id", "uuid"]) || `${sourceName}::${index + 1}`),
    sourceName,
    question,
    answers
  };
}

function parseGoldenFamilyDataset(fileName, data) {
  const sourceName = String(fileName || "").replace(/\.json$/i, "");
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.questions)
      ? data.questions
      : Array.isArray(data?.items)
        ? data.items
        : [];

  return list
    .map((entry, index) => normalizeGoldenQuestion(entry, sourceName, index))
    .filter(Boolean);
}

function getRevealedMap() {
  return state.goldenFamilyRevealed && typeof state.goldenFamilyRevealed === "object"
    ? state.goldenFamilyRevealed
    : {};
}

function computeRoundPoints(question = state.goldenFamilyCurrent, revealed = getRevealedMap()) {
  if (!question?.answers?.length) return 0;
  return question.answers.reduce((sum, answer, index) => (
    revealed[index] ? sum + (Number(answer.score) || 0) : sum
  ), 0);
}

function buildPayload() {
  const q = state.goldenFamilyCurrent;
  const revealed = getRevealedMap();
  return {
    type: "SHOW_GOLDEN_FAMILY",
    visible: !!state.goldenFamilyVisible && !!q,
    source: q?.sourceName || "",
    question: q?.question || "",
    roundPoints: computeRoundPoints(q, revealed),
    answers: Array.isArray(q?.answers)
      ? q.answers.map((answer, index) => ({
        rank: answer.rank ?? index + 1,
        answer: answer.answer || "",
        score: Number(answer.score) || 0,
        revealed: !!revealed[index]
      }))
      : []
  };
}

function syncRoundPoints() {
  state.goldenFamilyRoundPoints = computeRoundPoints();
}

function sendGoldenFamilyToPlateau() {
  syncRoundPoints();
  postToPlateau(buildPayload());
}

function updateGoldenFamilyButtons() {
  const hasCurrent = !!state.goldenFamilyCurrent;
  const showBtn = $("btnGoldenFamilyShow");
  const clearBtn = $("btnGoldenFamilyHide");

  if (showBtn) {
    showBtn.disabled = !hasCurrent;
    showBtn.textContent = state.goldenFamilyVisible ? "Cacher le board" : "Afficher le board";
  }
  if (clearBtn) {
    clearBtn.disabled = !hasCurrent && !state.goldenFamilyVisible;
  }
}

function renderGoldenFamilyAnswerButtons() {
  const list = $("goldenFamilyAnswers");
  if (!list) return;
  list.innerHTML = "";

  const q = state.goldenFamilyCurrent;
  const revealed = getRevealedMap();
  if (!q?.answers?.length) return;

  q.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `golden-family-answer-btn${revealed[index] ? " revealed" : ""}`;
    const rankEl = document.createElement("span");
    rankEl.className = "golden-family-answer-rank";
    rankEl.textContent = `${answer.rank ?? index + 1}`;

    const textEl = document.createElement("span");
    textEl.className = "golden-family-answer-text";
    textEl.textContent = answer.answer;

    const scoreEl = document.createElement("span");
    scoreEl.className = "golden-family-answer-score";
    scoreEl.textContent = `${Number(answer.score) || 0}`;

    button.appendChild(rankEl);
    button.appendChild(textEl);
    button.appendChild(scoreEl);
    button.addEventListener("click", () => {
      toggleGoldenFamilyAnswer(index);
    });
    list.appendChild(button);
  });
}

function renderGoldenFamilyCard() {
  const card = $("goldenFamilyCard");
  const text = $("goldenFamilyText");

  syncRoundPoints();

  if (!state.goldenFamilyCurrent) {
    card?.classList.add("hidden");
    if (text) text.textContent = "Choisis une manche.";
    updateGoldenFamilyButtons();
    return;
  }

  card?.classList.remove("hidden");
  if (text) text.textContent = state.goldenFamilyCurrent.question;
  renderGoldenFamilyAnswerButtons();
  updateGoldenFamilyButtons();
}

function refreshGoldenFamilySelect() {
  const select = $("goldenFamilySelect");
  if (!select) return;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Famille en or";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  let currentSource = "";
  let currentGroup = null;

  state.goldenFamilyQuestions.forEach((question, index) => {
    if (question.sourceName !== currentSource) {
      currentSource = question.sourceName;
      currentGroup = document.createElement("optgroup");
      currentGroup.label = currentSource;
      select.appendChild(currentGroup);
    }
    const option = document.createElement("option");
    option.value = question.id;
    option.dataset.index = String(index);
    option.textContent = question.question;
    currentGroup.appendChild(option);
  });
}

function resetRoundState() {
  state.goldenFamilyRevealed = {};
  state.goldenFamilyRoundPoints = 0;
}

function setCurrentQuestion(question) {
  state.goldenFamilyCurrent = question || null;
  resetRoundState();
  const select = $("goldenFamilySelect");
  if (select && question) {
    const option = Array.from(select.options).find((entry) => entry.value === question.id);
    if (option) select.value = option.value;
  }
  renderGoldenFamilyCard();
  if (state.goldenFamilyVisible) {
    sendGoldenFamilyToPlateau();
  }
}

export function toggleGoldenFamilyAnswer(index) {
  const q = state.goldenFamilyCurrent;
  if (!q?.answers?.[index]) return;
  const answer = q.answers[index];
  const revealed = { ...getRevealedMap() };
  const nextRevealed = !revealed[index];
  revealed[index] = nextRevealed;
  state.goldenFamilyRevealed = revealed;

  if (nextRevealed && (Number(answer?.score) || 0) > 0) {
    showTeamAwardModal({
      points: Number(answer.score) || 0,
      answer: answer.answer || "",
      onSelect: (team) => {
        if (!team) return;
        state.currentTeamId = team.id;
        team.points = (team.points ?? 0) + (Number(answer.score) || 0);
        renderTeams();
        syncScoresToPlateau();
      }
    });
  }

  renderGoldenFamilyCard();
  if (state.goldenFamilyVisible) {
    sendGoldenFamilyToPlateau();
  }
}

export function hideGoldenFamilyDisplay() {
  state.goldenFamilyVisible = false;
  updateGoldenFamilyButtons();
  postToPlateau({ type: "SHOW_GOLDEN_FAMILY", visible: false, answers: [] });
}

export function resetGoldenFamilyForNewShow() {
  state.goldenFamilyCurrent = null;
  state.goldenFamilyVisible = false;
  resetRoundState();
  const select = $("goldenFamilySelect");
  if (select) select.selectedIndex = 0;
  renderGoldenFamilyCard();
  hideGoldenFamilyDisplay();
}

export async function loadGoldenFamilyList() {
  state.goldenFamilyQuestions = [];
  state.goldenFamilyCurrent = null;
  resetRoundState();

  try {
    const fileRes = await fetch(`${GOLDEN_FAMILY_BASE}${encodeURIComponent(GOLDEN_FAMILY_DATA_FILE)}`, { cache: "no-store" });
    if (!fileRes.ok) {
      refreshGoldenFamilySelect();
      renderGoldenFamilyCard();
      return;
    }
    const data = await fileRes.json();
    const questions = parseGoldenFamilyDataset(GOLDEN_FAMILY_DATA_FILE, data);

    state.goldenFamilyQuestions = questions.sort((a, b) => {
      const sourceDiff = String(a.sourceName || "").localeCompare(String(b.sourceName || ""), "fr", { sensitivity: "base" });
      if (sourceDiff !== 0) return sourceDiff;
      return String(a.question || "").localeCompare(String(b.question || ""), "fr", { sensitivity: "base" });
    });
  } catch {}

  refreshGoldenFamilySelect();
  renderGoldenFamilyCard();
}

export function registerGoldenFamilyEvents() {
  $("btnGoldenFamily")?.addEventListener("click", () => {
    const modal = $("goldenFamilyModal");
    if (!modal) return;
    modal.classList.toggle("hidden");
  });

  $("goldenFamilyModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "goldenFamilyModal") {
      $("goldenFamilyModal")?.classList.add("hidden");
    }
  });

  $("goldenFamilySelect")?.addEventListener("change", (e) => {
    const option = e.target.selectedOptions?.[0];
    const index = Number(option?.dataset?.index);
    if (!Number.isInteger(index) || !state.goldenFamilyQuestions[index]) return;
    setCurrentQuestion(state.goldenFamilyQuestions[index]);
  });

  $("btnGoldenFamilyRandom")?.addEventListener("click", () => {
    if (!state.goldenFamilyQuestions.length) return;
    const question = state.goldenFamilyQuestions[Math.floor(Math.random() * state.goldenFamilyQuestions.length)];
    setCurrentQuestion(question);
  });

  $("btnGoldenFamilyShow")?.addEventListener("click", () => {
    if (!state.goldenFamilyCurrent) return;
    state.goldenFamilyVisible = !state.goldenFamilyVisible;
    updateGoldenFamilyButtons();
    if (state.goldenFamilyVisible) {
      postToPlateau({ type: "STOP_FILMS_VIDEO" });
      postToPlateau({ type: "HIDE_MEDIA" });
      sendGoldenFamilyToPlateau();
    } else {
      hideGoldenFamilyDisplay();
    }
  });

  $("btnGoldenFamilyHide")?.addEventListener("click", () => {
    hideGoldenFamilyDisplay();
  });

  $("btnGoldenFamilyResetRound")?.addEventListener("click", () => {
    resetRoundState();
    renderGoldenFamilyCard();
    if (state.goldenFamilyVisible) {
      sendGoldenFamilyToPlateau();
    }
  });

  updateGoldenFamilyButtons();
}
