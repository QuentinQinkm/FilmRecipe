# Universal Film Type Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the global `filmType` lock with per-layer `reversal`/`silverMode` and global `scanReversal`/`scanExposure`, enabling free mixing of negative, positive, and silver-halide behaviors across layers.

**Architecture:** Data model changes in `state.js` first (foundation), then rendering engine (GLSL + CPU), then UI wiring (topbar, panel, spectrum). No backward compat needed — stock templates updated in-place.

**Tech Stack:** Vanilla ES modules, WebGL/GLSL, Canvas2D. No build step. Serve with `python3 -m http.server 8765`. Preview at http://localhost:8765.

**Design doc:** `docs/plans/2026-04-12-universal-film-type-design.md`

---

## Task 1: Update state.js — remove filmType, add new fields

**Files:**
- Modify: `src/state.js`

### Step 1: Remove `filmType` from all stock templates, add `reversal`, `silverMode` per layer, `scanReversal`/`scanExposure` to each global

For each negative template (Portra 400, Gold 200):
- All layers get: `reversal: 0, silverMode: false`
- global gets: `scanReversal: true, scanExposure: 3.0`
- Remove `filmType` key

For each positive template (Velvia 50, Kodachrome 64):
- All layers get: `reversal: 1, silverMode: false`
- global gets: `scanReversal: false, scanExposure: 3.0`
- Remove `filmType` key

For each BW template (Ilford HP5, Kodak Tri-X):
- Single layer gets: `reversal: 0, silverMode: true`
- Set real `dmax` values: HP5 → `dmax: 0.42`, Tri-X → `dmax: 0.45`  *(was 0, unused in old path)*
- global gets: `scanReversal: true, scanExposure: 3.0`
- Remove `filmType` key

```js
// Example — Portra 400 after change:
'Portra 400': {
  layers: [
    { name: 'cyan',    sensitizerPeak: 620, sensitizerBw: 80,  dyeHue: 185, dyePurity: 0.70,
      dmax: 2.1, hdToe: 0.22, hdGamma: 0.68, hdShoulder: 0.18, crystalSize: 0.35,
      reversal: 0, silverMode: false },
    // ... same pattern for magenta, yellow
  ],
  global: { stackingStrength: 0, maskDensity: 0.42, maskHue: 28, dirInhibition: 0.35,
            baseTintR: 1.0, baseTintG: 0.97, baseTintB: 0.94,
            scanReversal: true, scanExposure: 3.0 },
},

// Example — Ilford HP5 after change:
'Ilford HP5': {
  layers: [
    { name: 'panchromatic', sensitizerPeak: 550, sensitizerBw: 150,
      dyeHue: 0, dyePurity: 0, dmax: 0.42,
      hdToe: 0.20, hdGamma: 0.75, hdShoulder: 0.15, crystalSize: 0.55,
      reversal: 0, silverMode: true },
  ],
  global: { stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0,
            baseTintR: 1.0, baseTintG: 1.0, baseTintB: 1.0,
            scanReversal: true, scanExposure: 3.0 },
},
```

### Step 2: Update BLANK_TEMPLATES the same way

```js
// negative blank: all layers reversal:0, silverMode:false; global scanReversal:true, scanExposure:3.0
// positive blank: all layers reversal:1, silverMode:false; global scanReversal:false, scanExposure:3.0
// bw blank: single layer reversal:0, silverMode:true, dmax:0.42; global scanReversal:true, scanExposure:3.0
```

### Step 3: Update `makeDefaultLayer()` to include new fields

```js
export function makeDefaultLayer(index) {
  const names = ['cyan', 'magenta', 'yellow', 'deep red', 'violet'];
  const peaks = [620, 540, 440, 670, 410];
  const hues  = [185, 320, 55, 160, 280];
  const i = Math.min(index, names.length - 1);
  return {
    name: names[i], sensitizerPeak: peaks[i], sensitizerBw: 85,
    dyeHue: hues[i], dyePurity: 0.70, dmax: 2.0,
    hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30,
    reversal: 0, silverMode: false,   // NEW
  };
}
```

### Step 4: Update `LAYER_CONTROLS` — add reversal row

