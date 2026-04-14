# Grain Engine v3 — Per-Layer Blur Design

**Date:** 2026-04-13
**Updated:** 2026-04-14
**Status:** Approved
**Supersedes:** `2026-04-13-grain-engine-v2-design.md` (value noise approach — rejected due to grid moiré, no image-grain coupling)

## Problem

The v2 grain engine (cell-based value noise) has three flaws:

1. **Moiré pattern** — value noise interpolates on a regular grid, creating visible repeating blob patterns especially at fine grain scales.
2. **Image-grain decoupling** — grain is overlaid on a perfectly sharp image. Real film grain limits resolving power: coarse grain = soft image, fine grain = sharp image. Currently you can have pixel-sharp edges with heavy grain surrounding them, which is physically impossible.
3. **Incomplete "fine grain"** — `crystalSize` only controls amplitude. Real fine grain means smaller clumps, lower amplitude, AND higher resolving power simultaneously.

## Design Principles — Bottom-Up, Not Top-Down

This engine simulates grain from physical properties, not effect parameters.

- **`crystalSize` is the fundamental parameter** — it is a physical property of
  the emulsion (silver halide crystal diameter in relative units). All grain
  behavior emerges from this single input. Do NOT rename it to "grainIntensity"
  or similar effect-oriented names.
- **Derived behaviors** from `crystalSize`:
  - `N = 1/(cs² + 0.01)` — crystal count per sampling area → noise amplitude
  - `blurRadius = cs * GRAIN_PX` — dye cloud spread → clump size + resolving power
  - `ISO ≈ 25 × (cs/0.05)^1.1` — light gathering → sensitivity (display only)
- **One physical input, four emergent outputs.** The user controls the emulsion
  property; grain roughness, clump size, sharpness, and ISO all follow.

## Real Film Physics

In real film, silver halide crystals (~0.5-2μm) are the image capture elements.
At any practical scan/display resolution, each output pixel covers many crystals.
What we see as "grain" is **statistical density fluctuation** — the binomial
variance in how many crystals developed within each pixel's sampling area. This
is NOT a texture overlay; it is the image formation process itself.

Each emulsion layer has its own crystal population:

- **Per-layer independence**: each layer's dye cloud diffusion happens within that layer before layers are optically combined
- **Nonlinear compositing**: dye absorption compositing is nonlinear — `blur(composite(A,B)) ≠ composite(blur(A), blur(B))`
- **Grain couples to resolution**: crystal size determines both noise amplitude AND resolving power

This means blur must happen **per-layer before compositing**, not after.

## Approach

**Multi-pass: static noise texture + per-layer separable Gaussian blur.** Generate
a random noise texture once per image load (NOT per frame — grain is static once
the emulsion is developed). Each layer reads per-pixel noise from an independent
RGBA channel, modulates amplitude by binomial statistics, then blur converts
pixel-scale noise into organic grain clumps. The per-layer blur simultaneously:
- Converts white noise into organic grain clumps (no grid = no moiré)
- Softens each layer to match its resolving power
- Couples per-layer image sharpness to grain scale
- Preserves physically correct layer independence

## Architecture

### Key Insight: Channel-Parallel Blur

WebGL texture channels (R, G, B) are blurred independently by a Gaussian blur shader. By encoding each layer's density into a separate channel, a single blur pass blurs all layers independently — true per-layer blur without needing N separate blur passes.

- Color film (3 layers): R = layer 0 density, G = layer 1 density, B = layer 2 density
- 4-5 layer films: use RGBA for 4 channels; 5th layer shares A channel (acceptable
  correlation — 5-layer films are exotic edge cases)
- B&W film (1 layer): R = layer 0 density (G, B, A unused)

### Pipeline (4 passes)

```
Image texture → Density shader (per-layer density + grain noise → RGB channels) → FBO A
FBO A → Horizontal Gaussian blur → FBO B
FBO B → Vertical Gaussian blur → FBO A (reuse)
FBO A → Compositing shader (dye absorption + transmittance → final color) → Screen
```

When blur radius < 0.5px (very fine grain), skip blur passes and composite directly from FBO A.

### WebGL Setup

- 2 framebuffer objects (FBO A, FBO B) with RGBA textures at image resolution
- 3 shader programs: `density` (Pass 1), `blur` (Pass 2 & 3), `composite` (Pass 4)
- Original image texture bound as input to density shader
- FBOs created/resized in `setImage()`, reused across renders, destroyed in `destroy()`

