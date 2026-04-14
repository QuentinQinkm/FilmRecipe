# Grain Engine v2 — Value Noise Hybrid Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-pixel sin-hash grain with cell-based value noise that produces spatially structured grain clumps, fixing repetitive patterns, RGB TV noise, and lack of grain character.

**Architecture:** Cell-based value noise with integer bit-mixing hash, Hermite smoothstep interpolation, jittered cell corners. Silver grain gets 2 octaves (sharp clumps), dye cloud grain gets 1 octave at 2.5x scale (soft blobs). Binomial density-dependent sigma model is kept. Drop-in replacement of noise functions — no new uniforms, passes, or textures.

**Tech Stack:** WebGL GLSL (HTML prototype), vanilla JS CPU fallback

**Reference:** Design doc at `docs/plans/2026-04-13-grain-engine-v2-design.md`

---

### Task 1: Replace GLSL grain functions with value noise

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js:82-138` (GLSL grain functions in FRAG_SRC template literal)

**Step 1: Replace the GLSL grain block**

Replace everything from line 82 (`// --- Grain engine v2`) through line 138 (`}` closing `dyeCloudGrain`) with:

```glsl
// --- Grain engine v2: value noise with spatial structure ---
//
// Cell-based value noise replaces per-pixel sin-hash.
// crystalSize controls both amplitude (binomial N) and spatial clump scale.
// Integer bit-mixing hash eliminates sin() periodicity artifacts.

// Integer bit-mixing hash: (cell, seed) -> [-1, 1], no periodicity
float ihash(vec2 cell, float seed) {
  float raw = cell.x * 73.0 + cell.y * 1597.0 + seed * 41.0;
  int h = int(raw);
  h = (h ^ (h >> 16)) * 0x45d9f3b;
  h = (h ^ (h >> 16)) * 0x45d9f3b;
  h ^= h >> 16;
  return float(h & 0x7fffffff) / float(0x7fffffff) * 2.0 - 1.0;
}

// Jittered cell corner: offsets grid point by per-cell random to break alignment
vec2 jitter(vec2 cell, float seed) {
  float jx = ihash(cell, seed + 100.0) * 0.4;
  float jy = ihash(cell, seed + 200.0) * 0.4;
  return cell + vec2(jx, jy);
}

// Single octave of value noise at given cell scale
float valueNoiseOctave(vec2 pos, float cellSize, float seed) {
  vec2 p = pos / max(cellSize, 0.001);
  vec2 cell = floor(p);
  vec2 f = fract(p);
  // Hermite smoothstep
  vec2 t = f * f * (3.0 - 2.0 * f);

  float c00 = ihash(jitter(cell, seed), seed);
  float c10 = ihash(jitter(cell + vec2(1.0, 0.0), seed), seed);
  float c01 = ihash(jitter(cell + vec2(0.0, 1.0), seed), seed);
  float c11 = ihash(jitter(cell + vec2(1.0, 1.0), seed), seed);

  float a = mix(c00, c10, t.x);
  float b = mix(c01, c11, t.x);
  return mix(a, b, t.y);
}

// Silver grain: 2 octaves, sharp clumps at crystal scale
float layerGrain(vec2 pos, float cs, float density, float dm, float seed) {
  float cellSize = cs * 0.02;
  float noise = valueNoiseOctave(pos, cellSize, seed) * 0.7
              + valueNoiseOctave(pos, cellSize * 0.5, seed + 31.0) * 0.3;

  float N = 1.0 / (cs * cs + 0.01);
  float p = clamp(density / max(dm, 0.01), 0.0, 1.0);
  float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));

  return noise * sigma * dm * 1.2;
}

// Dye cloud grain: 1 octave at 2.5x scale, soft large blobs
float dyeCloudGrain(vec2 pos, float cs, float density, float dm, float seed, vec2 pixelSize) {
  float cellSize = cs * 0.02 * 2.5;
  float noise = valueNoiseOctave(pos, cellSize, seed);

  float N = 1.0 / (cs * cs + 0.01);
  float p = clamp(density / max(dm, 0.01), 0.0, 1.0);
  float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));

  return noise * sigma * dm * 0.7;
}
```

