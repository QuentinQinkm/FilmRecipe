# Mobile UI v2 Design

## Visual Identity

- **Theme:** Acid retro-digital — dark, hard-edged, minimal
- **Accent:** `#C8FF00` (lime green)
- **Surfaces:** `#080808` background, `#111111` cards, `#1A1A1A` inputs
- **Corner radius:** 2px everywhere — no pills, no circles
- **Slider thumbs:** Square 16x16, `#C8FF00` fill
- **Toggle switches:** Square 44x12 track, 16x16 square thumb
- **Typography:** System mono/sans, all-caps labels

## Top Bar

Always visible. Three elements:

| Left | Center | Right |
|------|--------|-------|
| "Film Lab" wordmark | Preset dropdown bar | EXPORT button |

**Preset dropdown bar:** Shows current preset name (e.g. "Portra 400"). Tap to
expand a dropdown panel containing:
- **Stock templates grid** — 2-column grid of 6 built-in presets (Portra 400,
  Ektar 100, Superia 400, HP5 Plus, Tri-X 400, Velvia 50)
- **Saved recipes list** — user-saved presets from localStorage
- **Action buttons:** NEW (reset to defaults) and SAVE AS (name + save current state)

**Dirty indicator:** Small `#C8FF00` dot appears on the preset bar when the current
recipe differs from the saved/stock state. Switching presets silently discards
unsaved changes (no prompt).

## Step-by-Step UX Flow

Three sections: LAYER -> BASE -> DEVELOP. Navigation via floating pills over the
image area.

**Floating pills:** Two buttons float over the bottom of the image:
- Left pill: Current section name (e.g. `[LAYER]`) — tap to expand section picker
- Right pill: `[NEXT ->]` (or `[EXPORT ->]` on Develop) — advances to next section

**Section picker:** Tapping the section name pill expands a vertical stack of three
pills (`LAYER` / `BASE` / `DEVELOP`) floating over the image with a dimmed backdrop.
Tap any to jump directly.

## Image Area

Top ~40% of viewport. Shows the processed photo with floating pills overlaid at
bottom. Upload prompt shown when no image is loaded.

## Section 1: Layer

**Spectrogram:** Appears only in this section. Horizontal spectral bar below the
image showing dye absorption curves for all active layers.

**Compact layer table:** All layers visible at once in a table:

| Column | Content |
|--------|---------|
| PEAK | Sensitizer peak wavelength (nm) |
| BW | Sensitizer bandwidth |
| PURITY | Dye purity |
| DMAX | Maximum density |

**Interactions:**
- **Tap row** to expand inline controls (sliders for all layer parameters: peak,
  bandwidth, dye hue, dye purity, dmax, fog, H-D curve toe/gamma/shoulder, crystal
  size). Tapping another row collapses the current one.
- **Hold + drag grip handle** (triple-bar icon on left edge) to reorder layers
- **Swipe left** to reveal delete button
- **ADD LAYER** button at bottom of table (hidden when at 4-layer cap)

## Section 2: Base

No spectrogram. Slider controls in a scrollable column:

| Control | Type | Range |
|---------|------|-------|
| E-6 Reversal | Toggle | ON/OFF |
| Film Stacking | Slider | 0-10 |
| DIR Coupling | Slider | 0-1 |
| Warmth | Slider | -50 to +50 |
| Scan Exposure | Slider | -2 to +2 |
| Grain Softness | Slider | 0-1 |
| Halation | Slider | 0-1 |
| **Orange Mask** | Collapsible group | |
| -> Mask Density | Slider | 0-0.6 |
| -> Mask Hue | Slider | 0-60 |

**E-6 toggle:** Square track, lime accent when ON, label left-aligned, toggle
right-aligned.

**Orange Mask group:** Collapsed by default. Tap header with chevron to expand.

## Section 3: Develop

Final step. Controls:

| Control | Type | Range |
|---------|------|-------|
| Push/Pull | Slider | -2 to +2 |
| Dev Time Factor | Slider | 0.5-2.0 |
| Agitation | Slider | 0-1 |

**Lab Notes card:** Multiline text input for recipe metadata (processing notes,
batch info). `#C8FF00` accent line at top, `#111` surface. Stored with recipe,
does not affect rendering.

**EXPORT -> pill:** Mirrors the top-bar Export button as a natural end-of-flow
action.

## State Management

- `isDirty` flag tracks whether current recipe differs from saved/stock state
- Dirty dot (`#C8FF00`) appears on preset bar when `isDirty === true`
- Switching presets: silently discard changes, load new preset, clear dirty flag
- Save As: prompt for name, save to localStorage, clear dirty flag
- NEW: reset to default recipe, clear dirty flag
- Layer cap: 4 layers maximum (RGBA channels in density FBO)

## Implementation Approach

Add as a v2 toggle alongside existing UI. CSS media query or JS flag switches
between v1 (current) and v2 (new mobile layout). Shared rendering engine and
state model — only the UI layer changes.
