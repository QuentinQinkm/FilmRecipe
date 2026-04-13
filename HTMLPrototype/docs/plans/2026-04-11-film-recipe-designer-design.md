# Film Recipe Designer — Design Document
**Date:** 2026-04-11

---

## Product Vision

A browser-based film emulsion designer. Users tune the actual chemical parameters of a film roll — not visual filters — and see the result applied to an uploaded test image in real time. The joy is in the chemistry: designing a film stock from its molecular components up, the way a Fujifilm or Kodak engineer would.

This is not a filter app. The image is a test strip. The film is the product.

---

## Target User

The curious middle: photographers who've shot film, know stock names, want to understand *why* Portra looks like Portra, and enjoy tinkering. Not color scientists, not casual Instagram filter users.

**Design principle:** You're always designing real film chemistry. Simple mode teaches the vocabulary by making you feel the effects. Pro mode rewards you when you've learned to speak it.

---

## Film Types

Three film types on a single unified surface. Selecting the type morphs the layer panel:

| Type | Layers | Unique behavior |
|---|---|---|
| **Negative** | 3 (Cyan / Magenta / Yellow coupler) | Orange mask present; output is inverted |
| **Positive** | 3 (Cyan / Magenta / Yellow coupler) | No mask; direct positive readout |
| **B&W** | 1 (Panchromatic silver) | No dye couplers; tone from silver density only |

---

## Chemical Parameters

### Per Emulsion Layer

| Parameter | Pro label | Simple label | Unit | Range | Chemical meaning |
|---|---|---|---|---|---|
| Sensitizer peak | Sensitizer peak | Color sensitivity center | nm | 380–700 | The wavelength this layer is most sensitive to |
| Sensitizer bandwidth | Sensitizer bandwidth | Sensitivity range | nm | 30–150 | How broadly it responds around the peak |
| Dye hue | Dye hue | Dye color | ° | 0–360 | The actual hue of the formed dye |
| Dye purity | Dye purity | Dye richness | 0–1 | 0–1 | Spectral purity of the dye (0 = gray, 1 = vivid) |
| Dmax | Dmax | Color depth | log density | 0.1–3.0 | Maximum dye density = saturation ceiling |
| H&D toe | Toe | Shadow detail | 0–1 | 0–1 | Where shadow detail rolls off |
| H&D gamma | Gamma | Contrast | 0.5–3.0 | | Slope of linear region |
| H&D shoulder | Shoulder | Highlight rolloff | 0–1 | 0–1 | Where highlights clip |
| Crystal size | Crystal size | Grain texture | μm | 0.1–2.0 | Silver halide crystal size; governs grain character |

B&W layer omits dye hue, dye purity, and Dmax.

### Global Parameters

| Parameter | Pro label | Simple label | Notes |
|---|---|---|---|
| Mask density | Mask density | Orange mask | Negative only. Strength of colored masking couplers |
| Mask hue | Mask hue | Mask tint | Negative only. Usually orange, can shift |
| DIR inhibition | DIR inhibition | Color bleed | Inter-layer development suppression; affects color separation and edge sharpness |
| Film base tint | Film base tint | Base color | RGB tint of the acetate base |

**Total parameters:** ~29 (color), ~12 (B&W)

---

## Rendering Pipeline

All processing via HTML Canvas `getImageData` / `putImageData`. No server, single HTML file.

For each pixel:

1. **Spectral decomposition** — using each layer's sensitizer peak and bandwidth, compute how much of the pixel's light that layer captures (Gaussian response over RGB channels approximating the spectral sensitivity curve)
2. **H&D curve mapping** — map log-exposure through the toe/gamma/shoulder curve to get dye density per layer
3. **Dye color formation** — convert density through dye hue + purity to get the actual absorbed color per layer
4. **DIR inter-layer suppression** — attenuate adjacent layer densities proportional to DIR inhibition value
5. **Colored mask addition** — for Negative only: add mask density * mask hue as a pre-compensation offset
6. **Film type output**:
   - Negative: CMY dye densities → invert → RGB output
   - Positive: CMY dye densities → direct RGB output
   - B&W: single silver density → grayscale
