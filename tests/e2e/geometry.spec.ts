// D1, measured instead of asserted (F15).
//
// F4b's first decision is that nothing in this application overlaps anything
// else, and `scripts/audit-overlap.mjs` has enforced it since. That audit reads
// SOURCE TEXT: it looks for `position: absolute`, `z-index`, `float`, negative
// margins, `box-shadow`, `<dialog>`, `role="tooltip"`, `title=`. It is a good
// gate and it works.
//
// It saw none of the defects the maker found in v0.2.4, because not one of them
// used any of those constructs. Every overlap in that release was ordinary
// in-flow CSS Grid arithmetic — a fixed track, an item with a `min-width`
// larger than it, and nothing setting `overflow` to clip the difference. A gate
// that reads source cannot see two boxes landing on the same pixels.
//
// `overflow.spec.ts` did not see them either. It measures
// `scrollWidth - clientWidth`, which finds content wider than its container; two
// elements can overlap perfectly while the container never scrolls. It also
// never covered Settings, and never opened a form window.
//
// Across the fifteen specs that existed before this one, the intersection of
// "opens a form window" and "asserts geometry" was EMPTY. Nine of them opened
// form windows; every assertion was about field values, disk contents or window
// identity. So the six windows the maker actually types into were the least
// measured surface in the application, and they were the ones that were broken.
//
// This file measures what is drawn.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

let app: ElectronApplication
let dataDir = ''

const SLUG = 'sportage'

/**
 * A vehicle with enough on it that every pane has something to draw. An empty
 * app is a different geometry test — §7 says the empty layout is the filled
 * layout — and `emptiness` at the bottom of this file covers it.
 */
function seedVehicle(): void {
  const dir = join(dataDir, 'tritium', 'vehicles', SLUG)
  mkdirSync(dir, { recursive: true })

  writeFileSync(
    join(dir, 'vehicle.toml'),
    [
      'schema_version = 1',
      '',
      '[vehicle]',
      'name = "Kia Sportage 1.6 CRDi"',
      'make = "Kia"',
      'model = "Sportage"',
      'plate = "34 ABC 123"',
      'tank_capacity_l = 62',
      'purchase_price = 128000000',
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
      'date = "2026-01-04"',
      'odometer_km = 1204500',
      'litres = 48750',
      'price_per_litre = 4890',
      'full_tank = true',
      '',
      '[[entry]]',
      'id = "f-0002"',
      'date = "2026-02-11"',
      'odometer_km = 1256300',
      'litres = 51200',
      'price_per_litre = 4995',
      'full_tank = true',
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
      'date = "2026-01-20"',
      'group = "tekrar-eden"',
      'category = "trafik-sigortasi"',
      'title = "Trafik Sigortası 26/27"',
      'amount = 1174600',
      'payment_method = "kredi-karti"',
      'bank = "Enpara"',
      'instalment = "Taksit 6"',
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
      'date = "2026-02-02"',
      'odometer_km = 1250000',
      'amount = 892500',
      'vendor = "Kia Yetkili Servis"',
      ''
    ].join('\n')
  )
}

/**
 * Every pair of laid-out boxes that share pixels without one containing the
 * other.
 *
 * The obvious version of this compares SIBLINGS, and the obvious version does
 * not work. It was written first and it passed against the broken build, which
 * is how it got rewritten: the label that sat on top of an input in v0.2.4 was
 * not that input's sibling. `.form__grid` held one `.field` per column, and the
 * overflowing control in column one ran under the LABEL OF THE FIELD IN COLUMN
 * TWO — a cousin, two subtrees apart. A sibling-only walk cannot see that, and a
 * gate that cannot see the defect it was written for is worse than no gate,
 * because it reports the property as held.
 *
 * So every pair is compared, and only true ancestry is excluded — a parent
 * containing its child is the normal case and says nothing.
 *
 * Two exclusions, both narrow:
 *
 * - `display: inline` and `contents`. A wrapped inline's bounding box is the
 *   union of its line boxes and can legitimately span a neighbour's. This does
 *   not let the bug through: an inline child of a grid or flex container is
 *   blockified by the layout, so `.field__label` computes to `block` and is
 *   compared like everything else.
 * - Anything inside a `<select>`. Its `<option>`s are not laid out as boxes in
 *   the page and their rects mean nothing here.
 */
