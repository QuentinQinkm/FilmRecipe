import { useRef, useEffect, useCallback, useState } from 'react'
import { FilmRenderer } from '@engine/renderer.js'

export function useRenderer(canvasRef, developedRecipe, rawMode = false) {
  const rendererRef = useRef(null)
  const [imageLoaded, setImageLoaded] = useState(false)

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
    if (!rendererRef.current || !imageLoaded) return
    try {
      rendererRef.current.render(developedRecipe, rawMode)
    } catch (e) {
      console.warn('FilmRenderer render failed:', e.message)
    }
  }, [developedRecipe, rawMode, imageLoaded])

  const loadImage = useCallback((src) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(src)
      if (!canvasRef.current) return
      canvasRef.current.width = img.naturalWidth
      canvasRef.current.height = img.naturalHeight
      if (rendererRef.current) {
        try {
          rendererRef.current.setImage(img, img.naturalWidth, img.naturalHeight)
          setImageLoaded(true)
          rendererRef.current.render(developedRecipe, rawMode)
        } catch (e) {
          console.warn('FilmRenderer setImage/render failed:', e.message)
        }
      }
    }
    img.src = src
  }, [canvasRef, developedRecipe, rawMode])

  return { loadImage, hasImage: imageLoaded }
}