### Noise Texture

A static RGBA noise texture at image resolution, generated once in `setImage()`:

```js
_generateNoise(w, h) {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 256) | 0;
  // Upload to GL texture with NEAREST filtering (no interpolation)
}
```

- **Static**: generated once per image load, reused across all renders. Film grain
  does not change when you adjust development sliders — the crystal positions are
  fixed once the emulsion is coated.
- **RGBA channels**: 4 independent noise values per pixel. Layer i reads channel i.
- **NEAREST filtering**: no interpolation — each pixel gets its own independent value.
- **Regenerated** only when image changes or crystal size changes (optional: could
  regenerate on crystal size change to simulate re-coating the emulsion).

### Pass 1: Density Shader (New)

Computes per-layer density with grain noise, outputs as RGB channels.

**Vertex shader:** same fullscreen quad as current.

**Fragment shader logic:**
```glsl
uniform sampler2D uImg;
uniform sampler2D uNoise;  // static noise texture
uniform int uLayerCount;
uniform float uSensPeak[MAX_LAYERS];
uniform float uSensBw[MAX_LAYERS];
uniform float uToe[MAX_LAYERS];
uniform float uGamma[MAX_LAYERS];
uniform float uShoulder[MAX_LAYERS];
uniform float uDmax[MAX_LAYERS];
uniform float uFog[MAX_LAYERS];
uniform float uCrystal[MAX_LAYERS];
uniform float uDyePurity[MAX_LAYERS];

// Read per-layer noise from RGBA channels of noise texture
float layerNoise(int layer) {
  vec4 n = texture2D(uNoise, gl_FragCoord.xy / uImgDim);
  if (layer == 0) return n.r * 2.0 - 1.0;
  if (layer == 1) return n.g * 2.0 - 1.0;
  if (layer == 2) return n.b * 2.0 - 1.0;
  return n.a * 2.0 - 1.0;  // layers 3-4 share this channel
}

void main() {
  // ... spectral sensitivity, H&D curve, fog ...

  // Grain noise injection per layer
  float noise = layerNoise(i);
  float cs = uCrystal[i];          // crystalSize — physical parameter
  float N = 1.0 / (cs * cs + 0.01);
  float p = clamp(density / max(dm, 0.01), 0.0, 1.0);
  float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));
  float amplitude = uDyePurity[i] < 0.01 ? 1.2 : 0.7;
  density += noise * sigma * dm * amplitude;

  // Store density in RGB channel (one channel per layer)
}
```

**Notes:**
- Output is raw density values, NOT color. The dye absorption happens in Pass 4.
- Each channel contains one layer's density with grain baked in.
- Density values can exceed 1.0 — FBO textures should use float/half-float if available, or we clamp and scale.
- The uniform `uCrystal` maps directly to the `crystalSize` property — no scaling.

### Pass 2 & 3: Separable Gaussian Blur

Same shader for both passes, differing only in direction uniform. Operates on all channels independently.

```glsl
uniform sampler2D uInput;
uniform vec2 uDirection;  // (1/w, 0) for H, (0, 1/h) for V
uniform float uRadius;
uniform float uKernel[MAX_SAMPLES];  // MAX_SAMPLES = 16

void main() {
  vec4 sum = texture2D(uInput, vUV) * uKernel[0];
  for (int i = 1; i < MAX_SAMPLES; i++) {
    if (float(i) > uRadius) break;
    vec2 off = uDirection * float(i);
    sum += texture2D(uInput, vUV + off) * uKernel[i];
    sum += texture2D(uInput, vUV - off) * uKernel[i];
  }
  gl_FragColor = sum;
}
```

Because the blur reads and writes all 4 channels, each layer's density is blurred independently. This is mathematically equivalent to running separate blur passes per layer.

### Pass 4: Compositing Shader (New)

Reads blurred per-layer densities and applies dye absorption compositing.

