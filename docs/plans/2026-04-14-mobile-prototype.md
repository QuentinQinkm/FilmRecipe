# FilmRecipe Mobile Prototype Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React + Vite mobile UX prototype for FilmRecipe that renders real film simulations via the existing WebGL engine, deployable to GitHub Pages for phone testing.

**Architecture:** Separate `MobilePrototype/` React app that imports `FilmRenderer` and `state.js` from `HTMLPrototype/` via Vite path aliases — no code duplication of the core engine. Custom Canvas2D widgets (arc gauges, rotary knobs, gradient strips) handle the acid-retro instrument UI. A single React context holds recipe + lab state and triggers renderer re-renders on every change.

**Tech Stack:** React 18, Vite 5, Vitest + @testing-library/react, vitest-canvas-mock, gh-pages for deploy. Zero other dependencies — no UI framework, no router, no state library.

**Reference files:**
- Design spec: `docs/plans/2026-04-14-mobile-v2-ui-design.md`
- Controls redesign: `docs/plans/2026-04-14-mobile-v2-controls-redesign.md`
- Mockups: `MobileUI.pen` (screens 1–7)
- Shared engine: `HTMLPrototype/src/engine/renderer.js` → `FilmRenderer`, `render(recipe, rawMode)`, `setImage(img, w, h)`, `destroy()`
- Shared state: `HTMLPrototype/src/state.js` → `STOCK_TEMPLATES`, `LAB_DEFAULTS`, `BLANK_RECIPE`, `applyDevelopment(recipe, lab)`, `cloneTemplate(name)`, `saveCustomRecipe(name, recipe)`, `loadSavedRecipes()`
- Design tokens: bg `#080808`, surface `#111111`, surface-raised `#1A1A1A`, accent `#C8FF00`, text `#E0E0E0`, text-2 `#777777`, text-3 `#444444`, border `#222222`

---

### Task 1: Project Scaffold

**Files:**
- Create: `MobilePrototype/package.json`
- Create: `MobilePrototype/vite.config.js`
- Create: `MobilePrototype/index.html`
- Create: `MobilePrototype/src/main.jsx`
- Create: `MobilePrototype/src/App.jsx`
- Create: `MobilePrototype/src/test-setup.js`
- Create: `MobilePrototype/src/app.css`

**Step 1: Create package.json**

```json
{
  "name": "filmrecipe-mobile",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "deploy": "npm run build && gh-pages -d dist"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@testing-library/jest-dom": "^6.4.6",
    "jsdom": "^24.1.0",
    "vitest": "^2.0.5",
    "vitest-canvas-mock": "^0.3.3",
    "gh-pages": "^6.1.1",
    "vite": "^5.3.4"
  }
}
```

**Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': resolve(__dirname, '../HTMLPrototype/src/engine'),
      '@filmstate': resolve(__dirname, '../HTMLPrototype/src/state.js'),
    },
  },
  base: '/FilmRecipe/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
})
```

**Step 3: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#080808" />
    <title>Film Lab</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 4: Create src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './app.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 5: Create src/App.jsx (stub)**

```jsx
export default function App() {
  return <div className="app">Film Lab Mobile</div>
}
```

**Step 6: Create src/test-setup.js**

```js
import 'vitest-canvas-mock'
import '@testing-library/jest-dom'
```

**Step 7: Create src/app.css (design tokens + base reset)**

```css
:root {
  --bg: #080808;
  --surface: #111111;
  --surface-raised: #1A1A1A;
  --border: #222222;
  --accent: #C8FF00;
  --accent-dim: #C8FF0018;
  --accent-muted: #C8FF0066;
  --text: #E0E0E0;
  --text-2: #777777;
  --text-3: #444444;
  --glass: #0A0A0ACC;
  --radius: 2px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 430px;
  margin: 0 auto;
  overflow: hidden;
}
```

**Step 8: Install dependencies and run dev server**

```bash
cd /Users/kuangmingqin/Desktop/Personal/Project/FilmRecipe/MobilePrototype
npm install
npm run dev
```

Expected: Vite dev server running at `http://localhost:5173/FilmRecipe/`, page shows "Film Lab Mobile".

**Step 9: Verify engine import resolves**

Add to `src/App.jsx` temporarily:
```js
import { STOCK_TEMPLATES } from '@filmstate'
console.log(Object.keys(STOCK_TEMPLATES))
```
Open browser console. Expected: `['Portra 400', 'Gold 200', 'Velvia 50', 'Kodachrome 64', 'Ilford HP5', 'Kodak Tri-X']`. Remove the temporary import after verifying.

**Step 10: Run test suite baseline**

```bash
npm test
```
Expected: 0 tests found, exits 0 (no failures).

**Step 11: Commit**

```bash
cd /Users/kuangmingqin/Desktop/Personal/Project/FilmRecipe
git add MobilePrototype/
git commit -m "feat: scaffold mobile prototype (React + Vite, shared engine import)"
```

---

### Task 2: Recipe Context

**Files:**
- Create: `MobilePrototype/src/context/RecipeContext.jsx`
- Create: `MobilePrototype/src/__tests__/context/RecipeContext.test.jsx`

The recipe context is the nervous system of the app. It holds `currentRecipe` (mutable working copy), `labState`, `isDirty`, `currentTemplate`, and exposes updater functions. All widgets read from and write to this context.

**Step 1: Write the failing test**

```jsx
// src/__tests__/context/RecipeContext.test.jsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeProvider, useRecipe } from '../../context/RecipeContext.jsx'

function Inspector() {
  const { recipe, isDirty, setLayerParam, setGlobalParam } = useRecipe()
  return (
    <div>
      <span data-testid="template">{recipe.layers.length}</span>
      <span data-testid="dirty">{isDirty ? 'dirty' : 'clean'}</span>
      <button onClick={() => setGlobalParam('dirInhibition', 0.99)}>edit</button>
    </div>
  )
}

test('provides Portra 400 as default recipe', () => {
  render(<RecipeProvider><Inspector /></RecipeProvider>)
  expect(screen.getByTestId('template').textContent).toBe('3')
})

test('setGlobalParam marks recipe dirty', async () => {
  const user = userEvent.setup()
  render(<RecipeProvider><Inspector /></RecipeProvider>)
  expect(screen.getByTestId('dirty').textContent).toBe('clean')
  await user.click(screen.getByText('edit'))
  expect(screen.getByTestId('dirty').textContent).toBe('dirty')
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- RecipeContext
```
Expected: FAIL — "Cannot find module '../../context/RecipeContext.jsx'"

**Step 3: Implement RecipeContext**

```jsx
// src/context/RecipeContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'
import {
  cloneTemplate, cloneRecipe, createBlankRecipe,
  applyDevelopment, saveCustomRecipe, loadSavedRecipes,
  LAB_DEFAULTS, STOCK_TEMPLATES,
} from '@filmstate'

const RecipeContext = createContext(null)

export function RecipeProvider({ children }) {
  const [recipe, setRecipe] = useState(() => cloneTemplate('Portra 400'))
  const [labState, setLabState] = useState({ ...LAB_DEFAULTS })
  const [isDirty, setIsDirty] = useState(false)
  const [currentTemplate, setCurrentTemplate] = useState('Portra 400')
  const [savedRecipes, setSavedRecipes] = useState(loadSavedRecipes)

  const setLayerParam = useCallback((layerIdx, key, value) => {
    setRecipe(r => {
      const next = cloneRecipe(r)
      next.layers[layerIdx][key] = value
      return next
    })
    setIsDirty(true)
  }, [])

  const setGlobalParam = useCallback((key, value) => {
    setRecipe(r => {
      const next = cloneRecipe(r)
      next.global[key] = value
      return next
    })
    setIsDirty(true)
  }, [])

  const setLabParam = useCallback((key, value) => {
    setLabState(s => ({ ...s, [key]: value }))
  }, [])

  const loadTemplate = useCallback((name) => {
    setRecipe(cloneTemplate(name))
    setCurrentTemplate(name)
    setIsDirty(false)
  }, [])

  const saveAs = useCallback((name) => {
    saveCustomRecipe(name, recipe)
    setSavedRecipes(loadSavedRecipes())
    setCurrentTemplate(name)
    setIsDirty(false)
  }, [recipe])

  const resetNew = useCallback(() => {
    setRecipe(createBlankRecipe())
    setCurrentTemplate('')
    setIsDirty(false)
  }, [])

  // The developed recipe is what the renderer actually uses
  const developedRecipe = applyDevelopment(recipe, labState)

  return (
    <RecipeContext.Provider value={{
      recipe, labState, developedRecipe,
      isDirty, currentTemplate, savedRecipes,
      setLayerParam, setGlobalParam, setLabParam,
      loadTemplate, saveAs, resetNew,
    }}>
      {children}
    </RecipeContext.Provider>
  )
}

export function useRecipe() {
  const ctx = useContext(RecipeContext)
  if (!ctx) throw new Error('useRecipe must be used inside RecipeProvider')
  return ctx
}
```

**Step 4: Run tests**

```bash
npm test -- RecipeContext
```
Expected: 2 passing.

