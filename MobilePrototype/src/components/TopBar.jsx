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
        <span className="topbar__caret" aria-hidden="true">▾</span>
      </button>

      <button className="topbar__export" onClick={onExport}>EXPORT</button>
    </header>
  )
}
