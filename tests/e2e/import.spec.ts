// Importing a bundle, through the real application (F16).
//
// The bundle is written here by hand and never by TRITIUM, because TRITIUM has
// no export — the file always comes from somewhere else. Seeding it with Node's
// own fs is the same discipline storage.spec.ts uses "to prove the app reads
// real files, not just its own writes", and here it is not a discipline but the
// only honest option.
//
// `data:import` takes a PATH rather than opening the picker itself, which is
// what makes this testable: Playwright cannot see an OS-drawn dialog at all.
// The picker is a separate channel and the only part of the flow no test drives.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const tritiumDir = (): string => join(dataDir, 'tritium')
const vehicleDir = (): string => join(tritiumDir(), 'vehicles', SLUG)

const BUNDLE = `format = "tritium-export"
format_version = 1
exported = 2026-08-19
source = "android"

[[vehicle]]
slug = "sportage"
name = "SPORTAGE 1.6 T-GDI"
make = "Kia"
tank_capacity_l = 54.0

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
`

function bundleAt(name: string, text: string): string {
  const file = join(dataDir, name)
  writeFileSync(file, text)
  return file
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-import-')
  seedSettings(dataDir, { activeVehicle: SLUG })
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('a hand-written bundle becomes a vehicle, and the shell shows it without a restart', async () => {
  const file = bundleAt('phone.toml', BUNDLE)
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-summary')

  const result = await shell.evaluate(async (path) => window.tritium.importBundle(path), file)
  expect(result).toBeTruthy()

  // On disk, in the layout §4.1 draws, written by the same serialisers the app
  // uses for its own records.
  await expect(() => {
    expect(existsSync(join(vehicleDir(), 'fuel.toml'))).toBe(true)
  }).toPass({ timeout: 5_000 })

  const fuel = readFileSync(join(vehicleDir(), 'fuel.toml'), 'utf8')
  expect(fuel).toContain('id = "f-0001"')
  expect(fuel).toContain('odometer_km = 19764')
  expect(readFileSync(join(vehicleDir(), 'vehicle.toml'), 'utf8')).toContain('SPORTAGE 1.6 T-GDI')

  // And in the interface, without anything being reopened — the broadcast that
  // I-01 and I-02 were both about.
  await shell.getByTestId('tab-fuel').click()
  await expect(shell.getByTestId('fuel-list')).toBeVisible()
  await expect(shell.getByTestId(`fuel-odometer_km-f-0001`)).toBeVisible()
})

test('importing the same bundle twice leaves the files byte-identical', async () => {
  const file = bundleAt('phone.toml', BUNDLE)
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-summary')

  await shell.evaluate(async (path) => window.tritium.importBundle(path), file)
  await expect(() => {
    expect(existsSync(join(vehicleDir(), 'fuel.toml'))).toBe(true)
  }).toPass({ timeout: 5_000 })

  const fuelAfterFirst = readFileSync(join(vehicleDir(), 'fuel.toml'), 'utf8')
  const costsAfterFirst = readFileSync(join(vehicleDir(), 'costs.toml'), 'utf8')

  await shell.evaluate(async (path) => window.tritium.importBundle(path), file)

  expect(readFileSync(join(vehicleDir(), 'fuel.toml'), 'utf8')).toBe(fuelAfterFirst)
  expect(readFileSync(join(vehicleDir(), 'costs.toml'), 'utf8')).toBe(costsAfterFirst)
})

test('a bundle from a newer version is refused, and nothing is written', async () => {
  const file = bundleAt('newer.toml', BUNDLE.replace('format_version = 1', 'format_version = 9'))
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-summary')

  const refused = await shell.evaluate(async (path) => {
    try {
      await window.tritium.importBundle(path)
      return false
    } catch {
      return true
    }
  }, file)

  expect(refused).toBe(true)
  expect(existsSync(join(tritiumDir(), 'vehicles', SLUG))).toBe(false)
})

test('what an import overwrites is copied into backups first', async () => {
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-summary')

  // First import creates the vehicle — there was nothing to preserve.
  await shell.evaluate(
    async (path) => window.tritium.importBundle(path),
    bundleAt('one.toml', BUNDLE)
  )
  await expect(() => {
    expect(existsSync(join(vehicleDir(), 'fuel.toml'))).toBe(true)
  }).toPass({ timeout: 5_000 })

  const second = `${BUNDLE}
[[vehicle.fuel]]
date = 2026-09-02
odometer_km = 20310
litres = 31.500
price_per_litre = 74.100
full_tank = true
fuel_type = "Kurşunsuz 95"
`
  await shell.evaluate(
    async (path) => window.tritium.importBundle(path),
    bundleAt('two.toml', second)
  )

  await expect(() => {
    expect(existsSync(join(tritiumDir(), 'backups'))).toBe(true)
  }).toPass({ timeout: 5_000 })

  const rounds = readdirSync(join(tritiumDir(), 'backups'))
  expect(rounds.length).toBeGreaterThan(0)

  // The copy is what the file was before the second import: one fill-up.
  const kept = readFileSync(
    join(tritiumDir(), 'backups', rounds[0] as string, 'vehicles', SLUG, 'fuel.toml'),
    'utf8'
  )
  expect(kept).toContain('f-0001')
  expect(kept).not.toContain('f-0002')
})

test('a bundle that is not ours leaves an existing log untouched', async () => {
  // A real log already here, written by hand.
  mkdirSync(vehicleDir(), { recursive: true })
  const existing = [
    'schema_version = 1',
    '',
    '[[entry]]',
    'id = "f-0001"',
    'date = 2026-01-04',
    'odometer_km = 12045',
    'litres = 48.750',
    'price_per_litre = 48.900',
    'full_tank = true',
    'fuel_type = "Kurşunsuz 95"',
    ''
  ].join('\n')
  writeFileSync(join(vehicleDir(), 'vehicle.toml'), 'schema_version = 1\nname = "SPORTAGE"\n')
  writeFileSync(join(vehicleDir(), 'fuel.toml'), existing)

  const file = bundleAt('nonsense.toml', 'schema_version = 1\n\n[[entry]]\nid = "f-0001"\n')
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-summary')

  const refused = await shell.evaluate(async (path) => {
    try {
      await window.tritium.importBundle(path)
      return false
    } catch {
      return true
    }
  }, file)

  expect(refused).toBe(true)
  expect(readFileSync(join(vehicleDir(), 'fuel.toml'), 'utf8')).toBe(existing)
})
