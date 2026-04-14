import { useRef, useCallback } from 'react'
import { useRecipe } from '../context/RecipeContext.jsx'
import { useRenderer } from '../hooks/useRenderer.js'
import './ImageArea.css'

export function ImageArea({ section, onSectionPress, onNextPress, onFullscreen }) {
  const canvasRef = useRef(null)
  const inputRef = useRef(null)
  const { developedRecipe } = useRecipe()
  const { loadImage, hasImage } = useRenderer(canvasRef, developedRecipe)

  const handleFileInput = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) loadImage(URL.createObjectURL(file))
  }, [loadImage])

  const handleTap = useCallback(() => {
    if (!hasImage) inputRef.current?.click()
  }, [hasImage])

  return (
    <div className="image-area" onClick={handleTap}>
      <input
        ref={inputRef} type="file" accept="image/*" hidden
        onChange={handleFileInput}
      />
      {!hasImage && (
        <div className="image-area__prompt">
          <span className="image-area__icon">+</span>
          <span className="image-area__text">TAP TO LOAD IMAGE</span>
        </div>
      )}
      <canvas ref={canvasRef} className="image-area__canvas" />

      {/* Floating fullscreen button */}
      <button className="image-area__fullscreen" onClick={(e) => { e.stopPropagation(); onFullscreen?.() }} aria-label="Fullscreen">⛶</button>

      {/* Floating section pills */}
      <div className="image-area__pills" onClick={e => e.stopPropagation()}>
        <button className="pill pill--section" onClick={onSectionPress}>{section} ▾</button>
        <button className="pill pill--next" onClick={onNextPress}>NEXT →</button>
      </div>
    </div>
  )
}
