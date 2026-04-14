# Touch-First UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Film Lab's UI with a mobile-first, tab-based editor layout while preserving the rendering engine unchanged.

**Architecture:** 4-tab bottom tray (Film/Layers/Base/Develop), persistent film strip, unified recipe model (no stock vs custom split), always-editable spectrum. Engine files (renderer.js) untouched. State model simplified. lab-mapping.js removed; development logic inlined.

**Tech Stack:** Vanilla JS ES modules, CSS custom properties, Pointer Events API, no build tools.

---

### Task 1: Update state.js — Simplified State Model

**Files:**
- Modify: `src/state.js`

**Step 1: Update state.js**

Remove `customMode`, `labBaseRecipe`, `STEP_ONE_CONTROLS`, `STEP_ONE_ADVANCED`. Add `activeTab`, `recipeName`, `isDirty`, `currentTemplate`. Inline development mapping as `applyDevelopment()`. Keep all template data, control definitions, and utility functions.

```js
// At top of file, after existing imports/constants:

// Remove these exports: STEP_ONE_CONTROLS, STEP_ONE_ADVANCED
// Remove from state object: customMode, labBaseRecipe

// Add to state object:
//   activeTab: 'film',
//   currentTemplate: 'Portra 400',
//   recipeName: '',
//   isDirty: false,

// Add new exported function (replaces lab-mapping.js):
export function applyDevelopment(recipe, lab) {
  if (!lab) return recipe;
  const out = cloneRecipe(recipe);
  const tempDelta = lab.bathTemperatureC - 38;
  const timeDelta = lab.developmentTimeMin - 3.5;
  const freshPenalty = 1 - lab.chemistryFreshness;
  const processBias = lab.developerActivity * 0.42 + tempDelta * 0.03 + timeDelta * 0.15;

  out.layers.forEach(layer => {
    const isBW = out.filmType === 'bw';
    layer.hdGamma = clamp(
      layer.hdGamma * (1 + processBias * 0.23 - freshPenalty * 0.15), 0.5, 3.0);
    layer.hdToe = clamp(
      layer.hdToe - processBias * 0.03 + freshPenalty * 0.02, 0, 0.5);
    layer.hdShoulder = clamp(
      layer.hdShoulder + processBias * 0.03, 0, 0.5);
    const grainGrowth = 1 + Math.max(0, tempDelta) * 0.03 + freshPenalty * 0.45;
    layer.crystalSize = clamp(layer.crystalSize * grainGrowth, 0.1, 2.0);
    if (!isBW) {
      layer.dyePurity = clamp(
        layer.dyePurity * (1 + processBias * 0.12 - freshPenalty * 0.1), 0, 1);
      layer.dmax = clamp(
        layer.dmax * (1 + processBias * 0.2 - freshPenalty * 0.2), 0.1, 3.0);
    }
  });

  out.global.dirInhibition = clamp(
    recipe.global.dirInhibition + (lab.agitationLevel - 0.5) * 0.45 + processBias * 0.08, 0, 1);
  if (out.filmType === 'negative') {
    out.global.maskDensity = clamp(
      recipe.global.maskDensity + freshPenalty * 0.1 + Math.max(0, tempDelta) * 0.008, 0, 1);
    out.global.maskHue = clamp(recipe.global.maskHue + tempDelta * 0.5, 0, 60);
  }
  const coolShift = clamp((38 - lab.bathTemperatureC) * 0.004, -0.05, 0.05);
  out.global.baseTintR = clamp(recipe.global.baseTintR - coolShift * 0.7, 0.8, 1.0);
  out.global.baseTintG = clamp(recipe.global.baseTintG + coolShift * 0.2, 0.8, 1.0);
  out.global.baseTintB = clamp(recipe.global.baseTintB + coolShift * 0.8, 0.8, 1.0);
  return out;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
```

**Step 2: Verify module loads**

