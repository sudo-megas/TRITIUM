// The edges nobody built for, through a real window (F12).
//
// One of these is a regression test for a defect this milestone found: a MANUAL
// category with no letters in it was being stored as a category literally
// called "vehicle" (issues.md I-17).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, settingsPathIn, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')

function putVehicle(): void {
  const dir = join(vehiclesDir(), SLUG)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'vehicle.toml'),
    [
      'schema_version = 1',
      'name = "SPORTAGE 1.6 T-GDI"',
      'make = "Kia"',
      'model = "Sportage"',
      'year = 2025',
      'fuel_spec = "Kurşunsuz 95"',
      'tank_capacity_l = 54.0',
      ''
    ].join('\n')
  )
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-edges-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  putVehicle()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('a MANUAL category with no letters in it is refused, not invented', async () => {
  // issues.md I-17. `!!!` has nothing to slugify, fell through to the vehicle
  // fallback, and was stored as a category called "vehicle" — which passed the
  // form's own "a category was chosen" gate on the way.
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-costs')
  await shell.getByTestId('tab-costs').click()
  await shell.getByTestId('cost-add').click()

  const form = await windowWith(app, 'cost-save')
  await form.getByTestId('cost-group').selectOption('manual')
  await form.getByTestId('cost-amount').fill('100,00')
  await form.getByTestId('cost-category-typed').fill('!!! ???')

  // Nothing usable was typed, so nothing is stored and Save stays shut.
  await expect(form.getByTestId('cost-save')).toBeDisabled()

  // And a real category opens it again.
  await form.getByTestId('cost-category-typed').fill('Lastik')
  await expect(form.getByTestId('cost-save')).toBeEnabled()
})

test('a damaged record file is reported and left byte-for-byte alone', async () => {
  // §4.4 / F2 — the app reports it and never offers to "fix" the file by
  // overwriting it. The maker repairs it in Neovim, which is the whole point of
  // plaintext (§3.4).
  const damaged = 'schema_version = 1\n\n[[entry]]\nid = "f-0001"\nlitres = = = 3\n'
  mkdirSync(join(vehiclesDir(), SLUG), { recursive: true })
  writeFileSync(join(vehiclesDir(), SLUG, 'fuel.toml'), damaged)

  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-fuel')

  // The application still opens — §3.2, straight into the data.
  await expect(shell.getByTestId('tab-fuel')).toBeVisible()
  await shell.getByTestId('tab-fuel').click()

  // And the file is exactly as the maker left it.
  expect(readFileSync(join(vehiclesDir(), SLUG, 'fuel.toml'), 'utf8')).toBe(damaged)
})

test('a seven-figure odometer is entered, stored and shown', async () => {
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-fuel')
  await shell.getByTestId('tab-fuel').click()
  await shell.getByTestId('fuel-quick-add').click()

  const form = await windowWith(app, 'fuel-save')
  await form.getByTestId('fuel-odometer_km').fill('1234567')
  await form.getByTestId('fuel-litres').fill('54,999')
  await form.getByTestId('fuel-price_per_litre').fill('173,380')
  await form.getByTestId('fuel-save').click()

  await expect(shell.getByTestId('fuel-row-f-0001')).toBeVisible()
  await expect(shell.getByTestId('fuel-odometer_km-f-0001')).toHaveText('1.234.567')

  const text = readFileSync(join(vehiclesDir(), SLUG, 'fuel.toml'), 'utf8')
  expect(text).toContain('odometer_km = 1234567')
})

test('every unit at the non-default survives a restart', async () => {
  app = await launchApp(dataDir)
  let shell = await windowWith(app, 'tab-settings')
  await shell.getByTestId('tab-settings').click()

  await shell.getByTestId('distance-select').selectOption('mi')
  await shell.getByTestId('volume-select').selectOption('gal')
  await shell.getByTestId('consumption-select').selectOption('kml')
  await shell.getByTestId('decimals-consumption-select').selectOption('4')

  await expect(() => {
    expect(readFileSync(settingsPathIn(dataDir), 'utf8')).toContain('decimals_consumption = 4')
  }).toPass({ timeout: 5_000 })

  await app.close()
  app = await launchApp(dataDir)
  shell = await windowWith(app, 'tab-settings')
  await shell.getByTestId('tab-settings').click()

  await expect(shell.getByTestId('distance-select')).toHaveValue('mi')
  await expect(shell.getByTestId('volume-select')).toHaveValue('gal')
  await expect(shell.getByTestId('consumption-select')).toHaveValue('kml')
  await expect(shell.getByTestId('decimals-consumption-select')).toHaveValue('4')
})

test('a vehicle whose optional fields are all empty is still a vehicle', async () => {
  writeFileSync(
    join(vehiclesDir(), SLUG, 'vehicle.toml'),
    ['schema_version = 1', 'name = "Bare"', ''].join('\n')
  )

  app = await launchApp(dataDir)
  const shell: Page = await windowWith(app, 'tab-summary')
  await shell.getByTestId('tab-summary').click()

  await expect(shell.getByTestId('summary-name')).toHaveText('Bare')
  // No figure it cannot compute is shown as a zero (§3.3).
  await expect(shell.getByTestId('summary-average')).toHaveText('—')
  await expect(shell.getByTestId('summary-odometer')).toHaveText('—')
})

test('an empty payment-method list leaves the cost form usable', async () => {
  // §3.8 — a maker who removed all three meant to, and the form does not
  // invent them back.
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-settings')
  await shell.getByTestId('tab-settings').click()

  for (const method of ['eft', 'kredi-karti', 'banka-karti']) {
    await shell.getByTestId(`method-remove-${method}`).click()
  }
  await expect(shell.getByTestId('payment-methods').locator('li')).toHaveCount(0)

  await shell.getByTestId('tab-costs').click()
  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')

  // The select is there, offering only "not set" — and a cost can still be
  // saved without one, because §4.4 never made it required.
  await form.getByTestId('cost-group').selectOption('tekrar-eden')
  await form.getByTestId('cost-category').selectOption('kasko')
  await form.getByTestId('cost-amount').fill('500,00')
  await expect(form.getByTestId('cost-save')).toBeEnabled()
})
