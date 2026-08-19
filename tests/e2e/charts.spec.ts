// F8 — the seven charts of XTRITIUM §7.2, driven through the real app.
//
// The history on disk is the one tests/unit/series.test.ts works by hand, so a
// figure read off the data table here can be checked against arithmetic there.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const CHARTS = [
  'consumption',
  'monthlyCosts',
  'gasPrice',
  'fillupCosts',
  'odometer',
  'costPerKm',
  'monthlyDistance'
]

const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')

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
      ''
    ].join('\n')
  )

  const fill = (id: string, date: string, odometer: number, litres: string, full: boolean) =>
    [
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

  writeFileSync(
    join(dir, 'fuel.toml'),
    [
      'schema_version = 1',
      fill('f-0001', '2026-01-10', 19_000, '40.000', true),
      fill('f-0002', '2026-02-05', 19_200, '15.000', false),
      fill('f-0003', '2026-03-10', 19_500, '30.000', true),
      ''
    ].join('\n')
  )

  const money = (id: string, date: string, amount: string, income: boolean) =>
    [
      '',
      '[[entry]]',
      `id = "${id}"`,
      `date = ${date}`,
      'group = "tekrar-eden"',
      'category = "kasko"',
      'title = "Kasko"',
      `amount = ${amount}`,
      `income = ${income ? 'true' : 'false'}`,
      'payment_method = "kredi-karti"',
      'bank = "Enpara"',
      'instalment = ""',
      'note = ""'
    ].join('\n')

  writeFileSync(
    join(dir, 'costs.toml'),
    [
      'schema_version = 1',
      money('c-0001', '2026-01-15', '1000.00', false),
      money('c-0002', '2026-01-20', '400.00', true),
      ''
    ].join('\n')
  )

  writeFileSync(
    join(dir, 'service.toml'),
    [
      'schema_version = 1',
      '',
      '[[entry]]',
      'id = "s-0001"',
      'date = 2026-03-01',
      'part = "SERVİS"',
      'odometer_km = 19400',
      'amount = 500.00',
      'vendor = ""',
      ''
    ].join('\n')
  )
}

async function openCharts(): Promise<Page> {
  const shell = await windowWith(app, 'tab-charts')
  await shell.getByTestId('tab-charts').click()
  await expect(shell.getByTestId('chart-consumption')).toBeVisible()
  return shell
}

