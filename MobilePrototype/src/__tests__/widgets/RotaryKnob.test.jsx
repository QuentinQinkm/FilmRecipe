import { render, screen } from '@testing-library/react'
import { RotaryKnob } from '../../widgets/RotaryKnob.jsx'

test('renders a canvas and label', () => {
  const { container } = render(
    <RotaryKnob value={0} min={-0.5} max={0.7} step={0.01} label="PUSH/PULL" unit="" size={140} onChange={() => {}} />
  )
  expect(container.querySelector('canvas')).toBeInTheDocument()
  expect(screen.getByText('PUSH/PULL')).toBeInTheDocument()
})

test('calls onChange on pointer drag up', () => {
  const onChange = vi.fn()
  const { container } = render(
    <RotaryKnob value={0} min={-0.5} max={0.7} step={0.01} label="DEV" unit="" size={90} onChange={onChange} />
  )
  const canvas = container.querySelector('canvas')

  // Simulate pointer down then move up 50px (should increase value)
  canvas.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }))
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientY: 50, bubbles: true }))
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

  expect(onChange).toHaveBeenCalled()
  const calledWith = onChange.mock.calls[0][0]
  expect(calledWith).toBeGreaterThan(0)
})
