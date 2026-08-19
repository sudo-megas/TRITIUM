// What the Summary page states (XTRITIUM §7.1, F9), as arithmetic.
//
// Nothing here is stored (§3.7) and nothing here is a projection (§3.3): every
// figure is computed from records the maker actually entered, at read time.
//
// No formatting, no React, no colour crosses this file — it is tested as
// arithmetic, in the same way `series.ts` is.

import { consumptionPoints, entryTotal } from './consumption.js'
import { signedAmount } from './costs.js'
import { compareDate } from './entries.js'
import type { CostEntry, FuelEntry, ServiceEntry, VehicleBundle } from './records.js'
import { sumScaled } from './scaled.js'
import { monthlyCostSeries, odometerSeries } from './series.js'

/**
 * Average consumption — the RATIO OF THE SUMS, never the mean of the ratios.
 *
 * These are different numbers and only one of them is what the car did. Two
 * intervals, 40 l over 400 km and 10 l over 500 km:
 *
 *   mean of the ratios   (10,00 + 2,00) ÷ 2            = 6,00 l/100km
 *   ratio of the sums    50 l ÷ 900 km × 100           = 5,56 l/100km
 *
 * The mean weights a four-hundred-kilometre interval exactly as heavily as a
 * nine-hundred-kilometre one, which is how averaging the consumption column
 * quietly produces a figure the vehicle never achieved. Kept at ×1000 like the
 * engine's own points, and rounded once, at the end.
 *
 * Null when there is no interval at all — §5.2's first fill-up measures nothing,
 * and neither does a vehicle with one.
 */
export function averageConsumption(fuel: readonly FuelEntry[]): number | null {
  const points = consumptionPoints(fuel)
  if (points.length === 0) return null

  const litres = sumScaled(points.map((point) => point.litres))
  const distance = points.reduce((total, point) => total + point.distance_km, 0)
  if (distance <= 0) return null

  return Math.round((litres * 100) / distance)
}

/** The most recent §5.2 interval's figure, ×1000, or null. */
export function lastConsumption(fuel: readonly FuelEntry[]): number | null {
  const points = consumptionPoints(fuel)
  return points.length === 0 ? null : (points[points.length - 1]?.l100km ?? null)
}

/** The price and date of the most recent fill-up that carries a price. */
export function lastPrice(fuel: readonly FuelEntry[]): { price: number; date: string } | null {
  const priced = fuel
    .filter((entry) => entry.price_per_litre > 0 && entry.date.length > 0)
    .sort((left, right) => compareDate(left.date, right.date))

  const latest = priced[priced.length - 1]
  return latest === undefined ? null : { price: latest.price_per_litre, date: latest.date }
}

/** The highest odometer reading the vehicle has, from either file (F6). */
export function latestOdometer(
  fuel: readonly FuelEntry[],
  service: readonly ServiceEntry[]
): number | null {
  const readings = odometerSeries(fuel, service)
  if (readings.length === 0) return null
  return readings.reduce((highest, reading) => Math.max(highest, reading.value), 0)
}

/**
 * Lifetime distance — the span between the readings that exist.
 *
 * Deliberately NOT the sum of §5.2's intervals. Those run full tank to full
 * tank, so a vehicle whose most recent fill was partial would under-report the
 * kilometres it has actually done — by the whole of the last interval.
 */
export function lifetimeDistance(
  fuel: readonly FuelEntry[],
  service: readonly ServiceEntry[]
): number {
  const readings = odometerSeries(fuel, service)
  if (readings.length < 2) return 0

  const values = readings.map((reading) => reading.value)
  return Math.max(...values) - Math.min(...values)
}

/** Lifetime litres — every litre entered, ×1000. */
export function lifetimeLitres(fuel: readonly FuelEntry[]): number {
  return sumScaled(fuel.map((entry) => entry.litres))
}

/**
 * Lifetime spend — every lira from all three files, income subtracting.
 *
 * Computed through `monthlyCostSeries` rather than beside it, so this figure and
 * F8's Monthly Costs chart cannot drift apart: they are the same arithmetic,
 * summed at different granularity.
 *
 * The PURCHASE PRICE IS NOT IN IT. §4.4 keeps it on the vehicle record and §7.3
 * gives "true cost per km including purchase price" to the Statistics section,
 * which is F10's. Folding two million lira in here would make every other figure
 * on the page unreadable and would answer a question this page did not ask.
 */
export function lifetimeSpend(
  fuel: readonly FuelEntry[],
  costs: readonly CostEntry[],
  service: readonly ServiceEntry[]
): number {
  return sumScaled(monthlyCostSeries(fuel, costs, service).map((point) => point.value))
}

/** One period against the one before it, both realised. */
export interface Comparison {
  current: number
  previous: number
  /** Absent when there is no previous period to compare against. */
  change?: number
}

/**
 * Two months, compared.
 *
 * A month with no records gives `previous` of zero and NO `change`: a rise from
 * nothing is not a rise, and reporting one would be the page inventing a trend
 * out of an absence (§3.3). The caller states which spans it compared — on the
 * third of the month this is three days against thirty-one.
 */
export function compare(current: number, previous: number, hadPrevious: boolean): Comparison {
  return {
    current,
    previous,
    ...(hadPrevious ? { change: current - previous } : {})
  }
}

/** Which file a recent entry came from, so one merged list can say so. */
export type EntryKind = 'fuel' | 'cost' | 'service'

export interface RecentEntry {
  id: string
  kind: EntryKind
  date: string
  /** What it was: a fuel type, a cost title, a part. */
  label: string
  /** Money ×100 — what it cost, income already signed. */
  amount: number
}

/**
 * The last entries block — one list, not three.
 *
 * Three short lists would waste the width and hide the thing the block is for:
 * what has happened to this vehicle lately, in the order it happened.
 */
export function recentEntries(bundle: VehicleBundle | null, limit: number): RecentEntry[] {
  if (bundle === null) return []

  const rows: RecentEntry[] = [
    ...bundle.fuel.entries.map((entry) => ({
      id: entry.id,
      kind: 'fuel' as const,
      date: entry.date,
      label: entry.fuel_type,
      amount: entryTotal(entry)
    })),
    ...bundle.costs.entries.map((entry) => ({
      id: entry.id,
      kind: 'cost' as const,
      date: entry.date,
      label: entry.title.length > 0 ? entry.title : entry.category,
      amount: signedAmount(entry)
    })),
    ...bundle.service.entries.map((entry) => ({
      id: entry.id,
      kind: 'service' as const,
      date: entry.date,
      label: entry.part,
      amount: entry.amount
    }))
  ]

  return rows
    .filter((row) => row.date.length > 0)
    .sort((left, right) => compareDate(right.date, left.date))
    .slice(0, limit)
}
