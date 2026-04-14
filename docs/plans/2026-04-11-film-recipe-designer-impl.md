# Film Recipe Designer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-file HTML film emulsion designer where users tune real chemical parameters (sensitizer, dye couplers, H&D curve, crystal size) and see the result applied to an uploaded image in real time.

**Architecture:** Single `index.html` file — no build toolchain, no dependencies. All logic in vanilla JS within `<script>` tags, all styles in `<style>` tags. Canvas pixel manipulation (`getImageData`/`putImageData`) for rendering. The rendering engine is a pure function: `renderFilm(imageData, recipe) → imageData`.

**Tech Stack:** HTML5, vanilla JS (ES6+), Canvas 2D API, CSS custom properties.

---

## Important Notes for the Implementer

- This is a **single file**: `index.html` in the project root. Do not create separate `.js` or `.css` files.
- No framework, no bundler, no npm. Open the file directly in a browser.
- The rendering pipeline runs on the CPU via Canvas. It will be slow on large images — that is acceptable for this prototype.
- "Test" means: open in browser, upload a photo, verify the visual result matches the expected description. There are no automated tests.
- Commit after each task completes and the browser check passes.

---

### Task 1: HTML Scaffold + CSS Foundation

**Files:**
- Create: `index.html`

**What to build:**

The full page structure and all CSS. No JS logic yet — just the skeleton that all future tasks will populate.

**Step 1: Create `index.html` with this exact structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Film Recipe</title>
  <style>
    /* === RESET & BASE === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --black: #111111;
      --mid: #666666;
      --border: #e0e0e0;
      --bg: #ffffff;
      --accent: #111111;
      --layer-cyan: #00a8b5;
      --layer-magenta: #c0006a;
      --layer-yellow: #c8a000;
      --layer-bw: #555555;
      --panel-width: 320px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--black);
      min-height: 100vh;
      font-size: 13px;
      line-height: 1.5;
    }

    /* === TOP BAR === */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 52px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--bg);
      z-index: 10;
    }
    .wordmark {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* === TOGGLE BUTTONS === */
    .toggle-group {
      display: flex;
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
    }
    .toggle-btn {
      padding: 5px 12px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 12px;
      color: var(--mid);
      transition: background 0.15s, color 0.15s;
    }
    .toggle-btn.active {
      background: var(--black);
      color: #fff;
    }

    /* === TEMPLATE STRIP === */
    .template-strip {
      padding: 10px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .template-strip .label {
      font-size: 11px;
      color: var(--mid);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-right: 4px;
    }
    .template-btn {
      padding: 4px 10px;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: none;
      cursor: pointer;
      font-size: 12px;
      color: var(--black);
      transition: border-color 0.15s;
    }
    .template-btn:hover { border-color: var(--black); }
    .template-btn.active { border-color: var(--black); background: var(--black); color: #fff; }
    .template-btn.type-neg { }
    .template-btn.type-pos { }
    .template-btn.type-bw { }

    /* === MAIN LAYOUT === */
    .main {
      display: flex;
      height: calc(100vh - 52px - 45px);
    }

    /* === LEFT PANEL === */
    .panel {
      width: var(--panel-width);
      min-width: var(--panel-width);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 0 0 40px 0;
    }

    /* === LAYER SECTION === */
    .layer-section {
      border-bottom: 1px solid var(--border);
      padding: 16px 20px;
    }
    .layer-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
    }
    .layer-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .layer-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* === PARAM ROW === */
    .param-row {
      margin-bottom: 10px;
    }
    .param-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .param-name {
      font-size: 11px;
      color: var(--mid);
    }
    .param-value {
      font-size: 11px;
      color: var(--black);
      font-variant-numeric: tabular-nums;
      min-width: 36px;
      text-align: right;
    }
    .param-unit {
      font-size: 10px;
      color: var(--mid);
      margin-left: 2px;
    }
    input[type="range"] {
      width: 100%;
      height: 2px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--border);
      border-radius: 1px;
      outline: none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--black);
      cursor: pointer;
    }

    /* H&D curve section within a layer */
    .hd-group {
      margin-top: 6px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }
    .hd-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mid);
      margin-bottom: 8px;
    }

    /* H&D curve canvas (pro mode) */
    .hd-canvas {
      width: 100%;
      height: 80px;
      border: 1px solid var(--border);
      border-radius: 2px;
      margin-bottom: 8px;
      display: none;
    }
    .pro-mode .hd-canvas { display: block; }

    /* Color picker row for dye hue */
    .dye-picker-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .spectrum-bar {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
      position: relative;
      cursor: pointer;
    }
    .spectrum-marker {
      position: absolute;
      top: -3px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
      transform: translateX(-50%);
      pointer-events: none;
    }

    /* Global section */
    .global-section {
      padding: 16px 20px;
    }
    .global-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 14px;
      color: var(--mid);
    }

    /* === RIGHT CANVAS AREA === */
    .canvas-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f8f8f8;
      position: relative;
      overflow: hidden;
    }

    /* Upload zone */
    .upload-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 360px;
      height: 240px;
      border: 1px dashed var(--border);
      border-radius: 4px;
      cursor: pointer;
      transition: border-color 0.15s;
      background: var(--bg);
    }
    .upload-zone:hover { border-color: var(--black); }
    .upload-zone.dragover { border-color: var(--black); background: #f5f5f5; }
    .upload-zone-text {
      font-size: 13px;
      color: var(--mid);
    }
    .upload-zone-sub {
      font-size: 11px;
      color: #aaa;
    }
    #file-input { display: none; }

    /* Canvas container */
    .canvas-container {
      display: none;
      position: relative;
      max-width: 100%;
      max-height: 100%;
    }
    .canvas-container.visible { display: block; }

    /* Output canvas */
    #output-canvas {
      display: block;
      max-width: calc(100vw - var(--panel-width) - 2px);
      max-height: calc(100vh - 52px - 45px);
      object-fit: contain;
    }

    /* Reference split overlay */
    .ref-overlay {
      position: absolute;
      top: 0;
      right: 0;
      width: 50%;
      height: 100%;
      overflow: hidden;
      pointer-events: none;
      display: none;
    }
    .ref-overlay.visible { display: block; }
    #ref-canvas {
      position: absolute;
      top: 0;
      right: 0;
      max-height: 100%;
    }
    .ref-divider {
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      background: rgba(255,255,255,0.8);
    }
    .ref-label {
      position: absolute;
      top: 10px;
      left: 8px;
      font-size: 10px;
      background: rgba(0,0,0,0.5);
      color: #fff;
      padding: 2px 6px;
      border-radius: 2px;
    }

    /* Canvas toolbar */
    .canvas-toolbar {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
    }
    .canvas-btn {
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: rgba(255,255,255,0.9);
      cursor: pointer;
      font-size: 11px;
      color: var(--black);
    }
    .canvas-btn.active { background: var(--black); color: #fff; border-color: var(--black); }

    /* Pro mode extras */
    .pro-only { display: none; }
    .pro-mode .pro-only { display: block; }
    .simple-only { display: block; }
    .pro-mode .simple-only { display: none; }

    /* B&W mode hides dye params */
    .dye-param { display: block; }
    .bw-mode .dye-param { display: none; }

    /* Negative-only params */
    .neg-only { display: none; }
    .neg-mode .neg-only { display: block; }

    /* Processing overlay */
    .processing {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.7);
      font-size: 12px;
      color: var(--mid);
    }
    .processing.active { display: flex; }
  </style>