Notes on the `cellSize = cs * 0.02` scaling factor: `crystalSize` range is 0.05–2.0 and `pos` is normalized by the image short edge. A factor of 0.02 means `crystalSize=0.35` produces cells of ~0.7% of the image width — roughly 5px on a 700px image, 28px on a 4000px image. This matches the visual scale of scanned film grain clumps. Tune this factor if clumps are too large or too small.

**Step 2: Verify the shader compiles**

Open browser at `http://localhost:8765`, load any image. Check browser console for WebGL shader compilation errors. Expected: no errors, grain visible on image.

**Step 3: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): replace sin-hash with value noise for spatially structured grain"
```

---

### Task 2: Replace CPU fallback grain functions

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js:442-479` (CPU grain functions inside `_renderCPU`)

**Step 1: Replace the CPU grain functions**

Replace from line 442 (`// Grain model matching GLSL`) through line 479 (`}` closing `cpuDyeCloudGrain`) with:

```js
    // Grain engine v2: value noise matching GLSL
    const SEEDS = [0.0, 73.156, 191.329, 347.718, 521.437];

    function ihash(cx, cy, seed) {
      let h = Math.trunc(cx * 73 + cy * 1597 + seed * 41);
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0;
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0;
      h ^= h >>> 16;
      return (h & 0x7fffffff) / 0x7fffffff * 2 - 1;
    }

    function jitter(cellX, cellY, seed) {
      const jx = ihash(cellX, cellY, seed + 100) * 0.4;
      const jy = ihash(cellX, cellY, seed + 200) * 0.4;
      return [cellX + jx, cellY + jy];
    }

    function valueNoiseOctave(px, py, cellSize, seed) {
      const invCS = 1 / Math.max(cellSize, 0.001);
      const sx = px * invCS, sy = py * invCS;
      const cx = Math.floor(sx), cy = Math.floor(sy);
      const fx = sx - cx, fy = sy - cy;
      const tx = fx * fx * (3 - 2 * fx);
      const ty = fy * fy * (3 - 2 * fy);

      const j00 = jitter(cx, cy, seed);
      const j10 = jitter(cx + 1, cy, seed);
      const j01 = jitter(cx, cy + 1, seed);
      const j11 = jitter(cx + 1, cy + 1, seed);

      const c00 = ihash(j00[0], j00[1], seed);
      const c10 = ihash(j10[0], j10[1], seed);
      const c01 = ihash(j01[0], j01[1], seed);
      const c11 = ihash(j11[0], j11[1], seed);

      const a = c00 + (c10 - c00) * tx;
      const b = c01 + (c11 - c01) * tx;
      return a + (b - a) * ty;
    }

    function cpuLayerGrain(px, py, cs, density, dm, seed, imgDim) {
      const shortEdge = Math.min(imgDim[0], imgDim[1]);
      const x = px / shortEdge, y = py / shortEdge;
      const cellSize = cs * 0.02;
      const noise = valueNoiseOctave(x, y, cellSize, seed) * 0.7
                  + valueNoiseOctave(x, y, cellSize * 0.5, seed + 31) * 0.3;
      const N = 1 / (cs * cs + 0.01);
      const p = Math.max(0, Math.min(1, density / Math.max(dm, 0.01)));
      const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
      return noise * sigma * dm * 1.2;
    }

    function cpuDyeCloudGrain(px, py, cs, density, dm, seed, imgDim) {
      const shortEdge = Math.min(imgDim[0], imgDim[1]);
      const x = px / shortEdge, y = py / shortEdge;
      const cellSize = cs * 0.02 * 2.5;
      const noise = valueNoiseOctave(x, y, cellSize, seed);
      const N = 1 / (cs * cs + 0.01);
      const p = Math.max(0, Math.min(1, density / Math.max(dm, 0.01)));
      const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
      return noise * sigma * dm * 0.7;
    }
```

**Step 2: Verify CPU fallback**

Temporarily break WebGL init (e.g. change `getContext('webgl'` to `getContext('webgl-disabled'`), reload, load an image. Verify grain is visible and has spatial clumps (not per-pixel salt-and-pepper). Then revert the WebGL break.