Run: open browser console, `import('/src/state.js').then(m => console.log(Object.keys(m)))`
Expected: exports include `applyDevelopment`, `activeTab` absent from old exports, no `STEP_ONE_CONTROLS`.

**Step 3: Commit**

```bash
git add src/state.js
git commit -m "refactor: simplify state model, inline development mapping"
```

---

### Task 2: Remove lab-mapping.js

**Files:**
- Delete: `src/engine/lab-mapping.js`

**Step 1: Delete the file**

```bash
rm src/engine/lab-mapping.js
```

**Step 2: Commit**

```bash
git add -u
git commit -m "remove: lab-mapping.js, replaced by state.applyDevelopment()"
```

---

### Task 3: Rewrite index.html — Layout Shell

**Files:**
- Rewrite: `index.html`

**Step 1: Write new HTML shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0c0c0c">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Film Lab</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>

  <header class="topbar">
    <span class="wordmark">Film Lab</span>
    <div class="topbar-right">
      <div class="toggle-group" id="mode-toggle">
        <button class="toggle-btn active" data-mode="simple">Simple</button>
        <button class="toggle-btn" data-mode="pro">Pro</button>
      </div>
    </div>
  </header>

  <div class="canvas-area" id="canvas-area">
    <div class="upload-prompt" id="upload-prompt">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span>Tap to load a photo</span>
    </div>
    <canvas id="output-canvas"></canvas>
    <div class="ref-overlay" id="ref-overlay">
      <canvas id="ref-canvas"></canvas>
      <div class="ref-divider"></div>
      <span class="ref-label">Reference</span>
    </div>
    <div class="canvas-pills">
      <button class="pill-btn" id="raw-btn">Raw</button>
      <button class="pill-btn" id="ref-btn">Ref</button>
    </div>
  </div>

  <div class="film-strip" id="film-strip"></div>

  <div class="tab-content" id="tab-content"></div>

  <nav class="tab-bar" id="tab-bar">
    <button class="tab active" data-tab="film">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="4"/><line x1="2" y1="8" x2="6" y2="8"/><line x1="18" y1="8" x2="22" y2="8"/></svg>
      <span>Film</span>
    </button>
    <button class="tab" data-tab="layers">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 12 15 2 8.5"/><polyline points="2 15.5 12 22 22 15.5"/></svg>
      <span>Layers</span>
    </button>
    <button class="tab" data-tab="base">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
      <span>Base</span>
    </button>
    <button class="tab" data-tab="develop">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6l3 7-6 11-6-11z"/><line x1="12" y1="10" x2="12" y2="14"/></svg>
      <span>Develop</span>
    </button>
  </nav>

  <input type="file" id="file-input" accept="image/*" hidden>
  <script type="module" src="src/main.js"></script>

</body>
</html>
```

**Step 2: Commit**

```bash
git add index.html
git commit -m "rewrite: index.html with tab-based layout shell"
```

---

### Task 4: Rewrite styles/main.css — Mobile-First

**Files:**
- Rewrite: `styles/main.css`

**Step 1: Write complete mobile-first CSS**

Full CSS covering: CSS custom properties (dark theme), topbar, canvas-area (flex-grow), film-strip (horizontal scroll, scroll-snap), tab-bar (grid, safe-area), tab-content (max-height 42vh, overflow-y scroll), slider styling (24px coarse thumb), param-row layout, layer-section styling, spectrum-wrap, spectrum-popup / bottom-sheet, toggle-group, pill-btn floating, upload-prompt, responsive breakpoints (768px sidebar, 1400px wide).

Key CSS structure:

```css
:root {
  --bg: #0c0c0c; --surface: #1a1a1a; --surface-raised: #242424;
  --border: #333; --text: #e8e8e8; --text-2: #999; --text-3: #666;
  --active-bg: #fff; --active-text: #000; --tab-h: 50px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased; overflow: hidden; }
body { display: flex; flex-direction: column; }

.topbar { height: 44px; flex-shrink: 0; display: flex; align-items: center;
  padding: 0 16px; padding-top: env(safe-area-inset-top); }
.canvas-area { flex: 1; min-height: 0; position: relative; }
.film-strip { height: 48px; flex-shrink: 0; overflow-x: auto;
  scroll-snap-type: x mandatory; display: flex; align-items: center;
  gap: 8px; padding: 0 12px; border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border); }
