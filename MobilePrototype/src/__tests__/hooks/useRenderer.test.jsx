import { renderHook, act } from '@testing-library/react'
import { useRenderer } from '../../hooks/useRenderer.js'

test('loadImage is a stable function', () => {
  const fakeCanvas = document.createElement('canvas')
  const canvasRef = { current: fakeCanvas }
  const recipe = { layers: [], global: {} }
  const { result } = renderHook(() => useRenderer(canvasRef, recipe, false))
  expect(typeof result.current.loadImage).toBe('function')
})
