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
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
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
