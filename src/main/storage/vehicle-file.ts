// vehicle.toml — the vehicle record (XTRITIUM §4.4).
//
// A flat table, not an [[entry]] list: one file, one vehicle. The keys are
// emitted in the order the constitution draws them.
//
// There is NO photo field, and there never will be — vehicles have no photos
// anywhere in TRITIUM.

import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import {
  EMPTY_VEHICLE,
  RECORD_SCHEMA_VERSION,
  type Vehicle,
  type VehicleDocument
} from '../../shared/records.js'
import { formatMoney, formatTank, toMoney, toTank } from '../../shared/scaled.js'
import { writeFileAtomicSync } from './atomic.js'
import { CorruptFileError } from './errors.js'
import {
  asTable,
  basicString,
  carriedLines,
  dateLines,
  line,
  readDate,
  readInteger,
  readNumber,
  readString,
  unknownKeys,
  type TomlTable
} from './toml.js'

const KNOWN_KEYS = [
  'schema_version',
  'name',
  'make',
  'model',
  'year',
  'engine',
  'fuel_spec',
  'plate',
  'vin',
  'tank_capacity_l',
  'purchase_date',
  'purchase_price',
  'registration_date',
  'inspection_due'
] as const

export type { VehicleDocument }
export { EMPTY_VEHICLE }

export function parseVehicle(text: string, file = '<memory>'): VehicleDocument {
  let document: TomlTable
  try {
    document = asTable(parse(text))
  } catch (error) {
    throw new CorruptFileError(file, error)
  }

  const vehicle: Vehicle = {
    name: readString(document['name']),
    make: readString(document['make']),
    model: readString(document['model']),
    year: readInteger(document['year']),
    engine: readString(document['engine']),
    fuel_spec: readString(document['fuel_spec']),
    plate: readString(document['plate']),
    vin: readString(document['vin']),
    tank_capacity_l: toTank(readNumber(document['tank_capacity_l'])),
    purchase_date: readDate(document['purchase_date']),
    purchase_price: toMoney(readNumber(document['purchase_price'])),
    registration_date: readDate(document['registration_date']),
    inspection_due: readDate(document['inspection_due'])
  }

  const schemaVersion =
    typeof document['schema_version'] === 'number'
      ? document['schema_version']
      : RECORD_SCHEMA_VERSION

  return { schemaVersion, vehicle, rest: unknownKeys(document, KNOWN_KEYS) }
}

export function serialiseVehicle(document: VehicleDocument): string {
  const { vehicle } = document
  const parts: string[] = [
    line('schema_version', RECORD_SCHEMA_VERSION.toString()),
    line('name', basicString(vehicle.name)),
    line('make', basicString(vehicle.make)),
    line('model', basicString(vehicle.model)),
    line('year', vehicle.year.toString()),
    line('engine', basicString(vehicle.engine)),
    line('fuel_spec', basicString(vehicle.fuel_spec)),
    line('plate', basicString(vehicle.plate)),
    line('vin', basicString(vehicle.vin)),
    line('tank_capacity_l', formatTank(vehicle.tank_capacity_l)),
    ...dateLines('purchase_date', vehicle.purchase_date),
    line('purchase_price', formatMoney(vehicle.purchase_price)),
    ...dateLines('registration_date', vehicle.registration_date),
    ...dateLines('inspection_due', vehicle.inspection_due)
  ]

  for (const carried of carriedLines(document.rest)) parts.push(carried)

  return `${parts.join('\n')}\n`
}

/** The document, or null when the file is simply not there yet. */
export function readVehicle(file: string): VehicleDocument | null {
  if (!existsSync(file)) return null
  return parseVehicle(readFileSync(file, 'utf8'), file)
}

export function writeVehicle(file: string, document: VehicleDocument): void {
  writeFileAtomicSync(file, serialiseVehicle(document))
}
