# macOS Film Simulation Engine Transplant — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the HTML prototype's film simulation engine to a native macOS app using SwiftUI + Core Image CIKernel.

**Architecture:** Single Metal kernel (ported from GLSL) wrapped in a CIFilter, orchestrated by a Swift pipeline. Modular Swift layer handles image decoding and recipe data. Minimal SwiftUI UI for validation.

**Tech Stack:** Swift, SwiftUI, Core Image, Metal Shading Language, Xcode

**Reference:** Design doc at `docs/plans/2026-04-13-macos-transplant-design.md`, GLSL source at `HTMLPrototype/src/engine/renderer.js`, recipe data at `HTMLPrototype/src/state.js`

---

### Task 1: Data Model — Recipe structs

**Files:**
- Create: `MacPrototype/FilmSimLab/Model/Recipe.swift`

**Step 1: Create Recipe.swift with Layer, GlobalParams, and Recipe structs**

```swift
import Foundation

struct Layer: Codable, Identifiable {
    let id: UUID
    var name: String
    var sensitizerPeak: Float
    var sensitizerBw: Float
    var dyeHue: Float
    var dyePurity: Float
    var dmax: Float
    var hdToe: Float
    var hdGamma: Float
    var hdShoulder: Float
    var crystalSize: Float

    init(
        name: String,
        sensitizerPeak: Float,
        sensitizerBw: Float,
        dyeHue: Float,
        dyePurity: Float,
        dmax: Float,
        hdToe: Float,
        hdGamma: Float,
        hdShoulder: Float,
        crystalSize: Float
    ) {
        self.id = UUID()
        self.name = name
        self.sensitizerPeak = sensitizerPeak
        self.sensitizerBw = sensitizerBw
        self.dyeHue = dyeHue
        self.dyePurity = dyePurity
        self.dmax = dmax
        self.hdToe = hdToe
        self.hdGamma = hdGamma
        self.hdShoulder = hdShoulder
        self.crystalSize = crystalSize
    }
}

struct GlobalParams: Codable {
    var reversal: Float
    var stackingStrength: Float
    var maskDensity: Float
    var maskHue: Float
    var dirInhibition: Float
    var baseTintR: Float
    var baseTintG: Float
    var baseTintB: Float
}

struct Recipe: Codable, Identifiable {
    let id: UUID
    var name: String
    var layers: [Layer]
    var global: GlobalParams

    init(name: String, layers: [Layer], global: GlobalParams) {
        self.id = UUID()
        self.name = name
        self.layers = layers
        self.global = global
    }
}
```

**Step 2: Add complementHue() function**

Port from `HTMLPrototype/src/state.js:172-191`. Add to the same file:

```swift
/// Compute complementary dye hue from sensitizer wavelength.
/// Red-sensitive (620nm) -> cyan dye, green (540nm) -> magenta, blue (440nm) -> yellow.
func complementHue(wavelength wl: Float) -> Float {
    let stops: [(Float, Float)] = [
        (380, 270), (440, 235), (490, 180), (540, 120),
        (580, 40), (620, 15), (700, 0),
    ]
    var h: Float
    if wl <= stops[0].0 {
        h = stops[0].1
    } else if wl >= stops[stops.count - 1].0 {
        h = stops[stops.count - 1].1
    } else {
        h = stops[0].1
        for i in 0..<(stops.count - 1) {
            if wl >= stops[i].0 && wl <= stops[i + 1].0 {
                let t = (wl - stops[i].0) / (stops[i + 1].0 - stops[i].0)
                h = stops[i].1 + (stops[i + 1].1 - stops[i].1) * t
                break
            }
        }
    }
    return Float(Int(h.rounded()) + 180) .truncatingRemainder(dividingBy: 360)
}
```

**Step 3: Build to verify it compiles**

Run: Cmd+B in Xcode, or `xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build`
Expected: BUILD SUCCEEDED

**Step 4: Commit**

```bash
git add MacPrototype/FilmSimLab/Model/Recipe.swift
git commit -m "feat: add Recipe data model with Layer, GlobalParams, complementHue"
```

---

### Task 2: Stock Templates

**Files:**
- Create: `MacPrototype/FilmSimLab/Model/StockTemplates.swift`

**Step 1: Create StockTemplates.swift**

Port all 6 templates from `HTMLPrototype/src/state.js:17-62`:

```swift
import Foundation

enum StockTemplates {
    static let all: [Recipe] = [portra400, gold200, velvia50, kodachrome64, ilfordHP5, kodakTriX]

    static let portra400 = Recipe(
        name: "Portra 400",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 620, sensitizerBw: 80, dyeHue: 185, dyePurity: 0.70, dmax: 2.1, hdToe: 0.22, hdGamma: 0.68, hdShoulder: 0.18, crystalSize: 0.35),
            Layer(name: "magenta", sensitizerPeak: 540, sensitizerBw: 90, dyeHue: 320, dyePurity: 0.75, dmax: 2.0, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30),
            Layer(name: "yellow", sensitizerPeak: 440, sensitizerBw: 70, dyeHue: 55, dyePurity: 0.80, dmax: 2.2, hdToe: 0.18, hdGamma: 0.72, hdShoulder: 0.12, crystalSize: 0.28),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0.42, maskHue: 28, dirInhibition: 0.35, baseTintR: 1.0, baseTintG: 0.97, baseTintB: 0.94)
    )

    static let gold200 = Recipe(
        name: "Gold 200",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 615, sensitizerBw: 95, dyeHue: 190, dyePurity: 0.65, dmax: 2.3, hdToe: 0.15, hdGamma: 0.80, hdShoulder: 0.15, crystalSize: 0.25),
            Layer(name: "magenta", sensitizerPeak: 545, sensitizerBw: 100, dyeHue: 330, dyePurity: 0.72, dmax: 2.1, hdToe: 0.14, hdGamma: 0.82, hdShoulder: 0.14, crystalSize: 0.22),
            Layer(name: "yellow", sensitizerPeak: 445, sensitizerBw: 75, dyeHue: 48, dyePurity: 0.85, dmax: 2.4, hdToe: 0.12, hdGamma: 0.85, hdShoulder: 0.12, crystalSize: 0.20),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0.50, maskHue: 32, dirInhibition: 0.25, baseTintR: 1.0, baseTintG: 0.95, baseTintB: 0.88)
    )

    static let velvia50 = Recipe(
        name: "Velvia 50",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 630, sensitizerBw: 65, dyeHue: 195, dyePurity: 0.92, dmax: 2.8, hdToe: 0.35, hdGamma: 1.60, hdShoulder: 0.20, crystalSize: 0.15),
            Layer(name: "magenta", sensitizerPeak: 535, sensitizerBw: 70, dyeHue: 310, dyePurity: 0.90, dmax: 2.7, hdToe: 0.38, hdGamma: 1.65, hdShoulder: 0.18, crystalSize: 0.14),
            Layer(name: "yellow", sensitizerPeak: 430, sensitizerBw: 65, dyeHue: 58, dyePurity: 0.88, dmax: 2.6, hdToe: 0.32, hdGamma: 1.55, hdShoulder: 0.22, crystalSize: 0.13),
        ],
        global: GlobalParams(reversal: 1, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0.60, baseTintR: 0.99, baseTintG: 0.99, baseTintB: 1.0)
    )

    static let kodachrome64 = Recipe(
        name: "Kodachrome 64",
        layers: [
            Layer(name: "cyan", sensitizerPeak: 625, sensitizerBw: 70, dyeHue: 200, dyePurity: 0.88, dmax: 2.5, hdToe: 0.28, hdGamma: 1.30, hdShoulder: 0.18, crystalSize: 0.18),
            Layer(name: "magenta", sensitizerPeak: 545, sensitizerBw: 75, dyeHue: 350, dyePurity: 0.85, dmax: 2.4, hdToe: 0.25, hdGamma: 1.35, hdShoulder: 0.15, crystalSize: 0.17),
            Layer(name: "yellow", sensitizerPeak: 440, sensitizerBw: 68, dyeHue: 50, dyePurity: 0.90, dmax: 2.6, hdToe: 0.22, hdGamma: 1.40, hdShoulder: 0.14, crystalSize: 0.16),
        ],
        global: GlobalParams(reversal: 1, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0.50, baseTintR: 1.0, baseTintG: 0.98, baseTintB: 0.96)
    )

    static let ilfordHP5 = Recipe(
        name: "Ilford HP5",
        layers: [
            Layer(name: "panchromatic", sensitizerPeak: 550, sensitizerBw: 150, dyeHue: 0, dyePurity: 0, dmax: 1.20, hdToe: 0.20, hdGamma: 0.78, hdShoulder: 0.15, crystalSize: 0.55),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0, baseTintR: 1.0, baseTintG: 1.0, baseTintB: 1.0)
    )

    static let kodakTriX = Recipe(
        name: "Kodak Tri-X",
        layers: [
            Layer(name: "panchromatic", sensitizerPeak: 560, sensitizerBw: 140, dyeHue: 0, dyePurity: 0, dmax: 1.55, hdToe: 0.30, hdGamma: 1.05, hdShoulder: 0.18, crystalSize: 0.90),
        ],
        global: GlobalParams(reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0, baseTintR: 0.99, baseTintG: 0.99, baseTintB: 0.98)
    )
}
```

**Step 2: Build to verify**

Run: `xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add MacPrototype/FilmSimLab/Model/StockTemplates.swift
git commit -m "feat: add 6 stock film templates (Portra, Gold, Velvia, Kodachrome, HP5, Tri-X)"
```

---

### Task 3: Metal Kernel — Film Simulation Shader

