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
                            control definitions, complementHue(),
                            applyDevelopment(), app state, localStorage persistence
  engine/
    renderer.js             WebGL (GLSL) rendering engine with up to 5 layers on GPU,
                            Canvas2D CPU fallback only when WebGL unavailable
  ui/
    tabs.js                 3-tab content builder (Layers/Base/Develop)
    topbar.js               Save/Save As buttons, film strip builder
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
  renderer.js --- WebGL GPU path: 4-pass pipeline
       |            Pass 1: Density shader — per-layer density + grain noise → FBO (RGBA channels)
       |            Pass 2: Horizontal Gaussian blur (per-channel = per-layer independent blur)
       |            Pass 3: Vertical Gaussian blur
       |            Pass 4: Compositing shader — DIR + dye absorption + mask/tint → screen
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
4. **Base + fog (Dmin)** — minimum density of unexposed emulsion added to all
   density values: `density = fog + hdCurve(exposure)`
5. **H&D curve** — toe/gamma/shoulder density response per layer, clamped at dmax
6. **Positive reversal** — for slide film: `dmax - density` (applied after stacking)
7. **DIR inhibition** — inter-layer density suppression (edge sharpness)
8. **Dye absorption** — Beer-Lambert: complementary hue absorption vectors
9. **Negative scan** — exponential paper response `1 - exp(-OD * 3.0)`, or raw
   view with orange mask (mask color controlled by `maskHue` 0-60deg)
10. **Per-layer grain** — physics-based crystal emulation applied at the density
   stage (before dye absorption), independently per layer:
   - **White noise injection**: cheap per-pixel sin-hash noise at density stage.
     No grid or cell structure — no moiré artifacts possible.
   - **Binomial statistics**: amplitude `sigma = sqrt(p*(1-p)/N)` where
     `N = 1/(cs²+0.01)` and `p = density/dmax`
   - **Silver grain** (`dyePurity < 0.01`): amplitude 1.2× sigma
   - **Dye cloud grain** (`dyePurity >= 0.01`): amplitude 0.7× sigma
   - **Per-layer seeds**: independent noise per layer
   - Grain IS the density variation, not a post-process overlay
11. **Per-layer Gaussian blur (grain + resolving power)** — separable Gaussian
   blur applied to per-layer densities via 2 render passes (H + V). Each layer's
   density is stored in a separate RGBA channel so the blur operates independently
   per layer before dye absorption compositing. Blur radius = `maxCrystalSize × GRAIN_PX`.
   This simultaneously:
   - Converts per-pixel white noise into organic grain clumps
   - Softens each layer to match film resolving power
   - Couples image sharpness to crystal size: coarse grain = soft image
   - Preserves physical correctness: `blur(composite(A,B)) ≠ composite(blur(A),blur(B))`
   - When blur radius < 0.5px, blur passes are skipped entirely
12. **Compositing** — reads blurred per-layer densities, applies DIR inhibition,
   dye absorption (Beer-Lambert), reversal, orange mask, base tint
13. **Gamma encode** — `l2s()`: back to sRGB for display

The WebGL pipeline uses 3 shader programs (density, blur, compositing) with 2
framebuffer objects. Per-layer densities are packed into RGBA channels (up to 4
layers with per-layer blur; 5th layer supported without blur). FBO textures use
UNSIGNED_BYTE with density scaled by 1/4.0 to fit 0-4.0 range. CPU fallback
(`_renderCPU`) uses matching per-layer Float32Array blur and only activates when
WebGL is completely unavailable.

## Data Model

### Physics-Based Film Chemistry

There is **no `filmType` enum**. Film behavior emerges from physical properties:

- **Negative vs Positive (slide)**: controlled by `reversal` in `global` (0 = C-41
  negative process, 1 = E-6 reversal process). This is a bath process, not a
  per-layer property.
- **Color vs B&W**: controlled by an emulsion type toggle (Silver / Color dye) per
  layer. Silver sets `dyePurity = 0` (silver halide only, no dye coupler). A film with
  all silver layers renders as B&W. Users can mix color and silver layers freely.
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
      hdToe: 0.22,           // H&D shadow compression zone width (0-0.5)
      hdGamma: 0.68,         // H&D slope / contrast (0.3-3.0)
      hdShoulder: 0.18,      // H&D highlight rolloff zone width (0-0.5)
      fog: 0.04,             // base + fog (Dmin) — minimum unexposed density (0-0.3)
      crystalSize: 0.35,     // grain crystal size (0.05-2.0), derives ~ISO
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
- `rawMode` / `referenceActive` — UI toggles

### Stock Templates

Six built-in films: Portra 400, Gold 200, Velvia 50, Kodachrome 64, Ilford HP5,
Kodak Tri-X. Defined as `STOCK_TEMPLATES` in `state.js`. Film type is derived from
properties: positive films have `reversal: 1`, B&W films have `dyePurity: 0` on all
layers, negative films have `reversal: 0` with color layers.

