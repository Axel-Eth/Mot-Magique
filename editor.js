/* ============================================================
   A vos mots ! - editor.js
   Editeur de grille locale (JSON/localStorage)
   ============================================================ */

const STORAGE_KEY = "avm_custom_grids";
const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 14;
const LETTER_REGEX = /^\p{L}$/u;

const $ = (id) => document.getElementById(id);

const state = {
  id: null,
  name: "",
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  letters: {},
  numbers: {},
  magic: {},
  magicWordKey: null,
  definitions: {},
  selectedCell: null,
  wordSelection: null,
  selectionCells: [],
  orientation: "H", // H or V
  clipboard: null   // {rows, cols, data: { "r,c": {letter?, number?} }}
};

const undoStack = [];
const UNDO_LIMIT = 200;

function key(r, c) {
  return `${r},${c}`;
}

function isSingleLetter(value) {
  return LETTER_REGEX.test(String(value || ""));
}

function setStatus(msg) {
  $("statusMsg").textContent = msg;
}

function loadAllGrids() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAllGrids(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function refreshGridList() {
  const sel = $("gridList");
  const list = loadAllGrids();
  sel.innerHTML = "";

  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "--";
  sel.appendChild(optEmpty);

  for (const g of list) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name || g.id;
    sel.appendChild(opt);
  }
}

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

