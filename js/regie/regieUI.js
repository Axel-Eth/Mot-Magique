import { COMMANDS } from "../core/constants.js";

export function renderRegie(state, { comm, err, stateManager }) {
  renderTeams(state, { comm, err, stateManager });
  renderGridMini(state, { comm, err });
  renderWordPanel(state, { comm, err });
}

function renderTeams(state, { comm, err, stateManager }) {
  const root = document.getElementById("teams");
  if (!root) return;

  root.innerHTML = (state.teams ?? []).map(t => `
    <div style="margin:6px 0;">
      <button data-team="${t.id}">Sélection</button>
      <input data-teamname="${t.id}" value="${escapeHtml(t.name)}" />
      <span style="display:inline-block;width:10px;height:10px;background:${t.color};"></span>
      <span>${t.score}</span>
    </div>
  `).join("");

  root.querySelectorAll("button[data-team]").forEach(btn => {
    btn.onclick = () => {
      err("");
      comm.send({ type: COMMANDS.SELECT_TEAM, teamId: btn.dataset.team });
    };
  });

  root.querySelectorAll("input[data-teamname]").forEach(inp => {
    inp.onchange = () => {
      const id = inp.dataset.teamname;
      const st = stateManager.getState();
      const teams = st.teams.map(t => t.id === id ? { ...t, name: inp.value } : t);
      stateManager.patch({ teams });
      comm.send({ type: COMMANDS.STATE_PATCH, partial: { teams } });
    };
  });
}

function renderGridMini(state, { comm, err }) {
  const el = document.getElementById("gridMini");
  if (!el) return;
  const g = state.grid;
  if (!g) { el.textContent = "Aucune grille chargée."; return; }

  // Mini liste de mots sélectionnables (placeholder)
  const words = g.words ?? [];
  if (!words.length) {
    el.innerHTML = `<div>(Grille chargée, mais aucun mot défini pour l’instant.)</div>`;
    return;
  }

  el.innerHTML = words.map(w => `
    <button data-word="${w.id}" style="margin:2px;">
      ${escapeHtml(w.number ?? "")}${w.direction}${escapeHtml(w.id)}
    </button>
  `).join("");

  el.querySelectorAll("button[data-word]").forEach(btn => {
    btn.onclick = () => {
      err("");
      comm.send({ type: COMMANDS.SELECT_WORD, wordId: btn.dataset.word });
    };
  });
}

function renderWordPanel(state, { comm, err }) {
  const panel = document.getElementById("wordPanel");
  const label = document.getElementById("selectedWordLabel");
  if (!panel || !label) return;

  const wordId = state.selection?.wordId;
  if (!wordId) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  label.textContent = `Mot sélectionné: ${wordId}`;

  document.getElementById("btnCorrect").onclick = () => {
    err("");
    comm.send({ type: COMMANDS.VALIDATE_WORD, correct: true });
  };
  document.getElementById("btnIncorrect").onclick = () => {
    err("");
    comm.send({ type: COMMANDS.VALIDATE_WORD, correct: false });
  };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
