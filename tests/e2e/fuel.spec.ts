// F4 — the two entry paths and the figure the app computes from them.
//
// These drive the real app through real windows: a fill-up is typed into a form
// window and then read off disk as a file, the way the maker would read it, and
// the consumption figure is checked against arithmetic done by hand.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'

const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')
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

/** A fuel.toml written the way the maker would write one in Neovim. */
function putFuel(...entries: string[]): void {
  mkdirSync(join(vehiclesDir(), SLUG), { recursive: true })
  writeFileSync(fuelPath(), ['schema_version = 1', ...entries, ''].join('\n'))
}

function entryText(
  id: string,
  date: string,
  odometer: number,
  litres: string,
  full: boolean,
  extra = ''
): string {
  return [
    '',
    '[[entry]]',
    `id = "${id}"`,
    `date = ${date}`,
    `odometer_km = ${odometer}`,
    `litres = ${litres}`,
    'price_per_litre = 73.380',
    `full_tank = ${full ? 'true' : 'false'}`,
    'fuel_type = "Kurşunsuz 95"',
    ...(extra.length > 0 ? [extra] : [])
  ].join('\n')
}

async function openFuelTab(): Promise<Page> {
  const shell = await windowWith(app, 'tab-fuel')
  await shell.getByTestId('tab-fuel').click()
  await expect(shell.getByTestId('fuel-list')).toBeVisible()
  return shell
}

