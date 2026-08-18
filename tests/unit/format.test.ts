// XTRITIUM §8 — `1.234,56 ₺` and `GG/AA/YYYY`, in both languages, on every
// machine. These assertions are the convention written down: if one fails, the
// app is showing the maker someone else's number format.

import { describe, expect, it } from 'vitest'
import {
  currencySymbol,
  formatDate,
  formatFigure,
  formatMoneyText,
  parseDate,
  parseInput,
  toInput
} from '../../src/shared/format.js'
import {
  MONEY_DECIMALS,
  PUMP_DECIMALS,
  TANK_DECIMALS,
  toMoney,
  toPump,
  toTank
} from '../../src/shared/scaled.js'

describe('figures the family way', () => {
  it('groups with a dot and separates the decimal with a comma', () => {
    expect(formatFigure(toMoney(1234.56), MONEY_DECIMALS)).toBe('1.234,56')
    expect(formatFigure(toMoney(2160000), MONEY_DECIMALS)).toBe('2.160.000,00')
    expect(formatFigure(toMoney(11746), MONEY_DECIMALS)).toBe('11.746,00')
  })

  it('keeps small figures ungrouped and zero-padded', () => {
    expect(formatFigure(toMoney(0), MONEY_DECIMALS)).toBe('0,00')
    expect(formatFigure(toMoney(7.5), MONEY_DECIMALS)).toBe('7,50')
    expect(formatFigure(toTank(54), TANK_DECIMALS)).toBe('54,0')
  })

  it('puts the sign in front of the whole figure', () => {
    expect(formatFigure(toMoney(-1234.56), MONEY_DECIMALS)).toBe('-1.234,56')
  })

  it('groups a whole number with no decimals at all', () => {
    // Odometers are plain integers and still read as the maker expects.
    expect(formatFigure(19764, 0)).toBe('19.764')
    expect(formatFigure(370, 0)).toBe('370')
  })
})

describe('currency', () => {
  it('spells out the codes it knows', () => {
    expect(formatMoneyText(toMoney(11746), 'TRY')).toBe('11.746,00 ₺')
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('try')).toBe('₺')
  })

  it('prints a code it does not know as itself', () => {
    // §8 asks the question once as free text; an unknown answer is still valid
    // money and must never be refused or silently turned into something else.
    expect(currencySymbol('AZN')).toBe('AZN')
    expect(formatMoneyText(toMoney(50), 'AZN')).toBe('50,00 AZN')
  })
})

describe('reading a figure back out of a form', () => {
  it('takes the family convention', () => {
    expect(parseInput('1.234,56', MONEY_DECIMALS)).toBe(toMoney(1234.56))
    expect(parseInput('2.160.000,00', MONEY_DECIMALS)).toBe(toMoney(2160000))
  })

  it('takes the other convention too, rather than refusing a paste', () => {
    expect(parseInput('1,234.56', MONEY_DECIMALS)).toBe(toMoney(1234.56))
  })

  it('reads a lone separator as the decimal point, either way round', () => {
    expect(parseInput('54,0', TANK_DECIMALS)).toBe(toTank(54))
    expect(parseInput('54.0', TANK_DECIMALS)).toBe(toTank(54))
  })

  it('reads a repeated separator as grouping', () => {
    expect(parseInput('1.234.567', 0)).toBe(1234567)
  })

  it('does not guess grouping from three digits — pump figures have three', () => {
    // 8.165 is a real price per litre. A heuristic that read it as 8165 would
    // multiply the maker's fuel bill by a thousand.
    expect(parseInput('8.165', PUMP_DECIMALS)).toBe(toPump(8.165))
    expect(parseInput('73,380', PUMP_DECIMALS)).toBe(toPump(73.38))
  })

  it('rounds rather than truncates, so no cent goes missing', () => {
    // 19.99 × 100 is 1998.9999999999998 in IEEE doubles.
    expect(parseInput('19,99', MONEY_DECIMALS)).toBe(1999)
    expect(parseInput('4,35', MONEY_DECIMALS)).toBe(435)
  })

  it('keeps the sign', () => {
    expect(parseInput('-19,99', MONEY_DECIMALS)).toBe(-1999)
  })

  it('returns null for anything that is not a figure', () => {
    // null, not zero: the form must tell "nothing entered" from "entered zero".
    for (const text of ['', '   ', 'abc', '12abc', '1,2,3', '-', ',', '.']) {
      expect(parseInput(text, MONEY_DECIMALS)).toBeNull()
    }
  })
})

describe('a figure typed, stored, and shown again', () => {
  it('is the same figure, for every field TRITIUM has', () => {
    const cases: Array<[number, number]> = [
      [toMoney(2160000), MONEY_DECIMALS],
      [toMoney(11746), MONEY_DECIMALS],
      [toMoney(0), MONEY_DECIMALS],
      [toMoney(-8664.5), MONEY_DECIMALS],
      [toPump(29.99), PUMP_DECIMALS],
      [toPump(73.38), PUMP_DECIMALS],
      [toTank(54), TANK_DECIMALS]
    ]

    for (const [scaled, decimals] of cases) {
      expect(parseInput(toInput(scaled, decimals), decimals)).toBe(scaled)
    }
  })

  it('shows an editable field without grouping, so nothing invites a misread', () => {
    expect(toInput(toMoney(1234.56), MONEY_DECIMALS)).toBe('1234,56')
    expect(toInput(toTank(54), TANK_DECIMALS)).toBe('54,0')
  })
})

describe('dates', () => {
  it('shows a stored date as GG/AA/YYYY', () => {
    expect(formatDate('2026-08-16')).toBe('16/08/2026')
    expect(formatDate('2025-04-25')).toBe('25/04/2025')
  })

  it('shows nothing for a date it cannot read, rather than something wrong', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate('16/08/2026')).toBe('')
  })

  it('reads GG/AA/YYYY back into what the file stores', () => {
    expect(parseDate('16/08/2026')).toBe('2026-08-16')
    expect(parseDate(' 25/04/2025 ')).toBe('2025-04-25')
  })

  it('refuses a day the calendar does not have', () => {
    // Date.UTC would roll 31/02 forward into March and silently store the wrong
    // day; the round-trip check catches it instead.
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('00/01/2026')).toBeNull()
    expect(parseDate('16/13/2026')).toBeNull()
    expect(parseDate('2026-08-16')).toBeNull()
    expect(parseDate('')).toBeNull()
  })

  it('accepts the leap day only in a leap year', () => {
    expect(parseDate('29/02/2024')).toBe('2024-02-29')
    expect(parseDate('29/02/2026')).toBeNull()
  })
})
