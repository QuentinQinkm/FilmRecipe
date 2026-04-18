import {
  state, STOCK_TEMPLATES, cloneTemplate, cloneRecipe,
  loadSavedRecipes, saveCustomRecipe, deleteCustomRecipe,
  LAB_DEFAULTS,
} from '../state.js';

let callbacks = {};

export function initTopbar(cbs) {
  callbacks = cbs;
  state.savedRecipes = loadSavedRecipes();
  buildFilmStrip();

  // Save / Save As buttons
  document.getElementById('save-btn').addEventListener('click', () => {
    doSave();
    updateSaveButtons();
  });
  document.getElementById('save-as-btn').addEventListener('click', () => {
    doSaveAs();
    updateSaveButtons();
    if (callbacks.onTemplateChange) callbacks.onTemplateChange();
  });

}

export function updateSaveButtons() {
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.disabled = !state.recipeName;
}

export function selectTemplate(name) {
  state.currentTemplate = name;
  state.recipeName = '';
  state.isDirty = false;
  state.currentRecipe = cloneTemplate(name);
  state.labState = { ...LAB_DEFAULTS };
  highlightStrip(name, false);
  callbacks.onTemplateChange();
}

export function selectSaved(name) {
  const saved = state.savedRecipes[name];
  if (!saved) return;
  state.currentTemplate = '';
  state.recipeName = name;
  state.isDirty = false;
  state.currentRecipe = cloneRecipe(saved);
  state.labState = { ...LAB_DEFAULTS };
  highlightStrip(name, true);
  callbacks.onTemplateChange();
}

export function doSave() {
  if (!state.recipeName) return doSaveAs();
  saveCustomRecipe(state.recipeName, state.currentRecipe);
  state.isDirty = false;
  buildFilmStrip();
}

export function doSaveAs() {
  const name = prompt('Film name:');
  if (!name || !name.trim()) return;
  state.recipeName = name.trim();
  saveCustomRecipe(state.recipeName, state.currentRecipe);
  state.isDirty = false;
  state.currentTemplate = '';
  buildFilmStrip();
}

// "+ New" lands on the Untouched bypass recipe — matches macOS
// `PresetLibrary.createNew()` which also seeds a bypass=true identity recipe.
// First parameter the user touches will clear bypass and reveal their edit.
export function doNewFilm() {
  selectTemplate('Untouched');
}

function highlightStrip(name, isSaved) {
  document.querySelectorAll('.film-chip').forEach(b => {
    if (isSaved) b.classList.toggle('active', b.dataset.saved === name);
    else b.classList.toggle('active', b.dataset.template === name);
  });
}

export function buildFilmStrip() {
  const strip = document.getElementById('film-strip');
  strip.innerHTML = '';

  let lastGroup = null;
  for (const name of Object.keys(STOCK_TEMPLATES)) {
    const t = STOCK_TEMPLATES[name];
    const allSilver = t.layers.every(l => l.dyePurity < 0.01);
    // "Untouched" gets its own visual group so it reads as a starter recipe
    // distinct from the cataloged stocks. Order in STOCK_TEMPLATES puts it first.
    const group = t.global.bypass
      ? 'bypass'
      : allSilver ? 'bw' : t.global.reversal ? 'rev' : 'neg';
    if (lastGroup && group !== lastGroup) {
      const sep = document.createElement('span');
      sep.className = 'strip-sep';
      strip.appendChild(sep);
    }
    lastGroup = group;
    const btn = document.createElement('button');
    btn.className = 'film-chip';
    btn.textContent = name;
    btn.dataset.template = name;
    if (state.currentTemplate === name) btn.classList.add('active');
    btn.addEventListener('click', () => selectTemplate(name));
    strip.appendChild(btn);
  }

  // Saved recipes
  const saved = state.savedRecipes;
  const savedNames = Object.keys(saved);
  if (savedNames.length > 0) {
    strip.appendChild(Object.assign(document.createElement('span'), { className: 'strip-sep' }));
    for (const name of savedNames) {
      const wrap = document.createElement('span');
      wrap.className = 'saved-chip-wrap';
      const btn = document.createElement('button');
      btn.className = 'film-chip';
      btn.textContent = name;
      btn.dataset.saved = name;
      if (state.recipeName === name) btn.classList.add('active');
      btn.addEventListener('click', () => selectSaved(name));
      const del = document.createElement('button');
      del.className = 'chip-delete';
      del.textContent = '\u00d7';
      del.addEventListener('click', e => {
        e.stopPropagation();
        deleteCustomRecipe(name);
        if (state.recipeName === name) state.recipeName = '';
        buildFilmStrip();
      });
      wrap.appendChild(btn);
      wrap.appendChild(del);
      strip.appendChild(wrap);
    }
  }

  // + New
  strip.appendChild(Object.assign(document.createElement('span'), { className: 'strip-sep' }));
  const newBtn = document.createElement('button');
  newBtn.className = 'film-chip new-chip';
  newBtn.textContent = '+ New';
  newBtn.addEventListener('click', doNewFilm);
  strip.appendChild(newBtn);
}
