import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { LayerView } from '../../views/LayerView.jsx'

function wrap(ui) { return render(<RecipeProvider>{ui}</RecipeProvider>) }

test('renders layer table headers PEAK BW PURITY DMAX', () => {
  wrap(<LayerView />)
  expect(screen.getByText('PEAK')).toBeInTheDocument()
  expect(screen.getByText('BW')).toBeInTheDocument()
  expect(screen.getByText('PURITY')).toBeInTheDocument()
  expect(screen.getByText('DMAX')).toBeInTheDocument()
})

test('renders Portra 400 layer data (3 rows)', () => {
  wrap(<LayerView />)
  expect(screen.getByText('620')).toBeInTheDocument()
  expect(screen.getByText('540')).toBeInTheDocument()
  expect(screen.getByText('440')).toBeInTheDocument()
})

test('tapping a layer row expands controls', async () => {
  const user = userEvent.setup()
  wrap(<LayerView />)
  const rows = screen.getAllByRole('button', { name: /expand layer/i })
  await user.click(rows[0])
  expect(screen.getByText('SENSITIVITY')).toBeInTheDocument()
})

test('tapping same row again collapses it', async () => {
  const user = userEvent.setup()
  wrap(<LayerView />)
  const rows = screen.getAllByRole('button', { name: /expand layer/i })
  await user.click(rows[0])
  await user.click(rows[0])
  expect(screen.queryByText('SENSITIVITY')).not.toBeInTheDocument()
})

test('renders ADD LAYER button', () => {
  wrap(<LayerView />)
  expect(screen.getByText('+ ADD LAYER')).toBeInTheDocument()
})