/** The plot's own pixels, so a repaint can be told from a redraw of the same. */
async function canvasData(shell: Page, id: string): Promise<string> {
  return shell.evaluate((chart) => {
    const host = document.querySelector(`[data-testid="chart-${chart}-canvas"] canvas`)
    return host instanceof HTMLCanvasElement ? host.toDataURL() : ''
  }, id)
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-charts-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  seedHistory()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('all seven charts of §7.2 exist and draw', async () => {
  app = await launchApp(dataDir)
  const shell = await openCharts()

  for (const id of CHARTS) {
    await expect(shell.getByTestId(`chart-${id}`)).toBeVisible()
    await expect(shell.getByTestId(`chart-${id}-canvas`)).toBeVisible()
  }

  // Seven, not six and not eight.
  expect(await shell.locator('.chart').count()).toBe(7)

  // Every one of them drew something onto its canvas.
  const drawn = await canvasData(shell, 'consumption')
  expect(drawn.startsWith('data:image/png')).toBe(true)
})

test('the monthly figures agree with the arithmetic', async () => {
  app = await launchApp(dataDir)
  const shell = await openCharts()

  // Jan: 2.935,20 fuel + 1.000,00 cost − 400,00 income = 3.535,20
  await expect(shell.getByTestId('chart-monthlyCosts-row-2026-01')).toContainText('3.535,20')
  await expect(shell.getByTestId('chart-monthlyCosts-row-2026-03')).toContainText('2.701,40')

  // February moved 200 km, and the table says between which two readings.
  await expect(shell.getByTestId('chart-monthlyDistance-row-2026-02')).toContainText('200')
  await expect(shell.getByTestId('chart-monthlyDistance-row-2026-02')).toContainText('10/01/2026')

  // January has spend and no measured distance, so it has no cost-per-km point.
  await expect(shell.getByTestId('chart-costPerKm-row-2026-02')).toContainText('5,504')
  await expect(shell.getByTestId('chart-costPerKm-row-2026-01')).toHaveCount(0)
})

test('each chart carries its own chips, and they change what is plotted', async () => {
  app = await launchApp(dataDir)
  const shell = await openCharts()

  // §7.2 gives the chips to EACH chart — seven rows of them, one per chart.
  expect(await shell.getByTestId('range-chips').count()).toBe(7)

  await expect(shell.getByTestId('chart-monthlyCosts-row-2026-01')).toBeVisible()

  // Narrow only this chart, and only this chart changes.
  const card = shell.getByTestId('chart-monthlyCosts')
  await card.getByTestId('range-custom').click()
  await card.getByTestId('range-from').fill('01/03/2026')
  await card.getByTestId('range-to').fill('31/03/2026')

  await expect(shell.getByTestId('chart-monthlyCosts-row-2026-01')).toHaveCount(0)
  await expect(shell.getByTestId('chart-monthlyCosts-row-2026-03')).toBeVisible()

  // The neighbouring chart still shows February — its own chips were untouched.
  await expect(shell.getByTestId('chart-monthlyDistance-row-2026-02')).toBeVisible()
})

test('a palette switch re-colours the charts', async () => {
  app = await launchApp(dataDir)
  const shell = await openCharts()

  const before = await canvasData(shell, 'monthlyCosts')

  await shell.getByTestId('tab-settings').click()
  await shell.getByTestId('swatch-catppuccin-latte').click()
  await shell.getByTestId('tab-charts').click()
  await expect(shell.getByTestId('chart-monthlyCosts-canvas')).toBeVisible()

  // The charts never held a colour of their own — they read the cascade — so a
  // palette switch repaints them (§8, F8.md decision 3).
  await expect(async () => {
    expect(await canvasData(shell, 'monthlyCosts')).not.toBe(before)
  }).toPass({ timeout: 5_000 })
})

test('fullscreen replaces the grid rather than covering it', async () => {
  app = await launchApp(dataDir)
  const shell = await openCharts()

  expect(await shell.locator('.chart').count()).toBe(7)

  await shell.getByTestId('chart-gasPrice-full').click()

  // One chart, in normal flow — nothing painted over anything.
  expect(await shell.locator('.chart').count()).toBe(1)
  await expect(shell.getByTestId('chart-gasPrice')).toBeVisible()
  await expect(shell.getByTestId('chart-consumption')).toHaveCount(0)

  await shell.getByTestId('chart-gasPrice-full').click()
  expect(await shell.locator('.chart').count()).toBe(7)
})

test('the line / area / smooth toggle belongs to the chart, not to the file', async () => {
  app = await launchApp(dataDir)
  const shell = await openCharts()

  await expect(shell.getByTestId('chart-gasPrice-line')).toHaveAttribute('aria-pressed', 'true')

  await shell.getByTestId('chart-gasPrice-smooth').click()
  await expect(shell.getByTestId('chart-gasPrice-smooth')).toHaveAttribute('aria-pressed', 'true')
  await expect(shell.getByTestId('chart-gasPrice-line')).toHaveAttribute('aria-pressed', 'false')

  // A bar chart has no such toggle: §7.2 gives it to the line charts.
  await expect(shell.getByTestId('chart-monthlyCosts-line')).toHaveCount(0)

  // And nothing about it reaches settings.toml (F8.md decision 11).
  const settings = shell.evaluate(() => window.tritium.readSettings())
  expect(JSON.stringify(await settings)).not.toContain('smooth')
})

test('the charts hold no link, and the app still opens nothing', async () => {
  app = await launchApp(dataDir)
  const shell = await openCharts()

  expect(await shell.locator('a').count()).toBe(0)

  const opened = await shell.evaluate(() => window.open('https://example.com') !== null)
  expect(opened).toBe(false)
})

test('an app with no records shows the charts empty rather than absent', async () => {
  // §7 — no "get started" screens. The seven are present and say they are empty.
  rmSync(vehiclesDir(), { recursive: true, force: true })

  app = await launchApp(dataDir)
  const shell = await openCharts()

  expect(await shell.locator('.chart').count()).toBe(7)
  await expect(shell.getByTestId('chart-monthlyCosts-table-empty')).toBeVisible()
})