async function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    // Sub-pixel layout means boxes touch at fractional coordinates. An overlap
    // has to be visible to count as one.
    const SLOP = 1

    const describe = (element: Element): string => {
      const id = element.getAttribute('data-testid')
      const cls = element.getAttribute('class')
      return [
        element.tagName.toLowerCase(),
        id === null ? '' : `[${id}]`,
        cls === null ? '' : `.${cls.split(/\s+/).join('.')}`
      ].join('')
    }

    const boxes: { element: Element; rect: DOMRect }[] = []

    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      if (element.closest('select') !== null) continue

      const style = window.getComputedStyle(element)
      if (style.display === 'inline' || style.display === 'contents') continue
      if (style.visibility === 'hidden') continue

      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue

      boxes.push({ element, rect })
    }

    const found: string[] = []

    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        const one = boxes[a]!
        const two = boxes[b]!

        if (one.element.contains(two.element) || two.element.contains(one.element)) continue

        const shared =
          Math.min(one.rect.right, two.rect.right) - Math.max(one.rect.left, two.rect.left) >
            SLOP &&
          Math.min(one.rect.bottom, two.rect.bottom) - Math.max(one.rect.top, two.rect.top) > SLOP

        if (shared) found.push(`${describe(one.element)} overlaps ${describe(two.element)}`)
      }
    }

    return found
  })
}

/** How far anything sticks out of the box that is supposed to hold it. */
async function sideways(page: Page): Promise<number> {
  return page.evaluate(() => {
    const containers = [document.body, ...Array.from(document.querySelectorAll('.pane, .form'))]
    return Math.max(...containers.map((box) => box.scrollWidth - box.clientWidth))
  })
}