```glsl
uniform sampler2D uDensities;  // blurred density texture
uniform sampler2D uImg;        // original image (for base tint, mask)
uniform int uLayerCount;
// Per-layer dye uniforms
uniform float uDyeHue[MAX_LAYERS];
uniform float uDyePurity[MAX_LAYERS];
uniform float uDmax[MAX_LAYERS];
// Global uniforms
uniform float uReversal;
uniform float uDir;
uniform float uMaskDen;
uniform float uMaskHue;
uniform vec3 uBaseTint;
uniform float uStackStr;

void main() {
  vec4 densityTex = texture2D(uDensities, vUV);
  float densities[3];
  densities[0] = densityTex.r;
  densities[1] = densityTex.g;
  densities[2] = densityTex.b;

  // DIR coupler (inter-layer inhibition)
  // ... operates on blurred densities ...

  // Dye absorption compositing
  vec3 transmittance = vec3(1.0);
  for (int i = 0; i < MAX_LAYERS; i++) {
    if (i >= uLayerCount) break;
    vec3 dyeAbsorption = computeDyeAbsorption(densities[i], uDyeHue[i], uDyePurity[i]);
    transmittance *= exp(-dyeAbsorption);
  }

  // Orange mask, base tint, reversal, etc.
  vec3 color = applyMaskAndTint(transmittance, uMaskDen, uMaskHue, uBaseTint);
  if (uReversal > 0.0) color = applyReversal(color, uReversal);

  gl_FragColor = vec4(color, 1.0);
}
```

### Blur Radius Derivation

One global blur radius per render, derived from the maximum crystal size:

```js
const maxCS = Math.max(...recipe.layers.map(l => l.crystalSize));
const blurRadius = maxCS * GRAIN_PX;  // GRAIN_PX ≈ 8-12, tune visually
```

| Film | crystalSize | blurRadius (GRAIN_PX=10) | Effect |
|------|------------|-------------------------|--------|
| Velvia 50 | 0.15 | 1.5px | Nearly sharp, barely visible grain |
| Gold 200 | 0.22 | 2.2px | Slight softening, fine grain |
| Portra 400 | 0.35 | 3.5px | Moderate softening, visible grain |
| HP5 | 0.55 | 5.5px | Noticeable softening, prominent grain |
| Tri-X | 0.90 | 9.0px | Clearly soft, heavy grain |

### Gaussian Kernel Precomputation

Computed on JS side when blur radius changes, uploaded as uniform array:

```js
const sigma = blurRadius / 2.5;
const kernel = [];
for (let i = 0; i <= Math.ceil(blurRadius); i++) {
  kernel.push(Math.exp(-i*i / (2*sigma*sigma)));
}
const total = kernel[0] + 2 * kernel.slice(1).reduce((a,b) => a+b, 0);
kernel.forEach((v,i) => kernel[i] = v / total);
```

### Silver vs Dye Cloud Differentiation

Differentiation is purely via noise amplitude in Pass 1:

- **Silver (dyePurity < 0.01):** amplitude 1.2, sharp high-contrast noise
- **Dye cloud (dyePurity >= 0.01):** amplitude 0.7, lower-contrast noise

After per-layer blur:
- B&W film (single layer): monochrome grain clumps, no color fringing
- Color film (3 layers with independent seeds): each layer's noise is blurred independently in its own channel → dye absorption in Pass 4 creates subtle color shifts at clump boundaries (matching real color negative grain)

Per-layer blur is critical for color accuracy: if layer 0 has a high-density clump at position (x,y) but layer 1 does not, the dye absorption at that pixel is dominated by layer 0's dye. Post-composite blur would smear the already-composited color, losing this physical behavior.

### Texture Precision

Density values range from 0 to ~3.5 (dmax). With UNSIGNED_BYTE textures (0-255), we need to scale:
- Write: `gl_FragColor = densities / 4.0;` (maps 0-4.0 → 0-1.0)
- Read: `density = texture.r * 4.0;`

If `OES_texture_half_float` is available, use half-float textures for full precision and skip scaling.

### CPU Fallback

- Per-pixel white noise injection at density stage per layer (same as GPU)
- Store per-layer density arrays
- JS Gaussian blur over each layer's density array independently
- Dye absorption compositing on blurred densities
- Same kernel, same radius derivation
- Slow but correct — CPU path is already a no-WebGL fallback

### What This Fixes

1. **Moiré** — no grid. White noise is per-pixel, blur creates organic clumps with no underlying structure.
2. **Image-grain coupling** — the blur softens both noise and image simultaneously. Coarse grain = soft image. Fine grain = sharp image. You cannot have sharp detail surrounded by coarse grain.
3. **Complete "fine grain"** — `crystalSize` now controls amplitude (binomial N), clump size (blur radius), AND resolving power (image softening). All three linked through one parameter.
4. **Per-layer independence** — each layer's grain is blurred independently before compositing. Dye absorption operates on physically correct per-layer density distributions, not smeared composite color.
