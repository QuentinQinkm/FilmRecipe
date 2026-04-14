# Grain Engine v3 Architecture

**Status:** Implemented on `feature/grain-engine-v3` branch.

**Goal:** Bottom-up film grain simulation where grain emerges from physical crystal properties, with proper per-layer blur, fog handling, and halation.

---

## Pipeline Overview

The v3 engine uses an 8-pass WebGL pipeline (4 core + 4 optional halation):

```
Pass 1: Density shader    (source image + noise texture) → FBO A
Pass 2: Horizontal blur   FBO A → FBO B
Pass 3: Vertical blur     FBO B → FBO A
Pass 4: Composite shader  FBO A → screen (or FBO C if halation)
Pass 5: Threshold          FBO C → FBO A  (halation only)
Pass 6: H-blur bloom      FBO A → FBO B  (halation only)
Pass 7: V-blur bloom      FBO B → FBO A  (halation only)
Pass 8: Blend              FBO C + FBO A → screen (halation only)
```

Three FBOs (A, B, C) with RGBA UNSIGNED_BYTE format. Densities are scaled by /4.0 to fit [0, 4.0] into [0, 1.0] byte range.

---

## Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_LAYERS` | 4 | Matches RGBA channel count |
| `GRAIN_PX` | 3 | `crystalSize * 3 = blur radius (px)` |
| `GRAIN_CHROMA` | 0.25 | 75% shared luminance + 25% per-layer chroma noise |
| Min blur floor | 0.5px | Ensures noise is always smoothed into organic clumps |

---

## Pass 1: Density Shader

Computes per-layer density with grain noise. Each layer's density is written to one RGBA channel:
- R = layer 0, G = layer 1, B = layer 2, A = layer 3

**Per-layer processing:**
1. Convert input RGB to per-layer exposure via Gaussian spectral sensitivity: `exp(-0.5 * ((channel - peak) / sigma)^2)`
2. Apply H&D curve: toe (quadratic ramp) + linear (gamma slope) + shoulder (soft clip), clamped at Dmax
3. Add fog floor (base + fog density)
4. Apply grain noise from noise texture (correlated: 75% shared luminance)

**Grain model (binomial):**
- `N = 1 / (cs^2 + 0.01)` — crystal count per sampling area
- `p = density / dmax` — develop probability
- `sigma = sqrt(p * (1-p) / N)` — binomial standard deviation
- Grain amplitude = `noise * sigma * dmax * amplitude`
- B&W amplitude = 1.2, color amplitude = 0.7

**Noise texture:** Pre-generated RGBA texture with correlated channels:
```
channel[c] = (1 - GRAIN_CHROMA) * base + GRAIN_CHROMA * random
```
Where `base` is shared across all channels. This gives luminance-dominated grain with subtle color shifts, matching real film behavior.

---

## Pass 2-3: Gaussian Blur

Separable Gaussian blur using the existing blur shader. Kernel radius = `max(min(maxCS * GRAIN_PX, 15), 0.5)` where `maxCS` is the largest crystal size across all layers.

The minimum 0.5px floor ensures that even at `crystalSize = 0.05` (where `0.05 * 3 = 0.15px`), the noise is always smoothed into organic clumps rather than remaining as raw per-pixel speckle.

**Why per-layer blur matters:** Beer-Lambert dye absorption is nonlinear (`exp(-OD)`). Blurring individual layer densities BEFORE compositing produces physically correct results. Blurring the final composited image would be a linear approximation that loses inter-layer interaction.

---

## Pass 4: Composite Shader

Combines blurred per-layer densities into a final color image. Handles four modes:

### B&W (all layers `dyePurity < 0.01`)
- **Raw mode:** `lum = 1 - density / dmax` (transmittance view)
- **Scan mode:** `lum = max(density - fog, 0) / max(dmax - fog, 0.01)` (fog floor subtracted)

### Color Negative (`reversal = 0`)
- DIR inter-image effect: `d[i] = max(0, dn[i] - dir * (totalDen - dn[i]) * 0.15)`
- Compute total OD per RGB channel: `totalOD += dyeAbs(hue, purity) * d[i]`
- **Raw mode:** Beer-Lambert with orange mask: `exp(-(totalOD + maskOD) * LN10)`
- **Scan mode:** Subtract fog OD, apply scan exposure: `1 - exp(-imageOD * scanExp)`

### Color Positive / Reversal (`reversal = 1`)
- Invert densities: `dn[i] = dmax[i] - dn[i]`
- Then Beer-Lambert: `exp(-totalOD * LN10)`

### Post-processing
- Apply base tint (derived from `baseTintWarmth`): `out *= baseTint`
- sRGB gamma encoding

---

## Pass 5-8: Halation (Optional)

Active when `halation > 0.001`. Simulates light scattering through the film base that creates a warm glow around bright highlights.

