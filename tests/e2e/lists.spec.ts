// F7 — the dense lists, the §7.2 chips, the detail region and removal.
//
// The chips that are relative to today (YTD, this month, previous month) have
// their arithmetic pinned exhaustively in tests/unit/range.test.ts against a
// fixed date. What is exercised here is the wiring, and the filtering
// assertions use the CUSTOM range so they say the same thing on every day the
// suite is ever run.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'

const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')
const fuelPath = (): string => join(vehiclesDir(), SLUG, 'fuel.toml')
const costsPath = (): string => join(vehiclesDir(), SLUG, 'costs.toml')

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

function fuelEntry(
  id: string,
  date: string,
  odometer: number,
  litres: string,
  full: boolean
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
    'fuel_type = "Kurşunsuz 95"'
  ].join('\n')
}

function costEntry(id: string, date: string, category: string, amount: string): string {
  return [
    '',
    '[[entry]]',
    `id = "${id}"`,
    `date = ${date}`,
    'group = "tekrar-eden"',
    `category = "${category}"`,
    `title = "${category}"`,
    `amount = ${amount}`,
    'income = false',
    'payment_method = "kredi-karti"',
    'bank = "Enpara"',
    'instalment = ""',
    'note = ""'
  ].join('\n')
}

function put(path: string, ...entries: string[]): void {
  mkdirSync(join(vehiclesDir(), SLUG), { recursive: true })
  writeFileSync(path, ['schema_version = 1', ...entries, ''].join('\n'))
}

/*
 * The history from tests/unit/range.test.ts, on disk: 40 l full in January,
 * 15 l partial in February, 30 l full in March. Over 500 km that is
 * (30 + 15) ÷ 500 × 100 = 9,00 l/100km at the March entry.
 */
function putFuelHistory(): void {
  put(
    fuelPath(),
    fuelEntry('f-0001', '2026-01-10', 19_000, '40.000', true),
    fuelEntry('f-0002', '2026-02-05', 19_200, '15.000', false),
    fuelEntry('f-0003', '2026-03-10', 19_500, '30.000', true)
  )
}

function costEntries(): Record<string, unknown>[] {
  const document = parse(readFileSync(costsPath(), 'utf8')) as Record<string, unknown>
  return document['entry'] as Record<string, unknown>[]
}

async function openTab(name: string): Promise<Page> {
  const shell = await windowWith(app, `tab-${name}`)
  await shell.getByTestId(`tab-${name}`).click()
  return shell
}

/** Choose the custom range and type both ends of it. */
async function customRange(shell: Page, from: string, to: string): Promise<void> {
  await shell.getByTestId('range-custom').click()
  await shell.getByTestId('range-from').fill(from)
  await shell.getByTestId('range-to').fill(to)
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-lists-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  putVehicle()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('the chips decide which rows are listed', async () => {
  putFuelHistory()

  app = await launchApp(dataDir)
  const shell = await openTab('fuel')

  // All time shows the lot, and is where a list starts.
  await expect(shell.getByTestId('range-all')).toHaveAttribute('aria-pressed', 'true')
  await expect(shell.getByTestId('fuel-row-f-0001')).toBeVisible()
  await expect(shell.getByTestId('fuel-row-f-0003')).toBeVisible()

  await customRange(shell, '01/03/2026', '31/03/2026')

  await expect(shell.getByTestId('fuel-row-f-0003')).toBeVisible()
  await expect(shell.getByTestId('fuel-row-f-0001')).toHaveCount(0)
  await expect(shell.getByTestId('fuel-row-f-0002')).toHaveCount(0)
})

test('a chip cannot change a consumption figure', async () => {
  // The claim F7 turns on. §5.2's figure is computed between consecutive full
  // tanks over the WHOLE history; the range decides what is shown and never
  // what is computed. Filtering first would silently drop this figure — see
  // tests/unit/range.test.ts, which pins that hazard directly.
  putFuelHistory()

  app = await launchApp(dataDir)
  const shell = await openTab('fuel')

  await expect(shell.getByTestId('fuel-consumption-f-0003')).toHaveText('9,00')

  // March alone hides both the full tank it was measured against and the
  // partial fill counted into it. The figure must not move.
  await customRange(shell, '01/03/2026', '31/03/2026')

  await expect(shell.getByTestId('fuel-row-f-0001')).toHaveCount(0)
  await expect(shell.getByTestId('fuel-consumption-f-0003')).toHaveText('9,00')
})

test('an empty range is the same table, holding nothing', async () => {
  putFuelHistory()

  app = await launchApp(dataDir)
  const shell = await openTab('fuel')

  await customRange(shell, '01/01/2020', '31/01/2020')

  // §7 — the headers and the columns stay exactly where a filled list puts them.
  await expect(shell.getByTestId('fuel-list')).toBeVisible()
  await expect(shell.getByTestId('fuel-empty')).toBeVisible()
  await expect(shell.getByTestId('fuel-sort-odometer_km')).toBeVisible()
})

test('a half-typed custom bound does not empty the list', async () => {
  putFuelHistory()

  app = await launchApp(dataDir)
  const shell = await openTab('fuel')

  await shell.getByTestId('range-custom').click()
  await shell.getByTestId('range-from').fill('01/03/20')

  // Still three rows: an unreadable bound is not applied, because emptying the
  // list mid-keystroke would look like data loss (§3.8).
  await expect(shell.getByTestId('fuel-row-f-0001')).toBeVisible()
  await expect(shell.getByTestId('fuel-row-f-0003')).toBeVisible()
})

test('selecting a row fills the detail region', async () => {
  putFuelHistory()

  app = await launchApp(dataDir)
  const shell = await openTab('fuel')

  // Nothing selected is the empty layout, not an invitation (§7).
  await expect(shell.getByTestId('fuel-detail-none')).toBeVisible()

  await shell.getByTestId('fuel-row-f-0003').click()

  // Every field of §4.4, including the ones the dense table has no room for.
  await expect(shell.getByTestId('fuel-detail-value-price_per_litre')).toHaveText('73,380')
  await expect(shell.getByTestId('fuel-detail-value-full_tank')).toHaveText('Full')
  await expect(shell.getByTestId('fuel-detail-value-fuel_type')).toHaveText('Kurşunsuz 95')
  await expect(shell.getByTestId('fuel-detail-value-consumption')).toHaveText('9,00')
})

test('sorting by a column reorders the rows', async () => {
  putFuelHistory()

  app = await launchApp(dataDir)
  const shell = await openTab('fuel')

  const ids = async (): Promise<(string | null)[]> =>
    shell
      .getByTestId('fuel-list')
      .locator('tbody tr')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))

  // The default is odometer descending — §5.2 orders by odometer, and the list
  // must not disagree with the engine.
  expect(await ids()).toEqual(['fuel-row-f-0003', 'fuel-row-f-0002', 'fuel-row-f-0001'])

  await shell.getByTestId('fuel-sort-odometer_km').click()
  expect(await ids()).toEqual(['fuel-row-f-0001', 'fuel-row-f-0002', 'fuel-row-f-0003'])
})