</head>
<body>

  <!-- TOP BAR -->
  <header class="topbar">
    <span class="wordmark">Film Recipe</span>
    <div class="topbar-right">
      <!-- Film type toggle -->
      <div class="toggle-group" id="film-type-toggle">
        <button class="toggle-btn active" data-type="negative">Negative</button>
        <button class="toggle-btn" data-type="positive">Positive</button>
        <button class="toggle-btn" data-type="bw">B&W</button>
      </div>
      <!-- Simple/Pro toggle -->
      <div class="toggle-group" id="mode-toggle">
        <button class="toggle-btn active" data-mode="simple">Simple</button>
        <button class="toggle-btn" data-mode="pro">Pro</button>
      </div>
      <!-- Upload -->
      <label for="file-input" class="canvas-btn" style="cursor:pointer;">Upload image</label>
      <input type="file" id="file-input" accept="image/*">
    </div>
  </header>

  <!-- TEMPLATE STRIP -->
  <div class="template-strip" id="template-strip">
    <span class="label">Templates</span>
    <!-- populated by JS -->
  </div>

  <!-- MAIN -->
  <div class="main" id="main">

    <!-- LEFT PANEL -->
    <aside class="panel" id="panel">
      <!-- populated by JS -->
    </aside>

    <!-- RIGHT CANVAS AREA -->
    <div class="canvas-area" id="canvas-area">
      <div class="upload-zone" id="upload-zone">
        <span class="upload-zone-text">Drop an image here</span>
        <span class="upload-zone-sub">or click to upload</span>
      </div>
      <div class="canvas-container" id="canvas-container">
        <canvas id="output-canvas"></canvas>
        <div class="ref-overlay" id="ref-overlay">
          <canvas id="ref-canvas"></canvas>
          <div class="ref-divider"></div>
          <span class="ref-label" id="ref-label">Reference</span>
        </div>
        <div class="canvas-toolbar">
          <button class="canvas-btn" id="ref-btn">Reference</button>
        </div>
      </div>
      <div class="processing" id="processing">Processing…</div>
    </div>
  </div>

  <script>
    // All JS goes here in future tasks
  </script>

</body>
</html>
```

**Step 2: Browser check**

Open `index.html` in Chrome. Verify:
- Top bar shows "Film Recipe" wordmark, three toggle groups, upload button
- Template strip is empty (fine — JS not yet written)
- Left panel is empty, right area shows upload drop zone
- No console errors

**Step 3: Commit**
```bash
git add index.html
git commit -m "feat: html scaffold and css foundation"
```

---

### Task 2: Film Parameter Data Model + Stock Templates

**Files:**
- Modify: `index.html` — add to `<script>` block

**What to build:**

The complete data model for a film recipe, and all 6 stock presets. This is pure data — no rendering, no UI yet.

**Step 1: Add the recipe schema and stock data inside `<script>`**

```js
// ============================================================
// RECIPE SCHEMA
// A recipe object has this shape:
// {
//   filmType: 'negative' | 'positive' | 'bw',
//   layers: [
//     {
//       name: string,            // 'cyan' | 'magenta' | 'yellow' | 'panchromatic'
//       sensitizerPeak: number,  // nm, 380-700
//       sensitizerBw: number,    // nm, 30-150
//       dyeHue: number,          // degrees 0-360 (ignored for bw)
//       dyePurity: number,       // 0-1 (ignored for bw)
//       dmax: number,            // log density 0.1-3.0 (ignored for bw)
//       hdToe: number,           // 0-1
//       hdGamma: number,         // 0.5-3.0
//       hdShoulder: number,      // 0-1
//       crystalSize: number,     // μm 0.1-2.0
//     }
//   ],
//   global: {
//     maskDensity: number,   // 0-1 (negative only)
//     maskHue: number,       // degrees 0-360 (negative only)
//     dirInhibition: number, // 0-1
//     baseTintR: number,     // 0-1
//     baseTintG: number,     // 0-1
//     baseTintB: number,     // 0-1
//   }
// }
// ============================================================

