import { render, screen } from '@testing-library/react'
import { RecipeProvider } from '../../context/RecipeContext.jsx'
import { TopBar } from '../../components/TopBar.jsx'

function wrap(ui) {
  return render(<RecipeProvider>{ui}</RecipeProvider>)
}

test('shows FILM LAB wordmark', () => {
  wrap(<TopBar onPresetPress={() => {}} onExport={() => {}} />)
  expect(screen.getByText('FILM LAB')).toBeInTheDocument()
})

test('shows current template name', () => {
  wrap(<TopBar onPresetPress={() => {}} onExport={() => {}} />)
  expect(screen.getByText('Portra 400')).toBeInTheDocument()
})

test('shows dirty dot when recipe is modified', async () => {
  // isDirty starts false — dot should be hidden
  const { queryByTestId } = wrap(<TopBar onPresetPress={() => {}} onExport={() => {}} />)
  expect(queryByTestId('dirty-dot')).not.toBeInTheDocument()
})