test.beforeEach(() => {
  dataDir = makeDataDir('tritium-geometry-')
  seedSettings(dataDir, { activeVehicle: SLUG })
  seedVehicle()
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

/*
 * THE FORM WINDOWS.
 *
 * The whole reason this file exists. Each of these was broken in v0.2.4 — the
 * vehicle form by 76 pixels per field, quick-add by 216 — and no test in the
 * suite could tell.
 */
const FORMS = [
  { name: 'new vehicle', open: 'vehicle-add', save: 'vehicle-save' },
  { name: 'quick add', open: 'fuel-quick-add', save: 'fuel-save' },
  { name: 'the full fuel form', open: 'fuel-full-add', save: 'fuel-save' },
  { name: 'the cost form', open: 'cost-add', save: 'cost-save' },
  { name: 'the service form', open: 'service-add', save: 'service-save' }
] as const

const TAB_FOR: Record<string, string> = {
  'fuel-quick-add': 'fuel',
  'fuel-full-add': 'fuel',
  'cost-add': 'costs',
  'service-add': 'service'
}

for (const form of FORMS) {
  test(`${form.name} lays out with nothing on top of anything`, async () => {
    app = await launchApp(dataDir)
    const shell = await windowWith(app, 'tab-summary')

    const tab = TAB_FOR[form.open]
    if (tab !== undefined) await shell.getByTestId(`tab-${tab}`).click()

    await shell.getByTestId(form.open).click()
    const window = await windowWith(app, form.save)
    await expect(window.getByTestId(form.save)).toBeVisible()

    expect(await overlaps(window)).toEqual([])
    expect(await sideways(window)).toBeLessThanOrEqual(0)
  })
}

test('the currency question, which is the first thing a new maker sees', async () => {
  rmSync(join(dataDir, 'tritium', 'settings.toml'), { force: true })
  app = await launchApp(dataDir)
  const ask = await windowWith(app, 'currency-confirm')
  await expect(ask.getByTestId('currency-confirm')).toBeVisible()

  expect(await overlaps(ask)).toEqual([])
  expect(await sideways(ask)).toBeLessThanOrEqual(0)
})

/*
 * THE TABS, INCLUDING SETTINGS.
 *
 * overflow.spec.ts covers six of these for sideways scroll. Settings was in
 * neither list, which is where the maker found an input painted across an Add
 * button — a collision that produced no scrollbar at all, so the metric that
 * file uses could not have caught it even if it had looked.
 */
for (const tab of [
  'summary',
  'fuel',
  'costs',
  'service',
  'charts',
  'statistics',
  'settings',
  'about'
]) {
  test(`the ${tab} tab lays out with nothing on top of anything`, async () => {
    app = await launchApp(dataDir)
    const shell = await windowWith(app, `tab-${tab}`)
    await shell.getByTestId(`tab-${tab}`).click()

    expect(await overlaps(shell)).toEqual([])
    expect(await sideways(shell)).toBeLessThanOrEqual(0)
  })
}

test('Turkish, where the labels are longest', async () => {
  rmSync(join(dataDir, 'tritium', 'settings.toml'), { force: true })
  seedSettings(dataDir, { activeVehicle: SLUG, language: 'tr' })
  app = await launchApp(dataDir)

  const shell = await windowWith(app, 'tab-settings')
  await shell.getByTestId('tab-settings').click()
  expect(await overlaps(shell)).toEqual([])

  await shell.getByTestId('tab-costs').click()
  await shell.getByTestId('cost-add').click()
  const form = await windowWith(app, 'cost-save')
  await expect(form.getByTestId('cost-save')).toBeVisible()

  // "Negatif gider (gelir)" is the longest label either catalogue carries, and
  // the widths in FORM_SIZES were derived from it.
  expect(await overlaps(form)).toEqual([])
  expect(await sideways(form)).toBeLessThanOrEqual(0)
})

/*
 * THE TYPE HIERARCHY, measured for the same reason as everything else here.
 *
 * v0.2.4 shipped `.section__title` at 11px over a `.field__label` that inherited
 * the 13px body, so every heading in Settings was smaller than the labels under
 * it (issues.md I-22). With two weights (D9) size is the only instrument
 * hierarchy has, and nothing checked it.
 */
test('a heading is never smaller than the text it heads', async () => {
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-settings')
  await shell.getByTestId('tab-settings').click()

  const sizes = await shell.evaluate(() => {
    const px = (selector: string): number => {
      const element = document.querySelector(selector)
      if (element === null) return Number.NaN
      return Number.parseFloat(window.getComputedStyle(element).fontSize)
    }
    return {
      heading: px('.section__title'),
      label: px('.field__label'),
      body: Number.parseFloat(window.getComputedStyle(document.body).fontSize)
    }
  })

  expect(sizes.heading).toBeGreaterThan(sizes.label)
  expect(sizes.heading).toBeGreaterThan(sizes.body)
})

/*
 * THE TAB BAR IS ONE ROW.
 *
 * .tabbar sets flex-wrap: wrap deliberately — the target desktop is a tiling
 * compositor that sets window widths itself and owes the 1280 minimum nothing,
 * and wrapping is a better failure than pushing the vehicle picker off the edge.
 *
 * But wrapping is the FAILURE mode, not the resting state, and at the minimum
 * width it must not happen. F15's larger type spent the bar's width budget
 * without anyone measuring it: eight labels, the mark and the picker wanted
 * about 1370px in a 1280px bar, so the picker dropped onto a second row and sat
 * under the tabs (issues.md I-30). Nothing failed — the layout did exactly what
 * it was told — and no test looked.
 */
test('the tab bar stays on one row at 1280', async () => {
  app = await launchApp(dataDir)
  const shell = await windowWith(app, 'tab-summary')

  const tops = await shell.evaluate(() => {
    const bar = document.querySelector('.tabbar')
    if (bar === null) return []
    const ys = Array.from(bar.children).map((child) =>
      Math.round(child.getBoundingClientRect().top)
    )
    return [...new Set(ys)]
  })

  // Every child of the bar starts at the same y. Two distinct tops means a wrap.
  expect(tops).toHaveLength(1)
})

test('emptiness is the same layout holding nothing (§7)', async () => {
  rmSync(join(dataDir, 'tritium', 'vehicles'), { recursive: true, force: true })
  app = await launchApp(dataDir)

  for (const tab of ['summary', 'fuel', 'charts', 'statistics']) {
    const shell = await windowWith(app, `tab-${tab}`)
    await shell.getByTestId(`tab-${tab}`).click()
    expect(await overlaps(shell)).toEqual([])
    expect(await sideways(shell)).toBeLessThanOrEqual(0)
  }
})
