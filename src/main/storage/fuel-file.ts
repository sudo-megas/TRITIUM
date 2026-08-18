// fuel.toml — one [[entry]] per fill-up (XTRITIUM §4.4).

import type { FuelEntry } from '../../shared/records.js'
import { formatPump, toPump } from '../../shared/scaled.js'
import {
  emptyDocument,
  readEntryFile,
  writeEntryFile,
  type EntryDocument,
  type EntrySpec
} from './entry-file.js'
import {
  basicString,
  dateLines,
  line,
  readBoolean,
  readDate,
  readInteger,
  readNumber,
  readString
} from './toml.js'

/**
 * `total` is listed here as a key we recognise precisely so that it is DROPPED
 * rather than carried: litres × price is derived and never stored (§4.4). A
 * file that arrives with one written in loses it on the next save.
 */
const KNOWN_KEYS = [
  'id',
  'date',
  'odometer_km',
  'litres',
  'price_per_litre',
  'full_tank',
  'fuel_type',
  'total'
] as const

export const FUEL_SPEC: EntrySpec<FuelEntry> = {
  kind: 'fuel',
  knownKeys: KNOWN_KEYS,
  readEntry: (raw, id) => ({
    id,
    date: readDate(raw['date']),
    odometer_km: readInteger(raw['odometer_km']),
    litres: toPump(readNumber(raw['litres'])),
    price_per_litre: toPump(readNumber(raw['price_per_litre'])),
    full_tank: readBoolean(raw['full_tank']),
    fuel_type: readString(raw['fuel_type'])
  }),
  emitEntry: (entry) => [
    line('id', basicString(entry.id)),
    ...dateLines('date', entry.date),
    line('odometer_km', entry.odometer_km.toString()),
    line('litres', formatPump(entry.litres)),
    line('price_per_litre', formatPump(entry.price_per_litre)),
    line('full_tank', entry.full_tank ? 'true' : 'false'),
    line('fuel_type', basicString(entry.fuel_type))
  ]
}

export type FuelDocument = EntryDocument<FuelEntry>

export function emptyFuel(): FuelDocument {
  return emptyDocument<FuelEntry>()
}

export function readFuel(file: string): FuelDocument {
  return readEntryFile(file, FUEL_SPEC)
}

export function writeFuel(file: string, document: FuelDocument): void {
  writeEntryFile(file, document, FUEL_SPEC)
}
