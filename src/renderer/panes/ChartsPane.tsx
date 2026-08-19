// The seven charts of XTRITIUM §7.2 (F8, retiled in F15).
//
// Fuel Consumption · Monthly Costs · Gas Price · Fill-up Costs · Odometer ·
// Cost per Kilometer · Monthly Distance. Not six, not eight, and not renamed.
//
// §7.2 gives the chips to EACH chart, so each carries its own — a chart is
// asked its own question, and one shared row would mean the maker could not look
// at this year's consumption beside last year's price without changing both.
//
// F8 read that as a reason to stack the seven at full width: a chip row, a
// toggle and a fullscreen button were judged not to fit under a 628-pixel card,
// and the only alternative F8 saw was disobeying §7.2 to save space. F15 tiles
// them two to a row and keeps every chip, by letting the control row wrap
// instead of choosing between the two.
//
// Nothing here projects anything. No trend line, no regression, no average
// reference line — §3.3 and §7.2, which names that last one explicitly.

import { useMemo, useState, type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { EChartsCoreOption } from 'echarts/core'
import { formatDate, formatFigure, formatMoneyText } from '../../shared/format.js'
import { filterByBounds, type DateBounds } from '../../shared/range.js'
import type { VehicleBundle } from '../../shared/records.js'
import { PUMP_DECIMALS } from '../../shared/scaled.js'
import {
  consumptionSeries,
  costPerKmSeries,
  fillupCostSeries,
  gasPriceSeries,
  monthlyCostSeries,
  monthlyDistanceSeries,
  odometerSeries,
  type DatePoint,
  type MonthPoint
} from '../../shared/series.js'
import { useSettings } from '../state/settings.js'
import { useUnits } from '../state/units.js'
import { useVehicles } from '../state/vehicles.js'
import { Chart, readChartPalette, type ChartPalette } from './Chart.js'
import { RangeChips, useRangeFilter } from './RangeChips.js'

/** How a chart is drawn, and how its figures are read. */
type Mode = 'line' | 'area' | 'smooth'
const MODES: Mode[] = ['line', 'area', 'smooth']

type ChartId =
  | 'consumption'
  | 'monthlyCosts'
  | 'gasPrice'
  | 'fillupCosts'
  | 'odometer'
  | 'costPerKm'
  | 'monthlyDistance'

/** A point after the range has been applied, ready to plot. */
interface Plotted {
  label: string
  value: number
  /** Only monthly points carry a span; the data table shows it. */
  span?: string
}

const CHART_IDS: ChartId[] = [
  'consumption',
  'monthlyCosts',
  'gasPrice',
  'fillupCosts',
  'odometer',
  'costPerKm',
  'monthlyDistance'
]

/** The two §7.2 calls bar charts. They are the ones that carry a data table. */
const BARS: ChartId[] = ['monthlyCosts', 'monthlyDistance']

/** Monthly charts get a data table beneath, bar or not — the span needs saying. */
const MONTHLY: ChartId[] = ['monthlyCosts', 'costPerKm', 'monthlyDistance']

export function ChartsPane(): JSX.Element {
  const { t } = useTranslation()
  const bundle = useVehicles((s) => s.bundle)
  const [full, setFull] = useState<ChartId | null>(null)

  const shown = full === null ? CHART_IDS : [full]

  return (
    <div className="panes">
      <section className="pane pane--wide">
        <div className={full === null ? 'charts' : 'charts charts--full'}>
          {shown.map((id) => (
            <ChartCard
              key={id}
              id={id}
              bundle={bundle}
              full={full === id}
              onToggleFull={() => setFull(full === id ? null : id)}
            />
          ))}
        </div>
        {/* §7 — an empty app is the same layout holding nothing. The charts are
            present and empty rather than replaced by a picture. */}
        {bundle === null && (
          <p className="charts__empty" data-testid="charts-empty">
            {t('table.empty')}
          </p>
        )}
      </section>
    </div>
  )
}

function ChartCard({
  id,
  bundle,
  full,
  onToggleFull
}: {
  id: ChartId
  bundle: VehicleBundle | null
  full: boolean
  onToggleFull: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const currency = useSettings((s) => s.currency)
  const units = useUnits()
  const palette = useSettings((s) => s.palette)

  const filter = useRangeFilter()
  const [mode, setMode] = useState<Mode>('line')

  const bar = BARS.includes(id)
  const monthly = MONTHLY.includes(id)

  const points = useMemo(() => plot(id, bundle, filter.bounds), [id, bundle, filter.bounds])

  /**
   * How a figure on this chart is read — through the unit boundary, so a chart
   * says miles when the lists say miles (F11).
   */
  const show = (value: number): string => {
    if (id === 'consumption') return units.consumption(value) ?? ''
    if (id === 'gasPrice') return units.pricePerVolume(value)
    if (id === 'odometer' || id === 'monthlyDistance') return units.distance(value)
    if (id === 'costPerKm') return units.costPerDistance(value)
    return formatMoneyText(value, currency ?? '')
  }

  /**
   * And the same conversion applied to the PLOTTED value, not only its label.
   * An axis drawn from kilometres under a label reading miles would be a chart
   * that lies quietly — the exact failure mode F7 was built around.
   */
  const convert = (value: number): number => {
    if (id === 'consumption') return units.consumptionValue(value) ?? 0
    if (id === 'gasPrice') return units.pricePerVolumeValue(value)
    if (id === 'odometer' || id === 'monthlyDistance') return units.distanceValue(value)
    if (id === 'costPerKm') return units.costPerDistanceValue(value)
    return value
  }

  // Rebuilt when the palette changes: the colours are read from the cascade at
  // this moment, so a palette switch produces a new option and the chart
  // repaints with the rest of the interface (§8).
  const option = useMemo(
    () =>
      buildOption(
        points.map((point) => ({ ...point, value: convert(point.value) })),
        readChartPalette(),
        bar,
        mode,
        (value) => showConverted(id, value, units, currency ?? '')
      ),
    [points, bar, mode, palette, currency, units, id]
  )

  return (
    <article className="chart" data-testid={`chart-${id}`}>
      <header className="chart__head">
        <h2 className="chart__title">{t(`charts.${id}`)}</h2>

        <div className="chart__controls">
          {/* §7.2 — line / area / smooth. A way of looking at the chart in
              front of you, not a setting: settings.toml gains nothing. */}
          {!bar && (
            <div className="chips chips--tight">
              {MODES.map((candidate) => (
                <button
                  type="button"
                  key={candidate}
                  className="chip"
                  data-testid={`chart-${id}-${candidate}`}
                  aria-pressed={mode === candidate}
                  onClick={() => setMode(candidate)}
                >
                  {t(`charts.${candidate}`)}
                </button>
              ))}
            </div>
          )}

          {/* Fullscreen REPLACES the grid; it does not cover it (F8.md
              decision 4), so the no-overlap law needs no exemption. */}
          <button
            type="button"
            className="button"
            data-testid={`chart-${id}-full`}
            onClick={onToggleFull}
          >
            {full ? t('charts.exitFullscreen') : t('charts.fullscreen')}
          </button>
        </div>
      </header>

      <RangeChips filter={filter} />

      <div className={full ? 'chart__body chart__body--full' : 'chart__body'}>
        <Chart option={option} testId={`chart-${id}-canvas`} />
      </div>

      {/* §7.2 — bar charts carry a data table beneath. The monthly line chart
          gets one too: its span is a fact the plot cannot state. */}
      {monthly && (
        <table className="entries entries--dense" data-testid={`chart-${id}-table`}>
          <thead>
            <tr>
              <th>{t('charts.month')}</th>
              <th>{t('charts.value')}</th>
              <th>{t('charts.span')}</th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 && (
              <tr>
                <td className="entries__empty" colSpan={3} data-testid={`chart-${id}-table-empty`}>
                  {t('table.empty')}
                </td>
              </tr>
            )}
            {points.map((point) => (
              <tr key={point.label} data-testid={`chart-${id}-row-${point.label}`}>
                <td>{point.label}</td>
                <td>{show(point.value)}</td>
                <td>{point.span ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  )
}

/**
 * A value that has ALREADY been converted, formatted for an axis or a tooltip.
 *
 * The plotted numbers are converted once, before the option is built, so this
 * only has to add the separators and the decimals — converting again here would
 * turn miles into miles-of-miles.
 */
function showConverted(
  id: ChartId,
  value: number,
  units: ReturnType<typeof useUnits>,
  currency: string
): string {
  if (id === 'consumption') return formatFigure(value, units.consumptionDecimals)
  if (id === 'gasPrice') return formatFigure(value, PUMP_DECIMALS)
  if (id === 'odometer' || id === 'monthlyDistance')
    return formatFigure(value, units.distanceDecimals)
  if (id === 'costPerKm') return formatFigure(value, units.costDecimals)
  return formatMoneyText(value, currency)
}

/**
 * The points a chart shows, after the range.
 *
 * The range is applied to the RESULT and never to the input. Filtering the
 * fill-ups before the consumption engine destroys the figures — the first full
 * tank inside the window loses the earlier one it is measured against (§5.2,
 * F7.md decision 3, and `tests/unit/series.test.ts` holds it).
 */
function plot(id: ChartId, bundle: VehicleBundle | null, bounds: DateBounds): Plotted[] {
  if (bundle === null) return []

  const fuel = bundle.fuel.entries
  const costs = bundle.costs.entries
  const service = bundle.service.entries

  const byDate = (points: DatePoint[]): Plotted[] =>
    filterByBounds(points, bounds).map((point) => ({
      label: formatDate(point.date),
      value: point.value
    }))

  // A monthly point is inside the window when its month's first day is — the
  // chips are date bounds and a month is not a date.
  const byMonth = (points: MonthPoint[]): Plotted[] =>
    filterByBounds(
      points.map((point) => ({ ...point, date: `${point.month}-01` })),
      bounds
    ).map((point) => ({
      label: point.month,
      value: point.value,
      ...(point.from !== undefined && point.to !== undefined
        ? { span: `${formatDate(point.from)} – ${formatDate(point.to)}` }
        : {})
    }))

  switch (id) {
    case 'consumption':
      return byDate(consumptionSeries(fuel))
    case 'gasPrice':
      return byDate(gasPriceSeries(fuel))
    case 'fillupCosts':
      return byDate(fillupCostSeries(fuel))
    case 'odometer':
      return byDate(odometerSeries(fuel, service))
    case 'monthlyCosts':
      return byMonth(monthlyCostSeries(fuel, costs, service))
    case 'monthlyDistance':
      return byMonth(monthlyDistanceSeries(odometerSeries(fuel, service)))
    case 'costPerKm':
      return byMonth(
        costPerKmSeries(
          monthlyCostSeries(fuel, costs, service),
          monthlyDistanceSeries(odometerSeries(fuel, service))
        )
      )
  }
}

/**
 * The ECharts option for a set of points.
 *
 * Every colour comes from the palette argument, which was read out of the live
 * document — there is no colour literal in this file, and `audit-colours` would
 * fail the build if there were (§8).
 */
function buildOption(
  points: Plotted[],
  palette: ChartPalette,
  bar: boolean,
  mode: Mode,
  show: (value: number) => string
): EChartsCoreOption {
  const colour = palette.series[0] ?? palette.text

  return {
    animation: false,
    // A canvas inherits no CSS, so the family and size are handed over here or
    // the charts speak in a different typeface from the rest of the application
    // (F15, issues.md I-28). This is the root default; the tooltip and the axis
    // labels below override textStyle, so they carry it explicitly too.
    textStyle: { fontFamily: palette.font, fontSize: palette.fontSize },
    grid: { left: 64, right: 16, top: 16, bottom: 28, containLabel: true },
    // §7.2 grants the tooltip. It is a reading aid inside one canvas, not a
    // layer over the interface — see F8.md decision 2 and the note in
    // scripts/audit-overlap.mjs.
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      textStyle: {
        color: palette.text,
        fontFamily: palette.font,
        fontSize: palette.fontSize
      },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [params]
        const first = rows[0] as { axisValue?: string; value?: number } | undefined
        if (first === undefined) return ''
        return `${first.axisValue ?? ''}\n${show(Number(first.value ?? 0))}`
      }
    },
    // §7.2 — zoom and pan, inside the plot. No slider: it would take a third of
    // a card's height to say what the wheel already says.
    dataZoom: [{ type: 'inside' }],
    xAxis: {
      type: 'category',
      data: points.map((point) => point.label),
      axisLine: { lineStyle: { color: palette.border } },
      axisLabel: {
        color: palette.muted,
        hideOverlap: true,
        fontFamily: palette.font,
        fontSize: palette.fontSize
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: palette.border } },
      axisLabel: {
        color: palette.muted,
        formatter: (value: number) => show(value),
        fontFamily: palette.font,
        fontSize: palette.fontSize
      }
    },
    series: [
      {
        type: bar ? 'bar' : 'line',
        data: points.map((point) => point.value),
        itemStyle: { color: colour },
        lineStyle: { color: colour },
        ...(bar ? {} : { smooth: mode === 'smooth', showSymbol: points.length <= 60 }),
        ...(!bar && mode === 'area' ? { areaStyle: { color: colour, opacity: 0.25 } } : {})
      }
    ]
  }
}
