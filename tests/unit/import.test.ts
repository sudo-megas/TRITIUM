// The import (F16): the envelope guard, the duplicate rule, and the one thing
// that must never cross the boundary — an id.
//
// Every bundle here is written out by hand, because that is what a bundle IS.
// This app has no export: the file always comes from somewhere else, and a test
// that fed the importer its own output would be proving the wrong thing.

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BundleError } from '../../src/shared/bundle.js'
import { importBundle } from '../../src/main/storage/import.js'
import { loadVehicle, vehicleFiles } from '../../src/main/storage/repository.js'

let home = ''
let previous: string | undefined

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'tritium-import-'))
  previous = process.env['XDG_DATA_HOME']
  process.env['XDG_DATA_HOME'] = home
})

afterEach(() => {
  if (previous === undefined) delete process.env['XDG_DATA_HOME']
  else process.env['XDG_DATA_HOME'] = previous
  rmSync(home, { recursive: true, force: true })
})

function bundleFile(text: string): string {
  const file = join(home, 'bundle.toml')
  writeFileSync(file, text)
  return file
}

const ONE_FILL = `
format = "tritium-export"
format_version = 1
exported = 2026-08-19

[[vehicle]]
slug = "sportage"
name = "SPORTAGE 1.6 T-GDI"
tank_capacity_l = 54.0

[[vehicle.fuel]]
date = 2026-08-16
odometer_km = 19764
litres = 29.990
price_per_litre = 73.380
full_tank = true
fuel_type = "Kurşunsuz 95"
`

describe('the envelope', () => {
  it('refuses a file that is not a bundle', () => {
    const file = bundleFile('schema_version = 1\n\n[[entry]]\nid = "f-0001"\n')
    expect(() => importBundle(file)).toThrow(BundleError)
    // A record file is not a bundle even though it parses perfectly.
    expect(existsSync(join(home, 'tritium', 'vehicles'))).toBe(false)
  })

  it('refuses TOML that will not parse, and writes nothing', () => {
    const file = bundleFile('format = = =\n')
    expect(() => importBundle(file)).toThrow(BundleError)
    expect(existsSync(join(home, 'tritium', 'vehicles'))).toBe(false)
  })

  /*
   * The guard that does not exist for record files, and must exist here.
   *
   * The storage layer reads schema_version and then writes back the current
   * constant whatever it read. Inside one app that is an upgrade. Across two
   * apps it is a silent downgrade — the phone's newer format relabelled as this
   * one's older format, with the difference lost.
   */
  it('refuses a bundle newer than it understands rather than downgrading it', () => {
    const file = bundleFile(ONE_FILL.replace('format_version = 1', 'format_version = 2'))
    expect(() => importBundle(file)).toThrow(BundleError)
    expect(existsSync(join(home, 'tritium', 'vehicles'))).toBe(false)
    // And the bundle itself is untouched — we refuse files, we do not edit them.
    expect(readFileSync(file, 'utf8')).toContain('format_version = 2')
  })
})

