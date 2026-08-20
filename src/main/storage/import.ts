// Reading a bundle the phone wrote (F16).
//
// One TOML file, every vehicle, every record. The maker chooses it; nothing is
// watched, nothing is automatic, and nothing arrives over a network.
//
// Three properties this file exists to hold:
//
//   1. NO PARSING OF ITS OWN. A bundle's entry tables carry the same keys as a
//      record file's [[entry]] tables, so FUEL_SPEC/COST_SPEC/SERVICE_SPEC read
//      them unchanged — same coercion, same scaling, same unknown-key handling.
//      A second reader here would drift from the first one within a milestone.
//
//   2. NOTHING HALF-APPLIED. The whole bundle is validated and the whole merge is
//      computed before any file is touched. A bundle that fails anywhere leaves
//      the disk exactly as it was, which is the promise CorruptFileError already
//      makes for reading.
//
//   3. ONE WRITE PER FILE. Not addFuelEntry in a loop: that re-reads and rewrites
//      the whole document per entry, which is quadratic on a growing file and
//      pointless when the merge is already in memory.

import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import {
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  BundleError,
  costKey,
  fuelKey,
  serviceKey,
  type ImportResult,
  type ImportTally
} from '../../shared/bundle.js'
import {
  RECORD_SCHEMA_VERSION,
  formatId,
  idSequence,
  type CostEntry,
  type EntryDocument,
  type FuelEntry,
  type RecordKind,
  type ServiceEntry
} from '../../shared/records.js'
import { backupFiles } from './backup.js'
import { COST_SPEC } from './cost-file.js'
import { CorruptFileError } from './errors.js'
import type { EntrySpec } from './entry-file.js'
import { FUEL_SPEC } from './fuel-file.js'
import {
  listVehicleSlugs,
  loadVehicle,
  saveCosts,
  saveFuel,
  saveService,
  saveVehicleRecord,
  vehicleFiles
} from './repository.js'
import { SERVICE_SPEC } from './service-file.js'
import { slugify } from '../../shared/slug.js'
import { asTable, asTableArray, readString, type TomlTable } from './toml.js'
import { readVehicleTable } from './vehicle-file.js'

/**
 * Merge one kind of record into the document already on disk.
 *
 * Incoming entries are read through the record file's OWN spec and given a fresh
 * id from the receiving document — never the id they arrived with. A bundle
 * carries none, and one that does is ignored: two devices both mint `f-0005` for
 * their fifth entry, and duplicate ids inside one file corrupt it silently
 * (entryRest is keyed by id, and findIndex only ever reaches the first).
 */
export function mergeEntries<T extends { id: string }>(
  document: EntryDocument<T>,
  incoming: readonly TomlTable[],
  spec: EntrySpec<T>,
  keyOf: (entry: T) => string,
  kind: RecordKind
): { added: number; skipped: number } {
  const seen = new Set(document.entries.map(keyOf))

  let highest = 0
  for (const entry of document.entries) {
    const sequence = idSequence(entry.id)
    if (sequence > highest) highest = sequence
  }

  let added = 0
  let skipped = 0

  for (const table of incoming) {
    // Read first, with a placeholder id: the key is computed from the entry's
    // own fields, and the id is not one of them.
    const candidate = spec.readEntry(table, '')
    if (seen.has(keyOf(candidate))) {
      skipped += 1
      continue
    }

    highest += 1
    const entry = spec.readEntry(table, formatId(kind, highest))
    document.entries.push(entry)
    seen.add(keyOf(entry))
    added += 1
  }

  return { added, skipped }
}

/**
 * The keys a bundle's `[[vehicle]]` table has that a vehicle record does not.
 *
 * `slug` is how the bundle addresses a vehicle; the three others are where its
 * entries hang. None of them belongs in vehicle.toml, and leaving them in is not
 * a cosmetic problem: the vehicle reader carries every key it does not recognise
 * into `rest`, and the writer renders `rest` with `inlineValue` — so an entire
 * fill-up history lands in vehicle.toml as one inline array, like this:
 *
 *   fuel = [{ date = 2026-08-16, odometer_km = 19764, litres = 29.99, … }]
 *
 * That is a real file this code produced before the keys were stripped. The
 * unknown-key mechanism is right and stays: anything else the phone carries that
 * this build does not know about still survives, which is the whole point of it.
 * These four are simply not unknown — they are structure, and structure has been
 * consumed by the time the vehicle is read.
 */
const BUNDLE_VEHICLE_KEYS = ['slug', 'fuel', 'costs', 'service']

function vehicleTableOf(raw: TomlTable): TomlTable {
  const table: TomlTable = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!BUNDLE_VEHICLE_KEYS.includes(key)) table[key] = value
  }
  return table
}

interface PlannedVehicle {
  slug: string
  create: boolean
  vehicleTable: TomlTable
  fuel: EntryDocument<FuelEntry>
  costs: EntryDocument<CostEntry>
  service: EntryDocument<ServiceEntry>
  tally: ImportTally
}

/**
 * Read and check the envelope.
 *
 * A bundle stamped higher than this build understands is REFUSED. The storage
 * layer's own habit — read the version, then write back the current constant —
 * is right for a file this app owns and wrong across a boundary between two
 * applications, where it would silently relabel the phone's newer format as this
 * one's older format and lose the fact that anything was different.
 */
