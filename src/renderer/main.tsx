import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/index.js'
import './styles/palettes.css'
import './styles/base.css'
import { App } from './App.js'
import { applyToDocument, initialSettings } from './state/settings.js'

// Palette and language are on the document before the first render, so nothing
// ever flashes the defaults on the way to the stored values.
applyToDocument(initialSettings)

const container = document.getElementById('root')
if (container === null) throw new Error('root container missing')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
