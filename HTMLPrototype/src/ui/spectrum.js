import { state, complementHue } from '../state.js';

const WL_MIN = 380;
const WL_MAX = 700;
const WL_RANGE = WL_MAX - WL_MIN;
const POINTER_R = 18;
const MAX_DMAX = 3.5;
const MIN_DMAX = 0.5;
const DMAX_RANGE = MAX_DMAX - MIN_DMAX;

const RAINBOW = [
  [380, [100, 0, 180]], [440, [0, 0, 255]],
  [490, [0, 180, 255]], [510, [0, 255, 128]],
  [560, [180, 255, 0]], [590, [255, 220, 0]],
  [620, [255, 128, 0]], [700, [200, 0, 0]],
];

const isFinePointer = window.matchMedia('(pointer: fine)').matches;

function wlToRgb(wl) {
  let lo = RAINBOW[0], hi = RAINBOW[RAINBOW.length - 1];
  for (let i = 0; i < RAINBOW.length - 1; i++) {
    if (wl >= RAINBOW[i][0] && wl <= RAINBOW[i + 1][0]) {
      lo = RAINBOW[i]; hi = RAINBOW[i + 1]; break;
    }
  }
  const t = (wl - lo[0]) / Math.max(hi[0] - lo[0], 1);
  return lo[1].map((v, k) => Math.round(v + (hi[1][k] - v) * t));
}

function wlToX(wl, w) { return ((wl - WL_MIN) / WL_RANGE) * w; }
function xToWl(x, w) { return WL_MIN + (x / w) * WL_RANGE; }
function gauss(wl, peak, bw) {
  const s = bw / 2.355;
  const d = (wl - peak) / s;
  return Math.exp(-0.5 * d * d);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// --- Layout constants ---
const BAR_H = 24;
const ABSORB_H = 8;
const CURVE_H = 100;
const POINTER_ZONE = POINTER_R * 2 + 4;
const TOTAL_H = BAR_H + ABSORB_H + CURVE_H + POINTER_ZONE;
const CURVE_TOP = BAR_H + ABSORB_H;
const CURVE_BOT = CURVE_TOP + CURVE_H;

function dmaxToH(dmax) {
  return clamp((dmax - MIN_DMAX) / DMAX_RANGE, 0, 1) * CURVE_H;
}

// --- Drawing ---

function drawSpectrumBar(ctx, w) {
  for (let x = 0; x < w; x++) {
    const [r, g, b] = wlToRgb(xToWl(x, w));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, 0, 1, BAR_H);
  }
}