describe('importing', () => {
  it('creates a vehicle that is not here yet, and its fill-up', () => {
    const result = importBundle(bundleFile(ONE_FILL))

    expect(result.vehicles).toHaveLength(1)
    expect(result.vehicles[0]?.vehicleCreated).toBe(true)
    expect(result.vehicles[0]?.added.fuel).toBe(1)

    const bundle = loadVehicle('sportage')
    expect(bundle.vehicle?.vehicle.name).toBe('SPORTAGE 1.6 T-GDI')
    expect(bundle.fuel.entries).toHaveLength(1)
    // Scaled on the way in by the record file's own reader, not by this module.
    expect(bundle.fuel.entries[0]?.litres).toBe(29990)
    expect(bundle.fuel.entries[0]?.odometer_km).toBe(19764)
  })

  it('gives the entry an id of its own, and the bundle carries none', () => {
    importBundle(bundleFile(ONE_FILL))
    expect(loadVehicle('sportage').fuel.entries[0]?.id).toBe('f-0001')
  })

  /*
   * The whole point of the milestone. A monthly sync overlaps the previous one,
   * and importing the same file twice must be a no-op rather than a doubling.
   */
  it('imports the same bundle twice and changes nothing the second time', () => {
    const file = bundleFile(ONE_FILL)
    importBundle(file)
    const after = readFileSync(vehicleFiles('sportage').fuel, 'utf8')

    const second = importBundle(file)
    expect(second.vehicles[0]?.added.fuel).toBe(0)
    expect(second.vehicles[0]?.skipped.fuel).toBe(1)
    expect(readFileSync(vehicleFiles('sportage').fuel, 'utf8')).toBe(after)
  })

  it('adds a new fill-up beside one it already has', () => {
    importBundle(bundleFile(ONE_FILL))

    const more = `${ONE_FILL}
[[vehicle.fuel]]
date = 2026-09-02
odometer_km = 20310
litres = 31.500
price_per_litre = 74.100
full_tank = true
fuel_type = "Kurşunsuz 95"
`
    const result = importBundle(bundleFile(more))
    expect(result.vehicles[0]?.added.fuel).toBe(1)
    expect(result.vehicles[0]?.skipped.fuel).toBe(1)

    const entries = loadVehicle('sportage').fuel.entries
    expect(entries.map((entry) => entry.id)).toEqual(['f-0001', 'f-0002'])
  })

  /*
   * An id in a bundle is ignored rather than honoured. If it were honoured, two
   * devices' `f-0005` would land in one file — and duplicate ids there corrupt
   * it silently, because entryRest is keyed by id and findIndex only ever
   * reaches the first.
   */
  it('ignores an id the bundle tries to bring with it', () => {
    const withId = ONE_FILL.replace(
      '[[vehicle.fuel]]\ndate',
      '[[vehicle.fuel]]\nid = "f-0999"\ndate'
    )
    importBundle(bundleFile(withId))
    expect(loadVehicle('sportage').fuel.entries[0]?.id).toBe('f-0001')
  })

  /*
   * A regression, and it shipped in this milestone's own first draft.
   *
   * A bundle's [[vehicle]] table carries `slug` and the three entry arrays. The
   * vehicle reader carries every key it does not recognise into `rest`, and the
   * writer renders `rest` inline — so the whole fill-up history was landing in
   * vehicle.toml as one array:
   *
   *   fuel = [{ date = 2026-08-16, odometer_km = 19764, litres = 29.99, … }]
   *
   * The tests written first all passed, because every one of them asserted what
   * vehicle.toml SHOULD contain and none asserted what it should not.
   */
  it('does not carry the bundle’s structure into vehicle.toml', () => {
    importBundle(bundleFile(ONE_FILL))
    const written = readFileSync(vehicleFiles('sportage').vehicle, 'utf8')

    expect(written).toContain('SPORTAGE 1.6 T-GDI')
    expect(written).not.toContain('litres')
    expect(written).not.toContain('fuel =')
    expect(written).not.toContain('slug')
  })

  it('leaves an existing vehicle record alone', () => {
    importBundle(bundleFile(ONE_FILL))
    const renamed = ONE_FILL.replace('SPORTAGE 1.6 T-GDI', 'SOMETHING ELSE')
    importBundle(bundleFile(renamed))

    // A bundle adds entries to a vehicle. It does not rewrite the vehicle.
    expect(loadVehicle('sportage').vehicle?.vehicle.name).toBe('SPORTAGE 1.6 T-GDI')
  })
})

describe('the duplicate key, per kind', () => {
  const costs = (category: string, amount: string): string => `
format = "tritium-export"
format_version = 1

[[vehicle]]
slug = "sportage"
name = "SPORTAGE"

[[vehicle.costs]]
date = 2026-01-20
group = "tekrar-eden"
category = "${category}"
title = "Trafik Sigortası"
amount = ${amount}
income = false
`

  it('matches a cost on date, category and amount — it has no odometer', () => {
    importBundle(bundleFile(costs('trafik-sigortasi', '11746.00')))

    const same = importBundle(bundleFile(costs('trafik-sigortasi', '11746.00')))
    expect(same.vehicles[0]?.skipped.costs).toBe(1)

    const other = importBundle(bundleFile(costs('kasko', '11746.00')))
    expect(other.vehicles[0]?.added.costs).toBe(1)
  })

  const service = (part: string): string => `
format = "tritium-export"
format_version = 1

[[vehicle]]
slug = "sportage"
name = "SPORTAGE"

[[vehicle.service]]
date = 2025-05-14
part = "${part}"
odometer_km = 370
amount = 8664.00
`

  /* Tyres AND an oil change on one day at one reading is perfectly ordinary,
   * which is why `part` is in the key and date+odometer alone would be wrong. */
  it('keeps two service records made the same day at the same reading', () => {
    importBundle(bundleFile(service('Michelin Primacy 4')))
    const second = importBundle(bundleFile(service('Motor yağı')))

    expect(second.vehicles[0]?.added.service).toBe(1)
    expect(loadVehicle('sportage').service.entries).toHaveLength(2)
  })
})

describe('backups', () => {
  it('copies what it is about to overwrite, and not what it creates', () => {
    // First import creates the vehicle: there was nothing to preserve.
    importBundle(bundleFile(ONE_FILL))
    expect(existsSync(join(home, 'tritium', 'backups'))).toBe(false)

    const more = `${ONE_FILL}
[[vehicle.fuel]]
date = 2026-09-02
odometer_km = 20310
litres = 31.500
price_per_litre = 74.100
full_tank = true
fuel_type = "Kurşunsuz 95"
`
    importBundle(bundleFile(more))

    const rounds = readdirSync(join(home, 'tritium', 'backups'))
    expect(rounds).toHaveLength(1)

    // The copy is the file as it was BEFORE the second import — one entry.
    const kept = readFileSync(
      join(home, 'tritium', 'backups', rounds[0] as string, 'vehicles', 'sportage', 'fuel.toml'),
      'utf8'
    )
    expect(kept).toContain('f-0001')
    expect(kept).not.toContain('f-0002')
  })
})
