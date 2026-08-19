// AF8's own check, named in AF1.md's AF-map: "round-trip test against the
// real desktop importer." import.test.ts's own header comment explains why
// every bundle there is hand-typed — "this app has no export... a test that
// fed the importer its own output would be proving the wrong thing." That
// stopped being true the moment a second, independent implementation
// existed to feed it: the Android app, AF8.
//
// ANDROID_BUNDLE below is not hand-typed. It is the literal, unmodified text
// `adb pull`ed off a real device running the AF8 build, exported through the
// app's own Settings → Export button, `ACTION_CREATE_DOCUMENT` and all — two
// vehicles, one with a fill-up, a cost and a service record, one with none.
// This test feeds it to importBundle exactly as written, unmodified, and
// checks the result against what F16 §2.2 promises.
//
// Not wired into any CI (android-ci.yml has no Node; package.yml triggers
// only on a tag). Run by hand: `npx vitest run tests/unit/android-export-roundtrip.test.ts`.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importBundle } from '../../src/main/storage/import.js'
import { loadVehicle, vehicleFiles } from '../../src/main/storage/repository.js'

let home = ''
let previous: string | undefined

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'tritium-android-roundtrip-'))
  previous = process.env['XDG_DATA_HOME']
  process.env['XDG_DATA_HOME'] = home
})

afterEach(() => {
  if (previous === undefined) delete process.env['XDG_DATA_HOME']
  else process.env['XDG_DATA_HOME'] = previous
  rmSync(home, { recursive: true, force: true })
})

const ANDROID_BUNDLE = `format = "tritium-export"
format_version = 1
exported = 2026-08-20
source = "android"

[[vehicle]]
slug = "portageaf8"
name = "portageAF8"
make = ""
model = ""
year = 0
engine = ""
fuel_spec = ""
plate = ""
vin = ""
tank_capacity_l = 0.0
purchase_price = 0.00

[[vehicle.fuel]]
date = 2026-08-16
odometer_km = 19764
litres = 29.990
price_per_litre = 73.380
full_tank = true
fuel_type = "Kurşunsuz 95"

[[vehicle.costs]]
date = 2026-04-11
group = "tekrar-eden"
category = "trafik-sigortasi"
title = "Trafik Sigortası 26/27"
amount = 11746.00
income = false
payment_method = "kredi-karti"
bank = "Enpara"
instalment = "Taksit 6"
note = ""

[[vehicle.service]]
date = 2025-05-14
part = "Michelin Primacy 4 S1 235/50R19 103V XL"
odometer_km = 370
amount = 8664.00
vendor = "https://www.lastikcim.com.tr/"

[[vehicle]]
slug = "spare"
name = "Spare"
make = ""
model = ""
year = 0
engine = ""
fuel_spec = ""
plate = ""
vin = ""
tank_capacity_l = 0.0
purchase_price = 0.00
`

function bundleFile(): string {
  const file = join(home, 'android-export.toml')
  writeFileSync(file, ANDROID_BUNDLE)
  return file
}

describe('a real Android export, fed to the real desktop importer', () => {
  it('creates both vehicles, with every entry, and the empty one has none', () => {
    const result = importBundle(bundleFile())

    expect(result.vehicles).toHaveLength(2)

    const withEntries = result.vehicles.find((v) => v.slug === 'portageaf8')
    expect(withEntries).toEqual({
      slug: 'portageaf8',
      vehicleCreated: true,
      added: { fuel: 1, costs: 1, service: 1 },
      skipped: { fuel: 0, costs: 0, service: 0 }
    })

    const empty = result.vehicles.find((v) => v.slug === 'spare')
    expect(empty).toEqual({
      slug: 'spare',
      vehicleCreated: true,
      added: { fuel: 0, costs: 0, service: 0 },
      skipped: { fuel: 0, costs: 0, service: 0 }
    })

    const bundle = loadVehicle('portageaf8')
    expect(bundle.vehicle?.vehicle.name).toBe('portageAF8')
    expect(bundle.fuel.entries).toHaveLength(1)
    expect(bundle.fuel.entries[0]).toMatchObject({
      date: '2026-08-16',
      odometer_km: 19764,
      full_tank: true,
      fuel_type: 'Kurşunsuz 95'
    })
    expect(bundle.costs.entries).toHaveLength(1)
    expect(bundle.costs.entries[0]).toMatchObject({
      date: '2026-04-11',
      category: 'trafik-sigortasi',
      amount: 1174600
    })
    expect(bundle.service.entries).toHaveLength(1)
    expect(bundle.service.entries[0]).toMatchObject({
      date: '2025-05-14',
      odometer_km: 370,
      vendor: 'https://www.lastikcim.com.tr/'
    })

    const spareBundle = loadVehicle('spare')
    expect(spareBundle.vehicle?.vehicle.name).toBe('Spare')
    expect(spareBundle.fuel.entries).toHaveLength(0)
    expect(spareBundle.costs.entries).toHaveLength(0)
    expect(spareBundle.service.entries).toHaveLength(0)
  })

  it('no entry carries an id from the phone — every id is the receiving file’s own', () => {
    importBundle(bundleFile())
    const bundle = loadVehicle('portageaf8')
    expect(bundle.fuel.entries[0]?.id).toBe('f-0001')
    expect(bundle.costs.entries[0]?.id).toBe('c-0001')
    expect(bundle.service.entries[0]?.id).toBe('s-0001')
  })

  it('importing the same export twice adds nothing the second time', () => {
    const file = bundleFile()
    importBundle(file)

    const files = vehicleFiles('portageaf8')
    const before = {
      fuel: readFileSync(files.fuel, 'utf8'),
      costs: readFileSync(files.costs, 'utf8'),
      service: readFileSync(files.service, 'utf8')
    }

    const second = importBundle(file)
    const again = second.vehicles.find((v) => v.slug === 'portageaf8')
    expect(again).toEqual({
      slug: 'portageaf8',
      vehicleCreated: false,
      added: { fuel: 0, costs: 0, service: 0 },
      skipped: { fuel: 1, costs: 1, service: 1 }
    })

    expect(readFileSync(files.fuel, 'utf8')).toBe(before.fuel)
    expect(readFileSync(files.costs, 'utf8')).toBe(before.costs)
    expect(readFileSync(files.service, 'utf8')).toBe(before.service)
  })
})
