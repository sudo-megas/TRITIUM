// The service pane — PROVISIONAL.
//
// F7 replaces this with the dense table and the time-range chips XTRITIUM §7
// settles; what is here is the least furniture that lets a Periyodik Bakım
// record be entered and looked at.
//
// The vendor column is the one thing here that is not merely provisional: it
// shows a stored address as SELECTABLE TEXT and never as a link (§3.5). Whatever
// F7 does to this table, it does not get to change that.

import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { sortByDateDesc } from '../../shared/entries.js'
import { formatDate, formatFigure, formatMoneyText } from '../../shared/format.js'
import { useSettings } from '../state/settings.js'
import { useVehicles } from '../state/vehicles.js'

export function ServicePane(): JSX.Element {
  const { t } = useTranslation()
  const active = useVehicles((s) => s.active)
  const bundle = useVehicles((s) => s.bundle)
  const currency = useSettings((s) => s.currency)

  const rows = sortByDateDesc(bundle?.service.entries ?? [])

  function open(entry?: string): void {
    if (active === null) return
    void window.tritium.openForm('service', active, entry)
  }

  return (
    <div className="panes">
      <section className="pane pane--wide">
        <div className="pane__head">
          <button
            type="button"
            className="button"
            data-testid="service-add"
            disabled={active === null}
            onClick={() => open()}
          >
            {t('service.add')}
          </button>
        </div>

        <table className="entries" data-testid="service-list">
          <thead>
            <tr>
              <th>{t('service.fields.date')}</th>
              <th>{t('service.fields.part')}</th>
              <th>{t('service.fields.odometer_km')}</th>
              <th>{t('service.fields.amount')}</th>
              <th>{t('service.fields.vendor')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {/* §7 — an empty app is the same layout holding nothing. */}
            {rows.length === 0 && (
              <tr>
                <td className="entries__empty" colSpan={6} data-testid="service-empty">
                  {t('table.empty')}
                </td>
              </tr>
            )}
            {rows.map((entry) => (
              <tr key={entry.id} data-testid={`service-row-${entry.id}`}>
                <td>{formatDate(entry.date)}</td>
                <td>{entry.part}</td>
                <td>{entry.odometer_km > 0 ? formatFigure(entry.odometer_km, 0) : ''}</td>
                <td data-testid={`service-amount-${entry.id}`}>
                  {formatMoneyText(entry.amount, currency ?? '')}
                </td>
                {/* Text. Not an anchor, in any palette, in either language. */}
                <td data-testid={`service-vendor-${entry.id}`}>{entry.vendor}</td>
                <td>
                  <button
                    type="button"
                    className="button"
                    data-testid={`service-edit-${entry.id}`}
                    onClick={() => open(entry.id)}
                  >
                    {t('service.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
