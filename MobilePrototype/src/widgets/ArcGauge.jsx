import { useRef, useEffect, useState } from 'react'
import './widgets.css'

const START_DEG = 225   // degrees from right, counterclockwise (bottom-left)
const SWEEP_DEG = 270   // clockwise sweep total
const TO_RAD = Math.PI / 180

function drawGauge(canvas, value, min, max, fill) {
  const ctx = canvas.getContext('2d')
  const s = canvas.width
  const cx = s / 2, cy = s / 2
  const r = s / 2 - 5
  const lineW = Math.max(6, s * 0.1)

  ctx.clearRect(0, 0, s, s)

  const startRad = -START_DEG * TO_RAD
  const endRad = startRad + SWEEP_DEG * TO_RAD

  // Background track
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
    ctx.lineCap = 'butt'
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
