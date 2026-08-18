// XTRITIUM §3.1 / F1 acceptance criterion 10 — with every route to the network
// severed, the app must behave exactly as it does without. audit-egress proves
// this statically; this proves it at runtime.

import { rmSync } from 'node:fs'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { launchApp, makeDataDir, seedSettings, windowWith } from './harness.js'

// Every hostname resolves to a dead port, and every proxy attempt fails.
const SEVERED = ['--proxy-server=127.0.0.1:1', '--host-resolver-rules=MAP * 127.0.0.1:1']

let app: ElectronApplication
let dataDir = ''

test.beforeEach(async () => {
  dataDir = makeDataDir('tritium-offline-')
  seedSettings(dataDir)
  app = await launchApp(dataDir, SEVERED)
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

test('a fill-up is entered and computed with the network severed', async () => {
  // F4's whole path — a vehicle, a form window, a write, and a figure derived
  // from it — with every route to the network dead. Nothing in it was ever
  // going to ask the outside world anything, and this is the proof at runtime.
  const page = await app.firstWindow()

  await page.getByTestId('vehicle-add').click()
  const vehicleForm = await windowWith(app, 'vehicle-save')
  await vehicleForm.getByTestId('vehicle-name').fill('Kia Sportage')
  await vehicleForm.getByTestId('vehicle-save').click()

  await page.getByTestId('tab-fuel').click()
  await expect(page.getByTestId('fuel-quick-add')).toBeEnabled()
  await page.getByTestId('fuel-quick-add').click()

  const form = await windowWith(app, 'fuel-save')
  await form.getByTestId('fuel-odometer_km').fill('19500')
  await form.getByTestId('fuel-litres').fill('30')
  await form.getByTestId('fuel-price_per_litre').fill('73,380')
  await expect(form.getByTestId('fuel-total-preview')).toHaveText('2.201,40 ₺')
  await form.getByTestId('fuel-save').click()

  await expect(page.getByTestId('fuel-row-f-0001')).toBeVisible()
})

test('a vehicle form opens with the network severed', async () => {
  // F3's windows are the app's own. Nothing about opening one touches a
  // network, and with every route dead it opens exactly as it does without.
  const page = await app.firstWindow()

  await expect(page.getByTestId('vehicle-picker')).toBeVisible()
  await page.getByTestId('vehicle-add').click()

  const form = await windowWith(app, 'vehicle-save')
  await expect(form.getByTestId('vehicle-name')).toBeVisible()
  expect(app.windows().length).toBe(2)
})
