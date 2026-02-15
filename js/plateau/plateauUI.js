export function renderPlateau(state) {
  const gridEl = document.getElementById("grid");
  const sbEl = document.getElementById("scoreboard");
  if (!gridEl || !sbEl) return;

  // Scoreboard trié
  const teams = [...(state.teams ?? [])].sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
  sbEl.innerHTML = teams.map(t => `<div>${escapeHtml(t.name)} — ${t.score}</div>`).join("");

  // Grille (placeholder: rendu minimal)
  const g = state.grid;
  if (!g) { gridEl.textContent = "Aucune grille"; return; }

  const revealed = new Set(state.revealedLetters ?? []);
  const validated = state.validatedWords ?? {};
  const magicId = state.magic?.wordId ?? g.magicWordId ?? null;

  // build quick map word cells
  const cellToWord = new Map();
  for (const w of g.words ?? []) for (const rc of w.cells ?? []) cellToWord.set(`${rc.r},${rc.c}`, w.id);

  let html = `<div>(${g.rows}x${g.cols})</div>`;
  html += `<div style="display:inline-block; font-family:monospace;">`;

  for (let r=0; r<g.rows; r++) {
    html += `<div>`;
    for (let c=0; c<g.cols; c++) {
      const cell = (g.cells ?? []).find(x => x.r===r && x.c===c) ?? { blocked:false, char:"" };
      const key = `${r},${c}`;
      const wid = cellToWord.get(key);
      const isMagicCell = (wid && magicId && wid === magicId); // simplif
      const isValidated = wid && validated[wid]?.ok;

      let ch = "·";
      if (cell.blocked) ch = "#";
      else if (isValidated) ch = cell.char || " ";
      else if (!isMagicCell && revealed.has((cell.char||"").toUpperCase())) ch = cell.char || " ";
      else ch = "□";

      html += `<span style="display:inline-block; width:1.2em; text-align:center;">${escapeHtml(ch)}</span>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  gridEl.innerHTML = html;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
