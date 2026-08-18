import { StrictMode, type JSX } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/index.js'
import './styles/tokens.css'
import './styles/palettes.css'
import './styles/base.css'
import { App } from './App.js'
import { CostForm } from './forms/CostForm.js'
import { CurrencyAsk } from './forms/CurrencyAsk.js'
import { FuelForm } from './forms/FuelForm.js'
import { FuelQuickAdd } from './forms/FuelQuickAdd.js'
import { VehicleForm } from './forms/VehicleForm.js'
import { applyToDocument, initialSettings } from './state/settings.js'

// Palette and language are on the document before the first render, so nothing
// ever flashes the defaults on the way to the stored values.
applyToDocument(initialSettings)

// Every window runs this bundle. Which one it is came in with the process
// arguments (XTRITIUM §5.1 — forms are real, separate windows), so the shell
// and the forms never have to be told apart by their size or their URL.
function view(): JSX.Element {
  const request = window.tritium?.formRequest ?? null
  if (request === null) return <App />
  if (request.kind === 'currency') return <CurrencyAsk />
  if (request.kind === 'fuel-quick') return <FuelQuickAdd slug={request.slug ?? ''} />
  if (request.kind === 'fuel') {
    return (
      <FuelForm
        slug={request.slug ?? ''}
        {...(request.entry !== undefined ? { entry: request.entry } : {})}
      />
    )
  }
  if (request.kind === 'cost') {
    return (
      <CostForm
        slug={request.slug ?? ''}
        {...(request.entry !== undefined ? { entry: request.entry } : {})}
      />
    )
  }
  return <VehicleForm {...(request.slug !== undefined ? { slug: request.slug } : {})} />
}

const container = document.getElementById('root')
if (container === null) throw new Error('root container missing')

createRoot(container).render(<StrictMode>{view()}</StrictMode>)
