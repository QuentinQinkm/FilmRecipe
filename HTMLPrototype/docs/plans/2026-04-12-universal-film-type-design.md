# Universal Film Type Design

**Date:** 2026-04-12
**Status:** Approved, ready for implementation

## Problem

The current `filmType: 'negative' | 'positive' | 'bw'` field is a global lock that drives
rendering, UI visibility, and layer structure all at once. This prevents mixing behaviors
across layers (e.g. one layer inverted, another not) and locks the output pipeline to a
preset combination of scan/mask/reversal steps. The N/P/BW toggle in the topbar also has a
bug: `switchCustomFilmType()` modifies `labBaseRecipe` but `resetLabWorkflow()` immediately
overwrites it from `currentRecipe`, so the UI never updates.

## Solution: Approach A — Full Universal Recipe

Remove `filmType` entirely. Replace with:
- Per-layer `reversal` (0→1 continuous)
- Per-layer `silverMode` (boolean)
- Global `scanReversal` (boolean) + `scanExposure` (float)

N/P/BW buttons become one-tap preset stamps, not locks.

---

## Data Model

### Layer (additions)

```js
reversal: 0.0,     // 0 = negative polarity, 1 = positive, 0.5 = constant fog
silverMode: false, // true = silver-halide neutral density, false = dye coupler
```

`reversal` replaces the global `isPos ? dmax - density : density` flip:
```js
effectiveDensity = mix(density, dmax - density, reversal)
```

`silverMode` switches the absorption vector from dye color to neutral:
```
color layer:  absorb = dyeAbs(hue, purity)   — complementary hue
silver layer: absorb = vec3(1.0)              — neutral density
```

`dyeHue` and `dyePurity` are ignored when `silverMode = true`.

### Global (additions)

```js
scanReversal: true,  // apply 1−exp(−OD×scanExp) at output
scanExposure: 3.0,   // scan compression factor (0.5–6.0), was hardcoded
```

Orange mask (`maskDensity`, `maskHue`) stays as-is; the `isNeg` UI gate is removed.

### filmType: removed

No backward compatibility needed. Stock templates updated in-place.

---

## Rendering Engine (renderer.js)

### GLSL uniform changes

Removed: `uFilmType`
Added: `uReversal` (vec3), `uSilver` (vec3), `uScanRev` (float), `uScanExp` (float)
Kept: `uRaw` (viewer override — bypasses scan step)

### Shader logic

The `if (isBW) { } else { }` split is removed. One unified path:

```glsl
// Per-layer loop (x/y/z for layers 0/1/2):
vec3 absVec = uSilver[i] > 0.5 ? vec3(1.0) : dyeAbs(uDyeHue[i], uDyePurity[i]);
float dn = hd(exp, toe, gam, sho, dm);
dn = mix(dn, dm - dn, uReversal[i]);   // reversal per layer
// stacking uses absVec (pre-reversal density)
totalOD += absVec * dn_post_dir;
```

Output stage:
```glsl
if (uRaw > 0.5) {
  out3 = exp(-(totalOD + maskOD) * LN10);          // raw film + mask
} else if (uScanRev > 0.5) {
  out3 = vec3(1.0) - exp(-totalOD * uScanExp);     // scanned positive
} else {
  out3 = exp(-totalOD * LN10);                     // direct transmittance
}
```

### CPU path

Same changes. Remove `isBW` branch. `needCPU` check: `recipe.layers.length > 3` (no filmType check).

---

## UI

### Topbar

N/P/BW toggle becomes a **preset stamp** group (label: `PRESET`). Clicking stamps
`reversal`, `silverMode`, `scanReversal`, `scanExposure` onto all layers. Active state =
last applied preset (cosmetic only — recipe may have diverged).

Preset stamp values:

| Preset | Per-layer | Global |
|--------|-----------|--------|
| Negative | reversal=0, silverMode=false | scanReversal=true, scanExposure=3.0 |
| Positive | reversal=1, silverMode=false | scanReversal=false |
| B&W | reversal=0, silverMode=true, collapse to 1 layer | scanReversal=true, scanExposure=3.0 |

### Per-layer controls (Emulsion Design)

New controls per layer:
- **Polarity slider** (`reversal`, 0→1, endpoint labels "Neg / Pos") — between Tone and Grain
- **Silver toggle** button in layer header — when active: layer dot → gray, dye controls hide

Spectrum visualization:
- Silver layer bell → gray fill
- H&D mini-curve flips vertically when `reversal > 0.5`
- Pointer → gray for silver layers

### Film Base section

- Orange mask controls: always visible (no `isNeg` gate)
- New **Output Pipeline** subsection:
  - Scan reversal toggle
  - Scan exposure slider (visible when scan reversal ON)

---

## Stock Template Updates

| Template | reversal | silverMode | scanReversal | Notes |
|----------|----------|------------|--------------|-------|
| Portra 400, Gold 200 | 0 | false | true | unchanged visually |
| Velvia 50, Kodachrome 64 | 1 | false | false | unchanged visually |
| Ilford HP5 | 0 | true | true | dmax retuned for Beer-Lambert |
| Kodak Tri-X | 0 | true | true | dmax retuned for Beer-Lambert |

BW templates: `dmax` field was 0 (unused in old path), must be set to a real value.
`hdGamma` and `dmax` retuned empirically to match original visual character.

---

## Bug Fix (included in this pass)

`topbar.js`: `switchCustomFilmType()` modifies `labBaseRecipe` then `resetLabWorkflow()`
overwrites it. Fix: in custom mode, `resetLabWorkflow()` must NOT clobber `labBaseRecipe`.
Solution: replace both switch functions with `applyFilmPreset(type)` which stamps directly
onto `labBaseRecipe` (custom mode) or rebuilds from a blank (stock mode), then resets only
`labState`.

## Wire up `#processing` overlay

Show `processing.classList.add('active')` before `_renderCPU()`, remove after. Gives
feedback for slow 4-5 layer renders.