const STOCK_TEMPLATES = {
  'Portra 400': {
    filmType: 'negative',
    layers: [
      { // Cyan coupler (red-sensitive layer)
        name: 'cyan',
        sensitizerPeak: 620, sensitizerBw: 80,
        dyeHue: 185, dyePurity: 0.70, dmax: 2.1,
        hdToe: 0.22, hdGamma: 0.68, hdShoulder: 0.82,
        crystalSize: 0.35,
      },
      { // Magenta coupler (green-sensitive layer)
        name: 'magenta',
        sensitizerPeak: 540, sensitizerBw: 90,
        dyeHue: 320, dyePurity: 0.75, dmax: 2.0,
        hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.80,
        crystalSize: 0.30,
      },
      { // Yellow coupler (blue-sensitive layer)
        name: 'yellow',
        sensitizerPeak: 440, sensitizerBw: 70,
        dyeHue: 55, dyePurity: 0.80, dmax: 2.2,
        hdToe: 0.18, hdGamma: 0.72, hdShoulder: 0.85,
        crystalSize: 0.28,
      },
    ],
    global: {
      maskDensity: 0.42, maskHue: 28,
      dirInhibition: 0.35,
      baseTintR: 1.0, baseTintG: 0.97, baseTintB: 0.94,
    },
  },

  'Gold 200': {
    filmType: 'negative',
    layers: [
      {
        name: 'cyan',
        sensitizerPeak: 615, sensitizerBw: 95,
        dyeHue: 190, dyePurity: 0.65, dmax: 2.3,
        hdToe: 0.15, hdGamma: 0.80, hdShoulder: 0.85,
        crystalSize: 0.25,
      },
      {
        name: 'magenta',
        sensitizerPeak: 545, sensitizerBw: 100,
        dyeHue: 330, dyePurity: 0.72, dmax: 2.1,
        hdToe: 0.14, hdGamma: 0.82, hdShoulder: 0.83,
        crystalSize: 0.22,
      },
      {
        name: 'yellow',
        sensitizerPeak: 445, sensitizerBw: 75,
        dyeHue: 48, dyePurity: 0.85, dmax: 2.4,
        hdToe: 0.12, hdGamma: 0.85, hdShoulder: 0.88,
        crystalSize: 0.20,
      },
    ],
    global: {
      maskDensity: 0.50, maskHue: 32,
      dirInhibition: 0.25,
      baseTintR: 1.0, baseTintG: 0.95, baseTintB: 0.88,
    },
  },

  'Velvia 50': {
    filmType: 'positive',
    layers: [
      {
        name: 'cyan',
        sensitizerPeak: 630, sensitizerBw: 65,
        dyeHue: 195, dyePurity: 0.92, dmax: 2.8,
        hdToe: 0.35, hdGamma: 1.60, hdShoulder: 0.70,
        crystalSize: 0.15,
      },
      {
        name: 'magenta',
        sensitizerPeak: 535, sensitizerBw: 70,
        dyeHue: 310, dyePurity: 0.90, dmax: 2.7,
        hdToe: 0.38, hdGamma: 1.65, hdShoulder: 0.68,
        crystalSize: 0.14,
      },
      {
        name: 'yellow',
        sensitizerPeak: 430, sensitizerBw: 65,
        dyeHue: 58, dyePurity: 0.88, dmax: 2.6,
        hdToe: 0.32, hdGamma: 1.55, hdShoulder: 0.72,
        crystalSize: 0.13,
      },
    ],
    global: {
      maskDensity: 0, maskHue: 0,
      dirInhibition: 0.60,
      baseTintR: 0.99, baseTintG: 0.99, baseTintB: 1.0,
    },
  },

  'Kodachrome 64': {
    filmType: 'positive',
    layers: [
      {
        name: 'cyan',
        sensitizerPeak: 625, sensitizerBw: 70,
        dyeHue: 200, dyePurity: 0.88, dmax: 2.5,
        hdToe: 0.28, hdGamma: 1.30, hdShoulder: 0.75,
        crystalSize: 0.18,
      },
      {
        name: 'magenta',
        sensitizerPeak: 545, sensitizerBw: 75,
        dyeHue: 350, dyePurity: 0.85, dmax: 2.4,
        hdToe: 0.25, hdGamma: 1.35, hdShoulder: 0.78,
        crystalSize: 0.17,
      },
      {
        name: 'yellow',
        sensitizerPeak: 440, sensitizerBw: 68,
        dyeHue: 50, dyePurity: 0.90, dmax: 2.6,
        hdToe: 0.22, hdGamma: 1.40, hdShoulder: 0.80,
        crystalSize: 0.16,
      },
    ],
    global: {
      maskDensity: 0, maskHue: 0,
      dirInhibition: 0.50,
      baseTintR: 1.0, baseTintG: 0.98, baseTintB: 0.96,
    },
  },

  'Ilford HP5': {
    filmType: 'bw',
    layers: [
      {
        name: 'panchromatic',
        sensitizerPeak: 550, sensitizerBw: 180,
        dyeHue: 0, dyePurity: 0, dmax: 0,
        hdToe: 0.20, hdGamma: 0.75, hdShoulder: 0.82,
        crystalSize: 0.55,
      },
    ],
    global: {
      maskDensity: 0, maskHue: 0,
      dirInhibition: 0,
      baseTintR: 1.0, baseTintG: 1.0, baseTintB: 1.0,
    },
  },

  'Kodak Tri-X': {
    filmType: 'bw',
    layers: [
      {
        name: 'panchromatic',
        sensitizerPeak: 560, sensitizerBw: 160,
        dyeHue: 0, dyePurity: 0, dmax: 0,
        hdToe: 0.35, hdGamma: 1.10, hdShoulder: 0.65,
        crystalSize: 0.90,
      },
    ],
    global: {
      maskDensity: 0, maskHue: 0,
      dirInhibition: 0,
      baseTintR: 0.99, baseTintG: 0.99, baseTintB: 0.98,
    },
  },
};

