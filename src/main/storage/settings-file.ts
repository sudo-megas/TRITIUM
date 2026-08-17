// settings.toml — read at launch, written back through the atomic helper.
//
// XTRITIUM §4.1: whole file in, whole file out.
// XTRITIUM §4.2: schema_version rides at the top; an older file is upgraded in
// memory and written back on the next save.
//
// Keys F1 does not own (currency, units, format — later milestones) are read,
// carried untouched, and written back. Plaintext the maker can repair in Neovim
// must never lose a line because this milestone did not recognise it.

import { existsSync, readFileSync } from 'node:fs'
import { parse, stringify } from 'smol-toml'
import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  isLanguage,
  isPalette,
  type Settings
} from '../../shared/settings.js'
import { writeFileAtomicSync } from './atomic.js'
import { settingsPath } from './paths.js'

type TomlTable = Record<string, unknown>

function asTable(value: unknown): TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TomlTable)
    : {}
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
  const appearance = asTable(document['appearance'])

  const settings: Settings = {
    language: isLanguage(general['language']) ? general['language'] : DEFAULT_SETTINGS.language,
    palette: isPalette(appearance['palette']) ? appearance['palette'] : DEFAULT_SETTINGS.palette
  }

  const unknown: TomlTable = {}
  for (const [key, value] of Object.entries(document)) {
    if (key === 'schema_version' || key === 'general' || key === 'appearance') continue
    unknown[key] = value
  }

  // Preserve sibling keys inside the two tables F1 does touch.
  const generalRest: TomlTable = {}
  for (const [key, value] of Object.entries(general)) {
    if (key !== 'language') generalRest[key] = value
  }
  const appearanceRest: TomlTable = {}
  for (const [key, value] of Object.entries(appearance)) {
    if (key !== 'palette') appearanceRest[key] = value
  }
  if (Object.keys(generalRest).length > 0) unknown['__general_rest'] = generalRest
  if (Object.keys(appearanceRest).length > 0) unknown['__appearance_rest'] = appearanceRest

  return { settings, unknown }
}

/** Render a settings document: schema_version first, then the tables. */
export function serialiseSettings(settings: Settings, unknown: TomlTable = {}): string {
  const generalRest = asTable(unknown['__general_rest'])
  const appearanceRest = asTable(unknown['__appearance_rest'])

  const document: TomlTable = { schema_version: SETTINGS_SCHEMA_VERSION }

  for (const [key, value] of Object.entries(unknown)) {
    if (key === '__general_rest' || key === '__appearance_rest') continue
    document[key] = value
  }

  document['general'] = { language: settings.language, ...generalRest }
  document['appearance'] = { palette: settings.palette, ...appearanceRest }

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