.tab-content { max-height: 42vh; overflow-y: auto; flex-shrink: 0;
  -webkit-overflow-scrolling: touch; padding: 12px 16px; }
.tab-bar { height: var(--tab-h); flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom);
  display: grid; grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--border); background: var(--surface); }

@media (min-width: 768px) {
  body { flex-direction: row; }
  .topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 10; }
  /* sidebar + image row layout */
}
```

This is a large file (~500 lines). Write the complete CSS with all component styles.

**Step 2: Verify layout in browser**

Open `http://localhost:8765`, resize to mobile (375×812). Verify: topbar at top, dark canvas area fills middle, film strip visible, tab bar at bottom.

**Step 3: Commit**

```bash
git add styles/main.css
git commit -m "rewrite: mobile-first CSS with tab-based layout"
```

---

### Task 5: Rewrite src/ui/canvas.js — Tap-to-Upload

**Files:**
- Rewrite: `src/ui/canvas.js`

**Step 1: Write simplified canvas module**

Same logic as current canvas.js but:
- Remove upload-zone element references (use `upload-prompt` + `canvas-area` tap)
- `canvas-area` click triggers file input when no image loaded
- Drag-drop on `canvas-area`
- Raw/Ref buttons use new `pill-btn` class and IDs
- Export `initCanvas(renderer, onRender)` with same return shape

```js
import { state, cloneTemplate } from '../state.js';
import { renderFilmCPU } from '../engine/renderer.js';

export function initCanvas(renderer, onRender) {
  const fileInput = document.getElementById('file-input');
  const canvasArea = document.getElementById('canvas-area');
  const uploadPrompt = document.getElementById('upload-prompt');
  const refOverlay = document.getElementById('ref-overlay');
  const refCanvas = document.getElementById('ref-canvas');
  const refCtx = refCanvas.getContext('2d');
  const rawBtn = document.getElementById('raw-btn');
  const refBtn = document.getElementById('ref-btn');

  let decodeCanvas = document.createElement('canvas');
  let decodeCtx = decodeCanvas.getContext('2d');
  let sourceImageData = null;

  function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxW = 1600;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      decodeCanvas.width = w; decodeCanvas.height = h;
      decodeCtx.drawImage(img, 0, 0, w, h);
      sourceImageData = decodeCtx.getImageData(0, 0, w, h);
      renderer.setImage(decodeCanvas, w, h);
      uploadPrompt.style.display = 'none';
      URL.revokeObjectURL(url);
      onRender();
    };
    img.src = url;
  }

  fileInput.addEventListener('change', e => loadImageFile(e.target.files[0]));
  canvasArea.addEventListener('click', e => {
    if (!renderer.hasImage && e.target.closest('.pill-btn') === null) fileInput.click();
  });
  canvasArea.addEventListener('dragover', e => { e.preventDefault(); });
  canvasArea.addEventListener('drop', e => {
    e.preventDefault(); loadImageFile(e.dataTransfer.files[0]);
  });

  rawBtn.addEventListener('click', () => {
    state.rawMode = !state.rawMode;
    rawBtn.classList.toggle('active', state.rawMode);
    onRender();
  });

  refBtn.addEventListener('click', () => {
    state.referenceActive = !state.referenceActive;
    refBtn.classList.toggle('active', state.referenceActive);
    refOverlay.classList.toggle('visible', state.referenceActive);
    if (state.referenceActive && sourceImageData) renderReference();
  });

  function renderReference() {
    const refRecipe = cloneTemplate(state.currentTemplate);
    const result = renderFilmCPU(sourceImageData, refRecipe, false);
    if (!result) return;
    refCanvas.width = result.width; refCanvas.height = result.height;
    refCtx.putImageData(result, 0, 0);
  }

  return { renderReference, get hasImage() { return renderer.hasImage; } };
}
```