test('deleting asks twice, and can be called off', async () => {
  put(costsPath(), costEntry('c-0001', '2026-04-11', 'kasko', '19528.40'))

  app = await launchApp(dataDir)
  const shell = await openTab('costs')

  await shell.getByTestId('cost-row-c-0001').click()
  await shell.getByTestId('cost-detail-delete').click()

  // The question is asked in the flow, beside the record — never over it.
  await expect(shell.getByTestId('cost-detail-delete-confirm')).toBeVisible()
  await expect(shell.getByTestId('cost-detail-delete-warning')).toBeVisible()

  await shell.getByTestId('cost-detail-delete-cancel').click()
  await expect(shell.getByTestId('cost-detail-delete-confirm')).toHaveCount(0)
  expect(costEntries()).toHaveLength(1)
})

test('deleting removes exactly one entry and renumbers nothing', async () => {
  put(
    costsPath(),
    costEntry('c-0001', '2025-04-22', 'kapora', '20000.00'),
    costEntry('c-0002', '2026-04-11', 'trafik-sigortasi', '11746.00'),
    costEntry('c-0003', '2026-04-11', 'kasko', '19528.40')
  )

  app = await launchApp(dataDir)
  const shell = await openTab('costs')

  await shell.getByTestId('cost-row-c-0002').click()
  await shell.getByTestId('cost-detail-delete').click()
  await shell.getByTestId('cost-detail-delete-confirm').click()

  await expect(() => {
    expect(costEntries()).toHaveLength(2)
  }).toPass({ timeout: 5_000 })

  // The middle one is gone; the two either side keep their ids and their
  // figures, and nothing was renumbered.
  const ids = costEntries().map((entry) => entry['id'])
  expect(ids).toEqual(['c-0001', 'c-0003'])
  expect(costEntries()[1]?.['amount']).toBe(19_528.4)

  // The shell agrees without a restart, and the detail region lets go.
  await expect(shell.getByTestId('cost-row-c-0002')).toHaveCount(0)
  await expect(shell.getByTestId('cost-detail-none')).toBeVisible()

  // And the next entry continues past the highest still present rather than
  // filling the hole.
  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')
  await form.getByTestId('cost-group').selectOption('tekrar-eden')
  await form.getByTestId('cost-category').selectOption('mtv-1')
  await form.getByTestId('cost-amount').fill('6014,00')
  await form.getByTestId('cost-save').click()

  await expect(() => {
    expect(costEntries()).toHaveLength(3)
  }).toPass({ timeout: 5_000 })
  expect(costEntries().map((entry) => entry['id'])).toEqual(['c-0001', 'c-0003', 'c-0004'])
})

test('a confirmation does not carry over to the next record selected', async () => {
  put(
    costsPath(),
    costEntry('c-0001', '2025-04-22', 'kapora', '20000.00'),
    costEntry('c-0002', '2026-04-11', 'kasko', '19528.40')
  )

  app = await launchApp(dataDir)
  const shell = await openTab('costs')

  await shell.getByTestId('cost-row-c-0002').click()
  await shell.getByTestId('cost-detail-delete').click()
  await expect(shell.getByTestId('cost-detail-delete-confirm')).toBeVisible()

  // Choosing another record must not leave a primed confirmation behind it: a
  // second click would otherwise land on something never meant to be deleted.
  await shell.getByTestId('cost-row-c-0001').click()
  await expect(shell.getByTestId('cost-detail-delete-confirm')).toHaveCount(0)
  await expect(shell.getByTestId('cost-detail-delete')).toBeVisible()
  expect(costEntries()).toHaveLength(2)
})

test('all three lists are the same table, with the same chips', async () => {
  putFuelHistory()
  put(costsPath(), costEntry('c-0001', '2026-04-11', 'kasko', '19528.40'))

  app = await launchApp(dataDir)

  for (const [tab, list] of [
    ['fuel', 'fuel-list'],
    ['costs', 'cost-list'],
    ['service', 'service-list']
  ]) {
    const shell = await openTab(tab as string)
    await expect(shell.getByTestId(list as string)).toBeVisible()
    await expect(shell.getByTestId('range-chips')).toBeVisible()
    await expect(shell.getByTestId('range-previous-month')).toBeVisible()
  }
})
