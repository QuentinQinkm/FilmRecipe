const STORAGE_KEY = 'filmlab-custom-recipes';


// "Untouched" identity recipe — bypass flag short-circuits the engine to a
// passthrough of the source image. Edits to layers/base only become visible
// once the user explicitly leaves bypass mode (any param change clears it,
// or they pick another stock). Mirrors `FilmRecipes.identity` on macOS.
export const STOCK_TEMPLATES = {
  'Untouched': {
    layers: [
      { name: 'cyan', sensitizerPeak: 620, sensitizerBw: 85, dyeHue: 185, dyePurity: 0.70, dmax: 2.0, fog: 0.05, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30 },
      { name: 'magenta', sensitizerPeak: 540, sensitizerBw: 85, dyeHue: 320, dyePurity: 0.70, dmax: 2.0, fog: 0.05, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30 },
      { name: 'yellow', sensitizerPeak: 440, sensitizerBw: 85, dyeHue: 55, dyePurity: 0.70, dmax: 2.0, fog: 0.05, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30 },
    ],
    global: { bypass: 1, reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 28, dirInhibition: 0, baseTintWarmth: 0, scanExposure: 3.0, grainSoftness: 1.00, halation: 0 },
  },
  'Portra 400': {
    layers: [
      { name: 'cyan', sensitizerPeak: 620, sensitizerBw: 80, dyeHue: 185, dyePurity: 0.70, dmax: 2.1, fog: 0.05, hdToe: 0.22, hdGamma: 0.68, hdShoulder: 0.18, crystalSize: 0.35 },
      { name: 'magenta', sensitizerPeak: 540, sensitizerBw: 90, dyeHue: 320, dyePurity: 0.75, dmax: 2.0, fog: 0.04, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30 },
      { name: 'yellow', sensitizerPeak: 440, sensitizerBw: 70, dyeHue: 55, dyePurity: 0.80, dmax: 2.2, fog: 0.04, hdToe: 0.18, hdGamma: 0.72, hdShoulder: 0.12, crystalSize: 0.28 },
    ],
    global: { bypass: 0, reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 28, dirInhibition: 0, baseTintWarmth: 0, scanExposure: 3.0, grainSoftness: 1.50, halation: 0.25 },
  },
  'Gold 200': {
    layers: [
      { name: 'cyan', sensitizerPeak: 615, sensitizerBw: 95, dyeHue: 190, dyePurity: 0.65, dmax: 2.3, fog: 0.06, hdToe: 0.15, hdGamma: 0.80, hdShoulder: 0.15, crystalSize: 0.25 },
      { name: 'magenta', sensitizerPeak: 545, sensitizerBw: 100, dyeHue: 330, dyePurity: 0.72, dmax: 2.1, fog: 0.05, hdToe: 0.14, hdGamma: 0.82, hdShoulder: 0.14, crystalSize: 0.22 },
      { name: 'yellow', sensitizerPeak: 445, sensitizerBw: 75, dyeHue: 48, dyePurity: 0.85, dmax: 2.4, fog: 0.05, hdToe: 0.12, hdGamma: 0.85, hdShoulder: 0.12, crystalSize: 0.20 },
    ],
    global: { bypass: 0, reversal: 0, stackingStrength: 0, maskDensity: 0.50, maskHue: 32, dirInhibition: 0.25, baseTintWarmth: 1.0, scanExposure: 3.0, grainSoftness: 1.20, halation: 0.20 },
  },
  'Velvia 50': {
    layers: [
      { name: 'cyan', sensitizerPeak: 630, sensitizerBw: 65, dyeHue: 195, dyePurity: 0.92, dmax: 2.8, fog: 0.02, hdToe: 0.35, hdGamma: 1.60, hdShoulder: 0.20, crystalSize: 0.15 },
      { name: 'magenta', sensitizerPeak: 535, sensitizerBw: 70, dyeHue: 310, dyePurity: 0.90, dmax: 2.7, fog: 0.02, hdToe: 0.38, hdGamma: 1.65, hdShoulder: 0.18, crystalSize: 0.14 },
      { name: 'yellow', sensitizerPeak: 430, sensitizerBw: 65, dyeHue: 58, dyePurity: 0.88, dmax: 2.6, fog: 0.02, hdToe: 0.32, hdGamma: 1.55, hdShoulder: 0.22, crystalSize: 0.13 },
    ],
    global: { bypass: 0, reversal: 1, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0.60, baseTintWarmth: -0.08, scanExposure: 3.0, grainSoftness: 1.00, halation: 0 },
  },
  'Kodachrome 64': {
    layers: [
      { name: 'cyan', sensitizerPeak: 625, sensitizerBw: 70, dyeHue: 200, dyePurity: 0.88, dmax: 2.5, fog: 0.03, hdToe: 0.28, hdGamma: 1.30, hdShoulder: 0.18, crystalSize: 0.18 },
      { name: 'magenta', sensitizerPeak: 545, sensitizerBw: 75, dyeHue: 350, dyePurity: 0.85, dmax: 2.4, fog: 0.03, hdToe: 0.25, hdGamma: 1.35, hdShoulder: 0.15, crystalSize: 0.17 },
      { name: 'yellow', sensitizerPeak: 440, sensitizerBw: 68, dyeHue: 50, dyePurity: 0.90, dmax: 2.6, fog: 0.03, hdToe: 0.22, hdGamma: 1.40, hdShoulder: 0.14, crystalSize: 0.16 },
    ],
    global: { bypass: 0, reversal: 1, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0.50, baseTintWarmth: 0.33, scanExposure: 3.0, grainSoftness: 1.00, halation: 0 },
  },
  'Ilford HP5': {
    layers: [
      { name: 'panchromatic', sensitizerPeak: 550, sensitizerBw: 150, dyeHue: 0, dyePurity: 0, dmax: 1.20, fog: 0.08, hdToe: 0.20, hdGamma: 0.78, hdShoulder: 0.15, crystalSize: 0.45 },
    ],
    global: { bypass: 0, reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0, baseTintWarmth: 0, scanExposure: 3.0, grainSoftness: 0.80, halation: 0 },
  },
  'Kodak Tri-X': {
    layers: [
      { name: 'panchromatic', sensitizerPeak: 560, sensitizerBw: 140, dyeHue: 0, dyePurity: 0, dmax: 1.55, fog: 0.10, hdToe: 0.30, hdGamma: 1.05, hdShoulder: 0.18, crystalSize: 0.50 },
    ],
    global: { bypass: 0, reversal: 0, stackingStrength: 0, maskDensity: 0, maskHue: 0, dirInhibition: 0, baseTintWarmth: 0.08, scanExposure: 3.0, grainSoftness: 0.70, halation: 0 },
  },
};

