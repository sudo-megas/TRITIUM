// The F1 shell, exercised end to end against the real Electron build.

import { readFileSync, rmSync } from 'node:fs'
import { parse } from 'smol-toml'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, settingsPathIn, windowWith } from './harness.js'
import { PALETTES } from '../../src/shared/settings.js'

// The seventeen tokens every palette owes, plus the eight-colour chart series.
// Deliberately spelled out rather than derived from the stylesheet: a test that
// reads its expectations out of the file it is checking proves only that the
// file agrees with itself.
const TOKENS = [
  '--surface',
  '--surface-raised',
  '--surface-sunken',
  '--border',
  '--border-strong',
  '--text',
  '--text-muted',
  '--text-subtle',
  '--text-on-accent',
  '--accent',
  '--accent-hover',
  '--danger',
  '--warning',
  '--success',
  '--info',
  '--focus-ring',
  '--selection',
  '--accent-seq-1',
  '--accent-seq-2',
  '--accent-seq-3',
  '--accent-seq-4',
  '--accent-seq-5',
  '--accent-seq-6',
  '--accent-seq-7',
  '--accent-seq-8'
] as const

const TABS = [
  'summary',
  'fuel',
  'costs',
  'service',
  'charts',
  'statistics',
  'settings',
  'about'
] as const

let app: ElectronApplication
let dataDir = ''

const settingsFile = (): string => settingsPathIn(dataDir)

/** The write crosses IPC; wait for it to reach disk before restarting. */
async function waitForSettings(fragment: string): Promise<void> {
  await expect(() => {
    expect(readFileSync(settingsFile(), 'utf8')).toContain(fragment)
  }).toPass({ timeout: 5_000 })
}

async function relaunch(): Promise<ElectronApplication> {
  await app.close()
  return launchApp(dataDir)
}

