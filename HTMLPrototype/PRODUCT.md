# Film Lab — Product Document

## What This Is

A browser-based film simulation app where users act as film chemical engineers.
Instead of tweaking color grading sliders, users design emulsion layers, choose dye
chemistry, and develop film in a virtual darkroom. The rendering engine models real
photographic physics (spectral sensitivity, H&D curves, Beer-Lambert dye absorption,
orange mask, grain).

The long-term target is an **iPhone camera app**. This web prototype validates the
simulation model and UX before native development.

## How to Run

```
python3 -m http.server 8765
# open http://localhost:8765
```

No build step. No bundler. No npm. Pure ES modules served statically.

## Project Structure

```
index.html                  Tab-based layout shell (topbar, canvas, film strip, tabs)
styles/main.css             Mobile-first CSS with responsive desktop grid
src/
  main.js                   App bootstrap, tab routing, render loop
  state.js                  Data model: stock templates, blank templates,
                            control definitions, tonePreset(), applyDevelopment(),
                            app state, localStorage persistence
  engine/
    renderer.js             WebGL (GLSL) + Canvas2D CPU fallback rendering engine
  ui/
    tabs.js                 4-tab content builder (Film/Layers/Base/Develop)
    topbar.js               Simple/Pro toggle, film strip builder
    canvas.js               Tap-to-upload, drag-drop, reference overlay, raw toggle
    spectrum.js             Spectrum-driven layer editor: interactive bell curves
                            encoding dmax/bandwidth/purity, absorption overlay,
                            H&D mini-curves, grain dots, stacking visualization
assets/
  testIMG.jpg               Test photograph
  colorChart.png            Synthetic color chart for pipeline validation
docs/plans/                 Historical design and implementation plans
```

## Architecture

```
User Input (sliders / spectrum drag)
       │
       ▼
   state.js ─── currentRecipe + labState
       │
       ▼
 applyDevelopment() ─── merges dev params onto working recipe
       │
       ▼
   developed recipe (sent to renderer each frame)
       │
       ▼
  renderer.js ─── WebGL (≤3 layers) or CPU fallback (4-5 layers)
       │
       ▼
   <canvas> output
```

### Rendering Pipeline (GLSL / CPU)

1. **sRGB linearization** — `s2l()`: inverse gamma to get linear light
2. **Spectral sensitivity** — Gaussian bell around each layer's `sensitizerPeak`
3. **Layer stacking attenuation** — upper layers absorb light before it reaches
   lower layers, controlled by `stackingStrength` (0 = no stacking, 1 = full
   physical stacking). Uses Beer-Lambert dye absorption per layer to attenuate
   `availableLight` top-to-bottom. Stacking always uses pre-reversal density
   (both GPU and CPU paths). Layer order in the array = physical stacking order.
4. **H&D curve** — toe/gamma/shoulder density response per layer
5. **Positive reversal** — for slide film: `dmax - density` (applied after stacking)
6. **DIR inhibition** — inter-layer density suppression (edge sharpness)
7. **Dye absorption** — Beer-Lambert: complementary hue absorption vectors
8. **Negative scan** — exponential paper response `1 - exp(-OD * 3.0)`, or raw
   view with orange mask (mask color controlled by `maskHue` 0-60°)
9. **Grain** — hash-based noise scaled by crystal size and mid-tone luminance
10. **Gamma encode** — `l2s()`: back to sRGB for display

The WebGL shader handles exactly 3 layers via `vec3` uniforms. When a custom film
has 4 or 5 layers, `render()` automatically routes to `_renderCPU()` which loops
over N layers, then blits the result back through WebGL via a passthrough uniform
(`uPassthrough`).

## Data Model

### Recipe Object

