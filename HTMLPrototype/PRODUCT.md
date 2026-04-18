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
    renderer.js             WebGL (GLSL) rendering engine with up to 4 layers on GPU,
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
  renderer.js --- WebGL GPU path: up to 8-pass pipeline
       |            Pass 1: Density shader — per-layer density + grain noise → FBO A
       |            Pass 2: Horizontal Gaussian blur (per-channel = per-layer) FBO A → FBO B
       |            Pass 3: Vertical Gaussian blur FBO B → FBO A
       |            Pass 4: Compositing shader — DIR + dye absorption + mask/tint → screen (or FBO C)
       |            Pass 5-8: Halation (optional, when halation > 0):
       |              5: Threshold bright pixels FBO C → FBO A
       |              6: H-blur bloom FBO A → FBO B (radius 20px)
       |              7: V-blur bloom FBO B → FBO A
       |              8: Blend scene + bloom → screen
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
9. **Negative scan** — exponential paper response with fog floor subtraction:
   the composite shader subtracts the fog-only optical density from the total OD
   before applying `1 - exp(-imageOD * scanExposure)`. The scan exposure (paper grade)
   is user-controllable (range 1.0–6.0, default 3.0). This simulates real film scanners
   that calibrate against the unexposed film strip to set the black level — areas
   with only fog density render as true black, not muddy gray. Raw view shows
   transmittance with orange mask (mask color controlled by `maskHue` 0-60deg).
10. **Per-layer grain** — physics-based crystal emulation applied at the density
   stage (before dye absorption), independently per layer:
   - **Static noise texture**: generated once per image load at image resolution.
     RGBA channels provide 4 independent noise values per pixel (one per layer).
     NEAREST filtering ensures no interpolation between pixels.
   - **Correlated noise** (GRAIN_CHROMA = 0.25): 75% shared luminance base + 25%
     per-layer independent variation. This produces grain that reads as natural
     luminance texture with subtle color fringing — matching how real film grain
     appears under magnification (primarily density variation, not RGB speckle).
   - **Binomial statistics**: amplitude `sigma = sqrt(p*(1-p)/N)` where
     `N = 1/(cs²+0.01)` and `p = density/dmax`. Grain peaks at mid-density and
     vanishes at both unexposed (fog) and fully saturated (dmax) areas.
   - **Silver grain** (`dyePurity < 0.01`): amplitude 1.2× sigma
   - **Dye cloud grain** (`dyePurity >= 0.01`): amplitude 0.7× sigma
   - Grain IS the density variation, not a post-process overlay
11. **Per-layer Gaussian blur (grain + resolving power)** — separable Gaussian
   blur applied to per-layer densities via 2 render passes (H + V). Each layer's
   density is stored in a separate RGBA channel so the blur operates independently
   per layer before dye absorption compositing. Blur radius =
   `maxCrystalSize × GRAIN_PX × grainSoftness` (GRAIN_PX=5, grainSoftness is
   user-controllable 0.5×–3.0×). This simultaneously:
   - Converts per-pixel white noise into organic grain clumps
   - Softens each layer to match film resolving power
   - Couples image sharpness to crystal size: coarse grain = soft image
   - Preserves physical correctness: `blur(composite(A,B)) ≠ composite(blur(A),blur(B))`
   - Minimum blur floor of 0.5px ensures per-pixel noise is always smoothed into
     organic clumps, even at very fine crystal sizes
   - Grain softness decouples spatial softness from amplitude: users can have
     large/visible grain that's either punchy (low softness) or creamy (high softness)
12. **Compositing** — reads blurred per-layer densities, applies DIR inhibition,
   dye absorption (Beer-Lambert), reversal, orange mask, base tint (derived from
   single warmth slider: R=1+w×0.06, G=1.0, B=1-w×0.12)
13. **Halation (optional)** — when `halation > 0`, adds a warm highlight glow:
   threshold-extracts bright pixels (lum > 0.65), blurs with large radius (20px),
   and blends back additively with warm tint (1.0, 0.55, 0.25). Uses 3rd FBO (C)
   for intermediate storage. Portra 400 and Gold 200 have non-zero defaults.
14. **Gamma encode** — `l2s()`: back to sRGB for display

