import { StateManager } from "../core/stateManager.js";
import { Comm } from "../core/comm.js";
import { COMMANDS, MEDIA_PRESETS } from "../core/constants.js";
import { GameLogic } from "../core/gameLogic.js";
import { AudioManager } from "./audioManager.js";
import { renderPlateau } from "./plateauUI.js";

async function loadDefaultGrid() {
  // Placeholder: tu remplaceras par import de /data/grids/xxx.json
  // Pour éviter “null partout”
  return {
    rows: 5,
    cols: 5,
    cells: Array.from({ length: 25 }, (_, i) => {
      const r = Math.floor(i / 5), c = i % 5;
      return { r, c, char: "", blocked: false, magic: false };
    }),
    words: [],
    magicWordId: null,
  };
}

const statusEl = document.getElementById("status");
const publicVideoEl = document.getElementById("publicVideo");
const publicAudioEl = document.getElementById("publicAudio");

const stateManager = new StateManager();
const comm = new Comm();

const audio = new AudioManager({ publicAudioEl, publicVideoEl });
await audio.init();

// tenter musique au chargement (sera bloqué si pas de geste)
audio.ensureMusicRunning();

let booted = false;
async function bootstrapGridIfNeeded() {
  const st = stateManager.getState();
  if (!st.grid) {
    const grid = await loadDefaultGrid();
    stateManager.patch({ grid, magic: { wordId: grid.magicWordId, found: false } });
  }
  booted = true;
}
await bootstrapGridIfNeeded();

stateManager.subscribe((st) => {
  statusEl.textContent = `État: v${st.meta.version} — ${new Date(st.meta.updatedAt).toLocaleTimeString()}`;
  renderPlateau(st);
});

// Permet de “débloquer” l’audio au premier clic sur plateau
window.addEventListener("pointerdown", () => audio.ensureMusicRunning(), { once: false });

comm.onMessage(async (msg) => {
  if (!msg?.type) return;

  const st = stateManager.getState();

  switch (msg.type) {
    case COMMANDS.PLAY_SFX:
      await audio.playSfx(msg.src);
      break;

    case COMMANDS.PLAY_MEDIA: {
      const preset = msg.preset ? MEDIA_PRESETS[msg.preset] : null;
      const media = preset ?? msg.media;
      if (media) await audio.playMedia(media);
      break;
    }

    case COMMANDS.STOP_MEDIA:
      audio.stopMedia();
      break;

    case COMMANDS.STATE_PATCH:
      // patch venant de régie (ex: team rename). On applique.
      if (msg.partial) stateManager.patch(msg.partial);
      break;

    case COMMANDS.REVEAL_LETTER: {
      const res = GameLogic.revealLetter(st, msg.letter);
      if (res.error) {
        // Plateau ne gueule pas à l’écran (tu peux), mais il ne casse rien.
        console.warn("Reveal denied:", res.error);
        break;
      }
      stateManager.setState(res.state);
      for (const eff of res.effects) if (eff.type === "sfx") await audio.playSfx(eff.src);
      break;
    }

    case COMMANDS.SELECT_TEAM: {
      const res = GameLogic.selectTeam(st, msg.teamId);
      if (!res.error) stateManager.setState(res.state);
      break;
    }

    case COMMANDS.SELECT_WORD: {
      const res = GameLogic.selectWord(st, msg.wordId);
      if (res.error) break;
      stateManager.setState(res.state);
      for (const eff of res.effects) if (eff.type === "sfx") await audio.playSfx(eff.src);
      break;
    }

    case COMMANDS.VALIDATE_WORD: {
      const res = GameLogic.validateWord(st, { correct: !!msg.correct });
      if (res.error) break;
      stateManager.setState(res.state);
      for (const eff of res.effects) if (eff.type === "sfx") await audio.playSfx(eff.src);
      break;
    }

    case COMMANDS.RESET:
      stateManager.clear();
      await bootstrapGridIfNeeded();
      audio.stopMedia();
      await audio.ensureMusicRunning();
      break;
  }
});
