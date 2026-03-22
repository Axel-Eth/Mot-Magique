import { state } from "./state.js";

let regieScoresModal = null;

function ensureRegieScoresModal() {
  if (regieScoresModal) return regieScoresModal;

  const overlay = document.createElement("div");
  overlay.id = "regieScoresModal";
  overlay.className = "modal hidden";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "regieScoresTitle");
  overlay.innerHTML = `
    <div class="scores-overlay regie-scores-overlay active">
      <div class="scores-title" id="regieScoresTitle">TABLEAU DES SCORES</div>
      <div class="scores-grid" id="regieScoresGrid"></div>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target !== overlay) return;
    hideRegieScores();
  });

  document.body.appendChild(overlay);
  regieScoresModal = overlay;
  return overlay;
}

function renderRegieScores() {
  const overlay = ensureRegieScoresModal();
  const grid = overlay.querySelector("#regieScoresGrid");
  if (!grid) return;
  grid.innerHTML = "";

  state.teams.forEach((team) => {
    const card = document.createElement("div");
    card.className = "score-card";
    card.style.background = team.color || "#3ea6ff";
    card.innerHTML = `
      <div class="score-name">${team.name || "Equipe"}</div>
      <div class="score-points">${team.points ?? 0} PTS</div>
    `;
    grid.appendChild(card);
  });
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