```js
export const LAYER_CONTROLS = [
  ['sensitizerPeak', 'Color sensitivity',  'Sensitizer peak',     'nm', 380, 700, 1,    0],
  ['sensitizerBw',   'Sensitivity range',  'Sensitizer bandwidth','nm', 30,  200, 1,    0],
  ['dyeHue',         'Dye color',          'Dye hue',             '°',  0,   359, 1,    0],
  ['dyePurity',      'Color richness',     'Dye purity',          '',   0,   1,   0.01, 2],
  ['dmax',           'Max density',        'Dmax',                '',   0.5, 3.5, 0.01, 2],
  ['reversal',       'Polarity',           'Reversal',            '',   0,   1,   0.01, 2],  // NEW
  ['hdToe',          'Shadow detail',      'H&D toe',             '',   0,   0.5, 0.01, 2],
  ['hdGamma',        'Contrast',           'H&D gamma',           '',   0.3, 3.0, 0.01, 2],
  ['hdShoulder',     'Highlight rolloff',  'H&D shoulder',        '',   0,   0.5, 0.01, 2],
  ['crystalSize',    'Grain size',         'Crystal size',        '',   0.05,2.0, 0.01, 2],
];
```

### Step 5: Remove `BW_LAYER_CONTROLS` export — silver mode is now just a layer flag, not a separate control set

Delete the `BW_LAYER_CONTROLS` export entirely. Any import of it will be fixed in later tasks.

### Step 6: Update `SIMPLE_LAYER_CONTROLS` — add reversal

```js
export const SIMPLE_LAYER_CONTROLS = [
  ['tone',        'Tone',     'Tone preset', '', 0,    1,   0.01, 2],
  ['reversal',    'Polarity', 'Reversal',    '', 0,    1,   0.01, 2],  // NEW
  ['crystalSize', 'Grain',    'Crystal size','', 0.05, 2.0, 0.01, 2],
];
```

### Step 7: Update `GLOBAL_CONTROLS` — add scanReversal and scanExposure

```js
export const GLOBAL_CONTROLS = [
  ['stackingStrength', 'Layer stacking',     'Stacking strength', '', 0,   1,   0.01, 2],
  ['dirInhibition',    'Edge sharpness',     'DIR inhibition',    '', 0,   1,   0.01, 2],
  ['baseTintR',        'Base warmth (Red)',  'Base tint R',       '', 0.8, 1.0, 0.01, 2],
  ['baseTintG',        'Base warmth (Green)','Base tint G',       '', 0.8, 1.0, 0.01, 2],
  ['baseTintB',        'Base warmth (Blue)', 'Base tint B',       '', 0.8, 1.0, 0.01, 2],
  ['scanExposure',     'Scan exposure',      'Scan exposure',     '', 0.5, 6.0, 0.01, 2],  // NEW
];
// scanReversal is a toggle — handled separately in buildCustomPanel, not via buildGroup
```

### Step 8: Update `PRO_LAYER_CONTROLS` — remove reference to BW-specific fields (none needed, it's the same for all layers now)

No change needed here — it already only has hdToe/hdGamma/hdShoulder.

### Step 9: Verify in browser console — no JS errors, app loads

Open http://localhost:8765, open DevTools console, verify zero errors. The app will
visually break (renderer still reads filmType) — that's expected until Task 2.

---

## Task 2: Update renderer.js GLSL shader

**Files:**
- Modify: `src/engine/renderer.js`

### Step 1: Replace the FRAG_SRC string — new uniforms

Remove `uniform float uFilmType;`.
Add after `uniform float uRaw;`:
```glsl
uniform float uScanRev;
uniform float uScanExp;
uniform vec3  uReversal;
uniform vec3  uSilver;
```

### Step 2: Rewrite `main()` — replace the entire if/else isBW block

Delete everything inside `main()` after the passthrough check and replace with:

