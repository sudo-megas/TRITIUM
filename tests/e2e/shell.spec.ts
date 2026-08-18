// The F1 shell, exercised end to end against the real Electron build.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'

const REPO = fileURLToPath(new URL('../..', import.meta.url))

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

const settingsFile = (): string => join(dataDir, 'tritium', 'settings.toml')

/** The write crosses IPC; wait for it to reach disk before restarting. */
async function waitForSettings(fragment: string): Promise<void> {
  await expect(() => {
    expect(readFileSync(settingsFile(), 'utf8')).toContain(fragment)
  }).toPass({ timeout: 5_000 })
}

async function relaunch(): Promise<ElectronApplication> {
  await app.close()
  return electron.launch({
    args: [REPO],
    cwd: REPO,
    env: { ...process.env, XDG_DATA_HOME: dataDir }
  })
}

test.beforeEach(async () => {
  // A throwaway data directory — the tests never touch the maker's own files.
  dataDir = mkdtempSync(join(tmpdir(), 'tritium-e2e-'))
  app = await electron.launch({
    args: [REPO],
    cwd: REPO,
    env: { ...process.env, XDG_DATA_HOME: dataDir }
  })
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
  await page.getByTestId('palette-select').selectOption('p09')
  await waitForSettings('palette = "p09"')

  app = await relaunch()
  const restarted = await app.firstWindow()
  await expect(restarted.getByTestId('tab-summary')).toBeVisible()
  const attribute = await restarted.evaluate(
    () => document.documentElement.dataset['palette'] ?? ''
  )
  expect(attribute).toBe('p09')
})

test('the Nerd Font glyph renders from the font patch', async () => {
  const page = await app.firstWindow()
  const glyph = page.getByTestId('mark-glyph')
  await expect(glyph).toBeVisible()
  const family = await glyph.evaluate((node) => getComputedStyle(node).fontFamily)
  expect(family).toContain('CaskaydiaCove Nerd Font Mono')
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
  await page.getByTestId('palette-select').selectOption('p04')

  await waitForSettings('palette = "p04"')

  const document = parse(readFileSync(settingsFile(), 'utf8')) as Record<string, unknown>
  expect(document['schema_version']).toBe(1)
})
