import { state, cloneTemplate, applyDevelopment, LAB_DEFAULTS } from './state.js';
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
  renderer.render(developed, state.rawMode);
}

function rebuildTabs() {
  buildTabContent(onSliderInput, rebuildAndRender);
}

function onSliderInput() {
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

// Topbar + film strip
initTopbar({
  onTemplateChange() {
    state.selectedLayerIdx = 0;
    rebuildAndRender();
  },
});

// Initial state
state.currentRecipe = cloneTemplate('Portra 400');
state.currentTemplate = 'Portra 400';
state.labState = { ...LAB_DEFAULTS };
mountSpectrum();
rebuildAndRender();
