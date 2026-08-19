// The shell: a top tab bar over two big panes (XTRITIUM §7).
// Deliberately not the JADEITE/INDIUM sidebar.
//
// The tab names and count are design-phase property (XTRITIUM §11); the *bar*
// is F1's, and F4b settled the list. As of F10 every one of the eight has a
// pane behind it — the sentence that used to stand here, about most tabs
// showing an empty two-pane layout, described F1 through F9 and stopped being
// true when Statistics was filled.

import { useEffect, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { ChartsPane } from './panes/ChartsPane.js'
import { CostsPane } from './panes/CostsPane.js'
import { FuelPane } from './panes/FuelPane.js'
import { ServicePane } from './panes/ServicePane.js'
import { SettingsPane } from './panes/SettingsPane.js'
import { StatisticsPane } from './panes/StatisticsPane.js'
import { SummaryPane } from './panes/SummaryPane.js'
import { AboutPane } from './panes/AboutPane.js'
import { VehiclePicker } from './VehiclePicker.js'
import { useVehicles } from './state/vehicles.js'
import { APP_NAME } from '../shared/app-meta.js'

// The application's own mark, from the artwork the maker supplied. It replaces
// the fa-car-side glyph that stood here since F1: a generic car borrowed from a
// font patch was always a placeholder for the real thing, and the real thing now
// exists.
//
// The 128px file is the one imported. It is four times the box it is drawn in,
// which is what keeps it sharp on a HiDPI screen; the larger files beside it are
// for the packaged application's own icon, and putting a seventeen-megabyte
// bitmap through the renderer bundle to draw twenty-four pixels would be absurd.
//
// Bundled, not fetched: the import resolves at build time and the file is
// emitted beside the bundle, which is what keeps §2's zero-network rule true.
import markIcon from '../../build/icons/128.png'

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

// Every tab in the bar now has a pane behind it: Settings and About since F1,
// Fuel since F4, Costs since F5, Service since F6, Charts since F8, Summary
// since F9, Statistics since F10. `EmptyPanes` survives as what a pane shows
// when it has nothing to show, which is a different job (§7).
const PANES: Record<Tab, () => JSX.Element> = {
  summary: SummaryPane,
  fuel: FuelPane,
  costs: CostsPane,
  service: ServicePane,
  charts: ChartsPane,
  statistics: StatisticsPane,
  settings: SettingsPane,
  about: AboutPane
}

export function App(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('summary')
  const Pane = PANES[tab]
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
          {/* Decorative: the word beside it already names the application, and
              a second reading of "TRITIUM" from an alt text would be noise. */}
          <img className="tabbar__icon" src={markIcon} alt="" data-testid="mark-icon" />
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
