import { PLATEAU_MUSIC } from "../core/constants.js";

export class AudioManager {
  constructor({ publicAudioEl, publicVideoEl } = {}) {
    this.ctx = null;
    this.music = { el: null, source: null, gain: null, target: 1.0 };
    this.sfx = { el: null, currentToken: 0 };
    this.publicAudioEl = publicAudioEl;
    this.publicVideoEl = publicVideoEl;

    this._ducking = { isDucking: false, base: 1.0, duck: 0.02, attackMs: 30, releaseMs: 400 };
  }

  async init() {
    if (this.ctx) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // musique plateau via <audio> pour robustesse de loop, + GainNode pour ducking
    const el = new Audio();
    el.src = PLATEAU_MUSIC;
    el.loop = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";

    const source = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = 1.7;

    source.connect(gain).connect(this.ctx.destination);
    this.music = { el, source, gain, target: 1.0 };

    // un seul canal SFX à la fois (superposition interdite)
    this.sfx.el = new Audio();
    this.sfx.el.preload = "auto";
    this.sfx.el.crossOrigin = "anonymous";

    // “Public media” (vidéo / audio) = éléments séparés, volume géré + ducking
    if (this.publicVideoEl) {
      this.publicVideoEl.controls = false;
      this.publicVideoEl.autoplay = false;
      this.publicVideoEl.loop = false;
    }
    if (this.publicAudioEl) {
      this.publicAudioEl.controls = false;
      this.publicAudioEl.autoplay = false;
      this.publicAudioEl.loop = false;
    }

    // essayer de démarrer musique (souvent bloqué sans geste utilisateur)
    await this.ensureMusicRunning();
  }

  async ensureMusicRunning() {
    await this.init();
    try {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      if (this.music.el.paused) await this.music.el.play();
    } catch (e) {
      // Pas de panique : on réessaiera au prochain clic (plateau)
      console.warn("Music start blocked:", e);
    }
  }

  _setMusicGainSmooth(target, ms) {
    if (!this.music?.gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const g = this.music.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + ms / 1000);
  }

  duckOn() {
    this._ducking.isDucking = true;
    this._setMusicGainSmooth(this._ducking.duck, this._ducking.attackMs);
  }

  duckOff() {
    this._ducking.isDucking = false;
    this._setMusicGainSmooth(this._ducking.base, this._ducking.releaseMs);
  }

  async playSfx(src) {
    await this.ensureMusicRunning();

    // stop immédiat du SFX précédent
    this.stopSfx();

    // ducking pendant le sfx
    this.duckOn();

    const token = ++this.sfx.currentToken;
    const el = this.sfx.el;

    try {
      el.src = src;
      el.currentTime = 0;
      await el.play();
    } catch (e) {
      console.warn("SFX play failed:", e);
      this.duckOff();
      return;
    }

    const onEnd = () => {
      if (this.sfx.currentToken !== token) return;
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("pause", onEnd);
      this.duckOff();
    };
    el.addEventListener("ended", onEnd);
    el.addEventListener("pause", onEnd);
  }

  stopSfx() {
    const el = this.sfx.el;
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {}
  }

  async playMedia({ type, src }) {
    await this.ensureMusicRunning();
    this.duckOn();

    // stop tout média public existant
    this.stopMedia();

    if (type === "video" && this.publicVideoEl) {
      this.publicVideoEl.src = src;
      this.publicVideoEl.currentTime = 0;
      this.publicVideoEl.onended = () => this.duckOff();
      try { await this.publicVideoEl.play(); } catch (e) { console.warn(e); this.duckOff(); }
    } else if (type === "audio" && this.publicAudioEl) {
      this.publicAudioEl.src = src;
      this.publicAudioEl.currentTime = 0;
      this.publicAudioEl.onended = () => this.duckOff();
      try { await this.publicAudioEl.play(); } catch (e) { console.warn(e); this.duckOff(); }
    } else {
      console.warn("Unknown media type or missing element", type);
      this.duckOff();
    }
  }

  stopMedia() {
    // ne coupe JAMAIS la musique plateau
    if (this.publicVideoEl) {
      try { this.publicVideoEl.pause(); this.publicVideoEl.removeAttribute("src"); this.publicVideoEl.load(); } catch {}
    }
    if (this.publicAudioEl) {
      try { this.publicAudioEl.pause(); this.publicAudioEl.removeAttribute("src"); this.publicAudioEl.load(); } catch {}
    }
    this.duckOff();
  }
}
