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
import { nextId, type CostEntry, type FuelEntry, type RecordKind, type ServiceEntry } from '../../shared/records.js'
import { readCosts, writeCosts, emptyCosts, type CostDocument } from './cost-file.js'
import { readFuel, writeFuel, emptyFuel, type FuelDocument } from './fuel-file.js'
import { vehiclesDir } from './paths.js'
import { readService, writeService, emptyService, type ServiceDocument } from './service-file.js'
import { readVehicle, writeVehicle, type VehicleDocument } from './vehicle-file.js'

/**
 * Turkish letters, transliterated by an explicit table.
 *
 * This is deliberate rather than clever. A locale-aware lowercase would map
 * "İ" to a dotted i and "I" to a dotless ı under a Turkish locale and to
 * something else entirely under any other — which is exactly the kind of
 * ambient-locale dependency XTRITIUM §3.6 forbids and audit-locale hunts for.
 * The table gives the same slug on every machine, in every locale, forever.
 */
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  ı: 'i',
  İ: 'i',
  ğ: 'g',
  Ğ: 'g',
  ş: 's',
  Ş: 's',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
  ü: 'u',
  Ü: 'u'
}

export function slugFor(name: string): string {
  let mapped = ''
  for (const character of name) mapped += TRANSLITERATIONS[character] ?? character

  // toLowerCase is locale-independent by specification — it is toLocaleLowerCase
  // that consults the ambient locale, and the Turkish letters are already gone.
  const slug = mapped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug.length > 0 ? slug : 'vehicle'
}

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

export interface VehicleBundle {
  slug: string
  vehicle: VehicleDocument | null
  fuel: FuelDocument
  costs: CostDocument
  service: ServiceDocument
}

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

export function saveCosts(slug: string, document: CostDocument): void {
  writeCosts(vehicleFiles(slug).costs, document)
}

export function saveService(slug: string, document: ServiceDocument): void {
  writeService(vehicleFiles(slug).service, document)
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
