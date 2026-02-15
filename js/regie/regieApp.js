import { StateManager } from "../core/stateManager.js";
import { Comm } from "../core/comm.js";
import { COMMANDS, MEDIA_PRESETS } from "../core/constants.js";
import { renderRegie } from "./regieUI.js";

const stateManager = new StateManager();
const comm = new Comm();

const statusEl = document.getElementById("status");
const errorsEl = document.getElementById("errors");

function err(msg) {
  errorsEl.textContent = msg ? `Erreur: ${msg}` : "";
}

stateManager.subscribe((st) => {
  statusEl.textContent = `Sync: ${new Date(st.meta.updatedAt).toLocaleTimeString()}`;
  renderRegie(st, { comm, err, stateManager });
});

// Boutons média (plateau only)
document.getElementById("btnGenerique").onclick = () => comm.send({ type: COMMANDS.PLAY_MEDIA, preset: "generique" });
document.getElementById("btnMot2").onclick = () => comm.send({ type: COMMANDS.PLAY_MEDIA, preset: "mot_double" });
document.getElementById("btnMot3").onclick = () => comm.send({ type: COMMANDS.PLAY_MEDIA, preset: "mot_triple" });
document.getElementById("btnBadPoints").onclick = () => comm.send({ type: COMMANDS.PLAY_MEDIA, preset: "bad_word" });
document.getElementById("btnStopMedia").onclick = () => comm.send({ type: COMMANDS.STOP_MEDIA });

// Reveal letter
document.getElementById("btnRevealLetter").onclick = () => {
  const v = (document.getElementById("letterInput").value || "").trim().toUpperCase();
  err("");
  comm.send({ type: COMMANDS.REVEAL_LETTER, letter: v });
};

// Reset
document.getElementById("btnReset").onclick = () => {
  err("");
  comm.send({ type: COMMANDS.RESET });
};

// Ajouter équipe (fait côté régie via patch d’état)
document.getElementById("btnAddTeam").onclick = () => {
  const st = stateManager.getState();
  const id = crypto.randomUUID();
  const used = new Set(st.teams.map(t => t.color));
  const color = pickVividColor(used);

  const team = { id, name: `Équipe ${st.teams.length + 1}`, color, score: 0 };
  const teams = [...st.teams, team];
  stateManager.patch({ teams });

  // broadcast patch pour plateau
  comm.send({ type: COMMANDS.STATE_PATCH, partial: { teams } });
};

function pickVividColor(used) {
  const palette = ["#ff004c","#00c2ff","#7cff00","#ffcc00","#b300ff","#00ffb3","#ff6a00","#00ff2a"];
  for (const c of palette) if (!used.has(c)) return c;
  // fallback random
  let c = "#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0");
  while (used.has(c)) c = "#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0");
  return c;
}