async function loadGridFilesList() {
  const entries = [];
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
        if (!decoded || decoded === "../") continue;
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

  const dedup = new Map();
  for (const e of entries) {
    if (!dedup.has(e.file)) dedup.set(e.file, e);
  }
  return [...dedup.values()].sort((a, b) => {
    const ga = a.group || "";
    const gb = b.group || "";
    const g = ga.localeCompare(gb, "fr", { sensitivity: "base" });
    if (g !== 0) return g;
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
}

function rebuildGridFileSelect(list) {
  const sel = $("gridFileSelect");
  if (!sel) return;
  sel.innerHTML = "";
  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "--";
  sel.appendChild(optEmpty);

  let currentGroup = "";
  let currentOptgroup = null;
  (list || []).forEach((g) => {
    if (!g || !g.name || !g.file) return;
    const group = g.group || "Racine";
    if (group !== currentGroup) {
      currentGroup = group;
      currentOptgroup = document.createElement("optgroup");
      currentOptgroup.label = currentGroup;
      sel.appendChild(currentOptgroup);
    }
    const opt = document.createElement("option");
    opt.value = g.file;
    opt.textContent = g.name;
    currentOptgroup.appendChild(opt);
  });
}

function clearSelection() {
  state.selectedCell = null;
  state.wordSelection = null;
  $("selectionInfo").textContent = "-";
  $("definitionInput").value = "";
  updateMagicWordUI();
}

function buildGridDOM() {
  const gridEl = $("editorGrid");
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateRows = `repeat(${state.rows}, var(--cell))`;
  gridEl.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell))`;

  const selected = state.selectedCell ? key(state.selectedCell.r, state.selectedCell.c) : null;
  const wordCells = new Set(
    (state.wordSelection ? state.wordSelection.cells : []).map((p) => key(p.r, p.c))
  );
  const selectionSet = new Set(state.selectionCells.map((p) => key(p.r, p.c)));
  const magicWordCells = new Set(getWordCellsFromKey(state.magicWordKey).map((p) => key(p.r, p.c)));

  for (let r = 1; r <= state.rows; r++) {
    for (let c = 1; c <= state.cols; c++) {
      const pos = key(r, c);
      const cell = document.createElement("div");
      cell.className = "cell editor-cell";
      cell.dataset.pos = pos;
      const letter = state.letters[pos] || "";
      const number = state.numbers[pos];

      if (letter) {
        cell.textContent = letter;
        cell.classList.add("has-letter");
        if (state.magic[pos] || magicWordCells.has(pos)) {
          cell.classList.add("magic");
        }
      } else if (number != null) {
        cell.textContent = number;
        cell.classList.add("number");
      } else {
        cell.classList.add("editor-empty");
      }

      if (selected === pos) {
        cell.classList.add("selected");
      }

      if (wordCells.has(pos)) {
        cell.classList.add("in-word");
      }

       if (selectionSet.has(pos)) {
         cell.classList.add("in-selection");
       }

      cell.addEventListener("click", (e) => onCellClick(e, r, c));
      cell.addEventListener("dblclick", (e) => onCellDoubleClick(e, r, c));
      gridEl.appendChild(cell);
    }
  }

  updateSelectionLabel();
  updateMagicWordUI();
}

function selectionLabel() {
  if (state.wordSelection) {
    const w = state.wordSelection;
    return `${w.orientation} ${w.cells.length} lettres (${w.start.r},${w.start.c})`;
  }
  if (state.selectionCells.length > 1) {
    const rMin = Math.min(...state.selectionCells.map((p) => p.r));
    const rMax = Math.max(...state.selectionCells.map((p) => p.r));
    const cMin = Math.min(...state.selectionCells.map((p) => p.c));
    const cMax = Math.max(...state.selectionCells.map((p) => p.c));
    return `Bloc ${state.selectionCells.length} cases (${rMin},${cMin}) -> (${rMax},${cMax})`;
  }
  if (state.selectedCell) return `Case ${state.selectedCell.r},${state.selectedCell.c}`;
  return "-";
}

function updateSelectionLabel() {
  $("selectionInfo").textContent = selectionLabel();
}

function parseMagicWordKey() {
  if (!state.magicWordKey) return null;
  const [orientation, start] = String(state.magicWordKey).split(":");
  if (!orientation || !start) return null;
  const [r, c] = start.split(",").map(Number);
  if (!r || !c) return null;
  return { orientation, start: { r, c } };
}

function getWordCellsFromKey(wordKey) {
  if (!wordKey) return [];
  const [orientation, start] = String(wordKey).split(":");
  if (!orientation || !start) return [];
  const [r, c] = start.split(",").map(Number);
  if (!r || !c) return [];
  const cells = [];
  if (!state.letters[key(r, c)]) return [];
  if (orientation === "H") {
    for (let col = c; col <= state.cols; col++) {
      const pos = key(r, col);
      if (!state.letters[pos]) break;
      cells.push({ r, c: col });
    }
  } else {
    for (let row = r; row <= state.rows; row++) {
      const pos = key(row, c);
      if (!state.letters[pos]) break;
      cells.push({ r: row, c });
    }
  }
  return cells;
}

function updateMagicWordUI() {
  const info = $("magicWordInfo");
  const btnSet = $("setMagicWord");
  const btnClear = $("clearMagicWord");
  const magicCells = getWordCellsFromKey(state.magicWordKey);
  if (info) {
    if (!state.magicWordKey || magicCells.length < 2) {
      info.textContent = "-";
    } else {
      const parsed = parseMagicWordKey();
      info.textContent = `${parsed.orientation} ${magicCells.length} lettres (${parsed.start.r},${parsed.start.c})`;
    }
  }
  if (btnSet) {
    btnSet.disabled = !state.wordSelection;
    const isMagic = state.wordSelection
      ? `${state.wordSelection.orientation}:${state.wordSelection.start.r},${state.wordSelection.start.c}` === state.magicWordKey
      : false;
    btnSet.classList.toggle("active", isMagic);
  }
  if (btnClear) {
    btnClear.disabled = !state.magicWordKey;
  }
}

function snapshotState() {
  return {
    letters: { ...state.letters },
    numbers: { ...state.numbers },
    magic: { ...state.magic },
    magicWordKey: state.magicWordKey,
    definitions: { ...state.definitions },
    selectedCell: state.selectedCell ? { ...state.selectedCell } : null,
    selectionCells: state.selectionCells.map((p) => ({ ...p })),
    wordSelection: state.wordSelection
      ? {
          orientation: state.wordSelection.orientation,
          cells: state.wordSelection.cells.map((p) => ({ ...p })),
          start: { ...state.wordSelection.start }
        }
      : null,
    orientation: state.orientation
  };
}

function pushUndo() {
  undoStack.push(snapshotState());
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function restoreSnapshot(snap) {
  state.letters = { ...snap.letters };
  state.numbers = { ...snap.numbers };
  state.magic = { ...snap.magic };
  state.magicWordKey = snap.magicWordKey || null;
  state.definitions = { ...snap.definitions };
  state.selectedCell = snap.selectedCell ? { ...snap.selectedCell } : null;
  state.selectionCells = snap.selectionCells.map((p) => ({ ...p }));
  state.wordSelection = snap.wordSelection
    ? {
        orientation: snap.wordSelection.orientation,
        cells: snap.wordSelection.cells.map((p) => ({ ...p })),
        start: { ...snap.wordSelection.start }
      }
    : null;
  state.orientation = snap.orientation || "H";
  $("orientationToggle").textContent = `Orientation: ${state.orientation === "H" ? "Horizontal" : "Vertical"}`;
  buildGridDOM();
  updateSelectionLabel();
  updateMagicWordUI();
}

function undo() {
  const snap = undoStack.pop();
  if (!snap) {
    setStatus("Rien à annuler.");
    return;
  }
  restoreSnapshot(snap);
  setStatus("Annulé.");
}

function onCellClick(e, r, c) {
  if (e.shiftKey && state.selectedCell) {
    const start = state.selectedCell;
    // mot (ligne ou colonne)
    if (start.r === r || start.c === c) {
      selectWord(start, { r, c }, start.r === r ? "H" : "V");
      state.selectionCells = [...(state.wordSelection ? state.wordSelection.cells : [])];
      return;
    }
    // bloc rectangulaire pour copier/coller
    selectBlock(start, { r, c });
    return;
  }

  state.selectedCell = { r, c };
  state.wordSelection = null;
  state.selectionCells = [];
  $("definitionInput").value = "";
  $("selectionInfo").textContent = `Case ${r},${c}`;
  buildGridDOM();
}

function onCellDoubleClick(e, r, c) {
  e.preventDefault();
  const pos = key(r, c);
  if (!state.letters[pos]) return;
  pushUndo();
  if (state.magic[pos]) {
    delete state.magic[pos];
  } else {
    state.magic[pos] = true;
  }
  buildGridDOM();
}

function selectBlock(a, b) {
  const rMin = Math.min(a.r, b.r);
  const rMax = Math.max(a.r, b.r);
  const cMin = Math.min(a.c, b.c);
  const cMax = Math.max(a.c, b.c);

  const cells = [];
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      cells.push({ r, c });
    }
  }
  state.wordSelection = null;
  state.selectionCells = cells;
  $("definitionInput").value = "";
  $("selectionInfo").textContent = `Bloc ${cells.length} cases (${rMin},${cMin}) -> (${rMax},${cMax})`;
  buildGridDOM();
}

function selectWord(a, b, orientation) {
  const cells = [];
  const rMin = Math.min(a.r, b.r);
  const rMax = Math.max(a.r, b.r);
  const cMin = Math.min(a.c, b.c);
  const cMax = Math.max(a.c, b.c);

  if (orientation === "H") {
    for (let c = cMin; c <= cMax; c++) cells.push({ r: a.r, c });
  } else {
    for (let r = rMin; r <= rMax; r++) cells.push({ r, c: a.c });
  }

  const hasEmpty = cells.some((p) => !state.letters[key(p.r, p.c)]);
  if (hasEmpty) {
    setStatus("Remplis les lettres du mot avant de definir.");
    return;
  }

  const start = orientation === "H" ? { r: a.r, c: cMin } : { r: rMin, c: a.c };
  const defKey = `${orientation}:${start.r},${start.c}`;
  const def = state.definitions[defKey] || "";

  state.wordSelection = { orientation, cells, start };
  state.selectionCells = cells;
  $("selectionInfo").textContent = `${orientation} ${cells.length} lettres (${start.r},${start.c})`;
  $("definitionInput").value = def;
  buildGridDOM();
}

function normalizeName(name) {
  const trimmed = name.trim();
  return trimmed || "Grille sans nom";
}

function saveCurrentGrid() {
  const list = loadAllGrids();
  const entry = {
    id: state.id || `grid_${Date.now()}`,
    name: normalizeName($("gridName").value),
    rows: state.rows,
    cols: state.cols,
    letters: state.letters,
    numbers: state.numbers,
    magic: state.magic,
    magicWordKey: state.magicWordKey,
    definitions: state.definitions
  };

  const idx = list.findIndex((g) => g.id === entry.id);
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }

  saveAllGrids(list);
  state.id = entry.id;
  setStatus("Grille sauvegardee (local).");
  refreshGridList();
}

function loadGridById(id) {
  const list = loadAllGrids();
  const g = list.find((x) => x.id === id);
  if (!g) return;

  undoStack.length = 0;
  state.id = g.id;
  state.name = g.name || "";
  state.rows = g.rows || DEFAULT_ROWS;
  state.cols = g.cols || DEFAULT_COLS;
  state.letters = g.letters || {};
  state.numbers = g.numbers || {};
  state.magic = g.magic || {};
  state.magicWordKey = g.magicWordKey || null;
  state.definitions = g.definitions || {};
  state.selectedCell = null;
  state.wordSelection = null;

  $("gridName").value = state.name;
  $("gridRows").value = state.rows;
  $("gridCols").value = state.cols;
  $("selectionInfo").textContent = "-";
  $("definitionInput").value = "";
  buildGridDOM();
  setStatus("Grille chargee.");
}

function deleteGridById(id) {
  if (!id) return;
  const list = loadAllGrids();
  let removed = false;
  const next = [];
  for (const g of list) {
    if (!removed && g.id === id) {
      removed = true;
      continue;
    }
    next.push(g);
  }
  if (!removed) {
    setStatus("Grille introuvable.");
    return;
  }
  saveAllGrids(next);
  if (state.id === id) {
    resetGrid();
  }
  refreshGridList();
  setStatus("Grille supprimee.");
}

function resetGrid() {
  undoStack.length = 0;
  state.id = null;
  state.name = "";
  state.rows = DEFAULT_ROWS;
  state.cols = DEFAULT_COLS;
  state.letters = {};
  state.numbers = {};
  state.magic = {};
  state.magicWordKey = null;
  state.definitions = {};
  clearSelection();
  $("gridName").value = "";
  $("gridRows").value = state.rows;
  $("gridCols").value = state.cols;
  buildGridDOM();
}

function applySize() {
  const rows = Math.max(3, Math.min(30, parseInt($("gridRows").value, 10) || DEFAULT_ROWS));
  const cols = Math.max(3, Math.min(30, parseInt($("gridCols").value, 10) || DEFAULT_COLS));

  state.rows = rows;
  state.cols = cols;

  const nextLetters = {};
  const nextNumbers = {};
  for (const [pos, letter] of Object.entries(state.letters)) {
    const [r, c] = pos.split(",").map(Number);
    if (r <= rows && c <= cols) nextLetters[pos] = letter;
  }
  for (const [pos, num] of Object.entries(state.numbers)) {
    const [r, c] = pos.split(",").map(Number);
    if (r <= rows && c <= cols) nextNumbers[pos] = num;
  }
  state.letters = nextLetters;
  state.numbers = nextNumbers;

  const nextDefs = {};
  for (const [k, v] of Object.entries(state.definitions)) {
    const [, rc] = k.split(":");
    const [r, c] = rc.split(",").map(Number);
    if (r <= rows && c <= cols) nextDefs[k] = v;
  }
  state.definitions = nextDefs;

  const nextMagic = {};
  for (const [pos, val] of Object.entries(state.magic)) {
    const [r, c] = pos.split(",").map(Number);
    if (r <= rows && c <= cols && val) nextMagic[pos] = true;
  }
  state.magic = nextMagic;
  const magicParsed = parseMagicWordKey();
  if (magicParsed) {
    if (magicParsed.start.r > rows || magicParsed.start.c > cols) {
      state.magicWordKey = null;
    } else if (getWordCellsFromKey(state.magicWordKey).length < 2) {
      state.magicWordKey = null;
    }
  }

  clearSelection();
  buildGridDOM();
  setStatus("Taille appliquee.");
}

function exportCurrentGrid() {
  const entry = {
    id: state.id || `grid_${Date.now()}`,
    name: normalizeName($("gridName").value),
    rows: state.rows,
    cols: state.cols,
    letters: state.letters,
    numbers: state.numbers,
    magic: state.magic,
    magicWordKey: state.magicWordKey,
    definitions: state.definitions
  };

  const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.name.replace(/\s+/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("Export JSON termine.");
}

function importGridFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !data.rows || !data.cols || !data.letters) {
          throw new Error("Format invalide.");
        }
      const entry = {
        id: data.id || `grid_${Date.now()}`,
        name: data.name || "Grille importee",
        rows: data.rows,
        cols: data.cols,
        letters: data.letters || {},
        numbers: data.numbers || {},
        magic: data.magic || {},
        magicWordKey: data.magicWordKey || null,
        definitions: data.definitions || {}
      };
        const list = loadAllGrids();
        list.push(entry);
        saveAllGrids(list);
        resolve(entry);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function importMultiple(files) {
  if (!files || !files.length) return;
  const arr = Array.from(files);
  try {
    const results = await Promise.all(arr.map((f) => importGridFile(f)));
    refreshGridList();
    setStatus(`Import termine (${results.length} grille${results.length > 1 ? "s" : ""}).`);
  } catch (err) {
    setStatus(`Import impossible: ${err.message}`);
  }
}

function getCell(ws, r1, c1) {
  return ws[XLSX.utils.encode_cell({ r: r1 - 1, c: c1 - 1 })];
}

function getComment(ws, r1, c1) {
  const cell = getCell(ws, r1, c1);
  if (!cell) return "-";
  const c = cell.c;
  if (Array.isArray(c) && c.length) {
    const t = (c[0].t ?? c[0].text ?? "-").toString().trim();
    return t;
  }
  return "-";
}

function buildWordData(lettersMap, numbersMap, bounds, getDefinitionForWord) {
  const { minRow, maxRow, minCol, maxCol } = bounds;
  const words = [];

  function addWord(cells, orientation) {
    const id = words.length;
    const first = cells[0];
    let number = null;
    let numberPos = null;

    if (orientation === "H") {
      const pos = key(first.r, first.c - 1);
      if (numbersMap.has(pos)) {
        number = numbersMap.get(pos);
        numberPos = { r: first.r, c: first.c - 1 };
      }
    } else {
      const pos = key(first.r - 1, first.c);
      if (numbersMap.has(pos)) {
        number = numbersMap.get(pos);
        numberPos = { r: first.r - 1, c: first.c };
      }
    }

    const def = getDefinitionForWord(first, orientation, numberPos);
    words.push({ id, cells, orientation, number, numberPos, definition: def });
  }

  for (let r = minRow; r <= maxRow; r++) {
    let c = minCol;
    while (c <= maxCol) {
      if (lettersMap.has(key(r, c))) {
        const cells = [{ r, c }];
        c++;
        while (c <= maxCol && lettersMap.has(key(r, c))) {
          cells.push({ r, c });
          c++;
        }
        if (cells.length > 1) addWord(cells, "H");
      }
      c++;
    }
  }

  for (let c = minCol; c <= maxCol; c++) {
    let r = minRow;
    while (r <= maxRow) {
      if (lettersMap.has(key(r, c))) {
        const cells = [{ r, c }];
        r++;
        while (r <= maxRow && lettersMap.has(key(r, c))) {
          cells.push({ r, c });
          r++;
        }
        if (cells.length > 1) addWord(cells, "V");
      }
      r++;
    }
  }

  return words;
}

async function parseJsonFileGrid(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("JSON: chargement impossible.");
  const data = await res.json();
  if (!data || !data.rows || !data.cols || !data.letters) {
    throw new Error("JSON: format invalide.");
  }
  return {
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
}

async function parseXlsxFileGrid(url) {
  const buf = await (await fetch(url, { cache: "no-store" })).arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellComments: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("XLSX: aucune feuille trouvee.");

  const letters = {};
  const numbers = {};
  const lettersMap = new Map();
  const numbersMap = new Map();
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
          const pos = key(r, c);
          letters[pos] = L;
          lettersMap.set(pos, L);
          used.push([r, c]);
        }
        continue;
      }

      const val = Number(v);
      if (!Number.isNaN(val)) {
        const pos = key(r, c);
        numbers[pos] = val;
        numbersMap.set(pos, val);
        used.push([r, c]);
      }
    }
  }

  if (!used.length) {
    throw new Error("XLSX: aucune cellule exploitable.");
  }

  const rowsUsed = used.map(([r]) => r);
  const colsUsed = used.map(([, c]) => c);
  const minRow = Math.min(...rowsUsed);
  const maxRow = Math.max(...rowsUsed);
  const minCol = Math.min(...colsUsed);
  const maxCol = Math.max(...colsUsed);

  const bounds = { minRow, maxRow, minCol, maxCol };
  const words = buildWordData(lettersMap, numbersMap, bounds, (first, orientation, numberPos) => {
    let def = "-";
    if (numberPos) def = getComment(ws, numberPos.r, numberPos.c);
    if (!def) def = getComment(ws, first.r, first.c);
    if (!def) def = "(Pas de definition renseignee.)";
    return def;
  });

  const definitions = {};
  words.forEach((w) => {
    const start = w.cells[0];
    const keyId = `${w.orientation}:${start.r},${start.c}`;
    definitions[keyId] = w.definition || "";
  });

  return {
    id: `file_${Date.now()}`,
    name: url.split("/").pop()?.replace(/\.(xlsx|json)$/i, "") || "Grille XLSX",
    rows: maxRow,
    cols: maxCol,
    letters,
    numbers,
    magic: {},
    magicWordKey: null,
    definitions
  };
}

function loadGridFromEntry(entry, statusLabel = "Grille chargee.") {
  if (!entry) return;
  undoStack.length = 0;
  state.id = entry.id || null;
  state.name = entry.name || "";
  state.rows = entry.rows || DEFAULT_ROWS;
  state.cols = entry.cols || DEFAULT_COLS;
  state.letters = entry.letters || {};
  state.numbers = entry.numbers || {};
  state.magic = entry.magic || {};
  state.magicWordKey = entry.magicWordKey || null;
  state.definitions = entry.definitions || {};
  state.selectedCell = null;
  state.wordSelection = null;
  state.selectionCells = [];

  $("gridName").value = state.name;
  $("gridRows").value = state.rows;
  $("gridCols").value = state.cols;
  $("selectionInfo").textContent = "-";
  $("definitionInput").value = "";
  buildGridDOM();
  setStatus(statusLabel);
}

async function loadGridFromFile(url) {
  if (!url) return;
  try {
    const entry = /\.json$/i.test(url)
      ? await parseJsonFileGrid(url)
      : await parseXlsxFileGrid(url);
    loadGridFromEntry(entry, "Grille chargee depuis /grids.");
  } catch (err) {
    setStatus(`Chargement impossible: ${err.message}`);
  }
}

function saveDefinition() {
  if (!state.wordSelection) {
    setStatus("Selectionne un mot.");
    return;
  }
  const defText = $("definitionInput").value.trim();
  const keyId = `${state.wordSelection.orientation}:${state.wordSelection.start.r},${state.wordSelection.start.c}`;
  state.definitions[keyId] = defText || "";
  setStatus("Definition sauvegardee.");
}

function clearDefinition() {
  if (!state.wordSelection) return;
  const keyId = `${state.wordSelection.orientation}:${state.wordSelection.start.r},${state.wordSelection.start.c}`;
  delete state.definitions[keyId];
  $("definitionInput").value = "";
  setStatus("Definition effacee.");
}

function setMagicWordFromSelection() {
  if (!state.wordSelection) {
    setStatus("Selectionne un mot.");
    return;
  }
  pushUndo();
  const keyId = `${state.wordSelection.orientation}:${state.wordSelection.start.r},${state.wordSelection.start.c}`;
  state.magicWordKey = keyId;
  buildGridDOM();
  setStatus("Mot magique defini.");
}

function clearMagicWord() {
  if (!state.magicWordKey) return;
  pushUndo();
  state.magicWordKey = null;
  buildGridDOM();
  setStatus("Mot magique retire.");
}

function toggleOrientation() {
  state.orientation = state.orientation === "H" ? "V" : "H";
  $("orientationToggle").textContent = `Orientation: ${state.orientation === "H" ? "Horizontal" : "Vertical"}`;
  setStatus(`Orientation ${state.orientation === "H" ? "horizontal" : "vertical"}.`);
}

function moveSelection(step = 1) {
  if (!state.selectedCell) return;
  const delta = state.orientation === "H" ? { r: 0, c: step } : { r: step, c: 0 };
  const nr = state.selectedCell.r + delta.r;
  const nc = state.selectedCell.c + delta.c;
  if (nr < 1 || nc < 1 || nr > state.rows || nc > state.cols) return;
  state.selectedCell = { r: nr, c: nc };
  state.wordSelection = null;
  state.selectionCells = [];
  $("selectionInfo").textContent = `Case ${nr},${nc}`;
  buildGridDOM();
}

function moveBy(dr, dc) {
  if (!state.selectedCell) return;
  const nr = state.selectedCell.r + dr;
  const nc = state.selectedCell.c + dc;
  if (nr < 1 || nc < 1 || nr > state.rows || nc > state.cols) return;
  state.selectedCell = { r: nr, c: nc };
  state.wordSelection = null;
  state.selectionCells = [];
  $("selectionInfo").textContent = `Case ${nr},${nc}`;
  buildGridDOM();
}

function copySelection() {
  const cells =
    state.selectionCells.length
      ? state.selectionCells
      : state.wordSelection
      ? state.wordSelection.cells
      : state.selectedCell
      ? [state.selectedCell]
      : [];
  if (!cells.length) {
    setStatus("Rien a copier (Shift+clic pour selectionner).");
    return;
  }
  const rMin = Math.min(...cells.map((p) => p.r));
  const cMin = Math.min(...cells.map((p) => p.c));
  const data = {};
  for (const p of cells) {
    const posKey = key(p.r, p.c);
    const letter = state.letters[posKey];
    const number = state.numbers[posKey];
    if (letter || number != null) {
      const rel = `${p.r - rMin},${p.c - cMin}`;
      data[rel] = { letter: letter || null, number: number ?? null, magic: !!state.magic[posKey] };
    }
  }
  state.clipboard = {
    rows: Math.max(...cells.map((p) => p.r)) - rMin + 1,
    cols: Math.max(...cells.map((p) => p.c)) - cMin + 1,
    data
  };
  setStatus(`Copie: ${Object.keys(data).length} case(s).`);
}

function clearCells(cells) {
  for (const p of cells) {
    const kPos = key(p.r, p.c);
    delete state.letters[kPos];
    delete state.numbers[kPos];
    delete state.magic[kPos];
  }
}

function cutSelection() {
  const cells =
    state.selectionCells.length
      ? state.selectionCells
      : state.wordSelection
      ? state.wordSelection.cells
      : state.selectedCell
      ? [state.selectedCell]
      : [];
  if (!cells.length) {
    setStatus("Rien a couper.");
    return;
  }
  pushUndo();
  copySelection();
  clearCells(cells);
  buildGridDOM();
  setStatus("Coupe effectuee.");
}

function pasteSelection() {
  if (!state.clipboard) {
    setStatus("Presse-papiers vide.");
    return;
  }
  if (!state.selectedCell) {
    setStatus("Clique une case de destination.");
    return;
  }
  const baseR = state.selectedCell.r;
  const baseC = state.selectedCell.c;
  const { rows, cols, data } = state.clipboard;
  if (baseR + rows - 1 > state.rows || baseC + cols - 1 > state.cols) {
    setStatus("Collage hors de la grille.");
    return;
  }
  pushUndo();
  for (const [rel, payload] of Object.entries(data)) {
    const [dr, dc] = rel.split(",").map(Number);
    const r = baseR + dr;
    const c = baseC + dc;
    const pos = key(r, c);
    const letter = payload?.letter || "";
    const number = payload?.number;
    delete state.letters[pos];
    delete state.numbers[pos];
    delete state.magic[pos];
    if (letter) {
      state.letters[pos] = letter;
      if (payload?.magic) state.magic[pos] = true;
    } else if (number != null) {
      state.numbers[pos] = number;
    }
  }
  buildGridDOM();
  setStatus("Collage effectue.");
}

function selectAllCells() {
  const cells = [];
  for (let r = 1; r <= state.rows; r++) {
    for (let c = 1; c <= state.cols; c++) {
      cells.push({ r, c });
    }
  }
  state.selectionCells = cells;
  state.wordSelection = null;
  state.selectedCell = { r: 1, c: 1 };
  $("selectionInfo").textContent = `Bloc ${cells.length} cases (1,1) -> (${state.rows},${state.cols})`;
  buildGridDOM();
}

function onKeydown(e) {
  const target = e.target;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === "c") {
      copySelection();
      e.preventDefault();
      return;
    }
    if (k === "x") {
      cutSelection();
      e.preventDefault();
      return;
    }
    if (k === "v") {
      pasteSelection();
      e.preventDefault();
      return;
    }
    if (e.code === "Space") {
      toggleOrientation();
      e.preventDefault();
      return;
    }
    if (k === "a") {
      selectAllCells();
      e.preventDefault();
      return;
    }
    if (k === "z") {
      undo();
      e.preventDefault();
      return;
    }
  }

  if (e.key === "ArrowUp") {
    moveBy(-1, 0);
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowDown") {
    moveBy(1, 0);
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowLeft") {
    moveBy(0, -1);
    e.preventDefault();
    return;
  }
  if (e.key === "ArrowRight") {
    moveBy(0, 1);
    e.preventDefault();
    return;
  }

  if (!state.selectedCell) return;
  const pos = key(state.selectedCell.r, state.selectedCell.c);

  if (e.key === "Backspace" || e.key === "Delete") {
    const selectedCells =
      state.selectionCells.length
        ? state.selectionCells
        : state.wordSelection
        ? state.wordSelection.cells
        : [state.selectedCell];

    if (selectedCells.length > 1) {
      pushUndo();
      clearCells(selectedCells);
      state.selectionCells = [];
      state.wordSelection = null;
      buildGridDOM();
      e.preventDefault();
      return;
    }

    pushUndo();
    delete state.letters[pos];
    delete state.numbers[pos];
    delete state.magic[pos];
    moveSelection(-1);
    buildGridDOM();
    e.preventDefault();
    return;
  }

  if (isSingleLetter(e.key)) {
    pushUndo();
    delete state.numbers[pos];
    state.letters[pos] = e.key.toUpperCase();
    moveSelection(1);
    buildGridDOM();
    return;
  }

  if (/^[0-9]$/.test(e.key)) {
    pushUndo();
    const current = state.numbers[pos] != null ? String(state.numbers[pos]) : "";
    const nextStr = current.length >= 2 ? e.key : current + e.key;
    const val = parseInt(nextStr, 10);
    if (val > 0 && val <= 99) {
      delete state.letters[pos];
      delete state.magic[pos];
      state.numbers[pos] = val;
      moveSelection(1);
      buildGridDOM();
    } else {
      // valeur hors plage : on ignore
      undoStack.pop(); // annule le pushUndo inutile
    }
    e.preventDefault();
  }
}

function init() {
  $("gridRows").value = state.rows;
  $("gridCols").value = state.cols;
  refreshGridList();
  loadGridFilesList().then((list) => rebuildGridFileSelect(list));
  buildGridDOM();
  toggleOrientation(); // init label/status then switch back
  toggleOrientation(); // keeps default H but refreshes text

  $("applySize").addEventListener("click", applySize);
  $("newGrid").addEventListener("click", resetGrid);
  $("exportGrid").addEventListener("click", exportCurrentGrid);
  const exportAllBtn = $("exportAll");
  if (exportAllBtn) exportAllBtn.addEventListener("click", exportAllGrids);
  $("importGrid").addEventListener("click", () => $("importFile").click());

  $("importFile").addEventListener("change", (e) => {
    const files = e.target.files;
    if (files && files.length) void importMultiple(files);
    e.target.value = "";
  });

  $("gridList").addEventListener("change", () => {
    const id = $("gridList").value;
    if (!id) return;
    const fileSel = $("gridFileSelect");
    if (fileSel) fileSel.value = "";
    loadGridById(id);
  });

  $("gridFileSelect")?.addEventListener("change", async () => {
    const file = $("gridFileSelect").value;
    if (!file) return;
    const localSel = $("gridList");
    if (localSel) localSel.value = "";
    await loadGridFromFile(file);
  });

  $("deleteGrid").addEventListener("click", () => {
    const id = state.id || $("gridList").value;
    if (!id) {
      setStatus("Aucune grille chargee a supprimer.");
      return;
    }
    deleteGridById(id);
  });

  $("saveDefinition").addEventListener("click", saveDefinition);
  $("clearDefinition").addEventListener("click", clearDefinition);
  $("setMagicWord")?.addEventListener("click", setMagicWordFromSelection);
  $("clearMagicWord")?.addEventListener("click", clearMagicWord);

  $("orientationToggle").addEventListener("click", toggleOrientation);

  document.addEventListener("keydown", onKeydown);

  // Drag & drop import
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || !files.length) return;
    const jsonFiles = Array.from(files).filter(
      (f) => f.type === "application/json" || f.name.toLowerCase().endsWith(".json")
    );
    if (!jsonFiles.length) {
      setStatus("Glisser-deposer: aucun fichier JSON.");
      return;
    }
    void importMultiple(jsonFiles);
  });
}

init();
