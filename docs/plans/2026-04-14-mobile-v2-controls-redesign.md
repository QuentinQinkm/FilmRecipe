# Mobile UI v2 Controls Redesign

## Problem

The current mockup uses identical horizontal sliders for nearly every parameter.
The Base screen alone has 9 stacked bars of the same shape and weight. This reads
as a settings panel, not the acid-retro-future lab instrument aesthetic we want.

## Design Direction

Two distinct analog aesthetics, mapped to what each section represents in real
film photography:

| Section | Aesthetic | Rationale |
|---------|-----------|-----------|
| Layer + Base | **Chemical lab / scientific instrument** | These sections define emulsion chemistry — precision readouts, segmented displays, arc gauges |
| Develop | **Darkroom enlarger / mixing console** | Physical process — rotary knobs with detent marks, like enlarger dials |

Hybrid information density: hero parameters get prominent treatment, secondary
ones cluster into compact instrument panels, niche params are tucked away.

## Widget Vocabulary

Five control types replace the single generic slider:

| Widget | Visual | Interaction | Used for |
|--------|--------|-------------|----------|
| **Arc gauge** | Quarter-circle sweep, value centered, label below. ~80x80px | Tap to fine-adjust via inline +/- counter | Low-precision 0-1 ranges (DIR, halation, grain softness, dye purity, dmax) |
| **Segmented selector** | Row of square cells with stop labels | Tap to select | Discrete stops (scan exposure, crystal size) |
| **Gradient strip** | Wide color gradient bar with square thumb | Drag thumb | Color/temperature values (base tint, spectrum bar, mask hue) |
| **Compact +/- counter** | Numeric readout with minus/plus tap targets | Tap +/- buttons | Tiny-range precision (fog 0-0.3, mask density) |
| **Rotary knob** | Circular dial with tick marks at key values | Circular drag or tap detents | Develop process params (push/pull, dev time, agitation) |

## Base Screen

Three visual zones replace the 9-slider stack:

### Zone 1 — Process & Primary (top)

- **E-6 Reversal**: Square toggle (existing) + process badge showing `NEG`/`POS`
  in accent text. Reads as an instrument status indicator.
- **Scan Exposure**: Segmented selector with film-stop marks
  (`1.0 | 1.5 | 2.0 | 3.0 | 4.0 | 6.0`). Tap to pick, accent border on active
  cell. These are discrete EV stops — dragging a continuous slider is wrong for
  this data.
- **Base Tint Warmth**: Full-width gradient strip (cool blue -> gray -> warm
  amber). Square draggable thumb. `COOL` / `WARM` labels at edges. Numeric
  readout centered. This is the hero creative control of the Base section.

### Zone 2 — Instrument Cluster (middle)

Section label: `FILM CHEMISTRY` (all-caps, `$text-3`).

2x2 grid of arc gauges:

| Top-left | Top-right |
|----------|-----------|
| DIR Inhibition (0-1) | Grain Softness (0.5-3.0x) |

| Bottom-left | Bottom-right |
|-------------|--------------|
| Halation Strength (0-1) | Stacking Strength (0-1) |

Each gauge: quarter-circle sweep from ~210deg to ~330deg, filled in accent color
proportional to value. Value readout centered. Label in small caps below.

The full cluster fits in ~180px vertical — same as 2 old sliders, shows 4 params.

### Zone 3 — Orange Mask (collapsed)

Collapsed by default with chevron. When expanded:
- Warm-tinted panel background (`#1A1208`)
- Mask Density: compact +/- counter
- Mask Hue: narrow orange gradient strip

## Develop Screen

Five parameters total (`STEP_TWO_CONTROLS` in state.js). The hero knob gets
the primary creative control; paired knobs handle the two most-used secondary
controls; a compact instrument row handles the remaining two.

### Developer Activity — Hero Knob

Maps to `developerActivity` (-0.5 to +0.7). This is the push/pull control.

- Large rotary knob (~140x140px), centered on screen
- Outer ring with detent tick marks at -0.5, -0.25, 0, +0.25, +0.5, +0.7
- Supports continuous values between stops (step 0.01)
- `PULL` label left, `PUSH` label right
- Numeric readout centered in knob
- Circular drag gesture + tap-to-snap on tick marks

### Bath Temp + Agitation — Paired Knobs

- Two smaller rotary knobs (~90x90px) side by side below the hero
- Bath Temperature: `bathTemperatureC`, range 30–42°C, standard at 38°C.
  Tick marks at 30, 34, 38, 42. Shows `°C` unit suffix.
- Agitation: `agitationLevel`, range 0–1.0, step 0.01.
  Labels and range hints below each in small caps.

### Dev Time + Freshness — Compact Instrument Row

Two secondary parameters displayed as compact +/- counters (same widget as
fog and mask density), side by side in a single row:

- Development Time: `developmentTimeMin`, range 2–8 min, step 0.1.
  Shows value with `min` suffix (e.g. "3.5 min").
- Chemistry Freshness: `chemistryFreshness`, range 0.3–1.0, step 0.01.
  Shows as percentage or decimal (e.g. "1.00" = fresh, "0.30" = exhausted).

These are lower-frequency adjustments — users set them once per develop session.
The compact counter treatment keeps them accessible without competing with the
knobs for visual attention.

### Lab Notes

Unchanged. Accent top-line card with multiline text input.

## Layer Expanded Controls

Mostly unchanged — the spectrum bar, bandwidth handles, and H&D curve are already
the strongest parts of the design. Refinements:

- **dyePurity + dmax**: Two sliders become a **paired arc gauge** (1x2 layout).
  Purity arc fill: gray-to-vivid gradient. Dmax arc fill: light-to-black
  gradient. Same visual language as Base instrument cluster.
- **fog**: Slider becomes **compact +/- counter**. Range 0-0.3 with small
  increments. No bar needed.
- **crystalSize**: Slider becomes **segmented selector** (6 stops, FINE to
  COARSE) + 48px grain texture preview + ISO badge in accent. Matches scan
  exposure treatment on Base.
- **sensitizerPeak, sensitizerBw, H&D curve**: No changes.

## Design Consistency

The shared widget vocabulary creates visual coherence across sections while each
section maintains its own character:

- Arc gauges appear in Base (2x2) and Layer (1x2)
- Segmented selectors appear in Base (exposure) and Layer (grain)
- Gradient strips appear in Base (tint) and Layer (spectrum)
- Compact counters appear in Base (mask density) and Layer (fog)
- Rotary knobs are exclusive to Develop — reinforcing its distinct physical feel

## Unchanged Elements

- Top bar (wordmark, preset dropdown, export button)
- Image area with floating section pills
- Section picker overlay
- Preset dropdown panel
- Fullscreen photo viewer
- Layer compact table (screen 1)
- Spectrogram (read-only)
- All navigation and state management