**Files:**
- Create: `MacPrototype/FilmSimLab/Engine/FilmKernel.metal`

**Step 1: Create FilmKernel.metal**

Port the GLSL fragment shader from `HTMLPrototype/src/engine/renderer.js:1-244` to Metal Shading Language. This is a CIKernel written as a `coreimage` Metal function.

Key syntax changes from GLSL to MSL:
- `vec2/vec3/vec4` -> `float2/float3/float4`
- `texture2D()` -> `src.sample(coord)`  
- `gl_FragCoord` -> `destCoord()`
- `uniform` -> kernel function parameters
- `fract()` -> `fract()`  (same)
- `mod()` -> `fmod()`
- GLSL `if/else if` chains work the same
- Add `#include <CoreImage/CoreImage.h>` header
- Use `extern "C"` linkage for the kernel function

```metal
#include <CoreImage/CoreImage.h>
using namespace metal;

// --- Constants ---
constant float3 CH = float3(625.0, 540.0, 450.0);
constant float LN10 = 2.302585;
constant int MAX_LAYERS = 5;

// --- sRGB linearization ---
float s2l(float c) {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

float l2s(float c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(max(c, 0.0), 1.0/2.4) - 0.055;
}

// --- Spectral sensitivity (Gaussian) ---
float sens(float ch, float pk, float bw) {
    float sigma = bw / 2.355;
    float d = (ch - pk) / sigma;
    return exp(-0.5 * d * d);
}

// --- H&D characteristic curve ---
float hd(float ex, float toe, float gam, float sho, float dm) {
    float t = clamp(ex, 0.0, 1.0);
    float linRange = max(1.0 - toe - sho, 0.01);
    float effRange = max(1.0 - toe * 0.5 - sho * 0.5, 0.01);
    float slope = gam * dm / effRange;
    float den;
    if (t <= toe && toe > 0.001) {
        float r = t / toe;
        den = slope * toe * 0.5 * r * r;
    } else if (t >= 1.0 - sho && sho > 0.001) {
        float denStart = slope * (toe * 0.5 + linRange);
        float s = (t - (1.0 - sho)) / sho;
        den = denStart + slope * sho * 0.5 * (2.0 * s - s * s);
    } else {
        den = slope * (toe * 0.5 + (t - toe));
    }
    return clamp(den, 0.0, dm);
}

// --- Dye absorption vector ---
float3 dyeAbs(float hue, float pur) {
    float ah = fmod(hue + 180.0, 360.0) / 60.0;
    float x = 1.0 - abs(fmod(ah, 2.0) - 1.0);
    float3 c;
    if      (ah < 1.0) c = float3(1.0, x,   0.0);
    else if (ah < 2.0) c = float3(x,   1.0, 0.0);
    else if (ah < 3.0) c = float3(0.0, 1.0, x  );
    else if (ah < 4.0) c = float3(0.0, x,   1.0);
    else if (ah < 5.0) c = float3(x,   0.0, 1.0);
    else               c = float3(1.0, 0.0, x  );
    return c * pur;
}

// --- Grain model ---
float hash2(float2 p) {
    float h = dot(p, float2(127.1, 311.7));
    return fract(sin(h) * 43758.5453);
}

float jitteredHash(float2 pos, float scale, float seed) {
    float2 cell = floor(pos / scale);
    float2 cellId = cell + float2(seed);
    float jx = hash2(cellId * 1.73 + float2(37.8, 92.1));
    float jy = hash2(cellId * 2.31 + float2(64.3, 18.7));
    float2 jittered = cell + float2(jx, jy);
    return hash2(jittered + float2(seed)) * 2.0 - 1.0;
}

float crystalNoise(float2 pos, float cs, float seed) {
    float scale1 = max(1.5, cs * 5.0);
    float scale2 = max(1.0, cs * 2.5);
    float n1 = jitteredHash(pos, scale1, seed);
    float n2 = jitteredHash(pos, scale2, seed + 500.0);
    return n1 * 0.7 + n2 * 0.3;
}

float layerGrain(float2 pos, float cs, float density, float dm, float seed) {
    float noise = crystalNoise(pos, cs, seed);
    float N = 1.0 / (cs * cs + 0.01);
    float p = clamp(density / max(dm, 0.01), 0.0, 1.0);
    float sigma = sqrt(p * (1.0 - p) / max(N, 0.1));
    return noise * sigma * dm * 1.2;
}

// --- Main kernel ---
// CIKernel functions receive layer data packed into float arrays passed as
// individual arguments (CIKernel does not support array parameters).
// We use 5 float4 vectors to pack layer data efficiently:
//   peaks_bws:   [peak0, bw0, peak1, bw1]  (layers 0-1)
//   peaks_bws2:  [peak2, bw2, peak3, bw3]  (layers 2-3)
//   peak_bw4:    [peak4, bw4, 0, 0]        (layer 4)
//   toes_gammas:  [toe0, gam0, toe1, gam1]
//   toes_gammas2: [toe2, gam2, toe3, gam3]
//   toe_gam4:     [toe4, gam4, 0, 0]
//   shos_dmaxs:   [sho0, dmax0, sho1, dmax1]
//   shos_dmaxs2:  [sho2, dmax2, sho3, dmax3]
//   sho_dmax4:    [sho4, dmax4, 0, 0]
//   hues_purs:    [hue0, pur0, hue1, pur1]
//   hues_purs2:   [hue2, pur2, hue3, pur3]
//   hue_pur4:     [hue4, pur4, 0, 0]
//   crystals:     [cs0, cs1, cs2, cs3]
//   crystal4:     [cs4, 0, 0, 0]
//
// This packing is done in FilmCIFilter.swift.

extern "C" float4 filmSimulation(
    coreimage::sample_t src,
    float2 coord,
    // Layer data packed into float4 vectors
    float4 peaks_bws,
    float4 peaks_bws2,
    float4 peak_bw4,
    float4 toes_gammas,
    float4 toes_gammas2,
    float4 toe_gam4,
    float4 shos_dmaxs,
    float4 shos_dmaxs2,
    float4 sho_dmax4,
    float4 hues_purs,
    float4 hues_purs2,
    float4 hue_pur4,
    float4 crystals,
    float4 crystal4,
    // Global params
    float reversal,
    float raw,
    float layerCount,
    float dir,
    float maskDen,
    float maskHue,
    float3 baseTint,
    float stackStr,
    coreimage::destination dest
) {
    // Unpack layer arrays from float4 vectors
    float sensPeak[5];
    float sensBw[5];
    float hdToe[5];
    float hdGamma[5];
    float hdShoulder[5];
    float dmax[5];
    float dyeHue[5];
    float dyePurity[5];
    float crystal[5];

    sensPeak[0] = peaks_bws.x;  sensBw[0] = peaks_bws.y;
    sensPeak[1] = peaks_bws.z;  sensBw[1] = peaks_bws.w;
    sensPeak[2] = peaks_bws2.x; sensBw[2] = peaks_bws2.y;
    sensPeak[3] = peaks_bws2.z; sensBw[3] = peaks_bws2.w;
    sensPeak[4] = peak_bw4.x;   sensBw[4] = peak_bw4.y;

    hdToe[0] = toes_gammas.x;    hdGamma[0] = toes_gammas.y;
    hdToe[1] = toes_gammas.z;    hdGamma[1] = toes_gammas.w;
    hdToe[2] = toes_gammas2.x;   hdGamma[2] = toes_gammas2.y;
    hdToe[3] = toes_gammas2.z;   hdGamma[3] = toes_gammas2.w;
    hdToe[4] = toe_gam4.x;      hdGamma[4] = toe_gam4.y;

    hdShoulder[0] = shos_dmaxs.x;  dmax[0] = shos_dmaxs.y;
    hdShoulder[1] = shos_dmaxs.z;  dmax[1] = shos_dmaxs.w;
    hdShoulder[2] = shos_dmaxs2.x; dmax[2] = shos_dmaxs2.y;
    hdShoulder[3] = shos_dmaxs2.z; dmax[3] = shos_dmaxs2.w;
    hdShoulder[4] = sho_dmax4.x;   dmax[4] = sho_dmax4.y;

    dyeHue[0] = hues_purs.x;    dyePurity[0] = hues_purs.y;
    dyeHue[1] = hues_purs.z;    dyePurity[1] = hues_purs.w;
    dyeHue[2] = hues_purs2.x;   dyePurity[2] = hues_purs2.y;
    dyeHue[3] = hues_purs2.z;   dyePurity[3] = hues_purs2.w;
    dyeHue[4] = hue_pur4.x;     dyePurity[4] = hue_pur4.y;

    crystal[0] = crystals.x; crystal[1] = crystals.y;
    crystal[2] = crystals.z; crystal[3] = crystals.w;
    crystal[4] = crystal4.x;

    int nLayers = int(layerCount);
    float2 fragCoord = dest.coord();

    // Linearize input
    float3 lin = float3(s2l(src.r), s2l(src.g), s2l(src.b));

    // Detect B&W
    bool isBW = true;
    for (int i = 0; i < 5; i++) {
        if (i >= nLayers) break;
        if (dyePurity[i] >= 0.01) { isBW = false; break; }
    }
    bool isPos = !isBW && reversal > 0.5;
    bool isNeg = !isBW && reversal < 0.5;
    float3 out3;

    float seeds[5] = {0.0, 73.156, 191.329, 347.718, 521.437};

    if (isBW) {
        float3 w = float3(sens(CH.x, sensPeak[0], sensBw[0]),
                          sens(CH.y, sensPeak[0], sensBw[0]),
                          sens(CH.z, sensPeak[0], sensBw[0]));
        float exposure = dot(lin, w) / max(dot(w, float3(1.0)), 0.001);
        float den = hd(exposure, hdToe[0], hdGamma[0], hdShoulder[0], 2.5);
        den = clamp(den + layerGrain(fragCoord, crystal[0], den, 2.5, seeds[0]), 0.0, 2.5);
        float lum = raw > 0.5 ? 1.0 - den / 2.5 : den / 2.5;
        lum = clamp(lum, 0.0, 1.0);
        out3 = float3(lum) * baseTint;
    } else {
        float dn[5];
        float3 avail = lin;

        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            float3 w = float3(sens(CH.x, sensPeak[i], sensBw[i]),
                              sens(CH.y, sensPeak[i], sensBw[i]),
                              sens(CH.z, sensPeak[i], sensBw[i]));
            float e = dot(avail, w) / max(dot(w, float3(1.0)), 0.001);
            float d = hd(e, hdToe[i], hdGamma[i], hdShoulder[i], dmax[i]);
            d = clamp(d + layerGrain(fragCoord, crystal[i], d, dmax[i], seeds[i]), 0.0, dmax[i]);
            dn[i] = d;

            if (stackStr > 0.0) {
                float3 sa = dyeAbs(dyeHue[i], dyePurity[i]) * d;
                avail *= mix(float3(1.0), exp(-sa * LN10), stackStr);
            }
        }

        if (isPos) {
            for (int i = 0; i < 5; i++) {
                if (i >= nLayers) break;
                dn[i] = dmax[i] - dn[i];
            }
        }

        float totalDenSum = 0.0;
        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            totalDenSum += dn[i];
        }
        float d2[5];
        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            float inh = totalDenSum - dn[i];
            d2[i] = max(0.0, dn[i] - dir * inh * 0.15);
        }

        float3 totalOD = float3(0.0);
        for (int i = 0; i < 5; i++) {
            if (i >= nLayers) break;
            float3 da = dyeAbs(dyeHue[i], dyePurity[i]);
            totalOD += da * d2[i];
        }

        if (isNeg && raw < 0.5) {
            float scanExp = 3.0;
            out3 = float3(1.0) - exp(-totalOD * scanExp);
        } else if (isNeg) {
            float mh = clamp(maskHue / 60.0, 0.0, 1.0);
            float3 maskOD = float3(maskDen * mix(0.65, 0.45, mh),
                                   maskDen * mix(0.15, 0.40, mh),
                                   maskDen * mix(0.05, 0.10, mh));
            out3 = exp(-(totalOD + maskOD) * LN10);
        } else {
            out3 = exp(-totalOD * LN10);
        }

        out3 *= baseTint;
    }

    return float4(l2s(out3.r), l2s(out3.g), l2s(out3.b), 1.0);
}
```