test.beforeEach(async () => {
  // A throwaway data directory — the tests never touch the maker's own files —
  // seeded so the shell, and not the first-run currency question, is what opens.
  dataDir = makeDataDir('tritium-e2e-')
  seedSettings(dataDir)
  app = await launchApp(dataDir)
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('the tab bar renders every tab', async () => {
  const page = await app.firstWindow()
  for (const id of TABS) {
    await expect(page.getByTestId(`tab-${id}`)).toBeVisible()
  }
})

test('the shell paints the stored palette on its first frame', async () => {
  // A palette is already on disk before this launch, so there is no window in
  // which the defaults could show (XTRITIUM §3.2 — straight into the data).
  const page = await app.firstWindow()
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('palette-select').selectOption('nord')
  await waitForSettings('palette = "nord"')

  app = await relaunch()
  const restarted = await app.firstWindow()
  await expect(restarted.getByTestId('tab-summary')).toBeVisible()
  const attribute = await restarted.evaluate(
    () => document.documentElement.dataset['palette'] ?? ''
  )
  expect(attribute).toBe('nord')
})

/*
 * The mark is the maker's own artwork now, not a glyph borrowed from the font
 * patch. naturalWidth is the assertion that carries the weight: a broken src, a
 * refusal by the Content-Security-Policy, or an asset the build failed to emit
 * all leave an <img> that a visibility query still calls visible, because the
 * element is laid out either way. Only a real decode gives it intrinsic size.
 */
test('the application mark decodes, and fits inside the bar it sits in', async () => {
  const page = await app.firstWindow()
  const icon = page.getByTestId('mark-icon')
  await expect(icon).toBeVisible()

  const drawn = await icon.evaluate((node) => {
    const image = node as HTMLImageElement
    const mark = image.getBoundingClientRect()
    const bar = image.closest('nav')?.getBoundingClientRect()
    return {
      natural: image.naturalWidth,
      width: mark.width,
      height: mark.height,
      bar: bar?.height ?? 0
    }
  })

  // The 128px file is the one that was imported, and it is square.
  expect(drawn.natural).toBe(128)
  expect(drawn.width).toBe(drawn.height)
  expect(drawn.height).toBeGreaterThan(0)

  // Drawn at a size the bar can hold. A mark taller than its own bar could only
  // fit by overlapping something, which is the one thing nothing here may do.
  expect(drawn.height).toBeLessThanOrEqual(drawn.bar)
})

/*
 * The larger mark on About, checked the same way and for the same reason: a
 * decode is the only thing that separates a drawn image from an element that
 * merely occupies space.
 */
test('About shows the mark at the size that page has room for', async () => {
  const page = await app.firstWindow()
  await page.getByTestId('tab-about').click()

  const icon = page.getByTestId('about-icon')
  await expect(icon).toBeVisible()

  const drawn = await icon.evaluate((node) => {
    const image = node as HTMLImageElement
    const box = image.getBoundingClientRect()
    return { natural: image.naturalWidth, width: box.width, height: box.height }
  })

  // A different file from the one in the bar, and a larger box.
  expect(drawn.natural).toBe(512)
  expect(drawn.width).toBe(drawn.height)
  expect(drawn.width).toBeGreaterThan(64)
})

/*
 * The vendored font, proved by what the engine loaded rather than by what the
 * stylesheet asked for. The test this replaces read font-family off the mark
 * glyph — but a computed font-family returns whatever was requested whether or
 * not the file behind the @font-face ever arrived, so it would have passed on a
 * 404. Reading document.fonts asks the engine what it actually has.
 *
 * Note that the patched-glyph range is no longer proved by anything, because
 * after this change the application draws no patched glyph at all. That proof
 * returns with the first glyph F7 or F8 puts in the interface.
 */
test('the vendored font is declared four ways, and the faces in use are loaded', async () => {
  const page = await app.firstWindow()
  await expect(page.getByTestId('tab-summary')).toBeVisible()

  const faces = await page.evaluate(async () => {
    await document.fonts.ready
    return Array.from(document.fonts)
      .filter((face) => face.family === 'CaskaydiaCove Nerd Font Mono')
      .map((face) => ({ weight: face.weight, style: face.style, status: face.status }))
  })

  // Regular, italic, bold, bold-italic — the four files in src/renderer/assets.
  expect(faces).toHaveLength(4)

  // Only the faces the interface actually sets are required to have loaded:
  // body text is regular, and the mark beside the tabs is bold. An italic that
  // nothing renders may legitimately still be sitting unloaded.
  const face = (weight: string, style: string): string | undefined =>
    faces.find((one) => one.weight === weight && one.style === style)?.status

  expect(face('400', 'normal')).toBe('loaded')
  expect(face('700', 'normal')).toBe('loaded')
  expect(face('400', 'italic')).toBeDefined()
  expect(face('700', 'italic')).toBeDefined()
})

test('the language switch flips a visible string and persists', async () => {
  const page = await app.firstWindow()
  await expect(page.getByTestId('tab-summary')).toHaveText('SUMMARY')

  await page.getByTestId('tab-settings').click()
  await page.getByTestId('language-select').selectOption('tr')
  await expect(page.getByTestId('tab-summary')).toHaveText('ÖZET')

  await waitForSettings('language = "tr"')
  app = await relaunch()
  const restarted = await app.firstWindow()
  await expect(restarted.getByTestId('tab-summary')).toHaveText('ÖZET')
})

test('the palette switch changes a computed custom property and persists', async () => {
  const page = await app.firstWindow()
  await expect(page.getByTestId('tab-settings')).toBeVisible()
  await page.getByTestId('tab-settings').click()

  const readAccent = (): Promise<string> =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    )

  const before = await readAccent()
  await page.getByTestId('palette-select').selectOption('aubergine')
  const after = await readAccent()

  expect(after).not.toBe(before)
  expect(after.length).toBeGreaterThan(0)

  await waitForSettings('palette = "aubergine"')
  app = await relaunch()
  const restarted = await app.firstWindow()
  // The window exists before the bundle has run; wait for the shell itself.
  await expect(restarted.getByTestId('tab-summary')).toBeVisible()
  const persisted = await restarted.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  )
  expect(persisted).toBe(after)
})

test('About shows the full licence and holds no links', async () => {
  const page = await app.firstWindow()
  await page.getByTestId('tab-about').click()

  const licence = page.getByTestId('licence-text')
  await expect(licence).toBeVisible()
  const text = await licence.innerText()
  expect(text).toContain('GNU GENERAL PUBLIC LICENSE')
  expect(text.length).toBeGreaterThan(30_000)

  // XTRITIUM §3.5 — addresses are selectable text; there is no anchor anywhere.
  expect(await page.locator('a').count()).toBe(0)
})

