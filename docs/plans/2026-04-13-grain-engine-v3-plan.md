# Grain Engine v3 — Per-Layer Blur Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace value-noise grain with white-noise + per-layer separable Gaussian blur, coupling image sharpness to grain scale and eliminating grid moiré. Per-layer blur before compositing preserves physical correctness (dye absorption is nonlinear).

**Architecture:** 4-pass WebGL pipeline:
- Pass 1: Density shader — computes per-layer density with grain noise, outputs as RGB channels to FBO
- Pass 2: Horizontal Gaussian blur (operates on all channels independently = per-layer blur)
- Pass 3: Vertical Gaussian blur
- Pass 4: Compositing shader — reads blurred densities, applies DIR, dye absorption, mask/tint → screen

**Key insight:** Gaussian blur operates per-channel independently. By encoding layer 0/1/2 densities as R/G/B channels, one blur pass blurs all layers independently — true per-layer blur without N×2 extra passes.

**Tech Stack:** WebGL 1.0 GLSL ES 1.00 (HTML prototype), vanilla JS CPU fallback

**Reference:** Design doc at `docs/plans/2026-04-13-grain-engine-v3-design.md`

---

### Task 1: Split film shader into density + compositing shaders

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (replace FRAG_SRC with DENSITY_FRAG_SRC + COMPOSITE_FRAG_SRC)

Split the monolithic `FRAG_SRC` into two shader programs. The density shader handles everything through grain injection and outputs per-layer densities as RGB. The compositing shader reads those densities and handles DIR, dye absorption, reversal, mask, tint.

**Step 1: Replace the entire FRAG_SRC (lines 11-259) with DENSITY_FRAG_SRC**

The density shader keeps: image sampling, spectral sensitivity, H&D curve, fog, grain noise injection. It outputs densities as RGB channels.

Replace value noise grain functions (lines 82-141) with a single white noise hash:

```glsl
// --- Grain engine v3: white noise + per-layer blur ---
float grainHash(vec2 p, float seed) {
  return fract(sin(dot(p + seed, vec2(127.1, 311.7))) * 43758.5453) * 2.0 - 1.0;
}
```

The `main()` function computes per-layer density with grain and stores in channels:
- R channel = layer 0 density (with grain)
- G channel = layer 1 density (with grain)
- B channel = layer 2 density (with grain)
- A channel = 1.0

For B&W (single layer): only R channel used, G=B=0.

Grain injection per layer:
```glsl
float noise = grainHash(gl_FragCoord.xy, seed);
float N = 1.0 / (cs * cs + 0.01);
float p = clamp(density / max(dm, 0.01), 0.0, 1.0);
float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));
float amplitude = uDyePurity[i] < 0.01 ? 1.2 : 0.7;
density += noise * sigma * dm * amplitude;
```

**Important:** Density values can exceed 1.0 (dmax up to ~3.5). Since FBO uses UNSIGNED_BYTE (0-255), we must scale:
- Density shader output: `density / 4.0` (maps 0-4.0 → 0.0-1.0)
- Compositing shader input: `texture.r * 4.0` (maps back)

The density shader still needs stacking strength logic — when `uStackStr > 0`, each layer's exposure is attenuated by previously developed layers. This must happen in the density shader since it's a per-layer computation.

**Step 2: Add COMPOSITE_FRAG_SRC after DENSITY_FRAG_SRC**

The compositing shader reads blurred density texture and applies:
1. DIR inhibition (cross-layer density interaction)
2. Dye absorption per layer: `dyeAbs(hue, purity) * density`
3. Total optical density → transmittance: `exp(-totalOD * LN10)`
4. Reversal (for slide film)
5. Orange mask (for color negative raw mode)
6. Base tint
7. Linear → sRGB

Uniforms needed: `uDensities` (sampler2D), `uImg` (sampler2D, for passthrough mode), per-layer dye hue/purity/dmax, global reversal/dir/mask/tint.