7. **Film base tint** — multiply output by base color
8. **Grain** — per-layer spatially-coherent noise (seeded, clustered by crystal size), luminance-weighted (more grain in midtones/shadows)

---

## Film Stock Templates

Six presets that pre-fill all parameters as starting points. Users can load and modify from there.

| Stock | Type | Character |
|---|---|---|
| Kodak Portra 400 | Negative | Warm skin tones, cyan-green shadows, gentle rolloff, fine grain |
| Kodak Gold 200 | Negative | Amber-orange cast, punchy midtones, medium grain |
| Fuji Velvia 50 | Positive | Hyper-saturated, deep blue-green bias, steep gamma, very fine grain |
| Kodachrome 64 | Positive | Warm reds/yellows, cyan shadows, tight color separation |
| Ilford HP5 | B&W | Wide latitude, medium grain clusters, neutral panchromatic response |
| Kodak Tri-X 400 | B&W | High contrast, chunky grain, crushed toe |

---

## Simple / Pro Mode Toggle

A single toggle switches the entire interface between two label sets. The underlying parameters and rendering model are identical in both modes.

**Simple mode differences:**
- Parameter names use plain language (see Simple label column above)
- Units hidden
- H&D curve shown as three named sliders (Shadow Detail, Contrast, Highlight Rolloff)
- Sensitizer peak shown as a spectrum bar with draggable marker, not a number field

**Pro mode additions:**
- All values shown with correct units (nm, log density, μm, °)
- H&D curve shown as a plotted graph (log exposure vs density) that updates live
- Layers labeled with full chemistry: "Layer 1 — Red-sensitive / Cyan coupler"
- Mask parameters visible and separated from global section

---

## UI Layout

Single-page, editorial aesthetic. White background, `#111` text, generous whitespace, clean sans-serif typography.

```
┌─────────────────────────────────────────────────────────────┐
│  Film Recipe                 [Simple / Pro]   [Upload ↑]    │
│  [Negative] [Positive] [B&W]                                │
│  Templates: [Portra 400] [Gold 200] [Velvia 50]             │
│             [Kodachrome] [HP5]      [Tri-X]                 │
├───────────────────────────┬─────────────────────────────────┤
│  LAYER 1 — Cyan           │                                 │
│  Sensitizer peak  ━━●━━   │                                 │
│  Sensitizer bw    ━━●━━   │      test image canvas          │
│  Dye hue          ━━●━━   │                                 │
│  Dye purity       ━━●━━   │  [Reference ◉]  split view     │
│  Dmax             ━━●━━   │                                 │
│  H&D curve        ━━●━━   │                                 │
│  Crystal size     ━━●━━   │                                 │
│  ────────────────────     │                                 │
│  LAYER 2 — Magenta        │                                 │
│  ...                      │                                 │
│  ────────────────────     │                                 │
│  LAYER 3 — Yellow         │                                 │
│  ...                      │                                 │
│  ══════════════════════   │                                 │
│  GLOBAL                   │                                 │
│  Mask density     ━━●━━   │                                 │
│  Mask hue         ━━●━━   │                                 │
│  DIR inhibition   ━━●━━   │                                 │
│  Base tint        ━━●━━   │                                 │
└───────────────────────────┴─────────────────────────────────┘
```

Reference toggle splits the canvas vertically — left: your recipe, right: selected template stock.

---

## Scope (Prototype)

- Single HTML file, no build toolchain
- No export of processed image (view only)
- No save/share of custom recipes
- Canvas pixel manipulation only (no WebGL)
- Grain is per-frame (not animated)

---

## Known Simplifications vs Real Chemistry

| Simplified | Reality |
|---|---|
| Sensitizer peak + bandwidth | Real sensitivity is a full continuous spectral curve |
| Dye hue + purity | Real dye absorption is a multi-peak spectral curve with secondary absorptions |
| DIR inhibition as global scalar | Real DIR effects are spatial, diffusion-limited, distance-dependent |
| No cross-development simulation | Temperature, chemistry type affect curve shape in real processing |

These are accepted trade-offs. The model is a toy, but it's the right toy — parameters are real, structure is correct, results are chemically grounded.
