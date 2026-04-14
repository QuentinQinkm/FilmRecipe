# macOS RAW / ProRAW Prototype Plan

**Goal:** Design a native Apple-platform prototype that tests the practical image pipeline differences between Bayer RAW, Apple ProRAW, and processed HEIF/JPEG, and identifies how to extract the most usable photographic leverage from the iPhone camera system for Film Recipe.

**Core thesis:** The Mac should be the workstation for inspection, comparison, metadata analysis, recipe prototyping, and export validation. The iPhone should remain the capture engine whenever Apple ProRAW or the full computational photography stack is required.

**Platform truth:** A macOS app can use iPhone via Continuity Camera for high-quality capture, including high-resolution stills, but Apple ProRAW capture is exposed through the iPhone photo pipeline, not as a pure Mac-side replacement for on-device capture. Therefore, the strongest prototype is a **macOS-first analysis app** with either:
- imported captures from iPhone Camera / Files / Photos, or
- a lightweight iPhone capture companion later if we need repeatable ProRAW test capture from within our own stack.

## What We Need To Learn

The prototype should answer these questions:

1. How different are Bayer RAW, Apple ProRAW, and processed HEIF when pushed through a film-style rendering pipeline?
2. Which image data survives best for highlight recovery, white-balance shifts, local contrast shaping, grain, halation, and dense color transforms?
3. Which iPhone capture modes produce the most editable negative for Film Recipe, not merely the best-looking default photo?
4. What metadata from Apple’s stack is stable and useful enough to influence recipe suggestions automatically?
5. Is a Mac-only ingest workflow sufficient, or do we need an iPhone capture companion to unlock the right control surface?

## Product Shape

Working name: **Film Recipe Capture Lab**

The prototype is a small SwiftUI macOS app with three surfaces:

- **Ingest**
  Import Apple ProRAW DNG, Bayer RAW DNG, HEIF/JPEG, and optionally capture a test still from Continuity Camera.
- **Inspect**
  Show image, histogram, clipping map, EXIF / lens / focal-length / ISO / exposure / white-balance metadata, plus side-by-side RAW vs ProRAW vs processed comparisons.
- **Render**
  Apply a minimal Film Recipe transform stack tuned for evaluation rather than beauty:
  - exposure offset
  - white balance / tint
  - tone curve
  - highlight rolloff
  - saturation density
  - grain
  - halation / bloom approximation

The app is not a full editor. It is a measurement tool for deciding where the eventual native product should run capture, processing, and recipe inference.

## Prototype Strategy

### Phase 1: Mac Analysis Workstation

Build the macOS app first. Do not start with a full iPhone capture app.

Why:
- fastest path to comparing real files from multiple iPhone capture modes
- avoids premature UI and camera-control work
- lets us validate whether ProRAW materially improves Film Recipe output before investing in native capture UX

Inputs for Phase 1:
- Apple ProRAW `.dng` from iPhone Pro devices
- standard RAW `.dng` from supported cameras or iPhone apps if available
- processed `.heic` / `.jpg`
- optional Continuity Camera still capture for quick desk testing

Outputs for Phase 1:
- side-by-side render comparisons
- metadata tables
- exportable experiment reports
- decision on whether Phase 2 is necessary

### Phase 2: Controlled Capture Companion

Only build this if Phase 1 shows that imported-file testing is too inconsistent.

This is a minimal iPhone helper app whose job is to:
- shoot a repeatable scene in processed, RAW, and ProRAW modes where supported
- record precise capture parameters
- hand assets to the Mac app via AirDrop, shared container, or file export

This should stay operationally narrow. No editing UI on iPhone.

## Architecture

### macOS App Modules

- `CaptureLabApp`
  SwiftUI app shell, navigation, app state
- `AssetIngest`
  File import, drag-drop, folder sessions, Photos picker later if needed
- `AssetCatalog`
  Groups captures into comparable sets: same scene, different capture mode
- `ImageDecode`
  Core Image / Image I/O decode pipeline for DNG, HEIF, JPEG
