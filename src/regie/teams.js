import { $ } from "./dom.js";
import { state } from "./state.js";
import { syncScoresToPlateau } from "./plateau.js";

const TEAM_COLORS = [
  "#ff7f50",
  "#ff5f6d",
  "#f7b801",
  "#16c79a",
  "#3ea6ff",
  "#a45deb",
  "#ff9f1c",
  "#00c1d4",
  "#ff4d6d",
  "#6ede8a"
];

function randomTeamColor() {
  return TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
}

function setTeamModalContent(title, message) {
  const titleEl = $("teamModalTitle");
  const messageEl = $("teamModalMessage");
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
}

function configureTeamModal({ title, message, showActions, showPenaltyList }) {
  setTeamModalContent(title, message);
  $("teamModalActions")?.classList.toggle("hidden", !showActions);
  $("teamModalPenaltyList")?.classList.toggle("hidden", !showPenaltyList);
}

function refreshTeamDisplay(team) {
  const pointsValue = team.points ?? 0;
  if (team._labelEl) team._labelEl.textContent = `${pointsValue}`;
  if (team._pointsInputEl) team._pointsInputEl.value = `${pointsValue}`;
}

function applyPenaltyToTeam(team) {
  if (!team || state.pendingPenaltyPoints <= 0) return;
  team.points = (team.points ?? 0) - state.pendingPenaltyPoints;
  state.pendingPenaltyPoints = 0;
  state.currentTeamId = null;
  hideTeamModal();
  renderTeams();
}

function renderPenaltyChoices() {
  const list = $("teamModalPenaltyList");
  if (!list) return;
  list.innerHTML = "";

  state.teams.forEach((team) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "team-modal-choice";
    button.innerHTML = `
      <span class="team-modal-choice-color" style="background:${team.color}"></span>
      <span class="team-modal-choice-name">${team.name || "Equipe"}</span>
      <span class="team-modal-choice-score">${team.points ?? 0}</span>
    `;
    button.addEventListener("click", () => applyPenaltyToTeam(team));
    list.appendChild(button);
  });
}

export function showPenaltyRequiredModal() {
  configureTeamModal({
    title: "Penalite requise",
    message: "Choisis une equipe a penaliser.",
    showActions: false,
    showPenaltyList: true
  });
  renderPenaltyChoices();
  $("teamModal")?.classList.remove("hidden");
}

export function showTeamRequiredModal() {
  configureTeamModal({
    title: "Equipe requise",
    message: "Choisis d'abord une equipe.",
    showActions: true,
    showPenaltyList: false
  });
  $("teamModal")?.classList.remove("hidden");
}

export function hideTeamModal() {
  $("teamModal")?.classList.add("hidden");
}

export function renderTeams() {
  const container = $("teamsContainer");
  if (!container) return;
  container.innerHTML = "";
  state.teams.forEach((team) => {
    const item = document.createElement("div");
    item.className = "team-item";

    const square = document.createElement("div");
    square.className = "team-square";
    square.style.background = team.color;
    if (state.currentTeamId === team.id) {
      square.classList.add("selected");
    }

    const label = document.createElement("span");
    label.className = "team-label";
    label.textContent = `${team.points ?? 0}`;
    square.appendChild(label);

    const input = document.createElement("input");
    input.className = "team-name-input";
    input.value = team.name || "";
    input.placeholder = "Nom";
    input.addEventListener("input", () => {
      team.name = input.value;
    });

    const points = document.createElement("input");
    points.type = "number";
    points.inputMode = "numeric";
    points.className = "team-points";
    points.value = `${team.points ?? 0}`;
    points.addEventListener("input", () => {
      const trimmed = points.value.trim();
      team.points = trimmed === "" ? 0 : Number.parseInt(trimmed, 10) || 0;
      refreshTeamDisplay(team);
      syncScoresToPlateau();
      if (state.pendingPenaltyPoints > 0 && !$("teamModal")?.classList.contains("hidden")) {
        renderPenaltyChoices();
      }
    });

    team._labelEl = label;
    team._pointsInputEl = points;
    refreshTeamDisplay(team);

    square.addEventListener("click", () => {
      if (state.pendingPenaltyPoints > 0) {
        applyPenaltyToTeam(team);
        return;
      }
      state.currentTeamId = team.id;
      renderTeams();
    });

    item.appendChild(square);
    item.appendChild(input);
    item.appendChild(points);
    container.appendChild(item);
  });
  syncScoresToPlateau();

  if (state.pendingPenaltyPoints > 0 && !$("teamModal")?.classList.contains("hidden")) {
    renderPenaltyChoices();
  }
}

export function ensureTeamChosen() {
  if (!state.currentTeamId) {
    showTeamRequiredModal();
    return false;
  }
  return true;
}

export function addTeam() {
  state.teams.push({
    id: Date.now() + Math.random(),
    name: `Equipe ${state.teams.length + 1}`,
    color: randomTeamColor(),
    points: 0
  });
  renderTeams();
}

export function removeSelectedTeam() {
  if (!state.currentTeamId) return false;

  const teamIndex = state.teams.findIndex((team) => team.id === state.currentTeamId);
  if (teamIndex < 0) return false;

  state.teams.splice(teamIndex, 1);
  state.currentTeamId = null;
  renderTeams();
  hideTeamModal();
  return true;
}