```glsl
void main() {
  vec4 tx = texture2D(uImg, vUV);
  if (uPassthrough > 0.5) { gl_FragColor = tx; return; }
  vec3 lin = vec3(s2l(tx.r), s2l(tx.g), s2l(tx.b));

  // --- Layer 0 ---
  vec3 w0 = vec3(sens(CH.x, uSensPeak.x, uSensBw.x),
                 sens(CH.y, uSensPeak.x, uSensBw.x),
                 sens(CH.z, uSensPeak.x, uSensBw.x));
  float e0 = dot(lin, w0) / max(dot(w0, vec3(1.0)), 0.001);
  float dn0 = hd(e0, uToe.x, uGamma.x, uShoulder.x, uDmax.x);
  vec3 ab0 = uSilver.x > 0.5 ? vec3(1.0) : dyeAbs(uDyeHue.x, uDyePurity.x);
  vec3 avail1 = lin * mix(vec3(1.0), exp(-ab0 * dn0 * LN10), uStackStr);

  // --- Layer 1 ---
  vec3 w1 = vec3(sens(CH.x, uSensPeak.y, uSensBw.y),
                 sens(CH.y, uSensPeak.y, uSensBw.y),
                 sens(CH.z, uSensPeak.y, uSensBw.y));
  float e1 = dot(avail1, w1) / max(dot(w1, vec3(1.0)), 0.001);
  float dn1 = hd(e1, uToe.y, uGamma.y, uShoulder.y, uDmax.y);
  vec3 ab1 = uSilver.y > 0.5 ? vec3(1.0) : dyeAbs(uDyeHue.y, uDyePurity.y);
  vec3 avail2 = avail1 * mix(vec3(1.0), exp(-ab1 * dn1 * LN10), uStackStr);

  // --- Layer 2 ---
  vec3 w2 = vec3(sens(CH.x, uSensPeak.z, uSensBw.z),
                 sens(CH.y, uSensPeak.z, uSensBw.z),
                 sens(CH.z, uSensPeak.z, uSensBw.z));
  float e2 = dot(avail2, w2) / max(dot(w2, vec3(1.0)), 0.001);
  float dn2 = hd(e2, uToe.z, uGamma.z, uShoulder.z, uDmax.z);

  // --- Per-layer reversal (post-stacking, pre-DIR) ---
  dn0 = mix(dn0, uDmax.x - dn0, uReversal.x);
  dn1 = mix(dn1, uDmax.y - dn1, uReversal.y);
  dn2 = mix(dn2, uDmax.z - dn2, uReversal.z);

  // --- DIR inhibition ---
  float d0 = max(0.0, dn0 - uDir * (dn1 + dn2) * 0.15);
  float d1 = max(0.0, dn1 - uDir * (dn0 + dn2) * 0.15);
  float d2 = max(0.0, dn2 - uDir * (dn0 + dn1) * 0.15);

  // --- Accumulate total OD ---
  vec3 ab0f = uSilver.x > 0.5 ? vec3(1.0) : dyeAbs(uDyeHue.x, uDyePurity.x);
  vec3 ab1f = uSilver.y > 0.5 ? vec3(1.0) : dyeAbs(uDyeHue.y, uDyePurity.y);
  vec3 ab2f = uSilver.z > 0.5 ? vec3(1.0) : dyeAbs(uDyeHue.z, uDyePurity.z);
  vec3 totalOD = ab0f * d0 + ab1f * d1 + ab2f * d2;

  // --- Output stage ---
  vec3 out3;
  if (uRaw > 0.5) {
    float mh = clamp(uMaskHue / 60.0, 0.0, 1.0);
    vec3 maskOD = vec3(uMaskDen * mix(0.65, 0.45, mh),
                       uMaskDen * mix(0.15, 0.40, mh),
                       uMaskDen * mix(0.05, 0.10, mh));
    out3 = exp(-(totalOD + maskOD) * LN10);
  } else if (uScanRev > 0.5) {
    out3 = vec3(1.0) - exp(-totalOD * uScanExp);
  } else {
    out3 = exp(-totalOD * LN10);
  }

  out3 *= uBaseTint;
  float avgC = (uCrystal.x + uCrystal.y + uCrystal.z) / 3.0;
  float lum = dot(out3, vec3(0.333));
  float gv = grn(gl_FragCoord.xy, max(1.0, avgC * 4.0));
  out3 = clamp(out3 + vec3(gv * grnAmt(lum, avgC)), 0.0, 1.0);

  gl_FragColor = vec4(l2s(out3.r), l2s(out3.g), l2s(out3.b), 1.0);
}
```

### Step 3: Update uniform name list in `_initGL()`

```js
const names = [
  'uImg', 'uRaw', 'uScanRev', 'uScanExp',
  'uSensPeak', 'uSensBw', 'uToe', 'uGamma', 'uShoulder', 'uDmax',
  'uDyeHue', 'uDyePurity', 'uCrystal',
  'uReversal', 'uSilver',
  'uDir', 'uMaskDen', 'uMaskHue', 'uBaseTint', 'uPassthrough', 'uStackStr',
];
```

### Step 4: Update `_renderGL()` — replace filmType uniform, add new ones

Remove:
```js
const ft = recipe.filmType === 'bw' ? 2 : recipe.filmType === 'positive' ? 1 : 0;
gl.uniform1f(this.u.uFilmType, ft);
```

Add after `gl.uniform1f(this.u.uRaw, ...)`:
```js
const g = recipe.global;
gl.uniform1f(this.u.uScanRev, g.scanReversal ? 1 : 0);
gl.uniform1f(this.u.uScanExp, g.scanExposure ?? 3.0);
gl.uniform3fv(this.u.uReversal, v3('reversal', 0));
gl.uniform3fv(this.u.uSilver,   v3('silverMode', 0));
```

