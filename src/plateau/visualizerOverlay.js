let overlay = null;
let canvas = null;
let ctx = null;
let analyser = null;
let data = null;
let raf = 0;
let running = false;

// Perf knobs
const FFT_SIZE = 1024; // reduce to 512 if needed
const BAR_COUNT = 64; // keep low for light rendering
const BAR_GAP = 3;

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.id = "musicVisualizerOverlay";
  overlay.className = "music-visualizer-overlay";

  canvas = document.createElement("canvas");
  canvas.className = "music-visualizer-canvas";
  overlay.appendChild(canvas);

  document.body.appendChild(overlay);
  ctx = canvas.getContext("2d", { alpha: true });
  resize();
  window.addEventListener("resize", resize, { passive: true });
}

function resize() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(window.innerWidth));
  const h = Math.max(1, Math.floor(window.innerHeight));
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setAnalyser(node) {
  if (!node) return;
  ensureOverlay();
  analyser = node;
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.82;
  data = new Uint8Array(analyser.frequencyBinCount);
}

function draw() {
  if (!running || !ctx || !canvas || !analyser || !data) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);

  analyser.getByteFrequencyData(data);

  const bars = Math.min(BAR_COUNT, data.length);
  const halfBars = Math.max(1, Math.floor(bars / 2));
  const drawBars = halfBars * 2;
  const usableW = w * 0.9;
  const centerX = w * 0.5;
  // gap derive de la largeur disponible (leger et responsive)
  const gap = Math.max(1.5, Math.min(8, usableW / (drawBars * 6)));
  const barW = Math.max(2, (usableW - (drawBars - 1) * gap) / drawBars);
  const centerY = h * 0.5;
  const maxH = h * 0.72;
  const step = data.length / halfBars;

  const grad = ctx.createLinearGradient(0, centerY - maxH * 0.5, 0, centerY + maxH * 0.5);
  grad.addColorStop(0, "rgba(255,255,255,0.78)");
  grad.addColorStop(0.5, "rgba(120,230,255,0.95)");
  grad.addColorStop(1, "rgba(60,160,255,0.65)");
  ctx.fillStyle = grad;

  for (let i = 0; i < halfBars; i += 1) {
    const idx = Math.min(data.length - 1, Math.floor(i * step));
    const v = data[idx] / 255;
    const e = Math.pow(v, 1.2);
    const bh = Math.max(6, e * maxH);
    // Origine au centre: i=0 dessine la paire centrale, puis expansion vers l'exterieur.
    const offset = i * (barW + gap);
    const xRight = centerX + gap * 0.5 + offset;
    const xLeft = centerX - gap * 0.5 - barW - offset;
    ctx.fillRect(xRight, centerY - bh * 0.5, barW, bh);
    ctx.fillRect(xLeft, centerY - bh * 0.5, barW, bh);
  }

  raf = window.requestAnimationFrame(draw);
}

function start() {
  ensureOverlay();
  overlay.classList.add("active");
  if (running || !analyser) return;
  running = true;
  draw();
}

function stop() {
  if (overlay) overlay.classList.remove("active");
  running = false;
  if (raf) {
    window.cancelAnimationFrame(raf);
    raf = 0;
  }
  if (ctx) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

export { setAnalyser, start, stop };
