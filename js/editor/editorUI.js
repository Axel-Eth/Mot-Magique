export function initEditorUI() {
  const gridEl = document.getElementById("editorGrid");
  const infoEl = document.getElementById("editorInfo");
  const defEl = document.getElementById("definition");

  let orientation = "H"; // H ou V
  let state = makeEmptyGrid(10,10);
  let cursor = { r:0, c:0 };
  let selection = null; // futur: mot sélectionné
  const history = [];
  const future = [];

  function pushHistory() {
    history.push(structuredClone({ state, cursor, selection, orientation }));
    if (history.length > 500) history.shift();
    future.length = 0;
  }

  function setOrientation(o) {
    orientation = o;
    document.getElementById("orientationLabel").textContent = orientation;
  }

  function render() {
    infoEl.textContent = `Curseur: (${cursor.r},${cursor.c}) | Orientation: ${orientation}`;
    gridEl.innerHTML = renderGrid(state, cursor);
  }

  gridEl.addEventListener("keydown", (e) => {
    // CTRL+Z
    if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    // CTRL+SPACE toggle
    if (e.ctrlKey && e.code === "Space") {
      e.preventDefault();
      setOrientation(orientation === "H" ? "V" : "H");
      return;
    }

    // navigation
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
      e.preventDefault();
      moveCursor(e.key);
      render();
      return;
    }

    // lettre
    const ch = e.key.length === 1 ? e.key.toUpperCase() : "";
    if (/[A-ZÀ-ÖØ-Ý]/.test(ch)) {
      e.preventDefault();
      pushHistory();
      writeChar(ch);
      render();
      return;
    }

    // backspace
    if (e.key === "Backspace") {
      e.preventDefault();
      pushHistory();
      writeChar("");
      render();
    }
  });

  gridEl.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-r][data-c]");
    if (!cell) return;
    cursor = { r: Number(cell.dataset.r), c: Number(cell.dataset.c) };
    gridEl.focus();
    render();
  });

  gridEl.addEventListener("dblclick", (e) => {
    const cell = e.target.closest("[data-r][data-c]");
    if (!cell) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    pushHistory();
    const idx = r * state.cols + c;
    state.cells[idx].magic = !state.cells[idx].magic; // contour violet plus tard (CSS)
    render();
  });

  document.getElementById("btnResize").onclick = () => {
    pushHistory();
    const rows = Number(document.getElementById("rows").value);
    const cols = Number(document.getElementById("cols").value);
    state = resizeGrid(state, rows, cols);
    cursor = { r:0, c:0 };
    render();
  };

  document.getElementById("btnExport").onclick = () => {
    const json = JSON.stringify(state, null, 2);
    download("grid.json", json);
  };

  document.getElementById("importFile").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const txt = await file.text();
    try {
      pushHistory();
      state = JSON.parse(txt);
      cursor = { r:0, c:0 };
      render();
    } catch {
      infoEl.textContent = "Import invalide.";
    }
  };

  document.getElementById("btnSaveDefinition").onclick = () => {
    // placeholder: la notion de “mot sélectionné” arrive ensuite
    infoEl.textContent = "Définition: (sera associée au mot sélectionné quand on implémente la segmentation en mots).";
  };

  document.getElementById("btnSetMagicWord").onclick = () => {
    // placeholder: mot sélectionné non géré encore
    infoEl.textContent = "Mot magique: (sera appliqué au mot sélectionné dès qu’on a la logique de sélection de mot).";
  };

  function undo() {
    if (!history.length) return;
    future.push(structuredClone({ state, cursor, selection, orientation }));
    const prev = history.pop();
    ({ state, cursor, selection, orientation } = structuredClone(prev));
    document.getElementById("orientationLabel").textContent = orientation;
    render();
  }

  function moveCursor(key) {
    if (key === "ArrowUp") cursor.r = Math.max(0, cursor.r - 1);
    if (key === "ArrowDown") cursor.r = Math.min(state.rows - 1, cursor.r + 1);
    if (key === "ArrowLeft") cursor.c = Math.max(0, cursor.c - 1);
    if (key === "ArrowRight") cursor.c = Math.min(state.cols - 1, cursor.c + 1);
  }

  function writeChar(ch) {
    const idx = cursor.r * state.cols + cursor.c;
    state.cells[idx].char = ch;

    // avance curseur selon orientation
    if (orientation === "H") cursor.c = Math.min(state.cols - 1, cursor.c + 1);
    else cursor.r = Math.min(state.rows - 1, cursor.r + 1);
  }

  render();
  gridEl.tabIndex = 0;
  gridEl.focus();
}

function makeEmptyGrid(rows, cols) {
  return {
    rows, cols,
    cells: Array.from({ length: rows * cols }, (_, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      return { r, c, char: "", blocked: false, magic: false };
    }),
    words: [],
    magicWordId: null,
  };
}

function resizeGrid(old, rows, cols) {
  const next = makeEmptyGrid(rows, cols);
  for (let r=0; r<Math.min(rows, old.rows); r++) {
    for (let c=0; c<Math.min(cols, old.cols); c++) {
      const oldIdx = r * old.cols + c;
      const newIdx = r * cols + c;
      next.cells[newIdx].char = old.cells[oldIdx].char;
      next.cells[newIdx].blocked = !!old.cells[oldIdx].blocked;
      next.cells[newIdx].magic = !!old.cells[oldIdx].magic;
    }
  }
  return next;
}

function renderGrid(state, cursor) {
  let html = `<div style="display:inline-block; font-family:monospace; user-select:none;">`;
  for (let r=0; r<state.rows; r++) {
    html += `<div>`;
    for (let c=0; c<state.cols; c++) {
      const idx = r * state.cols + c;
      const cell = state.cells[idx];
      const isCursor = cursor.r === r && cursor.c === c;
      const ch = cell.blocked ? "#" : (cell.char || "·");
      const border = isCursor ? "2px solid black" : "1px solid #999";
      const pad = "6px";
      html += `
        <span data-r="${r}" data-c="${c}"
              style="display:inline-block;width:22px;text-align:center;padding:${pad};border:${border};">
          ${escapeHtml(ch)}
        </span>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function download(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