Remove the duplicate `const g = recipe.global;` line (it was declared again lower down).

### Step 5: Update `needCPU` check — remove filmType guard

```js
// Before:
const needCPU = !this.gl || (recipe.layers.length > 3 && recipe.filmType !== 'bw');
// After:
const needCPU = !this.gl || recipe.layers.length > 3;
```

### Step 6: Verify — load app, upload a photo, check Portra 400 looks correct

Take a screenshot with the preview tool. Portra 400 should produce a warm negative-scan
look. If the image is white, black, or inverted, there's a shader bug — check the browser
console for WebGL compile errors.

### Step 7: Commit

```bash
git add src/engine/renderer.js
git commit -m "feat: universal film type — unified GLSL shader with per-layer reversal and silverMode"
```

---

## Task 3: Update renderer.js CPU path

**Files:**
- Modify: `src/engine/renderer.js`
- Modify: `src/ui/canvas.js` (processing overlay)

### Step 1: Remove the entire `isBW` branch in `_renderCPU()`

Delete lines from `if (isBW) {` through the matching `} else {` — keep only the contents of the else block.

Remove:
```js
const isBW = filmType === 'bw';
const isNeg = filmType === 'negative';
const isPos = filmType === 'positive';
```
(These are no longer used.)

### Step 2: Replace the color loop body with the unified version

Inside the per-pixel loop, replace the entire `if (isBW) { ... } else { ... }` with:

```js
const stackStr = g.stackingStrength || 0;
let availR = sr, availG = sg, availB = sb;
const rawDens = [];
for (let j = 0; j < layers.length; j++) {
  const L = layers[j];
  const wR = sens(CH[0], L.sensitizerPeak, L.sensitizerBw);
  const wG = sens(CH[1], L.sensitizerPeak, L.sensitizerBw);
  const wB = sens(CH[2], L.sensitizerPeak, L.sensitizerBw);
  const wS = wR + wG + wB || 1;
  const ex = (availR * wR + availG * wG + availB * wB) / wS;
  const d = hdC(ex, L.hdToe, L.hdGamma, L.hdShoulder, L.dmax);

  // Stacking attenuation (pre-reversal, uses per-layer absorption vector)
  if (stackStr > 0) {
    const ab = L.silverMode ? [1, 1, 1] : dyeA(L.dyeHue, L.dyePurity);
    const mx = (base, att) => base * (1 - stackStr) + att * stackStr;
    availR = mx(availR, availR * Math.exp(-ab[0] * d * LN10));
    availG = mx(availG, availG * Math.exp(-ab[1] * d * LN10));
    availB = mx(availB, availB * Math.exp(-ab[2] * d * LN10));
  }

  // Per-layer reversal
  const rev = L.reversal ?? 0;
  rawDens.push(d * (1 - rev) + (L.dmax - d) * rev);
}

// DIR inhibition
const dir = g.dirInhibition;
const postDir = rawDens.map((v, j) => {
  let inh = 0;
  for (let k = 0; k < rawDens.length; k++) if (k !== j) inh += rawDens[k];
  return Math.max(0, v - dir * inh * 0.15);
});

// Accumulate total OD
let totR = 0, totG = 0, totB = 0;
for (let j = 0; j < layers.length; j++) {
  const ab = layers[j].silverMode ? [1, 1, 1] : dyeA(layers[j].dyeHue, layers[j].dyePurity);
  totR += ab[0] * postDir[j];
  totG += ab[1] * postDir[j];
  totB += ab[2] * postDir[j];
}

// Output stage
let oR, oG, oB;
if (rawMode) {
  const mh = Math.max(0, Math.min(1, g.maskHue / 60));
  const mR = g.maskDensity * (0.65 * (1 - mh) + 0.45 * mh);
  const mG = g.maskDensity * (0.15 * (1 - mh) + 0.40 * mh);
  const mB = g.maskDensity * (0.05 * (1 - mh) + 0.10 * mh);
  oR = Math.exp(-(totR + mR) * LN10);
  oG = Math.exp(-(totG + mG) * LN10);
  oB = Math.exp(-(totB + mB) * LN10);
} else if (g.scanReversal) {
  const se = g.scanExposure ?? 3.0;
  oR = 1 - Math.exp(-totR * se);
  oG = 1 - Math.exp(-totG * se);
  oB = 1 - Math.exp(-totB * se);
} else {
  oR = Math.exp(-totR * LN10);
  oG = Math.exp(-totG * LN10);
  oB = Math.exp(-totB * LN10);
}
oR *= g.baseTintR; oG *= g.baseTintG; oB *= g.baseTintB;

// Grain
const avgC = layers.reduce((s, L) => s + (L.crystalSize || 0.3), 0) / layers.length;
const px = i % width;
const py = Math.floor(i / width);
const gv = grn(px, py, Math.max(1, avgC * 4));
const lumG = (oR + oG + oB) / 3;
const ga = grnAmt(lumG, avgC);
oR = Math.max(0, Math.min(1, oR + gv * ga));
oG = Math.max(0, Math.min(1, oG + gv * ga));
oB = Math.max(0, Math.min(1, oB + gv * ga));
```

