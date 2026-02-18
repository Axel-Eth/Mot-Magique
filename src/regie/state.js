export const CUSTOM_STORAGE_KEY = "avm_custom_grids";
const LETTER_REGEX = /^\p{L}$/u;

export function isSingleLetter(value) {
  return LETTER_REGEX.test(String(value || ""));
}

export const state = {
  plateauWin: null,
  gridList: [],
  grid: null,
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
  capitalesLastFile: "",
  lastMusicSrc: "",
  lastFilmsSrc: "",
  lastPeopleSrc: "",
  lastPeopleLabel: "",
  generalQuestions: [],
  generalQuestionCurrent: null,
  generalQuestionVisible: false,
  generalQuestionChoicesVisible: false,
  generalQuestionChoicesRevealCount: 0,
  generalQuestionAnswerMarks: {}
};
