// F5 — the cost model of XTRITIUM §6, driven through real windows.
//
// A cost is typed into a form window and then read off disk as a file, the way
// the maker would read it in Neovim. The row these tests use is his own ninth:
// Trafik Sigortası 26/27, ₺11.746,00, Kredi Kartı, Enpara, Taksit 6 — which on
// the spreadsheet was one AÇIKLAMA cell reading "Enpara / Taksit 6".

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'

const vehiclesDir = (): string => join(dataDir, 'tritium', 'vehicles')
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

/** A costs.toml written the way the maker would write one by hand. */
function putCosts(...entries: string[]): void {
  mkdirSync(join(vehiclesDir(), SLUG), { recursive: true })
  writeFileSync(costsPath(), ['schema_version = 1', ...entries, ''].join('\n'))
}

function entryText(id: string, over: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    date: '2026-04-11',
    group: '"tekrar-eden"',
    category: '"trafik-sigortasi"',
    title: '"Trafik Sigortası 26/27"',
    amount: '11746.00',
    income: 'false',
    payment_method: '"kredi-karti"',
    bank: '"Enpara"',
    instalment: '"Taksit 6"',
    note: '""',
    ...over
  }

  return [
    '',
    '[[entry]]',
    `id = "${id}"`,
    ...Object.entries(fields).map(([key, value]) => `${key} = ${value}`)
  ].join('\n')
}

async function openCostsTab(): Promise<Page> {
  const shell = await windowWith(app, 'tab-costs')
  await shell.getByTestId('tab-costs').click()
  await expect(shell.getByTestId('cost-list')).toBeVisible()
  return shell
}

function costsDocument(): Record<string, unknown> {
  return parse(readFileSync(costsPath(), 'utf8')) as Record<string, unknown>
}

function costEntries(): Record<string, unknown>[] {
  return costsDocument()['entry'] as Record<string, unknown>[]
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-costs-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  putVehicle()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('a cost typed into the form lands on disk and in the shell', async () => {
  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')

  await form.getByTestId('cost-date').fill('11/04/2026')
  await form.getByTestId('cost-group').selectOption('tekrar-eden')
  await form.getByTestId('cost-category').selectOption('trafik-sigortasi')
  await form.getByTestId('cost-title').fill('Trafik Sigortası 26/27')
  await form.getByTestId('cost-amount').fill('11746,00')
  await form.getByTestId('cost-payment_method').selectOption('kredi-karti')

  // The two fields this milestone exists for. On the sheet they were one cell.
  await form.getByTestId('cost-bank').fill('Enpara')
  await form.getByTestId('cost-instalment').fill('Taksit 6')

  await form.getByTestId('cost-save').click()

  await expect(() => {
    expect(readdirSync(join(vehiclesDir(), SLUG))).toContain('costs.toml')
  }).toPass({ timeout: 5_000 })

  const entries = costEntries()
  expect(entries).toHaveLength(1)
  expect(entries[0]?.['id']).toBe('c-0001')
  expect(entries[0]?.['group']).toBe('tekrar-eden')
  expect(entries[0]?.['category']).toBe('trafik-sigortasi')
  expect(entries[0]?.['title']).toBe('Trafik Sigortası 26/27')
  expect(entries[0]?.['amount']).toBe(11_746)
  expect(entries[0]?.['income']).toBe(false)
  expect(entries[0]?.['payment_method']).toBe('kredi-karti')

  // Separate keys, and that is the whole milestone.
  expect(entries[0]?.['bank']).toBe('Enpara')
  expect(entries[0]?.['instalment']).toBe('Taksit 6')

  const text = readFileSync(costsPath(), 'utf8')
  expect(text).toContain('amount = 11746.00')
  expect(text).toContain('bank = "Enpara"')
  expect(text).toContain('instalment = "Taksit 6"')

  // And the shell has it without a restart: the write broadcasts, which
  // costs:save never did before this milestone.
  await expect(shell.getByTestId('cost-row-c-0001')).toBeVisible()
  await expect(shell.getByTestId('cost-amount-c-0001')).toHaveText('11.746,00 ₺')
})

test('Periyodik Bakım is not among the categories a cost may take', async () => {
  // §6.2 sends it to service.toml and F6 gives it its own entry path. The cost
  // form writes costs.toml, so it does not offer a category it cannot write.
  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')

  await form.getByTestId('cost-group').selectOption('tekrar-eden')
  const values = await form.getByTestId('cost-category').locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  )

  expect(values).toContain('kasko')
  expect(values).toContain('mtv-1')
  expect(values).not.toContain('periyodik-bakim')
})

test('the form changes shape with the group, and MANUAL asks for a typed category', async () => {
  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')

  // A picked category for the two money columns of §6.1.
  await form.getByTestId('cost-group').selectOption('ilk-alis')
  await expect(form.getByTestId('cost-category')).toBeVisible()
  await expect(form.getByTestId('cost-category-typed')).toHaveCount(0)

  // MANUAL has no fixed categories — §6.1 gives it "add custom: …".
  await form.getByTestId('cost-group').selectOption('manual')
  await expect(form.getByTestId('cost-category-typed')).toBeVisible()
  await expect(form.getByTestId('cost-category')).toHaveCount(0)

  await form.getByTestId('cost-category-typed').fill('Lastik')
  await form.getByTestId('cost-title').fill('Kış lastiği')
  await form.getByTestId('cost-amount').fill('8.664,00')
  await form.getByTestId('cost-save').click()

  await expect(() => {
    expect(readFileSync(costsPath(), 'utf8')).toContain('group = "manual"')
  }).toPass({ timeout: 5_000 })

  // Stored as a key, so Lastik and lastik are one category.
  expect(costEntries()[0]?.['category']).toBe('lastik')
  expect(costEntries()[0]?.['amount']).toBe(8664)
})

