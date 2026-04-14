import { useState } from 'react'
import { useRecipe } from '../context/RecipeContext.jsx'
import { ArcGauge } from '../widgets/ArcGauge.jsx'
import { CompactCounter } from '../widgets/CompactCounter.jsx'
import { SegmentedSelector } from '../widgets/SegmentedSelector.jsx'
import './LayerView.css'

const CRYSTAL_STOPS = [
  { label: 'FN', value: 0.13 },
  { label: '2',  value: 0.25 },
  { label: '3',  value: 0.40 },
  { label: '4',  value: 0.65 },
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
      {/* Sensitivity spectrum bar (read-only visual) */}
      <div className="layer-expanded__section">
        <div className="layer-expanded__row-hdr">
          <span className="widget-label">SENSITIVITY</span>
          <span className="layer-expanded__val">{sp} nm · BW {layer.sensitizerBw}</span>
        </div>
        <div className="layer-expanded__rainbow" style={{
          background: 'linear-gradient(to right, #9400D3 0%, #4B00FF 12%, #0000FF 20%, #00BFFF 33%, #00FF00 50%, #FFFF00 63%, #FF7F00 78%, #FF0000 100%)',
          height: 24, borderRadius: 2, position: 'relative',
        }}>
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

      {/* Dye Purity + Dmax arc gauges */}
      <div className="layer-expanded__gauge-row">
        <ArcGauge label="DYE PURITY" value={layer.dyePurity} min={0} max={1} step={0.01}
          onChange={v => setLayerParam(layerIdx, 'dyePurity', v)} />
        <ArcGauge label="DMAX" value={layer.dmax} min={0.05} max={3.5} step={0.05}
          decimals={1} onChange={v => setLayerParam(layerIdx, 'dmax', v)} />
      </div>

      {/* H&D Curve counters */}
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

      {/* Crystal size / grain selector */}
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
  const { recipe, setLayerParam, addLayer } = useRecipe()
  const [expandedIdx, setExpandedIdx] = useState(null)

  const toggleExpand = (idx) => setExpandedIdx(prev => prev === idx ? null : idx)

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
          <button
            className={`layer-table__row${expandedIdx === idx ? ' layer-table__row--active' : ''}`}
            onClick={() => toggleExpand(idx)}
            aria-label={`expand layer ${idx + 1}`}
          >
            <span className="layer-table__dot" style={{ background: LAYER_DOT_COLORS[idx] ?? '#888' }} />
            <span className="layer-table__cell">{layer.sensitizerPeak}</span>
            <span className="layer-table__cell">{layer.sensitizerBw}</span>
            <span className="layer-table__cell">{layer.dyePurity.toFixed(2)}</span>
            <span className="layer-table__cell">{layer.dmax.toFixed(1)}</span>
          </button>

          {expandedIdx === idx && (
            <ExpandedControls layer={layer} layerIdx={idx} setLayerParam={setLayerParam} />
          )}
        </div>
      ))}

      {recipe.layers.length < 4 && (
        <button className="layer-table__add" onClick={addLayer}>+ ADD LAYER</button>
      )}
    </div>
  )
}