**Step 3: Verify both shaders compile (but don't wire up yet — Task 3 handles that)**

---

### Task 2: Add blur shader, FBO infrastructure, and compile all 3 programs

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (add BLUR_FRAG_SRC, update `_initGL`, add `_ensureFBOs`)

**Step 1: Add BLUR_FRAG_SRC**

```js
const BLUR_FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uInput;
uniform vec2 uDirection;
uniform float uRadius;
uniform float uKernel[16];

void main() {
  vec4 sum = texture2D(uInput, vUV) * uKernel[0];
  for (int i = 1; i < 16; i++) {
    if (float(i) > uRadius) break;
    vec2 off = uDirection * float(i);
    sum += texture2D(uInput, vUV + off) * uKernel[i];
    sum += texture2D(uInput, vUV - off) * uKernel[i];
  }
  gl_FragColor = sum;
}`;
```

**Step 2: Update `_initGL()` to compile all 3 programs**

After the existing program setup, add:

1. **Blur program** — reuses same vertex shader (`VERT_SRC`), links with `BLUR_FRAG_SRC`
   - Uniforms: `uInput`, `uDirection`, `uRadius`, `uKernel[0..15]`
   - Store as `this.blurProg`, `this.blurU`

2. **Compositing program** — reuses same vertex shader, links with `COMPOSITE_FRAG_SRC`
   - Uniforms: `uDensities`, `uImg`, per-layer dye arrays, global uniforms
   - Store as `this.compProg`, `this.compU`

3. Rename the existing program from `this.prog` to `this.densProg` for clarity (or keep `this.prog` as the density program — either way, be consistent).

**Step 3: Add `_ensureFBOs(width, height)` method**

Creates 2 FBO objects (A and B) with RGBA UNSIGNED_BYTE textures at image dimensions. Called from `setImage()` after `this.hasImage = true`.

```js
_ensureFBOs(width, height) {
  const gl = this.gl;
  if (!gl) return;
  // Destroy old FBOs
  for (const fbo of [this.fboA, this.fboB]) {
    if (fbo) { gl.deleteFramebuffer(fbo.fb); gl.deleteTexture(fbo.tex); }
  }
  const createFBO = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, width, height };
  };
  this.fboA = createFBO();
  this.fboB = createFBO();
}
```

Add `this._ensureFBOs(w, h);` call in `setImage()` after `this.hasImage = true;`.

**Step 4: Add `_computeGaussianKernel(radius)` method**

```js
_computeGaussianKernel(radius) {
  const r = Math.ceil(radius);
  const sigma = Math.max(radius / 2.5, 0.001);
  const kernel = new Float32Array(16);
  let total = 0;
  for (let i = 0; i <= Math.min(r, 15); i++) {
    kernel[i] = Math.exp(-i * i / (2 * sigma * sigma));
    total += i === 0 ? kernel[i] : 2 * kernel[i];
  }
  for (let i = 0; i <= Math.min(r, 15); i++) kernel[i] /= total;
  return kernel;
}
```

**Step 5: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): add density/blur/composite shader programs and FBO infrastructure"
```

---

### Task 3: Wire up 4-pass rendering in `_renderGL`

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (`_renderGL` method, lines 361-404)

Replace the current single-pass `_renderGL` with the 4-pass pipeline.

**Step 1: Replace `_renderGL` method**

```js
_renderGL(recipe, rawMode) {
  const gl = this.gl;
  const { canvas } = this;
  canvas.width = this.imageWidth;
  canvas.height = this.imageHeight;
  const w = canvas.width, h = canvas.height;

  // Compute blur radius from max crystal size
  const GRAIN_PX = 10;
  const maxCS = Math.max(...recipe.layers.map(l => l.crystalSize || 0.3));
  const blurRadius = maxCS * GRAIN_PX;
  const needsBlur = blurRadius >= 0.5 && this.fboA && this.fboB;

  // --- Pass 1: Density shader → FBO A ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fb);
  gl.viewport(0, 0, w, h);
  gl.useProgram(this.densProg);
  // ... set all density uniforms (image texture, per-layer params) ...
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  if (needsBlur) {
    const kernel = this._computeGaussianKernel(blurRadius);

    // --- Pass 2: H blur FBO A → FBO B ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB.fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.blurProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboA.tex);
    gl.uniform1i(this.blurU.uInput, 0);
    gl.uniform2f(this.blurU.uDirection, 1.0 / w, 0.0);
    gl.uniform1f(this.blurU.uRadius, blurRadius);
    for (let i = 0; i < 16; i++) gl.uniform1f(this.blurU.uKernel[i], kernel[i]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- Pass 3: V blur FBO B → FBO A (reuse) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fb);
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.fboB.tex);
    gl.uniform2f(this.blurU.uDirection, 0.0, 1.0 / h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // --- Pass 4: Compositing shader FBO A → screen ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(this.compProg);
  // Bind blurred density texture from FBO A
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.fboA.tex);
  gl.uniform1i(this.compU.uDensities, 0);
  // Bind original image for passthrough check
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.uniform1i(this.compU.uImg, 1);
  // ... set compositing uniforms (dye, DIR, mask, tint, reversal) ...
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
```

**Step 2: Handle passthrough mode**

When passthrough is on, skip the density/blur pipeline and render the image directly. Either:
- Render image to FBO A with a simple passthrough density shader, or
- Use the compositing shader's passthrough uniform to output the original image

**Step 3: Verify the 4-pass pipeline**

Load test images. Check:
- [ ] No WebGL errors in console
- [ ] No moiré/grid patterns
- [ ] Grain clumps are organic blobs, not salt-and-pepper
- [ ] Image sharpness decreases as crystal size increases
- [ ] Grain is density-dependent (strongest in midtones)
- [ ] Color grain shows subtle color shifts at clump boundaries (not uniform RGB noise)
- [ ] B&W film shows monochrome grain (no color fringing)
- [ ] Slider adjustments are responsive