### Step 3: Wire up the `#processing` overlay in `render()`

In `render()` method, add show/hide around the CPU branch:

```js
render(recipe, rawMode) {
  if (!this.hasImage) return;
  const needCPU = !this.gl || recipe.layers.length > 3;
  if (!needCPU) {
    this._renderGL(recipe, rawMode);
  } else {
    const processing = document.getElementById('processing');
    if (processing) processing.classList.add('active');
    const out = this._renderCPU(recipe, rawMode);
    if (processing) processing.classList.remove('active');
    if (out && this.gl) {
      this._blitViaGL(out);
    } else if (out) {
      const { canvas } = this;
      canvas.width = out.width; canvas.height = out.height;
      canvas.getContext('2d').putImageData(out, 0, 0);
    }
  }
}
```

### Step 4: Verify — add a 4th layer in custom mode, confirm it renders and grain appears

In the UI: Custom film → Add emulsion layer (triggers CPU path). Upload a photo.
Should render correctly, no console errors.

### Step 5: Commit

```bash
git add src/engine/renderer.js
git commit -m "feat: universal film type — unified CPU path with per-layer reversal and silverMode"
```

---

## Task 4: Update topbar.js — preset stamps, fix type-switch bug

**Files:**
- Modify: `src/ui/topbar.js`

### Step 1: Replace `switchCustomFilmType` and `switchStockFilmType` with `applyFilmPreset(type, recipe)`

Delete both existing functions. Add:

```js
function applyFilmPreset(type, recipe) {
  if (type === 'bw') {
    // Collapse to single silver layer preserving H&D params
    const first = recipe.layers[0] || {};
    recipe.layers = [{
      name: 'panchromatic',
      sensitizerPeak: 550, sensitizerBw: 140,
      dyeHue: 0, dyePurity: 0, dmax: 0.42,
      hdToe:      first.hdToe      ?? 0.20,
      hdGamma:    first.hdGamma    ?? 0.75,
      hdShoulder: first.hdShoulder ?? 0.15,
      crystalSize: first.crystalSize ?? 0.55,
      reversal: 0, silverMode: true,
    }];
    recipe.global.maskDensity = 0;
    recipe.global.maskHue = 0;
    recipe.global.scanReversal = true;
    recipe.global.scanExposure = 3.0;
  } else if (type === 'positive') {
    recipe.layers.forEach(L => { L.reversal = 1; L.silverMode = false; });
    recipe.global.maskDensity = 0;
    recipe.global.maskHue = 0;
    recipe.global.scanReversal = false;
    recipe.global.scanExposure = 3.0;
  } else { // negative
    recipe.layers.forEach(L => { L.reversal = 0; L.silverMode = false; });
    recipe.global.scanReversal = true;
    recipe.global.scanExposure = 3.0;
  }
}
```

### Step 2: Update the film-type-toggle click handler

Replace calls to `switchCustomFilmType` / `switchStockFilmType` with `applyFilmPreset`:

```js
document.querySelectorAll('#film-type-toggle .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    document.querySelectorAll('#film-type-toggle .toggle-btn').forEach(b =>
      b.classList.toggle('active', b === btn));

    if (state.customMode) {
      applyFilmPreset(type, state.labBaseRecipe);
      // Fix: reset only labState, NOT labBaseRecipe
      state.labState = { ...LAB_DEFAULTS };
    } else {
      applyFilmPreset(type, state.currentRecipe);
      state.labBaseRecipe = JSON.parse(JSON.stringify(state.currentRecipe));
      state.labState = { ...LAB_DEFAULTS };
    }
    callbacks.onFilmTypeChange();
  });
});
```

### Step 3: Update `enterCustomMode()` — sync the type buttons from recipe state

The active type button should reflect the recipe. Since `filmType` is gone, derive from recipe:

```js
function getPresetType(recipe) {
  if (recipe.layers.every(L => L.silverMode)) return 'bw';
  if (recipe.layers.every(L => (L.reversal ?? 0) >= 0.5)) return 'positive';
  return 'negative';
}

function enterCustomMode(recipe, name) {
  state.customMode = true;
  state.customName = name || '';
  state.currentRecipe = JSON.parse(JSON.stringify(recipe));
  state.labBaseRecipe = JSON.parse(JSON.stringify(recipe));
  state.labState = { ...LAB_DEFAULTS };

  const presetType = getPresetType(recipe);
  document.querySelectorAll('#film-type-toggle .toggle-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === presetType));
  // ... rest of function unchanged
}
```

### Step 4: Update stock template button click — sync type toggle buttons

In the `btn.addEventListener('click', ...)` for stock templates, update the toggle sync:

```js
const presetType = getPresetType(state.currentRecipe);
document.querySelectorAll('#film-type-toggle .toggle-btn').forEach(b =>
  b.classList.toggle('active', b.dataset.type === presetType));
```

(Replace the old `b.dataset.type === state.currentRecipe.filmType` check.)

### Step 5: Verify — switch between Portra 400, Velvia 50, Ilford HP5 in lab mode. Check that:
- The N/P/BW buttons highlight correctly
- The panel rebuilds with correct controls for each
- Switching from a stock template to custom mode and then pressing B&W collapses to 1 layer

### Step 6: Commit

```bash
git add src/ui/topbar.js
git commit -m "feat: universal film type — topbar preset stamps, fix type-switch panel sync bug"
```

---

## Task 5: Update panel.js — new layer controls + Output Pipeline section

**Files:**
- Modify: `src/ui/panel.js`

### Step 1: Remove the `BW_LAYER_CONTROLS` import

Update the import line at the top of `panel.js` — remove `BW_LAYER_CONTROLS` from the import.

### Step 2: Update `buildLayerSection()` — add Silver toggle and hide dye controls when active

In `buildLayerSection`, after building `simpleControls`, add:

```js
// Silver mode toggle
const silverRow = document.createElement('div');
silverRow.className = 'param-row silver-row';
const silverLabel = document.createElement('span');
silverLabel.className = 'param-name';
silverLabel.textContent = 'Silver';
const silverBtn = document.createElement('button');
silverBtn.className = 'silver-toggle' + (layer.silverMode ? ' active' : '');
silverBtn.textContent = layer.silverMode ? 'Silver ✓' : 'Silver';
silverBtn.addEventListener('click', () => {
  layer.silverMode = !layer.silverMode;
  silverBtn.classList.toggle('active', layer.silverMode);
  silverBtn.textContent = layer.silverMode ? 'Silver ✓' : 'Silver';
  onRebuild(); // rebuild panel to show/hide dye controls
});
silverRow.appendChild(silverLabel);
silverRow.appendChild(silverBtn);
section.appendChild(silverRow);
```

### Step 3: In `buildLayerSection()`, hide dye sliders when `silverMode = true`

After buildGroup for simpleControls, wrap the pro dye sliders in a conditional:

In the `buildGroup(section, layer, simpleControls, onInput)` call, we also need to conditionally skip dye-related sliders. The simplest approach: after `section.appendChild(header)`, check `layer.silverMode` and build different control sets:

```js
// Simple controls — always show tone/reversal/grain
buildGroup(section, layer, SIMPLE_LAYER_CONTROLS, onInput);

// Silver toggle button (built above in Step 2)

// Pro mode H&D — always available regardless of silverMode
if (state.proMode) {
  const adv = document.createElement('details');
  adv.className = 'lab-advanced';
  adv.innerHTML = '<summary>H&D Curve Parameters</summary>';
  buildGroup(adv, layer, PRO_LAYER_CONTROLS, onInput);

  // Dye controls only for non-silver layers
  if (!layer.silverMode) {
    const dyeControls = [
      ['dyeHue',     'Dye color',    'Dye hue',   '°', 0,   359, 1,    0],
      ['dyePurity',  'Color richness','Dye purity','',  0,   1,   0.01, 2],
      ['dmax',       'Max density',  'Dmax',       '',  0.5, 3.5, 0.01, 2],
    ];
    buildGroup(adv, layer, dyeControls, onInput);
  }
  section.appendChild(adv);
}
```

### Step 4: Update `buildCustomPanel()` — Film Base always shows mask, add Output Pipeline

Remove the `if (isNeg)` guard around mask controls — always append them.

After the existing `buildGroup(baseStep, recipe.global, GLOBAL_CONTROLS, onInput)` call, add the Output Pipeline subsection:

```js
// Output Pipeline subsection
const pipelineLabel = document.createElement('div');
pipelineLabel.className = 'param-name';
pipelineLabel.style.cssText = 'margin: 12px 0 4px; font-weight: 600;';
pipelineLabel.textContent = 'Output pipeline';
baseStep.appendChild(pipelineLabel);

// Scan reversal toggle row
const scanRow = document.createElement('div');
scanRow.className = 'param-row';
const scanLabel = document.createElement('div');
scanLabel.className = 'param-label';
const scanName = document.createElement('span');
scanName.className = 'param-name';
scanName.textContent = 'Scan reversal';
const scanVal = document.createElement('span');
scanVal.className = 'param-value';
scanVal.textContent = recipe.global.scanReversal ? 'On' : 'Off';
scanLabel.appendChild(scanName);
scanLabel.appendChild(scanVal);
const scanBtn = document.createElement('button');
scanBtn.className = 'silver-toggle' + (recipe.global.scanReversal ? ' active' : '');
scanBtn.textContent = recipe.global.scanReversal ? 'On' : 'Off';
scanBtn.addEventListener('click', () => {
  recipe.global.scanReversal = !recipe.global.scanReversal;
  scanBtn.classList.toggle('active', recipe.global.scanReversal);
  scanBtn.textContent = recipe.global.scanReversal ? 'On' : 'Off';
  scanVal.textContent = scanBtn.textContent;
  scanExpRow.style.display = recipe.global.scanReversal ? '' : 'none';
  onInput();
});
scanRow.appendChild(scanLabel);
scanRow.appendChild(scanBtn);
baseStep.appendChild(scanRow);

// Scan exposure slider (only shown when scan reversal is ON)
const scanExpRow = document.createElement('div');
scanExpRow.style.display = recipe.global.scanReversal ? '' : 'none';
buildGroup(scanExpRow, recipe.global, [['scanExposure','Scan exposure','Scan exposure','',0.5,6.0,0.01,2]], onInput);
baseStep.appendChild(scanExpRow);

// Orange mask (always visible)
const maskLabel = document.createElement('div');
maskLabel.className = 'param-name';
maskLabel.style.cssText = 'margin: 8px 0 4px; font-weight: 600;';
maskLabel.textContent = 'Orange mask';
baseStep.appendChild(maskLabel);
buildGroup(baseStep, recipe.global, MASK_CONTROLS, onInput);
```

### Step 5: Add CSS for `.silver-toggle` button to `styles/main.css`

```css
.silver-toggle {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.silver-toggle.active {
  background: var(--active-bg);
  color: #fff;
  border-color: transparent;
}
```

### Step 6: Verify — custom film mode shows:
- Polarity slider per layer
- Silver toggle per layer (clicking it hides dye controls)
- Film Base shows orange mask always
- Film Base shows Scan reversal toggle + Scan exposure slider (slider hides when toggle is off)

### Step 7: Commit

```bash
git add src/ui/panel.js styles/main.css
git commit -m "feat: universal film type — panel controls for reversal, silverMode, output pipeline"
```

---

## Task 6: Update spectrum.js — visual representation of silver/reversal

**Files:**
- Modify: `src/ui/spectrum.js`

### Step 1: Make `drawBellCurve` go gray for silver layers

In `drawBellCurve()`, change the color selection:

```js
// Before:
const hue = isBW ? 0 : layer.dyeHue;
const sat = isBW ? '0%' : '55%';

// After:
const isSilver = layer.silverMode === true;
const hue = isSilver ? 0 : (layer.dyeHue ?? 0);
const sat = isSilver ? '0%' : '55%';
```

Remove the `isBW` parameter usage in `drawBellCurve` — `silverMode` replaces it.

### Step 2: Make `drawPointer` use gray for silver layers

In the `paint()` function, where pointers are drawn:

```js
// Before:
const hue = isBW ? 0 : L.dyeHue;
const sat = isBW ? '0%' : '55%';

// After:
const isSilver = L.silverMode === true;
const hue = isSilver ? 0 : (L.dyeHue ?? 0);
const sat = isSilver ? '0%' : '55%';
```

### Step 3: Flip the H&D mini-curve when reversal > 0.5

In `drawHdMini()`, after computing `den`, flip if reversal is positive:

```js
const rev = layer.reversal ?? 0;
// existing den computation ...
// After the existing den clamp:
if (rev > 0.001) {
  den = den * (1 - rev) + (1 - den) * rev; // flip in display space
}
```

This mirrors the actual reversal math visually inside the mini sparkline.

### Step 4: Update popup controls — add reversal slider, silverMode toggle, hide dye for silver

In `showPopup()`, replace the `controls` array with a dynamic one:

```js
const isSilver = layer.silverMode === true;
const controls = isSilver
  ? [
      ['sensitizerPeak', 'Peak',      380, 700,  1   ],
      ['sensitizerBw',   'Bandwidth', 30,  200,  1   ],
      ['dmax',           'Density',   0.05, 1.0, 0.01],
      ['reversal',       'Polarity',  0,   1,    0.01],
      ['hdGamma',        'Contrast',  0.3, 3,    0.01],
    ]
  : [
      ['sensitizerPeak', 'Peak',      380, 700,  1   ],
      ['sensitizerBw',   'Bandwidth', 30,  200,  1   ],
      ['dmax',           'Density',   0.5, 3.5,  0.01],
      ['dyeHue',         'Dye color', 0,   359,  1   ],
      ['dyePurity',      'Purity',    0,   1,    0.01],
      ['reversal',       'Polarity',  0,   1,    0.01],
      ['hdGamma',        'Contrast',  0.3, 3,    0.01],
    ];
```

Also add a Silver toggle button inside the popup header area:

```js
const silverToggle = document.createElement('button');
silverToggle.className = 'silver-toggle' + (isSilver ? ' active' : '');
silverToggle.textContent = isSilver ? 'Silver ✓' : 'Silver';
silverToggle.addEventListener('pointerdown', e => {
  e.stopPropagation();
  layer.silverMode = !layer.silverMode;
  paint();
  onInput();
  removePopup();
  showPopup(activeIdx); // reopen with updated control set
});
header.appendChild(silverToggle);
```

### Step 5: Remove all `isBW` references from spectrum.js

Search for `isBW` in spectrum.js. Replace with `layer.silverMode === true` or
`recipe.filmType === 'bw'` → remove entirely (filmType is gone). The `isBW` variable
derived from `recipe.filmType` throughout `paint()` should be removed; check each usage
and replace with `L.silverMode`.

Note: the `drawBwEdgeHandles` and `drawDmaxHandle` calls currently use `isBW` to skip
dmax handle for BW. Replace with `L.silverMode`:

```js
// Before:
if (!isBW) drawDmaxHandle(ctx, L, w, bellH, isBW);

// After:
if (!L.silverMode) drawDmaxHandle(ctx, L, w, bellH);
```

### Step 6: Verify visually:
- Color layer bell = hue-colored
- Silver layer bell = gray
- Pointer = gray for silver
- H&D mini-curve flips when reversal slider is dragged above 0.5
- Popup for silver layer shows Polarity slider, no Dye color/Purity
- Popup silver toggle works and rebuilds popup

### Step 7: Commit

```bash
git add src/ui/spectrum.js
git commit -m "feat: universal film type — spectrum visual updates for silverMode and reversal"
```

---

## Task 7: Retune BW stock templates empirically

**Files:**
- Modify: `src/state.js` (HP5 and Tri-X template values)

### Step 1: Load Ilford HP5, upload the test image `assets/testIMG.jpg`

The new HP5 template has `dmax: 0.42, hdGamma: 0.75, scanReversal: true, scanExposure: 3.0`.
The target: a classic moderate-contrast BW look — bright whites, solid blacks, clear midtones.

### Step 2: Use the preview screenshot to evaluate

Take a screenshot. If:
- **Too dark overall**: increase `dmax` (try 0.5, 0.6)
- **Too flat/low contrast**: increase `hdGamma` (try 0.85, 0.95)
- **Blown-out whites**: decrease `scanExposure` (try 2.5) or decrease `dmax`
- **Muddy shadows**: increase `hdToe` slightly (try 0.25)

### Step 3: Apply same evaluation to Kodak Tri-X

Tri-X target: higher contrast and grain than HP5. Starting point: `dmax: 0.45, hdGamma: 1.10`.
If too bright/dark, tune dmax. If contrast is wrong, tune hdGamma.

### Step 4: Final confirmed values — update state.js

Once the look is dialed in, hardcode the tuned values in the templates.

### Step 5: Verify both BW templates look good side by side

Switch between HP5 and Tri-X in the template strip with a photo loaded.
HP5 should be finer grain, softer contrast. Tri-X should be grainier, punchier.

### Step 6: Commit

```bash
git add src/state.js
git commit -m "feat: universal film type — retune BW templates for Beer-Lambert silver path"
```

---

## Done

After Task 7, the universal film type system is complete. Every recipe can now freely mix:
- Per-layer `reversal` (0=neg, 1=pos, or anything between)
- Per-layer `silverMode` (silver-halide neutral density vs. dye coupler)
- Global `scanReversal` and `scanExposure` (output pipeline controls)

The N/P/BW buttons are preset stamps. The type-switch panel bug is fixed.
