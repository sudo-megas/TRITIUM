// F3 — vehicles, the picker, and the one question TRITIUM asks.
//
// These drive the real app through the real windows: the currency question is
// answered in the window it opens in, and a vehicle is typed into a form window
// and then read off disk as a file, the way the maker would read it.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, settingsPathIn, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')

function putVehicle(slug: string, name: string): void {
  const directory = join(vehiclesDir(), slug)
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    join(directory, 'vehicle.toml'),
    `schema_version = 1\nname = "${name}"\nmake = ""\nmodel = ""\nyear = 0\n`
  )
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-vehicles-')
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('the currency is asked once, and never again', async () => {
  // No settings.toml at all: the key is absent, so the question is owed.
  app = await launchApp(dataDir)

  const ask = await windowWith(app, 'currency-select')
  await ask.getByTestId('currency-select').selectOption('TRY')
  await ask.getByTestId('currency-confirm').click()

  await expect(() => {
    expect(readFileSync(settingsPathIn(dataDir), 'utf8')).toContain('currency = "TRY"')
  }).toPass({ timeout: 5_000 })

  // The window that asked has closed; the shell is what is left.
  await expect.poll(() => app.windows().length, { timeout: 5_000 }).toBe(1)

  await app.close()
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-summary')
  await expect(shell.getByTestId('tab-summary')).toBeVisible()
  expect(await shell.getByTestId('currency-select').count()).toBe(0)
  expect(app.windows().length).toBe(1)
})

test('a settings.toml written before the key existed is still asked', async () => {
  // XTRITIUM §8 — the trigger is the missing KEY, not a missing directory. The
  // maker's own file predates the question and must still get it, exactly once.
  seedSettings(dataDir, { currency: null })
  app = await launchApp(dataDir)

  const ask = await windowWith(app, 'currency-select')
  await expect(ask.getByTestId('currency-confirm')).toBeVisible()
})

test('a vehicle typed into the form lands on disk and in the picker', async () => {
  seedSettings(dataDir)
  app = await launchApp(dataDir)

  const shell = await windowWith(app, 'vehicle-add')
  await expect(shell.getByTestId('vehicle-picker')).toBeVisible()
  await shell.getByTestId('vehicle-add').click()

  const form = await windowWith(app, 'vehicle-save')
  await form.getByTestId('vehicle-name').fill('SPORTAGE 1.6 T-GDI')
  await form.getByTestId('vehicle-make').fill('Kia')
  await form.getByTestId('vehicle-model').fill('Sportage')
  await form.getByTestId('vehicle-year').fill('2025')
  await form.getByTestId('vehicle-fuel_spec').selectOption('Kurşunsuz 95')
  await form.getByTestId('vehicle-tank_capacity_l').fill('54,0')
  await form.getByTestId('vehicle-purchase_price').fill('2.160.000,00')
  await form.getByTestId('vehicle-purchase_date').fill('25/04/2025')

  // The figure is read back in the family convention while it can still be
  // corrected (XTRITIUM §8).
  await expect(form.getByTestId('vehicle-price-preview')).toHaveText('2.160.000,00 ₺')

  await form.getByTestId('vehicle-save').click()

  const slug = 'sportage-1-6-t-gdi'
  await expect(() => {
    expect(readdirSync(vehiclesDir())).toContain(slug)
  }).toPass({ timeout: 5_000 })

  // Only vehicle.toml. The entry files appear when their first entry does.
  expect(readdirSync(join(vehiclesDir(), slug))).toEqual(['vehicle.toml'])

  const text = readFileSync(join(vehiclesDir(), slug, 'vehicle.toml'), 'utf8')
  const document = parse(text) as Record<string, unknown>
  expect(document['schema_version']).toBe(1)
  expect(document['name']).toBe('SPORTAGE 1.6 T-GDI')
  expect(document['tank_capacity_l']).toBe(54)
  expect(document['purchase_price']).toBe(2160000)
  expect(text).toContain('tank_capacity_l = 54.0')
  expect(text).toContain('purchase_price = 2160000.00')
  expect(text).toContain('purchase_date = 2025-04-25')
  // There is no photo field, and a saved record does not invent one.
  expect(text).not.toContain('photo')

  // The shell hears about it and lists it by name, not by slug.
  await expect(shell.getByTestId('vehicle-picker')).toHaveValue(slug)
  await expect(shell.getByTestId('vehicle-picker')).toContainText('SPORTAGE 1.6 T-GDI')

  // Reopened, every figure is the figure that was typed. This is the whole
  // round trip — text to scaled integer to TOML and back again — and it is
  // where a separator read the wrong way round would finally show.
  await shell.getByTestId('vehicle-edit').click()
  const reopened = await windowWith(app, 'vehicle-save')
  await expect(reopened.getByTestId('vehicle-name')).toHaveValue('SPORTAGE 1.6 T-GDI')
  await expect(reopened.getByTestId('vehicle-year')).toHaveValue('2025')
  await expect(reopened.getByTestId('vehicle-tank_capacity_l')).toHaveValue('54,0')
  await expect(reopened.getByTestId('vehicle-purchase_price')).toHaveValue('2160000,00')
  await expect(reopened.getByTestId('vehicle-purchase_date')).toHaveValue('25/04/2025')
  await expect(reopened.getByTestId('vehicle-fuel_spec')).toHaveValue('Kurşunsuz 95')
})

