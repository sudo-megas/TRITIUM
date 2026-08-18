// The vehicles the picker offers, and the one being looked at.
//
// XTRITIUM §4.1 — whole files in at once. A vehicle is loaded entire, and the
// store holds that bundle; nothing here reads a file twice or keeps a partial
// copy of one.
//
// XTRITIUM §3.2 — the app opens straight into the data, so the active vehicle
// is the one settings.toml remembers, resolved before the first list arrives.

import { create } from 'zustand'
import type { VehicleBundle } from '../../shared/records.js'
import { useSettings } from './settings.js'

interface VehiclesStore {
  slugs: string[]
  /** Slug to display name. A slug missing from here shows as itself. */
  names: Record<string, string>
  active: string | null
  bundle: VehicleBundle | null
  /**
   * A vehicle whose files would not parse. XTRITIUM §4.4 / F2: the app reports
   * it and leaves the file exactly as it found it — it never offers to "fix"
   * the file by overwriting it.
   */
  error: string | null
  refresh: () => Promise<void>
  select: (slug: string) => Promise<void>
}

async function loadBundle(slug: string): Promise<VehicleBundle> {
  return (await window.tritium.loadVehicle(slug)) as VehicleBundle
}

export const useVehicles = create<VehiclesStore>((set, get) => ({
  slugs: [],
  names: {},
  active: null,
  bundle: null,
  error: null,

  refresh: async () => {
    const [slugs, names] = await Promise.all([
      window.tritium.listVehicles(),
      window.tritium.vehicleNames()
    ])

    // The remembered vehicle, unless it is gone — a directory the maker moved
    // or deleted by hand must not leave the picker pointing at nothing.
    const remembered = useSettings.getState().active_vehicle
    const current = get().active
    const wanted = [current, remembered].find(
      (slug) => slug !== null && slug !== undefined && slugs.includes(slug)
    )
    const active = wanted ?? slugs[0] ?? null

    if (active === null) {
      set({ slugs, names, active: null, bundle: null, error: null })
      return
    }

    try {
      set({ slugs, names, active, bundle: await loadBundle(active), error: null })
    } catch (cause) {
      set({ slugs, names, active, bundle: null, error: String(cause) })
    }
  },

  select: async (slug) => {
    if (!get().slugs.includes(slug)) return

    try {
      set({ active: slug, bundle: await loadBundle(slug), error: null })
    } catch (cause) {
      set({ active: slug, bundle: null, error: String(cause) })
    }

    // Remembered for the next launch. Only this key travels: the merge in the
    // main process keeps every other field from the file, so a form window
    // saving here cannot push a stale palette over one just chosen in the shell.
    useSettings.getState().setActiveVehicle(slug)
  }
}))
