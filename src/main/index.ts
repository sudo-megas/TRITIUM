// The main process. One window, no tray, no autostart, no remembered geometry.
// XTRITIUM §7 — the compositor draws the decorations; minimum size 1280 × 720.
// XTRITIUM §3.1 / §3.5 — nothing here reaches the network and nothing opens a
// browser: navigation away from the bundled renderer is refused outright.

import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { readSettings, writeSettings } from './storage/settings-file.js'
import { DEFAULT_SETTINGS, isLanguage, isPalette, type Settings } from '../shared/settings.js'

const MIN_WIDTH = 1280
const MIN_HEIGHT = 720

// Whatever else changed on disk stays with the process so a save cannot drop it.
let carried: Record<string, unknown> = {}

export const SETTINGS_ARG = '--tritium-settings='

function createWindow(): void {
  // Read before the window exists so the renderer paints the stored palette and
  // language on its very first frame — no flash of the defaults. XTRITIUM §3.2:
  // the app opens straight into the data.
  const initial = readSettings()
  carried = initial.unknown

  const window = new BrowserWindow({
    width: MIN_WIDTH,
    height: MIN_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      additionalArguments: [`${SETTINGS_ARG}${JSON.stringify(initial.settings)}`],
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      devTools: !app.isPackaged
    }
  })

  window.once('ready-to-show', () => window.show())

  // No new windows, ever — every address in TRITIUM is selectable text.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServer !== undefined && devServer.length > 0) {
    void window.loadURL(devServer)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:read', () => {
    const { settings, unknown } = readSettings()
    carried = unknown
    return settings
  })

  ipcMain.handle('settings:write', (_event, incoming: unknown) => {
    const candidate = incoming as Partial<Settings> | null
    const settings: Settings = {
      language: isLanguage(candidate?.language) ? candidate.language : DEFAULT_SETTINGS.language,
      palette: isPalette(candidate?.palette) ? candidate.palette : DEFAULT_SETTINGS.palette
    }
    writeSettings(settings, carried)
    return settings
  })
}

// Single instance: a second launch raises the first window instead of opening
// a second view onto the same files.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [existing] = BrowserWindow.getAllWindows()
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
    }
  })

  void app.whenReady().then(() => {
    registerIpc()
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
