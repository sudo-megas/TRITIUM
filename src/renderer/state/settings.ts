// The settings store. It starts from the values the main process already read
// off disk (handed over by the preload), so the first frame is already correct.
// Every change goes straight back to disk through the atomic helper in the main
// process — there is no other write path (XTRITIUM §4.1).

import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type ConsumptionUnit,
  type DistanceUnit,
  type Language,
  type Palette,
  type Settings,
  type VolumeUnit
} from '../../shared/settings.js'
import { applyLanguage, applyWindowTitle } from '../i18n/index.js'

interface SettingsStore extends Settings {
  setLanguage: (language: Language) => void
  setPalette: (palette: Palette) => void
  setActiveVehicle: (slug: string) => void
  setCurrency: (currency: string) => void
  // F11. Each sends the WHOLE record for the same reason setLanguage does:
  // Settings has been more than two keys since F2, and rebuilding it from one
  // would hand the main process a record with the rest missing.
  setDistance: (unit: DistanceUnit) => void
  setVolume: (unit: VolumeUnit) => void
  setConsumption: (unit: ConsumptionUnit) => void
  setDecimalsConsumption: (decimals: number) => void
  setDecimalsCostPerKm: (decimals: number) => void
  setPaymentMethods: (methods: string[]) => void
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
    payment_methods: store.payment_methods,
    palette: store.palette
  }
}

/**
 * One field changed, the WHOLE record sent.
 *
 * The same reasoning `setLanguage` gives: Settings has been more than two keys
 * since F2, and rebuilding it from the one field that changed would hand the
 * main process a record with the rest missing. The main process merges anyway,
 * so this is belt and braces — and the braces are what stopped a palette click
 * from erasing the currency in F1.
 */
function write(
  set: (partial: Partial<SettingsStore>) => void,
  get: () => SettingsStore,
  change: Partial<Settings>
): void {
  const next: Settings = { ...currentSettings(get()), ...change }
  set(next)
  void window.tritium.writeSettings(next)
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

  /*
   * F11's settings. None of them touches the document — units and precision
   * change what figures SAY, not how the interface is painted, so unlike the
   * palette and the language there is nothing to re-apply to the root element.
   */
  setDistance: (distance) => write(set, get, { distance }),
  setVolume: (volume) => write(set, get, { volume }),
  setConsumption: (consumption) => write(set, get, { consumption }),
  setDecimalsConsumption: (decimals_consumption) => write(set, get, { decimals_consumption }),
  setDecimalsCostPerKm: (decimals_cost_per_km) => write(set, get, { decimals_cost_per_km }),
  setPaymentMethods: (payment_methods) => write(set, get, { payment_methods }),

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