**Step 3: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): update CPU fallback to match value noise grain model"
```

---

### Task 3: Visual tuning and calibration

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (grain function constants only)

This task is about getting the grain to look right. The `0.02` cell scale factor, octave weights, and amplitude multipliers may need adjustment.

**Step 1: Test with B&W stocks**

Load an image, select Ilford HP5 (cs=0.55) and Kodak Tri-X (cs=0.90). Check:
- [ ] Grain clumps are visible (not per-pixel noise)
- [ ] No grid/mosaic pattern visible
- [ ] Grain strongest in midtones, fades in shadows and highlights
- [ ] Clumps are roughly 3-15px on a typical phone-width image (~400px)
- [ ] Moving crystalSize slider changes both intensity AND clump size

If clumps are too large: decrease the `0.02` factor (try `0.015` or `0.01`).
If clumps are too small / still looks like pixel noise: increase (try `0.03`).

**Step 2: Test with color stocks**

Select Portra 400 (cs=0.35), Gold 200 (cs=0.22), Velvia 50 (cs=0.12). Check:
- [ ] No RGB TV static — grain should look like luminance variation with subtle color shifts
- [ ] Dye cloud blobs are visibly larger/softer than silver grain
- [ ] Velvia grain is barely perceptible
- [ ] Portra grain is visible but organic, not harsh

If color grain is too strong: decrease the `0.7` amplitude in `dyeCloudGrain`.
If dye cloud blobs are too large: decrease the `2.5` scale factor (try `2.0`).

**Step 3: Adjust constants and commit**

After tuning, update the constants in BOTH GLSL and CPU paths (they must match). Commit:

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): tune value noise scale and amplitude constants"
```

---

### Task 4: Update PRODUCT.md grain documentation

**Files:**
- Modify: `HTMLPrototype/PRODUCT.md:86-98` (grain section in rendering pipeline)
- Modify: `HTMLPrototype/PRODUCT.md:396-402` (grain design decision)

**Step 1: Update the grain section in the rendering pipeline**

Replace the grain item (item 10, lines 86-98) with:

```markdown
10. **Per-layer grain** — physics-based crystal emulation applied at the density
   stage (before dye absorption), independently per layer:
   - **Value noise**: cell-based noise with integer bit-mixing hash and Hermite
     smoothstep interpolation. Produces spatially structured grain clumps instead
     of per-pixel salt-and-pepper. Cell corners are jittered (+-0.4 cells) to
     break grid alignment.
   - **Binomial statistics**: `sigma = sqrt(p*(1-p)/N)` where `N = 1/(cs²+0.01)`
     crystals per cell and `p = density/dmax` is develop probability
   - **crystalSize controls spatial scale**: cell size = `cs * 0.02` of normalized
     image coordinates. Bigger crystals = bigger clumps AND more amplitude.
   - **Silver grain** (dyePurity < 0.01): 2 octaves (70/30 blend) at crystal
     scale. Sharp, high-contrast clumps.
   - **Dye cloud grain** (dyePurity >= 0.01): 1 octave at 2.5x crystal scale.
     Soft, large blobs matching real dye cloud diffusion.
   - **Per-layer seeds**: each layer gets an independent hash seed so grain
     patterns are uncorrelated across layers
   - Grain IS the density variation, not a post-process overlay
```

**Step 2: Update the design decision**

Replace the grain design decision entry with:

```markdown
- **Value noise grain, not per-pixel hash** — v1 grain used sin()-based per-pixel
  hashing which produced salt-and-pepper noise with visible periodicity. v2 uses
  cell-based value noise where `crystalSize` controls both amplitude (binomial
  crystal count) and spatial clump scale. Integer bit-mixing hash eliminates
  sin() periodicity artifacts. Jittered cell corners prevent grid alignment.
- **Silver vs dye cloud grain character** — B&W silver grain uses 2 octaves at
  crystal scale (sharp clumps). Color dye cloud grain uses 1 octave at 2.5x
  scale (soft, large blobs). This eliminates the "RGB TV static" artifact where
  uncorrelated per-pixel noise in each layer produced chromatic salt-and-pepper.
```

**Step 3: Commit**

```bash
git add HTMLPrototype/PRODUCT.md
git commit -m "docs: update PRODUCT.md grain documentation for value noise v2"
```
