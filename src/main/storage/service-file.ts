// service.toml — Periyodik Bakım, the PERİYODİK BAKIM sheet's shape
// (XTRITIUM §4.4, §6.2).
//
// `vendor` holds a pasted address. It is selectable text only and never a link
// (§3.5): nothing in TRITIUM opens a browser, so the storage layer treats it as
// the plain string it is and asks no questions about its contents.

import type { ServiceEntry } from '../../shared/records.js'
import { formatMoney, toMoney } from '../../shared/scaled.js'
import {
  emptyDocument,
  readEntryFile,
  writeEntryFile,
  type EntryDocument,
  type EntrySpec
} from './entry-file.js'
import { basicString, dateLines, line, readDate, readInteger, readNumber, readString } from './toml.js'

const KNOWN_KEYS = ['id', 'date', 'part', 'odometer_km', 'amount', 'vendor'] as const

export const SERVICE_SPEC: EntrySpec<ServiceEntry> = {
  kind: 'service',
  knownKeys: KNOWN_KEYS,
  readEntry: (raw, id) => ({
    id,
    date: readDate(raw['date']),
    part: readString(raw['part']),
    odometer_km: readInteger(raw['odometer_km']),
    amount: toMoney(readNumber(raw['amount'])),
    vendor: readString(raw['vendor'])
  }),
  emitEntry: (entry) => [
    line('id', basicString(entry.id)),
    ...dateLines('date', entry.date),
    line('part', basicString(entry.part)),
    line('odometer_km', entry.odometer_km.toString()),
    line('amount', formatMoney(entry.amount)),
    line('vendor', basicString(entry.vendor))
  ]
}

export type ServiceDocument = EntryDocument<ServiceEntry>

export function emptyService(): ServiceDocument {
  return emptyDocument<ServiceEntry>()
}

export function readService(file: string): ServiceDocument {
  return readEntryFile(file, SERVICE_SPEC)
}

export function writeService(file: string, document: ServiceDocument): void {
  writeEntryFile(file, document, SERVICE_SPEC)
}