**Step 2: Commit**

```bash
git add src/ui/canvas.js
git commit -m "rewrite: canvas.js with tap-to-upload, no upload zone"
```

---

### Task 6: Rewrite src/ui/topbar.js — Minimal Topbar + Film Strip

**Files:**
- Rewrite: `src/ui/topbar.js`

**Step 1: Write simplified topbar module**

Handles: Pro/Simple toggle, building the film strip, Save/Save As (triggered from Film tab). No more stock/custom mode switching — selecting any template clones it.

```js
import {
  state, STOCK_TEMPLATES, cloneTemplate, cloneRecipe,
  loadSavedRecipes, saveCustomRecipe, deleteCustomRecipe,
  createBlankRecipe, LAB_DEFAULTS,
} from '../state.js';

let callbacks = {};

export function initTopbar(cbs) {
  callbacks = cbs;
  state.savedRecipes = loadSavedRecipes();
  buildFilmStrip();

  // Pro/Simple toggle
  document.querySelectorAll('#mode-toggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.proMode = btn.dataset.mode === 'pro';
      document.querySelectorAll('#mode-toggle .toggle-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
      callbacks.onModeChange();
    });
  });
}

export function selectTemplate(name) {
  state.currentTemplate = name;
  state.recipeName = '';
  state.isDirty = false;
  state.currentRecipe = cloneTemplate(name);
  state.labState = { ...LAB_DEFAULTS };
  highlightStrip(name, false);
  callbacks.onTemplateChange();
}

export function selectSaved(name) {
  const saved = state.savedRecipes[name];
  if (!saved) return;
  state.currentTemplate = '';
  state.recipeName = name;
  state.isDirty = false;
  state.currentRecipe = cloneRecipe(saved);
  state.labState = { ...LAB_DEFAULTS };
  highlightStrip(name, true);
  callbacks.onTemplateChange();
}

export function doSave() {
  if (!state.recipeName) return doSaveAs();
  saveCustomRecipe(state.recipeName, state.currentRecipe);
  state.isDirty = false;
  buildFilmStrip();
}

export function doSaveAs() {
  const name = prompt('Film name:');
  if (!name || !name.trim()) return;
  state.recipeName = name.trim();
  saveCustomRecipe(state.recipeName, state.currentRecipe);
  state.isDirty = false;
  state.currentTemplate = '';
  buildFilmStrip();
}

export function doNewFilm() {
  const type = state.currentRecipe?.filmType || 'negative';
  state.currentRecipe = createBlankRecipe(type);
  state.currentTemplate = '';
  state.recipeName = '';
  state.isDirty = false;
  state.labState = { ...LAB_DEFAULTS };
  highlightStrip('', false);
  callbacks.onTemplateChange();
}

function highlightStrip(name, isSaved) {
  document.querySelectorAll('.film-chip').forEach(b => {
    if (isSaved) b.classList.toggle('active', b.dataset.saved === name);
    else b.classList.toggle('active', b.dataset.template === name);
  });
}

export function buildFilmStrip() {
  const strip = document.getElementById('film-strip');
  strip.innerHTML = '';

  const typeMap = {
    'Portra 400': 'neg', 'Gold 200': 'neg',
    'Velvia 50': 'pos', 'Kodachrome 64': 'pos',
    'Ilford HP5': 'bw', 'Kodak Tri-X': 'bw',
  };

  let lastType = null;
  for (const name of Object.keys(STOCK_TEMPLATES)) {
    const type = typeMap[name];
    if (lastType && type !== lastType) {
      const sep = document.createElement('span');
      sep.className = 'strip-sep';
      strip.appendChild(sep);
    }
    lastType = type;
    const btn = document.createElement('button');
    btn.className = 'film-chip';
    btn.textContent = name;
    btn.dataset.template = name;
    if (state.currentTemplate === name) btn.classList.add('active');
    btn.addEventListener('click', () => selectTemplate(name));
    strip.appendChild(btn);
  }

  // Saved recipes
  const saved = state.savedRecipes;
  const savedNames = Object.keys(saved);
  if (savedNames.length > 0) {
    strip.appendChild(Object.assign(document.createElement('span'), { className: 'strip-sep' }));
    for (const name of savedNames) {
      const wrap = document.createElement('span');
      wrap.className = 'saved-chip-wrap';
      const btn = document.createElement('button');
      btn.className = 'film-chip';
      btn.textContent = name;
      btn.dataset.saved = name;
      if (state.recipeName === name) btn.classList.add('active');
      btn.addEventListener('click', () => selectSaved(name));
      const del = document.createElement('button');
      del.className = 'chip-delete';
      del.textContent = '\u00d7';
      del.addEventListener('click', e => {
        e.stopPropagation();
        deleteCustomRecipe(name);
        if (state.recipeName === name) state.recipeName = '';
        buildFilmStrip();
      });
      wrap.appendChild(btn);
      wrap.appendChild(del);
      strip.appendChild(wrap);
    }
  }

  // + New
  strip.appendChild(Object.assign(document.createElement('span'), { className: 'strip-sep' }));
  const newBtn = document.createElement('button');
  newBtn.className = 'film-chip new-chip';
  newBtn.textContent = '+ New';
  newBtn.addEventListener('click', doNewFilm);
  strip.appendChild(newBtn);
}
```

