// XTRITIUM §5.2 — consumption, the full-tank algorithm.
//
// Partial fills exist, so consumption is computed ONLY between consecutive
// full-tank entries. Everything here is derived and nothing is stored (§4.4):
// this module is run where a figure is shown and its results live no longer
// than the render that asked for them.
//
// The arithmetic is §4.3's — scaled integers throughout, rounded once at the
// end. Litres and prices arrive ×1000, money leaves ×100, and l/100km is kept
// at ×1000 so the display can be asked for two decimals or five without the
// engine having an opinion about it.
//
// There is no tank-level estimation here, and there is none anywhere: an app
// that targets precision does not guess.

import { idSequence, type FuelEntry } from './records.js'
import { MONEY_DECIMALS, PUMP_DECIMALS, sumScaled } from './scaled.js'

/** l/100km is carried at three decimals; the display rounds it further. */
export const CONSUMPTION_DECIMALS = 3

/** One data point: a full tank measured against the full tank before it. */
export interface ConsumptionPoint {
  /** The full-tank entry this figure belongs to. */
  id: string
  date: string
  odometer_km: number
  /** Kilometres since the previous full tank. Always greater than zero. */
  distance_km: number
  /** scaled ×1000 — this entry's litres plus every partial fill in between. */
  litres: number
  /** scaled ×1000 — litres ÷ distance × 100. */
  l100km: number
}

/**
 * Entries by odometer, as §5.2 opens: "Sort a vehicle's entries by odometer."
 *
 * The odometer is the measure the algorithm runs on, not the date — a fill-up
 * entered late, or dated wrongly, still happened at the reading it carries.
 * Equal readings fall back to date and then to the id, so a list handed over in
 * any order produces exactly one answer.
 */
export function sortByOdometer(entries: readonly FuelEntry[]): FuelEntry[] {
  return [...entries].sort((left, right) => {
    if (left.odometer_km !== right.odometer_km) return left.odometer_km - right.odometer_km
    if (left.date !== right.date) return left.date < right.date ? -1 : 1
    return idSequence(left.id) - idSequence(right.id)
  })
}

/**
 * The derived total of one fill-up: litres × price per litre, money-scaled.
 *
 * Takes only the two figures it multiplies, so a form can show the total of
 * what has been typed so far — a half-filled draft is not a record yet.
 */
export function entryTotal(entry: Pick<FuelEntry, 'litres' | 'price_per_litre'>): number {
  // ×1000 times ×1000 is ×1_000_000, and money is ×100: divide by 10_000, once.
  const scale = 10 ** (PUMP_DECIMALS + PUMP_DECIMALS - MONEY_DECIMALS)
  return Math.round((entry.litres * entry.price_per_litre) / scale)
}

/**
 * Every consumption data point a vehicle's fill-ups support, in odometer order.
 *
 * A point exists only at a full-tank entry with an earlier full-tank entry
 * before it. Its litres are that entry's own plus every partial fill since the
 * previous full tank, and its distance is the difference between the two full
 * readings — so a mis-flagged entry shifts the figures on both sides of it,
 * exactly as §5.2 warns. The flag is a real field, not decoration.
 */
export function consumptionPoints(entries: readonly FuelEntry[]): ConsumptionPoint[] {
  const points: ConsumptionPoint[] = []
  let previousFull: FuelEntry | null = null
  let between: number[] = []

  for (const entry of sortByOdometer(entries)) {
    if (!entry.full_tank) {
      // A partial before the first full tank belongs to no interval at all.
      if (previousFull !== null) between.push(entry.litres)
      continue
    }

    if (previousFull !== null) {
      const distance = entry.odometer_km - previousFull.odometer_km

      // Sorted by odometer, the only way this is not positive is two entries at
      // the same reading — which measures nothing, so it says nothing.
      if (distance > 0) {
        const litres = entry.litres + sumScaled(between)
        points.push({
          id: entry.id,
          date: entry.date,
          odometer_km: entry.odometer_km,
          distance_km: distance,
          litres,
          // litres ÷ distance × 100, kept at ×1000: (litres×1000 × 100) ÷ distance.
          l100km: Math.round((litres * 100) / distance)
        })
      }
    }

    previousFull = entry
    between = []
  }

  return points
}

/**
 * An l/100km figure at the precision `settings.toml` asks for
 * (§4.4 `decimals_consumption`, default 2).
 *
 * The engine keeps three decimals so that the setting can be raised without the
 * arithmetic having been thrown away first; this is the one place it is cut down
 * to what the maker asked to see.
 */
export function consumptionAt(l100km: number, decimals: number): number {
  const shift = CONSUMPTION_DECIMALS - decimals
  if (shift <= 0) return l100km * 10 ** -shift
  return Math.round(l100km / 10 ** shift)
}

/** The same points, addressed by the entry they belong to. */
export function consumptionById(
  entries: readonly FuelEntry[]
): Record<string, ConsumptionPoint | undefined> {
  const byId: Record<string, ConsumptionPoint | undefined> = {}
  for (const point of consumptionPoints(entries)) byId[point.id] = point
  return byId
}
