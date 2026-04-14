import { render, screen } from '@testing-library/react'
import { GradientStrip } from '../../widgets/GradientStrip.jsx'

test('renders a canvas', () => {
  const { container } = render(
    <GradientStrip
      label="BASE TINT" value={0.5} min={-1} max={1} step={0.01}
      colors={['#4488CC', '#888888', '#CC8844']}
      leftLabel="COOL" rightLabel="WARM"
      onChange={() => {}}
    />
  )
  expect(container.querySelector('canvas')).toBeInTheDocument()
})

test('renders left and right labels', () => {
  render(
    <GradientStrip
      label="BASE TINT" value={0} min={-1} max={1} step={0.01}
      colors={['#4488CC', '#888888', '#CC8844']}
      leftLabel="COOL" rightLabel="WARM"
      onChange={() => {}}
    />
  )
  expect(screen.getByText('COOL')).toBeInTheDocument()
  expect(screen.getByText('WARM')).toBeInTheDocument()
})

test('calls onChange when pointer is released after drag', () => {
  const onChange = vi.fn()
  const { container } = render(
    <GradientStrip
      label="BASE TINT" value={0} min={-1} max={1} step={0.01}
      colors={['#4488CC', '#888888', '#CC8844']}
      onChange={onChange}
    />
  )
  const canvas = container.querySelector('canvas')
  // Mock getBoundingClientRect — needed for valueFromX calculation
  canvas.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 24 })
  canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 150, bubbles: true }))
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  expect(onChange).toHaveBeenCalled()
})
