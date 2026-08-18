// The settings store. It starts from the values the main process already read
// off disk (handed over by the preload), so the first frame is already correct.
// Every change goes straight back to disk through the atomic helper in the main
// process — there is no other write path (XTRITIUM §4.1).

import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Language, type Palette, type Settings } from '../../shared/settings.js'
import { applyLanguage, applyWindowTitle } from '../i18n/index.js'

interface SettingsStore extends Settings {
  setLanguage: (language: Language) => void
  setPalette: (palette: Palette) => void
  setActiveVehicle: (slug: string) => void
  setCurrency: (currency: string) => void
}

export function applyToDocument(settings: Settings): void {
  document.documentElement.dataset['palette'] = settings.palette
  document.documentElement.lang = settings.language
  applyLanguage(settings.language)
  applyWindowTitle()
}

const initial: Settings = window.tritium?.initialSettings ?? { ...DEFAULT_SETTINGS }

/**
 * The Settings half of the store, without the setters.
 *
 * Spelled out field by field rather than spread: if a later milestone adds a
 * setting, the compiler stops here and asks what to do with it, instead of the
 * field slipping silently through — or silently not.
 */
function currentSettings(store: SettingsStore): Settings {
  return {
    language: store.language,
    ...(store.currency !== undefined ? { currency: store.currency } : {}),
    ...(store.active_vehicle !== undefined ? { active_vehicle: store.active_vehicle } : {}),
    distance: store.distance,
    volume: store.volume,
    consumption: store.consumption,
    decimals_consumption: store.decimals_consumption,
    decimals_cost_per_km: store.decimals_cost_per_km,
    palette: store.palette
  }
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...initial,

  setLanguage: (language) => {
    // The whole record travels, not the one field: currency, units and format
    // are part of Settings from F2 on, and rebuilding it from two keys would
    // send the main process a record with the rest missing.
    const next: Settings = { ...currentSettings(get()), language }
    applyToDocument(next)
    set(next)
    void window.tritium.writeSettings(next)
  },

  setPalette: (palette) => {
    const next: Settings = { ...currentSettings(get()), palette }
    applyToDocument(next)
    set(next)
    void window.tritium.writeSettings(next)
  },

  // These two send ONE field, not the record. Both can be called from a form
  // window, whose copy of the settings was taken when it opened; sending the
  // whole record from there would push a stale palette over one the maker
  // chose in the shell a moment ago. The main process merges over the file.
  setActiveVehicle: (slug) => {
    set({ active_vehicle: slug })
    void window.tritium.writeSettings({ active_vehicle: slug })
  },

  setCurrency: (currency) => {
    set({ currency })
    void window.tritium.writeSettings({ currency })
  }
}))

/**
 * Windows are isolated, so a form opened before a palette switch would keep the
 * palette it was born with. That was invisible while every palette was a
 * placeholder; with eleven real ones it is the first thing anybody would see.
 *
 * The main process already announces every write, so each window follows along
 * and re-applies the two settings that are visible in it. Only the document and
 * this store are touched — never the file. The window that made the change has
 * already written it, and a follower that wrote back would start a conversation
 * between windows that no one ends.
 *
 * The subscription is never torn down on purpose: it lives exactly as long as
 * the window does.
 */
function followSettings(): void {
  if (window.tritium === undefined) return
  window.tritium.onSettingsChanged(() => {
    void window.tritium.readSettings().then((settings) => {
      applyToDocument(settings)
      useSettings.setState(settings)
    })
  })
}

followSettings()

export const initialSettings = initial
