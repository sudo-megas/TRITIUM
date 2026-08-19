// The one thing a table of figures must never do (F7).
//
// F4's fuel pane put its table in `pane--wide` — the whole 1280 — with a
// comment saying why: eight columns of figures did not fit in half of it, they
// overflowed by about seventy pixels, and that put a horizontal scrollbar under
// the pane.
//
// F7 moved all three tables back into the LEFT HALF, because the right half is
// now the detail region. That is only safe because the dense tables carry four
// or five columns instead of eight, and the fields that do not fit went to the
// detail pane. "Only safe because" is a claim, and every cell in the table is
// `white-space: nowrap`, so a long Turkish title cannot wrap — it widens the
// table until the pane scrolls sideways.
//
// So the claim is measured rather than asserted, at exactly the 1280 × 720 the
// window will not shrink below (XTRITIUM §7), with the widest realistic data
// the maker's own sheets suggest.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'
const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')

/**
 * The widest plausible data, not the tidiest.
 *
 * A six-figure odometer, a seven-figure cost, the longest category label in
 * §6.1, a title carrying a year range AND an instalment note, and the tyre
 * description from the maker's own PERİYODİK BAKIM sheet.
 */
function seedWidest(): void {
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

  writeFileSync(
    join(dir, 'fuel.toml'),
    [
      'schema_version = 1',
      '',
      '[[entry]]',
      'id = "f-0001"',
      'date = 2026-01-10',
      'odometer_km = 198764',
      'litres = 54.999',
      'price_per_litre = 173.380',
      'full_tank = true',
      'fuel_type = "Kurşunsuz 95"',
      '',
      '[[entry]]',
      'id = "f-0002"',
      'date = 2026-03-10',
      'odometer_km = 199764',
      'litres = 54.999',
      'price_per_litre = 173.380',
      'full_tank = true',
      'fuel_type = "Kurşunsuz 95"',
      ''
    ].join('\n')
  )

  writeFileSync(
    join(dir, 'costs.toml'),
    [
      'schema_version = 1',
      '',
      '[[entry]]',
      'id = "c-0001"',
      'date = 2026-04-11',
      'group = "tekrar-eden"',
      'category = "trafik-sigortasi"',
      'title = "Trafik Sigortası 26/27 Sonradan Taksitlendirme"',
      'amount = 1211746.00',
      'income = false',
      'payment_method = "kredi-karti"',
      'bank = "Enpara"',
      'instalment = "Sonradan Taksitlendirme 6"',
      'note = ""',
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
      'date = 2025-05-14',
      'part = "Michelin Primacy 4 S1 235/50R19 103V XL"',
      'odometer_km = 198370',
      'amount = 128664.00',
      'vendor = "https://www.lastikcim.com.tr/lastik/4x4-suv-lastikleri/michelin"',
      ''
    ].join('\n')
  )
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-overflow-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  seedWidest()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

for (const tab of ['fuel', 'costs', 'service']) {
  test(`the ${tab} list does not scroll sideways at 1280 x 720`, async () => {
    app = await launchApp(dataDir)
    const shell = await windowWith(app, `tab-${tab}`)
    await shell.getByTestId(`tab-${tab}`).click()
    await expect(shell.getByTestId(`${tab === 'costs' ? 'cost' : tab}-list`)).toBeVisible()

    const measured = await shell.evaluate(() => {
      const body = document.body
      return {
        body: body.scrollWidth - body.clientWidth,
        panes: Array.from(document.querySelectorAll('.pane')).map(
          (pane) => pane.scrollWidth - pane.clientWidth
        )
      }
    })

    // The page itself never scrolls sideways.
    expect(measured.body).toBeLessThanOrEqual(0)

    // Nor does either pane — which is where the table actually lives, and where
    // F4 measured the overflow that sent it to the full width in the first place.
    expect(measured.panes.length).toBe(2)
    for (const overflow of measured.panes) {
      expect(overflow).toBeLessThanOrEqual(0)
    }
  })
}

for (const tab of ['summary', 'charts']) {
  test(`the ${tab} tab does not scroll sideways at 1280 x 720`, async () => {
    // Added when those tabs were built (F9, F8) rather than after they broke:
    // I-08 was found by measuring a claim that had only been reasoned about,
    // and every tab that holds figures gets the same measurement from now on.
    app = await launchApp(dataDir)
    const shell = await windowWith(app, `tab-${tab}`)
    await shell.getByTestId(`tab-${tab}`).click()
    await shell.waitForTimeout(300)

    const measured = await shell.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      panes: Array.from(document.querySelectorAll('.pane')).map(
        (pane) => pane.scrollWidth - pane.clientWidth
      )
    }))

    expect(measured.body).toBeLessThanOrEqual(0)
    for (const overflow of measured.panes) {
      expect(overflow).toBeLessThanOrEqual(0)
    }
  })
}

test('a selected record does not widen the detail pane either', async () => {
  // The vendor address is the longest single string TRITIUM stores, and the
  // detail pane is where it is shown whole (§4.4, §3.5). `.detail__value`
  // wraps with overflow-wrap: anywhere for exactly this reason.
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-service')
  await shell.getByTestId('tab-service').click()
  await shell.getByTestId('service-row-s-0001').click()

  await expect(shell.getByTestId('service-detail-value-vendor')).toBeVisible()

  const overflow = await shell.evaluate(() =>
    Array.from(document.querySelectorAll('.pane')).map(
      (pane) => pane.scrollWidth - pane.clientWidth
    )
  )

  for (const value of overflow) {
    expect(value).toBeLessThanOrEqual(0)
  }
})