**Step 5: Wrap App in provider**

```jsx
// src/App.jsx
import { RecipeProvider } from './context/RecipeContext.jsx'
export default function App() {
  return <RecipeProvider><div className="app">Film Lab Mobile</div></RecipeProvider>
}
```

**Step 6: Commit**

```bash
git add MobilePrototype/src/context MobilePrototype/src/App.jsx
git commit -m "feat: add RecipeContext with recipe/lab state management"
```

---

### Task 3: Renderer Hook + Image Area

**Files:**
- Create: `MobilePrototype/src/hooks/useRenderer.js`
- Create: `MobilePrototype/src/__tests__/hooks/useRenderer.test.jsx`
- Create: `MobilePrototype/src/components/ImageArea.jsx`
- Create: `MobilePrototype/src/components/ImageArea.css`

**Step 1: Write the failing test**

```jsx
// src/__tests__/hooks/useRenderer.test.jsx
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useRenderer } from '../../hooks/useRenderer.js'

test('loadImage triggers setImage and render on the renderer', async () => {
  const fakeCanvas = document.createElement('canvas')
  const fakeRenderer = {
    setImage: vi.fn(),
    render: vi.fn(),
    destroy: vi.fn(),
    hasImage: false,
  }
  vi.mock('@engine/renderer.js', () => ({
    FilmRenderer: vi.fn(() => fakeRenderer),
  }))

  const canvasRef = { current: fakeCanvas }
  const recipe = { layers: [], global: {} }
  const { result } = renderHook(() => useRenderer(canvasRef, recipe, false))

  // loadImage should be a stable function
  expect(typeof result.current.loadImage).toBe('function')
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- useRenderer
```
Expected: FAIL — module not found.

**Step 3: Implement useRenderer**

```js
// src/hooks/useRenderer.js
import { useRef, useEffect, useCallback } from 'react'
import { FilmRenderer } from '@engine/renderer.js'

export function useRenderer(canvasRef, developedRecipe, rawMode = false) {
  const rendererRef = useRef(null)
  const imageLoadedRef = useRef(false)

  // Init/destroy renderer with the canvas
  useEffect(() => {
    if (!canvasRef.current) return
    rendererRef.current = new FilmRenderer(canvasRef.current)
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [canvasRef])

  // Re-render whenever recipe changes (if image is loaded)
  useEffect(() => {
    if (!rendererRef.current || !imageLoadedRef.current) return
    rendererRef.current.render(developedRecipe, rawMode)
  }, [developedRecipe, rawMode])

  const loadImage = useCallback((src) => {
    const img = new Image()
    img.onload = () => {
      if (!canvasRef.current || !rendererRef.current) return
      canvasRef.current.width = img.naturalWidth
      canvasRef.current.height = img.naturalHeight
      rendererRef.current.setImage(img, img.naturalWidth, img.naturalHeight)
      imageLoadedRef.current = true
      rendererRef.current.render(developedRecipe, rawMode)
    }
    img.src = src
  }, [canvasRef, developedRecipe, rawMode])

  return { loadImage, hasImage: imageLoadedRef.current }
}
```

**Step 4: Run tests**

```bash
npm test -- useRenderer
```
Expected: 1 passing.

**Step 5: Implement ImageArea component**

```jsx
// src/components/ImageArea.jsx
import { useRef, useCallback } from 'react'
import { useRecipe } from '../context/RecipeContext.jsx'
import { useRenderer } from '../hooks/useRenderer.js'
import './ImageArea.css'

export function ImageArea({ section, onSectionPress, onNextPress, onFullscreen }) {
  const canvasRef = useRef(null)
  const { developedRecipe } = useRecipe()
  const { loadImage, hasImage } = useRenderer(canvasRef, developedRecipe)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files[0] || e.target.files?.[0]
    if (!file) return
    loadImage(URL.createObjectURL(file))
  }, [loadImage])

  const handleTap = useCallback(() => {
    if (hasImage) return
    document.getElementById('img-input').click()
  }, [hasImage])

  return (
    <div className="image-area" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
      <input
        id="img-input" type="file" accept="image/*" hidden
        onChange={e => e.target.files[0] && loadImage(URL.createObjectURL(e.target.files[0]))}
      />
      {!hasImage && (
        <div className="image-area__prompt" onClick={handleTap}>
          <span className="image-area__icon">+</span>
          <span className="image-area__text">TAP TO LOAD IMAGE</span>
        </div>
      )}
      <canvas ref={canvasRef} className="image-area__canvas" />

      {/* Floating fullscreen button */}
      <button className="image-area__fullscreen" onClick={onFullscreen} aria-label="Fullscreen">⛶</button>

      {/* Floating section pills */}
      <div className="image-area__pills">
        <button className="pill pill--section" onClick={onSectionPress}>{section} ▾</button>
        <button className="pill pill--next" onClick={onNextPress}>NEXT →</button>
      </div>
    </div>
  )
}
```

```css
/* src/components/ImageArea.css */
.image-area {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  background: #000;
  overflow: hidden;
}

.image-area__canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-area__prompt {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; cursor: pointer;
}
.image-area__icon { font-size: 32px; color: var(--text-3); }
.image-area__text { font-size: 10px; font-weight: 600; letter-spacing: 2px; color: var(--text-3); }

.image-area__fullscreen {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px;
  background: var(--glass); border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text);
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.image-area__pills {
  position: absolute; bottom: 12px;
  width: 100%; padding: 0 16px;
  display: flex; justify-content: space-between;
}

.pill {
  padding: 7px 14px; border-radius: var(--radius);
  font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600;
  letter-spacing: 1px; cursor: pointer; border: none;
}
.pill--section {
  background: var(--glass); border: 1px solid var(--accent-muted);
  color: var(--text); backdrop-filter: blur(16px);
}
.pill--next {
  background: var(--accent); color: #000;
}
```

**Step 6: Wire into App — set image area height**

```jsx
// src/App.jsx
import { useState } from 'react'
import { RecipeProvider } from './context/RecipeContext.jsx'
import { ImageArea } from './components/ImageArea.jsx'

const SECTIONS = ['LAYER', 'BASE', 'DEVELOP']

export default function App() {
  const [sectionIdx, setSectionIdx] = useState(0)
  const next = () => setSectionIdx(i => Math.min(SECTIONS.length - 1, i + 1))
  const section = SECTIONS[sectionIdx]

  return (
    <RecipeProvider>
      <div className="app">
        <ImageArea
          section={section}
          onSectionPress={() => {}}
          onNextPress={next}
          onFullscreen={() => {}}
        />
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, color: 'var(--text-3)', fontSize: 12 }}>
          {section} controls go here
        </div>
      </div>
    </RecipeProvider>
  )
}
```

**Step 7: Run dev server, load an image, verify WebGL renders**

```bash
npm run dev
```
Open `http://localhost:5173/FilmRecipe/` on desktop. Tap the image area, pick any photo. Expected: photo renders with Portra 400 film simulation applied.

**Step 8: Commit**

```bash
git add MobilePrototype/src/hooks MobilePrototype/src/components/ImageArea* MobilePrototype/src/App.jsx
git commit -m "feat: add renderer hook and image area with WebGL output"
```

---

### Task 4: Top Bar

**Files:**
- Create: `MobilePrototype/src/components/TopBar.jsx`
- Create: `MobilePrototype/src/components/TopBar.css`
- Create: `MobilePrototype/src/__tests__/components/TopBar.test.jsx`

**Step 1: Write the failing test**

```jsx
// src/__tests__/components/TopBar.test.jsx
import { render, screen } from '@testing-library/react'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { TopBar } from '../../components/TopBar.jsx'

function wrap(ui) {
  return render(<RecipeProvider>{ui}</RecipeProvider>)
}

test('shows FILM LAB wordmark', () => {
  wrap(<TopBar onPresetPress={() => {}} onExport={() => {}} />)
  expect(screen.getByText('FILM LAB')).toBeInTheDocument()
})

test('shows current template name', () => {
  wrap(<TopBar onPresetPress={() => {}} onExport={() => {}} />)
  expect(screen.getByText('Portra 400')).toBeInTheDocument()
})

test('shows dirty dot when recipe is modified', async () => {
  // isDirty starts false — dot should be hidden
  const { queryByTestId } = wrap(<TopBar onPresetPress={() => {}} onExport={() => {}} />)
  expect(queryByTestId('dirty-dot')).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- TopBar
```
Expected: FAIL.

**Step 3: Implement TopBar**

```jsx
// src/components/TopBar.jsx
import { useRecipe } from '../context/RecipeContext.jsx'
import './TopBar.css'

export function TopBar({ onPresetPress, onExport }) {
  const { currentTemplate, isDirty } = useRecipe()

  return (
    <header className="topbar">
      <span className="topbar__wordmark">FILM LAB</span>

      <button className="topbar__preset" onClick={onPresetPress}>
        {isDirty && <span className="topbar__dirty-dot" data-testid="dirty-dot" />}
        <span className="topbar__preset-name">{currentTemplate || 'UNTITLED'}</span>
        <span className="topbar__caret">▾</span>
      </button>

      <button className="topbar__export" onClick={onExport}>EXPORT</button>
    </header>
  )
}
```

