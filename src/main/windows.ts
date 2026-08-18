// Every window TRITIUM opens, and the guards all of them carry.
//
// XTRITIUM §5.1 — entry forms are real, separate, movable Electron windows,
// draggable outside the main one. F1 refused windows opened by the RENDERER
// (window.open), and that refusal stays exactly as it was: these are opened by
// the main process, which is the difference between the app deciding to show a
// form and a page deciding to open something.
//
// §7 — the compositor draws the decorations; the main window's minimum is
// 1280 × 720. A form is not the main window and is sized to its contents.

import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { FORM_ARG, type FormRequest } from '../shared/forms.js'
import { SETTINGS_ARG, type Settings } from '../shared/settings.js'

export const MIN_WIDTH = 1280
export const MIN_HEIGHT = 720

/** Sizes chosen to fit the form, not to fill the screen. */
const FORM_SIZES: Record<FormRequest['kind'], { width: number; height: number }> = {
  vehicle: { width: 760, height: 700 },
  currency: { width: 460, height: 300 },
  // Quick-add is three fields and a total (§5.1); the full form is every field
  // of §4.4's fuel.toml. Neither is the main window and neither fills a screen.
  'fuel-quick': { width: 480, height: 480 },
  fuel: { width: 620, height: 660 }
}

/**
 * The refusals every window carries: no window.open, ever, and no navigation
 * away from the bundled renderer. XTRITIUM §3.5 — the app opens no browser and
 * follows no link, so there is nowhere else for a window to go.
 */
export function harden(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}

function preloadPath(): string {
  return join(import.meta.dirname, '../preload/index.cjs')
}

function rendererFile(): string {
  return join(import.meta.dirname, '../renderer/index.html')
}

function devServer(): string | undefined {
  const url = process.env['ELECTRON_RENDERER_URL']
  return url !== undefined && url.length > 0 ? url : undefined
}

function webPreferences(packaged: boolean, args: string[]): Electron.WebPreferences {
  return {
    preload: preloadPath(),
    additionalArguments: args,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: false,
    devTools: !packaged
  }
}

function load(window: BrowserWindow, packaged: boolean): void {
  const url = devServer()
  if (!packaged && url !== undefined) void window.loadURL(url)
  else void window.loadFile(rendererFile())
}

export function createMainWindow(settings: Settings, packaged: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: MIN_WIDTH,
    height: MIN_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    webPreferences: webPreferences(packaged, [`${SETTINGS_ARG}${JSON.stringify(settings)}`])
  })

  window.once('ready-to-show', () => window.show())
  harden(window)
  load(window, packaged)

  return window
}

/**
 * A form window. The same bundle, told what it is through the arguments.
 *
 * The currency question is modal to the main window because it is asked once,
 * before anything else means anything (§8). An entry form is not: §5.1 calls it
 * non-anchored, and a form the maker cannot push aside to look at the list
 * behind it would be a worse form.
 */
export function openFormWindow(
  request: FormRequest,
  settings: Settings,
  packaged: boolean,
  parent?: BrowserWindow
): BrowserWindow {
  const size = FORM_SIZES[request.kind]
  const modal = request.kind === 'currency'

  const window = new BrowserWindow({
    ...size,
    ...(modal && parent !== undefined ? { parent, modal: true } : {}),
    show: false,
    autoHideMenuBar: true,
    webPreferences: webPreferences(packaged, [
      `${SETTINGS_ARG}${JSON.stringify(settings)}`,
      `${FORM_ARG}${JSON.stringify(request)}`
    ])
  })

  window.once('ready-to-show', () => window.show())
  harden(window)
  load(window, packaged)

  return window
}
