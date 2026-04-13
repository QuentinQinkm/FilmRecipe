# Grain Engine v2 — Physics-Based Film Grain Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cell-based grain model with a per-pixel, resolution-independent, physically-accurate grain engine that models real silver halide / dye cloud behavior.

**Architecture:** Per-pixel hash noise (no cells) with amplitude controlled by binomial crystal statistics. `crystalSize` controls crystal count N (amplitude), not spatial block size. Color film gets dye-cloud softening (multi-pixel averaging) on top of the per-pixel crystal noise. Resolution-independent via normalized coordinates.

**Tech Stack:** WebGL GLSL (HTML prototype), vanilla JS CPU fallback

**Reference:** Current grain code at `HTMLPrototype/src/engine/renderer.js:79-137`, stock templates at `HTMLPrototype/src/state.js:17-62`, recipe controls at `HTMLPrototype/src/state.js:73-82`

---

## Physics Summary

What we're modeling, layer by layer:

1. **Silver halide crystals** develop or don't (binary). The H&D density is the statistical mean. Grain is the binomial variance: `sigma = sqrt(p*(1-p)/N)` where `p = density/dmax` and `N` = crystal count per sampling area.

2. **crystalSize** controls crystal radius → `N ∝ 1/r²` (fewer big crystals = more variance). This is purely an amplitude control. Spatial noise is always per-pixel.

3. **Density-dependent variance** — grain peaks at mid-density (p=0.5), vanishes at clear film and full density. Already correct in current model.

4. **B&W vs color grain** — fundamentally different:
   - **B&W (silver):** Sharp, fine-grained, high-contrast per-pixel noise. What you see IS the developed crystals.
   - **Color (dye clouds):** Each developed crystal triggers a dye cloud 10-25x larger. The dye cloud is a natural spatial blur on the underlying crystal pattern. Color grain is softer and lower-contrast.

5. **Per-layer independence** — each emulsion layer has its own crystal population with uncorrelated noise patterns (different seeds). In color film, the blue/yellow layer is typically grainiest, red/cyan finest.

6. **Resolution independence** — grain parameters are in emulsion-space, not pixel-space. We normalize pixel coordinates by image shorter edge so grain character is consistent regardless of image resolution.

---

## Parameter Changes

### `crystalSize` reinterpretation

| Property | Old | New |
|----------|-----|-----|
| What it controls | Spatial cell size (px) AND amplitude | Amplitude only (crystal count N) |
| Range | 0.05–2.0 | 0.05–2.0 (same slider) |
| Meaning | Bigger = bigger blocks | Bigger = fewer crystals = more variance |
| Spatial behavior | `floor(pos/scale)` cells | Per-pixel hash, no cells |

The formula `N = 1 / (cs² + 0.01)` is kept — it correctly models how larger crystals mean fewer per area, increasing variance. We just remove the spatial cell scaling.

### New uniform: `uImgDim`

A `vec2` uniform with `(imageWidth, imageHeight)` for coordinate normalization.

### No new recipe parameters

The `crystalSize` field on each layer keeps its current meaning and range. Stock template values stay the same. UI controls stay the same. Only the shader internals change.

---

### Task 1: B&W grain — per-pixel hash, no cells

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (GLSL shader grain functions, lines 79-137)

This task replaces the cell-based grain with per-pixel noise for the B&W path only. Color grain (Task 3) builds on this.

**Step 1: Replace the grain functions in FRAG_SRC**

Replace everything from `// --- Physically-motivated grain model ---` (line 79) through `return noise * sigma * dm * 1.2;` + closing `}` (line 136) with:

```glsl
// --- Grain engine v2: per-pixel, resolution-independent ---
//
// Each pixel gets independent noise via hash. No cells, no mosaics.
// crystalSize controls amplitude via binomial crystal count N = 1/(cs²+0.01).
// Coordinates normalized by image shorter edge for resolution independence.

// Per-pixel hash: maps (x, y, seed) to [-1, 1]
// Uses two rounds of sin-hash to break correlation
float grainHash(vec2 p, float seed) {
  float h1 = dot(p + vec2(seed), vec2(127.1, 311.7));
  float n1 = fract(sin(h1) * 43758.5453);
  float h2 = dot(vec2(n1, seed), vec2(269.5, 183.3));
  return fract(sin(h2) * 28001.8384) * 2.0 - 1.0;
}

// Per-layer grain: returns density perturbation
// pos: pixel coordinate normalized by shorter image edge
float layerGrain(vec2 pos, float cs, float density, float dm, float seed) {
  float noise = grainHash(pos, seed);

  // Binomial model: crystal count inversely proportional to crystal area
  float N = 1.0 / (cs * cs + 0.01);
  float p = clamp(density / max(dm, 0.01), 0.0, 1.0);

  // Binomial standard deviation
  float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));

  return noise * sigma * dm * 1.2;
}
```

**Step 2: Add `uImgDim` uniform to the shader**

In the GLSL uniforms block (after `uniform float uStackStr;` on line 29), add:

```glsl
uniform vec2 uImgDim;
```

**Step 3: Normalize grain coordinates in main()**

In the B&W path (line 170), change:
```glsl
den = clamp(den + layerGrain(gl_FragCoord.xy, uCrystal[0], den, 2.5, seeds[0]), 0.0, 2.5);
```
to:
```glsl
vec2 grainCoord = gl_FragCoord.xy / min(uImgDim.x, uImgDim.y);
den = clamp(den + layerGrain(grainCoord, uCrystal[0], den, 2.5, seeds[0]), 0.0, 2.5);
```

In the color path (line 188), change:
```glsl
d = clamp(d + layerGrain(gl_FragCoord.xy, uCrystal[i], d, uDmax[i], seeds[i]), 0.0, uDmax[i]);
```
to:
```glsl
vec2 grainCoord = gl_FragCoord.xy / min(uImgDim.x, uImgDim.y);
d = clamp(d + layerGrain(grainCoord, uCrystal[i], d, uDmax[i], seeds[i]), 0.0, uDmax[i]);
```

(Declare `grainCoord` once before the loop for the color path.)

**Step 4: Wire up `uImgDim` in the JS renderer**

In `_initGL()` (line 286), add `'uImgDim'` to the uniform names list:
```js
for (const n of ['uImg','uReversal','uRaw','uDir','uMaskDen','uMaskHue','uBaseTint','uPassthrough','uStackStr','uLayerCount','uImgDim']) {
```

In `_renderGL()` (after line 364, after `gl.uniform1i(this.u.uLayerCount, n);`), add:
```js
gl.uniform2f(this.u.uImgDim, this.imageWidth, this.imageHeight);
```

**Step 5: Visual test**

Run: `cd HTMLPrototype && python3 -m http.server 8765`
Open browser, load a JPG, select Ilford HP5 or Kodak Tri-X.

Expected:
- Per-pixel grain, no visible grid/mosaic pattern
- Grain visible in midtones, vanishes in pure blacks and whites
- Grain character consistent regardless of image resolution (test by loading a small vs large image)
- crystalSize slider smoothly controls grain intensity (more noise at higher values)

**Step 6: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): replace cell-based grain with per-pixel hash, resolution-independent"
```

---

### Task 2: CPU fallback — match new grain model

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (CPU grain functions, lines 429-460)

The CPU fallback (`_renderCPU`) has its own grain implementation that must stay in sync.

**Step 1: Replace CPU grain functions**

Replace the CPU grain functions (the `hash2`, `jitteredHash`, `crystalNoise`, `cpuLayerGrain` functions inside `_renderCPU`) with:

```js
function grainHash(px, py, seed) {
  const h1 = (px + seed) * 127.1 + py * 311.7;
  const n1 = ((Math.sin(h1) * 43758.5453) % 1 + 1) % 1;
  const h2 = n1 * 269.5 + seed * 183.3;
  return ((Math.sin(h2) * 28001.8384) % 1 + 1) % 1 * 2 - 1;
}