**Step 4: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): wire up 4-pass per-layer blur rendering pipeline"
```

---

### Task 4: Update CPU fallback

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (CPU grain functions + `_renderCPU`)

**Step 1: Replace CPU grain functions with white noise**

Replace the value noise block (ihash, valueNoiseOctave, cpuLayerGrain, cpuDyeCloudGrain) with:

```js
const SEEDS = [0.0, 73.156, 191.329, 347.718, 521.437];

function grainHash(px, py, seed) {
  const h = (px + seed) * 127.1 + py * 311.7;
  return ((Math.sin(h) * 43758.5453) % 1 + 1) % 1 * 2 - 1;
}

function cpuGrain(px, py, cs, density, dm, seed, isDye) {
  const noise = grainHash(px, py, seed);
  const N = 1 / (cs * cs + 0.01);
  const p = Math.max(0, Math.min(1, density / Math.max(dm, 0.01)));
  const sigma = Math.sqrt(p * (1 - p) / Math.max(N, 0.1));
  return noise * sigma * dm * (isDye ? 0.7 : 1.2);
}
```

**Step 2: Restructure CPU rendering for per-layer blur**

The CPU path needs to:
1. First pass: compute per-layer density arrays (with grain) — one array per layer
2. Blur each layer's density array independently (separable Gaussian)
3. Second pass: composite blurred densities via DIR + dye absorption

```js
// Pass 1: compute per-layer densities with grain
const layerDensities = layers.map(() => new Float32Array(width * height));

for (let i = 0; i < width * height; i++) {
  const px = i % width, py = Math.floor(i / width);
  // ... compute scene exposure from pixel ...
  for (let j = 0; j < layers.length; j++) {
    // ... spectral sensitivity, H&D curve, fog, grain noise ...
    layerDensities[j][i] = density;
  }
}

// Per-layer Gaussian blur
const GRAIN_PX = 10;
const maxCS = Math.max(...layers.map(l => l.crystalSize || 0.3));
const blurRadius = maxCS * GRAIN_PX;

if (blurRadius >= 0.5) {
  // ... compute kernel ...
  for (let j = 0; j < layers.length; j++) {
    layerDensities[j] = gaussianBlur2D(layerDensities[j], width, height, kernel);
  }
}

// Pass 2: composite blurred densities
for (let i = 0; i < width * height; i++) {
  // ... DIR, dye absorption, reversal, mask, tint ...
}
```

**Step 3: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): update CPU fallback with per-layer white noise + Gaussian blur"
```

---

### Task 5: Visual tuning and cleanup

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js` (constants only)

**Step 1: Tune GRAIN_PX**

Load test images at various resolutions. Target behavior:
- Velvia (cs=0.15): nearly sharp, grain barely perceptible
- Portra (cs=0.35): mild softening, fine organic grain
- HP5 (cs=0.55): noticeable softening, visible grain clumps
- Tri-X (cs=0.90): clearly soft, heavy grain

If too blurry: decrease GRAIN_PX (try 6-8).
If clumps too small: increase (try 12-15).

**Step 2: Tune amplitude multipliers (1.2 silver, 0.7 dye cloud)**

After blur, effective grain contrast depends on both amplitude and blur radius. Adjust if needed.

**Step 3: Verify density scaling**

Check that the `/4.0` scaling in density shader and `*4.0` in compositing shader preserves density precision. If banding is visible, consider checking for `OES_texture_half_float` extension and using half-float FBO textures when available.

**Step 4: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "feat(grain): tune v3 grain constants"
```

---

### Task 6: Update PRODUCT.md

**Files:**
- Modify: `HTMLPrototype/PRODUCT.md`

Update the following sections:

1. **Architecture diagram** — change from "3-pass pipeline" to "4-pass pipeline":
   ```
   renderer.js --- WebGL GPU path: 4-pass pipeline
        |            Pass 1: Per-layer density + grain noise → FBO (RGB channels)
        |            Pass 2: Horizontal Gaussian blur (per-channel = per-layer)
        |            Pass 3: Vertical Gaussian blur
        |            Pass 4: Compositing (DIR + dye absorption + tint) → screen
   ```

2. **Rendering pipeline items 10-12** — update grain and blur descriptions to reflect per-layer architecture

3. **Design decisions** — update grain engine entry to explain per-layer blur rationale:
   - `blur(composite(A,B)) ≠ composite(blur(A), blur(B))` — nonlinear compositing
   - Channel-parallel trick: RGB channels = per-layer densities
   - Physical correctness: dye cloud diffusion within each layer independently

**Commit:**

```bash
git add HTMLPrototype/PRODUCT.md
git commit -m "docs: update PRODUCT.md for grain engine v3 per-layer blur architecture"
```
