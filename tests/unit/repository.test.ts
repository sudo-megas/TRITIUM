// The vehicle directory layout (XTRITIUM §4.1) and the slug that names it.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  listVehicleSlugs,
  loadVehicle,
  saveCosts,
  saveFuel,
  saveService,
  saveVehicleRecord,
  uniqueSlug,
  vehicleFiles,
  vehicleNames
} from '../../src/main/storage/repository.js'
// F5 moved slugFor into shared/: the cost form slugifies a typed MANUAL
// category with it, and the renderer cannot import main-process code.
import { slugFor } from '../../src/shared/slug.js'
import { COST_SPEC } from '../../src/main/storage/cost-file.js'
import { FUEL_SPEC } from '../../src/main/storage/fuel-file.js'
import { SERVICE_SPEC } from '../../src/main/storage/service-file.js'
import { parseVehicle } from '../../src/main/storage/vehicle-file.js'
import { parseEntryDocument } from '../../src/main/storage/entry-file.js'
import { COSTS_SAMPLE, FUEL_SAMPLE, SERVICE_SAMPLE, VEHICLE_SAMPLE } from './samples.js'

describe('vehicle slugs', () => {
  it('transliterates Turkish letters by table, not by locale', () => {
    expect(slugFor('ŞOFÖR Iğdır')).toBe('sofor-igdir')
    expect(slugFor('Çağrı ÜÇGEN')).toBe('cagri-ucgen')
    expect(slugFor('İstanbul')).toBe('istanbul')
  })

  it('produces the same slug whatever the ambient locale claims to be', () => {
    // The point of the explicit table: this assertion holds on a machine set to
    // tr_TR, where a locale-aware lowercase would map I to a dotless ı.
    expect(slugFor('SPORTAGE 1.6 T-GDI')).toBe('sportage-1-6-t-gdi')
    expect(slugFor('IIII')).toBe('iiii')
  })

  it('never returns an empty directory name', () => {
    expect(slugFor('')).toBe('vehicle')
    expect(slugFor('   ')).toBe('vehicle')
    expect(slugFor('!!!')).toBe('vehicle')
  })

  it('suffixes a name that is already taken', () => {
    expect(uniqueSlug('Sportage', [])).toBe('sportage')
    expect(uniqueSlug('Sportage', ['sportage'])).toBe('sportage-2')
    expect(uniqueSlug('Sportage', ['sportage', 'sportage-2'])).toBe('sportage-3')
  })
})

describe('the directory layout', () => {
  it('puts the four files where XTRITIUM §4.1 draws them', () => {
    const files = vehicleFiles('sportage')

    expect(files.vehicle.endsWith(join('vehicles', 'sportage', 'vehicle.toml'))).toBe(true)
    expect(files.fuel.endsWith(join('vehicles', 'sportage', 'fuel.toml'))).toBe(true)
    expect(files.costs.endsWith(join('vehicles', 'sportage', 'costs.toml'))).toBe(true)
    expect(files.service.endsWith(join('vehicles', 'sportage', 'service.toml'))).toBe(true)
  })
})

