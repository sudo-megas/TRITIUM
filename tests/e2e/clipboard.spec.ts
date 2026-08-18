/*
 * The clipboard, with no application menu anywhere.
 *
 * F4b's D4 settled that TRITIUM has no context menus: an overlay covers what is
 * underneath it, and nothing here may do that. The objection to that ruling is
 * practical rather than aesthetic — a right-click menu is how most people expect
 * to reach copy and paste, and an app that removes it has to answer for the
 * clipboard some other way.
 *
 * The answer is that it never needed the menu. Chromium implements the editing
 * commands in the renderer itself, not through the application menu's
 * accelerators, so they survive a menu-less window. But "should" is not a test,
 * and the plan required this to be verified rather than assumed — so it is
 * verified here, in both directions and in both places a person would try it:
 * pasting into a field, copying back out of one, and copying the source address
 * out of About, which is plain selectable text and not a link (XTRITIUM §3.5).
 *
 * The clipboard is read and written through Electron's own main-process module,
 * which is the same system clipboard the renderer reaches — so a value written
 * here and pasted with a keystroke has genuinely crossed the boundary.
 */

import { rmSync } from 'node:fs'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'
import { SOURCE_ADDRESS } from '../../src/shared/app-meta.js'

let app: ElectronApplication
let dataDir = ''

/** Put a value on the system clipboard from the main process. */
async function writeClipboard(text: string): Promise<void> {
  await app.evaluate(async ({ clipboard }, value: string) => {
    clipboard.writeText(value)
  }, text)
}

async function readClipboard(): Promise<string> {
  return app.evaluate(async ({ clipboard }) => clipboard.readText())
}

test.beforeEach(async () => {
  dataDir = makeDataDir('tritium-clip-')
  seedSettings(dataDir)
  app = await launchApp(dataDir)
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('a field takes a paste, and gives a copy back, with no menu present', async () => {
  // There is no application menu at all. If the editing commands depended on
  // one, everything below would fail rather than quietly degrade.
  const menu = await app.evaluate(async ({ Menu }) => Menu.getApplicationMenu())
  expect(menu).toBeNull()

  const shell = await windowWith(app, 'vehicle-add')
  await shell.getByTestId('vehicle-add').click()
  const form = await windowWith(app, 'vehicle-save')

  const name = form.getByTestId('vehicle-name')

  // Paste — the direction a data-entry application actually needs, and the one
  // that cannot be inferred from a working copy.
  await writeClipboard('SPORTAGE 1.6 T-GDI')
  await name.click()
  await form.keyboard.press('ControlOrMeta+v')
  await expect(name).toHaveValue('SPORTAGE 1.6 T-GDI')

  // Select-all and copy, from inside the field, back out to the clipboard.
  await writeClipboard('')
  await form.keyboard.press('ControlOrMeta+a')
  await form.keyboard.press('ControlOrMeta+c')
  await expect(async () => {
    expect(await readClipboard()).toBe('SPORTAGE 1.6 T-GDI')
  }).toPass({ timeout: 5_000 })

  // Cut empties the field, which is the third command and the one that proves
  // the editing commands are really being handled rather than approximated.
  await form.keyboard.press('ControlOrMeta+a')
  await form.keyboard.press('ControlOrMeta+x')
  await expect(name).toHaveValue('')
})

test('the source address can be selected and copied, though it is not a link', async () => {
  const shell = await windowWith(app, 'tab-about')
  await shell.getByTestId('tab-about').click()

  const address = shell.getByTestId('about-Source')
  await expect(address).toHaveText(SOURCE_ADDRESS)

  await writeClipboard('')

  // A triple click is what a person does to take a whole line, and it is also
  // the assertion that the user-select carve-out in base.css is working: the
  // body sets user-select: none, so without the exception for .about__value
  // this gesture would select nothing at all and the copy would come back empty.
  await address.click({ clickCount: 3 })
  await shell.keyboard.press('ControlOrMeta+c')

  await expect(async () => {
    expect(await readClipboard()).toContain(SOURCE_ADDRESS)
  }).toPass({ timeout: 5_000 })
})