// Deep clone a template into the active recipe
function cloneTemplate(name) {
  return JSON.parse(JSON.stringify(STOCK_TEMPLATES[name]));
}

// Active recipe — starts as Portra 400
let currentRecipe = cloneTemplate('Portra 400');
let currentTemplate = 'Portra 400'; // for reference mode
let proMode = false;
let referenceActive = false;
let sourceImageData = null; // raw pixel data from uploaded image
```

**Step 2: Browser check**

Open browser console on `index.html`. Run:
```js
console.log(currentRecipe);
console.log(Object.keys(STOCK_TEMPLATES));
```
Expected: logs the Portra recipe object and all 6 stock names. No errors.

**Step 3: Commit**
```bash
git add index.html
git commit -m "feat: film recipe data model and stock templates"
```

---

### Task 3: Rendering Engine

**Files:**
- Modify: `index.html` — add to `<script>` block after Task 2 code

**What to build:**

The pure function `renderFilm(srcImageData, recipe)` that applies the chemical model to every pixel and returns a new `ImageData`. This is the core of the app.

**Step 1: Add helper functions and the render pipeline**

```js
// ============================================================
// RENDERING ENGINE
// ============================================================

// Convert HSL to RGB (0-1 range)
function hslToRgb(h, s, l) {
  h = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)];
}

// Gaussian sensitizer response: how much a channel (0-1) triggers a layer
// channelNm: approximate wavelength of R/G/B (700, 546, 446 nm)
function sensitizerResponse(channelNm, peakNm, bwNm) {
  const sigma = bwNm / 2.355; // bandwidth → standard deviation
  const exponent = -0.5 * Math.pow((channelNm - peakNm) / sigma, 2);
  return Math.exp(exponent);
}

// H&D curve: maps normalized log-exposure (0-1) to density (0-dmax)
// toe, gamma, shoulder are shape params
function hdCurve(exposure, toe, gamma, shoulder, dmax) {
  // Smooth S-curve built from clamped power function
  // toe: below this exposure, low density (shadow rolloff)
  // shoulder: above this exposure, density plateaus (highlight clip)
  const t = Math.max(0, Math.min(1, exposure));
  let density;
  if (t < toe) {
    // Toe region: gradual rolloff
    density = (t / toe) * (t / toe) * toe * dmax * 0.5;
  } else if (t > (1 - shoulder)) {
    // Shoulder region: rolloff to Dmax
    const s = (t - (1 - shoulder)) / shoulder;
    density = dmax * (1 - (1 - s) * (1 - s) * shoulder * 0.5);
  } else {
    // Linear region
    const linearT = (t - toe) / (1 - toe - shoulder);
    density = toe * dmax * 0.5 + linearT * gamma * dmax * (1 - toe - shoulder);
  }
  return Math.max(0, Math.min(dmax, density));
}

// Spatially-coherent grain using a simple seeded value noise
// Returns a noise value (-1 to 1) for pixel (x, y) with given scale
function grain(x, y, scale, seed) {
  const xi = Math.floor(x / scale);
  const yi = Math.floor(y / scale);
  // Hash function for deterministic noise
  const h = (xi * 1619 + yi * 31337 + seed * 1013) & 0x7fffffff;
  return ((h * 16807) % 2147483647) / 2147483647 * 2 - 1;
}

// Apply grain at a point with luminance weighting
// (grain is strongest in midtones, weaker in highlights and deep shadows on negative film)
function grainAmount(luminance, crystalSize) {
  const midtonePeak = 1 - Math.abs(luminance - 0.45) * 2;
  const strength = Math.max(0, midtonePeak) * crystalSize * 0.08;
  return strength;
}

