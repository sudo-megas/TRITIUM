// The whole bridge: the settings the main process already read from disk, the
// two calls that read and write them, and — from F2 — an enumerated set of
// storage calls. Nothing else crosses. There is no generic "invoke anything"
// channel, on purpose: every capability the renderer has is listed right here.

import { contextBridge, ipcRenderer } from 'electron'
import {
  DEFAULT_SETTINGS,
  isConsumptionUnit,
  isCurrency,
  isDistanceUnit,
  isLanguage,
  isPalette,
  isVolumeUnit,
  readDecimals,
  type Settings
} from '../shared/settings.js'

const SETTINGS_ARG = '--tritium-settings='

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

const api = {
  initialSettings: initialSettings(),
  readSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:read'),
  writeSettings: (settings: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:write', settings),

  // Storage (F2). No renderer code consumes these yet — F3 is their first
  // customer. A call that hits an unparseable file rejects rather than
  // resolving to nothing, so the caller reports it and the file is left alone.
  listVehicles: (): Promise<string[]> => ipcRenderer.invoke('vehicles:list'),
  loadVehicle: (slug: string): Promise<unknown> => ipcRenderer.invoke('vehicle:load', slug),
  saveVehicle: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('vehicle:save', slug, document),
  saveFuel: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('fuel:save', slug, document),
  saveCosts: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('costs:save', slug, document),
  saveService: (slug: string, document: unknown): Promise<void> =>
    ipcRenderer.invoke('service:save', slug, document)
}

export type TritiumApi = typeof api

contextBridge.exposeInMainWorld('tritium', api)
