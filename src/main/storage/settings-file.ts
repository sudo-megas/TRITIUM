// settings.toml — read at launch, written back through the atomic helper.
//
// XTRITIUM §4.1: whole file in, whole file out.
// XTRITIUM §4.2: schema_version rides at the top; an older file is upgraded in
// memory and written back on the next save.
//
// F1 owned language and palette. F2 completes the file to §4.4 — currency,
// [units], [format] — and keeps the carry-through mechanism for whatever keys
// later milestones invent. Plaintext the maker can repair in Neovim must never
// lose a line because this milestone did not recognise it.
//
// Unlike the record files, a corrupt settings.toml falls back to defaults
// rather than raising: losing a palette choice costs nothing, and the app must
// still open. See errors.ts for why the data files refuse that bargain.

import { existsSync, readFileSync } from 'node:fs'
import { parse, stringify } from 'smol-toml'
import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  isConsumptionUnit,
  isCurrency,
  isDistanceUnit,
  isLanguage,
  isPalette,
  isVolumeUnit,
  readDecimals,
  type Settings
} from '../../shared/settings.js'
import { writeFileAtomicSync } from './atomic.js'
import { settingsPath } from './paths.js'

type TomlTable = Record<string, unknown>

const TABLES = ['general', 'units', 'format', 'appearance'] as const
const OWNED: Readonly<Record<(typeof TABLES)[number], readonly string[]>> = {
  general: ['language', 'currency'],
  units: ['distance', 'volume', 'consumption'],
  format: ['decimals_consumption', 'decimals_cost_per_km'],
  appearance: ['palette']
}

function asTable(value: unknown): TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TomlTable)
    : {}
}

function restOf(table: TomlTable, owned: readonly string[]): TomlTable {
  const rest: TomlTable = {}
  for (const [key, value] of Object.entries(table)) {
    if (!owned.includes(key)) rest[key] = value
  }
  return rest
}

/** Parse a settings document, falling back to defaults for anything unreadable. */
export function parseSettings(text: string): { settings: Settings; unknown: TomlTable } {
  let document: TomlTable
  try {
    document = asTable(parse(text))
  } catch {
    // A corrupt file must not stop the app from opening straight into the data.
    return { settings: { ...DEFAULT_SETTINGS }, unknown: {} }
  }

  const general = asTable(document['general'])
  const units = asTable(document['units'])
  const format = asTable(document['format'])
  const appearance = asTable(document['appearance'])

  const settings: Settings = {
    language: isLanguage(general['language']) ? general['language'] : DEFAULT_SETTINGS.language,
    // Absent until F3 asks the question once — never defaulted here.
    ...(isCurrency(general['currency']) ? { currency: general['currency'] } : {}),
    distance: isDistanceUnit(units['distance']) ? units['distance'] : DEFAULT_SETTINGS.distance,
    volume: isVolumeUnit(units['volume']) ? units['volume'] : DEFAULT_SETTINGS.volume,
    consumption: isConsumptionUnit(units['consumption'])
      ? units['consumption']
      : DEFAULT_SETTINGS.consumption,
    decimals_consumption: readDecimals(
      format['decimals_consumption'],
      DEFAULT_SETTINGS.decimals_consumption
    ),
    decimals_cost_per_km: readDecimals(
      format['decimals_cost_per_km'],
      DEFAULT_SETTINGS.decimals_cost_per_km
    ),
    palette: isPalette(appearance['palette']) ? appearance['palette'] : DEFAULT_SETTINGS.palette
  }

  const unknown: TomlTable = {}
  for (const [key, value] of Object.entries(document)) {
    if (key === 'schema_version' || (TABLES as readonly string[]).includes(key)) continue
    unknown[key] = value
  }

  // Preserve sibling keys inside the tables this milestone does touch.
  for (const table of TABLES) {
    const rest = restOf(asTable(document[table]), OWNED[table])
    if (Object.keys(rest).length > 0) unknown[`__${table}_rest`] = rest
  }

  return { settings, unknown }
}

/** Render a settings document: schema_version first, then the tables in §4.4's order. */
export function serialiseSettings(settings: Settings, unknown: TomlTable = {}): string {
  const document: TomlTable = { schema_version: SETTINGS_SCHEMA_VERSION }

  for (const [key, value] of Object.entries(unknown)) {
    if (key.startsWith('__') && key.endsWith('_rest')) continue
    document[key] = value
  }

  document['general'] = {
    language: settings.language,
    ...(settings.currency !== undefined ? { currency: settings.currency } : {}),
    ...asTable(unknown['__general_rest'])
  }
  document['units'] = {
    distance: settings.distance,
    volume: settings.volume,
    consumption: settings.consumption,
    ...asTable(unknown['__units_rest'])
  }
  document['format'] = {
    decimals_consumption: settings.decimals_consumption,
    decimals_cost_per_km: settings.decimals_cost_per_km,
    ...asTable(unknown['__format_rest'])
  }
  document['appearance'] = {
    palette: settings.palette,
    ...asTable(unknown['__appearance_rest'])
  }

  return `${stringify(document)}\n`
}

export function readSettings(file: string = settingsPath()): {
  settings: Settings
  unknown: TomlTable
} {
  if (!existsSync(file)) return { settings: { ...DEFAULT_SETTINGS }, unknown: {} }
  return parseSettings(readFileSync(file, 'utf8'))
}

export function writeSettings(
  settings: Settings,
  unknown: TomlTable = {},
  file: string = settingsPath()
): void {
  writeFileAtomicSync(file, serialiseSettings(settings, unknown))
}
