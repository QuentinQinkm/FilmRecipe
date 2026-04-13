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
index.html                  3-tab layout shell (topbar, canvas, film strip, spectrum, tabs)
styles/main.css             Mobile-first CSS with responsive desktop grid
src/
  main.js                   App bootstrap, tab routing, spectrum mounting, render loop
  state.js                  Data model: stock templates, blank recipe,
                            control definitions, tonePreset(), complementHue(),
                            applyDevelopment(), app state, localStorage persistence
  engine/
    renderer.js             WebGL (GLSL) rendering engine with up to 5 layers on GPU,
                            Canvas2D CPU fallback only when WebGL unavailable
  ui/
    tabs.js                 3-tab content builder (Layers/Base/Develop)
    topbar.js               Simple/Pro toggle, Save/Save As buttons, film strip builder
    canvas.js               Tap-to-upload, drag-drop, reference overlay, raw toggle
    spectrum.js             Persistent spectrum visualization: interactive bell curves
                            on desktop (pointer: fine), read-only on touch (pointer: coarse).
                            Encodes dmax/bandwidth/purity, absorption overlay,
                            H&D mini-curves, grain dots, stacking visualization.
docs/plans/                 Historical design and implementation plans
```

## Architecture

```
User Input (sliders / spectrum drag on desktop)
       |
       v
   state.js --- currentRecipe + labState
       |
       v
 applyDevelopment() --- merges dev params onto working recipe
       |
       v
   developed recipe (sent to renderer each frame)
       |
       v
  renderer.js --- WebGL GPU path (up to 5 layers via float[5] uniform arrays)
       |            CPU fallback only when WebGL is completely unavailable
       v
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
   view with orange mask (mask color controlled by `maskHue` 0-60deg)
