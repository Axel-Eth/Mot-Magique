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
      points.textContent = `${team.name || "Equipe"} : ${team.points ?? 0}`;
    });

    const points = document.createElement("div");
    points.className = "team-points";
    points.textContent = `${team.name || "Equipe"} : ${team.points ?? 0}`;

    team._labelEl = label;
    team._pointsEl = points;

    square.addEventListener("click", () => {
      if (state.pendingPenaltyPoints > 0) {
        team.points = (team.points ?? 0) - state.pendingPenaltyPoints;
        state.pendingPenaltyPoints = 0;
        state.currentTeamId = null;
        renderTeams();
        return;
      }
      state.currentTeamId = team.id;
      renderTeams();
    });

    square.addEventListener("dblclick", () => {
      const current = team.points ?? 0;
      const val = prompt("Points pour cette equipe :", current);
      if (val === null) return;
      const num = parseInt(val, 10);
      if (!Number.isNaN(num)) {
        team.points = num;
        label.textContent = `${team.points ?? 0}`;
        points.textContent = `${team.name || "Equipe"} : ${team.points ?? 0}`;
      }
    });

    item.appendChild(square);
    item.appendChild(input);
    item.appendChild(points);
    container.appendChild(item);
  });
  syncScoresToPlateau();
}

export function ensureTeamChosen() {
  if (!state.currentTeamId) {
    const modal = document.getElementById("teamModal");
    if (modal) modal.classList.remove("hidden");
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
