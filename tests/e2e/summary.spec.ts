// F9 — the Summary page of XTRITIUM §7.1, driven through the real app.
//
// The fuel history is the one tests/unit/summary.test.ts works by hand, chosen
// so the right average (5,56) and the wrong one (6,00) are far enough apart to
// tell from a screen:
//
//   19.000 -> 19.400   40 l over 400 km   = 10,00 l/100km
//   19.400 -> 19.900   10 l over 500 km   =  2,00 l/100km
//
// The two monthly costs are dated relative to the day the suite runs, because
// "this month vs previous month" is a question about today.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')

/** `YYYY-MM-15` for this month and the one before, from the local calendar. */
function monthlyDates(): { thisMonth: string; previousMonth: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const previousYear = month === 1 ? year - 1 : year
  const previous = month === 1 ? 12 : month - 1

  const pad = (value: number): string => value.toString().padStart(2, '0')
  return {
    thisMonth: `${year}-${pad(month)}-15`,
    previousMonth: `${previousYear}-${pad(previous)}-15`
  }
}

function seedHistory(): void {
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
      // On the record and NOT in any figure on this page (F9.md decision 4).
      'purchase_price = 2160000.00',
      ''
    ].join('\n')
  )

  const fill = (id: string, date: string, odometer: number, litres: string) =>
    [
      '',
      '[[entry]]',
      `id = "${id}"`,
      `date = ${date}`,
      `odometer_km = ${odometer}`,
      `litres = ${litres}`,
      'price_per_litre = 73.380',
      'full_tank = true',
      'fuel_type = "Kurşunsuz 95"'
    ].join('\n')

  writeFileSync(
    join(dir, 'fuel.toml'),
    [
      'schema_version = 1',
      fill('f-0001', '2026-01-10', 19_000, '30.000'),
      fill('f-0002', '2026-02-10', 19_400, '40.000'),
      fill('f-0003', '2026-03-10', 19_900, '10.000'),
      ''
    ].join('\n')
  )

  const { thisMonth, previousMonth } = monthlyDates()
  const money = (id: string, date: string, amount: string) =>
    [
      '',
      '[[entry]]',
      `id = "${id}"`,
      `date = ${date}`,
      'group = "tekrar-eden"',
      'category = "kasko"',
      'title = "Kasko 26/27"',
      `amount = ${amount}`,
      'income = false',
      'payment_method = "kredi-karti"',
      'bank = "Enpara"',
      'instalment = ""',
      'note = ""'
    ].join('\n')

  writeFileSync(
    join(dir, 'costs.toml'),
    [
      'schema_version = 1',
      money('c-0001', thisMonth, '1000.00'),
      money('c-0002', previousMonth, '400.00'),
      ''
    ].join('\n')
  )
}

