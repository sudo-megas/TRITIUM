// The Statistics section (XTRITIUM §7.3, F10) — "a dedicated section of its
// own", and the last tab that was still holding F1's empty cells.
//
// Four figures, and every one of them states the window it was computed over. A
// statistic without its span is a number without units, and this is the page
// where that would cost the most: an annual projection taken over eleven weeks
// and a figure taken over three years look identical without it.
//
// Nothing here is a control. §7.3 asks for a section, not a view with knobs, and
// a statistic filtered to "this month" is a different statistic wearing the same
// label — which is why F7's chips are not on this tab.

import { type JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { consumptionAt } from '../../shared/consumption.js'
import { formatDate, formatFigure, formatMoneyText } from '../../shared/format.js'
import { PUMP_DECIMALS } from '../../shared/scaled.js'
import {
  MINIMUM_PROJECTION_DAYS,
  bestTank,
  kmPerDay,
  projectedAnnualCost,
  runningCostPerKm,
  singleInterval,
  trueCostPerKm,
  worstTank,
  type Figure
} from '../../shared/statistics.js'
import { useSettings } from '../state/settings.js'
import { useVehicles } from '../state/vehicles.js'

export function StatisticsPane(): JSX.Element {
  const { t } = useTranslation()
  const bundle = useVehicles((s) => s.bundle)
  const currency = useSettings((s) => s.currency)
  const consumptionDecimals = useSettings((s) => s.decimals_consumption)
  const costPerKmDecimals = useSettings((s) => s.decimals_cost_per_km)

  const fuel = bundle?.fuel.entries ?? []
  const costs = bundle?.costs.entries ?? []
  const service = bundle?.service.entries ?? []
  const vehicle = bundle?.vehicle?.vehicle ?? null

  const best = bestTank(fuel)
  const worst = worstTank(fuel)
  const perDay = kmPerDay(fuel, service)
  const projection = projectedAnnualCost(fuel, costs, service)
  const running = runningCostPerKm(fuel, costs, service)
  const trueCost = trueCostPerKm(vehicle, fuel, costs, service)
  const onlyOne = singleInterval(fuel)

  const money = (value: number): string => formatMoneyText(value, currency ?? '')

  const perKmText = (value: number): string => {
    const shift = 3 - costPerKmDecimals
    const scaled = shift <= 0 ? value : Math.round(value / 10 ** shift)
    return formatFigure(scaled, costPerKmDecimals)
  }

  /** Why a figure is absent, said in words rather than shown as a zero. */
  const reason = (figure: Figure<unknown>): string => {
    if (figure.missing === 'too-short') {
      return t('statistics.tooShort', {
        days: figure.days ?? 0,
        minimum: MINIMUM_PROJECTION_DAYS
      })
    }
    return t(`statistics.missing.${figure.missing ?? 'no-readings'}`)
  }

  /** The window a figure covers, or nothing when it has none to state. */
  const window = (figure: Figure<unknown>): string => {
    if (figure.from === undefined || figure.to === undefined) return ''
    const span = `${formatDate(figure.from)} – ${formatDate(figure.to)}`
    return figure.days === undefined ? span : `${span} · ${t('statistics.days', { days: figure.days })}`
  }

  return (
    <div className="panes">
      <section className="pane">
        <h2 className="section__title">{t('statistics.tanks')}</h2>

        {/* Best and worst are §5.2 INTERVALS, shown whole: the distance and the
            litres answer the question a bare figure invites. */}
        <Stat
          label={t('statistics.bestTank')}
          testId="stat-best"
          value={
            best.value === null
              ? null
              : formatFigure(consumptionAt(best.value.l100km, consumptionDecimals), consumptionDecimals)
          }
          detail={
            best.value === null
              ? ''
              : `${formatFigure(best.value.distance_km, 0)} km · ${formatFigure(best.value.litres, PUMP_DECIMALS)} l`
          }
          window={window(best)}
          reason={reason(best)}
        />

        <Stat
          label={t('statistics.worstTank')}
          testId="stat-worst"
          value={
            worst.value === null
              ? null
              : formatFigure(
                  consumptionAt(worst.value.l100km, consumptionDecimals),
                  consumptionDecimals
                )
          }
          detail={
            worst.value === null
              ? ''
              : `${formatFigure(worst.value.distance_km, 0)} km · ${formatFigure(worst.value.litres, PUMP_DECIMALS)} l`
          }
          window={window(worst)}
          reason={reason(worst)}
        />

        {/* With one interval the best and the worst are the same interval, and
            the page says so rather than printing one figure twice. */}
        {onlyOne && (
          <p className="summary__span" data-testid="stat-single-interval">
            {t('statistics.singleInterval')}
          </p>
        )}

        <h2 className="section__title">{t('statistics.use')}</h2>

        <Stat
          label={t('statistics.kmPerDay')}
          testId="stat-km-per-day"
          value={perDay.value === null ? null : formatFigure(perDay.value, 2)}
          detail=""
          window={window(perDay)}
          reason={reason(perDay)}
        />
      </section>

      <section className="pane">
        <h2 className="section__title">{t('statistics.money')}</h2>

        {/*
         * The one figure in TRITIUM that looks forward. §3.3 forbids projections
         * OF FUTURE ENTRIES and permits projections AS STATISTICS in the same
         * breath; §7.3 asks for this one by name. It creates nothing.
         */}
        <Stat
          label={t('statistics.projectedAnnual')}
          testId="stat-projection"
          value={projection.value === null ? null : money(projection.value)}
          detail={t('statistics.projectionNote')}
          window={window(projection)}
          reason={reason(projection)}
        />

        <Stat
          label={t('statistics.runningCostPerKm')}
          testId="stat-running-cost"
          value={running.value === null ? null : perKmText(running.value)}
          detail=""
          window={window(running)}
          reason={reason(running)}
        />

        {/* §7.3's "true cost per km including purchase price" — the only place
            in the application that spends `purchase_price`. */}
        <Stat
          label={t('statistics.trueCostPerKm')}
          testId="stat-true-cost"
          value={trueCost.value === null ? null : perKmText(trueCost.value)}
          detail={
            vehicle === null || vehicle.purchase_price <= 0
              ? ''
              : t('statistics.includesPurchase', { value: money(vehicle.purchase_price) })
          }
          window={window(trueCost)}
          reason={reason(trueCost)}
        />
      </section>
    </div>
  )
}

/**
 * One statistic: its label, its figure, whatever the figure needs beside it, and
 * the window it covers.
 *
 * A figure that could not be computed prints the REASON — never a zero. Zero
 * kilometres and no record of driving are different claims (§3.3), and on this
 * page confusing them would be most expensive.
 */
function Stat({
  label,
  value,
  detail,
  window,
  reason,
  testId
}: {
  label: string
  value: string | null
  detail: string
  window: string
  reason: string
  testId: string
}): JSX.Element {
  return (
    <article className="stat" data-testid={testId}>
      <h3 className="trend__label">{label}</h3>

      {value === null ? (
        <p className="stat__missing" data-testid={`${testId}-missing`}>
          {reason}
        </p>
      ) : (
        <p className="stat__value" data-testid={`${testId}-value`}>
          {value}
        </p>
      )}

      {detail.length > 0 && value !== null && (
        <p className="stat__detail" data-testid={`${testId}-detail`}>
          {detail}
        </p>
      )}

      {window.length > 0 && (
        <p className="stat__window" data-testid={`${testId}-window`}>
          {window}
        </p>
      )}
    </article>
  )
}
