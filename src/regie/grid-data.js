import { state } from "./state.js";

const XLSX = window.XLSX;

export function k(r, c) {
  return `${r},${c}`;
}

export function keyPos(obj) {
  return `${obj.r},${obj.c}`;
}

export function buildWordData(letters, numbers, bounds, getDefinitionForWord) {
  const { minRow, maxRow, minCol, maxCol } = bounds;
  const words = [];
  const cellToWords = new Map();
  const numberPosToWord = new Map();

  function addWord(cells, orientation) {
    const id = words.length;
    const first = cells[0];

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

export async function parseXlsx(url) {
  const buf = await (await fetch(url, { cache: "no-store" })).arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellComments: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("XLSX: aucune feuille trouvee.");

  const letters = new Map();
  const numbers = new Map();
  const revealed = new Map();
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
    throw new Error("XLSX: aucune cellule exploitable detectee.");
  }

  const rows = used.map(([r]) => r);
  const cols = used.map(([, c]) => c);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  const words = [];
  const cellToWords = new Map();
  const numberPosToWord = new Map();

  function addWord(cells, orientation) {
    const id = words.length;
    const first = cells[0];

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

    let def = "-";
    if (numberPos) def = getComment(ws, numberPos.r, numberPos.c);
    if (!def) def = getComment(ws, first.r, first.c);
    if (!def) def = "(Pas de definition renseignee.)";

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
    magicHints: new Set(),
    words,
    cellToWords,
    numberPosToWord,
    magicWordId: null,
    magicWordCells: new Set(),
    magicSolved: false
  };
}

export function parseCustomGrid(entry) {
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
    magicHints: new Set(),
    words,
    cellToWords,
    numberPosToWord,
    magicWordId,
    magicWordCells: new Set(),
    magicSolved: false
  };
}

export async function parseJsonGrid(url) {
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

export function serializeGridForPlateau(grid) {
  return {
    url: grid.url,
    bounds: grid.bounds,
    letters: [...grid.letters.entries()],
    numbers: [...grid.numbers.entries()],
    revealed: [...grid.revealed.entries()],
    magic: grid.magic ? [...grid.magic] : [],
    magicHints: grid.magicHints ? [...grid.magicHints] : [],
    words: grid.words,
    cellToWords: [...grid.cellToWords.entries()],
    numberPosToWord: [...grid.numberPosToWord.entries()],
    magicWordId: grid.magicWordId ?? state.magicWordId,
    magicSolved: grid.magicSolved ?? state.magicSolved
  };
}
