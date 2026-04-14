import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArcGauge } from '../../widgets/ArcGauge.jsx'

test('renders a canvas', () => {
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={() => {}} />
  )
  expect(container.querySelector('canvas')).toBeInTheDocument()
})

test('renders the label', () => {
  render(<ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={() => {}} />)
  expect(screen.getByText('DIR INHIBIT')).toBeInTheDocument()
})

test('tapping canvas shows counter with + and - buttons', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={() => {}} />
  )
  await user.click(container.querySelector('canvas'))
  expect(screen.getByText('+')).toBeInTheDocument()
  expect(screen.getByText('−')).toBeInTheDocument()
})

test('+ button calls onChange with incremented value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={onChange} />
  )
  await user.click(container.querySelector('canvas'))
  await user.click(screen.getByText('+'))
  expect(onChange).toHaveBeenCalledWith(0.36)
})

test('− button calls onChange with decremented value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { container } = render(
    <ArcGauge value={0.35} min={0} max={1} step={0.01} label="DIR INHIBIT" onChange={onChange} />
  )
  await user.click(container.querySelector('canvas'))
  await user.click(screen.getByText('−'))
  expect(onChange).toHaveBeenCalledWith(0.34)
})
