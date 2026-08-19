// F6 — Periyodik Bakım, driven through real windows.
//
// The rows these tests use are the maker's own PERİYODİK BAKIM sheet. The
// awkward ones are deliberate: a vendor that is a shop's name rather than an
// address, and a row whose PARÇA is "SERVİS" with no vendor at all.
//
// The claim this file exists to defend is §3.5: an address is stored, shown and
// selectable, and the application still contains no link.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const ADDRESS = 'https://www.lastikcim.com.tr/lastik/4x4'

const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')
const servicePath = (): string => join(vehiclesDir(), SLUG, 'service.toml')
const fuelPath = (): string => join(vehiclesDir(), SLUG, 'fuel.toml')

function putVehicle(): void {
  const directory = join(vehiclesDir(), SLUG)
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    join(directory, 'vehicle.toml'),
    [
      'schema_version = 1',
      'name = "Kia Sportage"',
      'make = "Kia"',
      'model = "Sportage"',
      'year = 2025',
      'fuel_spec = "Kurşunsuz 95"',
      'tank_capacity_l = 54.0',
      ''
    ].join('\n')
  )
}

function putService(...entries: string[]): void {
  mkdirSync(join(vehiclesDir(), SLUG), { recursive: true })
  writeFileSync(servicePath(), ['schema_version = 1', ...entries, ''].join('\n'))
}

function entryText(id: string, over: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    date: '2025-05-14',
    part: '"Michelin Primacy 4 S1 235/50R19 103V XL"',
    odometer_km: '370',
    amount: '8664.00',
    vendor: `"${ADDRESS}"`,
    ...over
  }

  return [
    '',
    '[[entry]]',
    `id = "${id}"`,
    ...Object.entries(fields).map(([key, value]) => `${key} = ${value}`)
  ].join('\n')
}

async function openServiceTab(): Promise<Page> {
  const shell = await windowWith(app, 'tab-service')
  await shell.getByTestId('tab-service').click()
  await expect(shell.getByTestId('service-list')).toBeVisible()
  return shell
}