**Step 2: Ensure the .metal file is added to the Xcode project's Compile Sources**

The file must be in the target's build phase. When creating via Xcode "New File" or adding to the project, this happens automatically. If adding manually, update `project.pbxproj`.

**Step 3: Build to verify shader compiles**

Run: `xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build`
Expected: BUILD SUCCEEDED (Metal compiler validates syntax at build time)

**Step 4: Commit**

```bash
git add MacPrototype/FilmSimLab/Engine/FilmKernel.metal
git commit -m "feat: add Metal kernel — film simulation shader ported from GLSL"
```

---

### Task 4: CIFilter Wrapper

**Files:**
- Create: `MacPrototype/FilmSimLab/Engine/FilmCIFilter.swift`

**Step 1: Create FilmCIFilter.swift**

```swift
import CoreImage

class FilmCIFilter: CIFilter {
    var inputImage: CIImage?
    var recipe: Recipe?
    var rawMode: Bool = false

    private static var kernel: CIKernel? = {
        guard let url = Bundle.main.url(forResource: "default", withExtension: "metallib"),
              let data = try? Data(contentsOf: url) else {
            print("Failed to load Metal library")
            return nil
        }
        return try? CIKernel(functionName: "filmSimulation", fromMetalLibraryData: data)
    }()

    override var outputImage: CIImage? {
        guard let input = inputImage, let recipe = recipe, let kernel = Self.kernel else {
            return inputImage
        }

        let layers = recipe.layers
        let n = min(layers.count, 5)
        let g = recipe.global

        // Helper to safely get layer property or default
        func lp(_ idx: Int, _ prop: (Layer) -> Float, _ def: Float) -> Float {
            idx < n ? prop(layers[idx]) : def
        }

        // Pack layer data into float4 vectors for the kernel
        let peaks_bws = CIVector(x: CGFloat(lp(0, \.sensitizerPeak, 550)), y: CGFloat(lp(0, \.sensitizerBw, 100)),
                                 z: CGFloat(lp(1, \.sensitizerPeak, 550)), w: CGFloat(lp(1, \.sensitizerBw, 100)))
        let peaks_bws2 = CIVector(x: CGFloat(lp(2, \.sensitizerPeak, 550)), y: CGFloat(lp(2, \.sensitizerBw, 100)),
                                  z: CGFloat(lp(3, \.sensitizerPeak, 550)), w: CGFloat(lp(3, \.sensitizerBw, 100)))
        let peak_bw4 = CIVector(x: CGFloat(lp(4, \.sensitizerPeak, 550)), y: CGFloat(lp(4, \.sensitizerBw, 100)), z: 0, w: 0)

        let toes_gammas = CIVector(x: CGFloat(lp(0, \.hdToe, 0.2)), y: CGFloat(lp(0, \.hdGamma, 0.7)),
                                   z: CGFloat(lp(1, \.hdToe, 0.2)), w: CGFloat(lp(1, \.hdGamma, 0.7)))
        let toes_gammas2 = CIVector(x: CGFloat(lp(2, \.hdToe, 0.2)), y: CGFloat(lp(2, \.hdGamma, 0.7)),
                                    z: CGFloat(lp(3, \.hdToe, 0.2)), w: CGFloat(lp(3, \.hdGamma, 0.7)))
        let toe_gam4 = CIVector(x: CGFloat(lp(4, \.hdToe, 0.2)), y: CGFloat(lp(4, \.hdGamma, 0.7)), z: 0, w: 0)

        let shos_dmaxs = CIVector(x: CGFloat(lp(0, \.hdShoulder, 0.15)), y: CGFloat(lp(0, \.dmax, 2.0)),
                                  z: CGFloat(lp(1, \.hdShoulder, 0.15)), w: CGFloat(lp(1, \.dmax, 2.0)))
        let shos_dmaxs2 = CIVector(x: CGFloat(lp(2, \.hdShoulder, 0.15)), y: CGFloat(lp(2, \.dmax, 2.0)),
                                   z: CGFloat(lp(3, \.hdShoulder, 0.15)), w: CGFloat(lp(3, \.dmax, 2.0)))
        let sho_dmax4 = CIVector(x: CGFloat(lp(4, \.hdShoulder, 0.15)), y: CGFloat(lp(4, \.dmax, 2.0)), z: 0, w: 0)

        let hues_purs = CIVector(x: CGFloat(lp(0, \.dyeHue, 0)), y: CGFloat(lp(0, \.dyePurity, 0)),
                                 z: CGFloat(lp(1, \.dyeHue, 0)), w: CGFloat(lp(1, \.dyePurity, 0)))
        let hues_purs2 = CIVector(x: CGFloat(lp(2, \.dyeHue, 0)), y: CGFloat(lp(2, \.dyePurity, 0)),
                                  z: CGFloat(lp(3, \.dyeHue, 0)), w: CGFloat(lp(3, \.dyePurity, 0)))
        let hue_pur4 = CIVector(x: CGFloat(lp(4, \.dyeHue, 0)), y: CGFloat(lp(4, \.dyePurity, 0)), z: 0, w: 0)

        let crystalsVec = CIVector(x: CGFloat(lp(0, \.crystalSize, 0.3)), y: CGFloat(lp(1, \.crystalSize, 0.3)),
                                   z: CGFloat(lp(2, \.crystalSize, 0.3)), w: CGFloat(lp(3, \.crystalSize, 0.3)))
        let crystal4Vec = CIVector(x: CGFloat(lp(4, \.crystalSize, 0.3)), y: 0, z: 0, w: 0)

        let baseTintVec = CIVector(x: CGFloat(g.baseTintR), y: CGFloat(g.baseTintG), z: CGFloat(g.baseTintB))

        return kernel.apply(
            extent: input.extent,
            roiCallback: { _, rect in rect },
            arguments: [
                input,
                peaks_bws, peaks_bws2, peak_bw4,
                toes_gammas, toes_gammas2, toe_gam4,
                shos_dmaxs, shos_dmaxs2, sho_dmax4,
                hues_purs, hues_purs2, hue_pur4,
                crystalsVec, crystal4Vec,
                g.reversal,
                rawMode ? Float(1) : Float(0),
                Float(n),
                g.dirInhibition,
                g.maskDensity,
                g.maskHue,
                baseTintVec,
                g.stackingStrength,
            ]
        )
    }
}
```

