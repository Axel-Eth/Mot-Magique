import { $ } from "./dom.js";
import { state } from "./state.js";
import { syncScoresToPlateau } from "./plateau.js";
import { postToPlateau } from "./bridge.js";

const CAPITALES_BASE_CANDIDATES = ["questions/capitales/", "questions/pays/"];
let capitalesBasePath = CAPITALES_BASE_CANDIDATES[0];
const PLAYED_MEDIA_STORAGE_KEY = "avm_played_media_v1";

const playedMedia = loadPlayedMedia();

function loadPlayedMedia() {
  try {
    const raw = localStorage.getItem(PLAYED_MEDIA_STORAGE_KEY);
    if (!raw) return { capitales: {}, music: {}, films: {}, peoples: {}, generalQuestions: {} };
    const parsed = JSON.parse(raw);
    return {
      capitales: parsed?.capitales && typeof parsed.capitales === "object" ? parsed.capitales : {},
      music: parsed?.music && typeof parsed.music === "object" ? parsed.music : {},
      films: parsed?.films && typeof parsed.films === "object" ? parsed.films : {},
      peoples: parsed?.peoples && typeof parsed.peoples === "object" ? parsed.peoples : {},
      generalQuestions: parsed?.generalQuestions && typeof parsed.generalQuestions === "object" ? parsed.generalQuestions : {}
    };
  } catch {
    return { capitales: {}, music: {}, films: {}, peoples: {}, generalQuestions: {} };
  }
}

function savePlayedMedia() {
  try {
    localStorage.setItem(PLAYED_MEDIA_STORAGE_KEY, JSON.stringify(playedMedia));
  } catch {}
}

function isPlayed(category, value) {
  if (!category || !value) return false;
  return !!playedMedia?.[category]?.[value];
}

function setOptionPlayedVisual(optionEl, played) {
  if (!optionEl) return;
  if (played) {
    optionEl.dataset.played = "1";
    optionEl.style.color = "#ff5f6d";
    optionEl.style.fontWeight = "700";
    return;
  }
  delete optionEl.dataset.played;
  optionEl.style.color = "";
  optionEl.style.fontWeight = "";
}

function markPlayed(category, value) {
  if (!category || !value) return;
  if (!playedMedia[category]) playedMedia[category] = {};
  playedMedia[category][value] = 1;
  savePlayedMedia();
}

function refreshSelectPlayedStyles(selectEl, category) {
  if (!selectEl || !category) return;
  const options = selectEl.querySelectorAll("option[value]");
  options.forEach((opt) => {
    if (!opt.value) return;
    setOptionPlayedVisual(opt, isPlayed(category, opt.value));
  });
}

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
  markPlayed("capitales", fileName);
  refreshSelectPlayedStyles($("capitalesSelect"), "capitales");
  postToPlateau({ type: "STOP_FILMS_VIDEO" });
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
    setOptionPlayedVisual(opt, isPlayed("capitales", file));
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
        setOptionPlayedVisual(opt, isPlayed("music", opt.value));
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
      setOptionPlayedVisual(opt, isPlayed("films", opt.value));
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
        setOptionPlayedVisual(opt, isPlayed("films", opt.value));
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
    setOptionPlayedVisual(opt, isPlayed("peoples", opt.value));
    currentOptgroup.appendChild(opt);
  });
}

function getAnyKey(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  }
  return undefined;
}

function parseGeneralLevelLabel(rawLevel) {
  const level = String(rawLevel || "").trim().toLowerCase();
  if (level.includes("debut")) return "Debutant";
  if (level.includes("confirm")) return "Confirme";
  if (level.includes("expert")) return "Expert";
  return String(rawLevel || "").trim() || "Niveau";
}

