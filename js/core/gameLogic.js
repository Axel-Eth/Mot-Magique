import { SFX } from "./constants.js";

/**
 * Grid format attendu (minimal):
 * grid = {
 *   rows, cols,
 *   cells: [{ r,c, char, blocked, magic } ...] // char: "A"-"Z" ou ""
 *   words: [{ id, direction:"H"|"V", cells:[{r,c}], answer, definition, number }]
 *   magicWordId: string|null
 * }
 */

function normLetter(ch) {
  if (!ch) return "";
  return ch.toUpperCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export const GameLogic = {
  canRevealLetter(state, letter) {
    const L = normLetter(letter);
    if (!L || L.length !== 1 || !/[A-Z]/.test(L)) return { ok: false, reason: "Lettre invalide." };

    const grid = state.grid;
    if (!grid) return { ok: false, reason: "Aucune grille chargée." };

    if (state.revealedLetters.includes(L)) return { ok: false, reason: "Lettre déjà révélée." };

    // Règle spéciale E: seulement si dernière restante
    if (L === "E") {
      const remaining = this._remainingRevealableLetters(state);
      if (remaining.length !== 1 || remaining[0] !== "E") {
        return { ok: false, reason: "E interdit tant qu’il reste d’autres lettres révélables." };
      }
    }
    return { ok: true };
  },

  revealLetter(state, letter) {
    const L = normLetter(letter);
    const check = this.canRevealLetter(state, L);
    if (!check.ok) return { state, effects: [], error: check.reason };

    const next = structuredClone(state);
    next.revealedLetters.push(L);

    // Effet: jouer son lettre révélée (côté Plateau)
    return { state: next, effects: [{ type: "sfx", src: SFX.LETTER_REVEAL }] };
  },

  selectTeam(state, teamId) {
    const next = structuredClone(state);
    const exists = next.teams.some(t => t.id === teamId);
    if (!exists) return { state, effects: [], error: "Équipe inconnue." };
    next.selection.teamId = teamId;
    return { state: next, effects: [] };
  },

  selectWord(state, wordId) {
    const next = structuredClone(state);
    if (!next.selection.teamId) return { state, effects: [], error: "Sélectionne une équipe d’abord." };

    const grid = next.grid;
    const word = grid?.words?.find(w => w.id === wordId);
    if (!word) return { state, effects: [], error: "Mot introuvable." };

    // déjà validé ?
    if (next.validatedWords[wordId]?.ok) return { state, effects: [], error: "Mot déjà validé." };

    next.selection.wordId = wordId;
    return { state: next, effects: [{ type: "sfx", src: SFX.WORD_SELECT }] };
  },

  validateWord(state, { correct }) {
    const next = structuredClone(state);
    const { teamId, wordId } = next.selection;
    if (!teamId || !wordId) return { state, effects: [], error: "Sélection incomplète (équipe + mot)." };

    const word = next.grid?.words?.find(w => w.id === wordId);
    if (!word) return { state, effects: [], error: "Mot introuvable." };

    if (correct) {
      const points = word.answer?.length ?? word.cells.length ?? 0;
      next.validatedWords[wordId] = { ok: true, teamId, points };

      // score
      const team = next.teams.find(t => t.id === teamId);
      if (team) team.score += points;

      // mot magique ?
      if (next.magic?.wordId === wordId && !next.magic.found) {
        next.magic.found = true;
        team.score += 30;
      }

      // on garde équipe sélectionnée (tu peux changer la règle plus tard)
      next.selection.wordId = null;

      return { state: next, effects: [{ type: "sfx", src: SFX.CORRECT }] };
    } else {
      // NOP: aucun point, désélection équipe, pas de bug audio
      next.validatedWords[wordId] = next.validatedWords[wordId] ?? { ok: false };
      next.selection.teamId = null;
      next.selection.wordId = null;
      return { state: next, effects: [{ type: "sfx", src: SFX.FAIL }] };
    }
  },

  _remainingRevealableLetters(state) {
    const grid = state.grid;
    if (!grid) return [];

    const magicId = state.magic?.wordId ?? grid.magicWordId ?? null;
    const magicCells = new Set();
    if (magicId) {
      const w = grid.words.find(x => x.id === magicId);
      w?.cells?.forEach(rc => magicCells.add(`${rc.r},${rc.c}`));
    }

    const letters = new Set();
    for (const cell of grid.cells ?? []) {
      if (cell.blocked) continue;
      const key = `${cell.r},${cell.c}`;
      if (magicCells.has(key)) continue; // jamais révélable automatiquement
      const L = normLetter(cell.char);
      if (L && !state.revealedLetters.includes(L)) letters.add(L);
    }
    return Array.from(letters).sort();
  },
};