test('the window refuses to shrink below 1280 x 720', async () => {
  // Wait for the window before asking the main process about it. `launchApp`
  // resolves when the Electron process is up, which is before app.whenReady
  // has fired and createWindow has run — every other test in this file happens
  // to await firstWindow() as its first line, and this one reached
  // getAllWindows() while the list was still empty.
  await app.firstWindow()

  await app.evaluate(async ({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows()
    if (!window) throw new Error('no window')
    window.setSize(400, 300)
  })

  // Polled rather than sampled once: the resize is a round trip through the
  // compositor, and reading the size in the same tick can catch the requested
  // 400 before the minimum is applied. The guarantee XTRITIUM §7 makes is that
  // the window does not STAY smaller than this.
  await expect
    .poll(
      async () => {
        const size = await app.evaluate(async ({ BrowserWindow }) => {
          const [window] = BrowserWindow.getAllWindows()
          if (!window) throw new Error('no window')
          return window.getSize()
        })
        return (size[0] ?? 0) >= 1280 && (size[1] ?? 0) >= 720
      },
      { timeout: 5_000 }
    )
    .toBe(true)
})

test('settings.toml is valid TOML and carries schema_version', async () => {
  const page = await app.firstWindow()
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('palette-select').selectOption('catppuccin-latte')

  await waitForSettings('palette = "catppuccin-latte"')

  const document = parse(readFileSync(settingsFile(), 'utf8')) as Record<string, unknown>
  expect(document['schema_version']).toBe(1)
})

/*
 * Every palette, switched in the running application and read back through the
 * cascade rather than out of the file. The unit suite proves the stylesheet
 * declares what it should; this proves the browser resolves it — which is a
 * different claim, and the one that fails when a selector is misspelled, a
 * block is shadowed, or a token is declared somewhere the document never
 * reaches.
 */
test('all eleven palettes resolve a complete token set, and none repeats another', async () => {
  const page = await app.firstWindow()
  await page.getByTestId('tab-settings').click()

  const seen = new Map<string, string>()

  for (const id of PALETTES) {
    await page.getByTestId('palette-select').selectOption(id)

    await expect(async () => {
      const attribute = await page.evaluate(
        () => document.documentElement.dataset['palette'] ?? ''
      )
      expect(attribute).toBe(id)
    }).toPass({ timeout: 5_000 })

    const resolved = await page.evaluate((names: string[]) => {
      const style = getComputedStyle(document.documentElement)
      return names.map((name) => style.getPropertyValue(name).trim())
    }, [...TOKENS])

    TOKENS.forEach((name, index) => {
      expect(resolved[index], `${id} must define ${name}`).not.toBe('')
    })

    // Two palettes resolving to the same twenty-five values would mean one of
    // them never took effect — the failure a per-token check cannot see.
    const signature = resolved.join('|')
    const clash = seen.get(signature)
    expect(clash, `${id} resolves identically to ${clash ?? ''}`).toBeUndefined()
    seen.set(signature, id)
  }

  expect(seen.size).toBe(PALETTES.length)
})

/*
 * A window opened BEFORE the palette changed must change with it.
 *
 * Windows are isolated: each runs its own copy of the bundle with its own copy
 * of the settings, taken when it opened. The main process has announced every
 * settings write since F2 and the preload has exposed the channel since then
 * too, but until F4b nothing had ever subscribed — so a form opened first kept
 * the palette it was born with while the shell behind it changed. With eleven
 * placeholder palettes nobody would have noticed; with eleven real ones it is
 * the first thing anyone would see.
 */
test('a form opened before the palette changed follows it anyway', async () => {
  const shell = await windowWith(app, 'tab-settings')

  // Open the form FIRST, while the shell is still on the seeded palette. The
  // picker lives in the tab bar, so this needs no navigation.
  await shell.getByTestId('vehicle-add').click()
  const form = await windowWith(app, 'vehicle-save')

  const accentOf = (page: Page): Promise<string> =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    )

  const before = await accentOf(form)
  expect(before.length).toBeGreaterThan(0)

  // Now change it in the shell, with the form already open and untouched.
  await shell.getByTestId('tab-settings').click()
  await shell.getByTestId('palette-select').selectOption('aubergine')

  await expect(async () => {
    expect(await accentOf(form)).not.toBe(before)
  }).toPass({ timeout: 5_000 })

  // Both windows agree, rather than the form merely having changed to something.
  expect(await accentOf(form)).toBe(await accentOf(shell))
})
