// XTRITIUM §3.1 / F1 acceptance criterion 10 — with every route to the network
// severed, the app must behave exactly as it does without. audit-egress proves
// this statically; this proves it at runtime.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'

const REPO = fileURLToPath(new URL('../..', import.meta.url))

// Every hostname resolves to a dead port, and every proxy attempt fails.
const SEVERED = ['--proxy-server=127.0.0.1:1', '--host-resolver-rules=MAP * 127.0.0.1:1']

let app: ElectronApplication
let dataDir = ''

test.beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'tritium-offline-'))
  app = await electron.launch({
    args: [REPO, ...SEVERED],
    cwd: REPO,
    env: { ...process.env, XDG_DATA_HOME: dataDir }
  })
})

test.afterEach(async () => {
  await app.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('the shell is identical with the network severed', async () => {
  const page = await app.firstWindow()

  await expect(page.getByTestId('tab-summary')).toBeVisible()
  await expect(page.getByTestId('tab-summary')).toHaveText('SUMMARY')

  await page.getByTestId('tab-settings').click()
  await page.getByTestId('language-select').selectOption('tr')
  await expect(page.getByTestId('tab-summary')).toHaveText('ÖZET')

  await page.getByTestId('tab-about').click()
  await expect(page.getByTestId('licence-text')).toContainText('GNU GENERAL PUBLIC LICENSE')
})

test('no request ever leaves the app', async () => {
  const page = await app.firstWindow()

  const requests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    // The bundled renderer itself: file:// in a build, the dev server in dev.
    if (url.startsWith('file:') || url.startsWith('devtools:') || url.startsWith('data:')) return
    requests.push(url)
  })

  await page.getByTestId('tab-settings').click()
  await page.getByTestId('palette-select').selectOption('aubergine')
  await page.getByTestId('tab-about').click()
  await page.waitForTimeout(500)

  expect(requests).toEqual([])
})
