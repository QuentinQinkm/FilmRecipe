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

      {/* Zone 2 — Film Chemistry instrument cluster */}
      <div className="base-view__cluster">
        <span className="base-view__cluster-label">FILM CHEMISTRY</span>
        <div className="base-view__gauge-grid">
          <ArcGauge label="DIR INHIBIT"
            value={g.dirInhibition} min={0} max={1} step={0.01}
            onChange={v => setGlobalParam('dirInhibition', v)} />
          <ArcGauge label="GRAIN SOFT"
            value={g.grainSoftness} min={0.5} max={3.0} step={0.05}
            unit="×" decimals={2}
            onChange={v => setGlobalParam('grainSoftness', v)} />
          <ArcGauge label="HALATION"
            value={g.halation} min={0} max={1} step={0.01}
            onChange={v => setGlobalParam('halation', v)} />
          <ArcGauge label="STACKING"
            value={g.stackingStrength} min={0} max={1} step={0.01}
            onChange={v => setGlobalParam('stackingStrength', v)} />
        </div>
      </div>

      {/* Zone 3 — Orange Mask (collapsed by default) */}
      <div className="base-view__mask">
        <button className="base-view__mask-hdr" onClick={() => setMaskOpen(v => !v)}>
          <span className="widget-label" style={{ margin: 0 }}>ORANGE MASK</span>
          <span className="base-view__mask-chevron" aria-hidden="true">{maskOpen ? '▾' : '▸'}</span>
        </button>
        {maskOpen && (
          <div className="base-view__mask-body">
            <CompactCounter label="MASK DENSITY"
              value={g.maskDensity} min={0} max={1} step={0.01}
              unit="" onChange={v => setGlobalParam('maskDensity', v)} />
            <GradientStrip
              label="MASK HUE"
              value={g.maskHue} min={0} max={60} step={1}
              colors={['#FF6600', '#FF9933', '#FFCC66']}
              onChange={v => setGlobalParam('maskHue', v)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