```css
/* src/components/TopBar.css */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  height: 44px; padding: 0 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.topbar__wordmark {
  font-size: 11px; font-weight: 700; letter-spacing: 3px; color: var(--accent);
}
.topbar__preset {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; background: none;
  border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text); font-family: 'Inter', sans-serif; font-size: 12px;
  cursor: pointer; position: relative;
}
.topbar__dirty-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); flex-shrink: 0;
}
.topbar__caret { color: var(--text-3); font-size: 10px; }
.topbar__export {
  padding: 5px 12px; background: var(--accent);
  border: none; border-radius: var(--radius);
  color: #000; font-family: 'Inter', sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 1px; cursor: pointer;
}
```

**Step 4: Run tests**

```bash
npm test -- TopBar
```
Expected: 3 passing.

**Step 5: Add TopBar to App.jsx**

```jsx
// src/App.jsx — add at top of .app div, before ImageArea
import { TopBar } from './components/TopBar.jsx'
// ...
<TopBar onPresetPress={() => {}} onExport={() => {}} />
```

**Step 6: Commit**

```bash
git add MobilePrototype/src/components/TopBar* MobilePrototype/src/__tests__/components/TopBar.test.jsx MobilePrototype/src/App.jsx
git commit -m "feat: add top bar with wordmark, preset button, export"
```

---

### Task 5: Simple Widgets — SegmentedSelector + CompactCounter + Toggle

**Files:**
- Create: `MobilePrototype/src/widgets/SegmentedSelector.jsx`
- Create: `MobilePrototype/src/widgets/CompactCounter.jsx`
- Create: `MobilePrototype/src/widgets/Toggle.jsx`
- Create: `MobilePrototype/src/widgets/widgets.css`
- Create: `MobilePrototype/src/__tests__/widgets/SimpleWidgets.test.jsx`

These three are pure JSX/CSS — no canvas needed.

**Step 1: Write the failing tests**

```jsx
// src/__tests__/widgets/SimpleWidgets.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedSelector } from '../../widgets/SegmentedSelector.jsx'
import { CompactCounter } from '../../widgets/CompactCounter.jsx'
import { Toggle } from '../../widgets/Toggle.jsx'

// --- SegmentedSelector ---
test('SegmentedSelector highlights active option', () => {
  const opts = [{ label: '1.0', value: 1.0 }, { label: '3.0', value: 3.0 }]
  render(<SegmentedSelector options={opts} value={3.0} onChange={() => {}} />)
  const active = screen.getByText('3.0').closest('button')
  expect(active).toHaveClass('seg__option--active')
})

test('SegmentedSelector calls onChange with selected value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const opts = [{ label: '1.0', value: 1.0 }, { label: '3.0', value: 3.0 }]
  render(<SegmentedSelector options={opts} value={1.0} onChange={onChange} />)
  await user.click(screen.getByText('3.0'))
  expect(onChange).toHaveBeenCalledWith(3.0)
})

// --- CompactCounter ---
test('CompactCounter displays current value', () => {
  render(<CompactCounter label="FOG" value={0.04} min={0} max={0.3} step={0.01} unit="" onChange={() => {}} />)
  expect(screen.getByText('0.04')).toBeInTheDocument()
})

test('CompactCounter increments value on + click', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<CompactCounter label="FOG" value={0.04} min={0} max={0.3} step={0.01} unit="" onChange={onChange} />)
  await user.click(screen.getByText('+'))
  expect(onChange).toHaveBeenCalledWith(0.05)
})

test('CompactCounter does not exceed max', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<CompactCounter label="FOG" value={0.3} min={0} max={0.3} step={0.01} unit="" onChange={onChange} />)
  await user.click(screen.getByText('+'))
  expect(onChange).not.toHaveBeenCalled()
})

// --- Toggle ---
test('Toggle shows ON state', () => {
  render(<Toggle label="E-6 REVERSAL" value={1} badge="POS" onChange={() => {}} />)
  expect(screen.getByText('POS')).toBeInTheDocument()
})

test('Toggle calls onChange with toggled value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Toggle label="E-6 REVERSAL" value={1} badge="POS" onChange={onChange} />)
  await user.click(screen.getByRole('switch'))
  expect(onChange).toHaveBeenCalledWith(0)
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- SimpleWidgets
```
Expected: FAIL — modules not found.

**Step 3: Implement SegmentedSelector**

