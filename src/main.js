import { state, cloneTemplate, applyDevelopment, LAB_DEFAULTS, clearBypassOnFirstEdit } from './state.js';
import { FilmRenderer } from './engine/renderer.js';
import { buildTabContent, syncSliders } from './ui/tabs.js';
import { buildSpectrum } from './ui/spectrum.js';
import { initTopbar } from './ui/topbar.js';
import { initCanvas } from './ui/canvas.js';

const outputCanvas = document.getElementById('output-canvas');
const renderer = new FilmRenderer(outputCanvas);

// --- Persistent spectrum ---
const spectrumBar = document.getElementById('spectrum-bar');
let spectrumHandle = null;

function mountSpectrum() {
  if (spectrumHandle) spectrumHandle.destroy();
  spectrumHandle = buildSpectrum(spectrumBar, {
    onInput() {
      // Spectrum drags count as edits — same bypass-clear path as sliders.
      clearBypassOnFirstEdit();
      syncSliders();
      renderIfImage();
    },
    onRebuild: rebuildAndRender,
    onLayerSelect(idx) {
      state.selectedLayerIdx = idx;
      rebuildTabs();
    },
  });
}

function render() {
  const developed = applyDevelopment(state.currentRecipe, state.labState);
  // Press-and-hold-image peek: layer a bypass:1 override on top of the
  // developed recipe so the image instantly snaps to the original. Doesn't
  // mutate the underlying recipe — the user's edits are preserved on release.
  // Mirrors `ViewerPaneView.viewportRecipe` on macOS.
  const forRender = state.peeking
    ? { ...developed, global: { ...developed.global, bypass: 1 } }
    : developed;
  renderer.render(forRender, state.rawMode);
}

function rebuildTabs() {
  buildTabContent(onSliderInput, rebuildAndRender);
}

function onSliderInput() {
  // Any deliberate edit lifts the recipe out of Untouched/bypass mode so the
  // user can actually see the change land. Press-and-hold-peek is a separate
  // path that doesn't pass through here.
  clearBypassOnFirstEdit();
  if (spectrumHandle) spectrumHandle.repaint();
  renderIfImage();
}

function renderIfImage() {
  if (canvasUI.hasImage) render();
}

function rebuildAndRender() {
  if (spectrumHandle) {
    spectrumHandle.setRecipe(state.currentRecipe);
    spectrumHandle.setActiveLayer(state.selectedLayerIdx);
  }
  rebuildTabs();
  renderIfImage();
}

// Tab bar (3 tabs: layers, base, develop)
document.querySelectorAll('#tab-bar .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    document.querySelectorAll('#tab-bar .tab').forEach(b =>
      b.classList.toggle('active', b === btn));
    rebuildTabs();
  });
});

// Canvas
const canvasUI = initCanvas(renderer, renderIfImage);

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

// Topbar + film strip
initTopbar({
  onTemplateChange() {
    state.selectedLayerIdx = 0;
    rebuildAndRender();
  },
});

// Initial state — boot into Untouched so the first render is a passthrough
// of whatever the user uploads. Picking any stock from the strip leaves
// bypass mode automatically (Untouched has bypass:1; the others have :0).
state.currentRecipe = cloneTemplate('Untouched');
state.currentTemplate = 'Untouched';
state.labState = { ...LAB_DEFAULTS };
mountSpectrum();
rebuildAndRender();
