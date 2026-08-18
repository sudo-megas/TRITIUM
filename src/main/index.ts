// The main process. One main window, plus the form windows XTRITIUM §5.1 asks
// for; no tray, no autostart, no remembered geometry.
// XTRITIUM §7 — the compositor draws the decorations; minimum size 1280 × 720.
// XTRITIUM §3.1 / §3.5 — nothing here reaches the network and nothing opens a
// browser: navigation away from the bundled renderer is refused outright, and
// window.open stays refused. Windows are opened by this process or not at all.

import { app, BrowserWindow, ipcMain } from 'electron'
import { readSettings, writeSettings } from './storage/settings-file.js'
import { createMainWindow, openFormWindow } from './windows.js'
import {
  listVehicleSlugs,
  loadVehicle,
  saveCosts,
  saveFuel,
  saveService,
  saveVehicleRecord,
  uniqueSlug,
  vehicleNames
} from './storage/repository.js'
import type { CostDocument } from './storage/cost-file.js'
import type { FuelDocument } from './storage/fuel-file.js'
import type { ServiceDocument } from './storage/service-file.js'
import type { VehicleDocument } from './storage/vehicle-file.js'
import { isFormKind } from '../shared/forms.js'
import {
  isConsumptionUnit,
  isCurrency,
  isDistanceUnit,
  isLanguage,
  isPalette,
  isVehicleSlug,
  isVolumeUnit,
  readDecimals,
  type Settings
} from '../shared/settings.js'

/** Whatever else changed on disk stays with the process so a save cannot drop it. */
let carried: Record<string, unknown> = {}
let mainWindow: BrowserWindow | null = null

function settingsNow(): Settings {
  const { settings, unknown } = readSettings()
  carried = unknown
  return settings
}

/**
 * A form window and the shell read the same files, so when one writes, the
 * other is told. Without this the picker would keep listing what was on disk
 * when it last rendered, which is the sort of disagreement that ends with
 * someone overwriting someone else's save.
 */
function broadcast(channel: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel)
  }
}

function createWindow(): void {
  // Read before the window exists so the renderer paints the stored palette and
  // language on its very first frame — no flash of the defaults. XTRITIUM §3.2:
  // the app opens straight into the data.
  const settings = settingsNow()

  mainWindow = createMainWindow(settings, app.isPackaged)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // XTRITIUM §8 — the currency is asked ONCE, and the trigger is the KEY being
  // absent, not the data directory being new. A settings.toml written before
  // this key existed must still be asked, exactly once, and never again.
  if (settings.currency === undefined) {
    openFormWindow({ kind: 'currency' }, settings, app.isPackaged, mainWindow)
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:read', () => settingsNow())

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
      ...(isVehicleSlug(candidate?.active_vehicle)
        ? { active_vehicle: candidate.active_vehicle }
        : {}),
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
    broadcast('settings:changed')
    return settings
  })

  // Storage (F2). Enumerated, one channel per capability — no generic bridge.
  // A CorruptFileError thrown in here rejects the renderer's promise; nothing
  // is written, and the file the maker can still repair by hand stays as it is.
  ipcMain.handle('vehicles:list', () => listVehicleSlugs())

  ipcMain.handle('vehicles:names', () => vehicleNames())

  ipcMain.handle('vehicle:load', (_event, slug: unknown) =>
    loadVehicle(typeof slug === 'string' ? slug : '')
  )

  ipcMain.handle('vehicle:save', (_event, slug: unknown, document: unknown) => {
    saveVehicleRecord(String(slug), document as VehicleDocument)
    broadcast('vehicles:changed')
  })

  /**
   * Create a vehicle (F3). The slug is allocated HERE, once, from the name —
   * and never again: a later rename edits the record and leaves the directory
   * where it is. Moving it would mean copying every fill-up the maker ever
   * entered and deleting the original, for a cosmetic change.
   *
   * Only vehicle.toml is written. fuel.toml, costs.toml and service.toml appear
   * when their first entry does; a missing one already reads as empty.
   */
  ipcMain.handle('vehicle:create', (_event, document: unknown) => {
    const incoming = document as VehicleDocument
    const slug = uniqueSlug(incoming.vehicle.name, listVehicleSlugs())
    saveVehicleRecord(slug, incoming)

    const current = readSettings()
    carried = current.unknown
    writeSettings({ ...current.settings, active_vehicle: slug }, carried)

    broadcast('vehicles:changed')
    return slug
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

  // Form windows (XTRITIUM §5.1). The renderer asks; this process decides.
  ipcMain.handle('form:open', (_event, kind: unknown, slug: unknown) => {
    if (!isFormKind(kind)) return
    openFormWindow(
      { kind, ...(typeof slug === 'string' && slug.length > 0 ? { slug } : {}) },
      settingsNow(),
      app.isPackaged,
      mainWindow ?? undefined
    )
  })

  /** A form closes itself when it is done — it does not close anything else. */
  ipcMain.handle('form:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}

// Single instance: a second launch raises the first window instead of opening
// a second view onto the same files.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const existing = mainWindow ?? BrowserWindow.getAllWindows()[0]
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
