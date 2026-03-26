import { $ } from "./dom.js";
import { state } from "./state.js";
import { postToPlateau } from "./bridge.js";
import { renderTeams, showTeamAwardModal } from "./teams.js";
import { syncScoresToPlateau } from "./plateau.js";

const LEXICON_SQL_PATH = "chiffres_lettres/lexique.sql";
const LETTERS_COUNT = 10;
const GENERATION_ATTEMPTS = 24;
const RARE_LETTERS = new Set(["J", "K", "Q", "W", "X", "Y", "Z"]);
const WORD_QUALITY_TARGET = 18;
const LONG_WORD_TARGET = 2;
const VOWEL_COUNT_WEIGHTS = [
  { value: 4, weight: 3 },
  { value: 5, weight: 6 },
  { value: 6, weight: 4 }
];
const VOWEL_WEIGHTS = [
  { value: "E", weight: 18 },
  { value: "A", weight: 14 },
  { value: "I", weight: 12 },
  { value: "O", weight: 10 },
  { value: "U", weight: 8 },
  { value: "Y", weight: 2 }
];
const CONSONANT_WEIGHTS = [
  { value: "S", weight: 12 },
  { value: "N", weight: 11 },
  { value: "R", weight: 11 },
  { value: "T", weight: 10 },
  { value: "L", weight: 9 },
  { value: "D", weight: 7 },
  { value: "C", weight: 7 },
  { value: "M", weight: 6 },
  { value: "P", weight: 6 },
  { value: "V", weight: 5 },
  { value: "G", weight: 5 },
  { value: "B", weight: 4 },
  { value: "F", weight: 4 },
  { value: "H", weight: 3 },
  { value: "J", weight: 2 },
  { value: "Q", weight: 2 },
  { value: "K", weight: 1 },
  { value: "W", weight: 1 },
  { value: "X", weight: 1 },
  { value: "Z", weight: 1 }
];
const DUPLICATE_LIMITS = {
  E: 3,
  A: 2,
  I: 2,
  O: 2,
  U: 2,
  S: 2,
  N: 2,
  R: 2,
  T: 2,
  L: 2
};

let lexiconReady = false;
let lexiconLoadingPromise = null;
let lexiconSet = new Set();
let lexiconWords = [];

