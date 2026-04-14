import {
  state, PRO_LAYER_CONTROLS,
  GLOBAL_CONTROLS, MASK_CONTROLS, STEP_TWO_CONTROLS,
  LAYER_CONTROLS, makeDefaultLayer, complementHue,
} from '../state.js';

// Controls shown for each layer
const SPECTRAL_CONTROLS = LAYER_CONTROLS.filter(([key]) =>
  key === 'sensitizerPeak' || key === 'sensitizerBw'
);
const DYE_CONTROLS = LAYER_CONTROLS.filter(([key]) =>
  key === 'dyePurity' || key === 'dmax'
);
const GRAIN_CONTROLS = [
  ['grainIntensity', 'Grain intensity', 'Grain intensity', '', 0, 1, 0.01, 2],
];

/**
 * Sync all slider values in the current tab to match underlying layer/obj data.
 * Lightweight alternative to full rebuild — call after external mutation (e.g. spectrum drag).
 */
export function syncSliders() {
  const container = document.getElementById('tab-content');
  if (!container || state.activeTab !== 'layers') return;
  const recipe = state.currentRecipe;

  const sections = container.querySelectorAll('.layer-section');
  sections.forEach((section, i) => {
    const obj = recipe.layers[i];
    if (!obj) return;
    section.querySelectorAll('input[type="range"]').forEach(sl => {
      const k = sl.dataset.key;
      const val = obj[k];
      if (val === undefined) return;
      sl.value = val;
      const valEl = sl.closest('.param-row')?.querySelector('.param-value');
      if (valEl) {
        const dec = parseInt(sl.dataset.decimals) || 0;
        const u = sl.dataset.unit || '';
        valEl.textContent = u ? `${val.toFixed(dec)}${u}` : val.toFixed(dec);
      }
    });
    // Also repaint any H&D curve canvas
    const hdCanvas = section.querySelector('.hd-curve-canvas');
    if (hdCanvas && hdCanvas._repaint) hdCanvas._repaint();
  });
}

export function buildTabContent(onInput, onRebuild) {
  const container = document.getElementById('tab-content');
  container.innerHTML = '';

  switch (state.activeTab) {
    case 'layers': buildLayersTab(container, onInput, onRebuild); break;
    case 'base': buildBaseTab(container, onInput); break;
    case 'develop': buildDevelopTab(container, onInput); break;
  }
}