```js
{
  filmType: 'negative' | 'positive' | 'bw',
  layers: [
    {
      name: 'cyan',
      sensitizerPeak: 620,   // nm — wavelength of peak sensitivity
      sensitizerBw: 80,      // nm — Gaussian bandwidth (FWHM)
      dyeHue: 185,           // degrees — dye coupler hue
      dyePurity: 0.70,       // 0-1 — color saturation of formed dye
      dmax: 2.1,             // max optical density
      hdToe: 0.22,           // H&D shadow compression zone
      hdGamma: 0.68,         // H&D slope (contrast)
      hdShoulder: 0.18,      // H&D highlight rolloff zone
      crystalSize: 0.35,     // grain size factor
    },
    // ... up to 5 layers for custom films
  ],
  global: {
    stackingStrength: 0,     // 0-1 — how strongly upper layers attenuate light for lower ones
    maskDensity: 0.42,       // orange mask strength (negative only)
    maskHue: 28,             // 0-60° — shifts orange mask color (0=red-orange, 28=classic, 60=yellow-orange)
    dirInhibition: 0.35,     // DIR coupler strength
    baseTintR: 1.0,          // film base tint RGB
    baseTintG: 0.97,
    baseTintB: 0.94,
  }
}
```

### App State (`state.js`)

- `currentRecipe` — the working recipe, always mutable
- `labState` — development environment controls (temperature, time, agitation, etc.)
- `activeTab` — 'film' | 'layers' | 'base' | 'develop'
- `currentTemplate` — name of last-selected stock template
- `recipeName` — name of current saved recipe (empty for unsaved)
- `isDirty` — true when recipe modified since last save/load
- `savedRecipes` — persisted to `localStorage` under key `filmlab-custom-recipes`
- `proMode` / `rawMode` / `referenceActive` — UI toggles

### Stock Templates

Six built-in films: Portra 400, Gold 200, Velvia 50, Kodachrome 64, Ilford HP5,
Kodak Tri-X. Defined as `STOCK_TEMPLATES` in `state.js`.

## Unified Recipe Model

Every film is a recipe. Stock presets are read-only sources — selecting one clones
it into the working recipe, fully editable. There is no stock vs custom mode split.

### 4-Tab Layout

- **Film tab** — Film type toggle (Negative/Positive/B&W), always-editable spectrum
  canvas, Save/Save As/Upload actions
- **Layers tab** — Per-layer slider sections with add/remove/reorder. Simple mode:
  Tone + Reversal + Grain. Pro mode adds expandable H&D Curve Parameters.
  B&W shows single Panchromatic layer.
- **Base tab** — Global controls (stacking, DIR, base tint) + orange mask (negative only)
- **Develop tab** — Development environment sliders + generated Lab Notes

### Spectrum Interactions

Five parameters are encoded directly into the visual/interactive geometry:
- Drag **pointer horizontally** → `sensitizerPeak`
- Drag **bell curve edges** → `sensitizerBw` (bandwidth)
- Drag **bell curve top** up/down → `dmax` (density)
- Bell **fill opacity** → `dyePurity`
- Pointer **fill color** → `dyeHue`

Click a pointer → popup/bottom-sheet with sliders for peak, bandwidth, density,
dye color, purity, contrast.

### Film Strip

Persistent horizontal scroll row between image and tab content. Stock template
chips grouped by type (negative/positive/B&W), user-saved films after a separator
with delete affordance, "+ New" chip at the end.

## Spectrum UI (`src/ui/spectrum.js`)

Canvas layout (top to bottom):
- **Rainbow bar** (24px) — visible spectrum 380–700nm
- **Absorption band** (8px) — combined spectral absorption of all layers; darker = more absorption at that wavelength
- **Bell curves** (100px) — one per layer with interactive geometry:
  - Height = `dmax` (draggable handle at top)
  - Width = `sensitizerBw` (draggable handles at FWHM edges)
  - Fill opacity = `dyePurity`
  - **H&D mini-curve** inside each bell peak (sparkline of toe/gamma/shoulder shape)
  - **Grain dots** at base (coarseness matches `crystalSize`)
  - **Overlap zones** highlighted where bells intersect (indicates spectral competition)
  - **Stacking dimming** — lower layers progressively dimmed based on `stackingStrength`
- **Pointers** (32px) — pin-shaped markers at `sensitizerPeak`, colored by `dyeHue`

