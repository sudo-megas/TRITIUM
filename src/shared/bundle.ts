// The interchange format (F16), and the rule for telling one record from another.
//
// The maker logs fuel on a phone at the pump and brings the month across to this
// desktop. The phone exports; this app imports; nothing goes the other way and
// nothing goes over a network — a file moves on a cable.
//
// This module is the half of that contract with no filesystem in it: the envelope
// the bundle must carry, and the key that decides whether an incoming entry is
// one we already have. It is pure so it can be tested without Electron, and it
// lives in shared/ because the format belongs to both applications rather than to
// the one that happens to read it.
//
// The parsing and the merging are in src/main/storage/import.ts.

import type { CostEntry, FuelEntry, ServiceEntry } from './records.js'

/** What the envelope must say, or the file is not one of ours. */
export const BUNDLE_FORMAT = 'tritium-export'

/**
 * The format this build understands.
 *
 * A bundle stamped HIGHER than this is refused rather than read, and that is a
 * deliberate departure from how record files behave. The storage layer reads
 * `schema_version`, carries it in memory, and then writes back the current
 * constant whatever it read — which is right for upgrading a file this app owns,
 * and wrong across a boundary between two applications. There, a silent downgrade
 * means the phone ships a newer format, this app stamps it back to the old one,
 * and the next reader believes something false about what it is holding.
 */
export const BUNDLE_FORMAT_VERSION = 1

/** What an import did, per vehicle, so it can be reported rather than assumed. */
export interface ImportTally {
  slug: string
  vehicleCreated: boolean
  added: { fuel: number; costs: number; service: number }
  skipped: { fuel: number; costs: number; service: number }
}

export interface ImportResult {
  vehicles: ImportTally[]
}

/**
 * Why a bundle was refused. Nothing is written when one of these is raised.
 */
export type BundleRefusal =
  | { reason: 'unreadable' }
  | { reason: 'not-a-bundle' }
  | { reason: 'too-new'; found: number; understood: number }

export class BundleError extends Error {
  readonly refusal: BundleRefusal

  constructor(refusal: BundleRefusal) {
    super(`bundle refused: ${refusal.reason}`)
    this.name = 'BundleError'
    this.refusal = refusal
  }
}

/*
 * ── identity ──────────────────────────────────────────────────────────────
 *
 * Two devices number their entries independently, so an id cannot say whether
 * two records are the same record. It is worse than useless here: `nextId`
 * allocates from the highest id present, deleting the highest frees its number,
 * and the storage layer says outright that "nothing outside the file ever refers
 * to an id". Both devices will mint `f-0005` for their fifth fill-up.
 *
 * So identity is carried by facts about the world instead, one key per kind. A
 * match means the incoming entry is SKIPPED — SAAT's rule, and the reason
 * re-importing the same file twice is never destructive.
 *
 * The figures compared here are already scaled integers by the time they arrive,
 * so these are exact comparisons and no float ever meets an equals sign.
 */

/** A fill-up: you cannot fill twice at one reading on one day. */
export function fuelKey(entry: Pick<FuelEntry, 'date' | 'odometer_km'>): string {
  return `${entry.date}|${entry.odometer_km}`
}

/**
 * A service record: date and reading are not enough on their own, because tyres
 * and an oil change on the same day at the same odometer is perfectly ordinary.
 */
export function serviceKey(entry: Pick<ServiceEntry, 'date' | 'odometer_km' | 'part'>): string {
  return `${entry.date}|${entry.odometer_km}|${entry.part}`
}

/**
 * A cost: these carry no odometer at all, so a bill is identified by what a bill
 * is — a sum, in a category, on a day.
 */
export function costKey(entry: Pick<CostEntry, 'date' | 'category' | 'amount'>): string {
  return `${entry.date}|${entry.category}|${entry.amount}`
}
