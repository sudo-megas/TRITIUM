// The main process. One window, no tray, no autostart, no remembered geometry.
// XTRITIUM §7 — the compositor draws the decorations; minimum size 1280 × 720.
// XTRITIUM §3.1 / §3.5 — nothing here reaches the network and nothing opens a
// browser: navigation away from the bundled renderer is refused outright.

import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { readSettings, writeSettings } from './storage/settings-file.js'
import {
  listVehicleSlugs,
  loadVehicle,
  saveCosts,
  saveFuel,
  saveService,
  saveVehicleRecord
} from './storage/repository.js'
import type { CostDocument } from './storage/cost-file.js'
import type { FuelDocument } from './storage/fuel-file.js'
import type { ServiceDocument } from './storage/service-file.js'
import type { VehicleDocument } from './storage/vehicle-file.js'
import {
  isConsumptionUnit,
  isCurrency,
  isDistanceUnit,
  isLanguage,
  isPalette,
  isVolumeUnit,
  readDecimals,
  type Settings
} from '../shared/settings.js'

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

  /**
   * A write is a MERGE over what is on disk, not a replacement.
   *
   * The renderer sends the field it just changed. Rebuilding the record from
   * defaults instead would answer a palette click by erasing the currency the
   * maker was asked for exactly once — so every field the caller did not send,
   * or sent invalidly, keeps the value the file already holds.
   */
  ipcMain.handle('settings:write', (_event, incoming: unknown) => {
    const current = readSettings()
    carried = current.unknown

    const candidate = incoming as Partial<Settings> | null
    const settings: Settings = {
      ...current.settings,
      ...(isLanguage(candidate?.language) ? { language: candidate.language } : {}),
      ...(isCurrency(candidate?.currency) ? { currency: candidate.currency } : {}),
      ...(isDistanceUnit(candidate?.distance) ? { distance: candidate.distance } : {}),
      ...(isVolumeUnit(candidate?.volume) ? { volume: candidate.volume } : {}),
      ...(isConsumptionUnit(candidate?.consumption) ? { consumption: candidate.consumption } : {}),
      decimals_consumption: readDecimals(
        candidate?.decimals_consumption,
        current.settings.decimals_consumption
      ),
      decimals_cost_per_km: readDecimals(
        candidate?.decimals_cost_per_km,
        current.settings.decimals_cost_per_km
      ),
      ...(isPalette(candidate?.palette) ? { palette: candidate.palette } : {})
    }

    writeSettings(settings, carried)
    return settings
  })

  // Storage (F2). Enumerated, one channel per capability — no generic bridge.
  // A CorruptFileError thrown in here rejects the renderer's promise; nothing
  // is written, and the file the maker can still repair by hand stays as it is.
  ipcMain.handle('vehicles:list', () => listVehicleSlugs())

  ipcMain.handle('vehicle:load', (_event, slug: unknown) =>
    loadVehicle(typeof slug === 'string' ? slug : '')
  )

  ipcMain.handle('vehicle:save', (_event, slug: unknown, document: unknown) => {
    saveVehicleRecord(String(slug), document as VehicleDocument)
  })

  ipcMain.handle('fuel:save', (_event, slug: unknown, document: unknown) => {
    saveFuel(String(slug), document as FuelDocument)
  })

  ipcMain.handle('costs:save', (_event, slug: unknown, document: unknown) => {
    saveCosts(String(slug), document as CostDocument)
  })

  ipcMain.handle('service:save', (_event, slug: unknown, document: unknown) => {
    saveService(String(slug), document as ServiceDocument)
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
