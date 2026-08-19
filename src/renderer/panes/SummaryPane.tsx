// The Summary page (XTRITIUM §7.1, F9) — the tab the application opens on.
//
// Every block §7.1 settled, in the order it settled them: vehicle header, gas
// card, costs card, trend cards as a STATIC GRID (no carousel — §7.1 forbids one
// by name), last entries, lifetime totals.
//
// The page is READ-ONLY. Adding a record is what the FUEL, COSTS and SERVICE
// tabs are for, and a second way in would be a second thing to keep correct.
//
// It reads the bundle the shell already holds and reads nothing else, so it
// cannot disagree with the lists on the other tabs — they are the same objects,
// formatted differently.

import { type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate, formatFigure, formatMoneyText, todayIso } from '../../shared/format.js'
import { boundsFor } from '../../shared/range.js'
import {
  costPerKmSeries,
  monthlyCostSeries,
  monthlyDistanceSeries,
  odometerSeries,
  type MonthPoint
} from '../../shared/series.js'
import {
  averageConsumption,
  compare,
  lastConsumption,
  lastPrice,
  latestOdometer,
  lifetimeDistance,
  lifetimeLitres,
  lifetimeSpend,
  recentEntries,
  type Comparison
} from '../../shared/summary.js'
import { useSettings } from '../state/settings.js'
import { useUnits } from '../state/units.js'
import { useVehicles } from '../state/vehicles.js'

const RECENT_LIMIT = 8

