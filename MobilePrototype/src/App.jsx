import { useState } from 'react'
import { RecipeProvider } from './context/RecipeContext.jsx'
import { ImageArea } from './components/ImageArea.jsx'
import { TopBar } from './components/TopBar.jsx'

const SECTIONS = ['LAYER', 'BASE', 'DEVELOP']

export default function App() {
  const [sectionIdx, setSectionIdx] = useState(0)
  const next = () => setSectionIdx(i => Math.min(SECTIONS.length - 1, i + 1))
  const section = SECTIONS[sectionIdx]

  return (
    <RecipeProvider>
      <div className="app">
        <TopBar onPresetPress={() => {}} onExport={() => {}} />
        <ImageArea
          section={section}
          onSectionPress={() => {}}
          onNextPress={next}
          onFullscreen={() => {}}
        />
        <div style={{ flex: 1, padding: 16, color: 'var(--text-3)', fontSize: 12 }}>
          {section} controls go here
        </div>
      </div>
    </RecipeProvider>
  )
}
