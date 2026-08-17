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

export const useSettings = create<SettingsStore>((set, get) => ({
  ...initial,

  setLanguage: (language) => {
    const next: Settings = { language, palette: get().palette }
    applyToDocument(next)
    set(next)
    void window.tritium.writeSettings(next)
  },

  setPalette: (palette) => {
    const next: Settings = { language: get().language, palette }
    applyToDocument(next)
    set(next)
    void window.tritium.writeSettings(next)
  }
}))

export const initialSettings = initial
