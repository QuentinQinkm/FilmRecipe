import {
  state, SIMPLE_LAYER_CONTROLS, PRO_LAYER_CONTROLS,
  GLOBAL_CONTROLS, MASK_CONTROLS, STEP_TWO_CONTROLS,
  LAYER_CONTROLS, makeDefaultLayer, tonePreset, toneFromHD,
} from '../state.js';
// topbar.js imports removed — Save/SaveAs now live in topbar

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
      if (e.target.closest('input, button, details')) return;
      state.selectedLayerIdx = i;
      // Highlight in DOM
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

    // All layer controls (sensitizerPeak, sensitizerBw, dyePurity, dmax, tone, crystalSize)
    const layerControls = [
      ...LAYER_CONTROLS.filter(([key]) =>
        key === 'sensitizerPeak' || key === 'sensitizerBw' || key === 'dyePurity' || key === 'dmax'
      ),
      ...SIMPLE_LAYER_CONTROLS,
    ];
    buildGroup(section, layer, layerControls, () => { state.isDirty = true; onInput(); });

    if (state.proMode) {
      const adv = document.createElement('details');
      adv.className = 'layer-advanced';
      adv.innerHTML = '<summary>H&D Curve Parameters</summary>';
      buildGroup(adv, layer, PRO_LAYER_CONTROLS, () => { state.isDirty = true; onInput(); });
      section.appendChild(adv);
    }

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


// --- Slider builder ---
function makeSlider(container, obj, key, label, proLabel, unit, min, max, step, decimals, onInput) {
  const row = document.createElement('div');
  row.className = 'param-row';

  const labelRow = document.createElement('div');
  labelRow.className = 'param-label';
  const nameEl = document.createElement('span');
  nameEl.className = 'param-name';
  nameEl.textContent = state.proMode ? proLabel : label;
  const valEl = document.createElement('span');
  valEl.className = 'param-value';

  let curVal;
  if (key === 'tone') {
    curVal = obj.tone !== undefined ? obj.tone : toneFromHD(obj.hdGamma || 0.7);
  } else {
    curVal = obj[key] !== undefined ? obj[key] : parseFloat(min);
  }
  valEl.textContent = unit ? `${curVal.toFixed(decimals)}${unit}` : curVal.toFixed(decimals);

  labelRow.appendChild(nameEl);
  labelRow.appendChild(valEl);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min; slider.max = max; slider.step = step;
  slider.value = curVal;
  slider.dataset.key = key;

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    if (key === 'tone') {
      obj.tone = v;
      const tp = tonePreset(v);
      obj.hdToe = tp.hdToe; obj.hdGamma = tp.hdGamma; obj.hdShoulder = tp.hdShoulder;
    } else {
      obj[key] = v;
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