### Key Functions in `state.js`

- `complementHue(wl)` — piecewise linear map from sensitizer wavelength to
  complementary dye hue. Uses SPECTRAL_STOPS lookup + 180deg rotation.
- `applyDevelopment(recipe, lab)` — non-destructive: clones recipe, applies
  developer activity, temperature, time, agitation, freshness effects.
- `makeDefaultLayer(index)` — creates a new layer with auto-derived dyeHue.

## Parameter Reference

### Per-Layer Parameters

Each layer models one emulsion coating on the film strip. Up to 5 layers stacked.

| Parameter | UI Label | Range | What It Does |
|-----------|----------|-------|-------------|
| `sensitizerPeak` | Sensitizer peak | 420-660 nm | Wavelength this layer is most sensitive to. Auto-derives `dyeHue` (complement). Moving peak shifts which colors the layer captures. |
| `sensitizerBw` | Sensitizer bandwidth | 20-180 nm | FWHM of the Gaussian sensitivity curve. Narrow = selective (saturated color), wide = broad response (desaturated/pastel). |
| `dyePurity` | Dye purity | 0-1 | Dye coupler concentration. 0 = pure silver halide (B&W grain), >0 = color dye cloud. Controls how strongly the layer forms colored dye vs monochrome silver. Hidden when emulsion type is "Silver". |
| `dmax` | Dmax | 0.5-4.0 | Maximum optical density the layer can reach. Higher = deeper blacks / more saturated color. Clamps the H&D curve ceiling. |
| `hdToe` | Toe | 0-0.5 | Width of the shadow compression zone on the H&D curve. Larger toe = softer shadow rolloff, more shadow detail retention. |
| `hdGamma` | Gamma | 0.3-3.0 | Slope of the H&D curve's linear region. Higher gamma = more contrast. This is the primary contrast control. |
| `hdShoulder` | Shoulder | 0-0.5 | Width of the highlight compression zone. Larger shoulder = softer highlight rolloff, more highlight headroom before clipping. |
| `fog` | Base + fog (Dmin) | 0-0.3 | Minimum density of unexposed emulsion. Shifts the entire H&D curve upward. Represents chemical fog and base density. Higher fog = reduced dynamic range, lifted shadows. |
| `crystalSize` | Crystal size | 0.05-2.0 | Size of silver halide crystals. Larger crystals = more grain but more light-gathering (faster film). Derives approximate ISO: `ISO ≈ 25 × (cs/0.05)^1.1`. |
| `dyeHue` | (auto) | 0-360° | Complementary hue of the dye formed. Auto-derived from `sensitizerPeak` via `complementHue()`. Not directly editable. |

**Emulsion type toggle:** Silver vs Color dye. Silver sets `dyePurity = 0` and hides
the dye purity slider. Color dye restores the previous dyePurity value. Silver layers
produce higher-amplitude grain (1.2×); color layers produce lower-amplitude dye cloud
grain (0.7×). Both are blurred by the Gaussian blur passes. A film with all silver
layers renders as B&W.

**ISO readout:** Displayed next to crystal size value (e.g. `0.30 (~ISO 179)`). This is
a derived display, not a separate parameter. Bigger crystals = faster film = higher ISO.

### Global Parameters

| Parameter | UI Label | Range | What It Does |
|-----------|----------|-------|-------------|
| `reversal` | Process | 0 or 1 | 0 = C-41 negative, 1 = E-6 reversal (slide). Reversal inverts density: `dmax - density`. Changes the entire look from negative to positive. |
| `stackingStrength` | Layer stacking | 0-1 | How much upper layers attenuate light reaching lower layers (Beer-Lambert). 0 = independent layers, 1 = full physical stacking. Affects color cross-talk between layers. |
| `maskDensity` | Mask density | 0-1 | Orange mask strength (for negative film). Physically compensates for unwanted dye absorptions. Higher = more orange base. |
| `maskHue` | Mask hue | 0-60° | Shifts the orange mask color from yellow (0) through orange to red-orange (60). |
| `dirInhibition` | DIR couplers | 0-1 | Developer Inhibitor Releasing coupler strength. Creates inter-layer density suppression at edges, increasing apparent sharpness and reducing color fringing. |
| `baseTintR/G/B` | Base tint | 0-1 each | RGB tint of the film base itself. Slight warmth (R>G>B) simulates real film base color. |

### Development Parameters (Lab State)

Applied non-destructively via `applyDevelopment()`. These modify the working recipe
without changing the stored recipe.

| Parameter | UI Label | Effect |
|-----------|----------|--------|
| `developerActivity` | Developer activity | Pushes/pulls density and color separation. Positive = push (more contrast), negative = pull (softer). |
| `bathTemperatureC` | Bath temperature | Higher temp accelerates development (more grain, more contrast). Standard C-41 is 38°C. |
| `chemistryFreshness` | Chemistry freshness | Exhausted chemistry (lower values) produces more grain and less consistent results. |

### How Parameters Interact