// ============================================================
// MAIN RENDER FUNCTION
// ============================================================
function renderFilm(srcImageData, recipe) {
  const { width, height, data: src } = srcImageData;
  const output = new ImageData(width, height);
  const dst = output.data;

  const { layers, global: g, filmType } = recipe;
  const isBW = filmType === 'bw';
  const isNeg = filmType === 'negative';

  // Approximate wavelengths for R, G, B channels
  const CH_NM = [700, 546, 446]; // R, G, B

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Source RGB normalized 0-1
      const sr = src[idx]     / 255;
      const sg = src[idx + 1] / 255;
      const sb = src[idx + 2] / 255;
      const srcChannels = [sr, sg, sb];

      if (isBW) {
        // ---- B&W PATH ----
        const layer = layers[0];

        // Compute exposure: weighted sum of RGB using sensitizer response
        const wR = sensitizerResponse(CH_NM[0], layer.sensitizerPeak, layer.sensitizerBw);
        const wG = sensitizerResponse(CH_NM[1], layer.sensitizerPeak, layer.sensitizerBw);
        const wB = sensitizerResponse(CH_NM[2], layer.sensitizerPeak, layer.sensitizerBw);
        const wSum = wR + wG + wB || 1;
        const exposure = (sr * wR + sg * wG + sb * wB) / wSum;

        // H&D curve → silver density
        const density = hdCurve(exposure, layer.hdToe, layer.hdGamma, layer.hdShoulder, 2.5);

        // Negative → positive: density blocks light
        let lum = 1 - density / 2.5;
        lum = Math.max(0, Math.min(1, lum));

        // Add grain
        const g1 = grain(x, y, Math.max(1, layer.crystalSize * 4), 0);
        lum += g1 * grainAmount(lum, layer.crystalSize);
        lum = Math.max(0, Math.min(1, lum));

        // Apply base tint
        dst[idx]     = Math.round(lum * g.baseTintR * 255);
        dst[idx + 1] = Math.round(lum * g.baseTintG * 255);
        dst[idx + 2] = Math.round(lum * g.baseTintB * 255);
        dst[idx + 3] = 255;

      } else {
        // ---- COLOR PATH (negative / positive) ----

        // Per-layer: compute exposure → density → dye absorption color
        // Each layer produces a CMY dye. We accumulate total absorption.
        let totalAbsR = 0, totalAbsG = 0, totalAbsB = 0;
        const layerDensities = [];

        for (let li = 0; li < layers.length; li++) {
          const layer = layers[li];

          // Exposure: sensitizer-weighted input
          const wR = sensitizerResponse(CH_NM[0], layer.sensitizerPeak, layer.sensitizerBw);
          const wG = sensitizerResponse(CH_NM[1], layer.sensitizerPeak, layer.sensitizerBw);
          const wB = sensitizerResponse(CH_NM[2], layer.sensitizerPeak, layer.sensitizerBw);
          const wSum = wR + wG + wB || 1;
          const exposure = (sr * wR + sg * wG + sb * wB) / wSum;

          // H&D curve → density
          let density = hdCurve(exposure, layer.hdToe, layer.hdGamma, layer.hdShoulder, layer.dmax);

          layerDensities.push(density);
        }

        // DIR inter-layer inhibition: each layer slightly suppresses neighbors
        for (let li = 0; li < layers.length; li++) {
          const inhibit = g.dirInhibition * layerDensities[li] * 0.3;
          for (let lj = 0; lj < layers.length; lj++) {
            if (li !== lj) {
              layerDensities[lj] = Math.max(0, layerDensities[lj] - inhibit);
            }
          }
        }

        // Convert each layer's density to dye absorption (RGB)
        for (let li = 0; li < layers.length; li++) {
          const layer = layers[li];
          const density = layerDensities[li];

          // Dye absorption: the dye blocks its complementary color
          // dyeHue is the color OF the dye (what it looks like)
          // We need the absorption: opposite side
          // Purity controls how strongly vs gray
          const [dr, dg, db] = hslToRgb(layer.dyeHue, layer.dyePurity, 0.5);
          // Absorption is proportional to density and dye color
          totalAbsR += density * dr;
          totalAbsG += density * dg;
          totalAbsB += density * db;
        }

        // Transmission: light minus absorption
        let outR = Math.max(0, 1 - totalAbsR);
        let outG = Math.max(0, 1 - totalAbsG);
        let outB = Math.max(0, 1 - totalAbsB);

        if (isNeg) {
          // Negative: invert + apply orange mask
          outR = 1 - outR;
          outG = 1 - outG;
          outB = 1 - outB;

          // Orange mask: shifts overall color
          const [mR, mG, mB] = hslToRgb(g.maskHue, 0.9, 0.5);
          outR = outR * (1 - g.maskDensity * 0.5) + mR * g.maskDensity * 0.4;
          outG = outG * (1 - g.maskDensity * 0.3) + mG * g.maskDensity * 0.15;
          outB = outB * (1 - g.maskDensity * 0.2);
        }

        // Film base tint
        outR *= g.baseTintR;
        outG *= g.baseTintG;
        outB *= g.baseTintB;

        // Add grain (averaged across layers, weighted by crystal size)
        const avgCrystal = layers.reduce((s, l) => s + l.crystalSize, 0) / layers.length;
        const lum = (outR + outG + outB) / 3;
        const gVal = grain(x, y, Math.max(1, avgCrystal * 4), 7);
        const gStrength = gVal * grainAmount(lum, avgCrystal);
        outR = Math.max(0, Math.min(1, outR + gStrength));
        outG = Math.max(0, Math.min(1, outG + gStrength));
        outB = Math.max(0, Math.min(1, outB + gStrength));

        dst[idx]     = Math.round(outR * 255);
        dst[idx + 1] = Math.round(outG * 255);
        dst[idx + 2] = Math.round(outB * 255);
        dst[idx + 3] = 255;
      }
    }
  }

  return output;
}
```

**Step 2: Browser check**

In the console:
```js
// Create a tiny test: 1 white pixel
const testData = new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1);
const result = renderFilm(testData, currentRecipe);
console.log(result.data); // Should be 4 values, not [255,255,255,255]
```

No errors. Result should differ from input (Portra negative applied).

**Step 3: Commit**
```bash
git add index.html
git commit -m "feat: canvas rendering engine with chemical model"
```

---

### Task 4: Image Upload + Initial Render

**Files:**
- Modify: `index.html` — add to `<script>` block

**What to build:**

Wire up file upload (click + drag-and-drop), decode the image onto a hidden canvas, store `sourceImageData`, trigger render, show result on `#output-canvas`.

**Step 1: Add upload and render orchestration**

