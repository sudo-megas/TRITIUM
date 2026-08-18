// What both fuel entry paths share (XTRITIUM §5.1 — quick-add and full form).
//
// A draft holds every field as the text the maker sees, in the family
// convention; it becomes a record only on save. Both windows read and write it
// through here, so the two paths cannot drift into disagreeing about what
// "54,0" means.

import { entryTotal, sortByOdometer } from './consumption.js'
import { formatDate, parseDate, parseInput, toInput } from './format.js'
import type { FuelEntry } from './records.js'
import { PUMP_DECIMALS } from './scaled.js'

export interface FuelDraft {
  date: string
  odometer_km: string
  litres: string
  price_per_litre: string
  full_tank: boolean
  fuel_type: string
}

/**
 * Today, from the local calendar.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that is UTC, and this machine
 * is UTC+3 — a fill-up entered at 01:00 would be filed on yesterday. Nothing
 * here reads a locale either (§3.6); the calendar is not a locale.
 */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear().toString().padStart(4, '0')
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
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

export function draftOf(entry: FuelEntry): FuelDraft {
  return {
    date: formatDate(entry.date),
    odometer_km: entry.odometer_km > 0 ? entry.odometer_km.toString() : '',
    litres: entry.litres > 0 ? toInput(entry.litres, PUMP_DECIMALS) : '',
    price_per_litre:
      entry.price_per_litre > 0 ? toInput(entry.price_per_litre, PUMP_DECIMALS) : '',
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
export function entryOf(draft: FuelDraft): Omit<FuelEntry, 'id'> {
  return {
    date: parseDate(draft.date) ?? '',
    odometer_km: parseInput(draft.odometer_km, 0) ?? 0,
    litres: parseInput(draft.litres, PUMP_DECIMALS) ?? 0,
    price_per_litre: parseInput(draft.price_per_litre, PUMP_DECIMALS) ?? 0,
    full_tank: draft.full_tank,
    fuel_type: draft.fuel_type
  }
}

/** The live total, money-scaled, or null while there is nothing to multiply. */
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
export function goesBackwards(draft: FuelDraft, previous: number | null): boolean {
  if (previous === null) return false
  const odometer = parseInput(draft.odometer_km, 0)
  return odometer !== null && odometer > 0 && odometer < previous
}
