import { state } from "./state.js";
import { advancePodiumStep, setScoreboardMode } from "./plateau.js";

let regieScoresModal = null;

function getSortedTeams() {
  return [...state.teams].sort((a, b) => {
    const pointsDiff = (b.points ?? 0) - (a.points ?? 0);
    if (pointsDiff !== 0) return pointsDiff;
    return (a.name || "Equipe").localeCompare(b.name || "Equipe", "fr", { sensitivity: "base" });
  });
}

function ensureRegieScoresModal() {
  if (regieScoresModal) return regieScoresModal;

  const overlay = document.createElement("div");
  overlay.id = "regieScoresModal";
  overlay.className = "modal hidden";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "regieScoresTitle");
  overlay.innerHTML = `
    <div class="regie-scores-panel">
      <div class="regie-scores-topbar">
        <div class="regie-scores-title" id="regieScoresTitle">TABLEAU DES SCORES</div>
        <div class="regie-scores-actions">
          <button id="regieScoresViewScores" class="btn ghost" type="button">Scores</button>
          <button id="regieScoresViewPodium" class="btn ghost" type="button">Podium</button>
        </div>
      </div>
      <div class="regie-scores-grid" id="regieScoresGrid"></div>
    </div>
  `;

  overlay.querySelector("#regieScoresViewScores")?.addEventListener("click", () => {
    setScoreboardMode("scores");
    refreshRegieScores();
  });

  overlay.querySelector("#regieScoresViewPodium")?.addEventListener("click", () => {
    if (state.scoreboardMode !== "podium") {
      state.scoreboardPodiumStep = 0;
      setScoreboardMode("podium");
    } else {
      advancePodiumStep();
    }
    refreshRegieScores();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target !== overlay) return;
    hideRegieScores();
  });

  document.body.appendChild(overlay);
  regieScoresModal = overlay;
  return overlay;
}

function renderScoresView(overlay) {
  const grid = overlay.querySelector("#regieScoresGrid");
  if (!grid) return;
  grid.innerHTML = "";

  getSortedTeams().forEach((team) => {
    const card = document.createElement("div");
    card.className = "regie-score-card";
    card.style.background = team.color || "#3ea6ff";
    card.innerHTML = `
      <div class="regie-score-name">${team.name || "Equipe"}</div>
      <div class="regie-score-points">${team.points ?? 0} PTS</div>
    `;
    grid.appendChild(card);
  });
}

function updateViewState(overlay) {
  const scoresBtn = overlay.querySelector("#regieScoresViewScores");
  const podiumBtn = overlay.querySelector("#regieScoresViewPodium");
  const title = overlay.querySelector("#regieScoresTitle");
  const grid = overlay.querySelector("#regieScoresGrid");
  const scoresMode = state.scoreboardMode !== "podium";

  scoresBtn?.classList.toggle("active", scoresMode);
  podiumBtn?.classList.toggle("active", !scoresMode);
  if (title) title.textContent = "TABLEAU DES SCORES";
  grid?.classList.remove("hidden");
}

function renderRegieScores() {
  const overlay = ensureRegieScoresModal();
  updateViewState(overlay);
  renderScoresView(overlay);
}

export function showRegieScores() {
  state.regieScoresVisible = true;
  renderRegieScores();
  ensureRegieScoresModal().classList.remove("hidden");
}

export function hideRegieScores() {
  state.regieScoresVisible = false;
  regieScoresModal?.classList.add("hidden");
}

export function refreshRegieScores() {
  if (!state.regieScoresVisible) return;
  renderRegieScores();
}