**Step 2: Build to verify**

Run: `xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add MacPrototype/FilmSimLab/Engine/FilmCIFilter.swift
git commit -m "feat: add FilmCIFilter — CIFilter wrapper packing recipe into Metal kernel args"
```

---

### Task 5: Image Decoder + Pipeline

**Files:**
- Create: `MacPrototype/FilmSimLab/Engine/ImageDecoder.swift`
- Create: `MacPrototype/FilmSimLab/Engine/FilmPipeline.swift`

**Step 1: Create ImageDecoder.swift**

```swift
import CoreImage

struct ImageDecoder {
    /// Decode JPG/PNG from a file URL
    static func decode(url: URL) -> CIImage? {
        return CIImage(contentsOf: url)
    }

    /// Decode RAW/DNG (stretch goal — stub)
    static func decodeRAW(url: URL) -> CIImage? {
        // TODO: Implement with CIRAWFilter for ProRAW/DNG support
        return nil
    }
}
```

**Step 2: Create FilmPipeline.swift**

```swift
import CoreImage
import CoreGraphics

class FilmPipeline {
    private let filter = FilmCIFilter()
    let context = CIContext(options: [.useSoftwareRenderer: false])

    func process(image: CIImage, recipe: Recipe, rawMode: Bool = false) -> CIImage? {
        filter.inputImage = image
        filter.recipe = recipe
        filter.rawMode = rawMode
        return filter.outputImage
    }

    func renderToCGImage(image: CIImage, recipe: Recipe, rawMode: Bool = false) -> CGImage? {
        guard let output = process(image: image, recipe: recipe, rawMode: rawMode) else {
            return nil
        }
        return context.createCGImage(output, from: output.extent)
    }
}
```

