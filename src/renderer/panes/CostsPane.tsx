// The costs pane — PROVISIONAL.
//
// F7 replaces this with the dense table and the time-range chips XTRITIUM §7
// settles; what is here is the least furniture that lets a cost be entered and
// looked at. Provisional in what it shows, not in how it looks — the row
// height, the alignment and the rule under each row are F4b's treatment, which
// F7 inherits.
//
// Nothing on this pane is stored. The sign on an amount comes from the entry's
// `income` flag each time this renders (§3.7), and the list order is computed,
// not remembered.

import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { signedAmount, sortByDateDesc } from '../../shared/costs.js'
import { formatDate, formatMoneyText } from '../../shared/format.js'
import { useSettings } from '../state/settings.js'
import { useVehicles } from '../state/vehicles.js'

export function CostsPane(): JSX.Element {
  const { t } = useTranslation()
  const active = useVehicles((s) => s.active)
  const bundle = useVehicles((s) => s.bundle)
  const currency = useSettings((s) => s.currency)

  const rows = sortByDateDesc(bundle?.costs.entries ?? [])

  function open(entry?: string): void {
    if (active === null) return
    void window.tritium.openForm('cost', active, entry)
  }

  /**
   * A stored key back into something to read. A category the maker typed under
   * MANUAL has no catalogue entry, so it shows as the key it is rather than as
   * the missing-translation marker i18next would otherwise print.
   */
  const categoryLabel = (category: string): string =>
    category.length === 0 ? '' : t(`costs.categories.${category}`, { defaultValue: category })

  return (
    <div className="panes">
      {/*
       * The table spans both halves, for the reason the fuel pane's does: nine
       * columns of figures do not fit in half of 1280, and a horizontal
       * scrollbar under a table of numbers is the one thing it must never have.
       * F7 reclaims the right half for the detail region.
       */}
      <section className="pane pane--wide">
        <div className="pane__head">
          <button
            type="button"
            className="button"
            data-testid="cost-add"
            disabled={active === null}
            onClick={() => open()}
          >
            {t('costs.add')}
          </button>
        </div>

        {/* Present and empty when there is nothing in it — §7 forbids "get
            started" screens, so an empty app is the same layout holding nothing. */}
        <table className="entries" data-testid="cost-list">
          <thead>
            <tr>
              <th>{t('costs.fields.date')}</th>
              <th>{t('costs.fields.group')}</th>
              <th>{t('costs.fields.category')}</th>
              <th>{t('costs.fields.title')}</th>
              <th>{t('costs.fields.amount')}</th>
              <th>{t('costs.fields.payment_method')}</th>
              <th>{t('costs.fields.bank')}</th>
              <th>{t('costs.fields.instalment')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="entries__empty" colSpan={9} data-testid="cost-empty">
                  {t('table.empty')}
                </td>
              </tr>
            )}
            {rows.map((entry) => (
              <tr key={entry.id} data-testid={`cost-row-${entry.id}`}>
                <td>{formatDate(entry.date)}</td>
                <td>{t(`costs.groups.${entry.group}`)}</td>
                <td>{categoryLabel(entry.category)}</td>
                <td>{entry.title}</td>
                <td data-testid={`cost-amount-${entry.id}`}>
                  {formatMoneyText(signedAmount(entry), currency ?? '')}
                </td>
                <td>
                  {entry.payment_method.length === 0
                    ? ''
                    : t(`costs.methods.${entry.payment_method}`, {
                        defaultValue: entry.payment_method
                      })}
                </td>
                <td>{entry.bank}</td>
                <td>{entry.instalment}</td>
                <td>
                  <button
                    type="button"
                    className="button"
                    data-testid={`cost-edit-${entry.id}`}
                    onClick={() => open(entry.id)}
                  >
                    {t('costs.edit')}
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
