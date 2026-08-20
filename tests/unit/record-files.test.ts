// The four record files against XTRITIUM §4.4.
//
// Two things are checked of every serialiser: that its output is what §4.4
// draws, character for character, and that smol-toml can parse that output
// back. Fixture-identical but invalid TOML would pass the first check alone.

import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RECORD_SCHEMA_VERSION, nextId } from '../../src/shared/records.js'
import { toMoney, toPump, toTank } from '../../src/shared/scaled.js'
import { CorruptFileError } from '../../src/main/storage/errors.js'
import { FUEL_SPEC, readFuel, writeFuel } from '../../src/main/storage/fuel-file.js'
import { COST_SPEC, readCosts, writeCosts } from '../../src/main/storage/cost-file.js'
import { SERVICE_SPEC, readService, writeService } from '../../src/main/storage/service-file.js'
import {
  parseVehicle,
  readVehicle,
  serialiseVehicle,
  writeVehicle
} from '../../src/main/storage/vehicle-file.js'
import { parseEntryDocument, serialiseEntryDocument } from '../../src/main/storage/entry-file.js'
import { COSTS_SAMPLE, FUEL_SAMPLE, SERVICE_SAMPLE, VEHICLE_SAMPLE } from './samples.js'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tritium-records-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('fuel.toml', () => {
  it('writes the XTRITIUM §4.4 sample exactly, and parses back as TOML', () => {
    const document = parseEntryDocument(FUEL_SAMPLE, FUEL_SPEC)
    const written = serialiseEntryDocument(document, FUEL_SPEC)

    expect(written).toBe(FUEL_SAMPLE)
    expect(() => parse(written)).not.toThrow()
  })

  it('reads the figures into scaled integers', () => {
    const [entry] = parseEntryDocument(FUEL_SAMPLE, FUEL_SPEC).entries
    expect(entry?.litres).toBe(toPump(29.99))
    expect(entry?.price_per_litre).toBe(toPump(73.38))
    expect(entry?.odometer_km).toBe(19764)
    expect(entry?.full_tank).toBe(true)
  })

  it('drops a stored total — it is derived and never stored', () => {
    const withTotal = FUEL_SAMPLE.replace('full_tank = true', 'total = 2200.67\nfull_tank = true')
    const document = parseEntryDocument(withTotal, FUEL_SPEC)

    expect(serialiseEntryDocument(document, FUEL_SPEC)).not.toContain('total')
    expect(serialiseEntryDocument(document, FUEL_SPEC)).toBe(FUEL_SAMPLE)
  })

  it('keeps the date on the day it was written, whatever the timezone', () => {
    const [entry] = parseEntryDocument(FUEL_SAMPLE, FUEL_SPEC).entries
    expect(entry?.date).toBe('2026-08-16')
  })
})

describe('costs.toml', () => {
  it('writes the XTRITIUM §4.4 sample exactly, and parses back as TOML', () => {
    const document = parseEntryDocument(COSTS_SAMPLE, COST_SPEC)
    const written = serialiseEntryDocument(document, COST_SPEC)

    expect(written).toBe(COSTS_SAMPLE)
    expect(() => parse(written)).not.toThrow()
  })

  it('keeps Turkish text readable rather than escaping it', () => {
    const written = serialiseEntryDocument(parseEntryDocument(COSTS_SAMPLE, COST_SPEC), COST_SPEC)
    expect(written).toContain('Trafik Sigortası 26/27')
  })
})

describe('service.toml', () => {
  it('writes the XTRITIUM §4.4 sample exactly, and parses back as TOML', () => {
    const document = parseEntryDocument(SERVICE_SAMPLE, SERVICE_SPEC)
    const written = serialiseEntryDocument(document, SERVICE_SPEC)

    expect(written).toBe(SERVICE_SAMPLE)
    expect(() => parse(written)).not.toThrow()
  })

  it('treats the vendor address as the plain text it is', () => {
    const [entry] = parseEntryDocument(SERVICE_SAMPLE, SERVICE_SPEC).entries
    expect(entry?.vendor).toBe('https://www.lastikcim.com.tr/')
  })
})

