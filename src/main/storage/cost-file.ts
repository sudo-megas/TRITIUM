// costs.toml — İLK ALIŞ, TEKRAR EDEN (except Periyodik Bakım) and manual
// entries (XTRITIUM §4.4, §6.1). Periyodik Bakım lands in service.toml instead.

import { COST_GROUPS, isCostGroup, type CostEntry } from '../../shared/records.js'
import { formatMoney, toMoney } from '../../shared/scaled.js'
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
  readNumber,
  readString
} from './toml.js'

const KNOWN_KEYS = [
  'id',
  'date',
  'group',
  'category',
  'title',
  'amount',
  'income',
  'payment_method',
  'bank',
  'instalment',
  'note'
] as const

export const COST_SPEC: EntrySpec<CostEntry> = {
  kind: 'cost',
  knownKeys: KNOWN_KEYS,
  readEntry: (raw, id) => ({
    id,
    date: readDate(raw['date']),
    // An unrecognised group falls back to manual: the entry is still the
    // maker's, and dropping it would be worse than filing it plainly.
    group: isCostGroup(raw['group']) ? raw['group'] : COST_GROUPS[2],
    category: readString(raw['category']),
    title: readString(raw['title']),
    amount: toMoney(readNumber(raw['amount'])),
    income: readBoolean(raw['income']),
    payment_method: readString(raw['payment_method']),
    bank: readString(raw['bank']),
    instalment: readString(raw['instalment']),
    note: readString(raw['note'])
  }),
  emitEntry: (entry) => [
    line('id', basicString(entry.id)),
    ...dateLines('date', entry.date),
    line('group', basicString(entry.group)),
    line('category', basicString(entry.category)),
    line('title', basicString(entry.title)),
    line('amount', formatMoney(entry.amount)),
    line('income', entry.income ? 'true' : 'false'),
    line('payment_method', basicString(entry.payment_method)),
    line('bank', basicString(entry.bank)),
    line('instalment', basicString(entry.instalment)),
    line('note', basicString(entry.note))
  ]
}

export type CostDocument = EntryDocument<CostEntry>

export function emptyCosts(): CostDocument {
  return emptyDocument<CostEntry>()
}

export function readCosts(file: string): CostDocument {
  return readEntryFile(file, COST_SPEC)
}

export function writeCosts(file: string, document: CostDocument): void {
  writeEntryFile(file, document, COST_SPEC)
}