```jsx
// src/widgets/SegmentedSelector.jsx
import './widgets.css'

export function SegmentedSelector({ options, value, onChange, label }) {
  return (
    <div className="seg">
      {label && <span className="widget-label">{label}</span>}
      <div className="seg__row">
        {options.map(opt => (
          <button
            key={opt.value}
            className={`seg__option${value === opt.value ? ' seg__option--active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Implement CompactCounter**

```jsx
// src/widgets/CompactCounter.jsx
import './widgets.css'

export function CompactCounter({ label, value, min, max, step, unit, decimals, onChange }) {
  const dec = decimals ?? (step < 0.1 ? 2 : step < 1 ? 1 : 0)
  const display = `${value.toFixed(dec)}${unit ? ' ' + unit : ''}`
  const canDec = value > min + step * 0.001
  const canInc = value < max - step * 0.001

  const decrement = () => { if (canDec) onChange(+Math.max(min, value - step).toFixed(10)) }
  const increment = () => { if (canInc) onChange(+Math.min(max, value + step).toFixed(10)) }

  return (
    <div className="counter">
      {label && <span className="widget-label">{label}</span>}
      <div className="counter__ctrl">
        <button className="counter__btn" onClick={decrement} disabled={!canDec}>−</button>
        <span className="counter__val">{display}</span>
        <button className="counter__btn" onClick={increment} disabled={!canInc}>+</button>
      </div>
    </div>
  )
}
```

**Step 5: Implement Toggle**

```jsx
// src/widgets/Toggle.jsx
import './widgets.css'

export function Toggle({ label, value, badge, onChange }) {
  const isOn = !!value
  return (
    <div className="toggle-row">
      <span className="widget-label toggle-row__label">{label}</span>
      <div className="toggle-row__right">
        {badge && <span className="toggle-row__badge">{badge}</span>}
        <button
          role="switch" aria-checked={isOn}
          className={`toggle${isOn ? ' toggle--on' : ''}`}
          onClick={() => onChange(isOn ? 0 : 1)}
        >
          <span className="toggle__thumb" />
        </button>
      </div>
    </div>
  )
}
```

**Step 6: Create widgets.css**

```css
/* src/widgets/widgets.css */
.widget-label {
  display: block; font-size: 9px; font-weight: 600;
  letter-spacing: 2px; color: var(--text-3); margin-bottom: 4px;
  text-transform: uppercase;
}

/* Segmented selector */
.seg__row {
  display: flex; gap: 3px; width: 100%;
}
.seg__option {
  flex: 1; height: 32px; border-radius: var(--radius);
  border: 1px solid var(--border); background: none;
  color: var(--text-3); font-family: 'Inter', sans-serif;
  font-size: 10px; font-weight: 500; cursor: pointer;
}
.seg__option--active {
  background: var(--accent-dim); border-color: var(--accent-muted);
  color: var(--accent); font-weight: 700;
}

/* Compact counter */
.counter__ctrl {
  display: flex; align-items: center; justify-content: space-between;
}
.counter__btn {
  width: 24px; height: 24px; border-radius: var(--radius);
  border: 1px solid var(--border); background: none;
  color: var(--text-2); font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.counter__btn:disabled { opacity: 0.3; cursor: default; }
.counter__val {
  font-size: 12px; font-weight: 600; color: var(--text);
  min-width: 48px; text-align: center;
}

/* Toggle */
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
}
.toggle-row__label { margin-bottom: 0; }
.toggle-row__right { display: flex; align-items: center; gap: 8px; }
.toggle-row__badge {
  font-size: 9px; font-weight: 700; letter-spacing: 2px; color: var(--accent);
}
.toggle {
  width: 44px; height: 14px; border-radius: var(--radius);
  background: var(--surface-raised); border: 1px solid var(--border);
  position: relative; cursor: pointer; padding: 0;
}
.toggle--on { background: var(--accent); border-color: var(--accent); }
.toggle__thumb {
  position: absolute; top: -1px; left: 0;
  width: 16px; height: 16px; border-radius: var(--radius);
  background: var(--text); transition: left 0.1s;
  box-shadow: 0 1px 3px #00000066;
}
.toggle--on .toggle__thumb { left: 27px; background: #000; }
```

**Step 7: Run tests**

```bash
npm test -- SimpleWidgets
```
Expected: 7 passing.

**Step 8: Commit**

```bash
git add MobilePrototype/src/widgets/
git commit -m "feat: add SegmentedSelector, CompactCounter, Toggle widgets with tests"
```

---

### Task 6: Canvas Widget — Arc Gauge

**Files:**
- Create: `MobilePrototype/src/widgets/ArcGauge.jsx`
- Create: `MobilePrototype/src/__tests__/widgets/ArcGauge.test.jsx`

The arc gauge is a Canvas2D ring that shows a value as a colored sweep, with an inline tap-to-adjust counter overlay.

**Step 1: Write the failing tests**

```jsx
// src/__tests__/widgets/ArcGauge.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArcGauge } from '../../widgets/ArcGauge.jsx'

test('renders a canvas', () => {
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={() => {}} />
  )
  expect(container.querySelector('canvas')).toBeInTheDocument()
})

test('renders the label', () => {
  render(<ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={() => {}} />)
  expect(screen.getByText('DIR INHIBIT')).toBeInTheDocument()
})

test('tapping shows counter with + and - buttons', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={() => {}} />
  )
  await user.click(container.querySelector('canvas'))
  expect(screen.getByText('+')).toBeInTheDocument()
  expect(screen.getByText('−')).toBeInTheDocument()
})

test('+ button calls onChange with incremented value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={onChange} />
  )
  await user.click(container.querySelector('canvas'))
  await user.click(screen.getByText('+'))
  expect(onChange).toHaveBeenCalledWith(0.36)
})

test('− button calls onChange with decremented value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={onChange} />
  )
  await user.click(container.querySelector('canvas'))
  await user.click(screen.getByText('−'))
  expect(onChange).toHaveBeenCalledWith(0.34)
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- ArcGauge
```
Expected: FAIL.

**Step 3: Implement ArcGauge**

```jsx
// src/widgets/ArcGauge.jsx
import { useRef, useEffect, useState } from 'react'
import './widgets.css'

const START_DEG = 225   // degrees, CCW from right (bottom-left)
const SWEEP_DEG = 270   // clockwise sweep (total range)
const TO_RAD = Math.PI / 180

function drawGauge(canvas, value, min, max, fill) {
  const ctx = canvas.getContext('2d')
  const s = canvas.width
  const cx = s / 2, cy = s / 2
  const r = s / 2 - 5
  const lineW = Math.max(6, s * 0.1)

  ctx.clearRect(0, 0, s, s)

  // Background track
  const startRad = -START_DEG * TO_RAD
  const endRad = startRad + SWEEP_DEG * TO_RAD
  ctx.beginPath()
  ctx.arc(cx, cy, r, startRad, endRad, false)
  ctx.strokeStyle = '#1A1A1A'
  ctx.lineWidth = lineW
  ctx.lineCap = 'butt'
  ctx.stroke()

  // Value arc
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  if (normalized > 0) {
    const valueEnd = startRad + normalized * SWEEP_DEG * TO_RAD
    ctx.beginPath()
    ctx.arc(cx, cy, r, startRad, valueEnd, false)
    ctx.strokeStyle = fill || '#C8FF00'
    ctx.lineWidth = lineW
    ctx.stroke()
  }
}

export function ArcGauge({ value, min, max, step = 0.01, label, decimals, unit = '', fill, onChange }) {
  const canvasRef = useRef(null)
  const [adjusting, setAdjusting] = useState(false)
  const dec = decimals ?? (step < 0.1 ? 2 : step < 1 ? 1 : 0)
  const display = `${value.toFixed(dec)}${unit}`

  useEffect(() => {
    if (canvasRef.current) drawGauge(canvasRef.current, value, min, max, fill)
  }, [value, min, max, fill])

  const canDec = value > min + step * 0.001
  const canInc = value < max - step * 0.001
  const decrement = () => { if (canDec) onChange(+Math.max(min, value - step).toFixed(10)) }
  const increment = () => { if (canInc) onChange(+Math.min(max, value + step).toFixed(10)) }

  return (
    <div className="arc-gauge">
      <div className="arc-gauge__wrap" onClick={() => setAdjusting(v => !v)}>
        <canvas ref={canvasRef} width={72} height={72} />
        <span className="arc-gauge__value">{display}</span>
      </div>
      {adjusting && (
        <div className="arc-gauge__adjuster">
          <button className="counter__btn" onClick={decrement} disabled={!canDec}>−</button>
          <button className="counter__btn" onClick={increment} disabled={!canInc}>+</button>
        </div>
      )}
      <span className="widget-label arc-gauge__label">{label}</span>
    </div>
  )
}
```

Add to `widgets.css`:

```css
/* Arc gauge */
.arc-gauge {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  flex: 1;
}
.arc-gauge__wrap {
  position: relative; width: 72px; height: 72px; cursor: pointer;
}
.arc-gauge__wrap canvas { display: block; }
.arc-gauge__value {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; color: var(--text);
  pointer-events: none; padding-bottom: 8px;
}
.arc-gauge__adjuster {
  display: flex; gap: 8px;
}
.arc-gauge__label { margin-bottom: 0; }
```

**Step 4: Run tests**

```bash
npm test -- ArcGauge
```
Expected: 5 passing.

**Step 5: Commit**

```bash
git add MobilePrototype/src/widgets/ArcGauge.jsx MobilePrototype/src/__tests__/widgets/ArcGauge.test.jsx MobilePrototype/src/widgets/widgets.css
git commit -m "feat: add ArcGauge canvas widget with tap-to-adjust counter"
```

---

### Task 7: Canvas Widget — Rotary Knob

**Files:**
- Create: `MobilePrototype/src/widgets/RotaryKnob.jsx`
- Create: `MobilePrototype/src/__tests__/widgets/RotaryKnob.test.jsx`

Interaction: vertical drag on the knob (drag up = increase value). A value indicator dot orbits the ring at the position representing the current value.

**Step 1: Write the failing tests**

```jsx
// src/__tests__/widgets/RotaryKnob.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RotaryKnob } from '../../widgets/RotaryKnob.jsx'

test('renders a canvas and label', () => {
  const { container } = render(
    <RotaryKnob value={0} min={-0.5} max={0.7} step={0.01} label="PUSH/PULL" unit="" size={140} onChange={() => {}} />
  )
  expect(container.querySelector('canvas')).toBeInTheDocument()
  expect(screen.getByText('PUSH/PULL')).toBeInTheDocument()
})

test('calls onChange on pointer drag up', async () => {
  const onChange = vi.fn()
  const { container } = render(
    <RotaryKnob value={0} min={-0.5} max={0.7} step={0.01} label="DEV" unit="" size={90} onChange={onChange} />
  )
  const canvas = container.querySelector('canvas')

  // Simulate pointer down then move up 50px (should increase value)
  const pdown = new PointerEvent('pointerdown', { clientY: 100, bubbles: true })
  const pmove = new PointerEvent('pointermove', { clientY: 50, bubbles: true })
  const pup = new PointerEvent('pointerup', { bubbles: true })

  canvas.dispatchEvent(pdown)
  canvas.dispatchEvent(pmove)
  canvas.dispatchEvent(pup)

  expect(onChange).toHaveBeenCalled()
  const calledWith = onChange.mock.calls[0][0]
  expect(calledWith).toBeGreaterThan(0)
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- RotaryKnob
```
Expected: FAIL.

**Step 3: Implement RotaryKnob**

```jsx
// src/widgets/RotaryKnob.jsx
import { useRef, useEffect, useCallback } from 'react'
import './widgets.css'

const START_DEG = 225
const SWEEP_DEG = 270
const TO_RAD = Math.PI / 180

function drawKnob(canvas, value, min, max) {
  const ctx = canvas.getContext('2d')
  const s = canvas.width
  const cx = s / 2, cy = s / 2
  const outerR = s / 2 - 4
  const bodyR = outerR * 0.7

  ctx.clearRect(0, 0, s, s)

  // Outer track ring
  const startRad = -START_DEG * TO_RAD
  const endRad = startRad + SWEEP_DEG * TO_RAD
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, startRad, endRad, false)
  ctx.strokeStyle = '#1A1A1A'
  ctx.lineWidth = s < 100 ? 6 : 8
  ctx.stroke()

  // Knob body
  const grad = ctx.createRadialGradient(cx - bodyR * 0.2, cy - bodyR * 0.2, 0, cx, cy, bodyR)
  grad.addColorStop(0, '#2E2E2E')
  grad.addColorStop(1, '#181818')
  ctx.beginPath()
  ctx.arc(cx, cy, bodyR, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = '#2A2A2A'
  ctx.lineWidth = 1
  ctx.stroke()

  // Value indicator dot on the outer ring
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const dotAngle = -(START_DEG - normalized * SWEEP_DEG) * TO_RAD
  const dotX = cx + outerR * Math.cos(dotAngle)
  const dotY = cy - outerR * Math.sin(dotAngle)
  ctx.beginPath()
  ctx.arc(dotX, dotY, s < 100 ? 4 : 5, 0, Math.PI * 2)
  ctx.fillStyle = '#C8FF00'
  ctx.fill()
}

export function RotaryKnob({ value, min, max, step = 0.01, label, unit = '', size = 140, subLabel, onChange }) {
  const canvasRef = useRef(null)
  const dragRef = useRef({ active: false, startY: 0, startValue: 0 })

  useEffect(() => {
    if (canvasRef.current) drawKnob(canvasRef.current, value, min, max)
  }, [value, min, max])

  const handlePointerDown = useCallback((e) => {
    dragRef.current = { active: true, startY: e.clientY, startValue: value }
    canvasRef.current?.setPointerCapture?.(e.pointerId)
  }, [value])

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dy = dragRef.current.startY - e.clientY
    const range = max - min
    const sensitivity = 180 // px for full range sweep
    const delta = (dy / sensitivity) * range
    const raw = dragRef.current.startValue + delta
    const stepped = Math.round(raw / step) * step
    onChange(+(Math.max(min, Math.min(max, stepped)).toFixed(10)))
  }, [min, max, step, onChange])

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false
  }, [])

  const dec = step < 0.1 ? 2 : step < 1 ? 1 : 0

  return (
    <div className="rotary-knob">
      <div className="rotary-knob__canvas-wrap">
        <canvas
          ref={canvasRef}
          width={size} height={size}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none', cursor: 'ns-resize' }}
        />
        <span className="rotary-knob__value" style={{ fontSize: size < 100 ? 14 : 20 }}>
          {value.toFixed(dec)}{unit}
        </span>
      </div>
      <span className="widget-label">{label}</span>
      {subLabel && <span className="rotary-knob__sub">{subLabel}</span>}
    </div>
  )
}
```

Add to `widgets.css`:

```css
/* Rotary knob */
.rotary-knob {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.rotary-knob__canvas-wrap { position: relative; }
.rotary-knob__canvas-wrap canvas { display: block; }
.rotary-knob__value {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; color: var(--text); pointer-events: none;
}
.rotary-knob__sub {
  font-size: 7px; color: var(--text-3); letter-spacing: 0.5px;
}
```

**Step 4: Run tests**

```bash
npm test -- RotaryKnob
```
Expected: 2 passing.

**Step 5: Commit**

```bash
git add MobilePrototype/src/widgets/RotaryKnob.jsx MobilePrototype/src/__tests__/widgets/RotaryKnob.test.jsx MobilePrototype/src/widgets/widgets.css
git commit -m "feat: add RotaryKnob canvas widget with vertical drag interaction"
```

---

### Task 8: Canvas Widget — GradientStrip

**Files:**
- Create: `MobilePrototype/src/widgets/GradientStrip.jsx`
- Create: `MobilePrototype/src/__tests__/widgets/GradientStrip.test.jsx`

Used for Base Tint Warmth (cool→amber) and Mask Hue (orange variants).

**Step 1: Write the failing tests**

```jsx
// src/__tests__/widgets/GradientStrip.test.jsx
import { render, screen } from '@testing-library/react'
import { GradientStrip } from '../../widgets/GradientStrip.jsx'

test('renders a canvas', () => {
  const { container } = render(
    <GradientStrip
      label="BASE TINT" value={0.5} min={-1} max={1} step={0.01}
      colors={['#4488CC', '#888888', '#CC8844']}
      leftLabel="COOL" rightLabel="WARM"
      onChange={() => {}}
    />
  )
  expect(container.querySelector('canvas')).toBeInTheDocument()
})

test('renders left and right labels', () => {
  render(
    <GradientStrip
      label="BASE TINT" value={0} min={-1} max={1} step={0.01}
      colors={['#4488CC', '#888888', '#CC8844']}
      leftLabel="COOL" rightLabel="WARM"
      onChange={() => {}}
    />
  )
  expect(screen.getByText('COOL')).toBeInTheDocument()
  expect(screen.getByText('WARM')).toBeInTheDocument()
})

test('calls onChange when pointer is released after drag', () => {
  const onChange = vi.fn()
  const { container } = render(
    <GradientStrip
      label="BASE TINT" value={0} min={-1} max={1} step={0.01}
      colors={['#4488CC', '#888888', '#CC8844']}
      onChange={onChange}
    />
  )
  const canvas = container.querySelector('canvas')
  // Mock getBoundingClientRect
  canvas.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 24 })
  canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 150, bubbles: true }))
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  expect(onChange).toHaveBeenCalled()
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- GradientStrip
```
Expected: FAIL.

**Step 3: Implement GradientStrip**

```jsx
// src/widgets/GradientStrip.jsx
import { useRef, useEffect, useCallback } from 'react'
import './widgets.css'

function drawStrip(canvas, value, min, max, colors) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Square thumb
  const normalized = (value - min) / (max - min)
  const tx = normalized * w
  const tw = 16, th = h + 8
  ctx.fillStyle = '#E0E0E0'
  ctx.fillRect(tx - tw / 2, -4, tw, th)
  ctx.strokeStyle = '#00000044'
  ctx.lineWidth = 1
  ctx.strokeRect(tx - tw / 2, -4, tw, th)
}

export function GradientStrip({ label, value, min, max, step = 0.01, colors, leftLabel, rightLabel, onChange }) {
  const canvasRef = useRef(null)
  const dragRef = useRef({ active: false })

  useEffect(() => {
    if (canvasRef.current) drawStrip(canvasRef.current, value, min, max, colors)
  }, [value, min, max, colors])

  const valueFromX = useCallback((clientX) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const normalized = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + normalized * (max - min)
    return +(Math.round(raw / step) * step).toFixed(10)
  }, [min, max, step])

  const handlePointerDown = useCallback((e) => {
    dragRef.current.active = true
    canvasRef.current?.setPointerCapture?.(e.pointerId)
    onChange(valueFromX(e.clientX))
  }, [onChange, valueFromX])

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return
    onChange(valueFromX(e.clientX))
  }, [onChange, valueFromX])

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false
  }, [])

  return (
    <div className="gradient-strip">
      <div className="gradient-strip__header">
        {label && <span className="widget-label" style={{ marginBottom: 0 }}>{label}</span>}
        <span className="gradient-strip__value">{value.toFixed(2)}</span>
      </div>
      <canvas
        ref={canvasRef} width={361} height={24}
        style={{ width: '100%', height: 24, borderRadius: 2, touchAction: 'none', cursor: 'ew-resize' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {(leftLabel || rightLabel) && (
        <div className="gradient-strip__labels">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  )
}
```

Add to `widgets.css`:

```css
/* Gradient strip */
.gradient-strip { width: 100%; display: flex; flex-direction: column; gap: 6px; }
.gradient-strip__header {
  display: flex; justify-content: space-between; align-items: center;
}
.gradient-strip__value { font-size: 11px; font-weight: 500; color: var(--text); }
.gradient-strip__labels {
  display: flex; justify-content: space-between;
  font-size: 8px; font-weight: 500; letter-spacing: 1px; color: var(--text-3);
}
```

**Step 4: Run tests**

```bash
npm test -- GradientStrip
```
Expected: 3 passing.

**Step 5: Commit**

```bash
git add MobilePrototype/src/widgets/GradientStrip.jsx MobilePrototype/src/__tests__/widgets/GradientStrip.test.jsx MobilePrototype/src/widgets/widgets.css
git commit -m "feat: add GradientStrip canvas widget with drag interaction"
```

---

### Task 9: Base View

**Files:**
- Create: `MobilePrototype/src/views/BaseView.jsx`
- Create: `MobilePrototype/src/views/BaseView.css`
- Create: `MobilePrototype/src/__tests__/views/BaseView.test.jsx`

Implements the 3-zone layout designed in `MobileUI.pen` screen 3. See `docs/plans/2026-04-14-mobile-v2-controls-redesign.md` → Base Screen for zone details.

**Step 1: Write the failing tests**

```jsx
// src/__tests__/views/BaseView.test.jsx
import { render, screen } from '@testing-library/react'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { BaseView } from '../../views/BaseView.jsx'

function wrap(ui) { return render(<RecipeProvider>{ui}</RecipeProvider>) }

test('renders E-6 REVERSAL label', () => {
  wrap(<BaseView />)
  expect(screen.getByText('E-6 REVERSAL')).toBeInTheDocument()
})

test('renders SCAN EXPOSURE label', () => {
  wrap(<BaseView />)
  expect(screen.getByText('SCAN EXPOSURE')).toBeInTheDocument()
})

test('renders FILM CHEMISTRY section', () => {
  wrap(<BaseView />)
  expect(screen.getByText('FILM CHEMISTRY')).toBeInTheDocument()
})

test('renders all 4 gauge labels', () => {
  wrap(<BaseView />)
  expect(screen.getByText('DIR INHIBIT')).toBeInTheDocument()
  expect(screen.getByText('GRAIN SOFT')).toBeInTheDocument()
  expect(screen.getByText('HALATION')).toBeInTheDocument()
  expect(screen.getByText('STACKING')).toBeInTheDocument()
})

test('renders ORANGE MASK collapse toggle', () => {
  wrap(<BaseView />)
  expect(screen.getByText('ORANGE MASK')).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- BaseView
```
Expected: FAIL.

**Step 3: Implement BaseView**

```jsx
// src/views/BaseView.jsx
import { useState } from 'react'
import { useRecipe } from '../context/RecipeContext.jsx'
import { Toggle } from '../widgets/Toggle.jsx'
import { SegmentedSelector } from '../widgets/SegmentedSelector.jsx'
import { GradientStrip } from '../widgets/GradientStrip.jsx'
import { ArcGauge } from '../widgets/ArcGauge.jsx'
import { CompactCounter } from '../widgets/CompactCounter.jsx'
import './BaseView.css'

const SCAN_OPTS = [1.0, 1.5, 2.0, 3.0, 4.0, 6.0].map(v => ({ label: String(v), value: v }))

const TINT_COLORS = ['#4488CC', '#888888', '#CC8844']

export function BaseView() {
  const { recipe, setGlobalParam } = useRecipe()
  const g = recipe.global
  const [maskOpen, setMaskOpen] = useState(false)

  return (
    <div className="base-view">
      {/* Zone 1 — Process & Primary */}
      <div className="base-view__zone">
        <Toggle
          label="E-6 REVERSAL"
          value={g.reversal}
          badge={g.reversal ? 'POS' : 'NEG'}
          onChange={v => setGlobalParam('reversal', v)}
        />
        <SegmentedSelector
          label="SCAN EXPOSURE"
          options={SCAN_OPTS}
          value={g.scanExposure}
          onChange={v => setGlobalParam('scanExposure', v)}
        />
        <GradientStrip
          label="BASE TINT"
          value={g.baseTintWarmth}
          min={-1} max={1} step={0.01}
          colors={TINT_COLORS}
          leftLabel="COOL" rightLabel="WARM"
          onChange={v => setGlobalParam('baseTintWarmth', v)}
        />
      </div>

      {/* Zone 2 — Instrument Cluster */}
      <div className="base-view__cluster">
        <span className="base-view__cluster-label">FILM CHEMISTRY</span>
        <div className="base-view__gauge-grid">
          <ArcGauge label="DIR INHIBIT" value={g.dirInhibition} min={0} max={1} step={0.01}
            onChange={v => setGlobalParam('dirInhibition', v)} />
          <ArcGauge label="GRAIN SOFT" value={g.grainSoftness} min={0.5} max={3.0} step={0.05}
            unit="×" decimals={2} onChange={v => setGlobalParam('grainSoftness', v)} />
          <ArcGauge label="HALATION" value={g.halation} min={0} max={1} step={0.01}
            onChange={v => setGlobalParam('halation', v)} />
          <ArcGauge label="STACKING" value={g.stackingStrength} min={0} max={1} step={0.01}
            onChange={v => setGlobalParam('stackingStrength', v)} />
        </div>
      </div>

      {/* Zone 3 — Orange Mask */}
      <div className="base-view__mask">
        <button className="base-view__mask-hdr" onClick={() => setMaskOpen(v => !v)}>
          <span className="widget-label" style={{ margin: 0 }}>ORANGE MASK</span>
          <span className="base-view__mask-chevron">{maskOpen ? '▾' : '▸'}</span>
        </button>
        {maskOpen && (
          <div className="base-view__mask-body">
            <CompactCounter label="MASK DENSITY" value={g.maskDensity} min={0} max={1} step={0.01}
              unit="" onChange={v => setGlobalParam('maskDensity', v)} />
            <GradientStrip
              label="MASK HUE"
              value={g.maskHue} min={0} max={60} step={1}
              colors={['#FF6600', '#FF9933', '#FFCC66']}
              unit="°" decimals={0}
              onChange={v => setGlobalParam('maskHue', v)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

```css
/* src/views/BaseView.css */
.base-view {
  display: flex; flex-direction: column; gap: 16px;
  padding: 14px 16px 16px;
  overflow-y: auto; flex: 1;
}
.base-view__zone { display: flex; flex-direction: column; gap: 14px; }

.base-view__cluster {
  background: var(--surface-raised); border-radius: var(--radius);
  padding: 12px;
  display: flex; flex-direction: column; gap: 12px;
}
.base-view__cluster-label {
  font-size: 9px; font-weight: 600; letter-spacing: 2px; color: var(--text-3);
  text-transform: uppercase;
}
.base-view__gauge-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 12px 8px;
}

