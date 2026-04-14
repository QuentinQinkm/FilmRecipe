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
