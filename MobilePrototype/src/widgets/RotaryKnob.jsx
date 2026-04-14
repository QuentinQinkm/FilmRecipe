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
  ctx.lineCap = 'butt'
  ctx.stroke()

  // Knob body (radial gradient)
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

  // Value indicator dot on outer ring
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
    const dy = dragRef.current.startY - e.clientY   // positive = dragged up = increase
    const range = max - min
    const sensitivity = 180  // px for full range
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