export const BLANK_RECIPE = {
  layers: [
    { name: 'cyan', sensitizerPeak: 620, sensitizerBw: 85, dyeHue: 185, dyePurity: 0.70, dmax: 2.0, fog: 0.05, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30 },
    { name: 'magenta', sensitizerPeak: 540, sensitizerBw: 85, dyeHue: 320, dyePurity: 0.70, dmax: 2.0, fog: 0.05, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30 },
    { name: 'yellow', sensitizerPeak: 440, sensitizerBw: 85, dyeHue: 55, dyePurity: 0.70, dmax: 2.0, fog: 0.05, hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30 },
  ],
  global: { bypass: 0, reversal: 0, stackingStrength: 0, maskDensity: 0.35, maskHue: 28, dirInhibition: 0.30, baseTintWarmth: 0.5, scanExposure: 3.0, grainSoftness: 1.00, halation: 0 },
};

export const LAYER_CONTROLS = [
  ['sensitizerPeak', 'Color sensitivity', 'Sensitizer peak', 'nm', 380, 700, 1, 0],
  ['sensitizerBw', 'Sensitivity range', 'Sensitizer bandwidth', 'nm', 30, 200, 1, 0],
  // dyeHue is authored per layer (seeded once at layer creation, hand-edited
  // afterward). Used to be auto-derived from sensitizerPeak; that auto-track
  // was removed so users can intentionally drift the dye away from the
  // mathematical complement (e.g. Portra's warm cyan ≈ 185° vs theoretical 195°).
  ['dyeHue', 'Dye color', 'Dye hue', '\u00B0', 0, 359, 1, 0],
  ['dyePurity', 'Color richness', 'Dye purity', '', 0, 1, 0.01, 2],
  ['dmax', 'Max density', 'Dmax', '', 0.05, 3.5, 0.01, 2],
  ['fog', 'Base fog', 'Base + fog (Dmin)', '', 0, 0.3, 0.01, 2],
  ['hdToe', 'Shadow detail', 'H&D toe', '', 0, 0.5, 0.01, 2],
  ['hdGamma', 'Contrast', 'H&D gamma', '', 0.3, 3, 0.01, 2],
  ['hdShoulder', 'Highlight rolloff', 'H&D shoulder', '', 0, 0.5, 0.01, 2],
  // Crystal size capped at 0.5 to match `ParameterRanges.crystalSize`. Larger
  // crystals run away into mush long before they look like real grain.
  ['crystalSize', 'Grain size', 'Crystal size', '', 0.0, 0.5, 0.01, 2],
];