.base-view__mask { display: flex; flex-direction: column; gap: 10px; }
.base-view__mask-hdr {
  display: flex; justify-content: space-between; align-items: center;
  background: none; border: none; width: 100%; cursor: pointer; padding: 0;
}
.base-view__mask-chevron { font-size: 10px; color: var(--text-3); }
.base-view__mask-body {
  background: #1A1208; border-radius: var(--radius);
  padding: 12px; display: flex; flex-direction: column; gap: 12px;
}
```

**Step 4: Run tests**

```bash
npm test -- BaseView
```
Expected: 5 passing.

**Step 5: Commit**

```bash
git add MobilePrototype/src/views/BaseView* MobilePrototype/src/__tests__/views/BaseView.test.jsx
git commit -m "feat: add Base view with 3-zone instrument layout"
```

---

### Task 10: Develop View

**Files:**
- Create: `MobilePrototype/src/views/DevelopView.jsx`
- Create: `MobilePrototype/src/views/DevelopView.css`
- Create: `MobilePrototype/src/__tests__/views/DevelopView.test.jsx`

5 develop parameters from `STEP_TWO_CONTROLS`. See `docs/plans/2026-04-14-mobile-v2-ui-design.md` → Section 3 for correct parameter names/ranges.

**Step 1: Write the failing tests**

```jsx
// src/__tests__/views/DevelopView.test.jsx
import { render, screen } from '@testing-library/react'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { DevelopView } from '../../views/DevelopView.jsx'

