// The service list (F7): the dense table, the §7.2 chips, and the detail region.
//
// The vendor is the one thing here that was never provisional. It shows a stored
// address as SELECTABLE TEXT and never as a link (§3.5) — in the table, and in
// the detail pane beside it. F7 rebuilt the furniture around it and did not get
// to change that.

import { useMemo, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { compareDate, sortByDateDesc } from '../../shared/entries.js'
import { formatDate, formatFigure, formatMoneyText } from '../../shared/format.js'
import { filterByBounds } from '../../shared/range.js'
import type { ServiceEntry } from '../../shared/records.js'
import { useSettings } from '../state/settings.js'
import { useVehicles } from '../state/vehicles.js'
import { EntryTable } from './EntryTable.js'
import { RangeChips, useRangeFilter } from './RangeChips.js'
import { RecordDetail, type DetailRow } from './RecordDetail.js'

export function ServicePane(): JSX.Element {
  const { t } = useTranslation()
  const active = useVehicles((s) => s.active)
  const bundle = useVehicles((s) => s.bundle)
  const refresh = useVehicles((s) => s.refresh)
  const currency = useSettings((s) => s.currency)

  const filter = useRangeFilter()
  const [selected, setSelected] = useState<string | null>(null)

  const entries = bundle?.service.entries ?? []
  const rows = useMemo(
    () => filterByBounds(sortByDateDesc(entries), filter.bounds),
    [entries, filter.bounds]
  )

  const columns = useMemo<ColumnDef<ServiceEntry, string>[]>(
    () => [
      {
        id: 'date',
        header: t('service.fields.date'),
        accessorFn: (entry) => formatDate(entry.date),
        sortingFn: (a, b) => compareDate(a.original.date, b.original.date)
      },
      {
        id: 'part',
        header: t('service.fields.part'),
        accessorFn: (entry) => entry.part
      },
      {
        id: 'odometer_km',
        header: t('service.fields.odometer_km'),
        accessorFn: (entry) => (entry.odometer_km > 0 ? formatFigure(entry.odometer_km, 0) : ''),
        sortingFn: (a, b) => a.original.odometer_km - b.original.odometer_km
      },
      {
        id: 'amount',
        header: t('service.fields.amount'),
        accessorFn: (entry) => formatMoneyText(entry.amount, currency ?? ''),
        sortingFn: (a, b) => a.original.amount - b.original.amount
      }
    ],
    [t, currency]
  )

  const record = rows.find((entry) => entry.id === selected) ?? null

  const detail: DetailRow[] =
    record === null
      ? []
      : [
          { id: 'date', key: t('service.fields.date'), value: formatDate(record.date) },
          { id: 'part', key: t('service.fields.part'), value: record.part },
          {
            id: 'odometer_km',
            key: t('service.fields.odometer_km'),
            value: record.odometer_km > 0 ? formatFigure(record.odometer_km, 0) : ''
          },
          {
            id: 'amount',
            key: t('service.fields.amount'),
            value: formatMoneyText(record.amount, currency ?? '')
          },
          // Text. Not an anchor, in any palette, in either language.
          { id: 'vendor', key: t('service.fields.vendor'), value: record.vendor }
        ]

  function open(entry?: string): void {
    if (active === null) return
    void window.tritium.openForm('service', active, entry)
  }

  async function remove(): Promise<void> {
    if (active === null || record === null) return
    await window.tritium.removeService(active, record.id)
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
            data-testid="service-add"
            disabled={active === null}
            onClick={() => open()}
          >
            {t('service.add')}
          </button>
        </div>

        <RangeChips filter={filter} />

        <EntryTable
          rows={rows}
          columns={columns}
          defaultSorting={[{ id: 'date', desc: true }]}
          selectedId={selected}
          onSelect={setSelected}
          name="service"
        />
      </section>

      <section className="pane">
        <RecordDetail
          id={record?.id ?? null}
          heading={t('service.editTitle')}
          rows={detail}
          onEdit={() => record !== null && open(record.id)}
          onDelete={() => void remove()}
          testId="service-detail"
        />
      </section>
    </div>
  )
}
