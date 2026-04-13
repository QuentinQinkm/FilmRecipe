# Touch-First UI Redesign — Design Document

## Summary

Rebuild the Film Lab UI layer with a mobile/touch-first editor-app layout. Image fills
the top ~55% of the screen, a persistent film stock strip sits below it, and a tabbed
bottom tray holds all controls. The rendering engine (renderer.js, state.js) is preserved
unchanged. The UI files (panel.js, topbar.js, canvas.js, spectrum.js, main.js, index.html,
main.css) and the lab-mapping.js indirection layer are replaced.

## Key Architectural Change: No More Stock vs Custom Mode

Every film is a recipe. Stock presets are just pre-loaded data — selecting one clones it
into the working recipe, fully editable. There is no `customMode` boolean, no
`labBaseRecipe`, and no indirect "Lab Step 1" controls (spectral bias, dye character, etc.).

- `lab-mapping.js` is removed entirely
- Users edit per-layer parameters directly (they're film engineers)
- **Save** overwrites the current user-saved recipe
- **Save As** prompts for a name, creates a new entry
- Stock templates are read-only sources — edits create a fork, not a mutation

The Development tab controls (temperature, time, agitation) remain as physically
meaningful global modifiers that act on the working recipe via a simplified mapping
function inlined in state.js or a thin helper.

## Layout Shell (Mobile — 375×812)

```
┌──────────────────────────┐
│  Film Lab          [Pro] │  Topbar: 44px, fixed
├──────────────────────────┤
│                          │
│     Image Canvas         │  Fills space between topbar
│     (edge-to-edge)       │  and film strip. Tap to upload
│                          │  if no image loaded.
│          [Raw] [Ref]     │  Floating pills, bottom-right
├──────────────────────────┤
│ Portra│Gold│Velvia│...   │  Film strip: 48px, horizontal scroll
├──────────────────────────┤
│                          │
│  Active tab content      │  Scrollable, max 42vh
│                          │
├──────────────────────────┤
│  Film │ Layers │Base│Dev │  Tab bar: 50px + safe-area
└──────────────────────────┘
```

### Desktop (768px+)

On desktop, the layout shifts to a row: image on the right (~60% width), controls as a
fixed-width sidebar on the left (360px). The tab bar becomes a vertical tab rail on the
left edge of the sidebar. Film strip sits above the image.

### Topbar

- Wordmark "Film Lab" left-aligned
- Simple/Pro toggle right-aligned (pill toggle)
- No Save button in topbar (lives in Film tab)
- No Upload button in topbar (tap image area or use action in Film tab)

### Image Area

- No visible upload zone box. When no image is loaded, the dark area shows a subtle
  centered icon + "Tap to load a photo" text. Tapping anywhere triggers file picker.
- Drag-drop works on desktop.
- Raw and Reference buttons are floating semi-transparent pills in the bottom-right
  corner of the image area.
- Image scales to fit (object-fit: contain) with dark letterboxing.

### Film Strip

- Persistent horizontal scroll row between image and tab content
- Chips for each stock template: Portra 400, Gold 200, Velvia 50, Kodachrome 64,
  Ilford HP5, Kodak Tri-X
- Separator dots between negative/positive/bw groups
- User-saved films after a separator, each with a small × delete affordance
- "+ New" chip at the end
- Active chip is highlighted. Tapping a stock clones it into the working recipe.
- Horizontal momentum scroll with -webkit-overflow-scrolling: touch

## Tab Bar

4 tabs, always visible: **Film** | **Layers** | **Base** | **Develop**

Each tab has a small icon + label. Active tab is highlighted. Tab content area scrolls
vertically within the max-height tray.

On mobile, the tab bar sits at the bottom with safe-area padding for notched devices.
On desktop, tabs are at the top of the sidebar panel.

## Tab 1: Film

The identity tab — what film are you working with?

### Contents

1. **Film type segmented control**: Negative | Positive | B&W
   - Switching type converts the recipe (same logic as current switchStockFilmType/
     switchCustomFilmType, unified into one function)

2. **Spectrum canvas** (always editable)
   - Same interactive spectrum from spectrum.js: bell curves, pointers, drag handles
   - Taller in this tab (~140px) since it's the hero editing surface
   - Tap a pointer → bottom-sheet popup with sliders for peak, bandwidth, density,
     dye color, purity, contrast
   - touch-action: none on the canvas

3. **Action row**
   - `[Save]` — overwrites current recipe (disabled for stock presets)
   - `[Save As]` — name prompt, saves as new
   - `[Upload Photo]` — secondary action, text button

## Tab 2: Layers

Per-layer parameter editing with progressive disclosure.

### Contents

For each layer (scrollable list):

```
● Cyan (Layer 1)                    [▲] [▼] [×]
├─ Tone          ────●────────   0.50
├─ Reversal      ●────────────   0.00
├─ Grain         ───●─────────   0.30
└─ ▸ H&D Curve Parameters          (Pro mode only)
   ├─ H&D toe    ────●────────  0.22
   ├─ H&D gamma  ──────●──────  0.68
   └─ H&D shoulder ────●──────  0.18
```

- Layer header: colored dot (hsl from dyeHue), name, reorder buttons (▲▼),
  remove button (×)
- Simple mode: Tone + Reversal + Grain (3 sliders per color layer, 2 for B&W)
- Pro mode: adds expandable H&D Curve Parameters detail section
- B&W: single "Panchromatic" layer, no reorder/remove, Tone + Grain only
- `[+ Add Layer]` button at bottom (max 5 layers, hidden for B&W)

### Spectrum ↔ Layers Linking

- Tapping a pointer in the spectrum scrolls the Layers tab to that layer section
- Tapping a layer header highlights its pointer in the spectrum
- Slider changes in Layers tab repaint the spectrum in real-time

## Tab 3: Base

Film substrate and inter-layer coupling. Less frequently adjusted.

### Contents

```
Layer stacking       ────────●──────   0.00
Edge sharpness       ──────────●────   0.35
─────────────────────────────────────
Base Tint
  Red                ──────────────●   1.00
  Green              ────────────●──   0.97
  Blue               ───────────●───   0.94
─────────────────────────────────────
Orange Mask                            (negative only)
  Density            ──────●────────   0.42
  Mask color         ───●───────────   28°
```

- Orange Mask section hidden when film type is positive or B&W
- Base Tint could become a single warmth slider in a future iteration

## Tab 4: Develop

Chemistry and process conditions. These are global modifiers applied to the working
recipe before rendering.

### Contents

```
Developer activity   ────────●──────   0.00
Bath temperature     ──────────●────  38.0°C
Development time     ────●──────────   3.5 min
Agitation            ────────●──────   0.50
Chemistry freshness  ──────────────●   1.00
─────────────────────────────────────
Lab Notes
  Color density near stock baseline.
  Tone response near stock baseline.
  Grain remains fine and controlled.
```

- Lab Notes is a generated text summary based on current development parameter
  values (same logic as current buildLabNotes)
- Development parameters are applied via a simplified version of the current
  lab-mapping logic: instead of mapping from labState onto labBaseRecipe, they
  modify the working recipe directly before each render call

## Touch & Responsive Considerations

- **Minimum touch targets**: 44×44px for all interactive elements (Apple HIG)
- **Slider thumbs**: 24px diameter on coarse pointer, 16px on fine
- **Pointer Events API** throughout (unified mouse + touch)
- **touch-action: none** on spectrum canvas to prevent scroll interference
- **Momentum scrolling** on film strip and tab content
- **Safe area insets** via env(safe-area-inset-*) on topbar and tab bar
- **No hover-dependent UI** — all interactions work with tap/drag only
- **Bottom sheet** for spectrum layer popup on screens < 600px
- **Haptic-ready**: slider values snap to nice numbers (future: navigator.vibrate)

## CSS Architecture

- CSS custom properties for theming (same dark palette)
- Mobile-first media queries: base is 375px, breakpoints at 768px and 1400px
- Flexbox column layout on mobile, row on desktop
- Tab bar: CSS grid with equal columns
- Film strip: flexbox row with overflow-x: auto, scroll-snap-type: x mandatory
- Panel content: overflow-y: auto with -webkit-overflow-scrolling: touch

## State Changes

### Removed
- `state.customMode` — no longer exists
- `state.labBaseRecipe` — no longer needed (no indirect mapping)
- `lab-mapping.js` — removed entirely
- STEP_ONE_CONTROLS, STEP_ONE_ADVANCED — indirect controls removed

### Retained
- `state.currentRecipe` — the working recipe, always mutable
- `state.labState` + LAB_DEFAULTS — development environment params
- `state.savedRecipes` — localStorage persistence
- `state.proMode`, `state.rawMode`, `state.referenceActive` — UI toggles
- STOCK_TEMPLATES, BLANK_TEMPLATES — read-only preset data
- LAYER_CONTROLS, SIMPLE_LAYER_CONTROLS, PRO_LAYER_CONTROLS, etc.
- STEP_TWO_CONTROLS — development environment controls
- GLOBAL_CONTROLS, MASK_CONTROLS — base tab controls

### Added
- `state.activeTab` — 'film' | 'layers' | 'base' | 'develop'
- `state.currentTemplate` — name of last-selected stock (for "modified" indicator)
- `state.recipeName` — name of current saved recipe (empty for unsaved)
- `state.isDirty` — true when recipe has been modified since last save/load

## File Changes

| File | Action |
|---|---|
| `index.html` | Rewrite — new layout shell with tab bar |
| `styles/main.css` | Rewrite — mobile-first, tab-based layout |
| `src/main.js` | Rewrite — tab routing, simplified render loop |
| `src/ui/panel.js` | Replace → `src/ui/tabs.js` — builds tab content |
| `src/ui/topbar.js` | Rewrite — minimal topbar + film strip |
| `src/ui/canvas.js` | Minor update — remove upload zone, add tap-to-upload |
| `src/ui/spectrum.js` | Update — larger touch targets, always editable |
| `src/engine/renderer.js` | No change |
| `src/engine/lab-mapping.js` | Remove — development mapping inlined |
| `src/state.js` | Update — remove customMode/labBaseRecipe, add activeTab |
