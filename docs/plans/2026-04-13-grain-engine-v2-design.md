# Grain Engine v2 — Value Noise Hybrid Design

**Date:** 2026-04-13
**Status:** Approved
**Supersedes:** `2026-04-13-grain-engine-v2.md` (per-pixel hash approach — rejected due to lack of spatial structure)

## Problem

The current grain engine has three critical flaws:

1. **Repetitive pattern** — `sin()`-based per-pixel hash has visible periodicity at certain coordinate ranges, creating repeating artifacts.
2. **Black noise, not grain** — grain is a scalar per-pixel perturbation with no spatial structure. Real film grain has clumps of developed crystals forming visible blobs at varying sizes (5–30px at typical scan resolution).
3. **RGB TV static on color film** — each layer gets uncorrelated per-pixel noise via different seeds. Since layers map to ~R/G/B channels, the result is classic RGB salt-and-pepper noise. Real color film grain has correlated spatial structure from dye clouds.

### Root cause

The current grain has **no spatial scale**. It operates per-pixel with `crystalSize` controlling only amplitude. Real grain has characteristic spatial sizes that the noise must model.

## Approach

**Hybrid:** Keep the binomial density-dependent statistics model (physically correct) but replace the noise source with cell-based value noise at crystal-scale spatial frequency.

- Crystal size controls both amplitude (via binomial N) AND spatial clump scale
- Value noise produces smooth blobs instead of per-pixel salt-and-pepper
- Silver vs dye cloud differentiation via spatial scale and octave count

## Design

### 1. Noise Generation — Cell-Based Value Noise

Replace `grainHash()` (sin-based per-pixel hash) with integer bit-mixing hash + smooth value noise interpolation.

**Hash function** — integer bit-mixing, no sin() periodicity:

```glsl
float ihash(vec2 cell, float seed) {
  uint h = uint(cell.x * 73.0 + cell.y * 1597.0 + seed * 41.0);
  h = (h ^ (h >> 16u)) * 0x45d9f3bu;
  h = (h ^ (h >> 16u)) * 0x45d9f3bu;
  h ^= h >> 16u;
  return float(h & 0x7fffffffu) / float(0x7fffffff) * 2.0 - 1.0;
}
```

**Value noise** — smooth interpolation between cell corner random values:

```
cellCoord = pos / cellSize
cell = floor(cellCoord)
f = fract(cellCoord)
t = f * f * (3.0 - 2.0 * f)      // Hermite smoothstep
bilinear lerp of ihash at 4 corners using t
```

**Jitter** — each cell corner offset by +-0.4 cells via per-cell random displacement to break grid alignment.

**Two octaves** for natural size variation:
- Octave 1: cell size = `crystalSize` — primary clumps, weight 0.7
- Octave 2: cell size = `crystalSize * 0.5` — fine detail, weight 0.3

### 2. Density-Dependent Grain Model (Kept)

The binomial model is physically correct and stays:

```
N = 1 / (cs^2 + 0.01)         // crystal count per sampling area
p = density / dmax              // develop probability
sigma = sqrt(p * (1-p) / N)    // binomial standard deviation
```

Grain peaks at mid-density (p=0.5), vanishes at clear film and full density.

**What changes:** noise input is now spatial value noise (clumps) instead of per-pixel hash. Sigma modulates the amplitude of the clumps, not the character.

```
grain = valueNoise(pos, crystalSize, seed) * sigma * dmax * amplitude
```

### 3. Silver vs Dye Cloud Differentiation

**Silver grain** (`dyePurity < 0.01`):
- Two octaves at 70/30 blend
- Cell size = `crystalSize` (direct)
- Amplitude factor: 1.2
- Sharp, high-contrast clumps — individual crystal clusters visible
- Produces Tri-X / HP5 gritty character

**Dye cloud grain** (`dyePurity >= 0.01`):
- Single octave only (dye diffusion smooths fine detail)
- Cell size = `crystalSize * 2.5` (dye clouds are physically larger)
- Amplitude factor: 0.7
- Softer, larger blobs — dye diffuses outward from crystal sites
- Produces Portra / Ektar smooth organic grain

**Why this fixes the RGB TV noise:** dye cloud clumps are large enough that adjacent pixels share the same grain blob. Per-channel noise patterns overlap significantly, producing luminance-like grain shifts with mild color fringing at clump edges — matching real scanned color negative.

### 4. Integration with Existing Pipeline

**What changes:**
- Replace `grainHash()` with `ihash()` + `valueNoise()` in GLSL shader header
- Replace `layerGrain()` internals — same signature, uses 2-octave value noise
- Replace `dyeCloudGrain()` internals — same signature, uses 1-octave value noise at 2.5x scale. Nested neighborhood `for` loop removed entirely.
- CPU path (`cpuLayerGrain`, `cpuDyeCloudGrain`) mirrors GLSL with same math

**What doesn't change:**
- Function signatures — callers unchanged
- Pipeline position — density perturbation before dye absorption
- Per-layer seeds — independent hash seeds per layer
- Binomial sigma model
- `crystalSize` parameter range (0.05–2.0)
- No new uniforms, no new passes, no texture uploads

**Performance:**
- Current silver: 1 sin-hash per pixel per layer
- Current dye cloud: up to 49 sin-hashes per pixel per layer (7x7 loop)
- New silver: 8 integer hashes per pixel per layer (2 octaves x 4 corners)
- New dye cloud: 4 integer hashes per pixel per layer (1 octave x 4 corners)
- Net: silver slightly more expensive, dye cloud significantly cheaper. Integer hashes faster than sin-hashes on GPU. Overall neutral or slight win.

### 5. Resolution Independence

Grain coordinates normalized by image short edge (existing behavior). `crystalSize` of 0.35 means "grain clumps are 0.35% of image width." A 600px and 4000px image have the same grain character — the larger image simply has more pixels per clump (sharper clump edges).
