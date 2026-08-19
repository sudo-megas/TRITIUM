// The costs list (F7): the dense table, the §7.2 chips, and the detail region.
//
// Nothing here is stored. The sign on an amount comes from the entry's `income`
// flag each time this renders (§3.7), and the order is computed.

import { useMemo, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { signedAmount } from '../../shared/costs.js'
import { compareDate, sortByDateDesc } from '../../shared/entries.js'
import { formatDate, formatMoneyText } from '../../shared/format.js'
import { filterByBounds } from '../../shared/range.js'
import type { CostEntry } from '../../shared/records.js'
import { useSettings } from '../state/settings.js'
import { useVehicles } from '../state/vehicles.js'
import { EntryTable } from './EntryTable.js'
import { RangeChips, useRangeFilter } from './RangeChips.js'
import { RecordDetail, type DetailRow } from './RecordDetail.js'

export function CostsPane(): JSX.Element {
  const { t } = useTranslation()
  const active = useVehicles((s) => s.active)
  const bundle = useVehicles((s) => s.bundle)
  const refresh = useVehicles((s) => s.refresh)
  const currency = useSettings((s) => s.currency)

  const filter = useRangeFilter()
  const [selected, setSelected] = useState<string | null>(null)

  const entries = bundle?.costs.entries ?? []
  const rows = useMemo(
    () => filterByBounds(sortByDateDesc(entries), filter.bounds),
    [entries, filter.bounds]
  )

  /**
   * A stored key back into something to read. A category the maker typed under
   * MANUAL has no catalogue entry, so it shows as the key it is rather than as
   * the missing-translation marker i18next would otherwise print.
   */
  const categoryLabel = (category: string): string =>
    category.length === 0 ? '' : t(`costs.categories.${category}`, { defaultValue: category })

  const methodLabel = (method: string): string =>
    method.length === 0 ? '' : t(`costs.methods.${method}`, { defaultValue: method })

  const columns = useMemo<ColumnDef<CostEntry, string>[]>(
    () => [
      {
        id: 'date',
        header: t('costs.fields.date'),
        accessorFn: (entry) => formatDate(entry.date),
        sortingFn: (a, b) => compareDate(a.original.date, b.original.date)
      },
      {
        id: 'category',
        header: t('costs.fields.category'),
        accessorFn: (entry) => categoryLabel(entry.category)
      },
      {
        id: 'title',
        header: t('costs.fields.title'),
        accessorFn: (entry) => entry.title
      },
      {
        id: 'amount',
        header: t('costs.fields.amount'),
        accessorFn: (entry) => formatMoneyText(signedAmount(entry), currency ?? ''),
        sortingFn: (a, b) => signedAmount(a.original) - signedAmount(b.original)
      }
    ],
    [t, currency]
  )

  const record = rows.find((entry) => entry.id === selected) ?? null

  const detail: DetailRow[] =
    record === null
      ? []
      : [
          { id: 'date', key: t('costs.fields.date'), value: formatDate(record.date) },
          { id: 'group', key: t('costs.fields.group'), value: t(`costs.groups.${record.group}`) },
          { id: 'category', key: t('costs.fields.category'), value: categoryLabel(record.category) },
          { id: 'title', key: t('costs.fields.title'), value: record.title },
          {
            id: 'amount',
            key: t('costs.fields.amount'),
            value: formatMoneyText(signedAmount(record), currency ?? '')
          },
          {
            id: 'payment_method',
            key: t('costs.fields.payment_method'),
            value: methodLabel(record.payment_method)
          },
          { id: 'bank', key: t('costs.fields.bank'), value: record.bank },
          { id: 'instalment', key: t('costs.fields.instalment'), value: record.instalment },
          { id: 'note', key: t('costs.fields.note'), value: record.note }
        ]

  function open(entry?: string): void {
    if (active === null) return
    void window.tritium.openForm('cost', active, entry)
  }

  async function remove(): Promise<void> {
    if (active === null || record === null) return
    await window.tritium.removeCost(active, record.id)
    setSelected(null)
    await refresh()
  }

  return (
    <div className="panes">
      <section className="pane">
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

        <RangeChips filter={filter} />

        <EntryTable
          rows={rows}
          columns={columns}
          defaultSorting={[{ id: 'date', desc: true }]}
          selectedId={selected}
          onSelect={setSelected}
          name="cost"
        />
      </section>

      <section className="pane">
        <RecordDetail
          id={record?.id ?? null}
          heading={t('costs.editTitle')}
          rows={detail}
          onEdit={() => record !== null && open(record.id)}
          onDelete={() => void remove()}
          testId="cost-detail"
        />
      </section>
    </div>
  )
}