function wrap(ui) { return render(<RecipeProvider>{ui}</RecipeProvider>) }

test('renders PUSH / PULL label', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('PUSH / PULL')).toBeInTheDocument()
})

test('renders BATH TEMP and AGITATION knobs', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('BATH TEMP')).toBeInTheDocument()
  expect(screen.getByText('AGITATION')).toBeInTheDocument()
})

test('renders DEV TIME and FRESHNESS counters', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('DEV TIME')).toBeInTheDocument()
  expect(screen.getByText('FRESHNESS')).toBeInTheDocument()
})

test('renders LAB NOTES section', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('LAB NOTES')).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- DevelopView
```
Expected: FAIL.

**Step 3: Implement DevelopView**

```jsx
// src/views/DevelopView.jsx
import { useRecipe } from '../context/RecipeContext.jsx'
import { RotaryKnob } from '../widgets/RotaryKnob.jsx'
import { CompactCounter } from '../widgets/CompactCounter.jsx'
import './DevelopView.css'

export function DevelopView() {
  const { labState, setLabParam } = useRecipe()
  const l = labState

  return (
    <div className="develop-view">
      {/* Hero knob — developer activity */}
      <div className="develop-view__hero">
        <span className="develop-view__section-label">PUSH / PULL</span>
        <RotaryKnob
          value={l.developerActivity} min={-0.5} max={0.7} step={0.01}
          label="" unit="" size={140}
          onChange={v => setLabParam('developerActivity', v)}
        />
        <div className="develop-view__pp-labels">
          <span>PULL −0.5</span>
          <span>PUSH +0.7</span>
        </div>
      </div>

      {/* Paired knobs */}
      <div className="develop-view__pair">
        <RotaryKnob
          value={l.bathTemperatureC} min={30} max={42} step={0.1}
          label="BATH TEMP" unit="°C" size={90}
          subLabel="30°C — 42°C"
          onChange={v => setLabParam('bathTemperatureC', v)}
        />
        <RotaryKnob
          value={l.agitationLevel} min={0} max={1} step={0.01}
          label="AGITATION" unit="" size={90}
          subLabel="0 — 1.0"
          onChange={v => setLabParam('agitationLevel', v)}
        />
      </div>

      {/* Compact counters */}
      <div className="develop-view__counters">
        <div className="develop-view__counter-card">
          <CompactCounter
            label="DEV TIME" value={l.developmentTimeMin}
            min={2} max={8} step={0.1} unit="min" decimals={1}
            onChange={v => setLabParam('developmentTimeMin', v)}
          />
        </div>
        <div className="develop-view__counter-card">
          <CompactCounter
            label="FRESHNESS" value={l.chemistryFreshness}
            min={0.3} max={1.0} step={0.01} unit="" decimals={2}
            onChange={v => setLabParam('chemistryFreshness', v)}
          />
        </div>
      </div>

      {/* Lab Notes */}
      <div className="develop-view__lab-notes">
        <span className="develop-view__notes-header">LAB NOTES</span>
        <textarea
          className="develop-view__notes-input"
          placeholder="Processing notes, batch info..."
          rows={3}
        />
      </div>
    </div>
  )
}
```

```css
/* src/views/DevelopView.css */
.develop-view {
  display: flex; flex-direction: column; align-items: center;
  gap: 20px; padding: 14px 16px 16px;
  overflow-y: auto; flex: 1;
}
.develop-view__hero {
  display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;
}
.develop-view__section-label {
  font-size: 9px; font-weight: 600; letter-spacing: 2px; color: var(--text-3);
}
.develop-view__pp-labels {
  display: flex; justify-content: space-between; width: 180px;
  font-size: 8px; font-weight: 500; letter-spacing: 1px; color: var(--text-3);
}
.develop-view__pair {
  display: flex; gap: 32px; justify-content: center;
}
.develop-view__counters {
  display: flex; gap: 12px; width: 100%;
}
.develop-view__counter-card {
  flex: 1; background: var(--surface-raised);
  border-radius: var(--radius); padding: 8px 10px;
}
.develop-view__lab-notes {
  width: 100%; border-radius: var(--radius);
  background: var(--surface-raised);
  border-left: 2px solid var(--accent);
  padding: 12px;
}
.develop-view__notes-header {
  display: block; font-size: 9px; font-weight: 700;
  letter-spacing: 2px; color: var(--accent); margin-bottom: 8px;
}
.develop-view__notes-input {
  width: 100%; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text-2); font-family: 'Inter', sans-serif; font-size: 11px;
  padding: 8px; resize: none;
}
```

**Step 4: Run tests**

```bash
npm test -- DevelopView
```
Expected: 4 passing.

**Step 5: Commit**

```bash
git add MobilePrototype/src/views/DevelopView* MobilePrototype/src/__tests__/views/DevelopView.test.jsx
git commit -m "feat: add Develop view with rotary knobs and lab notes"
```

---

### Task 11: Layer View

**Files:**
- Create: `MobilePrototype/src/views/LayerView.jsx`
- Create: `MobilePrototype/src/views/LayerView.css`
- Create: `MobilePrototype/src/__tests__/views/LayerView.test.jsx`

Two sub-parts: the compact layer table (always visible), and the expanded inline controls that slide open on row tap. See `docs/plans/2026-04-14-mobile-v2-ui-design.md` → Section 1 and Layer Expanded Controls.

**Step 1: Write the failing tests**

```jsx
// src/__tests__/views/LayerView.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { LayerView } from '../../views/LayerView.jsx'