function serviceEntries(): Record<string, unknown>[] {
  const document = parse(readFileSync(servicePath(), 'utf8')) as Record<string, unknown>
  return document['entry'] as Record<string, unknown>[]
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-service-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  putVehicle()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('a service record typed into the form lands on disk and in the shell', async () => {
  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  await shell.getByTestId('service-add').click()
  const form = await windowWith(app, 'service-save')

  await form.getByTestId('service-date').fill('14/05/2025')
  await form.getByTestId('service-part').fill('Michelin Primacy 4 S1 235/50R19 103V XL')
  await form.getByTestId('service-odometer_km').fill('370')
  await form.getByTestId('service-amount').fill('8664,00')
  await form.getByTestId('service-vendor').fill(ADDRESS)

  await form.getByTestId('service-save').click()

  await expect(() => {
    expect(readdirSync(join(vehiclesDir(), SLUG))).toContain('service.toml')
  }).toPass({ timeout: 5_000 })

  const entries = serviceEntries()
  expect(entries).toHaveLength(1)
  expect(entries[0]?.['id']).toBe('s-0001')
  expect(entries[0]?.['part']).toBe('Michelin Primacy 4 S1 235/50R19 103V XL')
  expect(entries[0]?.['odometer_km']).toBe(370)
  expect(entries[0]?.['amount']).toBe(8664)
  expect(entries[0]?.['vendor']).toBe(ADDRESS)

  // The shell has it without a restart — the broadcast F5 flagged and F6 added.
  await expect(shell.getByTestId('service-row-s-0001')).toBeVisible()
  await expect(shell.getByTestId('service-amount-s-0001')).toHaveText('8.664,00 ₺')
})

test('a stored address is shown as text, and the app still holds no link', async () => {
  putService(entryText('s-0001'))

  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  // The address is there to read and to select.
  await expect(shell.getByTestId('service-vendor-s-0001')).toHaveText(ADDRESS)

  // XTRITIUM §3.5 — the app opens no browser and follows no link. F1 made this
  // claim of the About page; F6 is the first milestone to store a URL, so it
  // makes the claim of the whole document with one displayed.
  expect(await shell.locator('a').count()).toBe(0)

  // And it is not a link in the form either.
  await shell.getByTestId('service-edit-s-0001').click()
  const form = await windowWith(app, 'service-save')
  await expect(form.getByTestId('service-vendor')).toHaveValue(ADDRESS)
  expect(await form.locator('a').count()).toBe(0)
})

test('a vendor that is a shop name, and a row with no vendor at all', async () => {
  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  // Row 3 of the sheet: bought from "heryedek", which is not an address.
  await shell.getByTestId('service-add').click()
  const first = await windowWith(app, 'service-save')
  await first.getByTestId('service-part').fill('Filtron K 1444A Polen Filtresi')
  await first.getByTestId('service-odometer_km').fill('8300')
  await first.getByTestId('service-amount').fill('760,00')
  await first.getByTestId('service-vendor').fill('heryedek')
  await first.getByTestId('service-save').click()

  await expect(shell.getByTestId('service-row-s-0001')).toBeVisible()

  // Row 4: labour, no vendor, and a PARÇA that is a description.
  await shell.getByTestId('service-add').click()
  const second = await windowWith(app, 'service-save')
  await second.getByTestId('service-part').fill('SERVİS')
  await second.getByTestId('service-odometer_km').fill('15100')
  await second.getByTestId('service-amount').fill('12000,00')
  await second.getByTestId('service-save').click()

  await expect(shell.getByTestId('service-row-s-0002')).toBeVisible()

  const entries = serviceEntries()
  expect(entries[0]?.['vendor']).toBe('heryedek')
  expect(entries[1]?.['part']).toBe('SERVİS')
  expect(entries[1]?.['vendor']).toBe('')
})

test('the odometer hint reads the service file too, not fuel alone', async () => {
  // A service at 15.100 km and no fill-up at all: a hint built from fuel.toml
  // would have nothing to say, which is exactly the F4 behaviour F6 corrects.
  putService(entryText('s-0001', { odometer_km: '15100', date: '2026-04-20' }))

  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  await shell.getByTestId('service-add').click()
  const form = await windowWith(app, 'service-save')

  await expect(form.getByTestId('service-odometer-hint')).toContainText('15.100')

  // And it warns on a lower reading, then accepts it (§5.1, §3.8).
  await form.getByTestId('service-odometer_km').fill('9000')
  await expect(form.getByTestId('service-odometer-warning')).toBeVisible()

  await form.getByTestId('service-amount').fill('500,00')
  await form.getByTestId('service-save').click()

  await expect(() => {
    expect(readFileSync(servicePath(), 'utf8')).toContain('odometer_km = 9000')
  }).toPass({ timeout: 5_000 })
})

test('the hint prefers the highest reading of either file', async () => {
  putService(entryText('s-0001', { odometer_km: '15100' }))
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

  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  await shell.getByTestId('service-add').click()
  const form = await windowWith(app, 'service-save')

  await expect(form.getByTestId('service-odometer-hint')).toContainText('19.764')
})

test('the form reopens a service record with every figure identical', async () => {
  putService(entryText('s-0001'))

  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  await shell.getByTestId('service-edit-s-0001').click()
  const form = await windowWith(app, 'service-save')

  await expect(form.getByTestId('service-date')).toHaveValue('14/05/2025')
  await expect(form.getByTestId('service-part')).toHaveValue(
    'Michelin Primacy 4 S1 235/50R19 103V XL'
  )
  await expect(form.getByTestId('service-odometer_km')).toHaveValue('370')
  await expect(form.getByTestId('service-amount')).toHaveValue('8664,00')
  await expect(form.getByTestId('service-vendor')).toHaveValue(ADDRESS)

  await form.getByTestId('service-save').click()
  await expect(() => {
    expect(serviceEntries()).toHaveLength(1)
  }).toPass({ timeout: 5_000 })
  expect(serviceEntries()[0]?.['id']).toBe('s-0001')
  expect(serviceEntries()[0]?.['amount']).toBe(8664)
})

test('the cost form now says where Periyodik Bakım is entered', async () => {
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-costs')
  await shell.getByTestId('tab-costs').click()

  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')

  await form.getByTestId('cost-group').selectOption('tekrar-eden')
  await expect(form.getByTestId('cost-service-elsewhere')).toBeVisible()

  // It still is not offered here — the cost form writes costs.toml.
  const values = await form.getByTestId('cost-category').locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  )
  expect(values).not.toContain('periyodik-bakim')
})

test('the service form is a separate window, anchored to nothing', async () => {
  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  expect(app.windows().length).toBe(1)
  await shell.getByTestId('service-add').click()
  await windowWith(app, 'service-save')
  expect(app.windows().length).toBe(2)

  const shapes = await app.evaluate(async ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((window) => ({
      parented: window.getParentWindow() !== null,
      movable: window.isMovable()
    }))
  )
  expect(shapes).toHaveLength(2)
  expect(shapes.every((shape) => !shape.parented)).toBe(true)
  expect(shapes.every((shape) => shape.movable)).toBe(true)

  const opened = await shell.evaluate(() => window.open('https://example.com') !== null)
  expect(opened).toBe(false)
  expect(app.windows().length).toBe(2)
})

test('an empty app is the same layout, holding nothing', async () => {
  rmSync(vehiclesDir(), { recursive: true, force: true })

  app = await launchApp(dataDir)
  const shell = await openServiceTab()

  await expect(shell.getByTestId('service-list')).toBeVisible()
  await expect(shell.getByTestId('service-empty')).toBeVisible()
  await expect(shell.getByTestId('service-add')).toBeDisabled()
})
