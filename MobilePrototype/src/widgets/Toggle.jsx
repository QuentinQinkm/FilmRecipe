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
