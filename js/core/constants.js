export const APP_VERSION = 1;
export const STORAGE_KEY = "avm_state_v1";
export const CHANNEL_NAME = "avm";

export const SFX = {
  LETTER_REVEAL: "/sounds/lettre_revele_regie.mp3",
  WORD_SELECT: "/sounds/selection_mot_grille.mp3",
  CORRECT: "/sounds/correct_answer.mp3",
  FAIL: "/sounds/fail_sound_effect.mp3",
};

export const PLATEAU_MUSIC = "/sounds/musique-plateau/musique_plateau.mp3";

export const MEDIA_PRESETS = {
  generique: { type: "video", src: "/sounds/generique_avm_new.mp4" },
  mot_double: { type: "video", src: "/sounds/mot_double_new.mp4" },
  mot_triple: { type: "video", src: "/sounds/mot_triple_new.mp4" },
  bad_word: { type: "video", src: "/sounds/bad_word_new.mp4" },
};

export const COMMANDS = {
  STATE_PATCH: "STATE_PATCH",
  PLAY_SFX: "PLAY_SFX",
  PLAY_MEDIA: "PLAY_MEDIA",
  STOP_MEDIA: "STOP_MEDIA",
  REVEAL_LETTER: "REVEAL_LETTER",
  SELECT_TEAM: "SELECT_TEAM",
  SELECT_WORD: "SELECT_WORD",
  VALIDATE_WORD: "VALIDATE_WORD",
  RESET: "RESET",
};