function normalizeWord(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function countMojibakeMarkers(text) {
  const sample = String(text || "");
  const markers = ["\u00C3", "\u00C2", "\uFFFD"];
  return markers.reduce((sum, marker) => sum + Math.max(0, sample.split(marker).length - 1), 0);
}

function scoreDecodedLexicon(text) {
  const sample = String(text || "").slice(0, 250000);
  let score = 0;

  if (sample.includes("CREATE TABLE `lexique`")) score += 50;
  if (sample.includes("INSERT INTO `lexique` VALUES")) score += 50;
  score -= countMojibakeMarkers(sample) * 4;

  const accentHits = (sample.match(/[\u00E9\u00E8\u00EA\u00E0\u00E2\u00EE\u00EF\u00F4\u00F9\u00FB\u00E7\u0153\u00E6]/gi) || []).length;
  score += Math.min(60, accentHits);

  return score;
}

function decodeLexiconBuffer(buffer) {
  const decoders = [
    new TextDecoder("utf-8", { fatal: false }),
    new TextDecoder("windows-1252", { fatal: false })
  ];

  const candidates = decoders.map((decoder) => {
    const text = decoder.decode(buffer);
    return {
      text,
      score: scoreDecodedLexicon(text)
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.text || "";
}

function setLettersStatus(message, isError = false) {
  const el = $("lettersGameStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", !!isError);
}

function setLettersResult(message, isError = false) {
  const el = $("lettersGameResult");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", !!isError);
}

function buildLettersPayload() {
  return {
    type: "SHOW_LETTERS_GAME",
    visible: !!state.lettersGameVisible && state.lettersGameLetters.length === LETTERS_COUNT,
    letters: [...state.lettersGameLetters],
    usedWords: [...(state.lettersGameUsedWords || [])]
  };
}

function sendLettersToPlateau() {
  postToPlateau(buildLettersPayload());
}

function drawWeightedValue(weightedList) {
  const totalWeight = weightedList.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const item of weightedList) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return weightedList[weightedList.length - 1]?.value ?? "";
}

function countLetters(letters) {
  const counts = new Map();
  letters.forEach((letter) => {
    counts.set(letter, (counts.get(letter) || 0) + 1);
  });
  return counts;
}

function shuffleLetters(letters) {
  const copy = [...letters];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildLetterSet(weightedPool, count, letters) {
  while (letters.length < count) {
    const next = drawWeightedValue(weightedPool);
    const currentCount = letters.filter((letter) => letter === next).length;
    const limit = DUPLICATE_LIMITS[next] ?? 1;
    if (currentCount >= limit) continue;
    letters.push(next);
  }
}

function estimateWordPotential(letters) {
  if (!lexiconReady || !lexiconWords.length) {
    return { buildableWords: 0, longWords: 0 };
  }

  const available = countLetters(letters);
  let buildableWords = 0;
  let longWords = 0;

  for (const word of lexiconWords) {
    if (word.length < 4 || word.length > LETTERS_COUNT) continue;
    const needed = new Map();
    let valid = true;

    for (const letter of word) {
      const nextCount = (needed.get(letter) || 0) + 1;
      if (nextCount > (available.get(letter) || 0)) {
        valid = false;
        break;
      }
      needed.set(letter, nextCount);
    }

    if (!valid) continue;
    buildableWords += 1;
    if (word.length >= 7) longWords += 1;
    if (buildableWords >= 80 && longWords >= 4) break;
  }

  return { buildableWords, longWords };
}

function scoreLettersDraw(letters) {
  const counts = countLetters(letters);
  const vowelCount = letters.filter((letter) => VOWEL_WEIGHTS.some((item) => item.value === letter)).length;
  const rareCount = letters.filter((letter) => RARE_LETTERS.has(letter)).length;
  const commonCoreCount = letters.filter((letter) => ["E", "A", "I", "S", "N", "R", "T", "L"].includes(letter)).length;
  let score = 0;

  if (vowelCount === 5) score += 16;
  else if (vowelCount === 4 || vowelCount === 6) score += 12;
  else score -= 12;

  score += commonCoreCount * 2;
  score -= rareCount * 5;

  for (const [letter, count] of counts) {
    const limit = DUPLICATE_LIMITS[letter] ?? 1;
    if (count > limit) score -= 12;
    if (count === limit && limit > 1) score += 1;
  }

  const hasFrontVowel = letters.some((letter) => ["A", "E", "I", "O", "U"].includes(letter));
  if (hasFrontVowel) score += 4;

  const potential = estimateWordPotential(letters);
  score += Math.min(20, potential.buildableWords / 2);
  score += potential.longWords * 6;

  return {
    score,
    vowelCount,
    rareCount,
    buildableWords: potential.buildableWords,
    longWords: potential.longWords
  };
}

function formatDrawQuality(quality) {
  if (quality.buildableWords >= WORD_QUALITY_TARGET && quality.longWords >= LONG_WORD_TARGET) {
    return `Tirage riche: ${quality.buildableWords}+ mots, ${quality.longWords} mots longs.`;
  }
  if (quality.buildableWords >= 10) {
    return `Tirage correct: ${quality.buildableWords} mots detectes.`;
  }
  return "Tirage genere.";
}

function generateLetters() {
  let bestLetters = [];
  let bestQuality = null;

  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = [];
    const vowelsCount = drawWeightedValue(VOWEL_COUNT_WEIGHTS);
    buildLetterSet(VOWEL_WEIGHTS, vowelsCount, candidate);
    buildLetterSet(CONSONANT_WEIGHTS, LETTERS_COUNT, candidate);

    const shuffled = shuffleLetters(candidate);
    const quality = scoreLettersDraw(shuffled);

    if (!bestQuality || quality.score > bestQuality.score) {
      bestLetters = shuffled;
      bestQuality = quality;
    }

    if (quality.buildableWords >= WORD_QUALITY_TARGET && quality.longWords >= LONG_WORD_TARGET) {
      bestLetters = shuffled;
      bestQuality = quality;
      break;
    }
  }

  state.lettersGameLetters = bestLetters;
  state.lettersGameUsedWords = [];
  const input = $("lettersGameWordInput");
  if (input) input.value = "";
  setLettersResult("");
  setLettersStatus(bestQuality ? formatDrawQuality(bestQuality) : "Tirage genere.");
  renderLettersGameCard();
  if (state.lettersGameVisible) {
    postToPlateau({ type: "HIDE_MEDIA" });
    sendLettersToPlateau();
  }
}

function renderUsedWords() {
  const el = $("lettersGameUsedWords");
  if (!el) return;
  const words = state.lettersGameUsedWords || [];
  el.textContent = words.length ? `Deja joues: ${words.join(", ")}` : "";
}

function renderLettersGameCard() {
  const card = $("lettersGameCard");
  const lettersEl = $("lettersGameLetters");
  const showBtn = $("btnLettersGameShow");
  const hasLetters = state.lettersGameLetters.length === LETTERS_COUNT;

  if (card) card.classList.remove("hidden");
  if (lettersEl) {
    lettersEl.innerHTML = "";
    state.lettersGameLetters.forEach((letter) => {
      const chip = document.createElement("span");
      chip.className = "letters-game-chip";
      chip.textContent = letter;
      lettersEl.appendChild(chip);
    });
  }
  if (showBtn) {
    showBtn.disabled = !hasLetters;
    showBtn.textContent = state.lettersGameVisible ? "Cacher le plateau" : "Afficher le plateau";
  }
  renderUsedWords();
}

function canBuildWordFromLetters(word) {
  const available = new Map();
  state.lettersGameLetters.forEach((letter) => {
    available.set(letter, (available.get(letter) || 0) + 1);
  });

  for (const letter of word) {
    const count = available.get(letter) || 0;
    if (count <= 0) return false;
    available.set(letter, count - 1);
  }
  return true;
}

function parseLexiconSql(sqlText) {
  const regex = /INSERT INTO `lexique` VALUES\('((?:''|[^'])*)'/g;
  const words = new Set();
  let match;

  while ((match = regex.exec(sqlText)) !== null) {
    const raw = match[1].replace(/''/g, "'");
    const normalized = normalizeWord(raw);
    if (normalized.length >= 2 && normalized.length <= LETTERS_COUNT) {
      words.add(normalized);
    }
  }

  return words;
}

async function ensureLexiconLoaded() {
  if (lexiconReady) return;
  if (lexiconLoadingPromise) return lexiconLoadingPromise;

  setLettersStatus("Chargement du lexique...");
  lexiconLoadingPromise = (async () => {
    const res = await fetch(LEXICON_SQL_PATH, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("lexique.sql introuvable");
    }
    const buffer = await res.arrayBuffer();
    const sqlText = decodeLexiconBuffer(buffer);
    lexiconSet = parseLexiconSql(sqlText);
    lexiconWords = [...lexiconSet];
    lexiconReady = true;
    setLettersStatus(`${lexiconSet.size} mots charges.`);
  })()
    .catch((err) => {
      lexiconReady = false;
      lexiconSet = new Set();
      lexiconWords = [];
      setLettersStatus(`Erreur lexique: ${String(err?.message || err)}`, true);
      throw err;
    })
    .finally(() => {
      lexiconLoadingPromise = null;
    });

  return lexiconLoadingPromise;
}

async function validateLettersWord() {
  const input = $("lettersGameWordInput");
  const rawWord = String(input?.value || "").trim();
  const word = normalizeWord(rawWord);

  if (state.lettersGameLetters.length !== LETTERS_COUNT) {
    setLettersResult("Genere d'abord 10 lettres.", true);
    return;
  }
  if (word.length < 2) {
    setLettersResult("Entre un mot d'au moins 2 lettres.", true);
    return;
  }
  if ((state.lettersGameUsedWords || []).includes(word)) {
    setLettersResult("Ce mot a deja ete valide pour cette manche.", true);
    return;
  }
  if (!canBuildWordFromLetters(word)) {
    setLettersResult("Le mot n'est pas forgeable avec les 10 lettres.", true);
    return;
  }

  try {
    await ensureLexiconLoaded();
  } catch {
    return;
  }

  if (!lexiconSet.has(word)) {
    setLettersResult("Mot absent du lexique.", true);
    return;
  }

  state.lettersGameUsedWords = [...(state.lettersGameUsedWords || []), word];
  renderUsedWords();
  setLettersResult(`Mot valide: ${word} (${word.length} points)`);

  showTeamAwardModal({
    points: word.length,
    answer: word,
    onSelect: (team) => {
      if (!team) return;
      state.currentTeamId = team.id;
      team.points = (team.points ?? 0) + word.length;
      renderTeams();
      syncScoresToPlateau();
    }
  });
}

export function hideLettersGameDisplay() {
  state.lettersGameVisible = false;
  const showBtn = $("btnLettersGameShow");
  if (showBtn) showBtn.textContent = "Afficher le plateau";
  postToPlateau({ type: "SHOW_LETTERS_GAME", visible: false, letters: [] });
}

export function resetLettersGameForNewShow() {
  state.lettersGameLetters = [];
  state.lettersGameVisible = false;
  state.lettersGameUsedWords = [];
  const input = $("lettersGameWordInput");
  if (input) input.value = "";
  setLettersResult("");
  setLettersStatus(lexiconReady ? `${lexiconSet.size} mots charges.` : "");
  renderLettersGameCard();
  hideLettersGameDisplay();
}

export function registerLettersGameEvents() {
  $("btnLettersGame")?.addEventListener("click", async () => {
    $("lettersGameModal")?.classList.toggle("hidden");
    if (!lexiconReady && !lexiconLoadingPromise) {
      try {
        await ensureLexiconLoaded();
      } catch {}
    }
  });

  $("lettersGameModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "lettersGameModal") {
      $("lettersGameModal")?.classList.add("hidden");
    }
  });

  $("btnLettersGameGenerate")?.addEventListener("click", () => {
    generateLetters();
  });

  $("btnLettersGameShow")?.addEventListener("click", () => {
    if (state.lettersGameLetters.length !== LETTERS_COUNT) return;
    state.lettersGameVisible = !state.lettersGameVisible;
    renderLettersGameCard();
    if (state.lettersGameVisible) {
      postToPlateau({ type: "HIDE_MEDIA" });
      sendLettersToPlateau();
    } else {
      hideLettersGameDisplay();
    }
  });

  $("btnLettersGameReset")?.addEventListener("click", () => {
    resetLettersGameForNewShow();
  });

  $("btnLettersGameValidate")?.addEventListener("click", async () => {
    await validateLettersWord();
  });

  $("lettersGameWordInput")?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    await validateLettersWord();
  });

  renderLettersGameCard();
}