test('changing the group clears a category that no longer belongs to it', async () => {
  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')

  await form.getByTestId('cost-group').selectOption('tekrar-eden')
  await form.getByTestId('cost-category').selectOption('kasko')
  await expect(form.getByTestId('cost-category')).toHaveValue('kasko')

  // `kasko` under İLK ALIŞ is not a thing the tree contains.
  await form.getByTestId('cost-group').selectOption('ilk-alis')
  await expect(form.getByTestId('cost-category')).toHaveValue('')
})

test('an income entry shows negative and is stored positive', async () => {
  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')

  await form.getByTestId('cost-group').selectOption('manual')
  await form.getByTestId('cost-category-typed').fill('Hasar Ödemesi')
  await form.getByTestId('cost-title').fill('Kasko hasar ödemesi')
  await form.getByTestId('cost-amount').fill('11746,00')
  await form.getByTestId('cost-income').check()
  await form.getByTestId('cost-save').click()

  await expect(() => {
    expect(readFileSync(costsPath(), 'utf8')).toContain('income = true')
  }).toPass({ timeout: 5_000 })

  // §4.4 — the flag is the sign; the amount on disk does not carry one too.
  expect(costEntries()[0]?.['amount']).toBe(11_746)
  expect(readFileSync(costsPath(), 'utf8')).not.toContain('-11746')

  await expect(shell.getByTestId('cost-amount-c-0001')).toHaveText('-11.746,00 ₺')
})

test('the form reopens a cost with every figure identical', async () => {
  putCosts(entryText('c-0001'))

  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await shell.getByTestId('cost-edit-c-0001').click()
  const form = await windowWith(app, 'cost-save')

  await expect(form.getByTestId('cost-date')).toHaveValue('11/04/2026')
  await expect(form.getByTestId('cost-group')).toHaveValue('tekrar-eden')
  await expect(form.getByTestId('cost-category')).toHaveValue('trafik-sigortasi')
  await expect(form.getByTestId('cost-title')).toHaveValue('Trafik Sigortası 26/27')
  await expect(form.getByTestId('cost-amount')).toHaveValue('11746,00')
  await expect(form.getByTestId('cost-payment_method')).toHaveValue('kredi-karti')
  await expect(form.getByTestId('cost-bank')).toHaveValue('Enpara')
  await expect(form.getByTestId('cost-instalment')).toHaveValue('Taksit 6')

  // Saved untouched, the entry is the same entry — one id, nothing appended.
  await form.getByTestId('cost-save').click()
  await expect(() => {
    expect(costEntries()).toHaveLength(1)
  }).toPass({ timeout: 5_000 })
  expect(costEntries()[0]?.['id']).toBe('c-0001')
  expect(costEntries()[0]?.['amount']).toBe(11_746)
})

test('a payment method typed into the file by hand survives an edit', async () => {
  // §4.4 calls the list editable and F11 owns settings. Until then, dropping a
  // value the maker wrote would be the app overruling his own editor (§3.8).
  putCosts(entryText('c-0001', { payment_method: '"havale"' }))

  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await shell.getByTestId('cost-edit-c-0001').click()
  const form = await windowWith(app, 'cost-save')

  await expect(form.getByTestId('cost-payment_method')).toHaveValue('havale')

  await form.getByTestId('cost-title').fill('Trafik Sigortası 26/27 düzeltme')
  await form.getByTestId('cost-save').click()

  await expect(() => {
    expect(readFileSync(costsPath(), 'utf8')).toContain('düzeltme')
  }).toPass({ timeout: 5_000 })
  expect(costEntries()[0]?.['payment_method']).toBe('havale')
})

test('the list shows the newest cost first', async () => {
  putCosts(
    entryText('c-0001', { date: '2025-04-22', category: '"kapora"', group: '"ilk-alis"' }),
    entryText('c-0002', { date: '2026-04-11' }),
    entryText('c-0003', { date: '2025-07-16', category: '"mtv-2"' })
  )

  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  const ids = await shell
    .getByTestId('cost-list')
    .locator('tbody tr')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))

  expect(ids).toEqual(['cost-row-c-0002', 'cost-row-c-0003', 'cost-row-c-0001'])
})

test('the cost form is a separate window, anchored to nothing', async () => {
  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  expect(app.windows().length).toBe(1)
  await shell.getByTestId('cost-add').click()
  await windowWith(app, 'cost-save')
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
  // §7 — no "get started" screens, and none of Fuelio's "You need to add some
  // data first" either. The list is there with its headings and no rows.
  rmSync(vehiclesDir(), { recursive: true, force: true })

  app = await launchApp(dataDir)
  const shell = await openCostsTab()

  await expect(shell.getByTestId('cost-list')).toBeVisible()
  await expect(shell.getByTestId('cost-empty')).toBeVisible()
  await expect(shell.getByTestId('cost-add')).toBeDisabled()
})
