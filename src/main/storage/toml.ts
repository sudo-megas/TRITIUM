// The small TOML layer the record files share.
//
// Reading uses smol-toml. Writing does NOT: XTRITIUM §4.4 fixes the exact text
// of every record file, and a general-purpose serialiser cannot meet it. It
// renders 11746.00 as 11746, drops the trailing zero that makes a money column
// line up, and orders keys however the object happened to be built. So the
// record files emit their own text, key by key, in the order the constitution
// draws them — and every serialiser test parses its own output back through
// smol-toml to prove the result is still valid TOML and not merely pretty.

import { TomlDate } from 'smol-toml'
import { isDateString } from '../../shared/records.js'

export type TomlTable = Record<string, unknown>

export function asTable(value: unknown): TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TomlTable)
    : {}
}

export function asTableArray(value: unknown): TomlTable[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is TomlTable => typeof item === 'object' && item !== null)
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Normalise whatever smol-toml produced for a date into `YYYY-MM-DD`.
 *
 * A TOML local date has no time and no zone. smol-toml hands back a TomlDate,
 * which extends Date — and reading a Date built at local midnight through
 * toISOString() shifts the day backwards for every timezone east of UTC. The
 * date is therefore rebuilt from the local components, never through UTC.
 */
export function readDate(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof TomlDate || value instanceof Date) {
    const year = value.getFullYear().toString().padStart(4, '0')
    const month = (value.getMonth() + 1).toString().padStart(2, '0')
    const day = value.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return ''
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function readInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

export function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function readBoolean(value: unknown): boolean {
  return value === true
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * A TOML basic string.
 *
 * JSON's escaping is a subset of TOML's — quotes, backslashes and control
 * characters come out in a form TOML accepts, and everything else is left
 * alone, so Turkish text and pasted addresses stay readable in the file.
 */
export function basicString(value: string): string {
  return JSON.stringify(value)
}

/**
 * Render an unrecognised value inline.
 *
 * Unknown keys must survive a read-modify-write untouched, and they can appear
 * inside an [[entry]] — where a nested table header would be a syntax error.
 * Everything is therefore rendered as an inline table or array, which is legal
 * wherever a value is legal.
 */
export function inlineValue(value: unknown): string {
  if (typeof value === 'string') return basicString(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isInteger(value) ? value.toString() : value.toString()
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof TomlDate || value instanceof Date) return readDate(value)
  if (Array.isArray(value)) return `[${value.map(inlineValue).join(', ')}]`
  if (typeof value === 'object' && value !== null) {
    const pairs = Object.entries(value).map(([key, item]) => `${key} = ${inlineValue(item)}`)
    return `{ ${pairs.join(', ')} }`
  }
  return '""'
}

/** One `key = value` line, the literal already rendered. */
export function line(key: string, literal: string): string {
  return `${key} = ${literal}`
}

/**
 * A date line, or nothing at all.
 *
 * TOML has no empty date literal, so a field the maker has not filled in — a
 * vehicle with no inspection date yet — is omitted rather than written as a
 * syntax error. Dates are emitted bare: quoting one would turn it into a string
 * and it would never parse back as a date.
 */
export function dateLines(key: string, value: string): string[] {
  return isDateString(value) ? [line(key, value)] : []
}

/**
 * Append the keys this milestone does not recognise, in the order they were
 * read. Plaintext the maker can repair in Neovim must never lose a line
 * because the code that rewrote it did not know what the line was for.
 */
export function carriedLines(rest: TomlTable): string[] {
  return Object.entries(rest).map(([key, value]) => line(key, inlineValue(value)))
}

/** Collect the keys of `table` that are not in `known`. */
export function unknownKeys(table: TomlTable, known: readonly string[]): TomlTable {
  const rest: TomlTable = {}
  for (const [key, value] of Object.entries(table)) {
    if (!known.includes(key)) rest[key] = value
  }
  return rest
}