// --- Layers Tab ---
function buildLayersTab(container, onInput, onRebuild) {
  const recipe = state.currentRecipe;

  recipe.layers.forEach((layer, i) => {
    const section = document.createElement('div');
    section.className = 'layer-section';
    if (i === state.selectedLayerIdx) section.classList.add('selected');
    const isSilver = layer.dyePurity < 0.01;

    // Tap to select layer
    section.addEventListener('click', e => {
      if (e.target.closest('input, button, details, canvas')) return;
      state.selectedLayerIdx = i;
      container.querySelectorAll('.layer-section').forEach((s, j) =>
        s.classList.toggle('selected', j === i));
      if (onRebuild) onRebuild();
    });

    // Header
    const header = document.createElement('div');
    header.className = 'layer-header';
    if (!isSilver) {
      const dot = document.createElement('span');
      dot.className = 'layer-dot';
      dot.style.background = `hsl(${layer.dyeHue}, 55%, 45%)`;
      header.appendChild(dot);
    }
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = `${layer.name} (Layer ${i + 1})`;
    header.appendChild(name);

    if (recipe.layers.length > 1) {
      for (const [label, delta] of [['▲', -1], ['▼', 1]]) {
        const btn = document.createElement('button');
        btn.className = 'layer-move';
        btn.textContent = label;
        btn.disabled = (delta === -1 && i === 0) || (delta === 1 && i === recipe.layers.length - 1);
        btn.addEventListener('click', () => {
          const j = i + delta;
          [recipe.layers[i], recipe.layers[j]] = [recipe.layers[j], recipe.layers[i]];
          state.isDirty = true;
          state.selectedLayerIdx = j;
          onRebuild();
        });
        header.appendChild(btn);
      }
      const rm = document.createElement('button');
      rm.className = 'layer-remove';
      rm.textContent = '\u00d7';
      rm.addEventListener('click', () => {
        recipe.layers.splice(i, 1);
        state.isDirty = true;
        if (state.selectedLayerIdx >= recipe.layers.length) {
          state.selectedLayerIdx = recipe.layers.length - 1;
        }
        onRebuild();
      });
      header.appendChild(rm);
    }
    section.appendChild(header);

    const onLayerInput = () => { state.isDirty = true; onInput(); };

    // Spectral: sensitizerPeak, sensitizerBw
    buildGroup(section, layer, SPECTRAL_CONTROLS, onLayerInput);

    // Silver/Color toggle + dye purity slider
    buildSilverToggle(section, layer, () => { state.isDirty = true; onRebuild(); });
    if (!isSilver) {
      buildGroup(section, layer, DYE_CONTROLS, onLayerInput);
    } else {
      // Silver layers still need dmax
      const dmaxOnly = DYE_CONTROLS.filter(([key]) => key === 'dmax');
      buildGroup(section, layer, dmaxOnly, onLayerInput);
    }

    // H&D Curve — collapsible interactive graph + fog slider
    const details = document.createElement('details');
    details.className = 'layer-advanced';
    details.innerHTML = '<summary>H&D Curve</summary>';
    buildHDCurve(details, layer, onLayerInput);
    const FOG_CONTROL = [['fog', 'Base fog', 'Base + fog (Dmin)', '', 0, 0.3, 0.01, 2]];
    buildGroup(details, layer, FOG_CONTROL, () => {
      const hdCanvas = details.querySelector('.hd-curve-canvas');
      if (hdCanvas && hdCanvas._repaint) hdCanvas._repaint();
      onLayerInput();
    });
    section.appendChild(details);

    // Grain intensity slider
    buildGroup(section, layer, GRAIN_CONTROLS, onLayerInput);

    container.appendChild(section);
  });

  if (recipe.layers.length < 5) {
    const addBtn = document.createElement('button');
    addBtn.className = 'action-btn';
    addBtn.textContent = '+ Add Layer';
    addBtn.addEventListener('click', () => {
      recipe.layers.push(makeDefaultLayer(recipe.layers.length));
      state.isDirty = true;
      state.selectedLayerIdx = recipe.layers.length - 1;
      onRebuild();
    });
    container.appendChild(addBtn);
  }
}

// --- Base Tab ---
function buildBaseTab(container, onInput) {
  const recipe = state.currentRecipe;
  buildGroup(container, recipe.global, GLOBAL_CONTROLS, () => { state.isDirty = true; onInput(); });

  const maskHeader = document.createElement('div');
  maskHeader.className = 'section-label';
  maskHeader.textContent = 'Orange Mask';
  container.appendChild(maskHeader);
  buildGroup(container, recipe.global, MASK_CONTROLS, () => { state.isDirty = true; onInput(); });
}

// --- Develop Tab ---
function buildDevelopTab(container, onInput) {
  buildGroup(container, state.labState, STEP_TWO_CONTROLS, onInput);

  const notes = document.createElement('div');
  notes.className = 'lab-notes';
  const lab = state.labState;
  const density = lab.developerActivity;
  const grain = 1 - lab.chemistryFreshness;
  const lines = [];
  if (density > 0.15) lines.push('Pushing density and color separation.');
  else if (density < -0.15) lines.push('Pulling for softer density.');
  else lines.push('Developer activity near neutral.');
  if (grain > 0.2) lines.push('Grain more pronounced.');
  else lines.push('Grain remains fine and controlled.');
  if (lab.bathTemperatureC > 39) lines.push('Higher temperature accelerates development.');
  else if (lab.bathTemperatureC < 37) lines.push('Cool bath for finer grain.');
  notes.innerHTML = `<strong>Lab Notes</strong><br>${lines.join('<br>')}`;
  container.appendChild(notes);
}


