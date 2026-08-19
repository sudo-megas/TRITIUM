// What both fuel entry paths share (XTRITIUM §5.1 — quick-add and full form).
//
// A draft holds every field as the text the maker sees, in the family
// convention; it becomes a record only on save. Both windows read and write it
// through here, so the two paths cannot drift into disagreeing about what
// "54,0" means.

import { entryTotal, sortByOdometer } from './consumption.js'
import { formatDate, parseDate, parseInput, toInput, todayIso } from './format.js'
import type { FuelEntry } from './records.js'
import { PUMP_DECIMALS } from './scaled.js'
import {
  DISTANCE_DECIMALS,
  METRIC,
  readDistance,
  readPricePerVolume,
  readVolume,
  showDistance,
  showPricePerVolume,
  showVolume,
  type UnitPrefs
} from './units.js'

export interface FuelDraft {
  date: string
  odometer_km: string
  litres: string
  price_per_litre: string
  full_tank: boolean
  fuel_type: string
}

/**
 * A new fill-up. `full_tank` starts true because that is the common case, and
 * because quick-add does not ask: a false default would mean the path built for
 * the common case never produces a consumption point at all (§5.2).
 */
export function emptyDraft(fuelType: string): FuelDraft {
  return {
    date: formatDate(todayIso()),
    odometer_km: '',
    litres: '',
    price_per_litre: '',
    full_tank: true,
    fuel_type: fuelType
  }
}

/**
 * A stored fill-up into the fields the maker sees, in HIS units (F11).
 *
 * The file is metric whatever the settings say (F11.md decision 1), so this is
 * one half of the boundary — `entryOf` is the other, and the two must use the
 * same prefs or a form would show gallons and save them as litres.
 */
export function draftOf(entry: FuelEntry, units: UnitPrefs = METRIC): FuelDraft {
  const odometer = showDistance(entry.odometer_km, units.distance)
  const litres = showVolume(entry.litres, units.volume)
  const price = showPricePerVolume(entry.price_per_litre, units.volume)

  return {
    date: formatDate(entry.date),
    odometer_km:
      entry.odometer_km > 0 ? toInput(odometer, DISTANCE_DECIMALS[units.distance]) : '',
    litres: entry.litres > 0 ? toInput(litres, PUMP_DECIMALS) : '',
    price_per_litre: entry.price_per_litre > 0 ? toInput(price, PUMP_DECIMALS) : '',
    full_tank: entry.full_tank,
    fuel_type: entry.fuel_type
  }
}

/**
 * A draft back into a record, without an id — the id is allocated in the main
 * process. Anything unreadable becomes the empty value the record already uses
 * for "not entered": never a guess, and never a refusal that would throw away
 * the rest of what was typed (§3.8).
 */
export function entryOf(draft: FuelDraft, units: UnitPrefs = METRIC): Omit<FuelEntry, 'id'> {
  const odometer = parseInput(draft.odometer_km, DISTANCE_DECIMALS[units.distance]) ?? 0
  const litres = parseInput(draft.litres, PUMP_DECIMALS) ?? 0
  const price = parseInput(draft.price_per_litre, PUMP_DECIMALS) ?? 0

  return {
    date: parseDate(draft.date) ?? '',
    // Back to what the file holds: kilometres and litres, always (§4.4's own
    // key names, and F11.md decision 1).
    odometer_km: readDistance(odometer, units.distance),
    litres: readVolume(litres, units.volume),
    price_per_litre: readPricePerVolume(price, units.volume),
    full_tank: draft.full_tank,
    fuel_type: draft.fuel_type
  }
}

/**
 * The live total, money-scaled, or null while there is nothing to multiply.
 *
 * Needs no unit at all: gallons × price-per-gallon is the same money as litres
 * × price-per-litre. The two conversions cancel, which is why the field pair
 * must always move together (F11.md decision 5).
 */
export function draftTotal(draft: FuelDraft): number | null {
  const litres = parseInput(draft.litres, PUMP_DECIMALS)
  const price = parseInput(draft.price_per_litre, PUMP_DECIMALS)
  if (litres === null || price === null) return null

  return entryTotal({ litres, price_per_litre: price })
}

/**
 * The highest odometer already recorded — §5.1's hint, "the previous value
 * shown". The entry being edited is left out of its own hint.
 */
export function lastOdometer(entries: readonly FuelEntry[], exceptId?: string): number | null {
  const others = entries.filter((entry) => entry.id !== exceptId)
  const sorted = sortByOdometer(others)
  return sorted.length === 0 ? null : (sorted[sorted.length - 1]?.odometer_km ?? null)
}

/**
 * Whether the odometer typed goes backwards. §5.1 — this warns and is then
 * accepted: typos in old entries must be fixable, and the maker's word is final.
 */
export function goesBackwards(
  draft: FuelDraft,
  previous: number | null,
  units: UnitPrefs = METRIC
): boolean {
  if (previous === null) return false
  // Both sides are in the SHOWN unit, at the shown precision — the caller
  // converts the previous reading before handing it over.
  const odometer = parseInput(draft.odometer_km, DISTANCE_DECIMALS[units.distance])
  return odometer !== null && odometer > 0 && odometer < previous
}
