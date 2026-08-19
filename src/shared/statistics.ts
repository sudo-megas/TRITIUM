// The Statistics section (XTRITIUM §7.3, F10), as arithmetic.
//
// Four figures: best and worst tank, km per day, projected annual cost, and
// true cost per kilometre including the purchase price. Computed over realised
// data only — §7.3's own last clause.
//
// EVERY FIGURE CARRIES THE WINDOW IT WAS TAKEN OVER. A statistic without its
// span is a number without units: "84.000,00 ₺ a year" is not a claim until it
// says it was measured over eleven weeks, and once it says so the maker can see
// for himself how much to trust it.
//
// A figure that cannot be computed returns null with a REASON, never zero. Zero
// kilometres and no record of driving are different claims (§3.3), and this is
// the page where confusing them would be most expensive.

import { consumptionPoints, type ConsumptionPoint } from './consumption.js'
import { compareDate } from './entries.js'
import type { CostEntry, FuelEntry, ServiceEntry, Vehicle } from './records.js'
import { odometerSeries } from './series.js'
import { lifetimeDistance, lifetimeSpend } from './summary.js'

/**
 * The shortest observation a projection is allowed to run on.
 *
 * Two fill-ups a week apart would otherwise project a five-figure annual cost
 * off a fortnight of data, which is not a statistic — it is an accident with a
 * multiplier. Named once, shown on the page.
 */
export const MINIMUM_PROJECTION_DAYS = 60

/** Why a figure could not be computed. The page prints the reason, not a zero. */
export type Missing =
  'no-intervals' | 'no-readings' | 'no-distance' | 'too-short' | 'no-purchase-price'

export interface Figure<T> {
  value: T | null
  missing?: Missing
  /** The window the figure was computed over, as `YYYY-MM-DD` bounds. */
  from?: string
  to?: string
  days?: number
}

function missing<T>(reason: Missing): Figure<T> {
  return { value: null, missing: reason }
}

/**
 * Whole days between two `YYYY-MM-DD` dates.
 *
 * Built with `Date.UTC` at both ends and subtracted, so no local offset and no
 * locale enters — the same UTC-only calendar arithmetic `range.ts` uses for
 * month ends, and for the same reason (§3.6). A day is 86.400.000 ms in UTC
 * always; it is only in local time that one can be 23 hours long.
 */
export function daysBetween(from: string, to: string): number {
  const stamp = (date: string): number =>
    Date.UTC(
      Number.parseInt(date.slice(0, 4), 10),
      Number.parseInt(date.slice(5, 7), 10) - 1,
      Number.parseInt(date.slice(8, 10), 10)
    )

  return Math.round((stamp(to) - stamp(from)) / 86_400_000)
}

/** The dated records the observation window is taken from. */
function datedSpan(
  fuel: readonly FuelEntry[],
  costs: readonly CostEntry[],
  service: readonly ServiceEntry[]
): { from: string; to: string; days: number } | null {
  const dates = [...fuel, ...costs, ...service]
    .map((entry) => entry.date)
    .filter((date) => date.length > 0)
    .sort(compareDate)

  const from = dates[0]
  const to = dates[dates.length - 1]
  if (from === undefined || to === undefined) return null

  return { from, to, days: daysBetween(from, to) }
}

/**
 * The best tank — the lowest l/100km among §5.2's intervals.
 *
 * It IS an interval, not a fill-up, so it inherits everything §5.2 fixed: only
 * between consecutive full tanks, every partial counted into the later one, and
 * no point at all for the first entry. The interval is returned whole, because
 * "best tank: 5,10" invites the question its distance and litres already answer.
 */
export function bestTank(fuel: readonly FuelEntry[]): Figure<ConsumptionPoint> {
  return extremeTank(fuel, (candidate, best) => candidate.l100km < best.l100km)
}

/** The worst tank — the highest l/100km among the same intervals. */
export function worstTank(fuel: readonly FuelEntry[]): Figure<ConsumptionPoint> {
  return extremeTank(fuel, (candidate, worst) => candidate.l100km > worst.l100km)
}

