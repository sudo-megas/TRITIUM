// The main process. One main window, plus the form windows XTRITIUM §5.1 asks
// for; no tray, no autostart, no remembered geometry.
// XTRITIUM §7 — the compositor draws the decorations; minimum size 1280 × 720.
// XTRITIUM §3.1 / §3.5 — nothing here reaches the network and nothing opens a
// browser: navigation away from the bundled renderer is refused outright, and
// window.open stays refused. Windows are opened by this process or not at all.

import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { readSettings, writeSettings } from './storage/settings-file.js'
import { createMainWindow, openFormWindow } from './windows.js'
import {
  addCostEntry,
  addFuelEntry,
  addServiceEntry,
  listVehicleSlugs,
  loadVehicle,
  saveCosts,
  saveFuel,
  saveService,
  saveVehicleRecord,
  uniqueSlug,
  updateCostEntry,
  updateFuelEntry,
  updateServiceEntry,
  vehicleNames
} from './storage/repository.js'
import {
  COST_GROUPS,
  isCostGroup,
  isDateString,
  type CostEntry,
  type FuelEntry,
  type ServiceEntry
} from '../shared/records.js'
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

/** A scaled integer as it arrives over the bridge, or the fallback. */
function integerOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
}

/**
 * A fill-up as a form window sends it, coerced to the record's shape (§4.4).
 *
 * The renderer is ours, but a field that arrived undefined would reach
 * formatPump and be written as `NaN` — a file that no longer parses, produced
 * by the one process that is supposed to keep it readable. The boundary
 * insists on the types rather than trusting them.
 */
function readFuelInput(value: unknown): Omit<FuelEntry, 'id'> {
  const raw = (value ?? {}) as Partial<FuelEntry>
  return {
    date: isDateString(raw.date) ? raw.date : '',
    odometer_km: integerOr(raw.odometer_km, 0),
    litres: integerOr(raw.litres, 0),
    price_per_litre: integerOr(raw.price_per_litre, 0),
    full_tank: raw.full_tank === true,
    fuel_type: typeof raw.fuel_type === 'string' ? raw.fuel_type : ''
  }
}

