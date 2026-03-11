import { initBackgroundBubbles } from "./letters.js";

const BG_THEME_BUBBLES = "bubbles";
const BG_THEME_RETRO = "retro";
const BG_STORAGE_KEY = "avm_plateau_background_theme_v1";

const PAL = {
  skyTop: "#5fa9ff",
  skyMid: "#87c7ff",
  skyBottom: "#c6ebff",
  sun: "#ffe27a",
  cloud: "#ffffff",
  cloudShade: "#dfeeff",
  farHill: "#79c85c",
  farHillShade: "#5ea446",
  midHill: "#56b14b",
  midHillShade: "#3f8c38",
  hillSpot: "#7ddc66",
  bush: "#35a847",
  bushShade: "#2a8438",
  groundGrass: "#4ac94a",
  groundGrassLight: "#78df6b",
  dirt: "#9c6636",
  dirtDark: "#7f4d27",
  brick: "#bf6f39",
  brickDark: "#8f4f2a",
  blockQ: "#f9c93c",
  blockQDark: "#d99d1f",
  pipe: "#27b34f",
  pipeDark: "#1f8d3f",
  pipeLight: "#53d773"
};

let retroCanvas = null;
let retroCtx = null;
let retroWidth = 0;
let retroHeight = 0;
let retroGroundY = 0;
let retroAnimId = 0;
let retroLastTime = 0;
let retroT = 0;
let retroResizeBound = false;

function normalizeTheme(value) {
  return String(value || "").toLowerCase() === BG_THEME_RETRO ? BG_THEME_RETRO : BG_THEME_BUBBLES;
}

function loadSavedTheme() {
  try {
    return normalizeTheme(localStorage.getItem(BG_STORAGE_KEY));
  } catch {
    return BG_THEME_BUBBLES;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(BG_STORAGE_KEY, normalizeTheme(theme));
  } catch {}
}

function getBgRoot() {
  return document.getElementById("bg");
}

function ensureRetroCanvas() {
  if (!retroCanvas) {
    retroCanvas = document.getElementById("retroBgCanvas");
  }
  if (!retroCanvas || retroCtx) return;
  retroCtx = retroCanvas.getContext("2d");
}