- `MetadataInspector`
  EXIF, TIFF, DNG, Maker Apple, lens and device summaries
- `RenderLab`
  Lightweight evaluation pipeline for Film Recipe transforms
- `ComparisonWorkspace`
  Split view, zoom sync, histogram sync, clipping overlays
- `ExperimentLogger`
  Save judgments, notes, and derived metrics per test run

### Recommended Framework Stack

- `SwiftUI` for shell and tooling UI
- `AVFoundation` for optional Continuity Camera still capture
- `Core Image` for RAW decode, preview generation, and controlled processing
- `Image I/O` for metadata extraction and thumbnailing
- `PhotosUI` only if direct library browsing becomes useful

### Why Not Start With Metal

Use Core Image first. The prototype question is about pipeline behavior, not peak rendering throughput. Metal can wait until we know which transforms matter.

## Capture Modes To Test

Every test scene should attempt these variants where hardware permits:

1. Processed HEIF
2. Processed JPEG
3. Apple ProRAW
4. Standard RAW / Bayer RAW
5. Continuity Camera still from Mac

For each mode, record:
- device model
- lens used
- focal length equivalent
- ISO
- shutter
- exposure bias
- white balance / temperature if available
- focus distance if exposed
- whether Night mode / Smart HDR / Deep Fusion style computation is likely involved

## Test Scenes

The prototype should ship with a fixed shot list:

1. High-contrast daylight exterior
2. Indoor tungsten mixed lighting
3. Night street scene with point highlights
4. Portrait with skin and fabric texture
5. Saturated food / product still life
6. Backlit window scene
7. Deep shadow interior with small bright practicals

This matters more than fancy UI. A bad scene matrix produces useless conclusions.

## Evaluation Metrics

The prototype should score each capture set across both measurable and subjective axes.

### Measurable

- clipped highlight percentage
- clipped shadow percentage
- recoverable highlight headroom after exposure pull
- white-balance shift tolerance before color breakup
- noise visibility after shadow lift
- edge acuity after recipe grain and bloom
- file size and decode time

### Subjective

- skin plausibility
- highlight shape quality
- density in saturated colors
- “filmability” of the starting negative
- artifact severity from Apple computational processing

## Key UX Flows

### Flow 1: Compare Imported Assets

1. Drop a folder of captures onto the app.
2. App auto-groups files by scene and timestamp.
3. User chooses a comparison set.
4. App shows ProRAW / RAW / HEIF side-by-side.
5. User applies the same recipe transform to all variants.
6. User marks which source survives best.

### Flow 2: Quick Continuity Camera Check

1. Connect iPhone as Continuity Camera.
2. Capture a high-resolution still from macOS.
3. Compare it against imported iPhone Camera captures from the same scene.
4. Determine whether Mac-side live capture is useful for the final product or just convenient for lab work.

### Flow 3: Stress Test the Pipeline

1. Pick a source image.
2. Apply exposure, white-balance, curve, saturation, and grain stress presets.
3. Generate a report of where each source breaks first.

## What “Maximize the iPhone Camera” Means Here

For this project, “maximize” does not mean exposing every AVFoundation knob.
It means determining the workflow that gives Film Recipe the strongest editable negative.

The prototype should test these hypotheses:

- **ProRAW is the best default source** for recipe-heavy edits because it keeps RAW flexibility while retaining parts of Apple’s computational pipeline.
- **Processed HEIF may still win** for some scenes if Apple’s fusion pipeline produces cleaner local contrast and noise handling than our own stack can recover from RAW.
- **Continuity Camera is useful for preview and capture ergonomics**, but not sufficient as the sole “pro” pipeline if ProRAW is the target.
- **Metadata-aware recipe defaults** may matter as much as capture format choice. Lens, scene brightness, and white balance may be enough to bias recipe suggestions.

## Prototype Scope

### In Scope

- native macOS SwiftUI app
- import of DNG / HEIF / JPEG
- optional Continuity Camera still capture
- side-by-side compare UI
- metadata inspection
- minimal Film Recipe evaluation stack
- experiment logging and export

