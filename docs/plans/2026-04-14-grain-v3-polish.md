# Grain Engine v3 — Polish, Fixes & Features

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship all remaining fixes (compile safety, memory opt) and new features (image export, scan exposure slider, base tint warmth, halation) for the v3 grain engine.

**Architecture:** Incremental additions to the existing 4-pass WebGL pipeline. New uniforms get plumbed through the same path: `state.js` definition → `tabs.js` UI → `renderer.js` GPU+CPU. Halation adds a 5th pass (large-radius blur on bright pixels). All work on `feature/grain-engine-v3` branch in `.worktrees/grain-v3/`.

**Tech Stack:** Vanilla JS, WebGL 1.0, ES modules, no bundler.

---

## Task 0: Commit Current Work

All moderate+ fixes from the prior session are already implemented but uncommitted.

**Files (modified):**
- `HTMLPrototype/src/engine/renderer.js` — B&W fog subtraction, destroy(), cpuOnly, shared GLSL, MAX_LAYERS=4
- `HTMLPrototype/src/ui/tabs.js` — layer cap 4
- `HTMLPrototype/PRODUCT.md` — updated docs

**Step 1: Stage and commit**

```bash
cd /Users/kuangmingqin/Desktop/Personal/Project/FilmRecipe/.worktrees/grain-v3
git add HTMLPrototype/src/engine/renderer.js HTMLPrototype/src/ui/tabs.js HTMLPrototype/PRODUCT.md
git commit -m "fix: B&W fog subtraction, destroy(), MAX_LAYERS=4, shared GLSL

- B&W scan path now subtracts fog floor: maps [fog, dmax] → [0, 1]
- Color neg scan path subtracts fog-only OD (scanner calibration)
- Added destroy() method for GPU resource cleanup
- Constructor accepts cpuOnly flag; renderFilmCPU uses it
- Extracted GLSL_LN10 and GLSL_DYE_ABS shared constants
- Capped MAX_LAYERS to 4 (matches RGBA channel count)
- Updated PRODUCT.md with fog subtraction and correlated noise docs"
```

---

## Task 1: `_compile()` Null-Safety

**Problem:** `_compile()` (renderer.js:432-441) logs shader compile errors but still returns the broken shader object. `_linkProgram()` then tries to link with a bad shader — the resulting program may silently produce wrong output or crash.

**Files:**
- Modify: `HTMLPrototype/src/engine/renderer.js:432-441`

**Step 1: Fix `_compile` to return null on failure**

```js
_compile(type, src) {
  const gl = this.gl;
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
```

**Step 2: Guard `_linkProgram` against null shaders**

```js
_linkProgram(vs, fs) {
  if (!vs || !fs) return null;
  // ... rest unchanged
}
```

**Step 3: Verify**

Open browser, check console has no shader errors. Test Portra 400 + Tri-X render normally.

**Step 4: Commit**

```bash
git add HTMLPrototype/src/engine/renderer.js
git commit -m "fix: _compile() returns null on shader failure, _linkProgram guards null inputs"
```

---

## Task 2: Image Export Button

**Problem:** No way to save the rendered output. Essential for any photo editing tool.

**Files:**
- Modify: `HTMLPrototype/index.html` — add export button in topbar
- Modify: `HTMLPrototype/src/main.js` — wire up download handler
- Modify: `HTMLPrototype/styles/main.css` — style the button (if needed)

**Step 1: Add export button to HTML**

In `index.html`, inside `.topbar-right`, add before the Save button:

```html
<button class="topbar-btn" id="export-btn" title="Download image">Export</button>
```

**Step 2: Wire up the export handler in main.js**

Add after the `canvasUI` initialization (after line 68):

```js
// Export / Download
document.getElementById('export-btn').addEventListener('click', () => {
  if (!canvasUI.hasImage) return;
  const templateName = (state.currentTemplate || 'filmlab').replace(/\s+/g, '-').toLowerCase();
  outputCanvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
});
```

**Step 3: Verify**

Load an image, render with Portra 400, click Export → should download a PNG.

**Step 4: Commit**

```bash
git add HTMLPrototype/index.html HTMLPrototype/src/main.js
git commit -m "feat: add image export button — downloads rendered canvas as PNG"
```

---

## Task 3: Scan Exposure / Paper Grade Slider

**Problem:** `scanExp` is hardcoded to 3.0 in both the GPU composite shader (line 282) and CPU fallback (line 836). Users can't control scanning contrast. Real scanners let you choose paper grade (soft to hard).