function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function resizeRetroCanvas() {
  if (!retroCanvas || !retroCtx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  retroWidth = window.innerWidth;
  retroHeight = window.innerHeight;
  retroCanvas.width = Math.floor(retroWidth * dpr);
  retroCanvas.height = Math.floor(retroHeight * dpr);
  retroCanvas.style.width = `${retroWidth}px`;
  retroCanvas.style.height = `${retroHeight}px`;
  retroCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  retroCtx.imageSmoothingEnabled = false;
  retroGroundY = Math.floor(retroHeight * 0.84);
}

function rect(x, y, w, h, color) {
  retroCtx.fillStyle = color;
  retroCtx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function circle(x, y, r, color) {
  retroCtx.fillStyle = color;
  retroCtx.beginPath();
  retroCtx.arc(x, y, r, 0, Math.PI * 2);
  retroCtx.fill();
}

function drawSky() {
  const grad = retroCtx.createLinearGradient(0, 0, 0, retroHeight);
  grad.addColorStop(0, PAL.skyTop);
  grad.addColorStop(0.58, PAL.skyMid);
  grad.addColorStop(1, PAL.skyBottom);
  retroCtx.fillStyle = grad;
  retroCtx.fillRect(0, 0, retroWidth, retroHeight);

  const sunX = retroWidth * 0.82;
  const sunY = Math.min(retroHeight * 0.22, retroGroundY - 120);
  circle(sunX, sunY, Math.min(retroWidth, retroHeight) * 0.06, PAL.sun);
  circle(sunX - 8, sunY - 8, Math.min(retroWidth, retroHeight) * 0.03, "rgba(255,250,210,0.35)");
}

function drawCloudSprite(x, y, s, body, shade) {
  rect(x + s * 1, y + s * 2, s * 14, s * 5, body);
  rect(x + s * 3, y, s * 4, s * 4, body);
  rect(x + s * 7, y - s, s * 5, s * 5, body);
  rect(x + s * 11, y + s, s * 3, s * 3, body);
  rect(x + s * 2, y + s * 5, s * 12, s * 2, shade);
}

function drawClouds(speed, alpha, bandY, size, spacing) {
  const scroll = retroT * speed;
  const start = Math.floor(scroll / spacing) - 1;
  const end = Math.ceil((scroll + retroWidth) / spacing) + 1;
  retroCtx.globalAlpha = alpha;
  for (let i = start; i <= end; i++) {
    const x = i * spacing - scroll;
    const y = bandY + Math.floor(Math.sin(i * 0.9 + retroT * 0.4) * 4);
    const s = size + Math.floor(hash01(i * 2.3) * (size * 0.5));
    drawCloudSprite(x, y, s, PAL.cloud, PAL.cloudShade);
  }
  retroCtx.globalAlpha = 1;
}

function drawHills(speed, baseY, spacing, minW, maxW, minH, maxH, main, shade, spot, faces) {
  const scroll = retroT * speed;
  const start = Math.floor((scroll - maxW) / spacing) - 1;
  const end = Math.ceil((scroll + retroWidth + maxW) / spacing) + 1;

  for (let i = start; i <= end; i++) {
    const x = i * spacing - scroll;
    const w = minW + Math.floor(hash01(i * 3.7) * (maxW - minW));
    const h = minH + Math.floor(hash01(i * 8.1) * (maxH - minH));

    retroCtx.fillStyle = main;
    retroCtx.beginPath();
    retroCtx.moveTo(x, baseY);
    retroCtx.quadraticCurveTo(x + w * 0.5, baseY - h, x + w, baseY);
    retroCtx.closePath();
    retroCtx.fill();

    retroCtx.fillStyle = shade;
    retroCtx.beginPath();
    retroCtx.moveTo(x + w * 0.48, baseY);
    retroCtx.quadraticCurveTo(x + w * 0.78, baseY - h * 0.7, x + w, baseY);
    retroCtx.closePath();
    retroCtx.fill();

    circle(x + w * 0.35, baseY - h * 0.45, Math.max(5, h * 0.12), spot);
    circle(x + w * 0.58, baseY - h * 0.33, Math.max(4, h * 0.09), spot);

    if (faces) {
      const eyeY = baseY - h * 0.28;
      rect(x + w * 0.46, eyeY, 4, 9, "#1a2d19");
      rect(x + w * 0.56, eyeY, 4, 9, "#1a2d19");
      rect(x + w * 0.46, eyeY, 2, 2, "#ffffff");
      rect(x + w * 0.56, eyeY, 2, 2, "#ffffff");
    }
  }
}

function drawFloor() {
  rect(0, retroGroundY, retroWidth, retroHeight - retroGroundY, PAL.dirt);
  rect(0, retroGroundY, retroWidth, 8, PAL.groundGrass);
  rect(0, retroGroundY + 2, retroWidth, 3, PAL.groundGrassLight);

  const tile = 26;
  const scroll = retroT * 180;
  const start = Math.floor(scroll / tile) - 1;
  const end = Math.ceil((scroll + retroWidth) / tile) + 1;
  const groundH = retroHeight - (retroGroundY + 8);

  for (let i = start; i <= end; i++) {
    const x = i * tile - scroll;
    rect(x, retroGroundY + 8, tile - 1, groundH, PAL.dirt);
    rect(x + 2, retroGroundY + 12, tile - 5, 4, "#b97942");
    rect(x + 4, retroGroundY + 20, 5, 5, PAL.dirtDark);
    rect(x + 15, retroGroundY + 17, 4, 4, PAL.dirtDark);
  }
}

function drawPipe(x, h) {
  rect(x, retroGroundY - h, 54, h, PAL.pipe);
  rect(x - 6, retroGroundY - h, 66, 16, PAL.pipeLight);
  rect(x + 7, retroGroundY - h + 8, 8, h - 8, "rgba(255,255,255,0.20)");
  rect(x + 38, retroGroundY - h + 8, 10, h - 8, PAL.pipeDark);
  rect(x + 2, retroGroundY - h + 16, 50, 3, PAL.pipeDark);
}

function drawBrickBlock(x, y) {
  rect(x, y, 30, 30, PAL.brick);
  rect(x + 1, y + 1, 28, 4, "#d58a4f");
  rect(x + 14, y, 2, 30, PAL.brickDark);
  rect(x, y + 14, 30, 2, PAL.brickDark);
  rect(x + 5, y + 7, 4, 4, "#d58a4f");
  rect(x + 20, y + 20, 4, 4, "#d58a4f");
}

function drawQuestionBlock(x, y, pulse) {
  rect(x, y, 30, 30, PAL.blockQ);
  rect(x + 2, y + 2, 26, 4, "#ffe688");
  rect(x + 2, y + 24, 26, 4, PAL.blockQDark);
  rect(x + 12, y + 8, 6, 4, "#9b5d17");
  rect(x + 18, y + 12, 4, 4, "#9b5d17");
  rect(x + 12, y + 16, 4, 4, "#9b5d17");
  rect(x + 13, y + 22 + pulse, 4, 4, "#9b5d17");
}

function drawPipesAndBlocks() {
  const speed = 180;
  const scroll = retroT * speed;
  const loopSize = 2400;
  const pulse = Math.floor(Math.abs(Math.sin(retroT * 6)) * 2);
  const items = [
    { x: 220, type: "pipe", h: 66 },
    { x: 430, type: "brickRow", y: retroGroundY - 116, count: 3 },
    { x: 560, type: "question", y: retroGroundY - 148 },
    { x: 760, type: "pipe", h: 82 },
    { x: 980, type: "question", y: retroGroundY - 126 },
    { x: 1130, type: "brickRow", y: retroGroundY - 174, count: 2 },
    { x: 1370, type: "pipe", h: 56 },
    { x: 1590, type: "brickRow", y: retroGroundY - 120, count: 4 },
    { x: 1860, type: "question", y: retroGroundY - 164 },
    { x: 2050, type: "pipe", h: 94 }
  ];
  const startLoop = Math.floor((scroll - 220) / loopSize);
  const endLoop = Math.ceil((scroll + retroWidth + 220) / loopSize);

  for (let loop = startLoop; loop <= endLoop; loop++) {
    const loopOffset = loop * loopSize;
    for (const item of items) {
      const x = item.x + loopOffset - scroll;
      if (x < -240 || x > retroWidth + 120) continue;
      if (item.type === "pipe") {
        drawPipe(x, item.h);
      } else if (item.type === "question") {
        drawQuestionBlock(x, item.y + pulse, pulse);
      } else if (item.type === "brickRow") {
        for (let j = 0; j < item.count; j++) {
          drawBrickBlock(x + j * 32, item.y + (j % 2 ? -4 : 0));
        }
      }
    }
  }
}

function drawShrubs() {
  const speed = 118;
  const spacing = 190;
  const scroll = retroT * speed;
  const start = Math.floor((scroll - 120) / spacing) - 1;
  const end = Math.ceil((scroll + retroWidth + 120) / spacing) + 1;

  for (let i = start; i <= end; i++) {
    const x = i * spacing - scroll;
    const y = retroGroundY - 6;
    const w = 52 + Math.floor(hash01(i * 5.2) * 30);
    const h = 24 + Math.floor(hash01(i * 9.3) * 12);
    circle(x + w * 0.2, y - h * 0.45, h * 0.48, PAL.bush);
    circle(x + w * 0.5, y - h * 0.58, h * 0.58, PAL.bush);
    circle(x + w * 0.82, y - h * 0.45, h * 0.46, PAL.bush);
    rect(x, y - h * 0.38, w, h * 0.4, PAL.bush);
    rect(x + 4, y - h * 0.12, w - 8, 4, PAL.bushShade);
  }
}

function drawRunner() {
  const baseX = retroWidth * 0.28;
  const cycle = retroT * 14;
  const stride = Math.sin(cycle);
  const strideOpp = Math.sin(cycle + Math.PI);
  const bob = Math.abs(Math.sin(cycle)) * 2.4;
  const y = retroGroundY - 42 + bob;
  const lean = stride * 1.4;
  rect(baseX + 1 + lean, y + 1, 16, 20, "#df3e2f");
  rect(baseX + 5 + lean, y - 9, 10, 10, "#ffd7a3");
  rect(baseX + 2 + lean, y - 13, 16, 6, "#cc2b1f");
  rect(baseX + 9 + lean, y - 6, 4, 2, "#2c1d14");
  rect(baseX + 7 + lean, y - 2, 2, 2, "#2c1d14");

  const legA = 13 + Math.max(0, stride * 6);
  const legB = 13 + Math.max(0, strideOpp * 6);
  rect(baseX + lean, y + 21, 7, legA, "#2f4b98");
  rect(baseX + 10 + lean, y + 21, 7, legB, "#2f4b98");
  rect(baseX - 1 + lean, y + 34 + Math.max(0, stride * 2), 9, 4, "#241f1a");
  rect(baseX + 10 + lean, y + 34 + Math.max(0, strideOpp * 2), 9, 4, "#241f1a");

  const armA = 4 + Math.max(0, strideOpp * 4);
  const armB = 4 + Math.max(0, stride * 4);
  rect(baseX - 5 + lean, y + 6, 6, armA, "#ffd7a3");
  rect(baseX + 17 + lean, y + 6, 6, armB, "#ffd7a3");
}

function drawScanlines() {
  const isLargeScreen = retroWidth >= 1920 || retroHeight >= 1080;
  const hStep = isLargeScreen ? 6 : 4;
  const vStep = isLargeScreen ? 8 : 6;
  const hAlpha = isLargeScreen ? 0.008 : 0.02;
  const vAlpha = isLargeScreen ? 0.015 : 0.035;

  retroCtx.fillStyle = `rgba(255,255,255,${hAlpha})`;
  for (let y = 0; y < retroHeight; y += hStep) {
    retroCtx.fillRect(0, y, retroWidth, 1);
  }

  retroCtx.fillStyle = `rgba(0,0,0,${vAlpha})`;
  for (let x = 0; x < retroWidth; x += vStep) {
    retroCtx.fillRect(x, 0, 1, retroHeight);
  }
}

function renderRetro(now) {
  const dt = Math.min((now - retroLastTime) / 1000, 0.033);
  retroLastTime = now;
  retroT += dt;
  drawSky();
  drawClouds(4, 0.78, retroHeight * 0.14, 4, 280);
  drawHills(9, retroGroundY - 20, 280, 180, 300, 70, 120, PAL.farHill, PAL.farHillShade, PAL.hillSpot, false);
  drawClouds(8, 0.62, retroHeight * 0.24, 3, 240);
  drawHills(17, retroGroundY + 8, 230, 150, 250, 52, 96, PAL.midHill, PAL.midHillShade, "#73cc5d", true);
  drawFloor();
  drawShrubs();
  drawPipesAndBlocks();
  drawRunner();
  drawScanlines();
  retroAnimId = requestAnimationFrame(renderRetro);
}

function startRetroAnimation() {
  ensureRetroCanvas();
  if (!retroCanvas || !retroCtx) return;
  if (!retroResizeBound) {
    window.addEventListener("resize", resizeRetroCanvas);
    retroResizeBound = true;
  }
  resizeRetroCanvas();
  if (retroAnimId) return;
  retroLastTime = performance.now();
  retroAnimId = requestAnimationFrame(renderRetro);
}

function stopRetroAnimation() {
  if (retroAnimId) {
    cancelAnimationFrame(retroAnimId);
    retroAnimId = 0;
  }
  if (retroCtx && retroWidth && retroHeight) {
    retroCtx.clearRect(0, 0, retroWidth, retroHeight);
  }
}

export function applyBackgroundTheme(theme, options = {}) {
  const normalized = normalizeTheme(theme);
  const persist = options.persist !== false;
  const root = getBgRoot();
  if (root) {
    root.dataset.theme = normalized;
  }

  if (normalized === BG_THEME_RETRO) {
    startRetroAnimation();
  } else {
    stopRetroAnimation();
    initBackgroundBubbles();
  }

  if (persist) {
    saveTheme(normalized);
  }
  return normalized;
}

export function initBackgroundTheme() {
  return applyBackgroundTheme(loadSavedTheme(), { persist: false });
}
