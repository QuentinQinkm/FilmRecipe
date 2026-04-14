import { useRef, useEffect, useCallback } from 'react'
import { FilmRenderer } from '@engine/renderer.js'

export function useRenderer(canvasRef, developedRecipe, rawMode = false) {
  const rendererRef = useRef(null)
  const imageLoadedRef = useRef(false)

  // Init/destroy renderer with the canvas
  useEffect(() => {
    if (!canvasRef.current) return
    try {
      rendererRef.current = new FilmRenderer(canvasRef.current)
    } catch (e) {
      // WebGL not available (test environment) — renderer stays null
      console.warn('FilmRenderer init failed (no WebGL?):', e.message)
    }
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [canvasRef])

  // Re-render whenever recipe changes (if image is loaded)
  useEffect(() => {
    if (!rendererRef.current || !imageLoadedRef.current) return
    try {
      rendererRef.current.render(developedRecipe, rawMode)
    } catch (e) {
      console.warn('FilmRenderer render failed:', e.message)
    }
  }, [developedRecipe, rawMode])

  const loadImage = useCallback((src) => {
    const img = new Image()
    img.onload = () => {
      if (!canvasRef.current) return
      canvasRef.current.width = img.naturalWidth
      canvasRef.current.height = img.naturalHeight
      if (rendererRef.current) {
        try {
          rendererRef.current.setImage(img, img.naturalWidth, img.naturalHeight)
          imageLoadedRef.current = true
          rendererRef.current.render(developedRecipe, rawMode)
        } catch (e) {
          console.warn('FilmRenderer setImage/render failed:', e.message)
        }
      }
    }
    img.src = src
  }, [canvasRef, developedRecipe, rawMode])

  return { loadImage, hasImage: imageLoadedRef.current }
}