function cpuLayerGrain(px, py, cs, density, dm, seed, imgDim) {
  const shortEdge = Math.min(imgDim[0], imgDim[1]);
  const noise = grainHash(px / shortEdge, py / shortEdge, seed);
  const N = 1 / (cs * cs + 0.01);
  const p = Math.max(0, Math.min(1, density / Math.max(dm, 0.01)));
  const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
  return noise * sigma * dm * 1.2;
}
```

**Step 2: Update CPU grain call sites**

In the B&W path, update the `cpuLayerGrain` call to pass `[width, height]`:
```js
den = Math.max(0, Math.min(2.5, den + cpuLayerGrain(px, py, L.crystalSize, den, 2.5, SEEDS[0], [width, height])));
```

In the color path:
```js
d = Math.max(0, Math.min(L.dmax, d + cpuLayerGrain(px, py, L.crystalSize, d, L.dmax, SEEDS[j] || 0, [width, height])));
```

**Step 3: Visual test**

Temporarily disable WebGL (change `getContext('webgl', ...)` to `getContext('webgl-disabled', ...)`) and verify CPU fallback produces matching grain character. Then re-enable.

**Step 4: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): update CPU fallback to match per-pixel grain model"
```

---

### Task 3: Dye cloud softening for color layers

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (GLSL grain function + color path)

In color film, developed silver crystals trigger dye cloud formation. Dye clouds are 10-25x larger than the original crystals, creating a natural spatial blur. B&W film has no dye clouds — you see the sharp silver grain directly.

We model this by averaging multiple per-pixel hash samples in a small neighborhood around each pixel. The neighborhood radius scales with `crystalSize` (bigger crystals → bigger dye clouds). B&W layers (`dyePurity < 0.01`) skip the averaging and use raw per-pixel noise.

**Step 1: Add dye cloud grain function to GLSL**

After the `layerGrain` function, add:

```glsl
// Dye cloud grain: averages per-pixel noise over a small neighborhood
// to simulate the spatial blur of dye formation around crystal sites.
// Dye clouds are ~10-25x larger than crystals in real film.
// radius: number of pixels to sample in each direction (1-3)
float dyeCloudGrain(vec2 pos, float cs, float density, float dm, float seed, vec2 pixelSize) {
  // Dye cloud radius: bigger crystals = bigger clouds
  // At cs=0.1 (fine grain), radius ~1px. At cs=1.0, radius ~3px.
  float radius = clamp(cs * 3.0, 1.0, 3.0);
  int r = int(radius);
  float sum = 0.0;
  float count = 0.0;
  for (int dy = -3; dy <= 3; dy++) {
    for (int dx = -3; dx <= 3; dx++) {
      if (abs(dx) > r || abs(dy) > r) continue;
      vec2 offset = vec2(float(dx), float(dy)) * pixelSize;
      float w = 1.0 - length(vec2(float(dx), float(dy))) / (radius + 0.5);
      if (w <= 0.0) continue;
      sum += grainHash(pos + offset, seed) * w;
      count += w;
    }
  }
  float noise = sum / max(count, 1.0);

  float N = 1.0 / (cs * cs + 0.01);
  float p = clamp(density / max(dm, 0.01), 0.0, 1.0);
  float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));

  // Color grain is lower contrast than silver grain (~60%)
  return noise * sigma * dm * 0.7;
}
```

**Step 2: Use dyeCloudGrain for color layers, layerGrain for B&W**

In the color layer loop (the `for (int i = 0; i < ${MAX_LAYERS}; i++)` block inside the `else` branch), change:
```glsl
d = clamp(d + layerGrain(grainCoord, uCrystal[i], d, uDmax[i], seeds[i]), 0.0, uDmax[i]);
```
to:
```glsl
vec2 pixelSize = 1.0 / uImgDim / min(uImgDim.x, uImgDim.y); // wait, this is wrong
```

Actually, `pixelSize` in normalized coordinates is `1.0 / min(uImgDim.x, uImgDim.y)`:
```glsl
float grainDelta;
if (uDyePurity[i] < 0.01) {
  // Silver layer in a mixed recipe — sharp grain
  grainDelta = layerGrain(grainCoord, uCrystal[i], d, uDmax[i], seeds[i]);
} else {
  // Color layer — soft dye cloud grain
  float pxNorm = 1.0 / min(uImgDim.x, uImgDim.y);
  grainDelta = dyeCloudGrain(grainCoord, uCrystal[i], d, uDmax[i], seeds[i], vec2(pxNorm));
}
d = clamp(d + grainDelta, 0.0, uDmax[i]);
```

