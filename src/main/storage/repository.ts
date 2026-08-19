// The vehicle directory layout of XTRITIUM §4.1.
//
//   ~/.local/share/tritium/vehicles/<vehicle-slug>/
//     vehicle.toml · fuel.toml · costs.toml · service.toml
//
// Whole files are loaded into memory at launch and whole files are written back
// on change. At ~600 records per decade per vehicle this costs milliseconds,
// and it keeps the on-disk state something the maker can open in Neovim.

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  nextId,
  type CostEntry,
  type FuelEntry,
  type RecordKind,
  type ServiceEntry,
  type VehicleBundle
} from '../../shared/records.js'
import { slugFor } from '../../shared/slug.js'
import { readCosts, writeCosts, emptyCosts, type CostDocument } from './cost-file.js'
import { readFuel, writeFuel, emptyFuel, type FuelDocument } from './fuel-file.js'
import { vehiclesDir } from './paths.js'
import { readService, writeService, emptyService, type ServiceDocument } from './service-file.js'
import { readVehicle, writeVehicle, type VehicleDocument } from './vehicle-file.js'

/** `slugFor`, with a numeric suffix when the name is already taken. */
export function uniqueSlug(name: string, taken: readonly string[]): string {
  const base = slugFor(name)
  if (!taken.includes(base)) return base

  let suffix = 2
  while (taken.includes(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

export function vehicleDir(slug: string): string {
  return join(vehiclesDir(), slug)
}

export interface VehicleFiles {
  vehicle: string
  fuel: string
  costs: string
  service: string
}

export function vehicleFiles(slug: string): VehicleFiles {
  const directory = vehicleDir(slug)
  return {
    vehicle: join(directory, 'vehicle.toml'),
    fuel: join(directory, 'fuel.toml'),
    costs: join(directory, 'costs.toml'),
    service: join(directory, 'service.toml')
  }
}

/** Every vehicle slug on disk, sorted. A directory without a vehicle.toml is not one. */
export function listVehicleSlugs(): string[] {
  const root = vehiclesDir()
  if (!existsSync(root)) return []

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => existsSync(vehicleFiles(slug).vehicle))
    .sort()
}

/**
 * Slug to display name, for the picker — every vehicle's name without reading
 * its fill-ups. A record that will not parse is simply absent from the map
 * rather than raising: one unreadable vehicle must not empty the picker, and
 * the caller shows the slug, which is the truth about where the file is.
 */
export function vehicleNames(): Record<string, string> {
  const names: Record<string, string> = {}

  for (const slug of listVehicleSlugs()) {
    try {
      const document = readVehicle(vehicleFiles(slug).vehicle)
      if (document !== null && document.vehicle.name.length > 0) {
        names[slug] = document.vehicle.name
      }
    } catch {
      // Left out on purpose — loading it properly will report the corruption.
    }
  }

  return names
}

export type { VehicleBundle }

/**
 * Whole files in, at once (§4.1).
 *
 * A file that will not parse raises CorruptFileError out of here rather than
 * resolving to an empty document — the caller reports it and the maker's data
 * stays on disk exactly as it was found.
 */
export function loadVehicle(slug: string): VehicleBundle {
  const files = vehicleFiles(slug)
  return {
    slug,
    vehicle: readVehicle(files.vehicle),
    fuel: readFuel(files.fuel),
    costs: readCosts(files.costs),
    service: readService(files.service)
  }
}

export function saveVehicleRecord(slug: string, document: VehicleDocument): void {
  writeVehicle(vehicleFiles(slug).vehicle, document)
}

export function saveFuel(slug: string, document: FuelDocument): void {
  writeFuel(vehicleFiles(slug).fuel, document)
}

/**
 * Append a fill-up, allocating its id here (F4).
 *
 * Read-modify-write, in this process, against the file as it is right now —
 * not a whole document handed back by a window that may have been open for an
 * hour. Two entry paths and a shell all look at the same fuel.toml, so a save
 * that carried a stale copy of the file would silently drop whatever was
 * written while the form sat there. The same reasoning as vehicle:create
 * allocating the slug here and nowhere else.
 */
export function addFuelEntry(slug: string, entry: Omit<FuelEntry, 'id'>): FuelEntry {
  const files = vehicleFiles(slug)
  const document = readFuel(files.fuel)
  const added: FuelEntry = { ...entry, id: allocateId('fuel', document.entries) }

  document.entries.push(added)
  writeFuel(files.fuel, document)

  return added
}

/**
 * Replace one fill-up in place, by id (XTRITIUM §3.8 — entries are editable at
 * any time). An id that is no longer in the file is left alone: it was deleted
 * by hand while the form was open, and re-adding it would be the app arguing
 * with the maker's own editor.
 */
export function updateFuelEntry(slug: string, entry: FuelEntry): boolean {
  const files = vehicleFiles(slug)
  const document = readFuel(files.fuel)
  const index = document.entries.findIndex((existing) => existing.id === entry.id)
  if (index < 0) return false

  document.entries[index] = entry
  writeFuel(files.fuel, document)

  return true
}

/**
 * Remove one fill-up by id (F7).
 *
 * F4, F5 and F6 each deferred removal to the milestone where the list lives.
 * The whole file is rewritten through the atomic helper with one entry gone and
 * everything else — including the unknown keys `entryRest` carries — untouched.
 *
 * Nothing is renumbered. `nextId` allocates from the highest id present rather
 * than from a count, which F2 chose so a hand-deleted middle entry could not
 * produce a duplicate — deleting through the app is the same situation and gets
 * the same answer.
 *
 * Deleting the HIGHEST entry does free its number for the next one. That is not
 * an oversight: it is what already happens when the maker deletes the last
 * entry in Neovim, and nothing outside the file ever refers to an id. What the
 * storage layer guarantees is uniqueness within the file, not a number that
 * only ever climbs.
 */
export function removeFuelEntry(slug: string, id: string): boolean {
  const files = vehicleFiles(slug)
  const document = readFuel(files.fuel)
  const index = document.entries.findIndex((existing) => existing.id === id)
  if (index < 0) return false

  document.entries.splice(index, 1)
  writeFuel(files.fuel, document)

  return true
}

export function saveCosts(slug: string, document: CostDocument): void {
  writeCosts(vehicleFiles(slug).costs, document)
}

/**
 * Append a cost, allocating its id here (F5).
 *
 * Word for word the reasoning `addFuelEntry` gives: read-modify-write in this
 * process, against the file as it is right now, because the form window and the
 * shell are both looking at the same costs.toml and a whole document handed
 * back by a window that has been open an hour would drop whatever was written
 * meanwhile.
 */
export function addCostEntry(slug: string, entry: Omit<CostEntry, 'id'>): CostEntry {
  const files = vehicleFiles(slug)
  const document = readCosts(files.costs)
  const added: CostEntry = { ...entry, id: allocateId('cost', document.entries) }

  document.entries.push(added)
  writeCosts(files.costs, document)

  return added
}

/**
 * Replace one cost in place, by id (XTRITIUM §3.8). An id that is no longer in
 * the file is left alone — it was deleted by hand while the form was open, and
 * re-adding it would be the app arguing with the maker's own editor.
 */
export function updateCostEntry(slug: string, entry: CostEntry): boolean {
  const files = vehicleFiles(slug)
  const document = readCosts(files.costs)
  const index = document.entries.findIndex((existing) => existing.id === entry.id)
  if (index < 0) return false

  document.entries[index] = entry
  writeCosts(files.costs, document)

  return true
}

/** Remove one cost by id (F7). `removeFuelEntry`'s shape and its reasoning. */
export function removeCostEntry(slug: string, id: string): boolean {
  const files = vehicleFiles(slug)
  const document = readCosts(files.costs)
  const index = document.entries.findIndex((existing) => existing.id === id)
  if (index < 0) return false

  document.entries.splice(index, 1)
  writeCosts(files.costs, document)

  return true
}

export function saveService(slug: string, document: ServiceDocument): void {
  writeService(vehicleFiles(slug).service, document)
}

/**
 * Append a service record, allocating its id here (F6). `addCostEntry`'s shape,
 * for `addCostEntry`'s reason: read-modify-write in this process, against the
 * file as it is right now.
 */
export function addServiceEntry(slug: string, entry: Omit<ServiceEntry, 'id'>): ServiceEntry {
  const files = vehicleFiles(slug)
  const document = readService(files.service)
  const added: ServiceEntry = { ...entry, id: allocateId('service', document.entries) }

  document.entries.push(added)
  writeService(files.service, document)

  return added
}

/** Replace one service record in place, by id (XTRITIUM §3.8). */
export function updateServiceEntry(slug: string, entry: ServiceEntry): boolean {
  const files = vehicleFiles(slug)
  const document = readService(files.service)
  const index = document.entries.findIndex((existing) => existing.id === entry.id)
  if (index < 0) return false

  document.entries[index] = entry
  writeService(files.service, document)

  return true
}

/** Remove one service record by id (F7). `removeFuelEntry`'s shape. */
export function removeServiceEntry(slug: string, id: string): boolean {
  const files = vehicleFiles(slug)
  const document = readService(files.service)
  const index = document.entries.findIndex((existing) => existing.id === id)
  if (index < 0) return false

  document.entries.splice(index, 1)
  writeService(files.service, document)

  return true
}

export function emptyBundle(slug: string): VehicleBundle {
  return { slug, vehicle: null, fuel: emptyFuel(), costs: emptyCosts(), service: emptyService() }
}

/** Allocate the next id for a kind, from the entries already in the document. */
export function allocateId(
  kind: RecordKind,
  existing: readonly (FuelEntry | CostEntry | ServiceEntry)[]
): string {
  return nextId(kind, existing)
}