export function readBundle(text: string): TomlTable {
  let document: TomlTable
  try {
    document = asTable(parse(text))
  } catch {
    throw new BundleError({ reason: 'unreadable' })
  }

  if (readString(document['format']) !== BUNDLE_FORMAT) {
    throw new BundleError({ reason: 'not-a-bundle' })
  }

  const version = typeof document['format_version'] === 'number' ? document['format_version'] : 0

  if (version > BUNDLE_FORMAT_VERSION) {
    throw new BundleError({
      reason: 'too-new',
      found: version,
      understood: BUNDLE_FORMAT_VERSION
    })
  }

  return document
}

/**
 * Import a bundle from a path the maker chose.
 *
 * Throws BundleError for a file that is not ours or is newer than we are, and
 * CorruptFileError if a record file already on disk cannot be read — in which
 * case nothing is written, because a merge into a file we cannot parse would be
 * a guess.
 */
export function importBundle(file: string, now: Date = new Date()): ImportResult {
  if (!existsSync(file)) throw new BundleError({ reason: 'unreadable' })

  const document = readBundle(readFileSync(file, 'utf8'))
  const known = new Set(listVehicleSlugs())

  // Keyed by slug, not a flat list: a bundle carrying the same slug in two
  // [[vehicle]] tables (concatenated exports — a hand-editable format
  // invites exactly that) must merge into ONE plan, threading the running
  // fuel/costs/service documents forward so the second table's mergeEntries
  // call sees what the first just added. Planning both against disk
  // independently would let the second table's write silently overwrite the
  // first's, losing its entries while still reporting them as added.
  const planned = new Map<string, PlannedVehicle>()

  // ── plan ────────────────────────────────────────────────────────────────
  // Everything is computed here, against what is on disk now, and nothing is
  // written. A throw anywhere in this loop leaves the data directory untouched.
  for (const raw of asTableArray(document['vehicle'])) {
    const slug = readString(raw['slug'])
    // Empty, or not already its own slug: a bundle's slug identifies a
    // vehicle, never a name to derive one from, and it becomes a directory
    // name verbatim (vehicleDir(slug), repository.ts) — so anything
    // containing `..` or `/` must never reach it. Refused outright rather
    // than resanitised: two different unsafe slugs could resanitise to the
    // same safe one and silently merge into the wrong vehicle.
    if (slug.length === 0 || slug !== slugify(slug)) continue

    const prior = planned.get(slug)
    const create = prior?.create ?? !known.has(slug)
    const bundle = prior ?? (create
      ? {
          fuel: emptyOf<FuelEntry>(),
          costs: emptyOf<CostEntry>(),
          service: emptyOf<ServiceEntry>()
        }
      : loadVehicle(slug))

    const fuel = bundle.fuel
    const costs = bundle.costs
    const service = bundle.service

    const f = mergeEntries(fuel, asTableArray(raw['fuel']), FUEL_SPEC, fuelKey, 'fuel')
    const c = mergeEntries(costs, asTableArray(raw['costs']), COST_SPEC, costKey, 'cost')
    const s = mergeEntries(
      service,
      asTableArray(raw['service']),
      SERVICE_SPEC,
      serviceKey,
      'service'
    )

    const priorTally = prior?.tally
    const tally: ImportTally = {
      slug,
      vehicleCreated: create,
      added: {
        fuel: (priorTally?.added.fuel ?? 0) + f.added,
        costs: (priorTally?.added.costs ?? 0) + c.added,
        service: (priorTally?.added.service ?? 0) + s.added
      },
      skipped: {
        fuel: (priorTally?.skipped.fuel ?? 0) + f.skipped,
        costs: (priorTally?.skipped.costs ?? 0) + c.skipped,
        service: (priorTally?.skipped.service ?? 0) + s.skipped
      }
    }

    planned.set(slug, {
      slug,
      create,
      // The first occurrence's own table, always — a repeat's vehicle
      // fields are structure duplication, not a second vehicle.
      vehicleTable: prior?.vehicleTable ?? raw,
      fuel,
      costs,
      service,
      tally
    })
  }

  // ── back up ─────────────────────────────────────────────────────────────
  // Every file about to be touched, before a byte of it changes. Files that do
  // not exist yet are skipped by backupFiles — a vehicle being created has
  // nothing to preserve.
  const touching: string[] = []
  for (const plan of planned.values()) {
    if (plan.tally.added.fuel + plan.tally.added.costs + plan.tally.added.service === 0) {
      continue
    }
    const files = vehicleFiles(plan.slug)
    touching.push(files.fuel, files.costs, files.service, files.vehicle)
  }
  backupFiles(touching, now)

  // ── write ───────────────────────────────────────────────────────────────
  // One write per file, atomically, through the same helpers every other path
  // uses. A vehicle that is already here keeps its own vehicle.toml: a bundle
  // adds entries to a vehicle, it does not rewrite the vehicle.
  for (const plan of planned.values()) {
    if (plan.create)
      saveVehicleRecord(plan.slug, readVehicleTable(vehicleTableOf(plan.vehicleTable)))
    if (plan.tally.added.fuel > 0) saveFuel(plan.slug, plan.fuel)
    if (plan.tally.added.costs > 0) saveCosts(plan.slug, plan.costs)
    if (plan.tally.added.service > 0) saveService(plan.slug, plan.service)
  }

  return { vehicles: Array.from(planned.values(), (plan) => plan.tally) }
}

function emptyOf<T>(): EntryDocument<T> {
  return { schemaVersion: RECORD_SCHEMA_VERSION, entries: [], entryRest: {}, rest: {} }
}

export { CorruptFileError }
