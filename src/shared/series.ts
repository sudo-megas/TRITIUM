// The seven series of XTRITIUM §7.2 (F8), as arithmetic.
//
// Nothing here knows what a chart is. No colour, no formatting, no ECharts type
// crosses this file — a series is a list of pairs, and it is tested as one.
//
// Every `y` is a SCALED INTEGER (§4.3): money ×100, pump figures ×1000,
// consumption ×1000, cost-per-kilometre ×1000, odometer in whole kilometres.
//
// Month keys are cut out of the `YYYY-MM-DD` string with `slice`, never by
// constructing a Date. The same reasoning `range.ts` gives and the same reason
// `todayIso` exists: this machine is UTC+3, and a Date would move an entry made
// at 01:00 into the month before (§3.6, and F4's UTC+3 trap).

import { consumptionPoints, entryTotal } from './consumption.js'
import { signedAmount } from './costs.js'
import { compareDate } from './entries.js'
import type { CostEntry, FuelEntry, ServiceEntry } from './records.js'

/** A point on a series whose x is a date. */
export interface DatePoint {
  date: string
  value: number
}

/** A point on a monthly series. `from`/`to` say what span the value covers. */
export interface MonthPoint {
  month: string
  value: number
  from?: string
  to?: string
}

/** `2026-08-16` -> `2026-08`. String surgery, not calendar arithmetic. */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

function dated<T extends { date: string }>(entries: readonly T[]): T[] {
  return entries.filter((entry) => entry.date.length > 0)
}

function byDate<T extends { date: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((left, right) => compareDate(left.date, right.date))
}

// ---------------------------------------------------------------------------
// Per-record series: one point per record
// ---------------------------------------------------------------------------

/**
 * Fuel Consumption — l/100km, scaled ×1000.
 *
 * The engine is handed the WHOLE history. A caller that filters first destroys
 * the figure: the first full tank inside the window loses the earlier one it is
 * measured against, and a partial fill just outside stops being counted into the
 * tank that burnt it (§5.2, F7.md decision 3). Filter the RESULT, never the
 * input — `tests/unit/series.test.ts` holds this.
 */
export function consumptionSeries(fuel: readonly FuelEntry[]): DatePoint[] {
  return consumptionPoints(fuel)
    .filter((point) => point.date.length > 0)
    .map((point) => ({ date: point.date, value: point.l100km }))
    .sort((left, right) => compareDate(left.date, right.date))
}

/** Gas Price — price per litre as entered, scaled ×1000. */
export function gasPriceSeries(fuel: readonly FuelEntry[]): DatePoint[] {
  return byDate(dated(fuel))
    .filter((entry) => entry.price_per_litre > 0)
    .map((entry) => ({ date: entry.date, value: entry.price_per_litre }))
}

/**
 * Fill-up Costs — what each individual fill-up cost, money ×100.
 *
 * Deliberately NOT a monthly figure. §7.2 lists this and Monthly Costs
 * separately because they answer different questions, and a reader who took one
 * for the other would be out by however many times the tank was filled.
 */
export function fillupCostSeries(fuel: readonly FuelEntry[]): DatePoint[] {
  return byDate(dated(fuel))
    .map((entry) => ({ date: entry.date, value: entryTotal(entry) }))
    .filter((point) => point.value > 0)
}

/** Every odometer reading the vehicle has, from both files that carry one. */
export function odometerReadings(
  fuel: readonly FuelEntry[],
  service: readonly ServiceEntry[]
): DatePoint[] {
  const readings = [
    ...dated(fuel).map((entry) => ({ date: entry.date, value: entry.odometer_km })),
    ...dated(service).map((entry) => ({ date: entry.date, value: entry.odometer_km }))
  ].filter((point) => point.value > 0)

  return readings.sort((left, right) => compareDate(left.date, right.date))
}

/** Odometer — every reading, from fuel and service alike (F6's reasoning). */
export function odometerSeries(
  fuel: readonly FuelEntry[],
  service: readonly ServiceEntry[]
): DatePoint[] {
  return odometerReadings(fuel, service)
}

