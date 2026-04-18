import { state, cloneTemplate } from '../state.js';
import { renderFilmCPU } from '../engine/renderer.js';

export function initCanvas(renderer, onRender) {
  const fileInput = document.getElementById('file-input');
  const canvasArea = document.getElementById('canvas-area');
  const uploadPrompt = document.getElementById('upload-prompt');
  const refOverlay = document.getElementById('ref-overlay');
  const refCanvas = document.getElementById('ref-canvas');
  const refCtx = refCanvas.getContext('2d');
  const rawBtn = document.getElementById('raw-btn');
  const refBtn = document.getElementById('ref-btn');

  let decodeCanvas = document.createElement('canvas');
  let decodeCtx = decodeCanvas.getContext('2d');
  let sourceImageData = null;
  let imageLoaded = false;

  function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxW = 1600;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      decodeCanvas.width = w;
      decodeCanvas.height = h;
      decodeCtx.drawImage(img, 0, 0, w, h);
      sourceImageData = decodeCtx.getImageData(0, 0, w, h);
      renderer.setImage(decodeCanvas, w, h);
      uploadPrompt.style.display = 'none';
      imageLoaded = true;
      URL.revokeObjectURL(url);
      onRender();
    };
    img.src = url;
  }

  fileInput.addEventListener('change', e => loadImageFile(e.target.files[0]));

  canvasArea.addEventListener('click', e => {
    if (!imageLoaded && e.target.closest('.pill-btn') === null) {
      fileInput.click();
    }
  });

  canvasArea.addEventListener('dragover', e => { e.preventDefault(); });
  canvasArea.addEventListener('drop', e => {
    e.preventDefault();
    loadImageFile(e.dataTransfer.files[0]);
  });

  // Press-and-hold the rendered image to peek the original (bypass mode).
  // Uses pointer events so it works for mouse, touch, and pen. Only arms
  // when an image is loaded and the user is actually pressing on the
  // canvas (not on a pill button). Mirrors the macOS viewer gesture.
  const peekBadge = document.createElement('div');
  peekBadge.className = 'peek-badge';
  peekBadge.textContent = 'ORIGINAL';
  canvasArea.appendChild(peekBadge);

  function setPeek(on) {
    if (state.peeking === on) return;
    state.peeking = on;
    peekBadge.classList.toggle('visible', on);
    onRender();
  }

  let peekPointerId = null;
  canvasArea.addEventListener('pointerdown', e => {
    if (!imageLoaded) return;
    if (e.target.closest('.pill-btn')) return;
    peekPointerId = e.pointerId;
    setPeek(true);
  });
  function releasePeek(e) {
    if (peekPointerId !== null && (e == null || e.pointerId === peekPointerId)) {
      peekPointerId = null;
      setPeek(false);
    }
  }
  canvasArea.addEventListener('pointerup', releasePeek);
  canvasArea.addEventListener('pointercancel', releasePeek);
  canvasArea.addEventListener('pointerleave', releasePeek);

  rawBtn.addEventListener('click', () => {
    state.rawMode = !state.rawMode;
    rawBtn.classList.toggle('active', state.rawMode);
    onRender();
  });

  refBtn.addEventListener('click', () => {
    state.referenceActive = !state.referenceActive;
    refBtn.classList.toggle('active', state.referenceActive);
    refOverlay.classList.toggle('visible', state.referenceActive);
    if (state.referenceActive && sourceImageData) renderReference();
  });

  function renderReference() {
    if (!state.currentTemplate) return;
    const refRecipe = cloneTemplate(state.currentTemplate);
    if (!refRecipe) return;
    const result = renderFilmCPU(sourceImageData, refRecipe, false);
    if (!result) return;
    refCanvas.width = result.width;
    refCanvas.height = result.height;
    refCtx.putImageData(result, 0, 0);
    const outCanvas = renderer.canvas;
    refCanvas.style.width = outCanvas.offsetWidth + 'px';
    refCanvas.style.height = outCanvas.offsetHeight + 'px';
    refCanvas.style.right = '0';
    refCanvas.style.left = 'auto';
  }

  return {
    renderReference,
    get hasImage() { return imageLoaded; },
  };
}
