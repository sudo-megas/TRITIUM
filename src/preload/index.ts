// The whole bridge: the settings the main process already read from disk, the
// two calls that read and write them, the storage calls from F2, and from F3
// the form windows and the change notifications. Nothing else crosses.
//
// There is no generic "invoke anything" channel, on purpose: every capability
// the renderer has is listed right here, and stays readable in one screen.

import { contextBridge, ipcRenderer } from 'electron'
import { parseFormRequest, type FormRequest } from '../shared/forms.js'
import {
  DEFAULT_SETTINGS,
  SETTINGS_ARG,
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

/**
 * The main process hands the stored settings over on the command line so the
 * renderer can paint them on its first frame instead of flashing the defaults.
 */
function initialSettings(): Settings {
  const argument = process.argv.find((value) => value.startsWith(SETTINGS_ARG))
  if (argument === undefined) return { ...DEFAULT_SETTINGS }

  try {
    const parsed: unknown = JSON.parse(argument.slice(SETTINGS_ARG.length))
    const candidate = parsed as Partial<Settings>
    return {
      language: isLanguage(candidate.language) ? candidate.language : DEFAULT_SETTINGS.language,
      ...(isCurrency(candidate.currency) ? { currency: candidate.currency } : {}),
      ...(isVehicleSlug(candidate.active_vehicle)
        ? { active_vehicle: candidate.active_vehicle }
        : {}),
      distance: isDistanceUnit(candidate.distance) ? candidate.distance : DEFAULT_SETTINGS.distance,
      volume: isVolumeUnit(candidate.volume) ? candidate.volume : DEFAULT_SETTINGS.volume,
      consumption: isConsumptionUnit(candidate.consumption)
        ? candidate.consumption
        : DEFAULT_SETTINGS.consumption,
      decimals_consumption: readDecimals(
        candidate.decimals_consumption,
        DEFAULT_SETTINGS.decimals_consumption
      ),
      decimals_cost_per_km: readDecimals(
        candidate.decimals_cost_per_km,
        DEFAULT_SETTINGS.decimals_cost_per_km
      ),
      palette: isPalette(candidate.palette) ? candidate.palette : DEFAULT_SETTINGS.palette
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Subscribe to a main-process notification; the returned function unsubscribes. */
function subscribe(channel: string, listener: () => void): () => void {
  const handler = (): void => listener()
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api = {
  initialSettings: initialSettings(),
  /** Null in the main window; the form to draw in a form window (XTRITIUM §5.1). */
  formRequest: parseFormRequest(process.argv) as FormRequest | null,

  readSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:read'),
  writeSettings: (settings: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:write', settings),

  // Storage (F2), joined by vehicle:create (F3). A call that hits an
  // unparseable file rejects rather than resolving to nothing, so the caller
  // reports it and the file is left alone.
  listVehicles: (): Promise<string[]> => ipcRenderer.invoke('vehicles:list'),
  vehicleNames: (): Promise<Record<string, string>> => ipcRenderer.invoke('vehicles:names'),
  loadVehicle: (slug: string): Promise<unknown> => ipcRenderer.invoke('vehicle:load', slug),
  createVehicle: (document: unknown): Promise<string> =>
    ipcRenderer.invoke('vehicle:create', document),
  saveVehicle: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('vehicle:save', slug, document),
  saveFuel: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('fuel:save', slug, document),
  saveCosts: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('costs:save', slug, document),
  saveService: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('service:save', slug, document),

  // Form windows. The renderer asks the main process to open one; window.open
  // is still refused, which is the point of asking.
  openForm: (kind: string, slug?: string): Promise<void> =>
    ipcRenderer.invoke('form:open', kind, slug),
  closeForm: (): Promise<void> => ipcRenderer.invoke('form:close'),

  onVehiclesChanged: (listener: () => void): (() => void) =>
    subscribe('vehicles:changed', listener),
  onSettingsChanged: (listener: () => void): (() => void) =>
    subscribe('settings:changed', listener)
}

export type TritiumApi = typeof api

contextBridge.exposeInMainWorld('tritium', api)
