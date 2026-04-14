import { useState } from 'react'
import { RecipeProvider } from './context/RecipeContext.jsx'
import { TopBar } from './components/TopBar.jsx'
import { ImageArea } from './components/ImageArea.jsx'
import { LayerView } from './views/LayerView.jsx'
import { BaseView } from './views/BaseView.jsx'
import { DevelopView } from './views/DevelopView.jsx'

const SECTIONS = ['LAYER', 'BASE', 'DEVELOP']

function AppShell() {
  const [sectionIdx, setSectionIdx] = useState(0)
  const section = SECTIONS[sectionIdx]

  const next = () => setSectionIdx(i => Math.min(SECTIONS.length - 1, i + 1))
  const prev = () => setSectionIdx(i => Math.max(0, i - 1))

  return (
    <div className="app">
      <TopBar onPresetPress={() => {}} onExport={() => {}} />
      <ImageArea
        section={section}
        onSectionPress={prev}
        onNextPress={next}
        onFullscreen={() => {}}
      />
      <div className="app__controls">
        {section === 'LAYER' && <LayerView />}
        {section === 'BASE' && <BaseView />}
        {section === 'DEVELOP' && <DevelopView />}
      </div>
    </div>
  )
}

export default function App() {
  return <RecipeProvider><AppShell /></RecipeProvider>
}