/** A string as it arrives over the bridge, or empty. */
function stringOr(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * A cost as a form window sends it, coerced to the record's shape (§4.4).
 *
 * The same insistence `readFuelInput` makes, for the same reason: a field that
 * arrived undefined would reach `formatMoney` and be written as `NaN`, and the
 * one process responsible for keeping costs.toml readable would be the one that
 * broke it.
 *
 * `amount` is forced positive here as well as in the draft. `income` is the
 * sign (§4.4), and a negative amount on disk would be the same fact stored
 * twice — the boundary should not be the only place that is true.
 */
function readCostInput(value: unknown): Omit<CostEntry, 'id'> {
  const raw = (value ?? {}) as Partial<CostEntry>
  return {
    date: isDateString(raw.date) ? raw.date : '',
    group: isCostGroup(raw.group) ? raw.group : COST_GROUPS[2],
    category: stringOr(raw.category),
    title: stringOr(raw.title),
    amount: Math.abs(integerOr(raw.amount, 0)),
    income: raw.income === true,
    payment_method: stringOr(raw.payment_method),
    bank: stringOr(raw.bank),
    instalment: stringOr(raw.instalment),
    note: stringOr(raw.note)
  }
}

/**
 * A service record as a form window sends it, coerced to §4.4's shape.
 *
 * `vendor` crosses as the plain string it is. It holds an address, a bare
 * domain, a shop's name or nothing — the maker's own sheet has one of each — so
 * there is nothing here to validate, and nothing anywhere that would open it
 * (§3.5).
 */
function readServiceInput(value: unknown): Omit<ServiceEntry, 'id'> {
  const raw = (value ?? {}) as Partial<ServiceEntry>
  return {
    date: isDateString(raw.date) ? raw.date : '',
    part: stringOr(raw.part),
    odometer_km: integerOr(raw.odometer_km, 0),
    amount: Math.abs(integerOr(raw.amount, 0)),
    vendor: stringOr(raw.vendor)
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
    broadcast('vehicles:changed')
  })

  /**
   * Add a fill-up (F4). The id is allocated in the repository, against the file
   * as it is at this moment — see addFuelEntry. The shell is told at once, so a
   * fill-up entered in a form window appears without anyone restarting anything.
   */
  ipcMain.handle('fuel:add', (_event, slug: unknown, entry: unknown) => {
    const added = addFuelEntry(String(slug), readFuelInput(entry))
    broadcast('vehicles:changed')
    return added
  })

  /** Edit one fill-up in place (XTRITIUM §3.8). The rest of the file is untouched. */
  ipcMain.handle('fuel:update', (_event, slug: unknown, entry: unknown) => {
    const raw = (entry ?? {}) as Partial<FuelEntry>
    const id = typeof raw.id === 'string' ? raw.id : ''
    if (id.length === 0) return false

    const changed = updateFuelEntry(String(slug), { ...readFuelInput(entry), id })
    if (changed) broadcast('vehicles:changed')
    return changed
  })

  /*
   * The broadcast here is F5 repairing an omission, not adding a feature.
   *
   * F4's fourth decision gave every fuel write a `broadcast` so that a form
   * window and the shell could not hold different ideas of the same file. It
   * did not reach costs: this was the one write path in the process with
   * nothing after it, so a cost saved in a form window never reached the shell.
   * `service:save` below has the same gap, and F6 closes that one.
   */
  ipcMain.handle('costs:save', (_event, slug: unknown, document: unknown) => {
    saveCosts(String(slug), document as CostDocument)
    broadcast('vehicles:changed')
  })

  /** Append a cost (F5). The id is allocated in the repository — see addCostEntry. */
  ipcMain.handle('cost:add', (_event, slug: unknown, entry: unknown) => {
    const added = addCostEntry(String(slug), readCostInput(entry))
    broadcast('vehicles:changed')
    return added
  })

  /** Edit one cost in place (XTRITIUM §3.8). The rest of the file is untouched. */
  ipcMain.handle('cost:update', (_event, slug: unknown, entry: unknown) => {
    const raw = (entry ?? {}) as Partial<CostEntry>
    const id = typeof raw.id === 'string' ? raw.id : ''
    if (id.length === 0) return false

    const changed = updateCostEntry(String(slug), { ...readCostInput(entry), id })
    if (changed) broadcast('vehicles:changed')
    return changed
  })

  /*
   * The last write path in the process to gain a broadcast. F4 gave fuel one,
   * F5 gave costs one and recorded that this was still missing; with F6 every
   * write in TRITIUM tells the other windows, and no window can go on showing
   * a file as it was when it last rendered.
   */
  ipcMain.handle('service:save', (_event, slug: unknown, document: unknown) => {
    saveService(String(slug), document as ServiceDocument)
    broadcast('vehicles:changed')
  })

  /** Append a service record (F6). The id is allocated in the repository. */
  ipcMain.handle('service:add', (_event, slug: unknown, entry: unknown) => {
    const added = addServiceEntry(String(slug), readServiceInput(entry))
    broadcast('vehicles:changed')
    return added
  })

  /** Edit one service record in place (XTRITIUM §3.8). */
  ipcMain.handle('service:update', (_event, slug: unknown, entry: unknown) => {
    const raw = (entry ?? {}) as Partial<ServiceEntry>
    const id = typeof raw.id === 'string' ? raw.id : ''
    if (id.length === 0) return false

    const changed = updateServiceEntry(String(slug), { ...readServiceInput(entry), id })
    if (changed) broadcast('vehicles:changed')
    return changed
  })

  // Form windows (XTRITIUM §5.1). The renderer asks; this process decides.
  ipcMain.handle('form:open', (_event, kind: unknown, slug: unknown, entry: unknown) => {
    if (!isFormKind(kind)) return
    openFormWindow(
      {
        kind,
        ...(typeof slug === 'string' && slug.length > 0 ? { slug } : {}),
        ...(typeof entry === 'string' && entry.length > 0 ? { entry } : {})
      },
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
    /*
     * Electron builds a default application menu when an app never sets one —
     * File, Edit, View, Window, carrying Reload, Force Reload, Toggle Developer
     * Tools and a zoom control. TRITIUM had it all along: autoHideMenuBar hides
     * the bar but does not remove the menu, so pressing Alt dropped a native
     * menu over the interface, which is exactly the overlay F4b's no-overlap
     * rule exists to forbid — and it offered commands this application never
     * designed and does not want.
     *
     * Removing it is what makes the rule true rather than merely hidden. The
     * clipboard does not depend on it: Chromium implements the editing commands
     * in the renderer, so cut, copy, paste and select-all survive with no menu
     * at all, which tests/e2e/clipboard.spec.ts asserts rather than assumes.
     */
    Menu.setApplicationMenu(null)

    registerIpc()
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