export const PRO_LAYER_CONTROLS = [
  ['hdToe', 'Shadow detail', 'H&D toe', '', 0, 0.5, 0.01, 2],
  ['hdGamma', 'Contrast', 'H&D gamma', '', 0.3, 3, 0.01, 2],
  ['hdShoulder', 'Highlight rolloff', 'H&D shoulder', '', 0, 0.5, 0.01, 2],
];

export const GLOBAL_CONTROLS = [
  ['reversal', 'Reversal process', 'E-6 reversal', '', 0, 1, 1, 0],
  ['stackingStrength', 'Layer stacking', 'Stacking strength', '', 0, 1, 0.01, 2],
  ['dirInhibition', 'Edge sharpness', 'DIR inhibition', '', 0, 1, 0.01, 2],
  ['baseTintWarmth', 'Base warmth', 'Base tint warmth', '', -1, 1, 0.01, 2],
  ['scanExposure', 'Paper grade', 'Scan exposure', '', 1.0, 6.0, 0.1, 1],
  ['grainSoftness', 'Grain softness', 'Grain softness', '\u00d7', 0.0, 2.0, 0.05, 2],
  ['halation', 'Halation glow', 'Halation strength', '', 0, 1, 0.01, 2],
];

export const MASK_CONTROLS = [
  ['maskDensity', 'Mask density', 'Mask density', '', 0, 1, 0.01, 2],
  ['maskHue', 'Mask color', 'Mask hue', '\u00B0', 0, 60, 1, 0],
];

export const STEP_TWO_CONTROLS = [
  ['developerActivity', 'Developer activity', 'Developer activity', '', -0.5, 0.7, 0.01, 2],
  ['bathTemperatureC', 'Bath temperature', 'Bath temperature', '\u00B0C', 30, 42, 0.1, 1],
  ['developmentTimeMin', 'Development time', 'Development time', 'min', 2, 8, 0.1, 1],
  ['agitationLevel', 'Agitation', 'Agitation', '', 0, 1, 0.01, 2],
  ['chemistryFreshness', 'Chemistry freshness', 'Chemistry freshness', '', 0.3, 1, 0.01, 2],
];

export const LAB_DEFAULTS = {
  developerActivity: 0,
  bathTemperatureC: 38, developmentTimeMin: 3.5, agitationLevel: 0.5,
  chemistryFreshness: 1,
};

// MAX_LAYERS is enforced at 4 — engine `FilmRecipes.maxLayers` matches.
// `dyeHue` is seeded once via `complementHue()` here and then becomes a
// hand-authored value; nothing in the engine re-derives it as the user
// drags the sensitizer peak.
export function makeDefaultLayer(index) {
  const names = ['cyan', 'magenta', 'yellow', 'deep red'];
  const peaks = [620, 540, 440, 670];
  const i = Math.min(index, names.length - 1);
  return {
    name: names[i], sensitizerPeak: peaks[i], sensitizerBw: 85,
    dyeHue: complementHue(peaks[i]), dyePurity: 0.70, dmax: 2.0, fog: 0.05,
    hdToe: 0.20, hdGamma: 0.70, hdShoulder: 0.15, crystalSize: 0.30,
  };
}

export function cloneRecipe(recipe) {
  return JSON.parse(JSON.stringify(recipe));
}

export function cloneTemplate(name) {
  return JSON.parse(JSON.stringify(STOCK_TEMPLATES[name]));
}

export function createBlankRecipe() {
  return JSON.parse(JSON.stringify(BLANK_RECIPE));
}

// Mirrors `PresetLibrary.clearBypassOnFirstEdit()` on macOS: any user edit
// to a bypassed recipe should reveal the film processing. Called from main.js
// before any slider/spectrum-driven render.
export function clearBypassOnFirstEdit() {
  const r = state.currentRecipe;
  if (r && r.global && r.global.bypass) {
    r.global.bypass = 0;
    state.isDirty = true;
  }
}

