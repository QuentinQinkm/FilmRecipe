# Mobile UI v2 Design

## Visual Identity

- **Theme:** Acid retro-digital — dark, hard-edged, minimal
- **Accent:** `#C8FF00` (lime green)
- **Surfaces:** `#080808` background, `#111111` cards, `#1A1A1A` inputs
- **Corner radius:** 2px everywhere — no pills, no circles
- **Slider thumbs:** Square 16x16, white fill, drop shadow
- **Toggle switches:** Square 44x14 track, 16x16 square thumb
- **Typography:** Inter, all-caps section headers with letter-spacing

## Mockup Screens (MobileUI.pen)

7 screens in Pencil file, covering all states:

| # | Screen | Purpose |
|---|--------|---------|
| 1 | Layer | Default view — image, spectrogram, compact layer table |
| 2 | Picker | Section picker overlay (LAYER/BASE/DEVELOP) |
| 3 | Base | E-6 toggle, creative sliders, collapsible Orange Mask |
| 4 | Develop | Push/Pull center-notch, lab notes input |
| 5 | Preset Dropdown | Expanded preset selector panel |
| 6 | Layer Expanded | Inline expand — image+spectrogram visible, creative controls |
| 7 | Fullscreen | Photo viewer with zoom controls |

## Top Bar

Always visible. Three elements:

| Left | Center | Right |
|------|--------|-------|
| "FILM LAB" wordmark (accent) | Preset dropdown bar | EXPORT button (accent bg) |

**Preset dropdown bar:** Shows current preset name (e.g. "Portra 400"). Tap to
expand a dropdown panel containing:
- **Stock templates grid** — 2-column grid of 6 built-in presets (Portra 400,
  Ektar 100, Superia 400, HP5 Plus, Tri-X 400, Velvia 50)
- **Saved recipes list** — user-saved presets from localStorage
- **Action buttons:** NEW (reset to defaults) and SAVE AS (name + save current state)

**Dirty indicator:** Small `#C8FF00` dot on the preset bar when recipe differs
from saved/stock state. Switching presets silently discards unsaved changes.

## Image Area

Top ~40% of viewport (shrinks when layer controls are expanded). Features:
- Floating section pills at bottom of image
- **Fullscreen icon** (⛶) in top-right corner — opens fullscreen photo view
- Upload prompt shown when no image loaded

**Fullscreen view:** Photo centered at natural aspect ratio, black background
(no stretching). Controls: minimize button (top-right), zoom −/level/+ bar
(bottom-center). Supports pinch-to-zoom gesture.

## Step-by-Step UX Flow

Three sections: LAYER → BASE → DEVELOP. Navigation via floating pills.

**Floating pills:** Two buttons float over the bottom of the image:
- Left: Current section name — tap to expand section picker
- Right: `NEXT →` (or `EXPORT →` on Develop)

**Section picker:** Vertical stack of LAYER/BASE/DEVELOP pills over dimmed image.

## Section 1: Layer

**Spectrogram:** Read-only on mobile — no interactive drag handles on bell curves.
Shows dye absorption curves for all active layers as a live-updating preview.
LIVE badge indicates real-time updates.

**Compact layer table:** All layers visible at once:

| Element | Content |
|---------|---------|
| ≡ grip | Hold+drag to reorder |
| Color dot | Layer color indicator |
| PEAK | Sensitizer peak (nm) |
| BW | Sensitizer bandwidth |
| PURITY | Dye purity |
| DMAX | Maximum density |

**Interactions:**
- **Tap row** to expand inline controls (NOT a sub-page — image+spectrogram
  remain visible for live feedback). Tapping another row collapses current one.
- **Hold + drag ≡ grip handle** to reorder layers
- **Swipe left** to reveal delete button
- **ADD LAYER** button at bottom (hidden at 4-layer cap)

### Expanded Layer Controls (inline, not a sub-page)

Creative inputs replace boring sliders where possible:

| Parameter | Input Type | Description |
|-----------|-----------|-------------|
| sensitizerPeak | **Spectrum rainbow bar** | Tap/drag on visible-light gradient to pick wavelength |
| sensitizerBw | **Bandwidth drag handles** | White handles on spectrum bar edges define range width |
| dyePurity | **Saturation gradient strip** | Gray→vivid color, visual meaning of purity |
| dmax | **Density gradient strip** | Light→black, visual meaning of max density |
| hdToe/Gamma/Shoulder | **Interactive H&D curve** | One canvas, 3 draggable control points (blue toe, white gamma, orange shoulder) — replaces 3 separate sliders |
| fog | Slider | Small range (0–0.3), simple slider is appropriate |
| crystalSize | **Slider + grain preview + ISO badge** | 48px grain texture preview, fine/coarse labels, ISO readout badge in accent |

## Section 2: Base

No spectrogram. Controls in a scrollable column:

| Control | Input Type | Range | Notes |
|---------|-----------|-------|-------|
| E-6 Reversal | **Toggle** | ON/OFF | Square track, lime accent when ON |
| Stacking Strength | **Stepper** (−/+) | 0–10 integer | Tap buttons, shows count |
| DIR Inhibition | Slider | 0–1 | |
| Base Tint Warmth | **Cool/warm gradient strip** | -1 to +1 | Blue→gray→amber visual |
| Scan Exposure | Slider | 1.0–6.0 | |
| Grain Softness | Slider | 0.5–3.0 | |
| Halation | Slider | 0–1 | |
| **Orange Mask** | Collapsible group | | Chevron ▼, collapsed by default |
| → Mask Density | Slider | 0–1 | |
| → Mask Hue | **Orange gradient strip** | 0–60° | Hue-shifted orange tones |

## Section 3: Develop

| Control | Input Type | Range | Notes |
|---------|-----------|-------|-------|
| Push/Pull | **Center-notched slider** | -2 to +2 | Center marker at 0, PULL/PUSH labels at edges |
| Dev Time Factor | Slider | 0.5–2.0 | |
| Agitation | Slider | 0–1 | |

**Lab Notes card:** `#C8FF00` accent line at top, "LAB NOTES" header,
multiline text input (`#111` surface, placeholder: "Processing notes, batch
info..."). Stored with recipe, does not affect rendering.

**EXPORT → pill:** Mirrors top-bar Export as end-of-flow action.

## State Management

- `isDirty` flag tracks recipe changes vs saved/stock state
- Dirty dot (`#C8FF00`) on preset bar when `isDirty === true`
- Switching presets: silently discard changes, load new preset, clear dirty
- Save As: prompt for name, save to localStorage, clear dirty
- NEW: reset to default recipe, clear dirty
- Layer cap: 4 layers maximum (RGBA channels in density FBO)

## Implementation Approach

Add as a v2 toggle alongside existing UI. CSS media query or JS flag switches
between v1 (current) and v2 (new mobile layout). Shared rendering engine and
state model — only the UI layer changes.

## Open / In-Progress

- UI refinement ongoing — continue in next session using MobileUI.pen
- Pencil mockups are the source of truth for visual design
- This doc captures decisions and interaction patterns