**Files:**
- Modify: `HTMLPrototype/src/state.js` — add `scanExposure` to GLOBAL_CONTROLS and templates
- Modify: `HTMLPrototype/src/engine/renderer.js` — make scanExp a uniform in GPU, parameter in CPU
- Modify: `HTMLPrototype/src/ui/tabs.js` — include in Base tab (already uses GLOBAL_CONTROLS)

### Step 1: Add `scanExposure` to state.js

Add to GLOBAL_CONTROLS array (after `baseTintB`):

```js
['scanExposure', 'Paper grade', 'Scan exposure', '', 1.0, 6.0, 0.1, 1],
```

Add `scanExposure: 3.0` to every template's `global` object and to `BLANK_RECIPE.global`.

### Step 2: Add uniform to GPU composite shader

In the composite shader uniforms section (renderer.js, after `uniform vec3 uBaseTint;`):

```glsl
uniform float uScanExp;
```

Replace the hardcoded `float scanExp = 3.0;` with `float scanExp = uScanExp;` in the color negative scan path (line 282).

Also add `uScanExp` to the B&W non-raw scan path. Currently B&W scan maps to `[0,1]` linearly. With scanExp we can add contrast:

```glsl
// In B&W scan path, after computing lum:
lum = 1.0 - exp(-lum * uScanExp) / (1.0 - exp(-uScanExp));
```

Wait — this changes the B&W behavior. Let's keep it simple: only apply scanExp to color negatives for now (matching real-world: paper grade is a color printing concept; B&W has its own analog — paper grades 0-5 — but that's a separate feature). So only wire it for color neg scan path.

### Step 3: Upload uniform in _renderGL

In the composite pass uniform upload section (after line 654), add:

```js
gl.uniform1f(this.compU.uScanExp, g.scanExposure ?? 3.0);
```

Add `'uScanExp'` to the compU uniform location list (line 406):

```js
for (const n of ['uDensities','uImg','uPassthrough','uReversal','uRaw','uLayerCount','uDir','uMaskDen','uMaskHue','uBaseTint','uScanExp']) {
```

### Step 4: Update CPU fallback

In `_renderCPU` (line 836), change:

```js
const scanExp = 3.0;
```

to:

```js
const scanExp = g.scanExposure ?? 3.0;
```

### Step 5: Verify

Load image with Gold 200, adjust Scan exposure slider from 1.0 to 6.0 — should see scanning contrast change from flat to punchy.

### Step 6: Commit

```bash
git add HTMLPrototype/src/state.js HTMLPrototype/src/engine/renderer.js HTMLPrototype/src/ui/tabs.js
git commit -m "feat: add scan exposure (paper grade) slider — replaces hardcoded scanExp=3.0"
```

---

## Task 4: Base Tint Warmth Slider

**Problem:** Base tint is 3 raw RGB sliders (baseTintR/G/B), unintuitive for users. Should be a single "warmth" control that tilts R↑ B↓ (warm) or R↓ B↑ (cool).

**Design:** Replace 3 RGB sliders with 1 warmth slider (-1.0 = cool/blue, 0 = neutral, +1.0 = warm/amber). Derive RGB from warmth:
- `R = 1.0 + warmth * 0.06`
- `G = 1.0`
- `B = 1.0 - warmth * 0.12`

This gives a 0.8-1.06 range for R and 0.88-1.0 range for B, matching the current template values well.

**Files:**
- Modify: `HTMLPrototype/src/state.js` — replace `baseTintR/G/B` in GLOBAL_CONTROLS with `baseTintWarmth`, add conversion function, update templates
- Modify: `HTMLPrototype/src/engine/renderer.js` — compute baseTint RGB from warmth in both GPU and CPU paths
- Modify: `HTMLPrototype/src/ui/tabs.js` — no changes needed (uses GLOBAL_CONTROLS dynamically)

### Step 1: Update state.js

Replace the three baseTint lines in `GLOBAL_CONTROLS`:

```js
['baseTintR', 'Base warmth (Red)', 'Base tint R', '', 0.8, 1, 0.01, 2],
['baseTintG', 'Base warmth (Green)', 'Base tint G', '', 0.8, 1, 0.01, 2],
['baseTintB', 'Base warmth (Blue)', 'Base tint B', '', 0.8, 1, 0.01, 2],
```

With:

```js
['baseTintWarmth', 'Base warmth', 'Base tint warmth', '', -1, 1, 0.01, 2],
```

Add a conversion function (exported):

```js
export function warmthToTint(warmth) {
  return {
    r: 1.0 + warmth * 0.06,
    g: 1.0,
    b: 1.0 - warmth * 0.12,
  };
}
```

Update every template's `global` — replace `baseTintR/G/B` with `baseTintWarmth`:
- Portra 400: `baseTintWarmth: 0.5` (was R=1.0, G=0.97, B=0.94 → warmth≈0.5)
- Gold 200: `baseTintWarmth: 1.0` (was R=1.0, G=0.95, B=0.88 → warmth≈1.0)
- Velvia 50: `baseTintWarmth: -0.08` (was R=0.99, G=0.99, B=1.0 → cool)
- Kodachrome 64: `baseTintWarmth: 0.33` (was R=1.0, G=0.98, B=0.96)
- HP5: `baseTintWarmth: 0` (was all 1.0)
- Tri-X: `baseTintWarmth: 0.08` (was R=0.99, G=0.99, B=0.98)
- BLANK_RECIPE: `baseTintWarmth: 0.5` (was R=1.0, G=0.97, B=0.94)

### Step 2: Update renderer.js GPU path

In `_renderGL`, where `uBaseTint` is uploaded (line 654), change:

```js
gl.uniform3f(this.compU.uBaseTint, g.baseTintR, g.baseTintG, g.baseTintB);
```

to:

```js
import { warmthToTint } from '../state.js';
// ... in _renderGL:
const tint = warmthToTint(g.baseTintWarmth ?? 0);
gl.uniform3f(this.compU.uBaseTint, tint.r, tint.g, tint.b);
```

Wait — renderer.js doesn't import from state.js currently. Better to inline the warmth→RGB calculation to avoid a circular dependency:

```js
const w = g.baseTintWarmth ?? 0;
gl.uniform3f(this.compU.uBaseTint, 1.0 + w * 0.06, 1.0, 1.0 - w * 0.12);
```

### Step 3: Update renderer.js CPU path

In `_renderCPU`, where baseTint is used (around lines 811-813 and 853):

Replace all references to `g.baseTintR`, `g.baseTintG`, `g.baseTintB` with warmth-derived values. At the top of `_renderCPU`, add:

```js
const tw = g.baseTintWarmth ?? 0;
const baseTintR = 1.0 + tw * 0.06;
const baseTintG = 1.0;
const baseTintB = 1.0 - tw * 0.12;
```

Then use `baseTintR/G/B` locals throughout.

### Step 4: Verify

Load Portra 400, go to Base tab, drag warmth slider — image should shift from cool blue to warm amber.

### Step 5: Commit

```bash
git add HTMLPrototype/src/state.js HTMLPrototype/src/engine/renderer.js
git commit -m "feat: replace 3 RGB base tint sliders with single warmth control"
```

---

## Task 5: Halation Effect

**Problem:** Real film has halation — bright highlights scatter light through the film base, creating a warm red glow around high-intensity areas. This is one of the most recognizable film characteristics (especially on Portra, Cinestill 800T).

**Design:** Add a halation pass after the main composite. Steps:
1. Extract a "bright mask" from the composited image (pixels above a threshold)
2. Blur the mask with a large radius
3. Blend back additively with a warm tint

This is implemented as a post-process in the composite shader — no extra FBO pass needed. We blend in the composite shader itself by sampling the unblurred image, thresholding, and adding a pre-blurred version.

Actually, proper halation needs a separate blur pass. The simplest approach: add a 2-pass halation blur (H+V) using an additional FBO, after the main composite renders to a temp FBO instead of screen. Total passes become: density → blur H → blur V → composite → halation H → halation V → final blend. That's 7 passes — too many.

**Simpler approach:** Do halation in the composite shader itself using the density texture. Bright areas = low density (for negatives) or high density (for positives). We can approximate halation by applying a secondary large-radius blur to the density texture and blending it as a warm glow. But we only have one blur pass with one radius.

**Pragmatic approach:** Skip the real-time halation for now. Instead, implement a CPU-side halation that works on the composited result. This is fine for preview quality and avoids GPU pipeline complexity.

Actually, the most practical approach that avoids pipeline changes:

**Post-composite CPU halation:** After GPU composite renders to canvas, read back pixels, apply CPU halation, write back. This is slow for real-time but we can make it toggleable.