```js
// ============================================================
// IMAGE UPLOAD + RENDER ORCHESTRATION
// ============================================================

const fileInput       = document.getElementById('file-input');
const uploadZone      = document.getElementById('upload-zone');
const canvasContainer = document.getElementById('canvas-container');
const outputCanvas    = document.getElementById('output-canvas');
const refCanvas       = document.getElementById('ref-canvas');
const processing      = document.getElementById('processing');
const refOverlay      = document.getElementById('ref-overlay');
const refBtn          = document.getElementById('ref-btn');
const refLabel        = document.getElementById('ref-label');

// Hidden decode canvas (never shown)
const decodeCanvas = document.createElement('canvas');
const decodeCtx    = decodeCanvas.getContext('2d');

function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // Cap at 1200px wide for performance
    const maxW = 1200;
    const scale = Math.min(1, maxW / img.width);
    decodeCanvas.width  = Math.round(img.width  * scale);
    decodeCanvas.height = Math.round(img.height * scale);
    decodeCtx.drawImage(img, 0, 0, decodeCanvas.width, decodeCanvas.height);
    sourceImageData = decodeCtx.getImageData(0, 0, decodeCanvas.width, decodeCanvas.height);
    URL.revokeObjectURL(url);
    triggerRender();
    uploadZone.style.display = 'none';
    canvasContainer.classList.add('visible');
  };
  img.src = url;
}

function triggerRender() {
  if (!sourceImageData) return;
  processing.classList.add('active');
  // Defer to next frame so the "Processing…" overlay appears before blocking
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const result = renderFilm(sourceImageData, currentRecipe);
      outputCanvas.width  = result.width;
      outputCanvas.height = result.height;
      outputCanvas.getContext('2d').putImageData(result, 0, 0);

      if (referenceActive) renderReference();

      processing.classList.remove('active');
    });
  });
}

function renderReference() {
  const refRecipe = cloneTemplate(currentTemplate);
  const result = renderFilm(sourceImageData, refRecipe);
  refCanvas.width  = result.width;
  refCanvas.height = result.height;
  refCanvas.getContext('2d').putImageData(result, 0, 0);
  // Position ref canvas: same size, right half shows through overlay
  refCanvas.style.width  = outputCanvas.offsetWidth + 'px';
  refCanvas.style.height = outputCanvas.offsetHeight + 'px';
}

// Upload events
fileInput.addEventListener('change', e => loadImageFile(e.target.files[0]));
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  loadImageFile(e.dataTransfer.files[0]);
});

// Reference toggle
refBtn.addEventListener('click', () => {
  referenceActive = !referenceActive;
  refBtn.classList.toggle('active', referenceActive);
  refOverlay.classList.toggle('visible', referenceActive);
  if (referenceActive && sourceImageData) renderReference();
});
```

**Step 2: Browser check**

- Upload a JPEG photo
- Upload zone disappears, canvas appears
- "Processing…" shows briefly then disappears
- Image appears with Portra 400 applied (warm, slightly desaturated vs original)
- No console errors

**Step 3: Commit**
```bash
git add index.html
git commit -m "feat: image upload, decode, and render trigger"
```

---

### Task 5: Left Panel UI — Layer Controls

**Files:**
- Modify: `index.html` — add to `<script>` block

**What to build:**

Dynamically build the left panel from `currentRecipe`. Each layer gets its parameter sliders. Changes trigger re-render. Simple/Pro label switching baked in from the start.

**Step 1: Add label maps and panel builder**