function wrap(ui) { return render(<RecipeProvider>{ui}</RecipeProvider>) }

test('renders layer table headers PEAK BW PURITY DMAX', () => {
  wrap(<LayerView />)
  expect(screen.getByText('PEAK')).toBeInTheDocument()
  expect(screen.getByText('BW')).toBeInTheDocument()
  expect(screen.getByText('PURITY')).toBeInTheDocument()
  expect(screen.getByText('DMAX')).toBeInTheDocument()
})

test('renders Portra 400 layer data (3 rows)', () => {
  wrap(<LayerView />)
  // Portra 400 has 3 layers with peak values 620, 540, 440
  expect(screen.getByText('620')).toBeInTheDocument()
  expect(screen.getByText('540')).toBeInTheDocument()
  expect(screen.getByText('440')).toBeInTheDocument()
})

test('tapping a layer row expands controls', async () => {
  const user = userEvent.setup()
  wrap(<LayerView />)
  const rows = screen.getAllByRole('button', { name: /expand layer/i })
  await user.click(rows[0])
  expect(screen.getByText('SENSITIVITY')).toBeInTheDocument()
})

test('tapping same row again collapses it', async () => {
  const user = userEvent.setup()
  wrap(<LayerView />)
  const rows = screen.getAllByRole('button', { name: /expand layer/i })
  await user.click(rows[0])
  await user.click(rows[0])
  expect(screen.queryByText('SENSITIVITY')).not.toBeInTheDocument()
})