**Better: Shader-based halation with existing FBOs.** We have 2 FBOs (A and B). After the 4-pass pipeline renders the composite to screen, we can:
1. Render composite to FBO B instead of screen
2. Use the blur shader to H-blur FBO B → FBO A (large radius, only bright pixels — use threshold in shader)
3. V-blur FBO A → FBO B
4. Final blend shader: combine original composite (FBO B from step 1... wait, we overwrote it)

This gets complicated. Let's use **3 FBOs** — add FBO C for halation. Or, simpler: render composite to FBO B, threshold+blur H to FBO A, blur V to screen while also sampling FBO B for the base image.

**Implementation plan:**

New uniforms: `uHalation` (strength 0-1), `uHalationRadius` (blur radius in px, e.g. 10-40), `uHalationTint` (RGB color, warm red-orange).

New shader: `HALATION_BLEND_FRAG_SRC` — simple blend:
```glsl
uniform sampler2D uScene;     // full composite
uniform sampler2D uBloom;     // blurred bright-only
uniform float uHalation;
uniform vec3 uHalationTint;
void main() {
  vec3 scene = texture2D(uScene, vUV).rgb;
  vec3 bloom = texture2D(uBloom, vUV).rgb;
  vec3 out3 = scene + bloom * uHalation * uHalationTint;
  gl_FragColor = vec4(clamp(out3, 0.0, 1.0), 1.0);
}
```

New shader: `THRESHOLD_FRAG_SRC` — extract bright pixels:
```glsl
uniform sampler2D uInput;
uniform float uThreshold;
void main() {
  vec3 c = texture2D(uInput, vUV).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float mask = smoothstep(uThreshold, uThreshold + 0.1, lum);
  gl_FragColor = vec4(c * mask, 1.0);
}
```

Pipeline changes to `_renderGL`:
1. Pass 1-3: density → blur H → blur V (unchanged, result in FBO A)
2. Pass 4: composite FBO A → FBO B (instead of screen) — need third FBO (FBO C) to hold composite while we reuse A+B for halation blur
3. Actually we need FBO C. Add `this.fboC`.
4. Pass 4: composite → FBO C
5. Pass 5: threshold FBO C → FBO A
6. Pass 6: halation H-blur FBO A → FBO B (reusing blur shader with larger radius)
7. Pass 7: halation V-blur FBO B → FBO A
8. Pass 8: blend FBO C (scene) + FBO A (bloom) → screen

That's 8 passes but the blur/threshold passes are lightweight.

**However**, this is a significant feature. Let's implement it but keep the scope manageable.

**Files:**
- Modify: `HTMLPrototype/src/state.js` — add `halation` to GLOBAL_CONTROLS and templates
- Modify: `HTMLPrototype/src/engine/renderer.js` — add threshold + blend shaders, FBO C, halation passes
- Modify: `HTMLPrototype/src/ui/tabs.js` — no changes (uses GLOBAL_CONTROLS)

### Step 1: Add halation controls to state.js

Add to GLOBAL_CONTROLS (after `scanExposure`):

```js
['halation', 'Halation glow', 'Halation strength', '', 0, 1, 0.01, 2],
```

Add `halation: 0` to all template globals (0 = off by default). Set non-zero for Portra/Gold:
- Portra 400: `halation: 0.25`
- Gold 200: `halation: 0.20`
- All others: `halation: 0`

### Step 2: Add threshold and blend shaders to renderer.js

After `COMPOSITE_FRAG_SRC`, add:

```js
const THRESHOLD_FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uInput;
uniform float uThreshold;
void main() {
  vec3 c = texture2D(uInput, vUV).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float mask = smoothstep(uThreshold, uThreshold + 0.15, lum);
  gl_FragColor = vec4(c * mask, 1.0);
}`;

const HALATION_BLEND_FRAG_SRC = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uStrength;
void main() {
  vec3 scene = texture2D(uScene, vUV).rgb;
  vec3 bloom = texture2D(uBloom, vUV).rgb;
  // Warm tint — halation scatters through the red-sensitive anti-halation layer
  vec3 tint = vec3(1.0, 0.6, 0.3);
  vec3 out3 = scene + bloom * uStrength * tint;
  gl_FragColor = vec4(min(out3, vec3(1.0)), 1.0);
}`;
```

### Step 3: Initialize halation shaders and FBO C in _initGL

After compProg creation, add:

```js
this.threshProg = this._linkProgram(vs, this._compile(gl.FRAGMENT_SHADER, THRESHOLD_FRAG_SRC));
this.blendProg = this._linkProgram(vs, this._compile(gl.FRAGMENT_SHADER, HALATION_BLEND_FRAG_SRC));

// Threshold uniforms
this.threshU = {
  uInput: gl.getUniformLocation(this.threshProg, 'uInput'),
  uThreshold: gl.getUniformLocation(this.threshProg, 'uThreshold'),
};

// Blend uniforms
this.blendU = {
  uScene: gl.getUniformLocation(this.blendProg, 'uScene'),
  uBloom: gl.getUniformLocation(this.blendProg, 'uBloom'),
  uStrength: gl.getUniformLocation(this.blendProg, 'uStrength'),
};
```

### Step 4: Add FBO C in _ensureFBOs

Add `this.fboC` alongside fboA and fboB — same creation logic.

### Step 5: Modify _renderGL for halation passes

After the existing Pass 4 composite, add conditional halation:

```js
const halationStr = g.halation ?? 0;
if (halationStr > 0.001 && this.fboC) {
  // Pass 4 was: composite → screen. Change to composite → FBO C.
  // Then add halation passes.
  // ... (see implementation)
}
```

This requires changing Pass 4 target from screen to FBO C when halation is active, then:
- Pass 5: threshold FBO C → FBO A
- Pass 6: H-blur FBO A → FBO B (radius = 20px)
- Pass 7: V-blur FBO B → FBO A
- Pass 8: blend FBO C + FBO A → screen

When halation is 0, skip — composite renders directly to screen (existing behavior).

### Step 6: Update destroy() to clean up new resources

Add `this.fboC`, `this.threshProg`, `this.blendProg` to the destroy() method.

### Step 7: CPU halation fallback

In `_renderCPU`, after compositing, if `g.halation > 0`:
1. Extract bright pixels above threshold
2. Apply Gaussian blur (radius ~20px)
3. Blend back additively with warm tint

### Step 8: Verify

Load Portra 400 (halation=0.25), check for warm glow around bright highlights. Set halation=0 — glow disappears.

### Step 9: Commit

```bash
git add HTMLPrototype/src/state.js HTMLPrototype/src/engine/renderer.js
git commit -m "feat: halation effect — warm highlight glow via threshold+blur+blend pipeline"
```

---

## Task 6: Update Design Doc

**Problem:** `docs/plans/2026-04-13-grain-engine-v3-design.md` is stale: says GRAIN_PX=10, independent noise, MAX_LAYERS=5, skip blur when <0.5px.

**Files:**
- Modify: `docs/plans/2026-04-13-grain-engine-v3-design.md`

### Step 1: Update design doc

Key changes:
- GRAIN_PX = 3 (was 10)
- Correlated noise: GRAIN_CHROMA=0.25 (was independent channels)
- MAX_LAYERS = 4 (was 5)
- Minimum blur floor 0.5px (was "skip blur when <0.5px")
- Fog floor subtraction in scan path
- Add halation, scan exposure, warmth slider descriptions
- Add destroy() and cpuOnly notes

### Step 2: Commit

```bash
git add docs/plans/2026-04-13-grain-engine-v3-design.md
git commit -m "docs: update v3 design doc to match implementation"
```

---

## Deferred / Out of Scope

These features were discussed but deferred to a future iteration:

1. **Per-layer blur radii** — requires N separate blur passes instead of 1. Significant GPU pipeline rework. Currently all layers share the max crystal size for blur radius. Could be a v4 feature.

2. **Reciprocity failure** — per-layer exposure correction for long/short durations. Requires an exposure time input and per-layer correction curves. Film science feature — defer to after UX basics are solid.

3. **CPU blur memory optimization** — allocates 6 temp Float32Arrays at image resolution. Could reuse buffers. Low priority since CPU path is the fallback, not the primary render path.

---

## Execution Order

| # | Task | Type | Est. |
|---|------|------|------|
| 0 | Commit current fixes | housekeeping | 1 min |
| 1 | `_compile()` null-safety | bug fix | 3 min |
| 2 | Image export button | feature | 5 min |
| 3 | Scan exposure slider | feature | 10 min |
| 4 | Base tint warmth | feature | 10 min |
| 5 | Halation effect | feature | 25 min |
| 6 | Update design doc | docs | 5 min |
