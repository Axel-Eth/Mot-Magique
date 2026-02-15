import { APP_VERSION, STORAGE_KEY } from "./constants.js";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class StateManager {
  constructor(initialState) {
    this._listeners = new Set();
    this._state = initialState ?? this._load() ?? this._defaultState();
    this._save();
  }

  _defaultState() {
    return {
      meta: { version: APP_VERSION, updatedAt: Date.now() },
      grid: null, // chargé via JSON
      revealedLetters: [], // ["A","B"...] (hors mot magique)
      validatedWords: {}, // wordId -> { ok: true, teamId, points }
      selection: { teamId: null, wordId: null },
      teams: [], // {id,name,color,score}
      magic: { wordId: null, found: false },
    };
  }

  getState() {
    return deepClone(this._state);
  }

  setState(nextState) {
    this._state = deepClone(nextState);
    this._state.meta.updatedAt = Date.now();
    this._save();
    this._emit();
  }

  patch(partial) {
    const next = this.getState();
    // patch superficiel contrôlé (simple et robuste)
    for (const k of Object.keys(partial)) next[k] = partial[k];
    next.meta.updatedAt = Date.now();
    this._state = next;
    this._save();
    this._emit();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    fn(this.getState());
    return () => this._listeners.delete(fn);
  }

  _emit() {
    const snapshot = this.getState();
    for (const fn of this._listeners) fn(snapshot);
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
    } catch (e) {
      console.warn("State save failed:", e);
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.meta?.version) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  clear() {
    localStorage.removeItem(STORAGE_KEY);
    this._state = this._defaultState();
    this._save();
    this._emit();
  }
}