**Step 2: Commit**

```bash
git add src/ui/topbar.js
git commit -m "rewrite: topbar.js with minimal topbar + film strip"
```

---

### Task 7: Create src/ui/tabs.js — Tab Content Builder

**Files:**
- Create: `src/ui/tabs.js`
- Delete: `src/ui/panel.js`

**Step 1: Write tabs.js**

This replaces panel.js. It exports `buildTabContent(tabName, onInput, onRebuild)` which builds the content for the active tab into `#tab-content`.

Key sections:
- `buildFilmTab()` — film type toggle + spectrum (always editable) + Save/Save As/Upload actions
- `buildLayersTab()` — per-layer slider sections with add/remove/reorder
- `buildBaseTab()` — global controls + mask controls
- `buildDevelopTab()` — dev environment sliders + lab notes

Uses `makeSlider()` helper (same pattern as current panel.js) for consistent slider rendering.

The film type toggle in the Film tab uses a unified `switchFilmType(type)` function that works on `state.currentRecipe` directly (merging the old switchStockFilmType and switchCustomFilmType).

Spectrum is always built with `editable: true`.

Layer sections link to spectrum via the existing `syncLayerSliders` pattern.

```js
import {
  state, SIMPLE_LAYER_CONTROLS, SILVER_LAYER_CONTROLS, PRO_LAYER_CONTROLS,
  GLOBAL_CONTROLS, MASK_CONTROLS, STEP_TWO_CONTROLS,
  makeDefaultLayer, tonePreset, toneFromHD, createBlankRecipe, cloneTemplate,
} from '../state.js';
import { buildSpectrum } from './spectrum.js';
import { doSave, doSaveAs, buildFilmStrip } from './topbar.js';

let spectrumHandle = null;

export function buildTabContent(onInput, onRebuild) {
  const container = document.getElementById('tab-content');
  container.innerHTML = '';

  switch (state.activeTab) {
    case 'film': buildFilmTab(container, onInput, onRebuild); break;
    case 'layers': buildLayersTab(container, onInput, onRebuild); break;
    case 'base': buildBaseTab(container, onInput); break;
    case 'develop': buildDevelopTab(container, onInput); break;
  }
}

// --- Film Tab ---
function buildFilmTab(container, onInput, onRebuild) {
  // Film type segmented control
  const typeToggle = document.createElement('div');
  typeToggle.className = 'toggle-group film-type-toggle';
  for (const type of ['negative', 'positive', 'bw']) {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn';
    btn.textContent = type === 'bw' ? 'B&W' : type[0].toUpperCase() + type.slice(1);
    if (state.currentRecipe?.filmType === type) btn.classList.add('active');
    btn.addEventListener('click', () => {
      switchFilmType(type);
      onRebuild();
    });
    typeToggle.appendChild(btn);
  }
  container.appendChild(typeToggle);

  // Spectrum (always editable)
  const specWrap = document.createElement('div');
  specWrap.className = 'spectrum-section';
  spectrumHandle = buildSpectrum(specWrap, state.currentRecipe, true, () => {
    state.isDirty = true;
    onInput();
  }, onRebuild);
  container.appendChild(specWrap);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'action-row';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'action-btn';
  saveBtn.textContent = 'Save';
  saveBtn.disabled = !state.recipeName;
  saveBtn.addEventListener('click', doSave);

  const saveAsBtn = document.createElement('button');
  saveAsBtn.className = 'action-btn';
  saveAsBtn.textContent = 'Save As';
  saveAsBtn.addEventListener('click', () => { doSaveAs(); onRebuild(); });

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'action-btn secondary';
  uploadBtn.textContent = 'Upload Photo';
  uploadBtn.addEventListener('click', () => document.getElementById('file-input').click());

  actions.appendChild(saveBtn);
  actions.appendChild(saveAsBtn);
  actions.appendChild(uploadBtn);
  container.appendChild(actions);
}

// --- Layers Tab ---
function buildLayersTab(container, onInput, onRebuild) {
  const recipe = state.currentRecipe;
  const isBW = recipe.filmType === 'bw';

  recipe.layers.forEach((layer, i) => {
    const section = document.createElement('div');
    section.className = 'layer-section';

    // Header
    const header = document.createElement('div');
    header.className = 'layer-header';
    if (!isBW) {
      const dot = document.createElement('span');
      dot.className = 'layer-dot';
      dot.style.background = `hsl(${layer.dyeHue}, 55%, 45%)`;
      header.appendChild(dot);
    }
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = isBW ? 'Panchromatic' : `${layer.name} (Layer ${i + 1})`;
    header.appendChild(name);

    if (!isBW && recipe.layers.length > 1) {
      for (const [label, delta] of [['▲', -1], ['▼', 1]]) {
        const btn = document.createElement('button');
        btn.className = 'layer-move';
        btn.textContent = label;
        btn.disabled = (delta === -1 && i === 0) || (delta === 1 && i === recipe.layers.length - 1);
        btn.addEventListener('click', () => {
          const j = i + delta;
          [recipe.layers[i], recipe.layers[j]] = [recipe.layers[j], recipe.layers[i]];
          state.isDirty = true;
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
        onRebuild();
      });
      header.appendChild(rm);
    }
    section.appendChild(header);

    // Sliders
    const controls = isBW ? SILVER_LAYER_CONTROLS : SIMPLE_LAYER_CONTROLS;
    buildGroup(section, layer, controls, () => { state.isDirty = true; onInput(); });

    if (state.proMode) {
      const adv = document.createElement('details');
      adv.className = 'layer-advanced';
      adv.innerHTML = '<summary>H&D Curve Parameters</summary>';
      buildGroup(adv, layer, PRO_LAYER_CONTROLS, () => { state.isDirty = true; onInput(); });
      section.appendChild(adv);
    }

    container.appendChild(section);
  });

  if (!isBW && recipe.layers.length < 5) {
    const addBtn = document.createElement('button');
    addBtn.className = 'action-btn';
    addBtn.textContent = '+ Add Layer';
    addBtn.addEventListener('click', () => {
      recipe.layers.push(makeDefaultLayer(recipe.layers.length));
      state.isDirty = true;
      onRebuild();
    });
    container.appendChild(addBtn);
  }
}

// --- Base Tab ---
function buildBaseTab(container, onInput) {
  const recipe = state.currentRecipe;
  buildGroup(container, recipe.global, GLOBAL_CONTROLS, () => { state.isDirty = true; onInput(); });

  if (recipe.filmType === 'negative') {
    const maskHeader = document.createElement('div');
    maskHeader.className = 'section-label';
    maskHeader.textContent = 'Orange Mask';
    container.appendChild(maskHeader);
    buildGroup(container, recipe.global, MASK_CONTROLS, () => { state.isDirty = true; onInput(); });
  }
}

// --- Develop Tab ---
function buildDevelopTab(container, onInput) {
  buildGroup(container, state.labState, STEP_TWO_CONTROLS, onInput);

  // Lab Notes
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

// --- Film type switching ---
function switchFilmType(type) {
  const recipe = state.currentRecipe;
  if (type === recipe.filmType) return;

  if (type === 'bw') {
    recipe.filmType = 'bw';
    recipe.layers = [{
      name: 'panchromatic',
      sensitizerPeak: 550, sensitizerBw: 140,
      dyeHue: 0, dyePurity: 0, dmax: 0.55,
      hdToe: recipe.layers[0]?.hdToe ?? 0.20,
      hdGamma: recipe.layers[0]?.hdGamma ?? 0.70,
      hdShoulder: recipe.layers[0]?.hdShoulder ?? 0.15,
      crystalSize: recipe.layers[0]?.crystalSize ?? 0.40,
      reversal: 0, silverMode: true,
    }];
    recipe.global.maskDensity = 0;
    recipe.global.maskHue = 0;
  } else if (recipe.filmType === 'bw') {
    const blank = createBlankRecipe(type);
    recipe.layers = blank.layers;
    recipe.filmType = type;
    recipe.global.maskDensity = type === 'negative' ? 0.35 : 0;
    recipe.global.maskHue = type === 'negative' ? 28 : 0;
  } else {
    recipe.filmType = type;
    if (type === 'positive') {
      recipe.global.maskDensity = 0;
      recipe.global.maskHue = 0;
    }
  }
  state.isDirty = true;
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

export function getSpectrumHandle() { return spectrumHandle; }
```

