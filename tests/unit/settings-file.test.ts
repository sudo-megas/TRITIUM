// settings.toml round-trips: what the maker can read in Neovim is what the app
// reads back, schema_version included, and keys this milestone does not own
// survive. F2 completed the schema, so the fixtures build on DEFAULT_SETTINGS
// rather than naming two fields and hoping the rest do not exist.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  parseSettings,
  readSettings,
  serialiseSettings,
  writeSettings
} from '../../src/main/storage/settings-file.js'
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION } from '../../src/shared/settings.js'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tritium-settings-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('settings.toml', () => {
  it('stamps schema_version on every write', () => {
    const text = serialiseSettings({ ...DEFAULT_SETTINGS, language: 'tr', palette: 'aubergine' })
    const document = parse(text) as Record<string, unknown>
    expect(document['schema_version']).toBe(SETTINGS_SCHEMA_VERSION)
  })

  it('round-trips language and palette', () => {
    const settings = { ...DEFAULT_SETTINGS, language: 'tr', palette: 'catppuccin-mocha' } as const
    const text = serialiseSettings(settings)
    expect(parseSettings(text).settings).toEqual(settings)
  })

  it('writes valid TOML through the atomic helper and reads it back', () => {
    const file = join(dir, 'settings.toml')
    const settings = { ...DEFAULT_SETTINGS, language: 'tr', palette: 'noctalia' } as const
    writeSettings(settings, {}, file)

    const onDisk = readFileSync(file, 'utf8')
    expect(() => parse(onDisk)).not.toThrow()
    expect(readSettings(file).settings).toEqual(settings)
  })

  it('returns defaults when the file does not exist', () => {
    expect(readSettings(join(dir, 'absent.toml')).settings).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults on a corrupt file rather than refusing to open', () => {
    expect(parseSettings('this is not = = toml').settings).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults for unknown values', () => {
    const text = 'schema_version = 1\n[general]\nlanguage = "de"\n[appearance]\npalette = "nope"\n'
    expect(parseSettings(text).settings).toEqual(DEFAULT_SETTINGS)
  })

  it('carries keys F1 does not own untouched', () => {
    const text = [
      'schema_version = 1',
      '[general]',
      'language = "tr"',
      'currency = "TRY"',
      '[units]',
      'distance = "km"',
      '[appearance]',
      'palette = "catppuccin-frappe"',
      ''
    ].join('\n')

    const { settings, unknown } = parseSettings(text)
    const written = serialiseSettings(settings, unknown)
    const document = parse(written) as Record<string, Record<string, unknown>>

    expect(document['general']?.['currency']).toBe('TRY')
    expect(document['units']?.['distance']).toBe('km')
    expect(document['appearance']?.['palette']).toBe('catppuccin-frappe')
  })
})

describe('the vehicle the picker was left on (F3)', () => {
  it('round-trips through settings.toml', () => {
    const text = [
      'schema_version = 1',
      '[general]',
      'language = "en"',
      'currency = "TRY"',
      'active_vehicle = "sportage-1-6-t-gdi"',
      '[appearance]',
      'palette = "default-light"',
      ''
    ].join('\n')

    const { settings, unknown } = parseSettings(text)
    expect(settings.active_vehicle).toBe('sportage-1-6-t-gdi')

    const written = serialiseSettings(settings, unknown)
    const document = parse(written) as Record<string, Record<string, unknown>>
    expect(document['general']?.['active_vehicle']).toBe('sportage-1-6-t-gdi')
  })

  it('is absent, not empty, before a vehicle exists', () => {
    // The same reasoning as currency: a key that is not there yet must not be
    // written as "", or the app would believe it had been answered.
    const { settings, unknown } = parseSettings('schema_version = 1\n[general]\nlanguage = "en"\n')

    expect(settings.active_vehicle).toBeUndefined()
    expect(serialiseSettings(settings, unknown)).not.toContain('active_vehicle')
  })

  it('survives a file that also carries keys this milestone does not know', () => {
    const text = [
      'schema_version = 1',
      '[general]',
      'language = "tr"',
      'active_vehicle = "astra"',
      'nickname = "the blue one"',
      '[appearance]',
      'palette = "noctalia"',
      ''
    ].join('\n')

    const { settings, unknown } = parseSettings(text)
    const written = serialiseSettings(settings, unknown)

    expect(written).toContain('active_vehicle = "astra"')
    expect(written).toContain('nickname = "the blue one"')
  })
})