async function openSummary(): Promise<Page> {
  const shell = await windowWith(app, 'tab-summary')
  await shell.getByTestId('tab-summary').click()
  await expect(shell.getByTestId('summary-header')).toBeVisible()
  return shell
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-summary-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  seedHistory()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('every block §7.1 settled is on the page', async () => {
  app = await launchApp(dataDir)
  const shell = await openSummary()

  for (const block of [
    'summary-header',
    'summary-gas',
    'summary-costs',
    'summary-trends',
    'summary-recent',
    'summary-lifetime'
  ]) {
    await expect(shell.getByTestId(block)).toBeVisible()
  }
})

test('the vehicle header carries the name and the odometer, and no photo', async () => {
  app = await launchApp(dataDir)
  const shell = await openSummary()

  await expect(shell.getByTestId('summary-name')).toHaveText('SPORTAGE 1.6 T-GDI')
  await expect(shell.getByTestId('summary-odometer')).toHaveText('19.900 km')

  // §4.4 — vehicles have no photos anywhere in TRITIUM, so there is no image
  // on this page but the application's own mark in the tab bar.
  expect(await shell.locator('img').count()).toBe(1)
  await expect(shell.locator('img')).toHaveAttribute('data-testid', 'mark-icon')
})

test('the average is the ratio of the sums, not the mean of the ratios', async () => {
  app = await launchApp(dataDir)
  const shell = await openSummary()

  // 50 l over 900 km = 5,56 l/100km. Averaging the column would say 6,00.
  await expect(shell.getByTestId('summary-average')).toHaveText('5,56')
  await expect(shell.getByTestId('summary-average')).not.toHaveText('6,00')

  await expect(shell.getByTestId('summary-last-consumption')).toHaveText('2,00')
  await expect(shell.getByTestId('summary-last-price')).toContainText('73,380')
  await expect(shell.getByTestId('summary-last-price')).toContainText('10/03/2026')
})

test('the costs card compares two months and says which spans', async () => {
  app = await launchApp(dataDir)
  const shell = await openSummary()

  await expect(shell.getByTestId('summary-this-month')).toHaveText('1.000,00 ₺')
  await expect(shell.getByTestId('summary-previous-month')).toHaveText('400,00 ₺')

  // On the third of the month the comparison is three days against thirty-one,
  // so the card prints both spans rather than implying two whole months.
  await expect(shell.getByTestId('summary-costs-span')).toContainText('/')
})

test('the lifetime totals exclude the purchase price', async () => {
  app = await launchApp(dataDir)
  const shell = await openSummary()

  // 30 + 40 + 10 litres at 73,380 = 5.870,40, plus 1.400,00 of costs.
  await expect(shell.getByTestId('summary-total-spend')).toHaveText('7.270,40 ₺')
  await expect(shell.getByTestId('summary-total-distance')).toHaveText('900 km')
  await expect(shell.getByTestId('summary-total-litres')).toHaveText('80,000')

  // 2.160.000,00 is on the vehicle record and is §7.3's business, not this
  // page's (F9.md decision 4). If it ever leaks in, this fails loudly.
  await expect(shell.getByTestId('summary-total-spend')).not.toContainText('2.16')
})

test('the trend cards are a static grid, all visible at once', async () => {
  app = await launchApp(dataDir)
  const shell = await openSummary()

  // §7.1 rules out a carousel by name. All four are on screen together and
  // there is no control that could hide one.
  for (const card of ['trend-spend', 'trend-distance', 'trend-cost-per-km', 'trend-fillups']) {
    await expect(shell.getByTestId(card)).toBeVisible()
  }

  await expect(shell.getByTestId('trend-spend-value')).toHaveText('1.000,00 ₺')
  await expect(shell.getByTestId('trend-spend-change')).toContainText('400,00')

  expect(await shell.getByTestId('summary-trends').locator('button').count()).toBe(0)
})

test('the last entries are one list across all three files', async () => {
  app = await launchApp(dataDir)
  const shell = await openSummary()

  await expect(shell.getByTestId('summary-recent-c-0001')).toBeVisible()
  await expect(shell.getByTestId('summary-recent-f-0003')).toBeVisible()
  await expect(shell.getByTestId('summary-recent-c-0001')).toContainText('Kasko 26/27')
})

test('the summary offers no way to change anything', async () => {
  // F9.md decision 10 — the page is read-only. Adding a record is what the
  // FUEL, COSTS and SERVICE tabs are for.
  app = await launchApp(dataDir)
  const shell = await openSummary()

  const controls = await shell.locator('.panes button, .panes input, .panes select').count()
  expect(controls).toBe(0)

  expect(await shell.locator('a').count()).toBe(0)
})

test('a vehicle with no records shows every card, empty', async () => {
  // §7 — no "get started" screens. The cards are present with their labels and
  // say they have nothing.
  rmSync(vehiclesDir(), { recursive: true, force: true })

  app = await launchApp(dataDir)
  const shell = await openSummary()

  await expect(shell.getByTestId('summary-gas')).toBeVisible()
  await expect(shell.getByTestId('summary-lifetime')).toBeVisible()
  await expect(shell.getByTestId('summary-average')).toHaveText('—')
  await expect(shell.getByTestId('summary-total-distance')).toHaveText('0 km')
  await expect(shell.getByTestId('summary-recent-empty')).toBeVisible()
})
