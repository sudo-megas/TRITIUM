// The fuel list (F7): the dense table XTRITIUM §7 settles, the §7.2 chips, and
// the detail region F4 reserved the right-hand pane for.
//
// THE THING TO BE CAREFUL ABOUT IS THE FILTER.
//
// §5.2's consumption figure exists only between consecutive full tanks, and it
// counts every partial fill in between. Hand the engine a filtered list and all
// of that quietly stops being true: the first full tank inside the window loses
// the earlier one it is measured against, a partial fill just outside the
// boundary stops being counted into the tank that burnt it, and what comes out
// is not consumption for the period — it is a wrong number shaped exactly like
// a right one.
//
// So the engine is fed `bundle.fuel.entries` ENTIRE, always, and the range is
// applied afterwards, to the rows. A fill-up whose figure was computed against
// an entry the chip hides keeps the figure it had.

import { useMemo, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import {
  consumptionAt,
  consumptionById,
  entryTotal,
  sortByOdometer
} from '../../shared/consumption.js'
import { formatDate, formatFigure, formatMoneyText } from '../../shared/format.js'
import { compareDate } from '../../shared/entries.js'
import { filterByBounds } from '../../shared/range.js'
import type { FuelEntry } from '../../shared/records.js'
import { PUMP_DECIMALS } from '../../shared/scaled.js'
import { useSettings } from '../state/settings.js'
import { useVehicles } from '../state/vehicles.js'
import { EntryTable } from './EntryTable.js'
import { RangeChips, useRangeFilter } from './RangeChips.js'
import { RecordDetail, type DetailRow } from './RecordDetail.js'

export function FuelPane(): JSX.Element {
  const { t } = useTranslation()
  const active = useVehicles((s) => s.active)
  const bundle = useVehicles((s) => s.bundle)
  const refresh = useVehicles((s) => s.refresh)
  const currency = useSettings((s) => s.currency)
  const decimals = useSettings((s) => s.decimals_consumption)

  const filter = useRangeFilter()
  const [selected, setSelected] = useState<string | null>(null)

  const entries = bundle?.fuel.entries ?? []

  // The WHOLE history, every time. See the note at the top of this file.
  const points = useMemo(() => consumptionById(entries), [entries])

  const rows = useMemo(
    () => filterByBounds(sortByOdometer(entries), filter.bounds),
    [entries, filter.bounds]
  )

  const consumptionText = (entry: FuelEntry): string => {
    const point = points[entry.id]
    return point === undefined ? '' : formatFigure(consumptionAt(point.l100km, decimals), decimals)
  }

  const columns = useMemo<ColumnDef<FuelEntry, string>[]>(
    () => [
      {
        id: 'date',
        header: t('fuel.fields.date'),
        accessorFn: (entry) => formatDate(entry.date),
        sortingFn: (a, b) => compareDate(a.original.date, b.original.date)
      },
      {
        id: 'odometer_km',
        header: t('fuel.fields.odometer_km'),
        accessorFn: (entry) => formatFigure(entry.odometer_km, 0),
        sortingFn: (a, b) => a.original.odometer_km - b.original.odometer_km
      },
      {
        id: 'litres',
        header: t('fuel.fields.litres'),
        accessorFn: (entry) => formatFigure(entry.litres, PUMP_DECIMALS),
        sortingFn: (a, b) => a.original.litres - b.original.litres
      },
      {
        id: 'total',
        header: t('fuel.total'),
        accessorFn: (entry) => formatMoneyText(entryTotal(entry), currency ?? ''),
        sortingFn: (a, b) => entryTotal(a.original) - entryTotal(b.original)
      },
      {
        id: 'consumption',
        header: t('fuel.consumption'),
        accessorFn: consumptionText,
        sortingFn: (a, b) =>
          (points[a.original.id]?.l100km ?? 0) - (points[b.original.id]?.l100km ?? 0)
      }
    ],
    // consumptionText closes over points and decimals; both are in the list.
    [t, currency, decimals, points]
  )

  const record = rows.find((entry) => entry.id === selected) ?? null

  const detail: DetailRow[] =
    record === null
      ? []
      : [
          { id: 'date', key: t('fuel.fields.date'), value: formatDate(record.date) },
          {
            id: 'odometer_km',
            key: t('fuel.fields.odometer_km'),
            value: formatFigure(record.odometer_km, 0)
          },
          {
            id: 'litres',
            key: t('fuel.fields.litres'),
            value: formatFigure(record.litres, PUMP_DECIMALS)
          },
          {
            id: 'price_per_litre',
            key: t('fuel.fields.price_per_litre'),
            value: formatFigure(record.price_per_litre, PUMP_DECIMALS)
          },
          {
            id: 'total',
            key: t('fuel.total'),
            value: formatMoneyText(entryTotal(record), currency ?? '')
          },
          {
            id: 'full_tank',
            key: t('fuel.fields.full_tank'),
            value: record.full_tank ? t('fuel.full') : t('fuel.partial')
          },
          { id: 'fuel_type', key: t('fuel.fields.fuel_type'), value: record.fuel_type },
          { id: 'consumption', key: t('fuel.consumption'), value: consumptionText(record) }
        ]

  function open(kind: 'fuel-quick' | 'fuel', entry?: string): void {
    if (active === null) return
    void window.tritium.openForm(kind, active, entry)
  }

  async function remove(): Promise<void> {
    if (active === null || record === null) return
    await window.tritium.removeFuel(active, record.id)
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
            data-testid="fuel-quick-add"
            disabled={active === null}
            onClick={() => open('fuel-quick')}
          >
            {t('fuel.quickAdd')}
          </button>

          <button
            type="button"
            className="button"
            data-testid="fuel-full-add"
            disabled={active === null}
            onClick={() => open('fuel')}
          >
            {t('fuel.fullAdd')}
          </button>
        </div>

        <RangeChips filter={filter} />

        <EntryTable
          rows={rows}
          columns={columns}
          defaultSorting={[{ id: 'odometer_km', desc: true }]}
          selectedId={selected}
          onSelect={setSelected}
          name="fuel"
        />
      </section>

      <section className="pane">
        <RecordDetail
          id={record?.id ?? null}
          heading={t('fuel.editTitle')}
          rows={detail}
          onEdit={() => record !== null && open('fuel', record.id)}
          onDelete={() => void remove()}
          testId="fuel-detail"
        />
      </section>
    </div>
  )
}