export function SummaryPane(): JSX.Element {
  const { t } = useTranslation()
  const bundle = useVehicles((s) => s.bundle)
  const names = useVehicles((s) => s.names)
  const active = useVehicles((s) => s.active)
  const currency = useSettings((s) => s.currency)
  const units = useUnits()

  const fuel = bundle?.fuel.entries ?? []
  const costs = bundle?.costs.entries ?? []
  const service = bundle?.service.entries ?? []

  const money = (value: number): string => formatMoneyText(value, currency ?? '')
  const nothing = t('summary.nothing')

  // The two months the cards compare, and the spans they actually cover. On the
  // third of the month this is three days against thirty-one, and the card says
  // so rather than reporting a fall of ninety per cent (F9.md decision 5).
  const today = todayIso()
  const thisBounds = boundsFor('this-month', today)
  const prevBounds = boundsFor('previous-month', today)
  const thisMonth = today.slice(0, 7)
  const prevMonth = (prevBounds.from ?? '').slice(0, 7)

  const spendSeries = monthlyCostSeries(fuel, costs, service)
  const distanceSeries = monthlyDistanceSeries(odometerSeries(fuel, service))
  const perKmSeries = costPerKmSeries(spendSeries, distanceSeries)

  const at = (series: readonly MonthPoint[], month: string): number =>
    series.find((point) => point.month === month)?.value ?? 0
  const has = (series: readonly MonthPoint[], month: string): boolean =>
    series.some((point) => point.month === month)

  const spend = compare(at(spendSeries, thisMonth), at(spendSeries, prevMonth), has(spendSeries, prevMonth))
  const distance = compare(
    at(distanceSeries, thisMonth),
    at(distanceSeries, prevMonth),
    has(distanceSeries, prevMonth)
  )
  const perKm = compare(
    at(perKmSeries, thisMonth),
    at(perKmSeries, prevMonth),
    has(perKmSeries, prevMonth)
  )
  const fills = compare(
    fuel.filter((entry) => entry.date.slice(0, 7) === thisMonth).length,
    fuel.filter((entry) => entry.date.slice(0, 7) === prevMonth).length,
    fuel.some((entry) => entry.date.slice(0, 7) === prevMonth)
  )

  const average = averageConsumption(fuel)
  const last = lastConsumption(fuel)
  const price = lastPrice(fuel)
  const odometer = latestOdometer(fuel, service)

  const consumptionText = (value: number | null): string =>
    value === null ? nothing : (units.consumption(value) ?? nothing)

  const perKmText = (value: number): string => units.costPerDistance(value)

  const span = (from: string | null, to: string | null): string =>
    `${from === null ? '' : formatDate(from)} – ${to === null ? '' : formatDate(to)}`

  const recent = recentEntries(bundle, RECENT_LIMIT)

  return (
    <div className="panes">
      <section className="pane">
        {/* §7.1 — name and odometer. NO PHOTO: §4.4 has no field for one and
            §7 says vehicles have none anywhere in TRITIUM. */}
        <header className="summary__header" data-testid="summary-header">
          <h2 className="summary__name" data-testid="summary-name">
            {active === null ? t('vehicles.none') : (names[active] ?? active)}
          </h2>
          <p className="summary__odometer" data-testid="summary-odometer">
            {odometer === null ? nothing : units.distanceWith(odometer)}
          </p>
        </header>

        <Card heading={t('summary.gas')} testId="summary-gas">
          <Row
            label={t('summary.averageConsumption')}
            value={consumptionText(average)}
            testId="summary-average"
          />
          <Row
            label={t('summary.lastConsumption')}
            value={consumptionText(last)}
            testId="summary-last-consumption"
          />
          <Row
            label={t('summary.lastPrice')}
            value={
              price === null
                ? nothing
                : `${units.pricePerVolume(price.price)} · ${formatDate(price.date)}`
            }
            testId="summary-last-price"
          />
        </Card>

        <Card heading={t('summary.costs')} testId="summary-costs">
          {/* The card names the spans it compares rather than implying two whole
              months (F9.md decision 5). */}
          <p className="summary__span" data-testid="summary-costs-span">
            {span(thisBounds.from, thisBounds.to)} · {span(prevBounds.from, prevBounds.to)}
          </p>
          <Row
            label={t('summary.thisMonth')}
            value={money(spend.current)}
            testId="summary-this-month"
          />
          <Row
            label={t('summary.previousMonth')}
            value={money(spend.previous)}
            testId="summary-previous-month"
          />
        </Card>

        <Card heading={t('summary.lifetime')} testId="summary-lifetime">
          <Row
            label={t('summary.totalSpend')}
            value={money(lifetimeSpend(fuel, costs, service))}
            testId="summary-total-spend"
          />
          <Row
            label={t('summary.totalDistance')}
            value={units.distanceWith(lifetimeDistance(fuel, service))}
            testId="summary-total-distance"
          />
          <Row
            label={t('summary.totalLitres')}
            value={units.volumeWith(lifetimeLitres(fuel))}
            testId="summary-total-litres"
          />
        </Card>
      </section>

      <section className="pane">
        {/* §7.1 — a STATIC GRID, all visible at once. No carousel, and nothing
            here hides a card. */}
        <h2 className="section__title">{t('summary.trends')}</h2>
        <div className="trends" data-testid="summary-trends">
          <Trend
            label={t('summary.monthlySpend')}
            comparison={spend}
            show={money}
            testId="trend-spend"
          />
          <Trend
            label={t('summary.monthlyDistance')}
            comparison={distance}
            show={(value) => units.distanceWith(value)}
            testId="trend-distance"
          />
          <Trend
            label={t('summary.costPerKm')}
            comparison={perKm}
            show={perKmText}
            testId="trend-cost-per-km"
          />
          <Trend
            label={t('summary.fillups')}
            comparison={fills}
            show={(value) => formatFigure(value, 0)}
            testId="trend-fillups"
          />
        </div>

        <h2 className="section__title">{t('summary.recent')}</h2>
        <table className="entries entries--dense" data-testid="summary-recent">
          <thead>
            <tr>
              <th>{t('costs.fields.date')}</th>
              <th>{t('summary.kind')}</th>
              <th>{t('costs.fields.title')}</th>
              <th>{t('costs.fields.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td className="entries__empty" colSpan={4} data-testid="summary-recent-empty">
                  {t('table.empty')}
                </td>
              </tr>
            )}
            {recent.map((entry) => (
              <tr key={`${entry.kind}-${entry.id}`} data-testid={`summary-recent-${entry.id}`}>
                <td>{formatDate(entry.date)}</td>
                <td>{t(`summary.kinds.${entry.kind}`)}</td>
                <td>
                  <span className="entries__text">{entry.label}</span>
                </td>
                <td>{money(entry.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Card({
  heading,
  testId,
  children
}: {
  heading: string
  testId: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="card" data-testid={testId}>
      <h2 className="section__title">{heading}</h2>
      <dl className="detail__rows">{children}</dl>
    </section>
  )
}

function Row({
  label,
  value,
  testId
}: {
  label: string
  value: string
  testId: string
}): JSX.Element {
  return (
    <div className="detail__row">
      <dt className="detail__key">{label}</dt>
      <dd className="detail__value" data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}

/**
 * One trend card: a figure, the same figure for the month before, and the
 * difference — all three realised.
 *
 * A period with no previous month shows no change at all rather than a rise from
 * zero. A rise from nothing is not a rise, and reporting one would be the page
 * inventing a trend out of an absence (§3.3).
 */
function Trend({
  label,
  comparison,
  show,
  testId
}: {
  label: string
  comparison: Comparison
  show: (value: number) => string
  testId: string
}): JSX.Element {
  const { t } = useTranslation()
  const change = comparison.change

  return (
    <article className="trend" data-testid={testId}>
      <h3 className="trend__label">{label}</h3>
      <p className="trend__value" data-testid={`${testId}-value`}>
        {show(comparison.current)}
      </p>
      <p className="trend__previous" data-testid={`${testId}-change`}>
        {change === undefined
          ? t('summary.noPrevious')
          : `${change > 0 ? '+' : ''}${show(change)} · ${show(comparison.previous)}`}
      </p>
    </article>
  )
}
