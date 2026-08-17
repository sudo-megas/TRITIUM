// The settings contract, shared by main, preload and renderer.
// XTRITIUM §4.2 — every file carries schema_version at the top.
// XTRITIUM §4.4 — F1 owns only [general].language and [appearance].palette;
// currency, units and format arrive with their own milestones and are left
// untouched (but preserved) by the F1 reader and writer.

export const SETTINGS_SCHEMA_VERSION = 1

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

export interface Settings {
  language: Language
  palette: Palette
}

export const DEFAULT_SETTINGS: Settings = {
  // XTRITIUM §3.6 — English on first launch, never detected.
  language: 'en',
  palette: 'p01'
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export function isPalette(value: unknown): value is Palette {
  return typeof value === 'string' && (PALETTES as readonly string[]).includes(value)
}