1. **Threshold** (Pass 5): Extract pixels with `lum > 0.65` using `smoothstep`
2. **H-blur** (Pass 6): Gaussian blur with large radius (20px)
3. **V-blur** (Pass 7): Complete the separable blur
4. **Blend** (Pass 8): Additive blend with warm tint `(1.0, 0.55, 0.25)`, scaled by `halation` strength

---

## Fog Floor Subtraction

Real film scanners calibrate against unexposed film strip, making fog-only areas render as true black rather than a gray offset.

**Color negative:** Compute fog-only OD from all layers: `fogOD += dyeAbs * fog[i]`. Subtract before scanning: `imageOD = max(totalOD - fogOD, 0)`.

**B&W:** Map `[fog, dmax]` to `[0, 1]` instead of `[0, dmax]` to `[0, 1]`.

This fixes gray bars on unexposed areas (the v2 bug where fog density contributed to the scan formula without being calibrated out).

---

## User Controls

### Per-layer (Layers tab)
| Control | Key | Range | Purpose |
|---------|-----|-------|---------|
| Sensitizer peak | `sensitizerPeak` | 380-700 nm | Spectral sensitivity center |
| Sensitizer bandwidth | `sensitizerBw` | 30-200 nm | Spectral sensitivity width |
| Dye purity | `dyePurity` | 0-1 | 0 = silver (B&W), >0 = color dye |
| Dmax | `dmax` | 0.05-3.5 | Maximum density |
| Fog | `fog` | 0-0.3 | Base + fog (Dmin) |
| H&D Toe | `hdToe` | 0-0.5 | Shadow detail rolloff |
| H&D Gamma | `hdGamma` | 0.3-3.0 | Contrast (curve slope) |
| H&D Shoulder | `hdShoulder` | 0-0.5 | Highlight rolloff |
| Crystal size | `crystalSize` | 0.05-2.0 | Grain amplitude control |

### Global (Base tab)
| Control | Key | Range | Purpose |
|---------|-----|-------|---------|
| E-6 reversal | `reversal` | 0/1 | Negative vs positive process |
| Stacking strength | `stackingStrength` | 0-1 | Inter-layer exposure attenuation |
| DIR inhibition | `dirInhibition` | 0-1 | Edge sharpness (inter-image effect) |
| Base tint warmth | `baseTintWarmth` | -1 to 1 | Cool blue ↔ warm amber tint |
| Scan exposure | `scanExposure` | 1.0-6.0 | Scanning contrast (paper grade) |
| Halation strength | `halation` | 0-1 | Highlight glow intensity |
| Mask density | `maskDensity` | 0-1 | Orange mask strength (neg only) |
| Mask hue | `maskHue` | 0-60 | Orange mask color |

### Develop tab
Bath temperature, development time, agitation, chemistry freshness, developer activity.

---

## Stock Templates

| Film | Type | Crystal Size | Fog | Warmth | Halation | Notes |
|------|------|-------------|-----|--------|----------|-------|
| Portra 400 | Color neg | 0.28-0.35 | 0.04-0.05 | 0.50 | 0.25 | Classic portrait film |
| Gold 200 | Color neg | 0.20-0.25 | 0.05-0.06 | 1.00 | 0.20 | Warm consumer film |
| Velvia 50 | Reversal | 0.13-0.15 | 0.02 | -0.08 | 0 | Ultra-saturated slide |
| Kodachrome 64 | Reversal | 0.16-0.18 | 0.03 | 0.33 | 0 | Warm slide film |
| Ilford HP5 | B&W neg | 0.55 | 0.08 | 0 | 0 | Versatile B&W |
| Kodak Tri-X | B&W neg | 0.90 | 0.10 | 0.08 | 0 | Iconic punchy B&W |

---

## Resource Management

- **`destroy()` method** cleans up all WebGL resources: 3 FBOs, 2 textures, 5 programs, 1 buffer
- **`cpuOnly` constructor flag** skips WebGL initialization for CPU-only use (e.g., `renderFilmCPU` reference overlay)
- **`_compile()` returns null** on shader failure with proper cleanup; `_linkProgram()` guards null inputs

---

## Shared GLSL

`GLSL_LN10` and `GLSL_DYE_ABS` are extracted as JS string constants, included in both density and composite shaders via template literals. Eliminates copy-paste duplication of the `dyeAbs()` function and `LN10` constant.

---

## Future Work (Deferred)

- **Per-layer blur radii:** Separate blur pass per layer instead of global max radius. Requires N blur passes — significant pipeline rework.
- **Reciprocity failure:** Per-layer exposure correction for long/short durations. Needs exposure time input.
- **CPU blur memory optimization:** Currently allocates 6 temp Float32Arrays at image resolution (~288MB for 4K). Could reuse buffers.
