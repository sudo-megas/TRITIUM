// The shape shared by fuel.toml, costs.toml and service.toml.
//
// All three are the same document: a schema stamp, then a run of [[entry]]
// tables. Only the fields inside an entry differ, so the reading, the id
// allocation, the unknown-key preservation and the emitting live here once, and
// each record file supplies just its own field handling.
//
// This mirrors settings-file.ts (F1) in every respect but one: a corrupt file
// raises CorruptFileError instead of falling back to defaults. See errors.ts.

import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import {
  RECORD_SCHEMA_VERSION,
  type EntryDocument,
  type RecordKind,
  formatId,
  idSequence
} from '../../shared/records.js'
import { writeFileAtomicSync } from './atomic.js'
import { CorruptFileError } from './errors.js'
import { asTable, asTableArray, carriedLines, line, unknownKeys, type TomlTable } from './toml.js'

export type { EntryDocument }

export interface EntrySpec<T extends { id: string }> {
  kind: RecordKind
  /** Every key this milestone recognises. Anything else is carried untouched. */
  knownKeys: readonly string[]
  readEntry: (table: TomlTable, id: string) => T
  /** The entry's lines, in the order XTRITIUM §4.4 draws them. */
  emitEntry: (entry: T) => string[]
}

export function parseEntryDocument<T extends { id: string }>(
  text: string,
  spec: EntrySpec<T>,
  file = '<memory>'
): EntryDocument<T> {
  let document: TomlTable
  try {
    document = asTable(parse(text))
  } catch (error) {
    throw new CorruptFileError(file, error)
  }

  const rawEntries = asTableArray(document['entry'])

  // Ids are allocated from the highest one already present, so a hand-edited
  // file with a gap in the middle cannot produce a duplicate.
  let highest = 0
  for (const raw of rawEntries) {
    const sequence = idSequence(typeof raw['id'] === 'string' ? raw['id'] : '')
    if (sequence > highest) highest = sequence
  }

  const entries: T[] = []
  const entryRest: Record<string, TomlTable> = {}

  for (const raw of rawEntries) {
    let id = typeof raw['id'] === 'string' ? raw['id'] : ''
    if (id.length === 0) {
      highest += 1
      id = formatId(spec.kind, highest)
    }
    entries.push(spec.readEntry(raw, id))
    const rest = unknownKeys(raw, spec.knownKeys)
    if (Object.keys(rest).length > 0) entryRest[id] = rest
  }

  const schemaVersion =
    typeof document['schema_version'] === 'number'
      ? document['schema_version']
      : RECORD_SCHEMA_VERSION

  return {
    schemaVersion,
    entries,
    entryRest,
    rest: unknownKeys(document, ['schema_version', 'entry'])
  }
}

export function serialiseEntryDocument<T extends { id: string }>(
  document: EntryDocument<T>,
  spec: EntrySpec<T>
): string {
  // XTRITIUM §4.2 — the stamp rides first, and it is written at the CURRENT
  // version: an older file read into memory is upgraded by being written back.
  const parts: string[] = [line('schema_version', RECORD_SCHEMA_VERSION.toString())]

  for (const carried of carriedLines(document.rest)) parts.push(carried)

  for (const entry of document.entries) {
    parts.push('', '[[entry]]')
    for (const emitted of spec.emitEntry(entry)) parts.push(emitted)
    const rest = document.entryRest[entry.id]
    if (rest !== undefined) for (const carried of carriedLines(rest)) parts.push(carried)
  }

  return `${parts.join('\n')}\n`
}

export function readEntryFile<T extends { id: string }>(
  file: string,
  spec: EntrySpec<T>
): EntryDocument<T> {
  if (!existsSync(file)) {
    return { schemaVersion: RECORD_SCHEMA_VERSION, entries: [], entryRest: {}, rest: {} }
  }
  return parseEntryDocument(readFileSync(file, 'utf8'), spec, file)
}

export function writeEntryFile<T extends { id: string }>(
  file: string,
  document: EntryDocument<T>,
  spec: EntrySpec<T>
): void {
  writeFileAtomicSync(file, serialiseEntryDocument(document, spec))
}

/** An empty document, for a vehicle that has no entries of this kind yet. */
export function emptyDocument<T>(): EntryDocument<T> {
  return { schemaVersion: RECORD_SCHEMA_VERSION, entries: [], entryRest: {}, rest: {} }
}