// --- Interactive H&D Curve ---
const HD_W = 200, HD_H = 120, HD_PAD = 24;
const TOE_MIN = 0, TOE_MAX = 0.5;
const GAMMA_MIN = 0.3, GAMMA_MAX = 3.0;
const SHO_MIN = 0, SHO_MAX = 0.5;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hdCurve(t, toe, gamma, shoulder) {
  const effRange = Math.max(1 - toe * 0.5 - shoulder * 0.5, 0.01);
  const slope = gamma / effRange;
  if (t <= toe && toe > 0.001) {
    return slope * toe * 0.5 * (t / toe) ** 2;
  } else if (t >= 1 - shoulder && shoulder > 0.001) {
    const s = (t - (1 - shoulder)) / shoulder;
    return slope * (toe * 0.5 + Math.max(1 - toe - shoulder, 0.01)) + slope * shoulder * 0.5 * (2 * s - s * s);
  } else {
    return slope * (toe * 0.5 + (t - toe));
  }
}

function buildHDCurve(container, layer, onInput) {
  const wrap = document.createElement('div');
  wrap.className = 'hd-curve-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'hd-curve-canvas';
  canvas.style.width = '100%';
  canvas.style.height = HD_H + 'px';
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'default';

  // Value labels
  const labelRow = document.createElement('div');
  labelRow.className = 'hd-labels';
  const toeLabel = document.createElement('span');
  const gammaLabel = document.createElement('span');
  const shoLabel = document.createElement('span');
  toeLabel.className = gammaLabel.className = shoLabel.className = 'hd-label';

  function updateLabels() {
    toeLabel.textContent = `Toe ${layer.hdToe.toFixed(2)}`;
    gammaLabel.textContent = `Gamma ${layer.hdGamma.toFixed(2)}`;
    shoLabel.textContent = `Shoulder ${layer.hdShoulder.toFixed(2)}`;
  }
  updateLabels();
  labelRow.appendChild(toeLabel);
  labelRow.appendChild(gammaLabel);
  labelRow.appendChild(shoLabel);

  let dragTarget = null; // 'toe', 'gamma', 'shoulder'
  let cachedW = HD_W;

  function getW() {
    return wrap.getBoundingClientRect().width || HD_W;
  }

  function paint() {
    const dpr = window.devicePixelRatio || 1;
    cachedW = getW();
    canvas.width = cachedW * dpr;
    canvas.height = HD_H * dpr;
    canvas.style.height = HD_H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = cachedW;
    const h = HD_H;
    const pad = HD_PAD;
    const plotW = w - pad * 2;
    const plotH = h - pad * 1.5;
    const plotBottom = h - pad * 0.75;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = plotBottom - (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
      const x = pad + (i / 4) * plotW;
      ctx.beginPath(); ctx.moveTo(x, plotBottom); ctx.lineTo(x, plotBottom - plotH); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('log H', w / 2, h - 1);
    ctx.save();
    ctx.translate(8, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('D', 0, 0);
    ctx.restore();

    // Fixed density scale — max gamma (3.0) produces ~3.0 density
    const toe = layer.hdToe;
    const gamma = layer.hdGamma;
    const shoulder = layer.hdShoulder;
    const fog = layer.fog || 0;
    const dmax = layer.dmax || 2.0;
    const scale = 1 / 3.5;

    // Dmax ceiling line
    const dmaxY = plotBottom - clamp(dmax * scale, 0, 1) * plotH;
    ctx.strokeStyle = 'rgba(255,80,80,0.3)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, dmaxY); ctx.lineTo(w - pad, dmaxY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,80,80,0.35)';
    ctx.font = '8px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Dmax ' + dmax.toFixed(1), w - pad - 2, dmaxY - 3);

    // Fog level line
    if (fog > 0.005) {
      const fogY = plotBottom - clamp(fog * scale, 0, 1) * plotH;
      ctx.strokeStyle = 'rgba(255,200,100,0.25)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, fogY); ctx.lineTo(w - pad, fogY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,200,100,0.3)';
      ctx.font = '8px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('fog', pad + 2, fogY - 3);
    }

    // Draw curve (fog shifts it up, clamped at dmax)
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const t = px / plotW;
      const d = clamp(fog + hdCurve(t, toe, gamma, shoulder), 0, dmax);
      const x = pad + px;
      const y = plotBottom - clamp(d * scale, 0, 1) * plotH;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Region shading
    // Toe region
    const toeEndX = pad + toe * plotW;
    ctx.fillStyle = 'rgba(100,180,255,0.08)';
    ctx.fillRect(pad, plotBottom - plotH, (toeEndX - pad), plotH);

    // Shoulder region
    const shoStartX = pad + (1 - shoulder) * plotW;
    ctx.fillStyle = 'rgba(255,150,100,0.08)';
    ctx.fillRect(shoStartX, plotBottom - plotH, (w - pad - shoStartX), plotH);

    // Drag handles (positions include fog offset)
    // Toe handle: at toe boundary, at curve height
    const toeD = fog + hdCurve(toe, toe, gamma, shoulder);
    const toeHx = toeEndX;
    const toeHy = plotBottom - clamp(toeD * scale, 0, 1) * plotH;
    drawHandle(ctx, toeHx, toeHy, dragTarget === 'toe' ? '#6bb8ff' : 'rgba(100,180,255,0.6)');

    // Shoulder handle: at shoulder boundary
    const shoD = fog + hdCurve(1 - shoulder, toe, gamma, shoulder);
    const shoHx = shoStartX;
    const shoHy = plotBottom - clamp(shoD * scale, 0, 1) * plotH;
    drawHandle(ctx, shoHx, shoHy, dragTarget === 'shoulder' ? '#ffaa66' : 'rgba(255,150,100,0.6)');

    // Gamma handle: midpoint of curve
    const midT = toe + (1 - toe - shoulder) / 2;
    const midD = fog + hdCurve(midT, toe, gamma, shoulder);
    const gammaHx = pad + midT * plotW;
    const gammaHy = plotBottom - clamp(midD * scale, 0, 1) * plotH;
    drawHandle(ctx, gammaHx, gammaHy, dragTarget === 'gamma' ? '#fff' : 'rgba(255,255,255,0.6)');

    // Region labels
    ctx.font = '8px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(100,180,255,0.4)';
    if (toe > 0.08) ctx.fillText('toe', pad + toe * plotW * 0.5, plotBottom - 4);
    ctx.fillStyle = 'rgba(255,150,100,0.4)';
    if (shoulder > 0.08) ctx.fillText('shoulder', pad + (1 - shoulder / 2) * plotW, plotBottom - 4);
  }

  function drawHandle(ctx, x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Hit test — always use fresh width to avoid stale cachedW on first open
  function hitHandle(cx, cy) {
    const w = getW() || cachedW;
    const plotW = w - HD_PAD * 2;
    const plotH = HD_H - HD_PAD * 1.5;
    const plotBottom = HD_H - HD_PAD * 0.75;
    const toe = layer.hdToe, gamma = layer.hdGamma, shoulder = layer.hdShoulder;
    const fog = layer.fog || 0;
    const scale = 1 / 3.5;
    const hitR = 16;

    // Toe
    const toeD = fog + hdCurve(toe, toe, gamma, shoulder);
    const toeHx = HD_PAD + toe * plotW;
    const toeHy = plotBottom - clamp(toeD * scale, 0, 1) * plotH;
    if ((cx - toeHx) ** 2 + (cy - toeHy) ** 2 < hitR ** 2) return 'toe';

    // Shoulder
    const shoD = fog + hdCurve(1 - shoulder, toe, gamma, shoulder);
    const shoHx = HD_PAD + (1 - shoulder) * plotW;
    const shoHy = plotBottom - clamp(shoD * scale, 0, 1) * plotH;
    if ((cx - shoHx) ** 2 + (cy - shoHy) ** 2 < hitR ** 2) return 'shoulder';

    // Gamma (midpoint)
    const midT = toe + (1 - toe - shoulder) / 2;
    const midD = fog + hdCurve(midT, toe, gamma, shoulder);
    const gammaHx = HD_PAD + midT * plotW;
    const gammaHy = plotBottom - clamp(midD * scale, 0, 1) * plotH;
    if ((cx - gammaHx) ** 2 + (cy - gammaHy) ** 2 < hitR ** 2) return 'gamma';

    return null;
  }

  let dragStartY = 0, dragStartVal = 0;

  canvas.addEventListener('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hit = hitHandle(cx, cy);
    if (hit) {
      dragTarget = hit;
      dragStartY = cy;
      if (hit === 'toe') dragStartVal = layer.hdToe;
      else if (hit === 'gamma') dragStartVal = layer.hdGamma;
      else dragStartVal = layer.hdShoulder;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      paint();
    }
  });

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (!dragTarget) {
      const hit = hitHandle(cx, cy);
      canvas.style.cursor = hit ? (hit === 'gamma' ? 'ns-resize' : 'ew-resize') : 'default';
      return;
    }

    const w = cachedW;
    const plotW = w - HD_PAD * 2;
    const plotH = HD_H - HD_PAD * 1.5;
    const dx = (cx - (HD_PAD + dragStartVal * plotW));
    const dy = dragStartY - cy;

    if (dragTarget === 'toe') {
      const t = (cx - HD_PAD) / plotW;
      layer.hdToe = clamp(Math.round(t * 100) / 100, TOE_MIN, TOE_MAX);
    } else if (dragTarget === 'shoulder') {
      const t = (cx - HD_PAD) / plotW;
      layer.hdShoulder = clamp(Math.round((1 - t) * 100) / 100, SHO_MIN, SHO_MAX);
    } else if (dragTarget === 'gamma') {
      const delta = (dy / plotH) * (GAMMA_MAX - GAMMA_MIN) * 1.5;
      layer.hdGamma = clamp(Math.round((dragStartVal + delta) * 100) / 100, GAMMA_MIN, GAMMA_MAX);
    }

    state.isDirty = true;
    updateLabels();
    paint();
    onInput();
  });

  canvas.addEventListener('pointerup', () => {
    dragTarget = null;
    paint();
  });

  canvas.addEventListener('lostpointercapture', () => {
    dragTarget = null;
    paint();
  });

  wrap.appendChild(canvas);
  wrap.appendChild(labelRow);
  container.appendChild(wrap);

  // Expose repaint for external sync
  canvas._repaint = () => { updateLabels(); paint(); };

  // Initial paint after layout
  requestAnimationFrame(paint);
  const ro = new ResizeObserver(() => paint());
  ro.observe(wrap);
}


