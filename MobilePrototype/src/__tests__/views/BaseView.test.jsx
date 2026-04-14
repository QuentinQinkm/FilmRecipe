import { render, screen } from '@testing-library/react'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { BaseView } from '../../views/BaseView.jsx'

function wrap(ui) { return render(<RecipeProvider>{ui}</RecipeProvider>) }

test('renders E-6 REVERSAL label', () => {
  wrap(<BaseView />)
  expect(screen.getByText('E-6 REVERSAL')).toBeInTheDocument()
})

test('renders SCAN EXPOSURE label', () => {
  wrap(<BaseView />)
  expect(screen.getByText('SCAN EXPOSURE')).toBeInTheDocument()
})

test('renders FILM CHEMISTRY section', () => {
  wrap(<BaseView />)
  expect(screen.getByText('FILM CHEMISTRY')).toBeInTheDocument()
})

test('renders all 4 gauge labels', () => {
  wrap(<BaseView />)
  expect(screen.getByText('DIR INHIBIT')).toBeInTheDocument()
  expect(screen.getByText('GRAIN SOFT')).toBeInTheDocument()
  expect(screen.getByText('HALATION')).toBeInTheDocument()
  expect(screen.getByText('STACKING')).toBeInTheDocument()
})

test('renders ORANGE MASK collapse toggle', () => {
  wrap(<BaseView />)
  expect(screen.getByText('ORANGE MASK')).toBeInTheDocument()
})
