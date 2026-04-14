import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeProvider, useRecipe } from '../../context/RecipeContext.jsx'

function Inspector() {
  const { recipe, isDirty, setLayerParam, setGlobalParam } = useRecipe()
  return (
    <div>
      <span data-testid="template">{recipe.layers.length}</span>
      <span data-testid="dirty">{isDirty ? 'dirty' : 'clean'}</span>
      <button onClick={() => setGlobalParam('dirInhibition', 0.99)}>edit</button>
    </div>
  )
}

test('provides Portra 400 as default recipe', () => {
  render(<RecipeProvider><Inspector /></RecipeProvider>)
  expect(screen.getByTestId('template').textContent).toBe('3')
})

test('setGlobalParam marks recipe dirty', async () => {
  const user = userEvent.setup()
  render(<RecipeProvider><Inspector /></RecipeProvider>)
  expect(screen.getByTestId('dirty').textContent).toBe('clean')
  await user.click(screen.getByText('edit'))
  expect(screen.getByTestId('dirty').textContent).toBe('dirty')
})