**Step 3: Build to verify**

Run: `xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build`
Expected: BUILD SUCCEEDED

**Step 4: Commit**

```bash
git add MacPrototype/FilmSimLab/Engine/ImageDecoder.swift MacPrototype/FilmSimLab/Engine/FilmPipeline.swift
git commit -m "feat: add ImageDecoder and FilmPipeline orchestrator"
```

---

### Task 6: Minimal UI — Image Canvas

**Files:**
- Create: `MacPrototype/FilmSimLab/Views/ImageCanvas.swift`

**Step 1: Create ImageCanvas.swift**

An NSViewRepresentable that displays the processed CIImage:

```swift
import SwiftUI
import CoreImage

struct ImageCanvas: NSViewRepresentable {
    let sourceImage: CIImage?
    let recipe: Recipe
    var rawMode: Bool = false

    private let pipeline = FilmPipeline()

    func makeNSView(context: Context) -> NSImageView {
        let view = NSImageView()
        view.imageScaling = .scaleProportionallyUpOrDown
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.black.cgColor
        return view
    }

    func updateNSView(_ nsView: NSImageView, context: Context) {
        guard let source = sourceImage else {
            nsView.image = nil
            return
        }
        guard let cgImage = pipeline.renderToCGImage(image: source, recipe: recipe, rawMode: rawMode) else {
            nsView.image = nil
            return
        }
        nsView.image = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
    }
}
```