### Out of Scope

- full production editor
- cloud sync
- LUT marketplace or preset browser
- iPhone editing UI
- full asset library management
- custom RAW demosaic implementation

## Build Plan

### Milestone 1: Ingest + Inspect

Deliver:
- file import
- thumbnail grid
- metadata panel
- full-resolution preview
- histogram and clipping overlays

Exit criteria:
- can reliably open ProRAW DNG, DNG, HEIF, and JPEG from real iPhone captures

### Milestone 2: Comparison Workspace

Deliver:
- side-by-side viewer
- synchronized zoom and pan
- shared transform controls
- per-source difference notes

Exit criteria:
- can compare at least three formats from one scene without manual file wrangling

### Milestone 3: Film Recipe Evaluation Stack

Deliver:
- exposure
- white balance / tint
- tone curve
- density / saturation
- grain
- bloom or halation approximation

Exit criteria:
- enough transform pressure to reveal which source formats collapse first

### Milestone 4: Continuity Camera Probe

Deliver:
- camera discovery
- system-preferred camera support
- still capture
- capture metadata logging

Exit criteria:
- can answer whether Mac-side iPhone capture is strategically useful or a dead end for this product

### Milestone 5: Decision Memo

Deliver:
- recommendation:
  - Mac ingest only
  - Mac + iPhone companion
  - iPhone-first native capture app with Mac analysis tool

Exit criteria:
- clear decision on the next product prototype

## Technical Risks

1. **ProRAW availability is device- and configuration-dependent.**
   The app must treat ProRAW as opportunistic, not guaranteed.

2. **Continuity Camera may mislead product direction.**
   It is valuable for convenience and high-quality capture, but it is not proof that the Mac can replace iPhone-native capture for ProRAW workflows.

3. **Metadata consistency may be weaker than expected.**
   Apple-specific tags can vary across capture paths and tools.

4. **Core Image decode behavior may obscure source differences.**
   We need to log decode settings and keep the render path deterministic.

## Success Criteria

The prototype succeeds if, within one week of use, we can say:

- which source format gives Film Recipe the strongest editable input
- whether Apple ProRAW is worth targeting as the premium path
- whether a Mac-only prototype is enough for the next stage
- whether an iPhone capture companion is required to truly exploit the iPhone camera stack

## Recommended Next Step

Build **Milestone 1 and Milestone 2 only** before doing any iPhone companion work.
If imported ProRAW files already make the answer obvious, we save substantial complexity.

## Apple API Notes

- Apple documents Apple ProRAW support on `AVCapturePhotoOutput`; support depends on current device and configuration, and Apple recommends enabling ProRAW before starting the capture session.
- Apple’s RAW + ProRAW workflow uses `AVCapturePhotoSettings` configured with a RAW pixel format and, optionally, a processed format for RAW+processed capture.
- Apple documents Continuity Camera on macOS as a way to use iPhone as an external capture device and notes support for high-resolution photos and automatic camera selection.
- Apple’s current photo capture docs also call out the Constant Color API as a potentially relevant future experiment for more consistent source material, but that should stay out of the first prototype.

## Sources

- [Capturing photos in RAW and Apple ProRAW formats](https://developer.apple.com/documentation/avfoundation/capturing-photos-in-raw-and-apple-proraw-formats?language=objc)
- [isAppleProRAWSupported](https://developer.apple.com/documentation/avfoundation/avcapturephotooutput/isappleprorawsupported)
- [photoSettingsWithRawPixelFormatType:](https://developer.apple.com/documentation/avfoundation/avcapturephotosettings/init%28rawpixelformattype%3A%29?changes=late_1_5&language=objc)
- [Supporting Continuity Camera in your macOS app](https://developer.apple.com/documentation/avfoundation/supporting-continuity-camera-in-your-macos-app)
- [Bring Continuity Camera to your macOS app (WWDC22)](https://developer.apple.com/videos/play/wwdc2022/10018/)
- [Photo capture](https://developer.apple.com/documentation/avfoundation/photo-capture)