function drawAbsorptionBand(ctx, layers, w, isBW) {
  for (let x = 0; x < w; x++) {
    const wl = xToWl(x, w);
    let total = 0;
    for (const L of layers) {
      const g = gauss(wl, L.sensitizerPeak, L.sensitizerBw);
      const strength = (isBW ? 0.5 : L.dyePurity) * (clamp(isBW ? 2.5 : L.dmax, MIN_DMAX, MAX_DMAX) / MAX_DMAX);
      total += g * strength;
    }
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, total * 0.6)})`;
    ctx.fillRect(x, BAR_H, 1, ABSORB_H);
  }
}

function drawBellCurve(ctx, layer, w, isBW, dimFactor, isSelected) {
  const peak = layer.sensitizerPeak;
  const bw = layer.sensitizerBw;
  const dmax = isBW ? 2.5 : (layer.dmax || 2.0);
  const purity = isBW ? 0.5 : (layer.dyePurity || 0.5);
  const hue = isBW ? 0 : layer.dyeHue;
  const sat = isBW ? '0%' : '55%';
  const bellH = dmaxToH(dmax);
  const alpha = (0.15 + purity * 0.45) * dimFactor * (isSelected ? 1 : 0.6);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, CURVE_BOT);
  for (let x = 0; x <= w; x++) {
    const g = gauss(xToWl(x, w), peak, bw);
    ctx.lineTo(x, CURVE_BOT - g * bellH);
  }
  ctx.lineTo(w, CURVE_BOT);
  ctx.closePath();
  ctx.fillStyle = `hsla(${hue}, ${sat}, 50%, ${alpha})`;
  ctx.fill();

  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const g = gauss(xToWl(x, w), peak, bw);
    if (x === 0) ctx.moveTo(x, CURVE_BOT - g * bellH);
    else ctx.lineTo(x, CURVE_BOT - g * bellH);
  }
  ctx.strokeStyle = `hsla(${hue}, ${sat}, 65%, ${(isSelected ? 0.7 : 0.3) * dimFactor})`;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();
  ctx.restore();
}

function drawHdMini(ctx, layer, w, isBW) {
  const peak = layer.sensitizerPeak;
  const dmax = isBW ? 2.5 : (layer.dmax || 2.0);
  const bellH = dmaxToH(dmax);
  if (bellH < 20) return;
  const cx = wlToX(peak, w);
  const topY = CURVE_BOT - bellH;
  const mW = 22, mH = 14;
  const toe = layer.hdToe || 0.2;
  const gamma = clamp(layer.hdGamma || 0.7, 0.3, 3.0);
  const sho = layer.hdShoulder || 0.15;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= mW; i++) {
    const t = i / mW;
    const effRange = Math.max(1 - toe * 0.5 - sho * 0.5, 0.01);
    const slope = gamma / effRange;
    let den;
    if (t <= toe && toe > 0.001) { den = slope * toe * 0.5 * (t / toe) ** 2; }
    else if (t >= 1 - sho && sho > 0.001) {
      const s = (t - (1 - sho)) / sho;
      den = slope * (toe * 0.5 + Math.max(1 - toe - sho, 0.01)) + slope * sho * 0.5 * (2 * s - s * s);
    } else { den = slope * (toe * 0.5 + (t - toe)); }
    den = clamp(den / (gamma * 1.5), 0, 1);
    const px = cx - mW / 2 + i;
    const py = topY + 5 + mH - den * mH;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawGrainDots() {
  // Removed: grain dots no longer meaningful with 1px=1grain model
}

function drawOverlapZones(ctx, layers, w, isBW) {
  if (layers.length < 2) return;
  for (let x = 0; x < w; x += 2) {
    const wl = xToWl(x, w);
    let overlapping = 0;
    for (const L of layers) {
      if (gauss(wl, L.sensitizerPeak, L.sensitizerBw) > 0.25) overlapping++;
    }
    if (overlapping >= 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, CURVE_TOP, 2, CURVE_H);
    }
  }
}

function drawPointer(ctx, x, fillColor, isActive) {
  const baseY = CURVE_BOT;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, baseY - 6);
  ctx.lineTo(x - 6, baseY + POINTER_R * 0.4);
  ctx.arc(x, baseY + POINTER_R, POINTER_R, -Math.PI + 0.4, -0.4, false);
  ctx.lineTo(x + 6, baseY + POINTER_R * 0.4);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = isActive ? '#fff' : 'rgba(0,0,0,0.35)';
  ctx.lineWidth = isActive ? 2.5 : 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawBwEdgeHandles(ctx, layer, w, bellH) {
  if (!isFinePointer) return; // hide drag handles on touch
  const halfBw = layer.sensitizerBw / 2;
  const leftX = wlToX(layer.sensitizerPeak - halfBw, w);
  const rightX = wlToX(layer.sensitizerPeak + halfBw, w);
  const handleY = CURVE_BOT - bellH * 0.5;
  for (const hx of [leftX, rightX]) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, handleY, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function drawDmaxHandle(ctx, layer, w, bellH, isBW) {
  if (!isFinePointer) return; // hide drag handles on touch
  const cx = wlToX(layer.sensitizerPeak, w);
  const topY = CURVE_BOT - bellH;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 6, topY);
  ctx.lineTo(cx + 6, topY);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, topY, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  ctx.restore();
}

// --- Hit testing ---
const HIT_NONE = 0, HIT_POINTER = 1, HIT_TOP = 2, HIT_EDGE_L = 3, HIT_EDGE_R = 4;

function hitTest(cx, cy, recipe, w) {
  const layers = recipe.layers;
  const isBW = recipe.layers.every(l => l.dyePurity < 0.01);

  for (let i = 0; i < layers.length; i++) {
    const px = wlToX(layers[i].sensitizerPeak, w);
    const py = CURVE_BOT + POINTER_R;
    if ((cx - px) ** 2 + (cy - py) ** 2 <= (POINTER_R + 10) ** 2) {
      return { type: HIT_POINTER, idx: i };
    }
  }

  if (!isFinePointer) return { type: HIT_NONE, idx: -1 }; // touch: only pointer taps

  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const dmax = isBW ? 2.5 : (L.dmax || 2.0);
    const bellH = dmaxToH(dmax);
    const px = wlToX(L.sensitizerPeak, w);
    const topY = CURVE_BOT - bellH;
    if (Math.abs(cx - px) < 18 && Math.abs(cy - topY) < 14 && cy >= CURVE_TOP) {
      return { type: HIT_TOP, idx: i };
    }
  }

  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const dmax = isBW ? 2.5 : (L.dmax || 2.0);
    const bellH = dmaxToH(dmax);
    const halfBw = L.sensitizerBw / 2;
    const lx = wlToX(L.sensitizerPeak - halfBw, w);
    const rx = wlToX(L.sensitizerPeak + halfBw, w);
    const edgeY = CURVE_BOT - bellH * 0.5;
    if (cy >= CURVE_TOP && cy <= CURVE_BOT) {
      if (Math.abs(cx - lx) < 16 && Math.abs(cy - edgeY) < 20)
        return { type: HIT_EDGE_L, idx: i };
      if (Math.abs(cx - rx) < 16 && Math.abs(cy - edgeY) < 20)
        return { type: HIT_EDGE_R, idx: i };
    }
  }
  return { type: HIT_NONE, idx: -1 };
}

// --- Public API ---

/**
 * Build a persistent spectrum visualization.
 * @param {HTMLElement} container - element to mount into
 * @param {object} callbacks - { onInput, onRebuild, onLayerSelect(idx) }
 * @returns handle with { repaint, setRecipe, setActiveLayer, destroy }
 */
export function buildSpectrum(container, callbacks) {
  const { onInput, onRebuild, onLayerSelect } = callbacks;

  const wrap = document.createElement('div');
  wrap.className = 'spectrum-wrap';
  const canvas = document.createElement('canvas');
  canvas.className = 'spectrum-canvas';
  canvas.style.touchAction = 'none';
  wrap.appendChild(canvas);

  let recipe = state.currentRecipe;
  let activeIdx = state.selectedLayerIdx;
  let dragInfo = null;
  let cachedW = 300;

  function getWidth() {
    return wrap.getBoundingClientRect().width || 300;
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cachedW = getWidth();
    canvas.width = cachedW * dpr;
    canvas.height = TOTAL_H * dpr;
    canvas.style.width = cachedW + 'px';
    canvas.style.height = TOTAL_H + 'px';
    return { w: cachedW, dpr };
  }

  function paint() {
    if (!recipe) return;
    const { w, dpr } = resize();
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, TOTAL_H);

    drawSpectrumBar(ctx, w);

    const layers = recipe.layers;
    const isBW = layers.every(l => l.dyePurity < 0.01);
    const stackStr = recipe.global?.stackingStrength || 0;

    drawAbsorptionBand(ctx, layers, w, isBW);
    drawOverlapZones(ctx, layers, w, isBW);

    for (let i = layers.length - 1; i >= 0; i--) {
      const dim = 1 - (i / Math.max(layers.length, 1)) * stackStr * 0.4;
      drawBellCurve(ctx, layers[i], w, isBW, dim, i === activeIdx);
    }

    for (let i = 0; i < layers.length; i++) {
      drawHdMini(ctx, layers[i], w, isBW);
    }

    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const dmax = isBW ? 2.5 : (L.dmax || 2.0);
      const bellH = dmaxToH(dmax);
      drawBwEdgeHandles(ctx, L, w, bellH);
      if (!isBW) drawDmaxHandle(ctx, L, w, bellH, isBW);
    }

    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const x = wlToX(L.sensitizerPeak, w);
      const hue = isBW ? 0 : L.dyeHue;
      const sat = isBW ? '0%' : '55%';
      drawPointer(ctx, x, `hsl(${hue}, ${sat}, 45%)`, i === activeIdx);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let wl = 400; wl <= 700; wl += 50) {
      ctx.fillText(wl + '', wlToX(wl, w), TOTAL_H - 2);
    }
  }

  // --- Pointer events ---

  canvas.addEventListener('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const w = cachedW;
    const hit = hitTest(cx, cy, recipe, w);

    if (hit.type === HIT_POINTER) {
      // Always allow selecting a layer by tapping its pointer
      activeIdx = hit.idx;
      state.selectedLayerIdx = hit.idx;
      if (onLayerSelect) onLayerSelect(hit.idx);

      if (isFinePointer) {
        // Desktop: also start dragging
        const L = recipe.layers[hit.idx];
        const isBW = recipe.layers.every(l => l.dyePurity < 0.01);
        dragInfo = {
          type: hit.type, idx: hit.idx,
          startX: cx, startY: cy,
          startPeak: L.sensitizerPeak,
          startBw: L.sensitizerBw,
          startDmax: isBW ? 2.5 : (L.dmax || 2.0),
        };
        canvas.setPointerCapture(e.pointerId);
      }
      paint();
      e.preventDefault();
      return;
    }

    if (hit.type !== HIT_NONE && isFinePointer) {
      // Desktop: drag dmax top or bandwidth edges
      const L = recipe.layers[hit.idx];
      const isBW = recipe.layers.every(l => l.dyePurity < 0.01);
      dragInfo = {
        type: hit.type, idx: hit.idx,
        startX: cx, startY: cy,
        startPeak: L.sensitizerPeak,
        startBw: L.sensitizerBw,
        startDmax: isBW ? 2.5 : (L.dmax || 2.0),
      };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const w = cachedW;

    if (!dragInfo) {
      if (!isFinePointer) return;
      const hit = hitTest(cx, cy, recipe, w);
      const cursors = {
        [HIT_NONE]: 'default', [HIT_POINTER]: 'grab',
        [HIT_TOP]: 'ns-resize', [HIT_EDGE_L]: 'ew-resize', [HIT_EDGE_R]: 'ew-resize',
      };
      canvas.style.cursor = cursors[hit.type] || 'default';
      return;
    }

    const L = recipe.layers[dragInfo.idx];
    const isBW = recipe.layers.every(l => l.dyePurity < 0.01);

    if (dragInfo.type === HIT_POINTER) {
      const deltaWl = ((cx - dragInfo.startX) / w) * WL_RANGE;
      L.sensitizerPeak = Math.round(clamp(dragInfo.startPeak + deltaWl, WL_MIN, WL_MAX));
      L.dyeHue = complementHue(L.sensitizerPeak);
    } else if (dragInfo.type === HIT_TOP && !isBW) {
      const deltaY = dragInfo.startY - cy;
      const deltaDmax = (deltaY / CURVE_H) * DMAX_RANGE;
      L.dmax = clamp(dragInfo.startDmax + deltaDmax, MIN_DMAX, MAX_DMAX);
      L.dmax = Math.round(L.dmax * 100) / 100;
    } else if (dragInfo.type === HIT_EDGE_L || dragInfo.type === HIT_EDGE_R) {
      const peakX = wlToX(L.sensitizerPeak, w);
      const dist = Math.abs(cx - peakX);
      const halfBwWl = (dist / w) * WL_RANGE;
      L.sensitizerBw = Math.round(clamp(halfBwWl * 2, 30, 200));
    }

    state.isDirty = true;
    paint();
    onInput();
  });

  canvas.addEventListener('pointerup', e => {
    if (dragInfo) {
      dragInfo = null;
    }
  });

  canvas.addEventListener('lostpointercapture', () => { dragInfo = null; });

  container.appendChild(wrap);
  requestAnimationFrame(paint);
  const ro = new ResizeObserver(() => paint());
  ro.observe(wrap);

  return {
    repaint: paint,
    setRecipe(r) { recipe = r; paint(); },
    setActiveLayer(idx) { activeIdx = idx; paint(); },
    destroy() { ro.disconnect(); wrap.remove(); },
  };
}
