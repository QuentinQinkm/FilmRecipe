import { createContext, useContext, useState, useCallback } from 'react'
import {
  cloneTemplate,
  cloneRecipe,
  createBlankRecipe,
  applyDevelopment,
  saveCustomRecipe,
  loadSavedRecipes,
  makeDefaultLayer,
  LAB_DEFAULTS,
  STOCK_TEMPLATES,
} from '@filmstate'

const RecipeContext = createContext(null)

export function RecipeProvider({ children }) {
  const [recipe, setRecipe] = useState(() => cloneTemplate('Portra 400'))
  const [labState, setLabState] = useState({ ...LAB_DEFAULTS })
  const [isDirty, setIsDirty] = useState(false)
  const [currentTemplate, setCurrentTemplate] = useState('Portra 400')
  const [savedRecipes, setSavedRecipes] = useState(loadSavedRecipes)

  const setLayerParam = useCallback((layerIdx, key, value) => {
    setRecipe(r => {
      const next = cloneRecipe(r)
      next.layers[layerIdx][key] = value
      return next
    })
    setIsDirty(true)
  }, [])

  const setGlobalParam = useCallback((key, value) => {
    setRecipe(r => {
      const next = cloneRecipe(r)
      next.global[key] = value
      return next
    })
    setIsDirty(true)
  }, [])

  const setLabParam = useCallback((key, value) => {
    setLabState(s => ({ ...s, [key]: value }))
  }, [])

  const loadTemplate = useCallback((name) => {
    setRecipe(cloneTemplate(name))
    setCurrentTemplate(name)
    setIsDirty(false)
  }, [])

  const saveAs = useCallback((name) => {
    saveCustomRecipe(name, recipe)
    setSavedRecipes(loadSavedRecipes())
    setCurrentTemplate(name)
    setIsDirty(false)
  }, [recipe])

  const addLayer = useCallback(() => {
    setRecipe(r => {
      const next = cloneRecipe(r)
      if (next.layers.length >= 4) return r
      next.layers.push(makeDefaultLayer(next.layers.length))
      return next
    })
    setIsDirty(true)
  }, [])

  const resetNew = useCallback(() => {
    setRecipe(createBlankRecipe())
    setCurrentTemplate('')
    setIsDirty(false)
  }, [])

  const developedRecipe = applyDevelopment(recipe, labState)

  return (
    <RecipeContext.Provider value={{
      recipe,
      labState,
      developedRecipe,
      isDirty,
      currentTemplate,
      savedRecipes,
      setLayerParam,
      setGlobalParam,
      setLabParam,
      addLayer,
      loadTemplate,
      saveAs,
      resetNew,
    }}>
      {children}
    </RecipeContext.Provider>
  )
}

export function useRecipe() {
  const ctx = useContext(RecipeContext)
  if (!ctx) throw new Error('useRecipe must be used inside RecipeProvider')
  return ctx
}
