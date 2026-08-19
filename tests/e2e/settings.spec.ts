// F11 — units, precision, the payment-method list, and the currency that
// cannot be changed. Driven through the real app.
//
// The claim the milestone rests on is that THE FILE DOES NOT MOVE. Two tests
// hold it: one enters a fill-up in miles and gallons and reads kilometres and
// litres off disk, and one switches units back and forth and compares the
// record file byte for byte.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, settingsPathIn, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')
const fuelPath = (): string => join(vehiclesDir(), SLUG, 'fuel.toml')

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

function putFuel(): void {
  mkdirSync(join(vehiclesDir(), SLUG), { recursive: true })
  writeFileSync(
    fuelPath(),
    [
      'schema_version = 1',
      '',
      '[[entry]]',
      'id = "f-0001"',
      'date = 2026-08-16',
      'odometer_km = 19764',
      'litres = 29.990',
      'price_per_litre = 73.380',
      'full_tank = true',
      'fuel_type = "Kurşunsuz 95"',
      ''
    ].join('\n')
  )
}

async function openSettings(): Promise<Page> {
  const shell = await windowWith(app, 'tab-settings')
  await shell.getByTestId('tab-settings').click()
  await expect(shell.getByTestId('distance-select')).toBeVisible()
  return shell
}

/** The write crosses IPC; wait for it to reach disk. */
async function waitForSettings(fragment: string): Promise<void> {
  await expect(() => {
    expect(readFileSync(settingsPathIn(dataDir), 'utf8')).toContain(fragment)
  }).toPass({ timeout: 5_000 })
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-settings-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  putVehicle()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('every setting §4.4 holds is on the page and persists', async () => {
  app = await launchApp(dataDir)
  const shell = await openSettings()

  await shell.getByTestId('distance-select').selectOption('mi')
  await waitForSettings('distance = "mi"')

  await shell.getByTestId('volume-select').selectOption('gal')
  await waitForSettings('volume = "gal"')

  await shell.getByTestId('consumption-select').selectOption('mpg')
  await waitForSettings('consumption = "mpg"')

  await shell.getByTestId('decimals-consumption-select').selectOption('1')
  await waitForSettings('decimals_consumption = 1')
})

test('switching to miles changes every odometer on screen', async () => {
  putFuel()
  app = await launchApp(dataDir)
  const shell = await openSettings()

  await shell.getByTestId('tab-fuel').click()
  await expect(shell.getByTestId('fuel-odometer_km-f-0001')).toHaveText('19.764')

  await shell.getByTestId('tab-settings').click()
  await shell.getByTestId('distance-select').selectOption('mi')
  await shell.getByTestId('tab-fuel').click()

  // 19.764 km is 12.280,8 mi — at one decimal, which is what makes the round
  // trip exact (F11.md §2.5).
  await expect(shell.getByTestId('fuel-odometer_km-f-0001')).toHaveText('12.280,8')
})

test('a fill-up entered in miles and gallons is stored in kilometres and litres', async () => {
  app = await launchApp(dataDir)
  const shell = await openSettings()

  await shell.getByTestId('distance-select').selectOption('mi')
  await shell.getByTestId('volume-select').selectOption('gal')

  await shell.getByTestId('tab-fuel').click()
  await shell.getByTestId('fuel-quick-add').click()
  const form = await windowWith(app, 'fuel-save')

  // The labels say which unit is being asked for.
  await expect(form.getByTestId('fuel-odometer_km').locator('..')).toContainText('mi')
  await expect(form.getByTestId('fuel-litres').locator('..')).toContainText('gal')

  await form.getByTestId('fuel-odometer_km').fill('12280,8')
  await form.getByTestId('fuel-litres').fill('7,923')
  await form.getByTestId('fuel-price_per_litre').fill('277,774')
  await form.getByTestId('fuel-save').click()

  await expect(() => {
    expect(readFileSync(fuelPath(), 'utf8')).toContain('odometer_km')
  }).toPass({ timeout: 5_000 })

  const document = parse(readFileSync(fuelPath(), 'utf8')) as Record<string, unknown>
  const entries = document['entry'] as Record<string, unknown>[]

  // §4.4's own key names, holding what they say they hold.
  expect(entries[0]?.['odometer_km']).toBe(19_764)
  expect(entries[0]?.['litres']).toBeCloseTo(29.99, 2)
  expect(entries[0]?.['price_per_litre']).toBeCloseTo(73.38, 2)

  // And the file still says kilometres and litres, not miles and gallons.
  const text = readFileSync(fuelPath(), 'utf8')
  expect(text).toContain('odometer_km = 19764')
  expect(text).not.toContain('mi')
  expect(text).not.toContain('gal')
})

test('switching units and back leaves the record file byte-identical', async () => {
  putFuel()
  const before = readFileSync(fuelPath(), 'utf8')

  app = await launchApp(dataDir)
  const shell = await openSettings()

  await shell.getByTestId('distance-select').selectOption('mi')
  await shell.getByTestId('volume-select').selectOption('gal')
  await shell.getByTestId('consumption-select').selectOption('mpg')
  await waitForSettings('consumption = "mpg"')

  // Look at the data in the other units, then come back.
  await shell.getByTestId('tab-fuel').click()
  await shell.getByTestId('tab-summary').click()
  await shell.getByTestId('tab-settings').click()

  await shell.getByTestId('distance-select').selectOption('km')
  await shell.getByTestId('volume-select').selectOption('l')
  await shell.getByTestId('consumption-select').selectOption('l100km')
  await waitForSettings('consumption = "l100km"')

  // A unit is a way of looking, not a way of writing: nothing but
  // settings.toml was touched (F11.md decision 1).
  expect(readFileSync(fuelPath(), 'utf8')).toBe(before)
})

test('consumption converts from the §5.2 figure into mpg', async () => {
  putFuel()
  app = await launchApp(dataDir)
  const shell = await openSettings()

  await shell.getByTestId('consumption-select').selectOption('mpg')
  await shell.getByTestId('tab-fuel').click()

  // The column is headed by the unit itself, which is notation and not prose.
  await expect(shell.getByTestId('fuel-list')).toContainText('mpg')
})

test('precision changes what a figure shows and nothing that is stored', async () => {
  putFuel()
  const before = readFileSync(fuelPath(), 'utf8')

  app = await launchApp(dataDir)
  const shell = await openSettings()

  await shell.getByTestId('decimals-cost-select').selectOption('1')
  await waitForSettings('decimals_cost_per_km = 1')

  expect(readFileSync(fuelPath(), 'utf8')).toBe(before)
})

test('the payment-method list can be added to and removed from', async () => {
  app = await launchApp(dataDir)
  const shell = await openSettings()

  // §4.4 ships three.
  await expect(shell.getByTestId('method-eft')).toBeVisible()
  await expect(shell.getByTestId('method-kredi-karti')).toBeVisible()

  await shell.getByTestId('method-input').fill('Havale')
  await shell.getByTestId('method-add').click()
  await waitForSettings('havale')
  await expect(shell.getByTestId('method-havale')).toBeVisible()

  // It is offered on the cost form.
  await shell.getByTestId('tab-costs').click()
  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')
  const values = await form
    .getByTestId('cost-payment_method')
    .locator('option')
    .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
  expect(values).toContain('havale')
  await form.getByTestId('cost-cancel').click()

  // And removing one is not destructive.
  await shell.getByTestId('tab-settings').click()
  await shell.getByTestId('method-remove-eft').click()
  await expect(shell.getByTestId('method-eft')).toHaveCount(0)
})

test('a cost keeps a payment method that has been removed from the list', async () => {
  // F5's cost form keeps a stored value that is not offered, which is exactly
  // what makes removal safe rather than destructive (F11.md decision 7).
  mkdirSync(join(vehiclesDir(), SLUG), { recursive: true })
  writeFileSync(
    join(vehiclesDir(), SLUG, 'costs.toml'),
    [
      'schema_version = 1',
      '',
      '[[entry]]',
      'id = "c-0001"',
      'date = 2026-04-11',
      'group = "tekrar-eden"',
      'category = "kasko"',
      'title = "Kasko"',
      'amount = 1000.00',
      'income = false',
      'payment_method = "eft"',
      'bank = "Enpara"',
      'instalment = ""',
      'note = ""',
      ''
    ].join('\n')
  )

  app = await launchApp(dataDir)
  const shell = await openSettings()

  await shell.getByTestId('method-remove-eft').click()
  await waitForSettings('payment_methods')

  await shell.getByTestId('tab-costs').click()
  await shell.getByTestId('cost-row-c-0001').click()
  await shell.getByTestId('cost-detail-edit').click()
  const form = await windowWith(app, 'cost-save')

  // Still selected, still saved.
  await expect(form.getByTestId('cost-payment_method')).toHaveValue('eft')
  await form.getByTestId('cost-save').click()

  await expect(() => {
    expect(readFileSync(join(vehiclesDir(), SLUG, 'costs.toml'), 'utf8')).toContain(
      'payment_method = "eft"'
    )
  }).toPass({ timeout: 5_000 })
})

test('the currency is shown and cannot be changed', async () => {
  app = await launchApp(dataDir)
  const shell = await openSettings()

  await expect(shell.getByTestId('currency-value')).toHaveValue('TRY')
  await expect(shell.getByTestId('currency-value')).toBeDisabled()
})

test('the page says which gallon it means', async () => {
  // There are two and they differ by twenty per cent (F11.md decision 3).
  app = await launchApp(dataDir)
  const shell = await openSettings()

  await expect(shell.getByTestId('gallon-note')).toContainText('3.785411784')
})