test('the form is a separate window, anchored to nothing', async () => {
  seedSettings(dataDir)
  app = await launchApp(dataDir)

  const shell = await windowWith(app, 'vehicle-add')
  expect(app.windows().length).toBe(1)
  await shell.getByTestId('vehicle-add').click()
  await windowWith(app, 'vehicle-save')

  expect(app.windows().length).toBe(2)

  // XTRITIUM §5.1 — "movable, non-anchored popup windows, real separate
  // Electron windows, draggable outside the main one". A parent would anchor
  // it; the entry forms have none. It is also genuinely movable, so it moves.
  const shapes = await app.evaluate(async ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((window) => ({
      parented: window.getParentWindow() !== null,
      movable: window.isMovable()
    }))
  )
  expect(shapes).toHaveLength(2)
  expect(shapes.every((shape) => !shape.parented)).toBe(true)
  expect(shapes.every((shape) => shape.movable)).toBe(true)

  // And the renderer still cannot open one itself. F3 gave the app windows; it
  // gave the page nothing (XTRITIUM §3.5).
  const opened = await shell.evaluate(() => window.open('https://example.com') !== null)
  expect(opened).toBe(false)
  expect(app.windows().length).toBe(2)
})

test('the picker reopens on the vehicle it was left on', async () => {
  seedSettings(dataDir)
  putVehicle('astra', 'Opel Astra')
  putVehicle('sportage', 'Kia Sportage')
  app = await launchApp(dataDir)

  const shell = await windowWith(app, 'vehicle-picker')
  await shell.getByTestId('vehicle-picker').selectOption('sportage')

  await expect(() => {
    expect(readFileSync(settingsPathIn(dataDir), 'utf8')).toContain('active_vehicle = "sportage"')
  }).toPass({ timeout: 5_000 })

  await app.close()
  app = await launchApp(dataDir)
  const restarted = await windowWith(app, 'vehicle-picker')
  await expect(restarted.getByTestId('vehicle-picker')).toHaveValue('sportage')
})

test('renaming a vehicle leaves its directory where it is', async () => {
  // The slug is allocated once, at creation. Moving a directory on a rename
  // would mean copying every record in it and deleting the original.
  seedSettings(dataDir, { activeVehicle: 'sportage' })
  putVehicle('sportage', 'Kia Sportage')
  app = await launchApp(dataDir)

  const shell = await windowWith(app, 'vehicle-edit')
  await shell.getByTestId('vehicle-edit').click()

  const form = await windowWith(app, 'vehicle-save')
  await expect(form.getByTestId('vehicle-name')).toHaveValue('Kia Sportage')
  await form.getByTestId('vehicle-name').fill('Kia Sportage 1.6')
  await form.getByTestId('vehicle-save').click()

  await expect(() => {
    expect(readFileSync(join(vehiclesDir(), 'sportage', 'vehicle.toml'), 'utf8')).toContain(
      'name = "Kia Sportage 1.6"'
    )
  }).toPass({ timeout: 5_000 })

  expect(readdirSync(vehiclesDir())).toEqual(['sportage'])
})

test('an empty app is the same layout, holding nothing', async () => {
  // XTRITIUM §7 — no "get started" screens. The picker is there, empty, beside
  // the button that fills it.
  seedSettings(dataDir)
  app = await launchApp(dataDir)

  const shell = await windowWith(app, 'vehicle-picker')
  await expect(shell.getByTestId('vehicle-picker')).toBeDisabled()
  await expect(shell.getByTestId('vehicle-add')).toBeEnabled()
  await expect(shell.getByTestId('vehicle-edit')).toBeDisabled()
  await expect(shell.getByTestId('tab-summary')).toBeVisible()
})
