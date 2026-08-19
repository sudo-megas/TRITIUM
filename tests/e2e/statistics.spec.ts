// F10 — the Statistics section of XTRITIUM §7.3, driven through the real app.
//
// The history is the one tests/unit/statistics.test.ts works by hand:
//   01/01/2026  10.000 km  100 l @ 10,000  = 1.000,00
//   01/04/2026  19.000 km  100 l @ 10,000  = 1.000,00
// Ninety days, nine thousand kilometres, two thousand lira — and a purchase
// price of 2.160.000,00 on the vehicle record.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')

function seedHistory(days: 'ninety' | 'short'): void {
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
      'purchase_price = 2160000.00',
      ''
    ].join('\n')
  )

  const fill = (id: string, date: string, odometer: number) =>
    [
      '',
      '[[entry]]',
      `id = "${id}"`,
      `date = ${date}`,
      `odometer_km = ${odometer}`,
      'litres = 100.000',
      'price_per_litre = 10.000',
      'full_tank = true',
      'fuel_type = "Kurşunsuz 95"'
    ].join('\n')

  // 58 days is below the sixty a projection is allowed to run on.
  const second = days === 'ninety' ? '2026-04-01' : '2026-02-28'

  writeFileSync(
    join(dir, 'fuel.toml'),
    ['schema_version = 1', fill('f-0001', '2026-01-01', 10_000), fill('f-0002', second, 19_000), ''].join(
      '\n'
    )
  )
}

async function openStatistics(): Promise<Page> {
  const shell = await windowWith(app, 'tab-statistics')
  await shell.getByTestId('tab-statistics').click()
  await expect(shell.getByTestId('stat-best')).toBeVisible()
  return shell
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-stats-')
  seedSettings(dataDir, { activeVehicle: SLUG })
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('all four figures §7.3 names are on the page', async () => {
  seedHistory('ninety')
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  for (const stat of [
    'stat-best',
    'stat-worst',
    'stat-km-per-day',
    'stat-projection',
    'stat-running-cost',
    'stat-true-cost'
  ]) {
    await expect(shell.getByTestId(stat)).toBeVisible()
  }
})

test('the figures agree with the arithmetic', async () => {
  seedHistory('ninety')
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  // 100 l over 9.000 km = 1,11 l/100km — one interval, so best and worst agree.
  await expect(shell.getByTestId('stat-best-value')).toHaveText('1,11')
  await expect(shell.getByTestId('stat-worst-value')).toHaveText('1,11')
  await expect(shell.getByTestId('stat-single-interval')).toBeVisible()

  // 9.000 km over 90 days.
  await expect(shell.getByTestId('stat-km-per-day-value')).toHaveText('100,00')

  // 2.000,00 × 365 ÷ 90.
  await expect(shell.getByTestId('stat-projection-value')).toHaveText('8.111,11 ₺')

  // 2.000,00 ÷ 9.000 km, then the same with 2.160.000,00 added.
  await expect(shell.getByTestId('stat-running-cost-value')).toHaveText('0,222')
  await expect(shell.getByTestId('stat-true-cost-value')).toHaveText('240,222')
})

test('every figure states the window it was computed over', async () => {
  seedHistory('ninety')
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  // A statistic without its span is a number without units (F10.md decision 1).
  await expect(shell.getByTestId('stat-km-per-day-window')).toContainText('01/01/2026')
  await expect(shell.getByTestId('stat-km-per-day-window')).toContainText('90')
  await expect(shell.getByTestId('stat-projection-window')).toContainText('01/04/2026')
})

test('the projection refuses below sixty days and says how short it is', async () => {
  seedHistory('short')
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  // 58 days. Two fill-ups a fortnight apart would otherwise project a
  // five-figure annual cost off an accident with a multiplier.
  await expect(shell.getByTestId('stat-projection-value')).toHaveCount(0)
  await expect(shell.getByTestId('stat-projection-missing')).toContainText('58')
  await expect(shell.getByTestId('stat-projection-missing')).toContainText('60')

  // The figures that do not depend on the span are still there.
  await expect(shell.getByTestId('stat-running-cost-value')).toBeVisible()
})

test('the purchase price appears in the true-cost figure and nowhere else', async () => {
  seedHistory('ninety')
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  await expect(shell.getByTestId('stat-true-cost-detail')).toContainText('2.160.000,00')

  // F9's lifetime totals leave it out on purpose — the Summary must not have
  // grown it while nobody was looking.
  await shell.getByTestId('tab-summary').click()
  await expect(shell.getByTestId('summary-total-spend')).toHaveText('2.000,00 ₺')
})

test('a vehicle with too little data shows reasons, never zeroes', async () => {
  // §3.3 — zero kilometres and no record of driving are different claims.
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  for (const stat of ['stat-best', 'stat-worst', 'stat-km-per-day', 'stat-true-cost']) {
    await expect(shell.getByTestId(`${stat}-missing`)).toBeVisible()
    await expect(shell.getByTestId(`${stat}-value`)).toHaveCount(0)
  }

  await expect(shell.getByTestId('stat-best-missing')).toContainText('full tanks')
})

test('the statistics offer no control, and no way to filter a lifetime figure', async () => {
  // F10.md decision 8 — a statistic filtered to "this month" is a different
  // statistic wearing the same label, so F7's chips are not on this tab.
  seedHistory('ninety')
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  const controls = await shell.locator('.panes button, .panes input, .panes select').count()
  expect(controls).toBe(0)
  await expect(shell.getByTestId('range-chips')).toHaveCount(0)

  expect(await shell.locator('a').count()).toBe(0)
})

test('nothing on the page creates or suggests a future entry', async () => {
  seedHistory('ninety')
  app = await launchApp(dataDir)
  const shell = await openStatistics()

  // The projection is one aggregate number and says so beside itself.
  await expect(shell.getByTestId('stat-projection-detail')).toContainText('no entry is created')

  // And the files are untouched by looking at them.
  const before = await shell.evaluate(() => window.tritium.loadVehicle('sportage'))
  await shell.getByTestId('tab-summary').click()
  await shell.getByTestId('tab-statistics').click()
  const after = await shell.evaluate(() => window.tritium.loadVehicle('sportage'))
  expect(JSON.stringify(after)).toBe(JSON.stringify(before))
})