**Step 2: Build to verify**

Run: `xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add MacPrototype/FilmSimLab/Views/ImageCanvas.swift
git commit -m "feat: add ImageCanvas view for rendered image display"
```

---

### Task 7: Minimal UI — Recipe Controls + Content View

**Files:**
- Create: `MacPrototype/FilmSimLab/Views/RecipeControls.swift`
- Modify: `MacPrototype/FilmSimLab/ContentView.swift`

**Step 1: Create RecipeControls.swift**

```swift
import SwiftUI

struct LayerControls: View {
    @Binding var layer: Layer
    let index: Int

    var body: some View {
        Section("Layer \(index + 1): \(layer.name)") {
            SliderRow(label: "Sensitivity", value: $layer.sensitizerPeak, range: 380...700, format: "%.0f nm")
            SliderRow(label: "Bandwidth", value: $layer.sensitizerBw, range: 30...200, format: "%.0f nm")
            SliderRow(label: "Dye Purity", value: $layer.dyePurity, range: 0...1, format: "%.2f")
            SliderRow(label: "Dmax", value: $layer.dmax, range: 0.05...3.5, format: "%.2f")
            SliderRow(label: "Toe", value: $layer.hdToe, range: 0...0.5, format: "%.2f")
            SliderRow(label: "Gamma", value: $layer.hdGamma, range: 0.3...3.0, format: "%.2f")
            SliderRow(label: "Shoulder", value: $layer.hdShoulder, range: 0...0.5, format: "%.2f")
            SliderRow(label: "Crystal Size", value: $layer.crystalSize, range: 0.05...2.0, format: "%.2f")
        }
    }
}

struct GlobalControls: View {
    @Binding var global: GlobalParams

    var body: some View {
        Section("Global") {
            SliderRow(label: "Reversal", value: $global.reversal, range: 0...1, step: 1, format: "%.0f")
            SliderRow(label: "Stacking", value: $global.stackingStrength, range: 0...1, format: "%.2f")
            SliderRow(label: "DIR", value: $global.dirInhibition, range: 0...1, format: "%.2f")
            SliderRow(label: "Mask Density", value: $global.maskDensity, range: 0...1, format: "%.2f")
            SliderRow(label: "Mask Hue", value: $global.maskHue, range: 0...60, format: "%.0f")
            SliderRow(label: "Tint R", value: $global.baseTintR, range: 0.8...1.0, format: "%.2f")
            SliderRow(label: "Tint G", value: $global.baseTintG, range: 0.8...1.0, format: "%.2f")
            SliderRow(label: "Tint B", value: $global.baseTintB, range: 0.8...1.0, format: "%.2f")
        }
    }
}

struct SliderRow: View {
    let label: String
    @Binding var value: Float
    let range: ClosedRange<Float>
    var step: Float? = nil
    let format: String

    var body: some View {
        HStack {
            Text(label)
                .frame(width: 100, alignment: .leading)
            Slider(value: $value, in: range, step: step ?? ((range.upperBound - range.lowerBound) / 200))
            Text(String(format: format, value))
                .frame(width: 60, alignment: .trailing)
                .monospacedDigit()
        }
    }
}
```

