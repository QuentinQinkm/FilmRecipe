import { render, screen } from '@testing-library/react'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { DevelopView } from '../../views/DevelopView.jsx'

function wrap(ui) { return render(<RecipeProvider>{ui}</RecipeProvider>) }

test('renders PUSH / PULL label', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('PUSH / PULL')).toBeInTheDocument()
})

test('renders BATH TEMP and AGITATION knobs', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('BATH TEMP')).toBeInTheDocument()
  expect(screen.getByText('AGITATION')).toBeInTheDocument()
})

test('renders DEV TIME and FRESHNESS counters', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('DEV TIME')).toBeInTheDocument()
  expect(screen.getByText('FRESHNESS')).toBeInTheDocument()
})

test('renders LAB NOTES section', () => {
  wrap(<DevelopView />)
  expect(screen.getByText('LAB NOTES')).toBeInTheDocument()
})