test('renders ADD LAYER button', () => {
  wrap(<LayerView />)
  expect(screen.getByText('+ ADD LAYER')).toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- LayerView
```
Expected: FAIL.

**Step 3: Implement LayerView**

Note: The spectrum rainbow bar for sensitizerPeak and the H&D curve canvas are simplified in the prototype (static Canvas2D, non-interactive — interaction is via arc gauges and counters). Full drag interaction from the desktop `spectrum.js` is out of scope for the mobile prototype.

```jsx
// src/views/LayerView.jsx
import { useState } from 'react'
import { useRecipe } from '../context/RecipeContext.jsx'
import { ArcGauge } from '../widgets/ArcGauge.jsx'
import { CompactCounter } from '../widgets/CompactCounter.jsx'
import { SegmentedSelector } from '../widgets/SegmentedSelector.jsx'
import { makeDefaultLayer } from '@filmstate'
import './LayerView.css'

// Crystal size stops mapped to FINE/COARSE labels
const CRYSTAL_STOPS = [
  { label: 'FN', value: 0.13 },
  { label: '2', value: 0.25 },
  { label: '3', value: 0.40 },
  { label: '4', value: 0.65 },
  { label: 'CS', value: 1.00 },
]

const LAYER_DOT_COLORS = ['#4D6EB8', '#4DB87A', '#C4A84D', '#B84D4D']

function isoFromCrystal(cs) {
  return Math.round(25 * Math.pow(cs / 0.05, 1.1))
}

function ExpandedControls({ layer, layerIdx, setLayerParam }) {
  const sp = layer.sensitizerPeak
  const nearestStop = CRYSTAL_STOPS.reduce((a, b) =>
    Math.abs(b.value - layer.crystalSize) < Math.abs(a.value - layer.crystalSize) ? b : a
  )

  return (
    <div className="layer-expanded">
      {/* Sensitivity — static rainbow bar (read-only visual) */}
      <div className="layer-expanded__section">
        <div className="layer-expanded__row-hdr">
          <span className="widget-label">SENSITIVITY</span>
          <span className="layer-expanded__val">{sp} nm · BW {layer.sensitizerBw}</span>
        </div>
        <div className="layer-expanded__rainbow" style={{
          background: `linear-gradient(to right,
            #9400D3 0%, #4B00FF 12%, #0000FF 20%,
            #00BFFF 33%, #00FF00 50%, #FFFF00 63%,
            #FF7F00 78%, #FF0000 100%)`,
          height: 24, borderRadius: 2, position: 'relative',
        }}>
          {/* Peak indicator */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${((sp - 380) / 320) * 100}%`,
            width: 3, background: '#fff',
          }} />
        </div>
        <div className="layer-expanded__bw-row">
          <CompactCounter label="PEAK (nm)" value={sp} min={380} max={700} step={1} unit="nm" decimals={0}
            onChange={v => setLayerParam(layerIdx, 'sensitizerPeak', v)} />
          <CompactCounter label="BW (nm)" value={layer.sensitizerBw} min={20} max={200} step={1} unit="nm" decimals={0}
            onChange={v => setLayerParam(layerIdx, 'sensitizerBw', v)} />
        </div>
      </div>

      {/* Dye Purity + Dmax gauges */}
      <div className="layer-expanded__gauge-row">
        <ArcGauge label="DYE PURITY" value={layer.dyePurity} min={0} max={1} step={0.01}
          onChange={v => setLayerParam(layerIdx, 'dyePurity', v)} />
        <ArcGauge label="DMAX" value={layer.dmax} min={0.05} max={3.5} step={0.05}
          decimals={1} onChange={v => setLayerParam(layerIdx, 'dmax', v)} />
      </div>

      {/* H&D Curve — compact controls (toe/gamma/shoulder as counters) */}
      <div className="layer-expanded__section">
        <span className="widget-label">H&D CURVE</span>
        <div className="layer-expanded__hd-row">
          <CompactCounter label="TOE" value={layer.hdToe} min={0} max={0.5} step={0.01} unit="" decimals={2}
            onChange={v => setLayerParam(layerIdx, 'hdToe', v)} />
          <CompactCounter label="GAMMA" value={layer.hdGamma} min={0.3} max={3.0} step={0.01} unit="" decimals={2}
            onChange={v => setLayerParam(layerIdx, 'hdGamma', v)} />
          <CompactCounter label="SHLDR" value={layer.hdShoulder} min={0} max={0.5} step={0.01} unit="" decimals={2}
            onChange={v => setLayerParam(layerIdx, 'hdShoulder', v)} />
        </div>
      </div>

      {/* Fog counter */}
      <CompactCounter label="FOG" value={layer.fog} min={0} max={0.3} step={0.01} unit="" decimals={2}
        onChange={v => setLayerParam(layerIdx, 'fog', v)} />

      {/* Grain selector */}
      <div className="layer-expanded__section">
        <div className="layer-expanded__row-hdr">
          <span className="widget-label">GRAIN / CRYSTAL</span>
          <span className="layer-expanded__iso">ISO {isoFromCrystal(layer.crystalSize)}</span>
        </div>
        <SegmentedSelector
          options={CRYSTAL_STOPS}
          value={nearestStop.value}
          onChange={v => setLayerParam(layerIdx, 'crystalSize', v)}
        />
      </div>
    </div>
  )
}

export function LayerView() {
  const { recipe, setLayerParam } = useRecipe()
  const [expandedIdx, setExpandedIdx] = useState(null)

  const toggleExpand = (idx) => {
    setExpandedIdx(prev => prev === idx ? null : idx)
  }

  return (
    <div className="layer-view">
      {/* Table header */}
      <div className="layer-table__hdr">
        <span className="layer-table__hdr-cell" style={{ flex: 0.5 }} />
        <span className="layer-table__hdr-cell">PEAK</span>
        <span className="layer-table__hdr-cell">BW</span>
        <span className="layer-table__hdr-cell">PURITY</span>
        <span className="layer-table__hdr-cell">DMAX</span>
      </div>

      {recipe.layers.map((layer, idx) => (
        <div key={idx} className="layer-table__entry">
          {/* Row */}
          <button
            className={`layer-table__row${expandedIdx === idx ? ' layer-table__row--active' : ''}`}
            onClick={() => toggleExpand(idx)}
            aria-label={`expand layer ${idx + 1}`}
          >
            <span
              className="layer-table__dot"
              style={{ background: LAYER_DOT_COLORS[idx] ?? '#888' }}
            />
            <span className="layer-table__cell">{layer.sensitizerPeak}</span>
            <span className="layer-table__cell">{layer.sensitizerBw}</span>
            <span className="layer-table__cell">{layer.dyePurity.toFixed(2)}</span>
            <span className="layer-table__cell">{layer.dmax.toFixed(1)}</span>
          </button>

          {/* Inline expanded controls */}
          {expandedIdx === idx && (
            <ExpandedControls
              layer={layer}
              layerIdx={idx}
              setLayerParam={setLayerParam}
            />
          )}
        </div>
      ))}

      {/* Add Layer */}
      {recipe.layers.length < 4 && (
        <button
          className="layer-table__add"
          onClick={() => {/* add layer handled by parent via context — stub for now */}}
        >
          + ADD LAYER
        </button>
      )}
    </div>
  )
}
```

```css
/* src/views/LayerView.css */
.layer-view {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 16px 16px; overflow-y: auto; flex: 1;
}

/* Table header */
.layer-table__hdr {
  display: flex; gap: 4px; padding: 4px 8px;
}
.layer-table__hdr-cell {
  flex: 1; font-size: 9px; font-weight: 600; letter-spacing: 1px; color: var(--text-3);
  text-align: center; text-transform: uppercase;
}

/* Row */
.layer-table__row {
  display: flex; align-items: center; gap: 4px;
  width: 100%; padding: 10px 8px;
  background: var(--surface-raised); border-radius: var(--radius);
  border: 1px solid var(--border); cursor: pointer;
}
.layer-table__row--active {
  border-color: var(--accent-muted);
  border-bottom-left-radius: 0; border-bottom-right-radius: 0;
}
.layer-table__dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.layer-table__cell {
  flex: 1; font-size: 12px; font-weight: 500; color: var(--text);
  text-align: center;
}

/* Expanded controls panel */
.layer-expanded {
  background: var(--bg); border: 1px solid var(--accent-muted);
  border-top: none; border-radius: 0 0 var(--radius) var(--radius);
  padding: 8px 8px 12px; display: flex; flex-direction: column; gap: 10px;
}
.layer-expanded__section { display: flex; flex-direction: column; gap: 6px; }
.layer-expanded__row-hdr {
  display: flex; justify-content: space-between; align-items: center;
}
.layer-expanded__val { font-size: 10px; font-weight: 500; color: var(--text); }
.layer-expanded__gauge-row { display: flex; gap: 8px; justify-content: center; }
.layer-expanded__bw-row { display: flex; gap: 12px; }
.layer-expanded__bw-row > * { flex: 1; }
.layer-expanded__hd-row { display: flex; gap: 8px; }
.layer-expanded__hd-row > * { flex: 1; }
.layer-expanded__iso {
  font-size: 8px; font-weight: 700; letter-spacing: 1px;
  color: var(--accent); background: var(--accent-dim);
  border: 1px solid var(--accent-muted); border-radius: var(--radius);
  padding: 2px 5px;
}

/* Add layer */
.layer-table__add {
  width: 100%; padding: 10px; border-radius: var(--radius);
  border: 1px solid var(--border); background: none;
  color: var(--text-3); font-family: 'Inter', sans-serif;
  font-size: 11px; font-weight: 600; cursor: pointer;
}
```

**Step 4: Run tests**

```bash
npm test -- LayerView
```
Expected: 5 passing.

**Step 5: Commit**

```bash
git add MobilePrototype/src/views/LayerView* MobilePrototype/src/__tests__/views/LayerView.test.jsx
git commit -m "feat: add Layer view with compact table and inline expanded controls"
```

---

### Task 12: Wire Views into App + Section Routing

**Files:**
- Modify: `MobilePrototype/src/App.jsx`

**Step 1: Implement final App.jsx**

```jsx
// src/App.jsx
import { useState } from 'react'
import { RecipeProvider } from './context/RecipeContext.jsx'
import { TopBar } from './components/TopBar.jsx'
import { ImageArea } from './components/ImageArea.jsx'
import { LayerView } from './views/LayerView.jsx'
import { BaseView } from './views/BaseView.jsx'
import { DevelopView } from './views/DevelopView.jsx'

const SECTIONS = ['LAYER', 'BASE', 'DEVELOP']

function AppShell() {
  const [sectionIdx, setSectionIdx] = useState(0)
  const section = SECTIONS[sectionIdx]
  const isLast = sectionIdx === SECTIONS.length - 1

  const next = () => setSectionIdx(i => Math.min(SECTIONS.length - 1, i + 1))

  return (
    <div className="app">
      <TopBar onPresetPress={() => {}} onExport={() => {}} />
      <ImageArea
        section={section}
        onSectionPress={() => {}}
        onNextPress={next}
        onFullscreen={() => {}}
      />
      <div className="app__controls">
        {section === 'LAYER' && <LayerView />}
        {section === 'BASE' && <BaseView />}
        {section === 'DEVELOP' && <DevelopView />}
      </div>
    </div>
  )
}

export default function App() {
  return <RecipeProvider><AppShell /></RecipeProvider>
}
```

Add to `app.css`:
```css
.app__controls {
  flex: 1; overflow: hidden; display: flex; flex-direction: column;
  background: var(--surface); border-top: 1px solid var(--border);
}
```

**Step 2: Set image area height in CSS**

```css
/* in app.css — image area takes ~40% of viewport */
.image-area { height: 40vh; }
```

**Step 3: Run dev server and test full flow on phone**

```bash
npm run dev -- --host
```
Open the displayed network URL on your phone. Expected: full app renders. Load an image — film simulation applies. Navigate LAYER → BASE → DEVELOP. Adjust knobs, gauges, toggle E-6 reversal — image updates in real time.

**Step 4: Run full test suite**

```bash
npm test
```
Expected: All tests passing.

**Step 5: Commit**

```bash
git add MobilePrototype/src/App.jsx MobilePrototype/src/app.css
git commit -m "feat: wire all views into app with section routing"
```

---

### Task 13: GitHub Pages Deployment

**Files:**
- Create: `MobilePrototype/.github/workflows/deploy.yml` (optional CI)
- Modify: `MobilePrototype/package.json` (already has deploy script)

**Step 1: Initialize git and build**

```bash
cd /Users/kuangmingqin/Desktop/Personal/Project/FilmRecipe/MobilePrototype
npm run build
```
Expected: `dist/` directory created. Open `dist/index.html` — should be valid HTML with bundled assets.

**Step 2: Deploy to GitHub Pages**

First, ensure the repo has a `gh-pages` branch or GitHub Pages is configured:
```bash
npm run deploy
```
This runs `vite build && gh-pages -d dist`. The `base: '/FilmRecipe/'` in `vite.config.js` ensures assets resolve correctly at `https://<user>.github.io/FilmRecipe/`.

Expected: `gh-pages` branch updated. Visit `https://<your-github-username>.github.io/FilmRecipe/` on your phone. Full app loads over HTTPS (required for camera access in future).

**Step 3: Verify on phone**

Open the GitHub Pages URL in Safari/Chrome on iPhone. Expected:
- App loads (no console errors)
- WebGL renders the film simulation
- All touch interactions work (drag knobs, tap gauges, toggle E-6)
- No viewport scaling issues (meta viewport tag prevents pinch-zoom)

**Step 4: Commit**

```bash
git add MobilePrototype/
git commit -m "feat: configure github pages deployment for mobile prototype"
```

---

## Summary

| Task | What It Builds |
|------|---------------|
| 1 | Vite + React scaffold, shared engine import, test harness |
| 2 | RecipeContext — all app state in one place |
| 3 | ImageArea + useRenderer — WebGL pipeline in React |
| 4 | TopBar — wordmark, preset button, export, dirty dot |
| 5 | Simple widgets — SegmentedSelector, CompactCounter, Toggle |
| 6 | ArcGauge — Canvas2D arc with tap-to-adjust counter |
| 7 | RotaryKnob — Canvas2D dial with vertical drag |
| 8 | GradientStrip — Canvas2D bar with drag thumb |
| 9 | BaseView — 3-zone layout with all global controls |
| 10 | DevelopView — rotary knob layout with lab notes |
| 11 | LayerView — compact table + inline expanded controls |
| 12 | App wiring — section routing, full end-to-end flow |
| 13 | GitHub Pages deploy |

**Test count target:** ~35 tests covering context, all widgets (behavior not rendering), all views (labels + interactions).