// ---------------------------------------------------------------------------
// Monthly series: one point per calendar month
// ---------------------------------------------------------------------------

/**
 * Monthly Costs — every lira the vehicle cost that month, money ×100.
 *
 * All three files together: fuel totals (derived, never stored), cost amounts
 * with `income = true` SUBTRACTING (§4.4), and service amounts. Non-fuel-only
 * was the alternative and would put this chart at odds with the Summary card
 * §7.1 asks for and with the cost-per-kilometre figure computed beside it.
 */
export function monthlyCostSeries(
  fuel: readonly FuelEntry[],
  costs: readonly CostEntry[],
  service: readonly ServiceEntry[]
): MonthPoint[] {
  const totals = new Map<string, number>()

  const add = (date: string, amount: number): void => {
    if (date.length === 0) return
    const key = monthOf(date)
    totals.set(key, (totals.get(key) ?? 0) + amount)
  }

  for (const entry of fuel) add(entry.date, entryTotal(entry))
  for (const entry of costs) add(entry.date, signedAmount(entry))
  for (const entry of service) add(entry.date, entry.amount)

  return [...totals.entries()]
    .map(([month, value]) => ({ month, value }))
    .sort((left, right) => (left.month > right.month ? 1 : -1))
}

/**
 * Monthly Distance — kilometres between the readings that exist.
 *
 * A month's distance is the highest odometer known by the end of it minus the
 * highest known before it. Two consequences, both deliberate:
 *
 * - The FIRST month with a reading produces no bar. There is nothing earlier to
 *   measure it against, exactly as §5.2's first fill-up produces no consumption
 *   point.
 * - A month with no reading produces NO BAR, not a zero. Zero kilometres and no
 *   record of driving are different claims and only one of them is in the file
 *   (§3.3). The distance since the last reading is attributed to the month of
 *   the later one, and `from`/`to` carry the span it actually covers so the data
 *   table beneath the chart can say so rather than implying one month.
 */
export function monthlyDistanceSeries(readings: readonly DatePoint[]): MonthPoint[] {
  const highest = new Map<string, DatePoint>()

  for (const reading of readings) {
    const key = monthOf(reading.date)
    const current = highest.get(key)
    if (current === undefined || reading.value > current.value) highest.set(key, reading)
  }

  const months = [...highest.entries()].sort((left, right) => (left[0] > right[0] ? 1 : -1))

  const points: MonthPoint[] = []
  for (let index = 1; index < months.length; index += 1) {
    const previous = months[index - 1]?.[1]
    const current = months[index]
    if (previous === undefined || current === undefined) continue

    const distance = current[1].value - previous.value
    // A non-positive span measures nothing and so says nothing — the same
    // answer §5.2 gives two entries at the same reading.
    if (distance <= 0) continue

    points.push({
      month: current[0],
      value: distance,
      from: previous.date,
      to: current[1].date
    })
  }

  return points
}

/**
 * Cost per Kilometer — the month's spend divided by the month's distance,
 * scaled ×1000.
 *
 * Only where both halves are real. A month with spend but no measured distance
 * produces NO POINT: dividing by an unknown is a guess, and an app that targets
 * precision does not guess (§5.2).
 *
 * `money ×100 ÷ km`, expressed at three decimals, is `round(amount × 10 ÷ km)`.
 */
export function costPerKmSeries(
  monthlyCost: readonly MonthPoint[],
  monthlyDistance: readonly MonthPoint[]
): MonthPoint[] {
  const spend = new Map(monthlyCost.map((point) => [point.month, point.value]))

  return monthlyDistance
    .filter((point) => point.value > 0 && spend.has(point.month))
    .map((point) => ({
      month: point.month,
      value: Math.round(((spend.get(point.month) as number) * 10) / point.value),
      ...(point.from !== undefined ? { from: point.from } : {}),
      ...(point.to !== undefined ? { to: point.to } : {})
    }))
    .filter((point) => point.value > 0)
}
