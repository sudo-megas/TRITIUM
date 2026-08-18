// XTRITIUM §8 — how figures and dates are shown, in BOTH languages:
// `1.234,56 ₺` and `GG/AA/YYYY`.
//
// This is a family convention, not a locale. It is written by hand rather than
// asked of Intl, because a locale-aware formatter renders the same number
// differently on a machine set to en_US — exactly the ambient dependency §3.6
// forbids, and exactly what audit-locale fails the build over.
//
// The module reads as well as writes: a figure typed into a form, stored, and
// shown again must be the same figure, so parseInput is the inverse of
// formatFigure and both go through the scaled integers of §4.3.

import { toScaled, formatScaled } from './scaled.js'
import { isDateString } from './records.js'

const GROUP = '.'
const DECIMAL = ','

/**
 * Currency symbols for the codes worth spelling out. The currency is asked once
 * as free text (§8), so an unrecognised code prints as itself rather than being
 * refused — TRITIUM never claims to know every currency, and it never converts
 * between any of them.
 */
const SYMBOLS: Record<string, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£'
}

export function currencySymbol(code: string): string {
  return SYMBOLS[code.trim().toUpperCase()] ?? code.trim()
}

/** Group the integer part in threes: 1234567 -> 1.234.567 */
function group(digits: string): string {
  let out = ''
  for (let index = digits.length; index > 0; index -= 3) {
    const start = Math.max(0, index - 3)
    out = digits.slice(start, index) + (out === '' ? '' : GROUP + out)
  }
  return out === '' ? '0' : out
}

/**
 * A scaled integer as the maker reads it: `1.234,56`.
 *
 * Built from formatScaled's fixed-decimal text, so it inherits that function's
 * one guarantee — the digits come from the integer, never from a float's
 * toString, and a trailing zero is a real trailing zero.
 */
export function formatFigure(scaled: number, decimals: number): string {
  const fixed = formatScaled(scaled, decimals)
  const negative = fixed.startsWith('-')
  const body = negative ? fixed.slice(1) : fixed
  const [whole = '0', fraction] = body.split('.')
  const grouped = group(whole)
  const text = fraction === undefined ? grouped : `${grouped}${DECIMAL}${fraction}`
  return negative ? `-${text}` : text
}

/**
 * A money figure with its symbol: `1.234,56 ₺`.
 *
 * With no currency yet — the question of §8 asked but not answered — the figure
 * stands alone rather than trailing an empty space where a symbol will go.
 */
export function formatMoneyText(scaled: number, currency: string): string {
  const symbol = currencySymbol(currency)
  const figure = formatFigure(scaled, 2)
  return symbol === '' ? figure : `${figure} ${symbol}`
}

/**
 * Text typed into a form, back to a scaled integer. Returns null for anything
 * that is not a figure, so a caller can tell "nothing entered" from "zero".
 *
 * Both separators are accepted, because both get typed and both get pasted:
 *
 * - both present  -> the LAST one is the decimal, the other groups
 *                    (`1.234,56` and `1,234.56` both read as 1234.56)
 * - one, appearing once     -> the decimal separator (`54,0`, `54.0`)
 * - one, appearing repeatedly -> grouping (`1.234.567`)
 *
 * `1.234` therefore reads as one-point-two-three-four, not as a thousand. The
 * usual heuristic — three digits after a lone dot means grouping — cannot be
 * used here: pump figures carry exactly three decimals (§4.3), so `8.165` is a
 * real price per litre and guessing would corrupt it. Editable fields render
 * through toInput, which never groups, so nothing invites the other reading.
 *
 * The result is rounded to the field's decimals rather than truncated, on the
 * same reasoning as toScaled: truncation quietly loses a cent.
 */
export function parseInput(text: string, decimals: number): number | null {
  const trimmed = text.trim().replace(/\s/g, '')
  if (trimmed === '') return null
  if (!/^-?[\d.,]+$/.test(trimmed)) return null

  const negative = trimmed.startsWith('-')
  const body = negative ? trimmed.slice(1) : trimmed
  if (body === '') return null

  const lastComma = body.lastIndexOf(',')
  const lastDot = body.lastIndexOf('.')

  let decimalAt = -1
  if (lastComma >= 0 && lastDot >= 0) {
    decimalAt = Math.max(lastComma, lastDot)
  } else if (lastComma >= 0) {
    decimalAt = body.indexOf(',') === lastComma ? lastComma : -1
  } else if (lastDot >= 0) {
    decimalAt = body.indexOf('.') === lastDot ? lastDot : -1
  }

  // Separators left in the whole part are grouping, and grouping is threes.
  // `1,2,3` is not a figure in any convention, so it is refused rather than
  // quietly read as 123.
  const wholeRaw = decimalAt >= 0 ? body.slice(0, decimalAt) : body
  if (/[.,]/.test(wholeRaw) && !/^\d{1,3}([.,]\d{3})*$/.test(wholeRaw)) return null

  const whole = wholeRaw.replace(/[.,]/g, '')
  const fraction = decimalAt >= 0 ? body.slice(decimalAt + 1) : ''
  if (fraction.includes('.') || fraction.includes(',')) return null
  if (whole === '' && fraction === '') return null
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null

  const value = Number(`${whole === '' ? '0' : whole}.${fraction === '' ? '0' : fraction}`)
  if (!Number.isFinite(value)) return null

  return toScaled(negative ? -value : value, decimals)
}

/** A scaled integer as an editable field shows it: `54,0` — no grouping. */
export function toInput(scaled: number, decimals: number): string {
  return formatScaled(scaled, decimals).replace('.', DECIMAL)
}

/** `2026-08-16` -> `16/08/2026`. An unparseable date shows as nothing. */
export function formatDate(iso: string): string {
  if (!isDateString(iso)) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/**
 * `16/08/2026` -> `2026-08-16`, or null. The day is checked against the real
 * calendar, so 31/02 is refused rather than rolling into March.
 */
export function parseDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim())
  if (match === null) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  const stamp = new Date(Date.UTC(year, month - 1, day))
  if (
    stamp.getUTCFullYear() !== year ||
    stamp.getUTCMonth() !== month - 1 ||
    stamp.getUTCDate() !== day
  ) {
    return null
  }

  return `${match[3]}-${match[2]}-${match[1]}`
}