9. **Per-layer grain** — physics-based crystal emulation applied at the density
   stage (before dye absorption), independently per layer:
   - **Binomial statistics**: `sigma = sqrt(p*(1-p)/N)` where `N = 1/(cs²+0.01)`
     crystals per cell and `p = density/dmax` is develop probability
   - **Jittered cell hashing**: breaks grid alignment by offsetting cell centers
     with per-cell random jitter
   - **Multi-octave noise**: two crystal scales blended 70/30 for natural size
     distribution
   - **Per-layer seeds**: each layer gets an independent hash seed so grain
     patterns are uncorrelated across layers
   - Grain IS the density variation (crystal develop/don't-develop), not a
     post-process overlay
10. **Gamma encode** — `l2s()`: back to sRGB for display

The WebGL shader supports up to 5 layers via `float[5]` uniform arrays and a
`uLayerCount` uniform. CPU fallback (`_renderCPU`) only activates when WebGL
is completely unavailable (no browser support).

## Data Model

### Physics-Based Film Chemistry

There is **no `filmType` enum**. Film behavior emerges from physical properties:

- **Negative vs Positive (slide)**: controlled by `reversal` in `global` (0 = C-41
  negative process, 1 = E-6 reversal process). This is a bath process, not a
  per-layer property.
- **Color vs B&W**: determined by `dyePurity` per layer. `dyePurity < 0.01` = silver
  halide only (no dye coupler). A film with all layers at `dyePurity < 0.01` renders
  as B&W. Users can mix color and silver layers freely.
- **Orange mask**: a base property (`maskDensity` in `global`), always available.
  Physically meaningful only for negative film but not gated by film type.
- **Dye hue**: auto-derived from `sensitizerPeak` via `complementHue()` — the dye
  formed is always the complement of the wavelength the layer absorbs (red-sensitive
  layer -> cyan dye, green -> magenta, blue -> yellow). `dyeHue` is stored on the
  layer but auto-updated whenever `sensitizerPeak` changes.

### Recipe Object

```js
{
  layers: [
    {
      name: 'cyan',
      sensitizerPeak: 620,   // nm — wavelength of peak sensitivity
      sensitizerBw: 80,      // nm — Gaussian bandwidth (FWHM)
      dyeHue: 185,           // degrees — auto-derived from sensitizerPeak via complementHue()
      dyePurity: 0.70,       // 0-1 — dye coupler presence (0 = silver/B&W, >0 = color)
      dmax: 2.1,             // max optical density
      hdToe: 0.22,           // H&D shadow compression zone
      hdGamma: 0.68,         // H&D slope (contrast)
      hdShoulder: 0.18,      // H&D highlight rolloff zone
      crystalSize: 0.35,     // grain size factor
    },
    // ... up to 5 layers
  ],
  global: {
    reversal: 0,             // 0 = negative (C-41), 1 = positive/slide (E-6)
    stackingStrength: 0,     // 0-1 — how strongly upper layers attenuate light for lower ones
    maskDensity: 0.42,       // orange mask strength
    maskHue: 28,             // 0-60 deg — shifts orange mask color
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
- `activeTab` — 'layers' | 'base' | 'develop'
- `selectedLayerIdx` — index of the currently selected layer (synced between spectrum and tabs)
- `currentTemplate` — name of last-selected stock template
- `recipeName` — name of current saved recipe (empty for unsaved)
- `isDirty` — true when recipe modified since last save/load
- `savedRecipes` — persisted to `localStorage` under key `filmlab-custom-recipes`
- `proMode` / `rawMode` / `referenceActive` — UI toggles

### Stock Templates

Six built-in films: Portra 400, Gold 200, Velvia 50, Kodachrome 64, Ilford HP5,
Kodak Tri-X. Defined as `STOCK_TEMPLATES` in `state.js`. Film type is derived from
properties: positive films have `reversal: 1`, B&W films have `dyePurity: 0` on all
layers, negative films have `reversal: 0` with color layers.

### Key Functions in `state.js`

- `complementHue(wl)` — piecewise linear map from sensitizer wavelength to
  complementary dye hue. Uses SPECTRAL_STOPS lookup + 180deg rotation.
- `tonePreset(t)` / `toneFromHD(gamma)` — convert between 0-1 tone slider and
  hdToe/hdGamma/hdShoulder triplet.
- `applyDevelopment(recipe, lab)` — non-destructive: clones recipe, applies
  developer activity, temperature, time, agitation, freshness effects.
- `makeDefaultLayer(index)` — creates a new layer with auto-derived dyeHue.

## Unified Recipe Model

Every film is a recipe. Stock presets are read-only sources — selecting one clones
it into the working recipe, fully editable. There is no stock vs custom mode split.

### 3-Tab Layout

- **Layers tab** — Per-layer slider sections with all chemistry controls:
  Color sensitivity (sensitizerPeak), Sensitivity range (sensitizerBw),
  Color richness (dyePurity), Max density (dmax), Tone, Grain (crystalSize).
  Pro mode adds expandable H&D Curve Parameters (toe, gamma, shoulder).
  Layers can be added (up to 5), removed, and reordered. Selected layer is
  highlighted and synced with spectrum pointer.
- **Base tab** — Global controls (reversal process, stacking, DIR, base tint)
  + orange mask section.
- **Develop tab** — Development environment sliders + generated Lab Notes.

### Persistent Spectrum

The spectrum canvas lives **outside the tab system** (in `#spectrum-bar`), always
visible between the film strip and tab content. It is not rebuilt on tab switch.

**Touch-first design:**
- On **touch devices** (`pointer: coarse`): spectrum is a read-only visualization.
  Tapping a pointer selects that layer (highlights it, syncs `selectedLayerIdx`),
  but no dragging. Drag handles (dmax top, bandwidth edges) are hidden. All editing
  happens via sliders in the Layers tab.
- On **desktop** (`pointer: fine`): full drag interactivity — drag pointers
  horizontally (sensitizerPeak), drag bell tops vertically (dmax), drag bell edges
  (sensitizerBw). Cursor changes on hover.

**Spectrum API** (returned by `buildSpectrum()`):
- `repaint()` — redraw (call after slider changes)
- `setRecipe(recipe)` — update the displayed recipe
- `setActiveLayer(idx)` — highlight a specific layer
- `destroy()` — cleanup

### Film Strip

Persistent horizontal scroll row between image and tab content. Stock template
chips auto-grouped by derived type (B&W if all `dyePurity < 0.01`, reversal if
`global.reversal`, else negative), user-saved films after a separator with delete
affordance, "+ New" chip at the end.

### Topbar

Contains: wordmark, Save button (disabled when no recipe name), Save As button,
Simple/Pro mode toggle.

## Spectrum UI (`src/ui/spectrum.js`)

Canvas layout (top to bottom):
- **Rainbow bar** (24px) — visible spectrum 380-700nm
- **Absorption band** (8px) — combined spectral absorption of all layers
- **Bell curves** (100px) — one per layer with visual encoding:
  - Height = `dmax`
  - Width = `sensitizerBw`
  - Fill opacity = `dyePurity` (dimmed for non-selected layers)
  - Stroke = brighter/thicker for selected layer
  - **H&D mini-curve** inside each bell peak
  - **Grain dots** at base
  - **Overlap zones** highlighted where bells intersect
  - **Stacking dimming** — lower layers progressively dimmed by `stackingStrength`
- **Pointers** (32px) — pin markers at `sensitizerPeak`, colored by `dyeHue`,
  outlined white when selected

Desktop-only interactions (hidden on `pointer: coarse`):
- Drag pointer horizontally -> `sensitizerPeak` (auto-updates `dyeHue`)
- Drag bell top vertically -> `dmax`
- Drag bell edges horizontally -> `sensitizerBw`
- Hover cursor changes to `ns-resize` / `ew-resize` / `grab`

Both touch and desktop:
- Tap/click pointer -> selects that layer (`onLayerSelect` callback)

## Touch-Friendly & Responsive Design

- Mobile-first flexbox column layout with 3-tab bottom bar
- Dark theme with near-black backgrounds (`--bg: #0c0c0c`) for photography focus
- Pointer Events API throughout (works for mouse and touch)
- `matchMedia('(pointer: fine)')` determines input mode at startup
- `touch-action: none` on spectrum canvas
- `@media (pointer: coarse)` enlarges slider thumbs to 24px, film chips to 44px min
- Mobile: tab content at bottom (max-height 42vh, scrollable), tab bar at bottom
- Desktop (768px+): CSS Grid sidebar layout — tabs/spectrum/content/strip on left,
  canvas on right
- Wide (1400px+): wider sidebar (420px)
- Safe area insets for notched devices (`env(safe-area-inset-*)`)
- Film strip with horizontal momentum scroll and scroll-snap
- Selected layer section gets a subtle highlight border

## Design Decisions

- **No filmType enum** — film behavior (negative/positive/B&W) emerges from physical
  properties: `reversal` (global process), `dyePurity` (per-layer coupler presence),
  `maskDensity` (base property). This matches real film chemistry where these are
  independent properties, not a type selector.
- **Auto-derived dyeHue** — `dyeHue = complementHue(sensitizerPeak)`. In real film,
  the dye formed is always the spectral complement of the absorbed wavelength. This
  is auto-updated on peak changes; `dyeHue` is not directly user-editable.
- **3-wavelength spectral model** (625, 540, 450nm) — a deliberate trade-off.
  Full 380-700nm integration would cost ~20x more per pixel for marginal visual
  benefit. The effective useful range for custom layer peaks is ~440-620nm.
- **Universal engine, many presets** — every stock template is just a recipe object
  with different parameter values fed into the same rendering pipeline. There is no
  per-film special-case code.
- **Stacking uses pre-reversal density** — for positive (slide) film, the
  Beer-Lambert stacking attenuation is computed from the raw H&D density before
  the reversal step. This matches physical reality.
- **Touch-first spectrum** — spectrum is read-only visualization on touch devices.
  Bell curve drag handles are precision mouse tools unsuitable for finger input.
  Sliders in the Layers tab are the primary input for touch users.
- **Per-layer grain at density stage** — grain is not a post-process noise overlay.
  Each layer's grain models binomial crystal develop statistics independently,
  applied before dye absorption. This means color film grain has uncorrelated
  patterns per color channel (as in real C-41/E-6), and B&W grain character
  differs naturally from color grain without special-case code.

## Known Limitations / Future Work

- **No undo/redo** — would benefit from a command stack on recipe mutations.
- **No export** — processed image can't be saved yet (add canvas `toBlob()` download).
- **No preset sharing** — recipes are localStorage only; add JSON import/export.
- **Scan exposure hardcoded** — the negative scan factor (`3.0`) could be a user
  parameter for simulating different paper grades / scanner contrast.
- **baseTintR/G/B as 3 sliders** — a single warmth slider or small color picker
  would be more intuitive for this 3-component control.
- **iPhone native port** — Core Image / Metal pipeline, AVFoundation camera integration.

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
