// The settings store. It starts from the values the main process already read
// off disk (handed over by the preload), so the first frame is already correct.
// Every change goes straight back to disk through the atomic helper in the main
// process — there is no other write path (XTRITIUM §4.1).

import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Language, type Palette, type Settings } from '../../shared/settings.js'
import { applyLanguage } from '../i18n/index.js'

interface SettingsStore extends Settings {
  setLanguage: (language: Language) => void
  setPalette: (palette: Palette) => void
}

export function applyToDocument(settings: Settings): void {
  document.documentElement.dataset['palette'] = settings.palette
  document.documentElement.lang = settings.language
  applyLanguage(settings.language)
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
  }
}))

export const initialSettings = initial