// --- Slider builder ---
// --- Silver/Color toggle ---
function buildSilverToggle(container, layer, onChange) {
  const row = document.createElement('div');
  row.className = 'param-row silver-toggle-row';

  const label = document.createElement('span');
  label.className = 'param-name';
  label.textContent = 'Emulsion type';

  const toggle = document.createElement('div');
  toggle.className = 'toggle-group mini-toggle';

  for (const [text, isSilver] of [['Silver', true], ['Color dye', false]]) {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn';
    btn.textContent = text;
    if ((layer.dyePurity < 0.01) === isSilver) btn.classList.add('active');
    btn.addEventListener('click', () => {
      if (isSilver) {
        layer._savedDyePurity = layer.dyePurity || 0.7;
        layer.dyePurity = 0;
      } else {
        layer.dyePurity = layer._savedDyePurity || 0.7;
      }
      onChange();
    });
    toggle.appendChild(btn);
  }

  row.appendChild(label);
  row.appendChild(toggle);
  container.appendChild(row);
}

function makeSlider(container, obj, key, _simpleLabel, proLabel, unit, min, max, step, decimals, onInput) {
  const row = document.createElement('div');
  row.className = 'param-row';

  const labelRow = document.createElement('div');
  labelRow.className = 'param-label';
  const nameEl = document.createElement('span');
  nameEl.className = 'param-name';
  nameEl.textContent = proLabel;
  const valEl = document.createElement('span');
  valEl.className = 'param-value';

  const curVal = obj[key] !== undefined ? obj[key] : parseFloat(min);
  valEl.textContent = unit ? `${curVal.toFixed(decimals)}${unit}` : curVal.toFixed(decimals);

  labelRow.appendChild(nameEl);
  labelRow.appendChild(valEl);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min; slider.max = max; slider.step = step;
  slider.value = curVal;
  slider.dataset.key = key;
  slider.dataset.decimals = decimals;
  slider.dataset.unit = unit || '';

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    obj[key] = v;
    if (key === 'sensitizerPeak') {
      obj.dyeHue = complementHue(v);
    }
    valEl.textContent = unit ? `${v.toFixed(decimals)}${unit}` : v.toFixed(decimals);
    onInput();
  });

  row.appendChild(labelRow);
  row.appendChild(slider);
  container.appendChild(row);
}

function buildGroup(container, obj, controls, onInput) {
  for (const [key, label, proLabel, unit, min, max, step, dec] of controls) {
    makeSlider(container, obj, key, label, proLabel, unit, min, max, step, dec, onInput);
  }
}