**Step 2: Delete old panel.js**

```bash
rm src/ui/panel.js
```

**Step 3: Commit**

```bash
git add src/ui/tabs.js
git add -u
git commit -m "feat: tabs.js replaces panel.js with 4-tab content builder"
```

---

### Task 8: Update src/ui/spectrum.js — Touch Improvements

**Files:**
- Modify: `src/ui/spectrum.js`

**Step 1: Update spectrum.js**

Changes from current version:
- Increase `POINTER_R` from 14 to 18 (larger touch targets)
- Increase `CURVE_H` from 72 to 100 (taller bell curves)
- Increase hit test radii: pointer from +6 to +10, top handle from 14/10 to 18/14, edge handles from 12/16 to 16/20
- Always show edge handles and dmax handles (remove `if (editable)` guard on drawing — they become visual-only when not editable)
- Add `touch-action: none` via JS: `canvas.style.touchAction = 'none'`
- Bottom sheet popup: add class `spectrum-sheet` on `window.innerWidth < 600` (already present, just verify)

These are targeted edits to the existing file, not a full rewrite. The core drawing and interaction logic stays the same.

**Step 2: Commit**

```bash
git add src/ui/spectrum.js
git commit -m "update: spectrum.js with larger touch targets and taller curves"
```

---

### Task 9: Rewrite src/main.js — Tab Routing + Render Loop