```js
// ============================================================
// PANEL UI
// ============================================================

const LAYER_COLORS = {
  cyan: '#00a8b5',
  magenta: '#c0006a',
  yellow: '#c8a000',
  panchromatic: '#555555',
};

// Parameter definitions: [key, simpleLabel, proLabel, proUnit, min, max, step, decimals]
const LAYER_PARAMS = [
  ['sensitizerPeak', 'Color sensitivity center', 'Sensitizer peak', 'nm', 380, 700, 1, 0],
  ['sensitizerBw',   'Sensitivity range',        'Sensitizer bandwidth', 'nm', 30, 150, 1, 0],
  ['dyeHue',         'Dye color',                'Dye hue', '°', 0, 360, 1, 0],
  ['dyePurity',      'Dye richness',             'Dye purity', '', 0, 1, 0.01, 2],
  ['dmax',           'Color depth',              'Dmax', '', 0.1, 3.0, 0.05, 2],
  ['hdToe',          'Shadow detail',            'Toe', '', 0, 0.5, 0.01, 2],
  ['hdGamma',        'Contrast',                 'Gamma', '', 0.5, 3.0, 0.05, 2],
  ['hdShoulder',     'Highlight rolloff',        'Shoulder', '', 0, 0.5, 0.01, 2],
  ['crystalSize',    'Grain texture',            'Crystal size', 'μm', 0.1, 2.0, 0.05, 2],
];

const DYE_PARAMS = new Set(['dyeHue', 'dyePurity', 'dmax']); // hidden in B&W

const GLOBAL_PARAMS = [
  ['maskDensity',  'Orange mask',  'Mask density', '', 0, 1, 0.01, 2, 'neg-only'],
  ['maskHue',      'Mask tint',    'Mask hue', '°', 0, 60, 1, 0, 'neg-only'],
  ['dirInhibition','Color bleed',  'DIR inhibition', '', 0, 1, 0.01, 2, ''],
  ['baseTintR',    'Base red',     'Base tint R', '', 0.8, 1.0, 0.005, 3, ''],
  ['baseTintG',    'Base green',   'Base tint G', '', 0.8, 1.0, 0.005, 3, ''],
  ['baseTintB',    'Base blue',    'Base tint B', '', 0.8, 1.0, 0.005, 3, ''],
];

function makeSlider(container, key, simpleLabel, proLabel, proUnit, min, max, step, decimals, getValue, setValue, extraClass) {
  const row = document.createElement('div');
  row.className = 'param-row' + (extraClass ? ' ' + extraClass : '');
  row.dataset.key = key;

  const labelRow = document.createElement('div');
  labelRow.className = 'param-label';

  const nameEl = document.createElement('span');
  nameEl.className = 'param-name';
  nameEl.dataset.simple = simpleLabel;
  nameEl.dataset.pro = proLabel;
  nameEl.textContent = proMode ? proLabel : simpleLabel;

  const valEl = document.createElement('span');
  valEl.className = 'param-value';
  valEl.dataset.decimals = decimals;

  if (proUnit) {
    const unitEl = document.createElement('span');
    unitEl.className = 'param-unit pro-only';
    unitEl.textContent = proUnit;
    valEl.appendChild(document.createTextNode(getValue().toFixed(decimals)));
    valEl.appendChild(unitEl);
  } else {
    valEl.textContent = getValue().toFixed(decimals);
  }

  labelRow.appendChild(nameEl);
  labelRow.appendChild(valEl);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = getValue();

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    setValue(v);
    // Update displayed value
    const decimalsN = parseInt(valEl.dataset.decimals);
    const textNode = valEl.firstChild;
    if (textNode) textNode.textContent = v.toFixed(decimalsN);
    else valEl.textContent = v.toFixed(decimalsN);
    scheduleRender();
  });

  row.appendChild(labelRow);
  row.appendChild(slider);
  container.appendChild(row);
}

let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(triggerRender, 80); // debounce 80ms
}

function buildPanel() {
  const panel = document.getElementById('panel');
  panel.innerHTML = '';
  const isBW  = currentRecipe.filmType === 'bw';
  const isNeg = currentRecipe.filmType === 'negative';

  // Add body class for CSS
  document.body.classList.toggle('bw-mode',  isBW);
  document.body.classList.toggle('neg-mode', isNeg);

  // Layer sections
  currentRecipe.layers.forEach((layer, li) => {
    const section = document.createElement('div');
    section.className = 'layer-section';

    const header = document.createElement('div');
    header.className = 'layer-header';

    const dot = document.createElement('div');
    dot.className = 'layer-dot';
    dot.style.background = LAYER_COLORS[layer.name] || '#888';

    const title = document.createElement('span');
    title.className = 'layer-title';
    const layerDisplayNames = {
      cyan: proMode ? 'Layer 1 — Red-sensitive / Cyan coupler' : 'Cyan layer',
      magenta: proMode ? 'Layer 2 — Green-sensitive / Magenta coupler' : 'Magenta layer',
      yellow: proMode ? 'Layer 3 — Blue-sensitive / Yellow coupler' : 'Yellow layer',
      panchromatic: proMode ? 'Panchromatic layer — Silver halide' : 'Silver layer',
    };
    title.textContent = layerDisplayNames[layer.name] || layer.name;
    title.dataset.layerIndex = li;

    header.appendChild(dot);
    header.appendChild(title);
    section.appendChild(header);

    LAYER_PARAMS.forEach(([key, simpleLabel, proLabel, proUnit, min, max, step, decimals]) => {
      const isDye = DYE_PARAMS.has(key);
      const extraClass = isDye ? 'dye-param' : '';
      if (isBW && isDye) return; // skip dye params for B&W
      const isHD = key.startsWith('hd');

      // H&D group header
      if (key === 'hdToe') {
        const hdGroup = document.createElement('div');
        hdGroup.className = 'hd-group';
        const hdLabel = document.createElement('div');
        hdLabel.className = 'hd-label';
        hdLabel.textContent = proMode ? 'H&D Characteristic Curve' : 'Tone response';

        // Pro mode: H&D canvas
        const hdCanvas = document.createElement('canvas');
        hdCanvas.className = 'hd-canvas';
        hdCanvas.width = 240;
        hdCanvas.height = 80;
        hdCanvas.dataset.layerIndex = li;

        hdGroup.appendChild(hdLabel);
        hdGroup.appendChild(hdCanvas);
        section.appendChild(hdGroup);
      }

      makeSlider(
        section, key, simpleLabel, proLabel, proUnit, min, max, step, decimals,
        () => currentRecipe.layers[li][key],
        v  => { currentRecipe.layers[li][key] = v; updateHDCanvas(li); },
        extraClass
      );
    });

    panel.appendChild(section);
  });

  // Global section
  const globalSection = document.createElement('div');
  globalSection.className = 'global-section';
  const globalTitle = document.createElement('div');
  globalTitle.className = 'global-title';
  globalTitle.textContent = 'Global';
  globalSection.appendChild(globalTitle);

  GLOBAL_PARAMS.forEach(([key, simpleLabel, proLabel, proUnit, min, max, step, decimals, cssClass]) => {
    if (isBW && (key === 'maskDensity' || key === 'maskHue')) return;
    makeSlider(
      globalSection, key, simpleLabel, proLabel, proUnit, min, max, step, decimals,
      () => currentRecipe.global[key],
      v  => { currentRecipe.global[key] = v; },
      cssClass
    );
  });

  panel.appendChild(globalSection);

  // Update all H&D canvases
  currentRecipe.layers.forEach((_, li) => updateHDCanvas(li));

  // Apply current mode labels
  applyModeLabels();
}

function updateHDCanvas(layerIndex) {
  const canvases = document.querySelectorAll(`.hd-canvas[data-layer-index="${layerIndex}"]`);
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const layer = currentRecipe.layers[layerIndex];
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
    }

    // Curve
    ctx.strokeStyle = LAYER_COLORS[layer.name] || '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const exposure = px / w;
      const density = hdCurve(exposure, layer.hdToe, layer.hdGamma, layer.hdShoulder, layer.dmax || 2.5);
      const py = h - (density / (layer.dmax || 2.5)) * h;
      if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  });
}

function applyModeLabels() {
  document.querySelectorAll('.param-name').forEach(el => {
    el.textContent = proMode ? el.dataset.pro : el.dataset.simple;
  });
  document.querySelectorAll('.layer-title').forEach(el => {
    const li = parseInt(el.dataset.layerIndex);
    if (isNaN(li)) return;
    const layer = currentRecipe.layers[li];
    const names = {
      cyan: proMode ? 'Layer 1 — Red-sensitive / Cyan coupler' : 'Cyan layer',
      magenta: proMode ? 'Layer 2 — Green-sensitive / Magenta coupler' : 'Magenta layer',
      yellow: proMode ? 'Layer 3 — Blue-sensitive / Yellow coupler' : 'Yellow layer',
      panchromatic: proMode ? 'Panchromatic layer — Silver halide' : 'Silver layer',
    };
    el.textContent = names[layer.name] || layer.name;
  });
  document.querySelectorAll('.hd-label').forEach(el => {
    el.textContent = proMode ? 'H&D Characteristic Curve' : 'Tone response';
  });
  document.body.classList.toggle('pro-mode', proMode);
}

// Initial build
buildPanel();
```

**Step 2: Browser check**