The WebGL pipeline uses 5 shader programs (density, blur, compositing, threshold,
halation blend) with 3 framebuffer objects. Per-layer densities are packed into RGBA
channels (up to 4 layers with per-layer blur via RGBA channel packing). FBO textures
use UNSIGNED_BYTE with density scaled by 1/4.0 to fit 0-4.0 range. CPU fallback
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
- **Dye hue**: authored per layer. Seeded once at layer creation via
  `complementHue()` (red-sensitive layer → cyan dye, green → magenta, blue → yellow)
  and then editable directly via the Dye hue slider in the Layers tab. The engine
  no longer rewrites `dyeHue` when `sensitizerPeak` changes — this matches real
  film stocks where the dye chemistry is chosen for the look (Portra's warm cyan
  ≈ 185°), not derived mathematically from the sensitizer.
- **Bypass / "Untouched"**: a `global.bypass` flag short-circuits the engine to a
  passthrough of the source image. The "Untouched" stock recipe ships with
  `bypass: 1`; touching any slider clears it. There is also a press-and-hold
  gesture on the canvas — hold to peek the original, release to return. This
  mirrors the macOS `FilmGlobalSettings.bypass` flag and the iOS viewer gesture.

### Recipe Object

```js
{
  layers: [
    {
      name: 'cyan',
      sensitizerPeak: 620,   // nm — wavelength of peak sensitivity (380-700)
      sensitizerBw: 80,      // nm — Gaussian bandwidth (FWHM) (30-200)
      dyeHue: 185,           // degrees (0-359) — authored per layer; seeded via complementHue() at creation
      dyePurity: 0.70,       // 0-1 — dye coupler presence (0 = silver/B&W, >0 = color)
      dmax: 2.1,             // max optical density (0.05-3.5)
      hdToe: 0.22,           // H&D shadow compression zone width (0-0.5)
      hdGamma: 0.68,         // H&D slope / contrast (0.3-3.0)
      hdShoulder: 0.18,      // H&D highlight rolloff zone width (0-0.5)
      fog: 0.04,             // base + fog (Dmin) — minimum unexposed density (0-0.3)
      crystalSize: 0.35,     // grain crystal size (0.0-0.5), derives ~ISO
    },
    // ... up to 4 layers (enforced by `MAX_LAYERS` in renderer.js)
  ],
  global: {
    bypass: 0,               // 0 = run pipeline, 1 = passthrough source image (Untouched / peek)
    reversal: 0,             // 0 = negative (C-41), 1 = positive/slide (E-6)
    stackingStrength: 0,     // 0-1 — how strongly upper layers attenuate light for lower ones
    maskDensity: 0.42,       // orange mask strength
    maskHue: 28,             // 0-60 deg — shifts orange mask color
    dirInhibition: 0.35,     // DIR coupler strength
    baseTintWarmth: 0.5,     // -1 (cool/blue) to +1 (warm/amber), derives RGB tint
    scanExposure: 3.0,       // scanning contrast / paper grade (1.0-6.0)
    grainSoftness: 1.50,     // blur radius multiplier (0.0-2.0×) — spatial softness of grain
    halation: 0.25,          // highlight glow strength (0-1)
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

Seven built-in entries: **Untouched** (the bypass starter — see Bypass /
"Untouched" above), Portra 400, Gold 200, Velvia 50, Kodachrome 64, Ilford HP5,
Kodak Tri-X. Defined as `STOCK_TEMPLATES` in `state.js`. Film type is derived from
properties: positive films have `reversal: 1`, B&W films have `dyePurity: 0` on all
layers, negative films have `reversal: 0` with color layers, and Untouched has
`bypass: 1`.

### Key Functions in `state.js`

- `complementHue(wl)` — piecewise linear map from sensitizer wavelength to
  complementary dye hue. Uses SPECTRAL_STOPS lookup + 180deg rotation. Called
  once at layer creation to seed `dyeHue`; not re-invoked on subsequent
  `sensitizerPeak` changes.
- `applyDevelopment(recipe, lab)` — non-destructive: clones recipe, applies
  developer activity, temperature, time, agitation, freshness effects.
- `makeDefaultLayer(index)` — creates a new layer; seeds `dyeHue` from
  `complementHue(peak)` once. The result is then hand-editable.
- `clearBypassOnFirstEdit()` — flips `global.bypass` off on the first
  user-driven slider/spectrum edit, so changes to an Untouched recipe become
  visible immediately.

## Parameter Reference

### Per-Layer Parameters

Each layer models one emulsion coating on the film strip. Up to 4 layers stacked
(one per RGBA channel in the density FBO).

| Parameter | UI Label | Range | What It Does |
|-----------|----------|-------|-------------|
| `sensitizerPeak` | Sensitizer peak | 380-700 nm | Wavelength this layer is most sensitive to. Moving the peak shifts which colors the layer captures. Does NOT auto-update `dyeHue` — that's an authored value. |
| `sensitizerBw` | Sensitizer bandwidth | 30-200 nm | FWHM of the Gaussian sensitivity curve. Narrow = selective (saturated color), wide = broad response (desaturated/pastel). |
| `dyeHue` | Dye hue | 0-359° | Hue of the dye formed in this layer. Seeded once from `complementHue(sensitizerPeak)` at creation, then hand-editable. Hidden for silver layers. |
| `dyePurity` | Dye purity | 0-1 | Dye coupler concentration. 0 = pure silver halide (B&W grain), >0 = color dye cloud. Controls how strongly the layer forms colored dye vs monochrome silver. Hidden when emulsion type is "Silver". |
| `dmax` | Dmax | 0.05-3.5 | Maximum optical density the layer can reach. Higher = deeper blacks / more saturated color. Clamps the H&D curve ceiling. |
| `hdToe` | Toe | 0-0.5 | Width of the shadow compression zone on the H&D curve. Larger toe = softer shadow rolloff, more shadow detail retention. |
| `hdGamma` | Gamma | 0.3-3.0 | Slope of the H&D curve's linear region. Higher gamma = more contrast. This is the primary contrast control. |
| `hdShoulder` | Shoulder | 0-0.5 | Width of the highlight compression zone. Larger shoulder = softer highlight rolloff, more highlight headroom before clipping. |
| `fog` | Base + fog (Dmin) | 0-0.3 | Minimum density of unexposed emulsion. Shifts the entire H&D curve upward. Represents chemical fog and base density. Higher fog = reduced dynamic range, lifted shadows. |
| `crystalSize` | Crystal size | 0.0-0.5 | Size of silver halide crystals. Larger crystals = more grain but more light-gathering (faster film). Derives approximate ISO: `ISO ≈ 25 × (cs/0.05)^1.8` (calibrated 0.05→25, 0.30→400, 0.50→1600). |

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
| `bypass` | (Untouched / press-and-hold) | 0 or 1 | When 1, the renderer short-circuits to a passthrough of the source image. Set on the Untouched starter; cleared automatically by `clearBypassOnFirstEdit()` on the first slider/spectrum change. Also driven momentarily by the press-and-hold-image gesture. |
| `reversal` | Process | 0 or 1 | 0 = C-41 negative, 1 = E-6 reversal (slide). Reversal inverts density: `dmax - density`. Changes the entire look from negative to positive. |
| `stackingStrength` | Layer stacking | 0-1 | How much upper layers attenuate light reaching lower layers (Beer-Lambert). 0 = independent layers, 1 = full physical stacking. Affects color cross-talk between layers. |
| `maskDensity` | Mask density | 0-1 | Orange mask strength (for negative film). Physically compensates for unwanted dye absorptions. Higher = more orange base. |
| `maskHue` | Mask hue | 0-60° | Shifts the orange mask color from yellow (0) through orange to red-orange (60). |
| `dirInhibition` | DIR couplers | 0-1 | Developer Inhibitor Releasing coupler strength. Creates inter-layer density suppression at edges, increasing apparent sharpness and reducing color fringing. |
| `baseTintWarmth` | Base tint warmth | -1 to 1 | Film base warmth. -1 = cool/blue, 0 = neutral, +1 = warm/amber. Derives RGB: R=1+w×0.06, G=1.0, B=1-w×0.12. |
| `scanExposure` | Scan exposure | 1.0-6.0 | Scanning contrast / paper grade. Controls the exponential response in negative scanning. Low = flat, high = punchy. |
| `grainSoftness` | Grain softness | 0.0×-2.0× | Multiplier on blur radius. Controls spatial softness of grain independently from crystal size (amplitude). Low = punchy/sharp, high = creamy/soft. |
| `halation` | Halation strength | 0-1 | Warm highlight glow from light scattering through film base. Adds large-radius blurred bright pixels with warm tint. |

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
`dyeHue` starts as the complement — a red-sensitive (620nm) layer seeds cyan dye,
green-sensitive (540nm) seeds magenta, blue-sensitive (450nm) seeds yellow — but
the seed only runs once at layer creation. Real stocks tune the dye chemistry
away from the strict mathematical complement (Portra's cyan ≈ 185°, not 195°),
so the user is free to drag hue independently from peak.

**H&D curve shape = toe + gamma + shoulder + fog + dmax:** These five parameters fully
define the density response curve. Fog lifts the floor (Dmin). Toe and shoulder define
the curved transition zones. Gamma sets the slope between them. Dmax clamps the ceiling.
The curve maps log-exposure to density.

**Crystal size → grain + ISO + resolving power:** Larger crystals gather more light
(higher ISO / faster film) but produce coarser grain AND softer images. The grain noise
amplitude uses binomial statistics: `N = 1/(cs² + 0.01)`. The Gaussian blur radius =
`maxCS × GRAIN_PX × grainSoftness` (GRAIN_PX=5), with a minimum floor of 0.5px. This
simultaneously creates grain clumps and limits resolving power. Examples at softness=1.0:
Velvia 50 (cs=0.15) gets 0.75px blur (fine grain), Portra 400 (cs=0.35) gets 1.75px
(moderate softening), Tri-X (cs=0.90) gets 4.5px (strong softening). But Portra's
default softness=1.50 gives 2.6px (creamy), while Tri-X's softness=0.70 gives 3.15px
(punchy despite large crystals). This decouples grain amplitude from spatial character.

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
  Dye hue + Dye purity (color only), Dmax, collapsible H&D Curve (interactive
  canvas with toe/gamma/shoulder drag handles + fog slider), Crystal size with
  derived ISO readout. Layers can be added (up to 4), removed, and reordered.
  Selected layer is highlighted and synced with spectrum pointer.
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
chips auto-grouped by derived type — Untouched (the bypass starter, first), then
B&W if all `dyePurity < 0.01`, reversal if `global.reversal`, else negative —
followed by user-saved films after a separator with delete affordance, and a
"+ New" chip at the end. "+ New" loads the Untouched recipe.

### Topbar

Contains: wordmark, Export button (downloads rendered image as PNG), Save button
(disabled when no recipe name), Save As button.

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
- Drag pointer horizontally -> `sensitizerPeak` (does NOT touch `dyeHue` — that
  stays whatever the user last set in the layer editor)
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
- **Authored dyeHue** — `dyeHue` is seeded once via `complementHue(sensitizerPeak)`
  at layer creation, but is then a hand-editable parameter. Earlier versions
  re-derived it on every peak change; that was reverted because real stocks
  intentionally drift the dye hue away from the strict mathematical complement
  (Portra's warm cyan ≈ 185°, Velvia's slight push to ≈ 195°). The seed gives a
  sensible starting point; the slider gives the final say.
- **Bypass / "Untouched" starter** — every new recipe starts from an identity
  preset with `global.bypass = 1`, which short-circuits the engine to a
  passthrough of the source. This makes "load image, see image" the default.
  The first user-driven slider/spectrum edit clears bypass automatically
  (`clearBypassOnFirstEdit()`), and a press-and-hold-image gesture provides
  an instant before/after at any time.
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
- **Correlated noise texture** — grain noise is 75% shared luminance (same base
  random value across RGBA channels) + 25% per-layer independent variation
  (GRAIN_CHROMA=0.25). This matches real film grain appearance: primarily luminance
  texture with subtle color fringing, not the digital-looking RGB speckle that
  fully independent per-layer noise would produce.
- **Fog floor subtraction in scanning** — the negative scan path subtracts the
  fog-only optical density from the total OD, matching how real film scanners
  calibrate against the unexposed film strip. Without this, fog would raise the
  black point everywhere, making letterbox bars and deep shadows appear as muddy
  gray instead of true black.
- **Silver vs dye cloud via amplitude** — differentiation is purely via noise
  amplitude (1.2× silver, 0.7× dye cloud). After blur, silver grain produces
  high-contrast monochrome clumps; color grain produces luminance variation with
  subtle color fringing at clump boundaries from the per-layer noise variation.

## Known Limitations / Future Work

- **No undo/redo** — would benefit from a command stack on recipe mutations.
- **No preset sharing** — recipes are localStorage only; add JSON import/export.
- **Per-layer blur radii** — currently all layers share the max crystal size for blur
  radius. Separate blur per layer would be more physically accurate but requires N
  blur passes instead of 1.
- **Reciprocity failure** — per-layer exposure correction for long/short durations.
  Would need an exposure time input and per-layer correction curves.
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