function parseGeneralQuestionsFromDataset(fileName, data) {
  if (!data || typeof data !== "object") return [];

  const categoryMeta = getAnyKey(data, ["catégorie-nom-slogan", "categorie-nom-slogan"]) || {};
  const frMeta = getAnyKey(categoryMeta, ["fr"]) || categoryMeta;
  const category = String(getAnyKey(frMeta, ["catégorie", "categorie"]) || "Culture generale").trim();
  const sourceName = String(getAnyKey(frMeta, ["nom"]) || fileName.replace(/\.json$/i, "")).trim();

  const quizzNode = getAnyKey(data, ["quizz"]) || {};
  const frNode = getAnyKey(quizzNode, ["fr"]) || quizzNode;
  if (!frNode || typeof frNode !== "object") return [];

  const questions = [];

  Object.entries(frNode).forEach(([levelKey, entries]) => {
    if (!Array.isArray(entries)) return;
    const level = parseGeneralLevelLabel(levelKey);
    entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const questionText = String(getAnyKey(entry, ["question"]) || "").trim();
      if (!questionText) return;
      const optionsNode = getAnyKey(entry, ["propositions", "options", "choix"]);
      const options = Array.isArray(optionsNode)
        ? optionsNode.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      const answer = String(getAnyKey(entry, ["réponse", "reponse", "answer"]) || "").trim();
      const rawId = getAnyKey(entry, ["id"]);
      const idPart = rawId != null && String(rawId).trim() ? String(rawId).trim() : String(index + 1);
      questions.push({
        id: `${fileName}::${levelKey}::${idPart}`,
        category,
        sourceName,
        level,
        question: questionText,
        options,
        answer
      });
    });
  });

  return questions;
}

function getGeneralCategoryStats() {
  const stats = new Map();
  state.generalQuestions.forEach((q) => {
    const key = q.category || "Culture generale";
    if (!stats.has(key)) stats.set(key, { total: 0, remaining: 0 });
    const info = stats.get(key);
    info.total += 1;
    if (!isPlayed("generalQuestions", q.id)) info.remaining += 1;
  });
  return stats;
}

function refreshGeneralCategorySelect() {
  const select = $("generalCategorySelect");
  if (!select) return;

  const previous = select.value || "";
  const stats = getGeneralCategoryStats();
  const categories = [...stats.keys()].sort((a, b) =>
    a.localeCompare(b, "fr", { sensitivity: "base" })
  );

  select.innerHTML = "";

  const allInfo = { total: state.generalQuestions.length, remaining: 0 };
  state.generalQuestions.forEach((q) => {
    if (!isPlayed("generalQuestions", q.id)) allInfo.remaining += 1;
  });
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = `Toutes categories (${allInfo.remaining}/${allInfo.total})`;
  select.appendChild(allOption);

  categories.forEach((category) => {
    const info = stats.get(category);
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = `${category} (${info.remaining}/${info.total})`;
    select.appendChild(opt);
  });

  if ([...select.options].some((opt) => opt.value === previous)) {
    select.value = previous;
  } else {
    select.selectedIndex = 0;
  }
}

function updateGeneralQuestionButtons() {
  const current = state.generalQuestionCurrent;
  const canShowQuestion = !!current;
  const hasFourOptions = !!(current && Array.isArray(current.options) && current.options.length === 4);

  const showQuestionBtn = $("btnGeneralShowQuestion");
  if (showQuestionBtn) showQuestionBtn.disabled = !canShowQuestion;

  const showChoicesBtn = $("btnGeneralShowChoices");
  if (showChoicesBtn) {
    showChoicesBtn.disabled = !hasFourOptions;
    showChoicesBtn.textContent = state.generalQuestionChoicesVisible ? "Cacher propositions" : "Afficher propositions";
  }
}