- Left panel shows three layer sections (Portra 400 loaded)
- Each layer has sliders for all parameters
- Moving any slider triggers a re-render (with debounce — should feel responsive)
- No console errors

**Step 3: Commit**
```bash
git add index.html
git commit -m "feat: left panel layer controls with live re-render"
```

---

### Task 6: Top Bar Interactivity — Film Type, Mode Toggle, Templates

**Files:**
- Modify: `index.html` — add to `<script>` block

**What to build:**

Wire up the Negative/Positive/B&W toggle, Simple/Pro toggle, and template buttons.

**Step 1: Build template strip and wire all toggles**

```js
// ============================================================
// TOP BAR INTERACTIVITY
// ============================================================

// --- Template strip ---
function buildTemplateStrip() {
  const strip = document.getElementById('template-strip');
  // Clear existing buttons (keep the label)
  strip.querySelectorAll('.template-btn').forEach(b => b.remove());

  const typeMap = {
    'Portra 400': 'neg', 'Gold 200': 'neg',
    'Velvia 50': 'pos', 'Kodachrome 64': 'pos',
    'Ilford HP5': 'bw', 'Kodak Tri-X': 'bw',
  };

  Object.keys(STOCK_TEMPLATES).forEach(name => {
    const btn = document.createElement('button');
    btn.className = `template-btn type-${typeMap[name]}`;
    btn.textContent = name;
    btn.dataset.template = name;
    if (name === currentTemplate) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentTemplate = name;
      currentRecipe = cloneTemplate(name);

      // Sync film type toggle to match template
      document.querySelectorAll('#film-type-toggle .toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === currentRecipe.filmType);
      });

      // Update active button
      document.querySelectorAll('.template-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.template === name)
      );

      buildPanel();
      triggerRender();
      if (referenceActive) renderReference();
    });
    strip.appendChild(btn);
  });
}

buildTemplateStrip();

// --- Film type toggle ---
document.querySelectorAll('#film-type-toggle .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    document.querySelectorAll('#film-type-toggle .toggle-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    currentRecipe.filmType = type;
    buildPanel();
    triggerRender();
  });
});

// --- Simple/Pro mode toggle ---
document.querySelectorAll('#mode-toggle .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    proMode = btn.dataset.mode === 'pro';
    document.querySelectorAll('#mode-toggle .toggle-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    applyModeLabels();
    // Rebuild panel to show/hide H&D canvases and update layer titles
    buildPanel();
    if (sourceImageData) triggerRender();
  });
});
```

**Step 2: Browser check**

- Click each template button: recipe loads, panel updates, render triggers
- Switch Negative → Positive → B&W: panel morphs (B&W shows 1 layer, no dye params)
- Switch Simple → Pro: labels update throughout, H&D curve canvas appears in each layer
- Template buttons highlight correctly on click
- Reference toggle shows split view when enabled

**Step 3: Commit**
```bash
git add index.html
git commit -m "feat: film type toggle, simple/pro mode, template loading"
```

---

### Task 7: Polish Pass

**Files:**
- Modify: `index.html`

**What to build:**

Visual polish to match the editorial/magazine aesthetic. No new functionality.

**Step 1: Add these refinements to the CSS `<style>` block**

```css
/* Scrollbar */
.panel::-webkit-scrollbar { width: 4px; }
.panel::-webkit-scrollbar-track { background: transparent; }
.panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* Template strip — category separators */
.template-strip .sep {
  width: 1px; height: 16px;
  background: var(--border);
  margin: 0 4px;
}

/* Slider accent color per layer */
.layer-cyan    input[type=range]::-webkit-slider-thumb { background: var(--layer-cyan); }
.layer-magenta input[type=range]::-webkit-slider-thumb { background: var(--layer-magenta); }
.layer-yellow  input[type=range]::-webkit-slider-thumb { background: var(--layer-yellow); }
.layer-bw      input[type=range]::-webkit-slider-thumb { background: var(--layer-bw); }

/* Reference label styling */
.ref-label-yours {
  position: absolute; top: 10px; left: 8px;
  font-size: 10px; background: rgba(0,0,0,0.5);
  color: #fff; padding: 2px 6px; border-radius: 2px;
}
```

**Step 2: Add category separators to template strip in `buildTemplateStrip()`**

After the Gold 200 button and after the Kodachrome 64 button, insert a `<span class="sep">` element to visually group Neg / Pos / B&W templates.

Modify `buildTemplateStrip()` to track type changes:
```js
let lastType = null;
Object.keys(STOCK_TEMPLATES).forEach(name => {
  const type = typeMap[name];
  if (lastType && type !== lastType) {
    const sep = document.createElement('span');
    sep.className = 'sep';
    strip.appendChild(sep);
  }
  lastType = type;
  // ... rest of button creation unchanged
});
```

**Step 3: Add layer CSS class to each layer section**

In `buildPanel()`, when creating `section`, add:
```js
section.classList.add(`layer-${layer.name}`);
```

**Step 4: Browser check**

- Template strip has two thin separators between Neg/Pos and Pos/B&W groups
- Slider thumbs are colored per layer (cyan/magenta/yellow)
- Panel scrollbar is thin and minimal
- Overall feel is clean, editorial, not cluttered

**Step 5: Commit**
```bash
git add index.html
git commit -m "polish: editorial ui refinements, layer colors, separators"
```

---

## Done

The prototype is complete when all 7 tasks pass their browser checks. The output is a single `index.html` that:
- Accepts any uploaded image as a test strip
- Renders it through a real chemical model (sensitizer response, H&D curves, dye couplers, grain, masking, DIR inhibition)
- Offers 6 film stock templates as starting points
- Lets users tune all 29 chemical parameters in real time
- Switches between Simple and Pro vocabulary without changing the model
- Shows a reference split view for A/B comparison