describe('vehicle.toml', () => {
  it('writes the XTRITIUM §4.4 sample exactly, and parses back as TOML', () => {
    const document = parseVehicle(VEHICLE_SAMPLE)
    const written = serialiseVehicle(document)

    expect(written).toBe(VEHICLE_SAMPLE)
    expect(() => parse(written)).not.toThrow()
  })

  it('reads tank capacity at one decimal and the price at two', () => {
    const { vehicle } = parseVehicle(VEHICLE_SAMPLE)
    expect(vehicle.tank_capacity_l).toBe(toTank(54))
    expect(vehicle.purchase_price).toBe(toMoney(2160000))
  })

  it('has no photo field, and gains none from a file that carries one', () => {
    const written = serialiseVehicle(parseVehicle(`${VEHICLE_SAMPLE}photo = "car.jpg"\n`))
    // The key is unrecognised, so it is preserved — but it is not a field.
    expect(written).toContain('photo = "car.jpg"')
    expect(Object.keys(parseVehicle(VEHICLE_SAMPLE).vehicle)).not.toContain('photo')
  })
})

describe('schema versions', () => {
  it('stamps the current version on every write', () => {
    const written = serialiseEntryDocument(parseEntryDocument(FUEL_SAMPLE, FUEL_SPEC), FUEL_SPEC)
    expect(written.startsWith(`schema_version = ${RECORD_SCHEMA_VERSION}`)).toBe(true)
  })

  it('upgrades an older file in memory and writes it back at the current version', () => {
    const older = FUEL_SAMPLE.replace('schema_version = 1', 'schema_version = 0')
    const document = parseEntryDocument(older, FUEL_SPEC)

    expect(document.schemaVersion).toBe(0)
    expect(serialiseEntryDocument(document, FUEL_SPEC)).toBe(FUEL_SAMPLE)
  })
})

describe('keys this milestone does not own', () => {
  it('carries an unknown entry key through a read-modify-write', () => {
    const withExtra = FUEL_SAMPLE.replace(
      'fuel_type = "Kurşunsuz 95"',
      'fuel_type = "Kurşunsuz 95"\nstation = "Opet Beşiktaş"'
    )
    const written = serialiseEntryDocument(parseEntryDocument(withExtra, FUEL_SPEC), FUEL_SPEC)

    expect(written).toContain('station = "Opet Beşiktaş"')
    expect(() => parse(written)).not.toThrow()
  })

  it('carries an unknown top-level key too', () => {
    const withExtra = `${FUEL_SAMPLE}\nnote = "hand written"\n`
    const written = serialiseEntryDocument(parseEntryDocument(withExtra, FUEL_SPEC), FUEL_SPEC)

    expect(written).toContain('note = "hand written"')
    expect(() => parse(written)).not.toThrow()
  })
})

describe('a file that will not parse', () => {
  it('is reported and left byte-for-byte alone', () => {
    const file = join(dir, 'fuel.toml')
    const corrupt = 'schema_version = 1\n[[entry\nid = "f-0001"\n'
    writeFileSync(file, corrupt)

    expect(() => readFuel(file)).toThrow(CorruptFileError)
    // The app never overwrites what it could not read: the maker can still
    // repair this by hand, and the entries are all still in it.
    expect(readFileSync(file, 'utf8')).toBe(corrupt)
  })

  it('refuses the same way for every record type', () => {
    const corrupt = 'schema_version = 1\n[[entry\n'
    for (const [name, read] of [
      ['costs.toml', readCosts],
      ['service.toml', readService]
    ] as const) {
      const file = join(dir, name)
      writeFileSync(file, corrupt)
      expect(() => read(file)).toThrow(CorruptFileError)
    }

    const vehicleFile = join(dir, 'vehicle.toml')
    writeFileSync(vehicleFile, 'name = "unclosed\n')
    expect(() => readVehicle(vehicleFile)).toThrow(CorruptFileError)
  })
})