Interactions:
- Drag pointer horizontally → change `sensitizerPeak`
- Drag bell top vertically → change `dmax`
- Drag bell edges horizontally → change `sensitizerBw`
- Click pointer → popup with sliders for peak, bandwidth, density, dye color, purity, contrast
- Cursor changes to `ns-resize` / `ew-resize` / `grab` on hover over interactive zones
- On screens < 600px, popup becomes a bottom sheet
- Spectrum is always editable (no read-only mode)

## Touch-Friendly & Responsive Design

- Mobile-first flexbox column layout with 4-tab bottom bar
- Dark theme with near-black backgrounds (`--bg: #0c0c0c`) for photography focus
- Pointer Events API throughout (works for mouse and touch)
- `touch-action: none` on spectrum canvas, larger pointer/hit test radii (18px)
- `@media (pointer: coarse)` enlarges slider thumbs to 24px, film chips to 44px min
- Mobile: tab content at bottom (max-height 42vh, scrollable), tab bar at bottom
- Desktop (768px+): CSS Grid sidebar layout — tabs/content/strip on left, canvas on right
- Wide (1400px+): wider sidebar (420px)
- Safe area insets for notched devices (`env(safe-area-inset-*)`)
- Spectrum popup becomes a bottom sheet on screens < 600px
- Film strip with horizontal momentum scroll and scroll-snap

## Design Decisions

- **3-wavelength spectral model** (625, 540, 450nm) — a deliberate trade-off.
  Full 380-700nm integration would cost ~20x more per pixel for marginal visual
  benefit. The effective useful range for custom layer peaks is ~440-620nm;
  peaks outside this range still produce plausible (if attenuated) results via
  the Gaussian tail. A 7-point model could be a future upgrade if needed.
- **Universal engine, many presets** — every stock template (Portra 400, Velvia 50,
  Tri-X, etc.) is just a recipe object with different parameter values fed into
  the same rendering pipeline. There is no per-film special-case code. Selecting
  any template clones it into the working recipe for direct editing. Development
  parameters are applied via `applyDevelopment()` in state.js.
- **Stacking uses pre-reversal density** — for positive (slide) film, the
  Beer-Lambert stacking attenuation is computed from the raw H&D density before
  the reversal step (`dmax - d`). This matches the physical reality: light
  passes through undeveloped emulsion layers top-to-bottom before any reversal
  processing occurs.

## Known Limitations / Future Work

- **CPU fallback for 4-5 layers is not 60fps** — acceptable for experimentation,
  but the iPhone app will need a Metal compute shader for N layers.
- **No undo/redo** — would benefit from a command stack on recipe mutations.
- **No export** — processed image can't be saved yet (add canvas `toBlob()` download).
- **No preset sharing** — recipes are localStorage only; add JSON import/export.
- **WebGL shader is 3-layer only** — could be extended with a loop and texture-based
  uniform packing to handle N layers on GPU.
- **Scan exposure hardcoded** — the negative scan factor (`3.0`) could be a user
  parameter for simulating different paper grades / scanner contrast.
- **baseTintR/G/B as 3 sliders** — a single warmth slider or small color picker
  would be more intuitive for this 3-component control.
- **iPhone native port** — Core Image / Metal pipeline, AVFoundation camera integration.
  Apple does expose camera APIs to third-party apps (ProRAW, depth, etc.) but
  computational photography features (Deep Fusion, Photonic Engine) are not directly
  accessible; the app would apply film simulation as a post-process on RAW/ProRAW frames.

## Coding Conventions

- **No build tools** — vanilla JS ES modules, no TypeScript, no bundler.
- **KISS** — keep code modular and simple. Remove unnecessary code.
- **No frameworks** — DOM manipulation is direct. No React, no lit-html.
- **File organization** — `src/engine/` for rendering math, `src/ui/` for DOM,
  `src/state.js` for data, `styles/` for CSS.
- **CSS variables** — `--bg`, `--surface`, `--surface-raised`, `--border`,
  `--text`, `--text-2`, `--text-3`, `--active-bg`, `--tab-h`, `--sidebar-w`.
- **Rendering** — all image processing happens in `renderer.js`. The GLSL shader
  and CPU path must stay in sync (same math, same results).
