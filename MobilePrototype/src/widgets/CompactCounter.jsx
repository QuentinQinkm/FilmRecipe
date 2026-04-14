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