**Files:**
- Rewrite: `src/main.js`

**Step 1: Write new main.js**

```js
import { state, cloneTemplate, applyDevelopment, LAB_DEFAULTS } from './state.js';
import { FilmRenderer } from './engine/renderer.js';
import { buildTabContent, getSpectrumHandle } from './ui/tabs.js';
import { initTopbar } from './ui/topbar.js';
import { initCanvas } from './ui/canvas.js';

const outputCanvas = document.getElementById('output-canvas');
const renderer = new FilmRenderer(outputCanvas);

function render() {
  const developed = applyDevelopment(state.currentRecipe, state.labState);
  renderer.render(developed, state.rawMode);
}

function rebuildTabs() {
  buildTabContent(renderIfImage, rebuildAndRender);
}

function renderIfImage() {
  if (renderer.hasImage) render();
}

function rebuildAndRender() {
  rebuildTabs();
  renderIfImage();
}

// Tab bar
document.querySelectorAll('#tab-bar .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    document.querySelectorAll('#tab-bar .tab').forEach(b =>
      b.classList.toggle('active', b === btn));
    rebuildTabs();
  });
});

// Canvas
const canvasUI = initCanvas(renderer, renderIfImage);

// Topbar + film strip
initTopbar({
  onTemplateChange: rebuildAndRender,
  onModeChange: rebuildTabs,
});

// Initial state
state.currentRecipe = cloneTemplate('Portra 400');
state.currentTemplate = 'Portra 400';
state.labState = { ...LAB_DEFAULTS };
rebuildAndRender();
```