The B&W path (single-layer) already uses `layerGrain` directly — no change needed there.

**Step 3: Update CPU fallback with dye cloud averaging**

Add a `cpuDyeCloudGrain` function in `_renderCPU`:

```js
function cpuDyeCloudGrain(px, py, cs, density, dm, seed, imgDim) {
  const shortEdge = Math.min(imgDim[0], imgDim[1]);
  const radius = Math.max(1, Math.min(3, Math.round(cs * 3)));
  let sum = 0, count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const w = 1 - dist / (radius + 0.5);
      if (w <= 0) continue;
      sum += grainHash((px + dx) / shortEdge, (py + dy) / shortEdge, seed) * w;
      count += w;
    }
  }
  const noise = sum / Math.max(count, 1);
  const N = 1 / (cs * cs + 0.01);
  const p = Math.max(0, Math.min(1, density / Math.max(dm, 0.01)));
  const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
  return noise * sigma * dm * 0.7;
}
```

And use it in the color layer loop:
```js
if (L.dyePurity < 0.01) {
  d = Math.max(0, Math.min(L.dmax, d + cpuLayerGrain(px, py, L.crystalSize, d, L.dmax, SEEDS[j] || 0, [width, height])));
} else {
  d = Math.max(0, Math.min(L.dmax, d + cpuDyeCloudGrain(px, py, L.crystalSize, d, L.dmax, SEEDS[j] || 0, [width, height])));
}
```

**Step 4: Visual test**

Load a JPG. Compare side-by-side:
1. **Ilford HP5 / Tri-X** (B&W): sharp per-pixel grain, high contrast noise
2. **Portra 400** (color negative): softer, lower-contrast grain with spatial smoothness
3. **Velvia 50** (color slide, fine grain): very subtle, soft grain

The visual difference between B&W and color grain should be obvious — B&W should look crisper/sharper, color should look smoother/more organic.

