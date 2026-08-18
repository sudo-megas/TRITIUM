// The fuel pane — PROVISIONAL.
//
// F7 replaces this with the dense table and the time-range chips XTRITIUM §7
// settles; what is here is the least furniture that lets a fill-up be entered
// and the consumption figure be looked at. It stands in for the design phase
// exactly as F1's deliberately garish palettes stand in for §11 item 3.
//
// Every figure is derived where it is shown and none of them is stored (§4.4):
// the total is litres × price, and the l/100km comes out of the engine each
// time this renders.

import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { consumptionAt, consumptionById, entryTotal, sortByOdometer } from '../../shared/consumption.js'
import { formatDate, formatFigure, formatMoneyText } from '../../shared/format.js'
import { PUMP_DECIMALS } from '../../shared/scaled.js'
import { useSettings } from '../state/settings.js'
import { useVehicles } from '../state/vehicles.js'
import { Cells } from './EmptyPanes.js'

export function FuelPane(): JSX.Element {
  const { t } = useTranslation()
  const active = useVehicles((s) => s.active)
  const bundle = useVehicles((s) => s.bundle)
  const currency = useSettings((s) => s.currency)
  const decimals = useSettings((s) => s.decimals_consumption)

  const entries = bundle?.fuel.entries ?? []
  const points = consumptionById(entries)

  // Newest reading first — the fill-up just entered is the one being looked at.
  const rows = sortByOdometer(entries).reverse()

  function open(kind: 'fuel-quick' | 'fuel', entry?: string): void {
    if (active === null) return
    void window.tritium.openForm(kind, active, entry)
  }

  return (
    <div className="panes">
      <section className="pane">
        <div className="pane__head">
          <button
            type="button"
            className="picker__button"
            data-testid="fuel-quick-add"
            disabled={active === null}
            onClick={() => open('fuel-quick')}
          >
            {t('fuel.quickAdd')}
          </button>

          <button
            type="button"
            className="picker__button"
            data-testid="fuel-full-add"
            disabled={active === null}
            onClick={() => open('fuel')}
          >
            {t('fuel.fullAdd')}
          </button>
        </div>

        {/* Present and empty when there is nothing in it — §7 forbids "get
            started" screens, so an empty app is the same layout holding nothing. */}
        <table className="entries" data-testid="fuel-list">
          <thead>
            <tr>
              <th>{t('fuel.fields.date')}</th>
              <th>{t('fuel.fields.odometer_km')}</th>
              <th>{t('fuel.fields.litres')}</th>
              <th>{t('fuel.fields.price_per_litre')}</th>
              <th>{t('fuel.total')}</th>
              <th>{t('fuel.fields.full_tank')}</th>
              <th>{t('fuel.consumption')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {/* Emptiness is a sentence inside the table, not a screen instead
                of it: the headers and the column widths stay exactly where a
                filled app would put them. */}
            {rows.length === 0 && (
              <tr>
                <td className="entries__empty" colSpan={8} data-testid="fuel-empty">
                  {t('table.empty')}
                </td>
              </tr>
            )}
            {rows.map((entry) => {
              const point = points[entry.id]
              return (
                <tr key={entry.id} data-testid={`fuel-row-${entry.id}`}>
                  <td>{formatDate(entry.date)}</td>
                  <td>{formatFigure(entry.odometer_km, 0)}</td>
                  <td>{formatFigure(entry.litres, PUMP_DECIMALS)}</td>
                  <td>{formatFigure(entry.price_per_litre, PUMP_DECIMALS)}</td>
                  <td data-testid={`fuel-total-${entry.id}`}>
                    {formatMoneyText(entryTotal(entry), currency ?? '')}
                  </td>
                  <td>{entry.full_tank ? t('fuel.full') : t('fuel.partial')}</td>
                  <td data-testid={`fuel-consumption-${entry.id}`}>
                    {point === undefined
                      ? ''
                      : formatFigure(consumptionAt(point.l100km, decimals), decimals)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="picker__button"
                      data-testid={`fuel-edit-${entry.id}`}
                      onClick={() => open('fuel', entry.id)}
                    >
                      {t('fuel.edit')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="pane">
        <Cells count={8} />
      </section>
    </div>
  )
}
