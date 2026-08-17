// settings.toml round-trips: what the maker can read in Neovim is what the app
// reads back, schema_version included, and keys F1 does not own survive.

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
    const text = serialiseSettings({ language: 'tr', palette: 'aubergine' })
    const document = parse(text) as Record<string, unknown>
    expect(document['schema_version']).toBe(SETTINGS_SCHEMA_VERSION)
  })

  it('round-trips language and palette', () => {
    const text = serialiseSettings({ language: 'tr', palette: 'p07' })
    expect(parseSettings(text).settings).toEqual({ language: 'tr', palette: 'p07' })
  })

  it('writes valid TOML through the atomic helper and reads it back', () => {
    const file = join(dir, 'settings.toml')
    writeSettings({ language: 'tr', palette: 'p03' }, {}, file)

    const onDisk = readFileSync(file, 'utf8')
    expect(() => parse(onDisk)).not.toThrow()
    expect(readSettings(file).settings).toEqual({ language: 'tr', palette: 'p03' })
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
      'palette = "p05"',
      ''
    ].join('\n')

    const { settings, unknown } = parseSettings(text)
    const written = serialiseSettings(settings, unknown)
    const document = parse(written) as Record<string, Record<string, unknown>>

    expect(document['general']?.['currency']).toBe('TRY')
    expect(document['units']?.['distance']).toBe('km')
    expect(document['appearance']?.['palette']).toBe('p05')
  })
})