**Step 2: Verify app loads**

Open `http://localhost:8765`. Verify:
- Tab bar shows 4 tabs, Film is active
- Film tab shows film type toggle + spectrum + action buttons
- Tapping Layers/Base/Develop tabs switches content
- Selecting a film stock in the strip updates the spectrum
- Upload photo works

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "rewrite: main.js with tab routing and development pipeline"
```

---

### Task 10: Visual Polish + Responsive Desktop

**Files:**
- Modify: `styles/main.css`

**Step 1: Add desktop sidebar layout**

At 768px+ breakpoint, switch to:
- Body: `flex-direction: row`
- Left sidebar (360px): tab bar as horizontal tabs at top, tab content below, film strip at bottom of sidebar
- Right area: topbar + canvas, flex-grow

**Step 2: Fine-tune mobile styles**

- Slider track height: 4px, thumb: 24px on coarse pointer
- Film chip sizing: min 44px height, padding 10px 16px
- Tab bar icons: 20px, labels: 10px
- Layer section cards: rounded corners, surface-raised background
- Smooth transitions on tab switches

**Step 3: Verify at mobile, tablet, desktop**

Resize browser to 375×812, 768×1024, 1280×800. Verify layout shifts correctly.

**Step 4: Commit**

```bash
git add styles/main.css
git commit -m "polish: responsive desktop layout + touch-friendly sizing"
```

---

### Task 11: Integration Test — Full Workflow

**Files:** None (manual testing)

**Step 1: Mobile workflow test**

1. Load app at 375×812
2. Tap image area → file picker opens
3. Load a photo → image renders with Portra 400
4. Tap film stocks: Gold 200, Velvia 50, Tri-X → image re-renders each time
5. Tap Layers tab → see per-layer sliders
6. Adjust Tone slider → image updates live
7. Tap Base tab → see stacking/DIR/tint sliders
8. Tap Develop tab → adjust temperature → image updates
9. Tap Film tab → Save As → enter name → appears in strip
10. Tap + New → blank recipe loads
11. Switch to B&W → single panchromatic layer in Layers tab
12. Toggle Pro mode → H&D details appear in Layers tab

**Step 2: Desktop workflow test**

1. Load app at 1280×800
2. Verify sidebar layout
3. Drag-drop image onto canvas
4. All tabs functional in sidebar

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

### Task 12: Clean Up

**Files:**
- Verify: all old files removed, no dead imports

**Step 1: Verify no references to removed modules**

```bash
grep -r "lab-mapping" src/ index.html
grep -r "customMode" src/
grep -r "labBaseRecipe" src/
grep -r "STEP_ONE" src/
grep -r "panel.js" src/ index.html
```

All should return no results.

**Step 2: Update PRODUCT.md**

Update the project structure, architecture diagram, and UX mode sections to reflect the new tab-based layout and unified recipe model.

**Step 3: Final commit**

```bash
git add -A
git commit -m "docs: update PRODUCT.md for touch-first UI redesign"
```