export function loadSavedRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveCustomRecipe(name, recipe) {
  const saved = loadSavedRecipes();
  saved[name] = JSON.parse(JSON.stringify(recipe));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  state.savedRecipes = saved;
}

export function deleteCustomRecipe(name) {
  const saved = loadSavedRecipes();
  delete saved[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  state.savedRecipes = saved;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Compute complementary dye hue from sensitizer wavelength.
// Spectral sensitivity → absorption dye is always the complement:
//   red-sensitive (620nm) → cyan dye, green (540nm) → magenta, blue (440nm) → yellow.
const SPECTRAL_STOPS = [
  [380, 270], [440, 235], [490, 180], [540, 120],
  [580, 40], [620, 15], [700, 0],
];
export function complementHue(wl) {
  const s = SPECTRAL_STOPS;
  let h;
  if (wl <= s[0][0]) h = s[0][1];
  else if (wl >= s[s.length - 1][0]) h = s[s.length - 1][1];
  else {
    for (let i = 0; i < s.length - 1; i++) {
      if (wl >= s[i][0] && wl <= s[i + 1][0]) {
        const t = (wl - s[i][0]) / (s[i + 1][0] - s[i][0]);
        h = s[i][1] + (s[i + 1][1] - s[i][1]) * t;
        break;
      }
    }
  }
  return (Math.round(h) + 180) % 360;
}

export function applyDevelopment(recipe, lab) {
  if (!lab) return recipe;
  const out = cloneRecipe(recipe);
  const tempDelta = lab.bathTemperatureC - 38;
  const timeDelta = lab.developmentTimeMin - 3.5;
  const freshPenalty = 1 - lab.chemistryFreshness;
  const processBias = lab.developerActivity * 0.42 + tempDelta * 0.03 + timeDelta * 0.15;

  out.layers.forEach(layer => {
    const isSilver = layer.dyePurity === 0;
    layer.hdGamma = clamp(
      layer.hdGamma * (1 + processBias * 0.23 - freshPenalty * 0.15), 0.5, 3.0);
    layer.hdToe = clamp(
      layer.hdToe - processBias * 0.03 + freshPenalty * 0.02, 0, 0.5);
    layer.hdShoulder = clamp(
      layer.hdShoulder + processBias * 0.03, 0, 0.5);
    const grainGrowth = 1 + Math.max(0, tempDelta) * 0.03 + freshPenalty * 0.45;
    layer.crystalSize = clamp(layer.crystalSize * grainGrowth, 0.0, 0.5);
    if (!isSilver) {
      layer.dyePurity = clamp(
        layer.dyePurity * (1 + processBias * 0.12 - freshPenalty * 0.1), 0, 1);
      layer.dmax = clamp(
        layer.dmax * (1 + processBias * 0.2 - freshPenalty * 0.2), 0.1, 3.0);
    }
  });

  out.global.dirInhibition = clamp(
    recipe.global.dirInhibition + (lab.agitationLevel - 0.5) * 0.45 + processBias * 0.08, 0, 1);
  if (out.global.maskDensity > 0) {
    out.global.maskDensity = clamp(
      recipe.global.maskDensity + freshPenalty * 0.1 + Math.max(0, tempDelta) * 0.008, 0, 1);
    out.global.maskHue = clamp(recipe.global.maskHue + tempDelta * 0.5, 0, 60);
  }
  // Cool baths shift base color slightly cooler. We adjust `baseTintWarmth`
  // (the single scalar that drives the engine's tint) rather than the dead
  // baseTintR/G/B fields that no preset actually carries.
  const coolShift = clamp((38 - lab.bathTemperatureC) * 0.04, -0.5, 0.5);
  const warmth = recipe.global.baseTintWarmth ?? 0;
  out.global.baseTintWarmth = clamp(warmth - coolShift, -1, 1);
  return out;
}

export const state = {
  currentRecipe: null,
  labState: null,
  activeTab: 'layers',
  currentTemplate: 'Untouched',
  recipeName: '',
  isDirty: false,
  savedRecipes: loadSavedRecipes(),
  rawMode: false,
  referenceActive: false,
  selectedLayerIdx: 0,
  // Press-and-hold-image bypass — the canvas pointer handler flips this to
  // true while held, and main.js merges `bypass: 1` into the recipe for
  // that render. Mirrors the macOS viewer's `isPeekingOriginal` flag.
  peeking: false,
};