**Sensitivity → Dye color:** `sensitizerPeak` determines what light the layer absorbs.
`dyeHue` is auto-derived as the complement — a red-sensitive (620nm) layer forms cyan
dye, green-sensitive (540nm) forms magenta, blue-sensitive (450nm) forms yellow.

**H&D curve shape = toe + gamma + shoulder + fog + dmax:** These five parameters fully
define the density response curve. Fog lifts the floor (Dmin). Toe and shoulder define
the curved transition zones. Gamma sets the slope between them. Dmax clamps the ceiling.
The curve maps log-exposure to density.

**Crystal size → grain + ISO + resolving power:** Larger crystals gather more light
(higher ISO / faster film) but produce coarser grain AND softer images. The grain noise
amplitude uses binomial statistics: `N = 1/(cs² + 0.01)`. The Gaussian blur radius
scales with crystal size (`maxCS × GRAIN_PX`), simultaneously creating grain clumps and
limiting resolving power. This couples all three: coarse grain = high ISO = soft image.

**dyePurity → grain amplitude:** `dyePurity < 0.01` triggers silver grain (1.2× amplitude).
Higher purity triggers dye cloud grain (0.7× amplitude). After blur, both form organic
clumps — silver produces high-contrast monochrome clumps; color produces luminance
variation with subtle color fringing from uncorrelated per-layer noise patterns.

**Stacking × layer order:** With `stackingStrength > 0`, upper layers (lower array index)
absorb light via Beer-Lambert before it reaches lower layers. This means layer order
matters — a dense upper layer dims everything below it, just like physical emulsion
coatings on a real film strip.

**Reversal flips the density:** In slide film (`reversal = 1`), density is inverted
(`dmax - density`). This means fog reduces highlight brightness instead of lifting
shadows. High gamma produces saturated, punchy slides. The same H&D parameters produce
very different visual results in negative vs reversal mode.

**DIR × multi-layer:** DIR couplers create edge enhancement by suppressing development
in adjacent layers where density is high. Stronger DIR = sharper apparent edges and
reduced color cross-contamination between layers.

**Development modifies H&D:** Push processing (high `developerActivity`) increases
effective gamma and grain. Pull processing decreases contrast. Temperature affects
development rate. These stack with the recipe's inherent H&D parameters.

## Unified Recipe Model

Every film is a recipe. Stock presets are read-only sources — selecting one clones
it into the working recipe, fully editable. There is no stock vs custom mode split.

### 3-Tab Layout

- **Layers tab** — Per-layer slider sections with chemistry controls:
  Sensitizer peak, Sensitizer bandwidth, Emulsion type toggle (Silver / Color dye),
  Dye purity (color only), Dmax, collapsible H&D Curve (interactive canvas with
  toe/gamma/shoulder drag handles + fog slider), Crystal size with derived ISO readout.
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

Contains: wordmark, Save button (disabled when no recipe name), Save As button.

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

## Interactive H&D Curve Widget (`src/ui/tabs.js`)

Each layer has a collapsible "H&D Curve" section containing an interactive canvas:

- **Canvas drawing** — plots the full H&D characteristic curve with fixed density
  scale (1/3.5), showing toe region (blue shading), shoulder region (orange shading),
  fog level (yellow dashed line), and dmax ceiling (red dashed line).
- **Three drag handles:**
  - **Toe** (blue, left) — drag horizontally to widen/narrow shadow compression
  - **Gamma** (white, center) — drag vertically to change contrast slope
  - **Shoulder** (orange, right) — drag horizontally to widen/narrow highlight rolloff
- **Dmax clamping** — the curve is visually clamped at the dmax ceiling line. Density
  values above dmax are flattened, showing the actual effective response.
- **Fog slider** — inside the H&D details section, updates the fog line on the canvas
  in real-time.
- **Fixed scale** — density axis uses `scale = 1/3.5` (not auto-normalized), so
  changing gamma visibly alters the curve height rather than auto-scaling.

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
- **Multi-pass grain (white noise + per-layer blur)** — v1 used per-pixel sin-hash
  (salt-and-pepper), v2 used value noise on a grid (moiré artifacts, no image
  coupling). v3 injects cheap per-pixel white noise per layer, then applies a
  separable Gaussian blur to each layer's density independently before dye
  absorption compositing. The blur creates organic grain clumps (no grid = no moiré)
  and softens the image to the film's resolving power. Per-layer blur before
  compositing preserves physical correctness: dye absorption is nonlinear, so
  `blur(composite(A,B)) ≠ composite(blur(A), blur(B))`. The channel-parallel
  trick (RGB channels = per-layer densities) achieves this with only 2 blur passes.
- **Silver vs dye cloud via amplitude** — differentiation is purely via noise
  amplitude (1.2× silver, 0.7× dye cloud). After blur, silver grain produces
  high-contrast monochrome clumps; color grain produces luminance variation with
  subtle color fringing at clump boundaries from uncorrelated per-layer noise.

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