function renderGeneralQuestionCard() {
  const card = $("generalQuestionCard");
  const metaEl = $("generalQuestionMeta");
  const textEl = $("generalQuestionText");
  const listEl = $("generalChoicesList");
  const answerEl = $("generalAnswerText");
  if (!card || !metaEl || !textEl || !listEl || !answerEl) return;

  const q = state.generalQuestionCurrent;
  if (!q) {
    card.classList.add("hidden");
    metaEl.textContent = "-";
    textEl.textContent = "Choisis une question.";
    listEl.innerHTML = "";
    answerEl.textContent = "";
    updateGeneralQuestionButtons();
    return;
  }

  card.classList.remove("hidden");
  metaEl.textContent = `${q.category} • ${q.level} • ${q.sourceName}`;
  textEl.textContent = q.question;
  listEl.innerHTML = "";
  if (Array.isArray(q.options) && q.options.length) {
    q.options.forEach((opt, idx) => {
      const li = document.createElement("li");
      li.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
      if (q.answer && String(opt).trim() === String(q.answer).trim()) {
        li.classList.add("correct-answer");
      }
      listEl.appendChild(li);
    });
    answerEl.textContent = "";
  } else {
    answerEl.textContent = q.answer ? `Reponse: ${q.answer}` : "";
  }
  updateGeneralQuestionButtons();
}

function openGeneralQuestionsModal() {
  $("generalQuestionsModal")?.classList.remove("hidden");
}

function hideGeneralQuestionsModal() {
  $("generalQuestionsModal")?.classList.add("hidden");
}

function initGeneralQuestionsModalDrag() {
  const modal = $("generalQuestionsModal");
  const card = modal?.querySelector(".generalq-modal-card");
  const handle = $("generalQuestionsDragHandle");
  if (!modal || !card || !handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = (e) => {
    if (!dragging) return;
    const nextLeft = e.clientX - offsetX;
    const nextTop = e.clientY - offsetY;
    card.style.left = `${Math.max(8, nextLeft)}px`;
    card.style.top = `${Math.max(8, nextTop)}px`;
  };

  const stopDrag = () => {
    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopDrag);
  };

  handle.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target?.closest?.("button")) return;

    const rect = card.getBoundingClientRect();
    card.style.position = "fixed";
    card.style.margin = "0";
    card.style.left = `${rect.left}px`;
    card.style.top = `${rect.top}px`;
    card.style.transform = "none";

    dragging = true;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDrag);
  });
}

function getGeneralQuestionCandidates() {
  const selectedCategory = $("generalCategorySelect")?.value || "";
  const filtered = selectedCategory
    ? state.generalQuestions.filter((q) => q.category === selectedCategory)
    : state.generalQuestions.slice();
  return filtered.filter((q) => !isPlayed("generalQuestions", q.id));
}

function selectGeneralQuestion({ random = false } = {}) {
  const candidates = getGeneralQuestionCandidates();
  if (!candidates.length) {
    alert("Plus de question disponible dans cette categorie. Utilise Nouvelle emission pour reinitialiser.");
    return;
  }

  const picked = random
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : candidates[0];

  markPlayed("generalQuestions", picked.id);
  state.generalQuestionCurrent = picked;
  state.generalQuestionChoicesVisible = false;
  refreshGeneralCategorySelect();
  renderGeneralQuestionCard();
}

function sendGeneralQuestionToPlateau(showChoices = false) {
  const q = state.generalQuestionCurrent;
  if (!q) return;
  state.generalQuestionChoicesVisible = !!showChoices;
  postToPlateau({ type: "STOP_FILMS_VIDEO" });
  postToPlateau({ type: "HIDE_MEDIA" });
  postToPlateau({
    type: "SHOW_GENERAL_QUESTION",
    category: q.category,
    level: q.level,
    source: q.sourceName,
    question: q.question,
    options: q.options || [],
    answer: q.answer || "",
    showChoices: !!showChoices
  });
  updateGeneralQuestionButtons();
}

