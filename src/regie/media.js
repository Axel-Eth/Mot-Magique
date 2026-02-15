import { $ } from "./dom.js";
import { state } from "./state.js";
import { syncScoresToPlateau } from "./plateau.js";
import { postToPlateau } from "./bridge.js";

const CAPITALES_BASE_CANDIDATES = ["questions/capitales/", "questions/pays/"];
let capitalesBasePath = CAPITALES_BASE_CANDIDATES[0];

async function fetchNotesJson(base, fileName) {
  try {
    const res = await fetch(`${base}${fileName}`, { cache: "no-store" });
    if (!res.ok) return null;
    const notes = await res.json();
    return notes && typeof notes === "object" ? notes : null;
  } catch {
    return null;
  }
}

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
  modal.classList.remove("hidden");
  state.capitalesLastFile = fileName;
  const baseName = String(fileName || "").replace(/\.png$/i, "");
  $("capitalesFileName").textContent = `${baseName}.png`;
  $("capitalesNote").textContent = getCapitaleNote(baseName);
}

function refreshCapitaleModal() {
  const modal = $("capitalesModal");
  if (!modal || modal.classList.contains("hidden")) return;
  if (!state.capitalesLastFile) return;
  const baseName = String(state.capitalesLastFile || "").replace(/\.png$/i, "");
  $("capitalesFileName").textContent = `${baseName}.png`;
  $("capitalesNote").textContent = getCapitaleNote(baseName);
}

export function hideCapitaleModal() {
  $("capitalesModal")?.classList.add("hidden");
}

export function showCapitaleByFile(fileName) {
  if (!fileName) return;
  postToPlateau({ type: "SHOW_FLAG", src: `${capitalesBasePath}${fileName}` });
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

export function sendCapitale() {
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

export function setCapitalesTone(mode) {
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

export async function loadCapitalesNotes() {
  for (const base of CAPITALES_BASE_CANDIDATES) {
    const notes = await fetchNotesJson(base, "infos_pays.json");
    if (notes) {
      state.capitalesNotesDefault = notes;
      capitalesBasePath = base;
      break;
    }
  }

  for (const base of CAPITALES_BASE_CANDIDATES) {
    const notes = await fetchNotesJson(base, "infos_pays_sarcasme.json");
    if (notes) {
      state.capitalesNotesSarcasme = notes;
      break;
    }
  }
}

async function fetchCapitaleFilesByListing(base) {
  try {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) return [];
    const html = await res.text();
    return [...html.matchAll(/href="([^"]+\.png)"/gi)]
      .map((m) => decodeURIComponent(m[1].split("/").pop() || m[1]));
  } catch {
    return [];
  }
}

export async function loadCapitalesList() {
  const select = $("capitalesSelect");
  if (!select) return;
  select.innerHTML = "";

  let files = [];

  for (const base of [capitalesBasePath, ...CAPITALES_BASE_CANDIDATES]) {
    files = await fetchCapitaleFilesByListing(base);
    if (files.length) {
      capitalesBasePath = base;
      break;
    }
  }

  if (!files.length) {
    // Fallback dur: on recharge directement les JSON ici, même si loadCapitalesNotes
    // n'a pas réussi auparavant.
    for (const base of CAPITALES_BASE_CANDIDATES) {
      const defaultNotes = await fetchNotesJson(base, "infos_pays.json");
      if (defaultNotes) {
        state.capitalesNotesDefault = defaultNotes;
        capitalesBasePath = base;
        const sarcasticNotes = await fetchNotesJson(base, "infos_pays_sarcasme.json");
        if (sarcasticNotes) state.capitalesNotesSarcasme = sarcasticNotes;
        break;
      }
    }

    const notes = {
      ...(state.capitalesNotesDefault || {}),
      ...(state.capitalesNotesSarcasme || {})
    };
    if (Object.keys(notes).length) {
      files = Object.keys(notes).map((name) => `${name}.png`);
    }
  }

  files = [...new Set(files)].sort((a, b) =>
    a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" })
  );
  state.capitalesFiles = files;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pays";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  if (!files.length) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Aucun pays detecte";
    none.disabled = true;
    select.appendChild(none);
    state.capitalesFiles = [];
    return;
  }

  files.forEach((file) => {
    const opt = document.createElement("option");
    opt.value = file;
    opt.textContent = file.replace(/\.png$/i, "");
    select.appendChild(opt);
  });
}

export async function loadMusicList() {
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

export async function loadPlateauMusicList() {
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

export async function loadFilmsList() {
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

export async function loadPeoplesList() {
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

export function registerMediaEvents() {
  $("btnCapitalesSend")?.addEventListener("click", sendCapitale);
  $("capitalesInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendCapitale();
  });

  $("capitalesSelect")?.addEventListener("change", (e) => {
    const fileName = e.target.value;
    if (fileName) {
      showCapitaleByFile(fileName);
      e.target.selectedIndex = 0;
    }
  });

  $("capitalesTone")?.addEventListener("click", () => {
    const next = state.capitalesNotesMode === "piquant" ? "doux" : "piquant";
    setCapitalesTone(next);
  });

  $("capitalesModalTone")?.addEventListener("click", () => {
    const next = state.capitalesNotesMode === "piquant" ? "doux" : "piquant";
    setCapitalesTone(next);
  });

  $("capitalesModalOk")?.addEventListener("click", hideCapitaleModal);
  $("capitalesModal")?.addEventListener("click", (e) => {
    if (e.target.id === "capitalesModal") hideCapitaleModal();
  });

  $("btnXMedia")?.addEventListener("click", () => {
    state.showScores = false;
    syncScoresToPlateau();
    postToPlateau({ type: "HIDE_MEDIA" });
    postToPlateau({ type: "STOP_MUSIC" });
  });

  $("musicSelect")?.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value) {
      postToPlateau({ type: "PLAY_MUSIC", src: value, visualizer: true });
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
      postToPlateau({ type: "PLAY_MUSIC", src: value, visualizer: false });
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
}