describe('a whole vehicle on disk', () => {
  it('lays the four files out exactly as XTRITIUM §4.1 draws them', () => {
    const home = mkdtempSync(join(tmpdir(), 'tritium-data-'))
    const previous = process.env['XDG_DATA_HOME']
    process.env['XDG_DATA_HOME'] = home

    try {
      const slug = uniqueSlug('SPORTAGE 1.6 T-GDI', listVehicleSlugs())
      expect(slug).toBe('sportage-1-6-t-gdi')

      saveVehicleRecord(slug, parseVehicle(VEHICLE_SAMPLE))
      saveFuel(slug, parseEntryDocument(FUEL_SAMPLE, FUEL_SPEC))
      saveCosts(slug, parseEntryDocument(COSTS_SAMPLE, COST_SPEC))
      saveService(slug, parseEntryDocument(SERVICE_SAMPLE, SERVICE_SPEC))

      // ~/.local/share/tritium/vehicles/<slug>/ — the layout, on disk, for real.
      const directory = join(home, 'tritium', 'vehicles', slug)
      expect(readdirSync(directory).sort()).toEqual([
        'costs.toml',
        'fuel.toml',
        'service.toml',
        'vehicle.toml'
      ])

      expect(readFileSync(join(directory, 'vehicle.toml'), 'utf8')).toBe(VEHICLE_SAMPLE)
      expect(readFileSync(join(directory, 'fuel.toml'), 'utf8')).toBe(FUEL_SAMPLE)
      expect(readFileSync(join(directory, 'costs.toml'), 'utf8')).toBe(COSTS_SAMPLE)
      expect(readFileSync(join(directory, 'service.toml'), 'utf8')).toBe(SERVICE_SAMPLE)

      // And the app finds it again, whole, the way it will at launch.
      expect(listVehicleSlugs()).toEqual([slug])
      const bundle = loadVehicle(slug)
      expect(bundle.vehicle?.vehicle.name).toBe('SPORTAGE 1.6 T-GDI')
      expect(bundle.fuel.entries).toHaveLength(1)
      expect(bundle.costs.entries).toHaveLength(1)
      expect(bundle.service.entries).toHaveLength(1)
    } finally {
      if (previous === undefined) delete process.env['XDG_DATA_HOME']
      else process.env['XDG_DATA_HOME'] = previous
      rmSync(home, { recursive: true, force: true })
    }
  })
})

describe('a vehicle that is renamed', () => {
  it('keeps the directory it was created in', () => {
    // The slug is allocated once, at creation. Moving the directory on a rename
    // would mean copying every fill-up the maker ever entered and deleting the
    // original — a whole history rewritten for a cosmetic change.
    const home = mkdtempSync(join(tmpdir(), 'tritium-rename-'))
    const previous = process.env['XDG_DATA_HOME']
    process.env['XDG_DATA_HOME'] = home

    try {
      const slug = uniqueSlug('SPORTAGE 1.6 T-GDI', listVehicleSlugs())
      const document = parseVehicle(VEHICLE_SAMPLE)
      saveVehicleRecord(slug, document)

      const renamed = {
        ...document,
        vehicle: { ...document.vehicle, name: 'Kia Sportage, the blue one' }
      }
      saveVehicleRecord(slug, renamed)

      expect(listVehicleSlugs()).toEqual([slug])
      expect(readdirSync(join(home, 'tritium', 'vehicles'))).toEqual([slug])
      expect(readFileSync(join(home, 'tritium', 'vehicles', slug, 'vehicle.toml'), 'utf8')).toContain(
        'name = "Kia Sportage, the blue one"'
      )
      // And the picker still finds the new name under the old directory.
      expect(vehicleNames()[slug]).toBe('Kia Sportage, the blue one')
    } finally {
      if (previous === undefined) delete process.env['XDG_DATA_HOME']
      else process.env['XDG_DATA_HOME'] = previous
      rmSync(home, { recursive: true, force: true })
    }
  })
})

describe('one write path', () => {
  it('keeps writeFileSync inside atomic.ts and nowhere else', () => {
    // XTRITIUM §4.1 — atomic writes, always. A second write path anywhere in
    // src/ would be a torn file waiting for a power cut, so this is checked as
    // a fact about the tree rather than trusted as a convention.
    const offenders: string[] = []
    const files = walk('src')

    for (const file of files) {
      if (file.endsWith(join('storage', 'atomic.ts'))) continue
      const text = readFileSync(file, 'utf8')
      if (/\bwriteFileSync\b/.test(text)) offenders.push(file)
    }

    expect(offenders).toEqual([])
  })
})

function walk(directory: string): string[] {
  const found: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'assets') continue
      found.push(...walk(path))
    } else if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      found.push(path)
    }
  }

  return found
}
