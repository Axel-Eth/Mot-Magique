/* ============================================================
   À vos mots ! — app.js (Régie)
   - DÇ¸tecte les fichiers XLSX dans /grids
   - Ouvre le plateau (plateau.html)
   - Lit un XLSX via SheetJS (xlsx.full.min.js)
   - Extrait lettres / numéros / définitions (commentaires)
   - Détecte les mots (H/V)
   - Envoie la grille au plateau via postMessage
   - Gère: saisie lettre + Entrée, Correcte, Nop, Fullscreen, Reset
   ============================================================ */

/* global XLSX */

const $ = (id) => document.getElementById(id);

const CUSTOM_STORAGE_KEY = "avm_custom_grids";
const selectSound = new Audio("sounds/selection_mot_grille.mp3");
const LETTER_REGEX = /^\p{L}$/u;
function playSelectSound() {
  try {
    selectSound.pause();
    selectSound.currentTime = 0;
    selectSound.play();
  } catch {}
}
function stopSelectSound() {
  try {
    selectSound.pause();
    selectSound.currentTime = 0;
  } catch {}
}

function isSingleLetter(value) {
  return LETTER_REGEX.test(String(value || ""));
}

/* ---------- État ---------- */
const state = {
  plateauWin: null,
  gridList: [],
  grid: null,               // objet grille interne (Maps, words, etc.)
  selectedWordId: null,
  visibleNumbers: new Set(),
  magicWordId: null,
  magicWordCells: new Set(),
  magicSolved: false,
  teams: [],
  currentTeamId: null,
  multiplier: 1,
  badPointsActive: false,
  pendingPenaltyPoints: 0,
  showScores: false,
  capitalesNotesDefault: {},
  capitalesNotesSarcasme: {},
  capitalesNotesMode: "doux",
  capitalesFiles: [],
  capitalesLastFile: ""
};

/* ---------- Helpers UI ---------- */
function setPlateauLabel() {
  $("plateauState").textContent =
    state.plateauWin && !state.plateauWin.closed ? "ouvert" : "fermé";
}

function setActionButtonsEnabled(enabled) {
  $("btnCorrect").disabled = !enabled;
  $("btnNop").disabled = !enabled;
  const btnMagic = $("btnMagicWord");
  if (btnMagic) btnMagic.disabled = !enabled;
}

function setFullscreenEnabled(enabled) {
  $("btnFullscreen").disabled = !enabled;
}

function setMultiplier(value, silent = false) {
  state.multiplier = value;
  const b2 = $("btnDouble");
  const b3 = $("btnTriple");
  if (b2) b2.classList.toggle("active", value === 2);
  if (b3) b3.classList.toggle("active", value === 3);
  if (!silent) {
    postToPlateau({ type: "SET_MULTIPLIER", value });
  }
}

function setBadPointsActive(active) {
  state.badPointsActive = active;
  const btn = $("btnBad");
  if (btn) btn.classList.toggle("bad-active", active);
}


/* ---------- Équipes ---------- */
const TEAM_COLORS = [
  "#ff7f50", "#ff5f6d", "#f7b801", "#16c79a", "#3ea6ff", "#a45deb",
  "#ff9f1c", "#00c1d4", "#ff4d6d", "#6ede8a"
];
function randomTeamColor() {
  return TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
}

