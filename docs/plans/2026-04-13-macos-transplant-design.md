# macOS Transplant Design

## Goal

Port the HTML prototype's film simulation engine to a native macOS app
(FilmSimLab) using SwiftUI + Core Image + Metal Shading Language. Validate
that the rendering pipeline produces identical results to the WebGL prototype.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Formats v1 | JPG + PNG | Standard CGImage decoding. DNG/ProRAW via CIRAWFilter is a stretch goal. |
| Rendering backend | CIKernel (MSL) | Core Image handles color management, tiling, and RAW integration. Metal kernel fits within CIKernel constraints. |
| Architecture | Single Metal kernel, modular Swift wrapper | The GLSL shader is proven — port it as one kernel. Modularity lives in Swift (decode/recipe/pipeline). |
| Grain hash bug | Port GLSL only | The GLSL `jitteredHash` is correct. The JS CPU divergence is irrelevant — nobody uses the CPU fallback. Port the GLSL version to Metal. |
| UI scope | Minimal | Image canvas + template dropdown + sliders. No spectrum, film strip, or develop tab in v1. |

## Project Structure

```
MacPrototype/
├── FilmSimLab.xcodeproj/
├── FilmSimLab/
│   ├── FilmSimLabApp.swift
│   ├── ContentView.swift
│   ├── Assets.xcassets/
│   │
│   ├── Model/
│   │   ├── Recipe.swift             ← Recipe/Layer/GlobalParams structs, Codable
│   │   └── StockTemplates.swift     ← 6 built-in films as static constants
│   │
│   ├── Engine/
│   │   ├── FilmPipeline.swift       ← Orchestrator: decode -> render -> output
│   │   ├── ImageDecoder.swift       ← JPG/PNG via CGImage, DNG stub
│   │   ├── FilmCIFilter.swift       ← CIFilter subclass, packs recipe into kernel args
│   │   └── FilmKernel.metal         ← MSL port of the GLSL film simulation
│   │
│   └── Views/
│       ├── ImageCanvas.swift        ← Rendered image display
│       └── RecipeControls.swift     ← Sliders for layer + global params
```

### Separation of concerns

- **Engine/** has no SwiftUI imports — pure image processing
- **Model/** has no Engine or UI imports — pure data
- **Views/** depends on Model and Engine

## Data Model

```swift
struct Layer: Codable, Identifiable {
    let id: UUID
    var name: String
    var sensitizerPeak: Float    // nm
    var sensitizerBw: Float      // nm
    var dyeHue: Float            // degrees, auto-derived from sensitizerPeak
    var dyePurity: Float         // 0-1
    var dmax: Float
    var hdToe: Float
    var hdGamma: Float
    var hdShoulder: Float
    var crystalSize: Float
}

struct GlobalParams: Codable {
    var reversal: Float          // 0 = C-41, 1 = E-6
    var stackingStrength: Float
    var maskDensity: Float
    var maskHue: Float           // 0-60
    var dirInhibition: Float
    var baseTintR: Float
    var baseTintG: Float
    var baseTintB: Float
}

struct Recipe: Codable, Identifiable {
    let id: UUID
    var name: String
    var layers: [Layer]          // up to 5
    var global: GlobalParams
}
```

Maps 1:1 from the JS recipe object in state.js. `complementHue()` remains a
free function called when `sensitizerPeak` changes.

## Rendering Engine

### Image Decoder

- `CIImage(contentsOf: url)` for JPG/PNG
- `CIRAWFilter` stub for DNG/ProRAW (stretch goal)

### FilmCIFilter

CIFilter subclass that:
1. Loads the Metal kernel from FilmKernel.metal
2. Flattens recipe into kernel arguments (up to 5 layers x 9 params + globals)
3. Returns processed CIImage

### FilmKernel.metal

Direct port of the GLSL fragment shader. Syntax changes:

| GLSL | MSL |
|------|-----|
| `vec2/vec3` | `float2/float3` |
| `texture2D(sampler, uv)` | `sample(src, coord)` |
| `gl_FragCoord` | `destCoord()` |
| `uniform float` | kernel function parameters |
| `fract(sin(x) * 43758)` | identical |

All film simulation math ports unchanged: sRGB linearization, Gaussian
sensitivity, H&D curves, Beer-Lambert absorption, binomial grain model,
dye absorption, negative scan.

### FilmPipeline

Orchestrator that owns a reusable `CIContext` (created once for performance)
and chains decode -> filter -> render.

## Minimal UI (v1)

```
+------------------------------------------+
| FilmSimLab                               |
+---------------------------+--------------+
|                           | Film Stock   |
|                           | [Portra 400] |
|    Rendered Image         |              |
|    (drag-drop to load)    | cyan (L1)    |
|                           |  peak  [===] |
|                           |  bw    [===] |
|                           |  ...         |
|                           |              |
|                           | Global       |
|                           |  reversal    |
|                           |  ...         |
+---------------------------+--------------+
```

- HSplitView: image left, controls right (300px)
- Dropdown for stock template selection
- Sliders for all layer + global params
- Live re-render on slider change via SwiftUI bindings
- No film strip, spectrum, save/load, or develop tab

## What's NOT in v1

- DNG/ProRAW decoding
- Spectrum visualization
- Film strip
- Simple/Pro mode toggle
- Save/load custom recipes
- Develop tab (lab state)
- Undo/redo
- Export

## Success Criteria

Load the same JPG in both the HTML prototype and the macOS app, apply
Portra 400 preset, and compare the output visually. The results should be
perceptually identical (minor floating-point differences acceptable).