**Step 2: Replace ContentView.swift**

```swift
import SwiftUI
import CoreImage
import UniformTypeIdentifiers

struct ContentView: View {
    @State private var sourceImage: CIImage?
    @State private var recipe: Recipe = StockTemplates.portra400
    @State private var selectedTemplate: String = "Portra 400"
    @State private var isDragOver = false

    var body: some View {
        HSplitView {
            // Image canvas
            ZStack {
                Color.black
                if sourceImage != nil {
                    ImageCanvas(sourceImage: sourceImage, recipe: recipe)
                } else {
                    Text("Drop an image here\nor click to open")
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .onDrop(of: [.fileURL], isTargeted: $isDragOver) { providers in
                loadDrop(providers: providers)
            }
            .onTapGesture { openFile() }
            .frame(minWidth: 400, minHeight: 300)

            // Controls sidebar
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Film Stock", selection: $selectedTemplate) {
                        ForEach(StockTemplates.all) { template in
                            Text(template.name).tag(template.name)
                        }
                    }
                    .onChange(of: selectedTemplate) { _, newValue in
                        if let t = StockTemplates.all.first(where: { $0.name == newValue }) {
                            recipe = t
                        }
                    }

                    ForEach(recipe.layers.indices, id: \.self) { i in
                        LayerControls(layer: $recipe.layers[i], index: i)
                    }

                    GlobalControls(global: $recipe.global)
                }
                .padding()
            }
            .frame(width: 320)
        }
        .frame(minWidth: 800, minHeight: 500)
    }

    private func openFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.jpeg, .png]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            sourceImage = ImageDecoder.decode(url: url)
        }
    }

    private func loadDrop(providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else { return false }
        provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
            guard let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) else { return }
            DispatchQueue.main.async {
                sourceImage = ImageDecoder.decode(url: url)
            }
        }
        return true
    }
}
```

**Step 3: Build and run**

Run: `xcodebuild -project MacPrototype/FilmSimLab.xcodeproj -scheme FilmSimLab build`
Expected: BUILD SUCCEEDED

Then run the app, drop a JPG, select different templates, drag sliders.

**Step 4: Commit**

```bash
git add MacPrototype/FilmSimLab/Views/RecipeControls.swift MacPrototype/FilmSimLab/ContentView.swift
git commit -m "feat: add minimal UI — template picker, layer/global sliders, drag-drop image loading"
```

---

### Task 8: Wire Up Xcode Project File References

**Note:** Tasks 1-7 create new files and directories (`Model/`, `Engine/`, `Views/`) that must be registered in the Xcode project. There are two approaches:

**Option A (recommended):** Open Xcode, right-click the `FilmSimLab` group, "Add Files to FilmSimLab...", select each new file. Xcode updates `project.pbxproj` automatically.

**Option B:** Manually edit `project.pbxproj` to add PBXFileReference, PBXBuildFile, and PBXGroup entries for each new file. This is error-prone and not recommended.

**For each task above**, after creating the file, add it to the Xcode project before building. The `xcodebuild` command will fail if files aren't registered in the project.

**Step 1: Verify all files are in the project**

Open `MacPrototype/FilmSimLab.xcodeproj` in Xcode and confirm these files appear in the navigator:
- `Model/Recipe.swift`
- `Model/StockTemplates.swift`
- `Engine/FilmKernel.metal`
- `Engine/FilmCIFilter.swift`
- `Engine/ImageDecoder.swift`
- `Engine/FilmPipeline.swift`
- `Views/ImageCanvas.swift`
- `Views/RecipeControls.swift`
- `ContentView.swift` (already exists, modified)

**Step 2: Build and run full app**

Run: Cmd+R in Xcode
Expected: App launches, shows drop zone, loads image, renders with film simulation

**Step 3: Visual validation**

Open the same JPG in the HTML prototype (localhost:8765) with Portra 400. Compare side-by-side with the macOS app. Results should be perceptually identical.

**Step 4: Final commit**

```bash
git add -A MacPrototype/
git commit -m "feat: wire up Xcode project references for all new files"
```