function renderTeams() {
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
      const val = prompt("Points pour cette équipe :", current);
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

function ensureTeamChosen() {
  if (!state.currentTeamId) {
    const modal = document.getElementById("teamModal");
    if (modal) modal.classList.remove("hidden");
    return false;
  }
  return true;
}

function addTeam() {
  state.teams.push({
    id: Date.now() + Math.random(),
    name: `Equipe ${state.teams.length + 1}`,
    color: randomTeamColor(),
    points: 0
  });
  renderTeams();
}

function loadCustomGridList() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function updateSelectedInfo() {
  if (!state.grid || state.selectedWordId == null) {
    $("selectedInfo").textContent = "-";
    return;
  }
  const w = state.grid.words[state.selectedWordId];
  const n = w.number != null ? `#${w.number}` : "-";
  $("selectedInfo").textContent = `${n} ${w.orientation} (${w.cells.length})`;
}

function buildMagicWordCells(wordId) {
  const set = new Set();
  if (!state.grid || wordId == null) return set;
  const word = state.grid.words?.[wordId];
  if (!word) return set;
  word.cells.forEach((p) => {
    set.add(`${p.r},${p.c}`);
  });
  return set;
}

function isMagicWordCell(pos) {
  return state.magicWordCells.has(pos);
}

function isMagicHighlightCell(pos) {
  return (state.grid?.magic && state.grid.magic.has(pos)) || state.magicWordCells.has(pos);
}

function updateMagicButtonState() {
  const btn = $("btnMagicWord");
  if (!btn) return;
  const isMagicSelected = state.selectedWordId != null && state.selectedWordId === state.magicWordId;
  btn.classList.toggle("active", isMagicSelected);
}

function countRemainingLetters() {
  if (!state.grid) return 0;
  let remaining = 0;
  for (const [pos] of state.grid.letters) {
    if (!state.grid.revealed.get(pos)) remaining++;
  }
  return remaining;
}


/* ---------- Grille intégrée (rendu local) ---------- */
function renderRegieGrid() {
  const gridEl = $("regieGrid");
  if (!gridEl || !state.grid) return;
  gridEl.innerHTML = "";

  const { minRow, maxRow, minCol, maxCol } = state.grid.bounds;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  gridEl.style.gridTemplateRows = `repeat(${rows}, 48px)`;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 48px)`;

  const visibleNums = state.visibleNumbers || new Set();

  const selectedWord =
    state.selectedWordId != null ? state.grid.words[state.selectedWordId] : null;
  const selectedCells = new Set(
    selectedWord ? selectedWord.cells.map((p) => `${p.r},${p.c}`) : []
  );

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const pos = `${r},${c}`;
      const hasLetter = state.grid.letters.has(pos);
      const hasNumber = state.grid.numbers.has(pos);

      const cell = document.createElement("div");
      cell.dataset.pos = pos;

      if (!hasLetter && !hasNumber) {
        cell.className = "cell empty";
        cell.setAttribute("aria-hidden", "true");
        gridEl.appendChild(cell);
        continue;
      }

      if (hasLetter) {
        cell.className = "cell letter";
        const revealed = state.grid.revealed.get(pos);
        const magicWordCell = isMagicWordCell(pos);
        const canReveal = !magicWordCell || state.magicSolved;
        if (isMagicHighlightCell(pos)) cell.classList.add("magic");
        // Affiche le mot sélectionné en clair uniquement côté régie (cheat visuel temporaire)
        if (selectedWord && selectedCells.has(pos)) {
          cell.classList.add("revealed");
          cell.textContent = state.grid.letters.get(pos);
        } else if (revealed && canReveal) {
          cell.classList.add("revealed");
          cell.textContent = state.grid.letters.get(pos);
        }
        if (selectedWord && !selectedCells.has(pos)) {
          cell.classList.add("dim");
        }
        if (selectedCells.has(pos)) {
          cell.classList.add("selected-word");
        }
        cell.addEventListener("click", () => {
          if (!ensureTeamChosen()) return;
          const ids = state.grid.cellToWords.get(pos);
          if (ids && ids.length) {
            state.selectedWordId = ids[0];
            clearVisibleNumbers();
            const w = state.grid.words[state.selectedWordId];
            if (w?.numberPos) state.visibleNumbers.add(`${w.numberPos.r},${w.numberPos.c}`);
            updateSelectedInfo();
            setActionButtonsEnabled(true);
            updateMagicButtonState();
            postToPlateau({ type: "SELECT_WORD", wordId: state.selectedWordId });
            renderRegieGrid();
          }
        });
      } else if (hasNumber) {
        const visible = visibleNums.has(pos);
        cell.className = visible ? "cell number" : "cell number hidden-number";
        cell.textContent = visible ? state.grid.numbers.get(pos) : "";
        if (visible) {
          cell.addEventListener("click", () => {
            if (!ensureTeamChosen()) return;
            const wid = state.grid.numberPosToWord.get(pos);
            if (wid != null) {
              state.selectedWordId = wid;
              state.visibleNumbers = new Set();
              const w = state.grid.words[wid];
              if (w?.numberPos) state.visibleNumbers.add(`${w.numberPos.r},${w.numberPos.c}`);
              updateSelectedInfo();
              setActionButtonsEnabled(true);
              updateMagicButtonState();
              postToPlateau({ type: "SELECT_WORD", wordId: state.selectedWordId });
              renderRegieGrid();
            }
          });
        } else {
          cell.setAttribute("aria-hidden", "true");
        }
      }

      gridEl.appendChild(cell);
    }
  }
}

function clearVisibleNumbers() {
  state.visibleNumbers = new Set();
}

function showNumbersForWords(wordIds = []) {
  const s = new Set();
  if (state.grid && Array.isArray(wordIds)) {
    for (const wid of wordIds) {
      const w = state.grid.words?.[wid];
      if (w?.numberPos) s.add(keyPos(w.numberPos));
    }
  }
  state.visibleNumbers = s;
}

function showNumbersForLetter(letter) {
  if (!state.grid) return;
  const s = new Set();
  for (const [pos, ltr] of state.grid.letters) {
    if (ltr === letter) {
      const ids = state.grid.cellToWords.get(pos);
      if (ids) {
        ids.forEach((wid) => {
          const w = state.grid.words?.[wid];
          if (w?.numberPos) s.add(keyPos(w.numberPos));
        });
      }
    }
  }
  state.visibleNumbers = s;
}

/* ---------- Communication plateau ---------- */
function postToPlateau(msg) {
  if (state.plateauWin && !state.plateauWin.closed) {
    try { state.plateauWin.postMessage(msg, "*"); } catch (err) { console.error("postToPlateau error:", err); }
  }
}

function syncScoresToPlateau() {
  postToPlateau({
    type: "SCORES_UPDATE",
    show: state.showScores,
    teams: state.teams.map((t) => ({
      name: t.name || "Equipe",
      points: t.points ?? 0,
      color: t.color
    }))
  });
}

function openPlateauWindow() {
  if (state.plateauWin && !state.plateauWin.closed) {
    state.plateauWin.focus();
    return;
  }
  const win = window.open("plateau.html", "avm_plateau_tab");
  state.plateauWin = win || null;
  setPlateauLabel();
  setFullscreenEnabled(!!win);
  setActionButtonsEnabled(false);
}

/* ---------- Chargement liste grilles ---------- */
async function loadGridList() {
  const entries = [];

  function normalizeGridHref(raw, dir) {
    let href = String(raw || "");
    if (!href) return "";
    href = href.replace(/[#?].*$/, "");
    href = href.replace(/^\.\//, "");
    if (/^https?:\/\//i.test(href)) return "";
    href = href.replace(/^\/?grids\//i, "");
    if (dir && !href.startsWith(dir)) {
      href = `${dir}${href}`;
    }
    return href;
  }

  function groupFromRelPath(relPath) {
    const parts = String(relPath || "").split("/").filter(Boolean);
    if (parts.length <= 1) return "Racine";
    return parts.slice(0, -1).join(" / ");
  }

  // 1) Essaye un listing HTTP du dossier /grids (python -m http.server, etc.)
  try {
    const base = "grids/";
    const queue = [""];
    const seen = new Set();

    while (queue.length) {
      const dir = queue.shift();
      if (seen.has(dir)) continue;
      seen.add(dir);

      const res = await fetch(`${base}${dir}`, { cache: "no-store" });
      if (!res.ok) continue;
      const html = await res.text();
      const links = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);

      for (const raw of links) {
        const decoded = decodeURIComponent(raw || "");
        if (!decoded || decoded == "../") continue;
        const rel = normalizeGridHref(decoded, dir);
        if (!rel) continue;

        if (rel.endsWith("/")) {
          queue.push(rel);
          continue;
        }

        if (/\.(xlsx|json)$/i.test(rel)) {
          const file = `${base}${rel}`;
          const baseName = rel.split("/").pop() || rel;
          const name = baseName.replace(/\.(xlsx|json)$/i, "");
          const group = groupFromRelPath(rel);
          entries.push({ file, name, group });
        }
      }
    }
  } catch (err) {
    console.warn("Listing /grids/ impossible:", err);
  }

  // 2) Fallback: grids.json si present (compatibilite)
  if (!entries.length) {
    try {
      const resJson = await fetch("grids.json", { cache: "no-store" });
      if (resJson.ok) {
        const listJson = await resJson.json();
        if (Array.isArray(listJson)) {
          listJson.forEach((g) => {
            if (!g?.file) return;
            const base = (g.name && g.name.trim()) || (g.file.split("/").pop() || g.file);
            const name = base.replace(/\.(xlsx|json)$/i, "");
            const rel = g.file.replace(/^\/?grids\//i, "");
            const group = groupFromRelPath(rel);
            entries.push({ file: g.file, name, group });
          });
        }
      }
    } catch (err) {
      console.warn("Fallback grids.json impossible:", err);
    }
  }

  if (!entries.length) {
    throw new Error("Aucune grille trouvee (listing /grids/ indisponible et grids.json absent). Place tes fichiers .xlsx/.json dans /grids/ ou reactive un listing/grids.json.");
  }

  const dedup = new Map();
  for (const e of entries) {
    if (!dedup.has(e.file)) dedup.set(e.file, e);
  }
  const list = [...dedup.values()];

  state.gridList = list.sort((a, b) => {
    const ga = a.group || "";
    const gb = b.group || "";
    const g = ga.localeCompare(gb, "fr", { sensitivity: "base" });
    if (g != 0) return g;
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
  rebuildGridSelect();
}

/* ---------- Parsing XLSX (reproduction logique du Python) ---------- */
function k(r, c) {
  return `${r},${c}`;
}

function buildWordData(letters, numbers, bounds, getDefinitionForWord) {
  const { minRow, maxRow, minCol, maxCol } = bounds;
  const words = [];                    // {id,cells,definition,orientation,number,numberPos}
  const cellToWords = new Map();       // "r,c" -> [wordId,...]
  const numberPosToWord = new Map();   // "r,c" -> wordId

  function addWord(cells, orientation) {
    const id = words.length;
    const first = cells[0];

    // numero attendu a gauche (H) ou au-dessus (V)
    let number = null;
    let numberPos = null;

    if (orientation === "H") {
      const pos = k(first.r, first.c - 1);
      if (numbers.has(pos)) {
        number = numbers.get(pos);
        numberPos = { r: first.r, c: first.c - 1 };
      }
    } else {
      const pos = k(first.r - 1, first.c);
      if (numbers.has(pos)) {
        number = numbers.get(pos);
        numberPos = { r: first.r - 1, c: first.c };
      }
    }

    const def = getDefinitionForWord(first, orientation, numberPos);
    const w = { id, cells, definition: def, orientation, number, numberPos };
    words.push(w);

    for (const p of cells) {
      const ck = k(p.r, p.c);
      if (!cellToWords.has(ck)) cellToWords.set(ck, []);
      cellToWords.get(ck).push(id);
    }

    if (numberPos) {
      numberPosToWord.set(k(numberPos.r, numberPos.c), id);
    }
  }

  // Mots horizontaux (sequences de lettres contigues len>1)
  for (let r = minRow; r <= maxRow; r++) {
    let c = minCol;
    while (c <= maxCol) {
      if (letters.has(k(r, c))) {
        const cells = [{ r, c }];
        c++;
        while (c <= maxCol && letters.has(k(r, c))) {
          cells.push({ r, c });
          c++;
        }
        if (cells.length > 1) addWord(cells, "H");
      }
      c++;
    }
  }

  // Mots verticaux
  for (let c = minCol; c <= maxCol; c++) {
    let r = minRow;
    while (r <= maxRow) {
      if (letters.has(k(r, c))) {
        const cells = [{ r, c }];
        r++;
        while (r <= maxRow && letters.has(k(r, c))) {
          cells.push({ r, c });
          r++;
        }
        if (cells.length > 1) addWord(cells, "V");
      }
      r++;
    }
  }

  return { words, cellToWords, numberPosToWord };
}

function rebuildGridSelect() {
  const sel = $("gridSelect");
  const prev = sel.value;
  sel.innerHTML = "";

  let currentGroup = "";
  let currentOptgroup = null;
  for (const g of state.gridList) {
    // support: {name,file} obligatoire
    if (!g || !g.name || !g.file) continue;
    const group = g.group || "Racine";
    if (group != currentGroup) {
      currentGroup = group;
      currentOptgroup = document.createElement("optgroup");
      currentOptgroup.label = currentGroup;
      sel.appendChild(currentOptgroup);
    }
    const opt = document.createElement("option");
    opt.value = g.file;
    opt.textContent = g.name;
    currentOptgroup.appendChild(opt);
  }

  const custom = loadCustomGridList();
  if (custom.length) {
    const groupLabel = document.createElement("option");
    groupLabel.disabled = true;
    groupLabel.className = "group-label";
    groupLabel.textContent = "Locales";
    sel.appendChild(groupLabel);
    for (const g of custom) {
      const opt = document.createElement("option");
      opt.value = `custom:${g.id}`;
      opt.textContent = g.name || g.id;
      sel.appendChild(opt);
    }
  }

  if (!sel.options.length) {
    throw new Error("Aucune grille valide (dossier grids/ ou grilles locales).");
  }

  if (prev && sel.querySelector(`option[value="${prev}"]`)) {
    sel.value = prev;
  }
}

function keyPos(obj) {
  return `${obj.r},${obj.c}`;
}

function getCell(ws, r1, c1) {
  // ws: sheetjs, r1/c1 en 1-indexé
  return ws[XLSX.utils.encode_cell({ r: r1 - 1, c: c1 - 1 })];
}

function getComment(ws, r1, c1) {
  const cell = getCell(ws, r1, c1);
  if (!cell) return "-";

  // Selon versions SheetJS: cell.c = array of comments
  // On récupère un texte au mieux.
  const c = cell.c;
  if (Array.isArray(c) && c.length) {
    const t = (c[0].t ?? c[0].text ?? "-").toString().trim();
    return t;
  }
  return "-";
}

async function parseXlsx(url) {
  const buf = await (await fetch(url, { cache: "no-store" })).arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellComments: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("XLSX: aucune feuille trouvée.");

  const letters = new Map();     // "r,c" -> "A"
  const numbers = new Map();     // "r,c" -> 12
  const revealed = new Map();    // "r,c" -> false/true
  const magic = new Set();
  const used = [];

  for (let r = 1; r <= 200; r++) {
    for (let c = 1; c <= 200; c++) {
      const cell = getCell(ws, r, c);
      if (!cell || cell.v === undefined || cell.v === null || cell.v === "-") continue;

      const v = cell.v;

      if (typeof v === "string") {
        const s = v.trim();
        if (s.length >= 1 && /^\p{L}/u.test(s[0])) {
          const L = s[0].toUpperCase();
          letters.set(k(r, c), L);
          revealed.set(k(r, c), false);
          used.push([r, c]);
        }
      } else if (typeof v === "number") {
        numbers.set(k(r, c), Math.trunc(v));
        used.push([r, c]);
      }
    }
  }

  if (!used.length) {
    throw new Error("XLSX: aucune cellule exploitable (lettre/numéro) détectée.");
  }

  const rows = used.map(([r]) => r);
  const cols = used.map(([, c]) => c);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  const words = [];                    // {id,cells,definition,orientation,number,numberPos}
  const cellToWords = new Map();       // "r,c" -> [wordId,...]
  const numberPosToWord = new Map();   // "r,c" -> wordId

  function addWord(cells, orientation) {
    const id = words.length;
    const first = cells[0];

    // numéro attendu à gauche (H) ou au-dessus (V)
    let number = null;
    let numberPos = null;

    if (orientation === "H") {
      const pos = k(first.r, first.c - 1);
      if (numbers.has(pos)) {
        number = numbers.get(pos);
        numberPos = { r: first.r, c: first.c - 1 };
      }
    } else {
      const pos = k(first.r - 1, first.c);
      if (numbers.has(pos)) {
        number = numbers.get(pos);
        numberPos = { r: first.r - 1, c: first.c };
      }
    }

    // définition: priorité commentaire du numéro, sinon commentaire de la 1ère lettre
    let def = "-";
    if (numberPos) def = getComment(ws, numberPos.r, numberPos.c);
    if (!def) def = getComment(ws, first.r, first.c);
    if (!def) def = "(Pas de définition renseignée.)";

    const w = { id, cells, definition: def, orientation, number, numberPos };
    words.push(w);

    for (const p of cells) {
      const ck = k(p.r, p.c);
      if (!cellToWords.has(ck)) cellToWords.set(ck, []);
      cellToWords.get(ck).push(id);
    }

    if (numberPos) {
      numberPosToWord.set(k(numberPos.r, numberPos.c), id);
    }
  }

  // Mots horizontaux (séquences de lettres contiguës len>1)
  for (let r = minRow; r <= maxRow; r++) {
    let c = minCol;
    while (c <= maxCol) {
      if (letters.has(k(r, c))) {
        const cells = [{ r, c }];
        c++;
        while (c <= maxCol && letters.has(k(r, c))) {
          cells.push({ r, c });
          c++;
        }
        if (cells.length > 1) addWord(cells, "H");
      }
      c++;
    }
  }

  // Mots verticaux
  for (let c = minCol; c <= maxCol; c++) {
    let r = minRow;
    while (r <= maxRow) {
      if (letters.has(k(r, c))) {
        const cells = [{ r, c }];
        r++;
        while (r <= maxRow && letters.has(k(r, c))) {
          cells.push({ r, c });
          r++;
        }
        if (cells.length > 1) addWord(cells, "V");
      }
      r++;
    }
  }

  return {
    url,
    bounds: { minRow, maxRow, minCol, maxCol },
    letters,
    numbers,
    revealed,
    magic,
    words,
    cellToWords,
    numberPosToWord,
    magicWordId: null,
    magicWordCells: new Set(),
    magicSolved: false
  };
}

function parseCustomGrid(entry) {
  const letters = new Map();
  const numbers = new Map();
  const revealed = new Map();
  const magic = new Set();
  const definitions = entry.definitions || {};

  for (const [pos, letter] of Object.entries(entry.letters || {})) {
    const up = String(letter || "").toUpperCase();
    if (!up) continue;
    letters.set(pos, up);
    revealed.set(pos, false);
  }

  for (const [pos, num] of Object.entries(entry.numbers || {})) {
    const val = Number(num);
    if (!Number.isNaN(val)) {
      numbers.set(pos, val);
    }
  }

  for (const [pos, val] of Object.entries(entry.magic || {})) {
    if (val && letters.has(pos)) {
      magic.add(pos);
    }
  }

  const bounds = {
    minRow: 1,
    maxRow: entry.rows,
    minCol: 1,
    maxCol: entry.cols
  };

  const { words, cellToWords, numberPosToWord } = buildWordData(
    letters,
    numbers,
    bounds,
    (first, orientation) => {
      const defKey = `${orientation}:${first.r},${first.c}`;
      return definitions[defKey] || "(Pas de definition renseignee.)";
    }
  );

  let magicWordId = null;
  if (entry.magicWordKey) {
    const [orientation, start] = String(entry.magicWordKey).split(":");
    if (orientation && start) {
      const [r, c] = start.split(",").map(Number);
      const found = words.find(
        (w) => w.orientation === orientation && w.cells?.[0]?.r === r && w.cells?.[0]?.c === c
      );
      if (found) magicWordId = found.id;
    }
  }

  return {
    url: `custom:${entry.id}`,
    bounds,
    letters,
    numbers,
    revealed,
    magic,
    words,
    cellToWords,
    numberPosToWord,
    magicWordId,
    magicWordCells: new Set(),
    magicSolved: false
  };
}

async function parseJsonGrid(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("JSON: chargement impossible.");
  const data = await res.json();
  if (!data || !data.rows || !data.cols || !data.letters) {
    throw new Error("JSON: format invalide.");
  }
  const entry = {
    id: data.id || `file_${Date.now()}`,
    name: data.name || "Grille JSON",
    rows: data.rows,
    cols: data.cols,
    letters: data.letters || {},
    numbers: data.numbers || {},
    magic: data.magic || {},
    magicWordKey: data.magicWordKey || null,
    definitions: data.definitions || {}
  };
  const grid = parseCustomGrid(entry);
  grid.url = url;
  return grid;
}

/* ---------- Sérialisation (postMessage friendly) ---------- */
function serializeGridForPlateau(grid) {
  return {
    url: grid.url,
    bounds: grid.bounds,
    letters: [...grid.letters.entries()],
    numbers: [...grid.numbers.entries()],
    revealed: [...grid.revealed.entries()],
    magic: grid.magic ? [...grid.magic] : [],
    words: grid.words,
    cellToWords: [...grid.cellToWords.entries()],
    numberPosToWord: [...grid.numberPosToWord.entries()],
    magicWordId: grid.magicWordId ?? state.magicWordId,
    magicSolved: grid.magicSolved ?? state.magicSolved
  };
}

/* ---------- Chargement d'une grille ---------- */
async function loadSelectedGrid() {
  const file = $("gridSelect").value;

  state.grid = null;
  state.selectedWordId = null;
  state.visibleNumbers = new Set();
  updateSelectedInfo();
  setActionButtonsEnabled(false);

  try {
    let g = null;
    if (file.startsWith("custom:")) {
      const id = file.slice("custom:".length);
      const list = loadCustomGridList();
      const entry = list.find((x) => x.id === id);
      if (!entry) throw new Error("Grille locale introuvable.");
      g = parseCustomGrid(entry);
    } else if (/\.json$/i.test(file)) {
      g = await parseJsonGrid(file);
    } else {
      g = await parseXlsx(file);
    }
    state.grid = g;
    state.visibleNumbers = new Set();
    state.magicWordId = state.grid.magicWordId ?? null;
    state.magicSolved = state.grid.magicSolved ?? false;
    state.magicWordCells = buildMagicWordCells(state.magicWordId);
    if (state.grid) {
      state.grid.magicWordId = state.magicWordId;
      state.grid.magicWordCells = state.magicWordCells;
      state.grid.magicSolved = state.magicSolved;
    }
    updateMagicButtonState();

    // Envoie au plateau si ouvert
    postToPlateau({ type: "LOAD_GRID", grid: serializeGridForPlateau(g) });
    renderRegieGrid();
  } catch (err) {
    console.error(err);
    alert(String(err?.message ?? err));
  }
}

/* ---------- Reset révélations ---------- */
function resetReveal() {
  if (!state.grid) return;
  for (const pos of state.grid.revealed.keys()) {
    state.grid.revealed.set(pos, false);
  }
  state.magicSolved = false;
  state.grid.magicSolved = false;
  for (const pos of state.magicWordCells) {
    state.grid.revealed.set(pos, false);
  }
  state.selectedWordId = null;
  state.visibleNumbers = new Set();
  updateSelectedInfo();
  updateMagicButtonState();
  setActionButtonsEnabled(false);
  postToPlateau({ type: "RESET_REVEAL" });
  renderRegieGrid();
}

/* ============================================================
   Events UI
   ============================================================ */

$("openPlateau").addEventListener("click", () => {
  openPlateauWindow();
});

const openEditorBtn = document.getElementById("openEditor");
if (openEditorBtn) {
  openEditorBtn.addEventListener("click", () => {
    const win = window.open("editor.html", "avm_editor", "width=1400,height=900");
    if (!win) {
      window.location.href = "editor.html";
    }
  });
}

$("gridSelect").addEventListener("change", async () => {
  await loadSelectedGrid();
    renderTeams();
});

$("btnReset").addEventListener("click", () => {
  if (!state.grid) return;
  if (confirm("Reset les révélations ?")) resetReveal();
});

$("btnFullscreen").addEventListener("click", () => {
  postToPlateau({ type: "TOGGLE_FULLSCREEN" });
});

$("btnGeneric")?.addEventListener("click", () => {
  postToPlateau({ type: "PLAY_GENERIC" });
});

$("btnShuffleLetters")?.addEventListener("click", () => {
  postToPlateau({ type: "SHUFFLE_LETTERS" });
});

$("btnBad")?.addEventListener("click", () => {
  const next = !state.badPointsActive;
  setBadPointsActive(next);
  if (next) {
    postToPlateau({ type: "PLAY_BAD" });
  }
});

$("btnScores")?.addEventListener("click", () => {
  state.showScores = !state.showScores;
  syncScoresToPlateau();
});

function getCapitaleNote(baseName) {
  if (!baseName) return "Note introuvable.";
  const notes = state.capitalesNotesMode === "piquant"
    ? state.capitalesNotesSarcasme
    : state.capitalesNotesDefault;
  return notes?.[baseName] || "Note introuvable.";
}

function showCapitaleModal(fileName) {
  const modal = $("capitalesModal");
  if (!modal) return;
  state.capitalesLastFile = fileName;
  const baseName = String(fileName || "").replace(/\.png$/i, "");
  $("capitalesFileName").textContent = `${baseName}.png`;
  $("capitalesNote").textContent = getCapitaleNote(baseName);
  modal.classList.remove("hidden");
}

function refreshCapitaleModal() {
  const modal = $("capitalesModal");
  if (!modal || modal.classList.contains("hidden")) return;
  if (!state.capitalesLastFile) return;
  const baseName = String(state.capitalesLastFile || "").replace(/\.png$/i, "");
  $("capitalesFileName").textContent = `${baseName}.png`;
  $("capitalesNote").textContent = getCapitaleNote(baseName);
}

function hideCapitaleModal() {
  $("capitalesModal")?.classList.add("hidden");
}

function showCapitaleByFile(fileName) {
  if (!fileName) return;
  postToPlateau({ type: "SHOW_FLAG", src: `questions/capitales/${fileName}` });
  showCapitaleModal(fileName);
}

function getLeadingNumberFromFile(fileName) {
  const m = String(fileName || "").match(/^(\d+)/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  return Number.isNaN(num) ? null : num;
}

function findCapitaleFileByNumber(num) {
  if (!Array.isArray(state.capitalesFiles) || !state.capitalesFiles.length) {
    return `${num}.png`;
  }
  for (const file of state.capitalesFiles) {
    const n = getLeadingNumberFromFile(file);
    if (n === num) return file;
  }
  const direct = state.capitalesFiles.find((file) => file === `${num}.png`);
  return direct || `${num}.png`;
}

function sendCapitale() {
  const input = document.getElementById("capitalesInput");
  if (!input) return;
  const num = parseInt(String(input.value || "").trim(), 10);
  input.value = "";
  if (!Number.isInteger(num) || num < 1 || num > 254) {
    alert("Numero invalide. Entrez un nombre entre 1 et 254.");
    return;
  }
  const fileName = findCapitaleFileByNumber(num);
  showCapitaleByFile(fileName);
}

$("btnCapitalesSend")?.addEventListener("click", sendCapitale);
$("capitalesInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendCapitale();
});

async function loadMusicList() {
  const select = $("musicSelect");
  if (!select) return;
  select.innerHTML = "";
  const base = "questions/musique/";
  try {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    const dirs = links
      .filter((href) => href.endsWith("/") && href !== "../")
      .map((href) => decodeURIComponent(href.replace(/^\.\//, "")));
    for (const dir of dirs) {
      const resDir = await fetch(`${base}${dir}`, { cache: "no-store" });
      if (!resDir.ok) continue;
      const htmlDir = await resDir.text();
      const files = [...htmlDir.matchAll(/href="([^"]+\.(mp3|wav|ogg))"/gi)]
        .map((m) => decodeURIComponent(m[1].split("/").pop() || m[1]));
      if (!files.length) continue;
      const group = document.createElement("optgroup");
      group.label = dir.replace(/\/$/, "");
      files.forEach((file) => {
        const opt = document.createElement("option");
        opt.value = `${base}${dir}${file}`;
        opt.textContent = file.replace(/\.(mp3|wav|ogg)$/i, "");
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
  } catch {}
}

async function loadPlateauMusicList() {
  const select = $("plateauMusicSelect");
  if (!select) return;
  select.innerHTML = "";
  const base = "sounds/musique-plateau/";
  try {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const files = [...html.matchAll(/href="([^"]+\.(mp3|wav|ogg))"/gi)]
      .map((m) => decodeURIComponent(m[1].split("/").pop() || m[1]));
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choisir une musique";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    files.forEach((file) => {
      const opt = document.createElement("option");
      opt.value = `${base}${file}`;
      opt.textContent = file.replace(/\.(mp3|wav|ogg)$/i, "");
      select.appendChild(opt);
    });
  } catch {}
}

async function loadFilmsList() {
  const select = $("filmsSelect");
  if (!select) return;
  select.innerHTML = "";
  const base = "questions/films/";
  try {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    const filesAtRoot = links
      .filter((href) => /\.(mp3|wav|ogg)$/i.test(href))
      .map((href) => decodeURIComponent(href.split("/").pop() || href));
    filesAtRoot.forEach((file) => {
      const opt = document.createElement("option");
      opt.value = `${base}${file}`;
      opt.textContent = file.replace(/\.(mp3|wav|ogg)$/i, "");
      select.appendChild(opt);
    });
    const dirs = links
      .filter((href) => href.endsWith("/") && href !== "../")
      .map((href) => decodeURIComponent(href.replace(/^\.\//, "")));
    for (const dir of dirs) {
      const resDir = await fetch(`${base}${dir}`, { cache: "no-store" });
      if (!resDir.ok) continue;
      const htmlDir = await resDir.text();
      const files = [...htmlDir.matchAll(/href="([^"]+\.(mp3|wav|ogg))"/gi)]
        .map((m) => decodeURIComponent(m[1].split("/").pop() || m[1]));
      if (!files.length) continue;
      const group = document.createElement("optgroup");
      group.label = dir.replace(/\/$/, "");
      files.forEach((file) => {
        const opt = document.createElement("option");
        opt.value = `${base}${dir}${file}`;
        opt.textContent = file.replace(/\.(mp3|wav|ogg)$/i, "");
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
  } catch {}
}

function splitPeopleFileName(fileName) {
  const base = String(fileName || "").replace(/\.[^/.]+$/, "");
  const m = base.match(/^(.+?)\s*-\s*(.+)$/);
  if (m) {
    return { group: m[1].trim(), label: m[2].trim() };
  }
  return { group: "", label: base };
}

async function loadPeoplesList() {
  const select = $("peoplesSelect");
  if (!select) return;
  select.innerHTML = "";
  const base = "questions/peoples/";
  const entries = [];

  try {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    const filesAtRoot = links
      .filter((href) => /\.(png|jpe?g|webp|gif)$/i.test(href))
      .map((href) => decodeURIComponent(href.split("/").pop() || href));
    filesAtRoot.forEach((file) => {
      const { group, label } = splitPeopleFileName(file);
      entries.push({
        group: group || "Divers",
        label,
        value: `${base}${file}`
      });
    });

    const dirs = links
      .filter((href) => href.endsWith("/") && href !== "../")
      .map((href) => decodeURIComponent(href.replace(/^\.\//, "")));

    for (const dir of dirs) {
      const resDir = await fetch(`${base}${dir}`, { cache: "no-store" });
      if (!resDir.ok) continue;
      const htmlDir = await resDir.text();
      const files = [...htmlDir.matchAll(/href="([^"]+\.(png|jpe?g|webp|gif))"/gi)]
        .map((m) => decodeURIComponent(m[1].split("/").pop() || m[1]));
      if (!files.length) continue;
      const groupLabel = dir.replace(/\/$/, "");
      files.forEach((file) => {
        const { group, label } = splitPeopleFileName(file);
        entries.push({
          group: group || groupLabel || "Divers",
          label,
          value: `${base}${dir}${file}`
        });
      });
    }
  } catch {}

  if (!entries.length) return;
  entries.sort((a, b) => {
    const g = a.group.localeCompare(b.group, "fr", { sensitivity: "base" });
    if (g !== 0) return g;
    return a.label.localeCompare(b.label, "fr", { sensitivity: "base" });
  });

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Personnalites";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  let currentGroup = "";
  let currentOptgroup = null;
  entries.forEach((entry) => {
    if (entry.group !== currentGroup) {
      currentGroup = entry.group;
      currentOptgroup = document.createElement("optgroup");
      currentOptgroup.label = currentGroup || "Divers";
      select.appendChild(currentOptgroup);
    }
    const opt = document.createElement("option");
    opt.value = entry.value;
    opt.textContent = entry.label;
    currentOptgroup.appendChild(opt);
  });
}

async function loadCapitalesNotes() {
  try {
    const res = await fetch("questions/capitales/infos_pays.json", { cache: "no-store" });
    if (!res.ok) return;
    const notes = await res.json();
    if (notes && typeof notes === "object") {
      state.capitalesNotesDefault = notes;
    }
  } catch {}
  try {
    const res = await fetch("questions/capitales/infos_pays_sarcasme.json", { cache: "no-store" });
    if (!res.ok) return;
    const notes = await res.json();
    if (notes && typeof notes === "object") {
      state.capitalesNotesSarcasme = notes;
    }
  } catch {}
}

async function loadCapitalesList() {
  const select = $("capitalesSelect");
  if (!select) return;
  select.innerHTML = "";
  const base = "questions/capitales/";
  let files = [];
  try {
    const res = await fetch(base, { cache: "no-store" });
    if (res.ok) {
      const html = await res.text();
      files = [...html.matchAll(/href="([^"]+\.png)"/gi)]
        .map((m) => decodeURIComponent(m[1].split("/").pop() || m[1]));
    }
  } catch {}

  if (!files.length && state.capitalesNotes && Object.keys(state.capitalesNotes).length) {
    files = Object.keys(state.capitalesNotes).map((name) => `${name}.png`);
  }

  files = [...new Set(files)].sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));
  state.capitalesFiles = files;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pays";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  files.forEach((file) => {
    const opt = document.createElement("option");
    opt.value = file;
    opt.textContent = file.replace(/\.png$/i, "");
    select.appendChild(opt);
  });
}

$("capitalesSelect")?.addEventListener("change", (e) => {
  const fileName = e.target.value;
  if (fileName) {
    showCapitaleByFile(fileName);
    e.target.selectedIndex = 0;
  }
});

function setCapitalesTone(mode) {
  state.capitalesNotesMode = mode === "piquant" ? "piquant" : "doux";
  const isPiquant = state.capitalesNotesMode === "piquant";
  const btn = $("capitalesTone");
  if (btn) {
    btn.textContent = isPiquant ? "Piquant" : "Doux";
    btn.setAttribute("aria-pressed", String(isPiquant));
  }
  const modalBtn = $("capitalesModalTone");
  if (modalBtn) {
    modalBtn.textContent = isPiquant ? "Piquant" : "Doux";
    modalBtn.setAttribute("aria-pressed", String(isPiquant));
  }
  refreshCapitaleModal();
}

$("capitalesTone")?.addEventListener("click", () => {
  const next = state.capitalesNotesMode === "piquant" ? "doux" : "piquant";
  setCapitalesTone(next);
});

$("capitalesModalTone")?.addEventListener("click", () => {
  const next = state.capitalesNotesMode === "piquant" ? "doux" : "piquant";
  setCapitalesTone(next);
});

$("btnXMedia")?.addEventListener("click", () => {
  state.showScores = false;
  syncScoresToPlateau();
  postToPlateau({ type: "HIDE_MEDIA" });
  postToPlateau({ type: "STOP_MUSIC" });
});

$("btnSfxCorrect")?.addEventListener("click", () => {
  postToPlateau({ type: "PLAY_SFX", key: "correct" });
});

$("btnSfxFail")?.addEventListener("click", () => {
  postToPlateau({ type: "PLAY_SFX", key: "fail" });
});

$("musicSelect")?.addEventListener("change", (e) => {
  const value = e.target.value;
  if (value) {
    postToPlateau({ type: "PLAY_MUSIC", src: value });
  }
});

$("plateauMusicSelect")?.addEventListener("change", (e) => {
  const value = e.target.value;
  if (value) {
    postToPlateau({ type: "PLAY_PLATEAU_MUSIC", src: value });
  }
});

$("filmsSelect")?.addEventListener("change", (e) => {
  const value = e.target.value;
  if (value) {
    postToPlateau({ type: "PLAY_MUSIC", src: value });
  }
});

$("peoplesSelect")?.addEventListener("change", (e) => {
  const value = e.target.value;
  if (value) {
    const label = e.target.selectedOptions?.[0]?.textContent || "Personnalite";
    postToPlateau({ type: "SHOW_PEOPLE", src: value, alt: label });
    e.target.selectedIndex = 0;
  }
});

$("teamModalOk")?.addEventListener("click", () => {
  $("teamModal")?.classList.add("hidden");
});

$("teamModal")?.addEventListener("click", (e) => {
  if (e.target.id === "teamModal") {
    $("teamModal")?.classList.add("hidden");
  }
});

$("capitalesModalOk")?.addEventListener("click", hideCapitaleModal);
$("capitalesModal")?.addEventListener("click", (e) => {
  if (e.target.id === "capitalesModal") hideCapitaleModal();
});

$("addTeam")?.addEventListener("click", addTeam);
/* Lettre + Entrée */
$("letterInput").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const raw = $("letterInput").value.trim().toUpperCase();
  $("letterInput").value = "";

  // autorise lettres A-Z + lettres accentuées (même règle que plateau.js)
  if (!isSingleLetter(raw)) {
    alert("Merci de taper UNE lettre.");
    return;
  }

  if (state.grid) {
    for (const [pos, letter] of state.grid.letters) {
      if (letter === raw && !state.grid.revealed.get(pos) && (!isMagicWordCell(pos) || state.magicSolved)) {
        state.grid.revealed.set(pos, true);
      }
    }
    showNumbersForLetter(raw);
    renderRegieGrid();
  }

  postToPlateau({ type: "REVEAL_LETTER", letter: raw });
});

// Remplace le listener de saisie pour ajouter tirage auto + roue visuelle
overrideLetterInput();

function overrideLetterInput() {
  const old = $("letterInput");
  if (!old) return;
  const clone = old.cloneNode(true);
  old.parentNode.replaceChild(clone, old);

  clone.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const typed = clone.value.trim().toUpperCase();
    clone.value = "";

    let letter = typed;
    const valid = isSingleLetter(letter);

    if (!valid) {
      if (!state.grid) return;
      const remaining = [];
      for (const [pos, ltr] of state.grid.letters) {
        if (!state.grid.revealed.get(pos)) remaining.push(ltr);
      }
      if (!remaining.length) return;
      letter = remaining[Math.floor(Math.random() * remaining.length)];
      showRevealWheel(letter);
    }

    setLastRevealedLetter(letter);

    if (state.grid) {
      for (const [pos, ltr] of state.grid.letters) {
        if (ltr === letter && !state.grid.revealed.get(pos) && (!isMagicWordCell(pos) || state.magicSolved)) {
          state.grid.revealed.set(pos, true);
        }
      }
      showNumbersForLetter(letter);
      renderRegieGrid();
    }

    postToPlateau({ type: "REVEAL_LETTER", letter });
  });
}

function showRevealWheel(letter) {
  const existing = document.getElementById("revealWheel");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "revealWheel";
  overlay.className = "reveal-wheel";
  const wheel = document.createElement("div");
  wheel.className = "wheel";
  const label = document.createElement("div");
  label.className = "wheel-letter";
  label.textContent = letter;
  wheel.appendChild(label);
  overlay.appendChild(wheel);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 1600);
}

function setLastRevealedLetter(letter) {
  const el = document.getElementById("lastLetter");
  if (el) el.textContent = `Lettre : ${letter}`;
}

/* Correcte / Nop */
$("btnCorrect").addEventListener("click", () => {
  if (state.selectedWordId == null) return;
  stopSelectSound();
  const isMagic = state.selectedWordId === state.magicWordId;
  if (state.grid) {
    const word = state.grid.words[state.selectedWordId];
    if (word) {
      let gain = 0;
      if (isMagic) {
        gain = 10 + countRemainingLetters();
        state.magicSolved = true;
        state.grid.magicSolved = true;
        for (const [pos] of state.grid.letters) {
          state.grid.revealed.set(pos, true);
        }
      } else {
        gain = word.cells.length * state.multiplier;
        for (const p of word.cells) {
          const pos = `${p.r},${p.c}`;
          if (!isMagicWordCell(pos) || state.magicSolved) {
            state.grid.revealed.set(pos, true);
          }
        }
      }
      // points pour l'equipe selectionnee
      if (state.currentTeamId) {
        const team = state.teams.find(t => t.id === state.currentTeamId);
        if (team) {
          if (state.badPointsActive) {
            state.pendingPenaltyPoints = gain;
          } else {
            team.points = (team.points ?? 0) + gain;
          }
          renderTeams();
        }
      }
      clearVisibleNumbers();
      renderRegieGrid();
    }
  }
  postToPlateau({ type: isMagic ? "CORRECT_MAGIC_WORD" : "CORRECT_WORD", wordId: state.selectedWordId });
  state.selectedWordId = null;
  state.currentTeamId = null;
  setMultiplier(1);
  setBadPointsActive(false);
  renderTeams();
  updateSelectedInfo();
  updateMagicButtonState();
  setActionButtonsEnabled(false);
});

// Stoppe la musique de révélation au moindre clic sur la régie
window.addEventListener("click", (e) => {
  postToPlateau({ type: "STOP_REVEAL_SOUND" });
  if (state.pendingPenaltyPoints > 0) {
    const onTeam = e.target.closest && e.target.closest(".team-square");
    if (!onTeam) {
      alert("Choisis l'equipe a penaliser.");
    }
  }
}, true);

$("btnNop").addEventListener("click", () => {
  // Safety: if no word is selected, do nothing.
  const wordId = state.selectedWordId;
  if (wordId == null) return;

  stopSelectSound();

  // Send to plateau first (plateau handles audio duck/pause/restore).
  postToPlateau({ type: "NOP_WORD", wordId });

  // Reset regie state just like other actions.
  state.selectedWordId = null;
  state.currentTeamId = null;
  clearVisibleNumbers();
  renderRegieGrid();
  setMultiplier(1);
  setBadPointsActive(false);
  state.pendingPenaltyPoints = 0;
  renderTeams();
  updateSelectedInfo();
  updateMagicButtonState();
  setActionButtonsEnabled(false);
});

// Multiplicateurs (x2 / x3) pour le prochain mot
$("btnDouble")?.addEventListener("click", () => {
  const next = state.multiplier === 2 ? 1 : 2;
  setMultiplier(next);
  if (next === 2) {
    postToPlateau({ type: "PLAY_DOUBLE" });
  }
});

$("btnTriple")?.addEventListener("click", () => {
  const next = state.multiplier === 3 ? 1 : 3;
  setMultiplier(next);
  if (next === 3) {
    postToPlateau({ type: "PLAY_TRIPLE" });
  }
});

setMultiplier(1, true);
setBadPointsActive(false);

/* ============================================================
   Messages reçus du plateau
   ============================================================ */
window.addEventListener("message", (ev) => {
  const msg = ev.data;
  if (!msg || !msg.type) return;

  if (msg.type === "PLATEAU_READY") {
    if (ev.source) {
      state.plateauWin = ev.source;
    }
    setPlateauLabel();
    setFullscreenEnabled(true);
    setActionButtonsEnabled(false);

    // Renvoie la grille courante si déjà chargée
    if (state.grid) {
      postToPlateau({ type: "LOAD_GRID", grid: serializeGridForPlateau(state.grid) });
    }
    syncScoresToPlateau();
    return;
  }

  if (msg.type === "PLATEAU_CLOSED") {
    setPlateauLabel();
    setFullscreenEnabled(false);
    setActionButtonsEnabled(false);
    return;
  }

  if (msg.type === "WORD_SELECTED") {
    // wordId peut être null
    state.selectedWordId = msg.wordId ?? null;
    if (state.selectedWordId == null) {
      clearVisibleNumbers();
    } else {
      const w = state.grid?.words?.[state.selectedWordId];
      clearVisibleNumbers();
      if (w?.numberPos) state.visibleNumbers.add(keyPos(w.numberPos));
    }
    updateSelectedInfo();
    updateMagicButtonState();

    const enabled = state.selectedWordId != null;
    setActionButtonsEnabled(enabled);
    renderRegieGrid();
    return;
  }
});

/* ============================================================
   Init
   ============================================================ */
(async function init() {
  try {
    await loadGridList();
    await loadCapitalesNotes();
    await loadCapitalesList();
    await loadMusicList();
    await loadPlateauMusicList();
    await loadFilmsList();
    await loadPeoplesList();
    await loadSelectedGrid();
    renderTeams();
    setPlateauLabel();
    setFullscreenEnabled(false);
    $("letterInput").focus();
  } catch (err) {
    console.error(err);
    alert(String(err?.message ?? err));
  }
})();
