import { useRecipe } from '../context/RecipeContext.jsx'
import { RotaryKnob } from '../widgets/RotaryKnob.jsx'
import { CompactCounter } from '../widgets/CompactCounter.jsx'
import './DevelopView.css'

export function DevelopView() {
  const { labState, setLabParam } = useRecipe()
  const l = labState

  return (
    <div className="develop-view">
      {/* Hero knob — developer activity (push/pull) */}
      <div className="develop-view__hero">
        <span className="develop-view__section-label">PUSH / PULL</span>
        <RotaryKnob
          value={l.developerActivity}
          min={-0.5} max={0.7} step={0.01}
          label="" unit="" size={140}
          onChange={v => setLabParam('developerActivity', v)}
        />
        <div className="develop-view__pp-labels">
          <span>PULL −0.5</span>
          <span>PUSH +0.7</span>
        </div>
      </div>

      {/* Paired secondary knobs */}
      <div className="develop-view__pair">
        <RotaryKnob
          value={l.bathTemperatureC}
          min={30} max={42} step={0.1}
          label="BATH TEMP" unit="°C" size={90}
          subLabel="30°C — 42°C"
          onChange={v => setLabParam('bathTemperatureC', v)}
        />
        <RotaryKnob
          value={l.agitationLevel}
          min={0} max={1} step={0.01}
          label="AGITATION" unit="" size={90}
          subLabel="0 — 1.0"
          onChange={v => setLabParam('agitationLevel', v)}
        />
      </div>

      {/* Compact counter cards */}
      <div className="develop-view__counters">
        <div className="develop-view__counter-card">
          <CompactCounter
            label="DEV TIME"
            value={l.developmentTimeMin}
            min={2} max={8} step={0.1} unit="min" decimals={1}
            onChange={v => setLabParam('developmentTimeMin', v)}
          />
        </div>
        <div className="develop-view__counter-card">
          <CompactCounter
            label="FRESHNESS"
            value={l.chemistryFreshness}
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
