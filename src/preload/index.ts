// The whole bridge: the settings the main process already read from disk, and
// the two calls that read and write them. Nothing else crosses.

import { contextBridge, ipcRenderer } from 'electron'
import { DEFAULT_SETTINGS, isLanguage, isPalette, type Settings } from '../shared/settings.js'

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
      palette: isPalette(candidate.palette) ? candidate.palette : DEFAULT_SETTINGS.palette
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

const api = {
  initialSettings: initialSettings(),
  readSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:read'),
  writeSettings: (settings: Settings): Promise<Settings> =>
    ipcRenderer.invoke('settings:write', settings)
}

export type TritiumApi = typeof api

contextBridge.exposeInMainWorld('tritium', api)