describe('reading and writing through the atomic helper', () => {
  it('round-trips every record type on disk', () => {
    const fuelFile = join(dir, 'fuel.toml')
    writeFuel(fuelFile, parseEntryDocument(FUEL_SAMPLE, FUEL_SPEC))
    expect(readFileSync(fuelFile, 'utf8')).toBe(FUEL_SAMPLE)
    expect(readFuel(fuelFile).entries).toHaveLength(1)

    const costsFile = join(dir, 'costs.toml')
    writeCosts(costsFile, parseEntryDocument(COSTS_SAMPLE, COST_SPEC))
    expect(readFileSync(costsFile, 'utf8')).toBe(COSTS_SAMPLE)

    const serviceFile = join(dir, 'service.toml')
    writeService(serviceFile, parseEntryDocument(SERVICE_SAMPLE, SERVICE_SPEC))
    expect(readFileSync(serviceFile, 'utf8')).toBe(SERVICE_SAMPLE)

    const vehicleFile = join(dir, 'vehicle.toml')
    writeVehicle(vehicleFile, parseVehicle(VEHICLE_SAMPLE))
    expect(readFileSync(vehicleFile, 'utf8')).toBe(VEHICLE_SAMPLE)
  })

  it('returns an empty document for a vehicle with no entries yet', () => {
    expect(readFuel(join(dir, 'absent.toml')).entries).toEqual([])
    expect(readVehicle(join(dir, 'absent.toml'))).toBeNull()
  })
})

describe('ids', () => {
  it('continues from the highest id in the file, not from the count', () => {
    const gapped = FUEL_SAMPLE.replace('id = "f-0001"', 'id = "f-0007"')
    const { entries } = parseEntryDocument(gapped, FUEL_SPEC)

    expect(nextId('fuel', entries)).toBe('f-0008')
  })

  it('gives an entry that arrived without one', () => {
    const missing = FUEL_SAMPLE.replace('id = "f-0001"\n', '')
    const { entries } = parseEntryDocument(missing, FUEL_SPEC)

    expect(entries[0]?.id).toBe('f-0001')
  })

  it('re-allocates a duplicate id instead of keeping two entries under one', () => {
    // A copy-pasted [[entry]] block with the id left unchanged — as unsafe
    // as no id at all, since entryRest and every downstream id-keyed lookup
    // assume ids are unique within the file.
    const duplicated = `schema_version = 1

[[entry]]
id = "f-0001"
date = 2026-08-16
odometer_km = 19764
litres = 29.990
price_per_litre = 73.380
full_tank = true
fuel_type = "Kurşunsuz 95"

[[entry]]
id = "f-0001"
date = 2026-08-30
odometer_km = 20100
litres = 31.500
price_per_litre = 74.100
full_tank = true
fuel_type = "Kurşunsuz 95"
`
    const { entries } = parseEntryDocument(duplicated, FUEL_SPEC)

    expect(entries).toHaveLength(2)
    const ids = entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).toContain('f-0001')
  })
})

describe('a record file killed mid-write', () => {
  it('leaves the previous fuel.toml whole and still readable', async () => {
    // XTRITIUM §4.1 — the guarantee F1 proved for settings.toml, held now
    // against the file that actually carries the maker's fill-ups. A power cut
    // yields the old file or the new one, never half of either.
    const helper = fileURLToPath(new URL('./helpers/kill-mid-write.ts', import.meta.url))
    const target = join(dir, 'fuel.toml')
    const bytes = 96 * 1024 * 1024

    let torn = 0
    let killedBeforeRename = 0

    for (let attempt = 0; attempt < 3; attempt += 1) {
      writeFuel(target, parseEntryDocument(FUEL_SAMPLE, FUEL_SPEC))

      await new Promise<void>((resolve) => {
        const child = spawn(process.execPath, [helper, target, String(bytes)], { stdio: 'pipe' })
        child.stdout.once('data', () => {
          setTimeout(() => child.kill('SIGKILL'), 2)
        })
        child.once('exit', () => resolve())
      })

      const after = readFileSync(target, 'utf8')
      if (after === FUEL_SAMPLE) {
        killedBeforeRename += 1
        // Not merely the same bytes: still a fuel document, entry and all.
        expect(readFuel(target).entries[0]?.id).toBe('f-0001')
      } else if (after !== 'x'.repeat(bytes)) {
        torn += 1
      }

      for (const entry of readdirSync(dir)) {
        if (entry !== 'fuel.toml') rmSync(join(dir, entry), { force: true })
      }
    }

    expect(torn).toBe(0)
    expect(killedBeforeRename).toBeGreaterThan(0)
  }, 60_000)
})
