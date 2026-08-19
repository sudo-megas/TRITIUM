// What the service form holds while it is being filled in (F6).
//
// The same shape as `cost-draft.ts` and `fuel-draft.ts`: every field as the text
// the maker sees, in the family convention, becoming a record only on save.
//
// Five fields, which is XTRITIUM §4.4's service.toml entire. There is no derived
// figure here at all — the amount is what was paid, and nothing is computed from
// the odometer. Nothing watches an interval either (§3.3, F6.md decision 6).

import { formatDate, parseDate, parseInput, toInput, todayIso } from './format.js'
import type { ServiceEntry } from './records.js'
import { MONEY_DECIMALS } from './scaled.js'
import { DISTANCE_DECIMALS, METRIC, readDistance, showDistance, type UnitPrefs } from './units.js'

export interface ServiceDraft {
  date: string
  part: string
  odometer_km: string
  amount: string
  vendor: string
}

export function emptyServiceDraft(): ServiceDraft {
  return {
    date: formatDate(todayIso()),
    part: '',
    odometer_km: '',
    amount: '',
    vendor: ''
  }
}

export function serviceDraftOf(entry: ServiceEntry, units: UnitPrefs = METRIC): ServiceDraft {
  return {
    date: formatDate(entry.date),
    part: entry.part,
    odometer_km:
      entry.odometer_km > 0
        ? toInput(
            showDistance(entry.odometer_km, units.distance),
            DISTANCE_DECIMALS[units.distance]
          )
        : '',
    amount: entry.amount > 0 ? toInput(entry.amount, MONEY_DECIMALS) : '',
    vendor: entry.vendor
  }
}

/**
 * A draft back into a record, without an id — the id is allocated in the main
 * process. Anything unreadable becomes the empty value the record already uses
 * for "not entered": never a guess, and never a refusal that would throw away
 * the rest of what was typed (§3.8).
 *
 * `vendor` is trimmed and otherwise left exactly as it was typed. It holds an
 * address, a bare domain, a shop's name or nothing at all — the maker's own
 * sheet has one of each — so there is nothing here to validate and nothing to
 * normalise (§4.4, §3.5).
 */
export function serviceEntryOf(
  draft: ServiceDraft,
  units: UnitPrefs = METRIC
): Omit<ServiceEntry, 'id'> {
  return {
    date: parseDate(draft.date) ?? '',
    part: draft.part.trim(),
    // Kilometres in the file, whatever the settings say (F11.md decision 1).
    odometer_km: readDistance(
      parseInput(draft.odometer_km, DISTANCE_DECIMALS[units.distance]) ?? 0,
      units.distance
    ),
    amount: Math.abs(parseInput(draft.amount, MONEY_DECIMALS) ?? 0),
    vendor: draft.vendor.trim()
  }
}

/**
 * Whether the reading typed goes backwards against the highest the vehicle
 * knows. §5.1 — this warns and is then accepted: typos in old entries must be
 * fixable, and the maker's word is final (§3.8).
 */
export function serviceGoesBackwards(
  draft: ServiceDraft,
  previous: number | null,
  units: UnitPrefs = METRIC
): boolean {
  if (previous === null) return false
  const odometer = parseInput(draft.odometer_km, DISTANCE_DECIMALS[units.distance])
  return odometer !== null && odometer > 0 && odometer < previous
}
