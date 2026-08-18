// The F2 storage bridge, across the real process boundary.
//
// The record files themselves are held to XTRITIUM §4.4 character for character
// by the unit tests. What those cannot see is the seam: whether the names the
// preload invokes are the names the main process registered, and whether a
// document survives the two structured-clone hops between disk and renderer. A
// typo in that seam would typecheck, ship, and only surface in F3.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings } from './harness.js'

// A canonical fuel.toml — canonical meaning: what the serialiser emits. The
// assertion below is an identity (write(read(x)) === x), which holds for any
// canonical document, so this copy cannot drift away from §4.4 in a way that
// would let a real break through. Conformance to §4.4 is the unit tests' job.
const FUEL = `schema_version = 1

[[entry]]
id = "f-0001"
date = 2026-08-16
odometer_km = 19764
litres = 29.990
price_per_litre = 73.380
full_tank = true
fuel_type = "Kurşunsuz 95"
`

const VEHICLE = `schema_version = 1
name = "SPORTAGE 1.6 T-GDI"
make = "Kia"
model = "Sportage"
year = 2025
`

let app: ElectronApplication
let dataDir = ''

const vehicleDir = (): string => join(dataDir, 'tritium', 'vehicles', 'sportage')

test.beforeEach(async () => {
  dataDir = makeDataDir('tritium-storage-')
  seedSettings(dataDir)
  app = await launchApp(dataDir)
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('the renderer sees no vehicles before any exist', async () => {
  const page = await app.firstWindow()
  const slugs = await page.evaluate(() => window.tritium.listVehicles())
  expect(slugs).toEqual([])
})

test('a vehicle on disk reaches the renderer whole, and returns unchanged', async () => {
  mkdirSync(vehicleDir(), { recursive: true })
  writeFileSync(join(vehicleDir(), 'vehicle.toml'), VEHICLE)
  writeFileSync(join(vehicleDir(), 'fuel.toml'), FUEL)

  // The directory appeared after launch; the list is read on demand, not cached.
  const page = await app.firstWindow()
  expect(await page.evaluate(() => window.tritium.listVehicles())).toEqual(['sportage'])

  const bundle = (await page.evaluate(() => window.tritium.loadVehicle('sportage'))) as {
    vehicle: { vehicle: { name: string } } | null
    fuel: { entries: { id: string }[] }
  }
  expect(bundle.vehicle?.vehicle.name).toBe('SPORTAGE 1.6 T-GDI')
  expect(bundle.fuel.entries.map((entry) => entry.id)).toEqual(['f-0001'])

  // Straight back out through the write channel: two process hops and an atomic
  // rename later, the file on disk is the same bytes it was.
  await page.evaluate(async () => {
    const loaded = (await window.tritium.loadVehicle('sportage')) as { fuel: unknown }
    await window.tritium.saveFuel('sportage', loaded.fuel)
  })

  await expect(() => {
    expect(readFileSync(join(vehicleDir(), 'fuel.toml'), 'utf8')).toBe(FUEL)
  }).toPass({ timeout: 5_000 })

  const document = parse(readFileSync(join(vehicleDir(), 'fuel.toml'), 'utf8')) as Record<
    string,
    unknown
  >
  expect(document['schema_version']).toBe(1)
})