function extremeTank(
  fuel: readonly FuelEntry[],
  better: (candidate: ConsumptionPoint, incumbent: ConsumptionPoint) => boolean
): Figure<ConsumptionPoint> {
  const points = consumptionPoints(fuel)
  if (points.length === 0) return missing('no-intervals')

  let chosen = points[0] as ConsumptionPoint
  for (const point of points) if (better(point, chosen)) chosen = point

  return { value: chosen, from: chosen.date, to: chosen.date }
}

/** True when there is only one interval, so best and worst are the same one. */
export function singleInterval(fuel: readonly FuelEntry[]): boolean {
  return consumptionPoints(fuel).length === 1
}

/**
 * Kilometres per day, ×100.
 *
 * Spans the READINGS, not the calendar: a vehicle bought in April and first
 * recorded in August is measured from August. The app knows what it was told,
 * and §3.3 keeps it from assuming the rest.
 */
export function kmPerDay(
  fuel: readonly FuelEntry[],
  service: readonly ServiceEntry[]
): Figure<number> {
  const readings = odometerSeries(fuel, service)
  if (readings.length < 2) return missing('no-readings')

  const from = readings[0]?.date as string
  const to = readings[readings.length - 1]?.date as string
  const days = daysBetween(from, to)
  if (days <= 0) return missing('no-distance')

  const distance = lifetimeDistance(fuel, service)
  if (distance <= 0) return missing('no-distance')

  return { value: Math.round((distance * 100) / days), from, to, days }
}

/**
 * Projected annual cost, money ×100 — the one figure in TRITIUM that looks
 * forward, and the one §7.3 asks for by name.
 *
 * §3.3 forbids "projections OF FUTURE ENTRIES" and permits "projections AS
 * STATISTICS" in the same breath. This is the second: one aggregate number
 * saying what a year would cost at the rate the maker has actually spent. It
 * creates nothing, suggests nothing, and reminds no one of anything.
 *
 * Spend per observed day × 365 — deliberately not a monthly figure × 12, which
 * would weight a part-month exactly as heavily as a whole one.
 */
export function projectedAnnualCost(
  fuel: readonly FuelEntry[],
  costs: readonly CostEntry[],
  service: readonly ServiceEntry[]
): Figure<number> {
  const span = datedSpan(fuel, costs, service)
  if (span === null) return missing('no-readings')

  if (span.days < MINIMUM_PROJECTION_DAYS) {
    return { value: null, missing: 'too-short', from: span.from, to: span.to, days: span.days }
  }

  const spend = lifetimeSpend(fuel, costs, service)
  return {
    value: Math.round((spend * 365) / span.days),
    from: span.from,
    to: span.to,
    days: span.days
  }
}

/** Cost per kilometre over the vehicle's life, WITHOUT the purchase price, ×1000. */
export function runningCostPerKm(
  fuel: readonly FuelEntry[],
  costs: readonly CostEntry[],
  service: readonly ServiceEntry[]
): Figure<number> {
  const distance = lifetimeDistance(fuel, service)
  if (distance <= 0) return missing('no-distance')

  const spend = lifetimeSpend(fuel, costs, service)
  return { value: Math.round((spend * 10) / distance) }
}

/**
 * TRUE cost per kilometre, ×1000 — §7.3's phrase, and the ONLY place in TRITIUM
 * that spends `purchase_price`.
 *
 * F9's lifetime totals leave it out on purpose: folding two million lira into a
 * page of fuel figures would make every other number on it unreadable. Here it
 * belongs, and it is shown beside the running figure — the two together are the
 * statistic, because one of them falls for the whole life of the car and the
 * other does not.
 */
export function trueCostPerKm(
  vehicle: Vehicle | null,
  fuel: readonly FuelEntry[],
  costs: readonly CostEntry[],
  service: readonly ServiceEntry[]
): Figure<number> {
  const distance = lifetimeDistance(fuel, service)
  if (distance <= 0) return missing('no-distance')

  const purchase = vehicle?.purchase_price ?? 0
  if (purchase <= 0) return missing('no-purchase-price')

  const spend = lifetimeSpend(fuel, costs, service) + purchase
  return { value: Math.round((spend * 10) / distance) }
}