export async function loadGeneralQuestionsList() {
  const select = $("generalCategorySelect");
  if (!select) return;

  state.generalQuestions = [];
  state.generalQuestionCurrent = null;
  state.generalQuestionChoicesVisible = false;
  select.innerHTML = "";

  const base = "questions/Datasets/";
  try {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) {
      renderGeneralQuestionCard();
      return;
    }
    const html = await res.text();
    const files = [...html.matchAll(/href=\"([^\"]+\.json)\"/gi)]
      .map((m) => decodeURIComponent(m[1].split("/").pop() || m[1]))
      .filter((name) => !name.startsWith("."))
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    const allQuestions = [];
    for (const file of files) {
      try {
        const fileRes = await fetch(`${base}${encodeURIComponent(file)}`, { cache: "no-store" });
        if (!fileRes.ok) continue;
        const data = await fileRes.json();
        allQuestions.push(...parseGeneralQuestionsFromDataset(file, data));
      } catch {}
    }

    state.generalQuestions = allQuestions.sort((a, b) => {
      const cat = a.category.localeCompare(b.category, "fr", { sensitivity: "base" });
      if (cat !== 0) return cat;
      const src = a.sourceName.localeCompare(b.sourceName, "fr", { sensitivity: "base" });
      if (src !== 0) return src;
      const lvl = a.level.localeCompare(b.level, "fr", { sensitivity: "base" });
      if (lvl !== 0) return lvl;
      return a.id.localeCompare(b.id, "fr", { sensitivity: "base" });
    });
  } catch {}

  refreshGeneralCategorySelect();
  renderGeneralQuestionCard();
}

function runXMediaFlow() {
  state.showScores = false;
  syncScoresToPlateau();
  postToPlateau({ type: "STOP_FILMS_VIDEO" });
  postToPlateau({ type: "HIDE_MEDIA" });
  postToPlateau({ type: "STOP_MUSIC" });
  state.generalQuestionChoicesVisible = false;
  updateGeneralQuestionButtons();
}

function playMusicSource(src) {
  if (!src) return;
  state.lastMusicSrc = src;
  postToPlateau({ type: "STOP_FILMS_VIDEO" });
  postToPlateau({ type: "PLAY_MUSIC", src, visualizer: true });
}

function playFilmsSource(src) {
  if (!src) return;
  state.lastFilmsSrc = src;
  postToPlateau({ type: "PLAY_FILMS_VIDEO" });
  postToPlateau({ type: "PLAY_MUSIC", src, visualizer: false });
}

function showPeopleSource(src, label) {
  if (!src) return;
  state.lastPeopleSrc = src;
  state.lastPeopleLabel = label || "Personnalite";
  postToPlateau({ type: "STOP_FILMS_VIDEO" });
  postToPlateau({ type: "SHOW_PEOPLE", src, alt: state.lastPeopleLabel });
}

function updateReplayButtonsState() {
  const musicBtn = $("btnReplayMusic");
  if (musicBtn) musicBtn.disabled = !state.lastMusicSrc;

  const filmsBtn = $("btnReplayFilms");
  if (filmsBtn) filmsBtn.disabled = !state.lastFilmsSrc;

  const peoplesBtn = $("btnReplayPeoples");
  if (peoplesBtn) peoplesBtn.disabled = !state.lastPeopleSrc;
}

export function registerMediaEvents() {
  initGeneralQuestionsModalDrag();

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

  $("capitalesModalOk")?.addEventListener("click", () => {
    runXMediaFlow();
    hideCapitaleModal();
  });
  $("capitalesModal")?.addEventListener("click", (e) => {
    if (e.target.id === "capitalesModal") hideCapitaleModal();
  });

  $("btnXMedia")?.addEventListener("click", () => {
    runXMediaFlow();
  });

  $("btnQuestions")?.addEventListener("click", () => {
    const modal = $("generalQuestionsModal");
    if (!modal) return;
    if (modal.classList.contains("hidden")) {
      openGeneralQuestionsModal();
    } else {
      hideGeneralQuestionsModal();
    }
  });

  $("btnCloseQuestions")?.addEventListener("click", () => {
    hideGeneralQuestionsModal();
  });

  $("generalQuestionsModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "generalQuestionsModal") {
      hideGeneralQuestionsModal();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideGeneralQuestionsModal();
  });

  $("musicSelect")?.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value) {
      markPlayed("music", value);
      refreshSelectPlayedStyles(e.target, "music");
      playMusicSource(value);
      updateReplayButtonsState();
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
      markPlayed("films", value);
      refreshSelectPlayedStyles(e.target, "films");
      playFilmsSource(value);
      updateReplayButtonsState();
    }
  });

  $("peoplesSelect")?.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value) {
      markPlayed("peoples", value);
      refreshSelectPlayedStyles(e.target, "peoples");
      const label = e.target.selectedOptions?.[0]?.textContent || "Personnalite";
      showPeopleSource(value, label);
      updateReplayButtonsState();
      e.target.selectedIndex = 0;
    }
  });

  $("generalCategorySelect")?.addEventListener("change", () => {
    state.generalQuestionCurrent = null;
    state.generalQuestionChoicesVisible = false;
    renderGeneralQuestionCard();
    refreshGeneralCategorySelect();
  });

  $("btnGeneralNext")?.addEventListener("click", () => {
    selectGeneralQuestion({ random: false });
  });

  $("btnGeneralRandom")?.addEventListener("click", () => {
    selectGeneralQuestion({ random: true });
  });

  $("btnGeneralShowQuestion")?.addEventListener("click", () => {
    sendGeneralQuestionToPlateau(false);
  });

  $("btnGeneralShowChoices")?.addEventListener("click", () => {
    const q = state.generalQuestionCurrent;
    if (!q || !Array.isArray(q.options) || q.options.length !== 4) return;
    const next = !state.generalQuestionChoicesVisible;
    sendGeneralQuestionToPlateau(next);
  });

  $("btnReplayMusic")?.addEventListener("click", () => {
    const current = $("musicSelect")?.value || "";
    const src = current || state.lastMusicSrc;
    if (!src) return;
    markPlayed("music", src);
    refreshSelectPlayedStyles($("musicSelect"), "music");
    playMusicSource(src);
    updateReplayButtonsState();
  });

  $("btnReplayFilms")?.addEventListener("click", () => {
    const current = $("filmsSelect")?.value || "";
    const src = current || state.lastFilmsSrc;
    if (!src) return;
    markPlayed("films", src);
    refreshSelectPlayedStyles($("filmsSelect"), "films");
    playFilmsSource(src);
    updateReplayButtonsState();
  });

  $("btnReplayPeoples")?.addEventListener("click", () => {
    const select = $("peoplesSelect");
    const current = select?.value || "";
    const src = current || state.lastPeopleSrc;
    if (!src) return;
    markPlayed("peoples", src);
    refreshSelectPlayedStyles(select, "peoples");
    const label = (select?.selectedOptions?.[0]?.textContent || "").trim() || state.lastPeopleLabel || "Personnalite";
    showPeopleSource(src, label);
    updateReplayButtonsState();
  });

  updateReplayButtonsState();
  updateGeneralQuestionButtons();
}