function fuelDocument(): Record<string, unknown> {
  return parse(readFileSync(fuelPath(), 'utf8')) as Record<string, unknown>
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-fuel-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  putVehicle()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('a fill-up typed into quick-add lands on disk and in the shell', async () => {
  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  await shell.getByTestId('fuel-quick-add').click()
  const form = await windowWith(app, 'fuel-save')

  // §5.1 — three fields, and nothing else asked.
  await form.getByTestId('fuel-odometer_km').fill('19500')
  await form.getByTestId('fuel-litres').fill('30')
  await form.getByTestId('fuel-price_per_litre').fill('73,380')

  // The total is derived and shown live while it can still be corrected.
  await expect(form.getByTestId('fuel-total-preview')).toHaveText('2.201,40 ₺')

  // The defaults it applies without asking are said out loud on the form.
  await expect(form.getByTestId('fuel-defaults-note')).toContainText('Kurşunsuz 95')

  await form.getByTestId('fuel-save').click()

  await expect(() => {
    expect(readdirSync(join(vehiclesDir(), SLUG))).toContain('fuel.toml')
  }).toPass({ timeout: 5_000 })

  const text = readFileSync(fuelPath(), 'utf8')
  const document = fuelDocument()
  const entries = document['entry'] as Record<string, unknown>[]

  expect(entries).toHaveLength(1)
  expect(entries[0]?.['id']).toBe('f-0001')
  expect(entries[0]?.['odometer_km']).toBe(19_500)
  expect(entries[0]?.['litres']).toBe(30)
  expect(entries[0]?.['price_per_litre']).toBe(73.38)
  expect(entries[0]?.['full_tank']).toBe(true)
  expect(entries[0]?.['fuel_type']).toBe('Kurşunsuz 95')

  // The figures are written as they were entered, at the field's decimals.
  expect(text).toContain('litres = 30.000')
  expect(text).toContain('price_per_litre = 73.380')

  // XTRITIUM §4.4 — total is DERIVED, never stored.
  expect(text).not.toContain('total')

  // And the shell has it without anyone restarting anything: the write
  // broadcasts, which is the whole reason F4 added the broadcast.
  await expect(shell.getByTestId('fuel-row-f-0001')).toBeVisible()
  await expect(shell.getByTestId('fuel-total-f-0001')).toHaveText('2.201,40 ₺')
})

test('consumption appears at the second full tank and not the first', async () => {
  // 30 l over 500 km — 6,00 l/100km, worked by hand.
  putFuel(entryText('f-0001', '2026-08-01', 19_000, '40.000', true))

  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  // The first entry stands alone: nothing to measure it against (§5.2).
  await expect(shell.getByTestId('fuel-consumption-f-0001')).toHaveText('')

  await shell.getByTestId('fuel-quick-add').click()
  const form = await windowWith(app, 'fuel-save')
  await form.getByTestId('fuel-odometer_km').fill('19500')
  await form.getByTestId('fuel-litres').fill('30')
  await form.getByTestId('fuel-price_per_litre').fill('73,380')
  await form.getByTestId('fuel-save').click()

  await expect(shell.getByTestId('fuel-consumption-f-0002')).toHaveText('6,00')
  await expect(shell.getByTestId('fuel-consumption-f-0001')).toHaveText('')
})

test('a partial fill is counted into the full tank that follows it', async () => {
  // 30 + 10 = 40 l over 500 km — 8,00 l/100km, not 6,00.
  putFuel(
    entryText('f-0001', '2026-08-01', 19_000, '40.000', true),
    entryText('f-0002', '2026-08-05', 19_200, '10.000', false),
    entryText('f-0003', '2026-08-09', 19_500, '30.000', true)
  )

  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  await expect(shell.getByTestId('fuel-consumption-f-0003')).toHaveText('8,00')
  await expect(shell.getByTestId('fuel-consumption-f-0002')).toHaveText('')
})

test('the full form reopens a fill-up with every figure identical', async () => {
  putFuel(entryText('f-0001', '2026-08-16', 19_764, '29.990', true))

  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  await shell.getByTestId('fuel-edit-f-0001').click()
  const form = await windowWith(app, 'fuel-save')

  // The other entry path is a real window too, and anchored to nothing (§5.1).
  expect(app.windows().length).toBe(2)
  const shapes = await app.evaluate(async ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((window) => ({
      parented: window.getParentWindow() !== null,
      movable: window.isMovable()
    }))
  )
  expect(shapes.every((shape) => !shape.parented && shape.movable)).toBe(true)

  // Text to scaled integer to TOML and back — where a separator read the wrong
  // way round would finally show.
  await expect(form.getByTestId('fuel-date')).toHaveValue('16/08/2026')
  await expect(form.getByTestId('fuel-odometer_km')).toHaveValue('19764')
  await expect(form.getByTestId('fuel-litres')).toHaveValue('29,990')
  await expect(form.getByTestId('fuel-price_per_litre')).toHaveValue('73,380')
  await expect(form.getByTestId('fuel-fuel_type')).toHaveValue('Kurşunsuz 95')
  await expect(form.getByTestId('fuel-full_tank')).toBeChecked()

  // An edit replaces the entry in place: same id, same one entry.
  await form.getByTestId('fuel-litres').fill('31,500')
  await form.getByTestId('fuel-full_tank').uncheck()
  await form.getByTestId('fuel-save').click()

  await expect(() => {
    expect(readFileSync(fuelPath(), 'utf8')).toContain('litres = 31.500')
  }).toPass({ timeout: 5_000 })

  const entries = fuelDocument()['entry'] as Record<string, unknown>[]
  expect(entries).toHaveLength(1)
  expect(entries[0]?.['id']).toBe('f-0001')
  expect(entries[0]?.['full_tank']).toBe(false)
})

test('a total written into the file by hand is dropped on the next save', async () => {
  // §4.4 lists total as a key TRITIUM recognises precisely so that it is not
  // carried: litres × price is derived, and a stored copy could disagree.
  putFuel(entryText('f-0001', '2026-08-16', 19_764, '29.990', true, 'total = 999.00'))
  expect(readFileSync(fuelPath(), 'utf8')).toContain('total = 999.00')

  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  await shell.getByTestId('fuel-edit-f-0001').click()
  const form = await windowWith(app, 'fuel-save')
  await form.getByTestId('fuel-litres').fill('30,000')
  await form.getByTestId('fuel-save').click()

  await expect(() => {
    expect(readFileSync(fuelPath(), 'utf8')).toContain('litres = 30.000')
  }).toPass({ timeout: 5_000 })

  expect(readFileSync(fuelPath(), 'utf8')).not.toContain('total')
})

test('a backwards odometer warns, and is then accepted', async () => {
  putFuel(entryText('f-0001', '2026-08-01', 19_000, '40.000', true))

  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  await shell.getByTestId('fuel-quick-add').click()
  const form = await windowWith(app, 'fuel-save')

  // §5.1 — the previous reading is shown as a hint.
  await expect(form.getByTestId('fuel-odometer-hint')).toContainText('19.000')

  await form.getByTestId('fuel-odometer_km').fill('18000')
  await form.getByTestId('fuel-litres').fill('20')
  await form.getByTestId('fuel-price_per_litre').fill('73,380')

  // Warned, and still saveable: typos in old entries must be fixable, and the
  // maker's word is final (§3.8).
  await expect(form.getByTestId('fuel-odometer-warning')).toBeVisible()
  await expect(form.getByTestId('fuel-save')).toBeEnabled()
  await form.getByTestId('fuel-save').click()

  await expect(() => {
    expect(readFileSync(fuelPath(), 'utf8')).toContain('odometer_km = 18000')
  }).toPass({ timeout: 5_000 })
})

test('quick-add is a separate window, anchored to nothing', async () => {
  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  expect(app.windows().length).toBe(1)
  await shell.getByTestId('fuel-quick-add').click()
  await windowWith(app, 'fuel-save')
  expect(app.windows().length).toBe(2)

  // XTRITIUM §5.1 — real separate Electron windows, draggable outside the main
  // one. A parent would anchor it; the entry forms have none.
  const shapes = await app.evaluate(async ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((window) => ({
      parented: window.getParentWindow() !== null,
      movable: window.isMovable()
    }))
  )
  expect(shapes).toHaveLength(2)
  expect(shapes.every((shape) => !shape.parented)).toBe(true)
  expect(shapes.every((shape) => shape.movable)).toBe(true)

  // The renderer still cannot open one itself (§3.5).
  const opened = await shell.evaluate(() => window.open('https://example.com') !== null)
  expect(opened).toBe(false)
  expect(app.windows().length).toBe(2)
})

test('an empty app is the same layout, holding nothing', async () => {
  // §7 — no "get started" screens. The list is there with its headings and no
  // rows, beside the buttons that fill it.
  rmSync(vehiclesDir(), { recursive: true, force: true })

  app = await launchApp(dataDir)
  const shell = await openFuelTab()

  await expect(shell.getByTestId('fuel-list')).toBeVisible()
  await expect(shell.getByTestId('fuel-quick-add')).toBeDisabled()
  await expect(shell.getByTestId('fuel-full-add')).toBeDisabled()
})
