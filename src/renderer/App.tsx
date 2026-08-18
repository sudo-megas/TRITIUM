// The shell: a top tab bar over two big panes (XTRITIUM §7).
// Deliberately not the JADEITE/INDIUM sidebar.
//
// The tab names and count are design-phase property (XTRITIUM §11); the *bar*
// is F1's. Every tab except SETTINGS and ABOUT shows the empty two-pane layout.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyPanes } from './panes/EmptyPanes.js'
import { FuelPane } from './panes/FuelPane.js'
import { SettingsPane } from './panes/SettingsPane.js'
import { AboutPane } from './panes/AboutPane.js'
import { VehiclePicker } from './VehiclePicker.js'
import { useVehicles } from './state/vehicles.js'
import { APP_NAME } from '../shared/app-meta.js'

// fa-car-side (U+EEA0), from the Font Awesome 6 range of the Nerd Font patch
// (U+ED00-U+EFFF). The older U+F000-U+F2E0 range is Font Awesome 4.7 and is not
// used. This proves the icon path: no icon library is a dependency (XTRITIUM §8).
const MARK_GLYPH = ''

const TABS = [
  'summary',
  'fuel',
  'costs',
  'service',
  'charts',
  'statistics',
  'settings',
  'about'
] as const

type Tab = (typeof TABS)[number]

// Settings and About since F1, Fuel since F4; every other tab is still the real
// two-pane layout with empty cells.
const PANES: Partial<Record<Tab, () => JSX.Element>> = {
  fuel: FuelPane,
  settings: SettingsPane,
  about: AboutPane
}

export function App(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('summary')
  const Pane = PANES[tab] ?? EmptyPanes
  const refresh = useVehicles((s) => s.refresh)

  // The list is read once at start and again whenever a form window writes.
  // Both windows read the same files, so neither may keep its own idea of them.
  useEffect(() => {
    void refresh()
    return window.tritium.onVehiclesChanged(() => void refresh())
  }, [refresh])

  return (
    <div className="shell">
      <nav className="tabbar" role="tablist" aria-label={t('app.name')}>
        <div className="tabbar__mark">
          <span className="tabbar__glyph" data-testid="mark-glyph">
            {MARK_GLYPH}
          </span>
          <span>{APP_NAME}</span>
        </div>

        {TABS.map((id) => (
          <button
            type="button"
            key={id}
            role="tab"
            className="tab"
            data-testid={`tab-${id}`}
            aria-selected={id === tab}
            onClick={() => setTab(id)}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}

        <VehiclePicker />
      </nav>

      <Pane />
    </div>
  )
}
