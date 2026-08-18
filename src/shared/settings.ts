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
 * The ten JADEITE identities and every palette's real values are design-phase
 * work (XTRITIUM §11) — these ids are provisional and the colours in
 * palettes.css are deliberately wrong so nobody mistakes them for the design.
 */
export const PALETTES = [
  'p01',
  'p02',
  'p03',
  'p04',
  'p05',
  'p06',
  'p07',
  'p08',
  'p09',
  'p10',
  'aubergine'
] as const
export type Palette = (typeof PALETTES)[number]

/** XTRITIUM §4.4 [units] — each independent of language, each persisted. */
export const DISTANCE_UNITS = ['km', 'mi'] as const
export type DistanceUnit = (typeof DISTANCE_UNITS)[number]

export const VOLUME_UNITS = ['l', 'gal'] as const
export type VolumeUnit = (typeof VOLUME_UNITS)[number]

export const CONSUMPTION_UNITS = ['l100km', 'kml', 'mpg'] as const
export type ConsumptionUnit = (typeof CONSUMPTION_UNITS)[number]

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
  palette: 'p01'
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

/** Decimal places: a small non-negative integer, or the default. */
export function readDecimals(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  return rounded >= 0 && rounded <= 6 ? rounded : fallback
}
