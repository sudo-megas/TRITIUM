// The settings contract, shared by main, preload and renderer.
// XTRITIUM §4.2 — every file carries schema_version at the top.
// XTRITIUM §4.4 — F1 owned [general].language and [appearance].palette; F2
// completes the file: currency, [units] and [format]. The UI for units and
// format is F11's, and the first-launch currency question is F3's — F2 owns
// only the schema they will write through.

export const SETTINGS_SCHEMA_VERSION = 1

/**
 * How the stored settings reach a renderer: on the command line, read before
 * the window exists, so the first frame is already painted in the right palette
 * and language (XTRITIUM §3.2). Declared here because main writes it and the
 * preload reads it, and two copies of the same string is one typo away from a
 * window that silently starts on the defaults.
 */
export const SETTINGS_ARG = '--tritium-settings='

export const LANGUAGES = ['en', 'tr'] as const
export type Language = (typeof LANGUAGES)[number]

/**
 * Eleven palettes: ten ported from JADEITE plus Ubuntu Aubergine (XTRITIUM §8).
 * The order here is the order they are offered in, and the id is what lands in
 * settings.toml — the maker edits that file by hand, so the ids are the real
 * names rather than a numbering.
 */
export const PALETTES = [
  'default-light',
  'default-dark',
  'noctalia',
  'catppuccin-latte',
  'catppuccin-frappe',
  'catppuccin-macchiato',
  'catppuccin-mocha',
  'rose-pine-dawn',
  'nord',
  'kanagawa-lotus',
  'aubergine'
] as const
export type Palette = (typeof PALETTES)[number]

/**
 * Whether each palette is a light or a dark one (F15).
 *
 * F4b settled this when it chose them — "Six dark, four light" of the ten
 * ported, plus Aubergine — and palettes.css records it per block, but nothing
 * ever put it on screen. The picker showed eleven unlabelled rectangles and the
 * maker had to guess which was which, and whether a given one would turn the
 * application light or dark before clicking it.
 *
 * It lives beside PALETTES rather than in the catalogue because it is a fact
 * about the palette, not a translation of one: Nord is dark in every language.
 */
export const PALETTE_SCHEMES: Readonly<Record<Palette, 'light' | 'dark'>> = {
  'default-light': 'light',
  'default-dark': 'dark',
  noctalia: 'dark',
  'catppuccin-latte': 'light',
  'catppuccin-frappe': 'dark',
  'catppuccin-macchiato': 'dark',
  'catppuccin-mocha': 'dark',
  'rose-pine-dawn': 'light',
  nord: 'dark',
  'kanagawa-lotus': 'light',
  aubergine: 'dark'
}

/** XTRITIUM §4.4 [units] — each independent of language, each persisted. */
export const DISTANCE_UNITS = ['km', 'mi'] as const
export type DistanceUnit = (typeof DISTANCE_UNITS)[number]

export const VOLUME_UNITS = ['l', 'gal'] as const
export type VolumeUnit = (typeof VOLUME_UNITS)[number]

export const CONSUMPTION_UNITS = ['l100km', 'kml', 'mpg'] as const
export type ConsumptionUnit = (typeof CONSUMPTION_UNITS)[number]

/**
 * The three §4.4 ships. The maker's own list starts here and F11 lets him
 * change it; `records.ts` keeps the same three as the vocabulary a cost file is
 * read against, which is a different question and stays where it is.
 */
export const SHIPPED_PAYMENT_METHODS = ['eft', 'kredi-karti', 'banka-karti'] as const

export interface Settings {
  language: Language
  /**
   * Asked ONCE at first launch, then fixed forever — no exchange rates, no
   * conversion, ever (§4.4).
   *
   * It is OPTIONAL on purpose. §4.4 samples `currency = "TRY"` because it shows
   * a file that has already been through first launch; a fresh file has no
   * currency at all. If this carried a default, F3's ask-once question would
   * arrive to find itself already answered.
   */
  currency?: string
  /**
   * The vehicle the picker was left on. XTRITIUM §4.4 does not draw this key;
   * F3 adds it, because §3.2 says the app opens straight into the data and a
   * picker that forgets which vehicle that was is not straight into anything.
   *
   * Optional: absent before the first vehicle exists, and absent again if the
   * slug it named has been removed from disk by hand.
   */
  active_vehicle?: string
  distance: DistanceUnit
  volume: VolumeUnit
  consumption: ConsumptionUnit
  decimals_consumption: number
  decimals_cost_per_km: number
  /**
   * XTRITIUM §4.4 calls `payment_method` an "editable list", and F5 shipped the
   * three fixed because editing is a settings surface. F11 makes it editable.
   *
   * Removing one never touches a record that uses it: F5's cost form already
   * keeps a stored value that is not in the list (its decision 5), which is what
   * makes removal safe rather than destructive.
   */
  payment_methods: string[]
  palette: Palette
}

export const DEFAULT_SETTINGS: Settings = {
  // XTRITIUM §3.6 — English on first launch, never detected.
  language: 'en',
  distance: 'km',
  volume: 'l',
  consumption: 'l100km',
  decimals_consumption: 2,
  decimals_cost_per_km: 3,
  payment_methods: [...SHIPPED_PAYMENT_METHODS],
  // The constitution fixes the count and the roster but never named the one
  // the app opens on. Dark, because the interface is dense figures on a ground
  // that should stay out of their way.
  palette: 'default-dark'
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export function isPalette(value: unknown): value is Palette {
  return typeof value === 'string' && (PALETTES as readonly string[]).includes(value)
}

export function isDistanceUnit(value: unknown): value is DistanceUnit {
  return typeof value === 'string' && (DISTANCE_UNITS as readonly string[]).includes(value)
}

export function isVolumeUnit(value: unknown): value is VolumeUnit {
  return typeof value === 'string' && (VOLUME_UNITS as readonly string[]).includes(value)
}

export function isConsumptionUnit(value: unknown): value is ConsumptionUnit {
  return typeof value === 'string' && (CONSUMPTION_UNITS as readonly string[]).includes(value)
}

/** A currency is whatever the maker answered once — non-empty text, nothing more. */
export function isCurrency(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** A vehicle slug, as stored in active_vehicle. Any non-empty name of a directory. */
export function isVehicleSlug(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * The maker's payment-method list, as it comes off disk or over the bridge.
 *
 * Non-empty strings only, de-duplicated, order kept. An absent or unreadable
 * key falls back to the three §4.4 ships — but an EMPTY list is honoured: a
 * maker who removed all three meant to, and inventing them back would be the
 * app arguing with him (§3.8).
 */
export function readPaymentMethods(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]

  const cleaned: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (trimmed.length > 0 && !cleaned.includes(trimmed)) cleaned.push(trimmed)
  }
  return cleaned
}

/** Decimal places: a small non-negative integer, or the default. */
export function readDecimals(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  return rounded >= 0 && rounded <= 6 ? rounded : fallback
}