**Step 5: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): add dye cloud softening for color layers, keep sharp silver grain for B&W"
```

---

### Task 4: Tune stock template crystal sizes

**Files:**
- Modify: `HTMLPrototype/src/state.js` (STOCK_TEMPLATES crystal values, lines 17-62)

With the new grain model, the `crystalSize` values may need retuning since the amplitude relationship changed. The relative ordering should remain correct (Tri-X grainiest, Velvia finest), but absolute values may need adjustment.

**Step 1: Visual calibration**

Load a test image and cycle through all 6 stock templates. For each, assess:
- Is grain visible at all? (Velvia should be barely perceptible, Tri-X clearly visible)
- Does midtone grain feel natural? (Not too heavy, not invisible)
- Is the B&W vs color grain character difference working?

**Step 2: Adjust if needed**

If grain is too strong across the board, reduce the `1.2` multiplier in `layerGrain` and/or the `0.7` in `dyeCloudGrain`. If specific stocks need adjustment, tune their `crystalSize` values.

The physical ordering should be:
- Velvia 50 (ISO 50): finest grain → smallest `crystalSize` (~0.12-0.15)
- Kodachrome 64 (ISO 64): very fine → (~0.15-0.18)
- Gold 200 (ISO 200): medium → (~0.20-0.25)
- Portra 400 (ISO 400): medium-coarse → (~0.28-0.35)
- HP5 (ISO 400 B&W): coarse silver grain → (~0.50-0.60)
- Tri-X (ISO 400 B&W): coarsest → (~0.80-0.95)

Note: B&W stocks have larger `crystalSize` than color stocks at the same ISO because color dye clouds integrate over more area, effectively averaging down the noise.

**Step 3: Commit**

```bash
git add HTMLPrototype/src/state.js
git commit -m "feat(grain): tune stock template crystal sizes for v2 grain model"
```

---

### Task 5: Update PRODUCT.md grain documentation

**Files:**
- Modify: `HTMLPrototype/PRODUCT.md` (grain section in rendering pipeline, lines 83-96)

**Step 1: Update the grain description**

Replace the grain section (item 9 in the rendering pipeline) with:

```markdown
9. **Per-layer grain** — physics-based crystal emulation applied at the density
   stage (before dye absorption), independently per layer:
   - **Binomial statistics**: `sigma = sqrt(p*(1-p)/N)` where `N = 1/(cs²+0.01)`
     crystals per sampling area and `p = density/dmax` is develop probability
   - **Per-pixel hash noise**: each pixel gets independent noise via double
     sin-hash. No cell/grid structure — grain is spatially uncorrelated at
     the pixel level
   - **Resolution-independent**: pixel coordinates normalized by image shorter
     edge so grain character is consistent at any resolution
   - **B&W silver grain**: raw per-pixel noise, sharp and high-contrast (1.2x
     sigma scaling). Models direct observation of developed silver crystals
   - **Color dye cloud grain**: neighborhood-averaged noise (radius scales with
     crystalSize), lower contrast (0.7x sigma scaling). Models the spatial blur
     of dye formation around crystal development sites — dye clouds are 10-25x
     larger than the originating crystal
   - **Per-layer seeds**: each layer gets an independent hash seed so grain
     patterns are uncorrelated across layers
   - **crystalSize controls amplitude only**: larger crystals → fewer per area
     (N ∝ 1/r²) → more variance. Does not create spatial blocks.
   - Grain IS the density variation (crystal develop/don't-develop), not a
     post-process overlay
```

**Step 2: Update design decisions section**

Add or update the grain entry in Design Decisions:

```markdown
- **Per-pixel grain, not cell-based** — the v1 grain model used `floor(pos/scale)`
  to group pixels into cells, creating visible mosaic artifacts. v2 uses per-pixel
  hashing with `crystalSize` controlling only the binomial amplitude (crystal count
  N), not spatial block size. Coordinates are normalized by the image shorter edge
  for resolution independence.
- **B&W vs color grain character** — B&W film grain is the direct silver image:
  sharp, high-contrast, per-pixel. Color film grain is mediated by dye clouds
  (10-25x larger than crystals): softer, lower-contrast, spatially averaged. The
  engine branches based on `dyePurity` — layers with `dyePurity < 0.01` get sharp
  silver grain, others get dye-cloud-softened grain.
```

**Step 3: Commit**

```bash
git add HTMLPrototype/PRODUCT.md
git commit -m "docs: update PRODUCT.md grain documentation for v2 model"
```

---

### Task 6: Port grain v2 to Metal kernel

**Files:**
- Modify: `MacPrototype/FilmSimLab/Engine/FilmKernel.metal`
- Modify: `MacPrototype/FilmSimLab/Engine/FilmCIFilter.swift` (add image dimension argument)

**Step 1: Replace grain functions in FilmKernel.metal**

Replace the `hash2`, `jitteredHash`, `crystalNoise`, `layerGrain` functions with the new `grainHash`, `layerGrain`, and `dyeCloudGrain` functions, translated from GLSL to MSL:

- `fract(sin(h) * ...)` stays the same in MSL
- `vec2` → `float2`
- `clamp`, `sqrt`, `max`, `min`, `length` are the same
- Add `imgDim` parameter (passed as a `float2` kernel argument)

**Step 2: Add image dimension to kernel arguments**

In `FilmKernel.metal`, add `float2 imgDim` parameter to the `filmSimulation` function signature.

In `FilmCIFilter.swift`, add a `CIVector` for image dimensions to the arguments list:
```swift
let imgDimVec = CIVector(x: input.extent.width, y: input.extent.height)
```

**Step 3: Use dye cloud grain for color layers, sharp grain for B&W**

Mirror the GLSL logic: check `dyePurity[i] < 0.01` to choose between `layerGrain` and `dyeCloudGrain`.

**Step 4: Build and verify**

```bash
xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build
```
Expected: BUILD SUCCEEDED

**Step 5: Commit**

```bash
git add MacPrototype/FilmSimLab/Engine/FilmKernel.metal MacPrototype/FilmSimLab/Engine/FilmCIFilter.swift
git commit -m "feat(grain): port grain v2 (per-pixel hash + dye cloud) to Metal kernel"
```
