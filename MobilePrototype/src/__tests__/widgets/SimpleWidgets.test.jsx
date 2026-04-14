import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedSelector } from '../../widgets/SegmentedSelector.jsx'
import { CompactCounter } from '../../widgets/CompactCounter.jsx'
import { Toggle } from '../../widgets/Toggle.jsx'

// --- SegmentedSelector ---
test('SegmentedSelector highlights active option', () => {
  const opts = [{ label: '1.0', value: 1.0 }, { label: '3.0', value: 3.0 }]
  render(<SegmentedSelector options={opts} value={3.0} onChange={() => {}} />)
  const active = screen.getByText('3.0').closest('button')
  expect(active).toHaveClass('seg__option--active')
})

test('SegmentedSelector calls onChange with selected value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const opts = [{ label: '1.0', value: 1.0 }, { label: '3.0', value: 3.0 }]
  render(<SegmentedSelector options={opts} value={1.0} onChange={onChange} />)
  await user.click(screen.getByText('3.0'))
  expect(onChange).toHaveBeenCalledWith(3.0)
})

// --- CompactCounter ---
test('CompactCounter displays current value', () => {
  render(<CompactCounter label="FOG" value={0.04} min={0} max={0.3} step={0.01} unit="" onChange={() => {}} />)
  expect(screen.getByText('0.04')).toBeInTheDocument()
})

test('CompactCounter increments value on + click', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<CompactCounter label="FOG" value={0.04} min={0} max={0.3} step={0.01} unit="" onChange={onChange} />)
  await user.click(screen.getByText('+'))
  expect(onChange).toHaveBeenCalledWith(0.05)
})

test('CompactCounter does not exceed max', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<CompactCounter label="FOG" value={0.3} min={0} max={0.3} step={0.01} unit="" onChange={onChange} />)
  await user.click(screen.getByText('+'))
  expect(onChange).not.toHaveBeenCalled()
})

// --- Toggle ---
test('Toggle shows ON state', () => {
  render(<Toggle label="E-6 REVERSAL" value={1} badge="POS" onChange={() => {}} />)
  expect(screen.getByText('POS')).toBeInTheDocument()
})

test('Toggle calls onChange with toggled value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Toggle label="E-6 REVERSAL" value={1} badge="POS" onChange={onChange} />)
  await user.click(screen.getByRole('switch'))
  expect(onChange).toHaveBeenCalledWith(0)
})