export function resetMediaForNewShow() {
  playedMedia.capitales = {};
  playedMedia.music = {};
  playedMedia.films = {};
  playedMedia.peoples = {};
  playedMedia.generalQuestions = {};
  savePlayedMedia();

  refreshSelectPlayedStyles($("capitalesSelect"), "capitales");
  refreshSelectPlayedStyles($("musicSelect"), "music");
  refreshSelectPlayedStyles($("filmsSelect"), "films");
  refreshSelectPlayedStyles($("peoplesSelect"), "peoples");
  refreshGeneralCategorySelect();

  const capitalesInput = $("capitalesInput");
  if (capitalesInput) capitalesInput.value = "";

  const selectIds = ["capitalesSelect", "musicSelect", "plateauMusicSelect", "filmsSelect", "peoplesSelect", "generalCategorySelect"];
  selectIds.forEach((id) => {
    const sel = $(id);
    if (sel) sel.selectedIndex = 0;
  });

  state.lastMusicSrc = "";
  state.lastFilmsSrc = "";
  state.lastPeopleSrc = "";
  state.lastPeopleLabel = "";
  state.capitalesLastFile = "";
  state.generalQuestionCurrent = null;
  state.generalQuestionChoicesVisible = false;
  renderGeneralQuestionCard();
  updateReplayButtonsState();

  setCapitalesTone("doux");
  hideCapitaleModal();
  hideGeneralQuestionsModal();
  runXMediaFlow();
}
