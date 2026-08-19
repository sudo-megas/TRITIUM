// The edges nobody built for (F12).
//
// Every milestone tested the path it added. These are the paths at the ends of
// those paths — figures larger than a car, records with nothing in them, dates
// at the turns of the calendar, and a maker who meant the empty list he made.
//
// Where the answer is already right the test is still worth having: it is the
// answer that must not change quietly.

import { describe, expect, it } from 'vitest'
import { consumptionPoints, entryTotal } from '../../src/shared/consumption.js'
import { signedAmount } from '../../src/shared/costs.js'
import { formatFigure, formatMoneyText, parseInput, todayIso } from '../../src/shared/format.js'
import { DEFAULT_SETTINGS, readPaymentMethods, type Settings } from '../../src/shared/settings.js'
import { parseSettings, serialiseSettings } from '../../src/main/storage/settings-file.js'
import { EMPTY_VEHICLE, type FuelEntry } from '../../src/shared/records.js'
import { toMoney, toPump } from '../../src/shared/scaled.js'
import { categorySlug, slugFor } from '../../src/shared/slug.js'
import { daysBetween } from '../../src/shared/statistics.js'
import { boundsFor } from '../../src/shared/range.js'
import { lifetimeDistance, lifetimeSpend } from '../../src/shared/summary.js'
import { readDistance, showDistance } from '../../src/shared/units.js'

const fill = (id: string, odometer: number, litres: number, price: number): FuelEntry => ({
  id,
  date: '2026-01-01',
  odometer_km: odometer,
  litres: toPump(litres),
  price_per_litre: toPump(price),
  full_tank: true,
  fuel_type: ''
})

describe('figures larger than the app was imagined for', () => {
  it('multiplies a very expensive tank without losing a kuruş', () => {
    // 1.000 l at 1.000,000 per litre — absurd, and still exact. The scaled
    // product is 1e12, well inside the 9e15 an integer can hold safely.
    const total = entryTotal({ litres: toPump(1000), price_per_litre: toPump(1000) })
    expect(total).toBe(toMoney(1_000_000))
    expect(Number.isSafeInteger(total)).toBe(true)
  })

  it('formats a seven-figure odometer with its separators intact', () => {
    expect(formatFigure(1_234_567, 0)).toBe('1.234.567')
  })

  it('formats a nine-figure sum without exponent notation', () => {
    const text = formatMoneyText(toMoney(123_456_789.12), 'TRY')
    expect(text).toContain('123.456.789,12')
    expect(text).not.toContain('e')
  })

  it('converts a seven-figure odometer to miles and back', () => {
    expect(readDistance(showDistance(1_234_567, 'mi'), 'mi')).toBe(1_234_567)
  })

  it('computes consumption over a very long interval', () => {
    // 500.000 km between two full tanks. Absurd, and the arithmetic holds.
    const points = consumptionPoints([fill('f-1', 0, 40, 10), fill('f-2', 500_000, 40, 10)])
    expect(points[0]?.l100km).toBe(8)
  })
})

describe('records with nothing in them', () => {
  it('gives an empty vehicle no distance and no spend rather than NaN', () => {
    expect(lifetimeDistance([], [])).toBe(0)
    expect(lifetimeSpend([], [], [])).toBe(0)
  })

  it('has an empty vehicle record with no photo field, and gains none', () => {
    expect(Object.keys(EMPTY_VEHICLE)).not.toContain('photo')
    expect(EMPTY_VEHICLE.purchase_price).toBe(0)
  })

  it('reads a fill-up with a zero price as costing nothing, not as broken', () => {
    expect(entryTotal({ litres: toPump(40), price_per_litre: 0 })).toBe(0)
  })

  it('treats an income entry of zero as zero either way', () => {
    // Negating zero gives NEGATIVE zero, which is a real IEEE value and is not
    // `Object.is`-equal to zero. It is harmless here and the test says why
    // rather than the code growing a branch to avoid it: `formatScaled` signs
    // on `rounded < 0`, and `-0 < 0` is false, so it renders as `0,00` like any
    // other zero. What matters is that it compares equal and reads the same.
    expect(signedAmount({ amount: 0, income: true }) === 0).toBe(true)
    expect(signedAmount({ amount: 0, income: false }) === 0).toBe(true)
    expect(formatFigure(signedAmount({ amount: 0, income: true }), 2)).toBe('0,00')
  })
})

describe('what the maker typed, however he typed it', () => {
  it('reads both separators, in either order', () => {
    expect(parseInput('1.234,56', 2)).toBe(toMoney(1234.56))
    expect(parseInput('1,234.56', 2)).toBe(toMoney(1234.56))
    expect(parseInput('54,0', 1)).toBe(540)
  })

  it('refuses text that is not a figure rather than guessing at one', () => {
    expect(parseInput('', 2)).toBe(null)
    expect(parseInput('lots', 2)).toBe(null)
    expect(parseInput('—', 2)).toBe(null)
  })

  it('slugifies every Turkish letter, and leaves nothing behind', () => {
    expect(slugFor('ĞÜŞİÖÇ ğüşıöç')).toBe('gusioc-gusioc')
  })

  it('reduces a category of pure punctuation to nothing rather than to a word', () => {
    // slugFor gives a VEHICLE a directory whatever it is called; a category
    // must not be invented (§3.3).
    expect(categorySlug('!!! ???')).toBe('')
    expect(slugFor('!!! ???')).toBe('vehicle')
  })

  it('keeps a category the maker wrote in emoji from becoming a word', () => {
    expect(categorySlug('🚗')).toBe('')
  })
})

describe('the turns of the calendar', () => {
  it('counts a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('crosses a century that is not a leap year', () => {
    // 1900 was not a leap year; 2000 was. Neither is in a fuel log, and the
    // arithmetic should not care.
    expect(daysBetween('1900-02-28', '1900-03-01')).toBe(1)
    expect(daysBetween('2000-02-28', '2000-03-01')).toBe(2)
  })

  it('gives the last day of every month correctly', () => {
    const ends = [
      ['2026-01-15', '2025-12-31'],
      ['2026-03-15', '2026-02-28'],
      ['2028-03-15', '2028-02-29'],
      ['2026-05-15', '2026-04-30'],
      ['2026-08-15', '2026-07-31']
    ] as const

    for (const [today, expected] of ends) {
      expect(boundsFor('previous-month', today).to).toBe(expected)
    }
  })

  it('builds today from the local calendar at both ends of a day', () => {
    // This machine is UTC+3: an entry at 01:00 must not be filed on yesterday,
    // and one at 23:00 must not be filed on tomorrow.
    expect(todayIso(new Date(2026, 7, 19, 0, 0, 1))).toBe('2026-08-19')
    expect(todayIso(new Date(2026, 7, 19, 23, 59, 59))).toBe('2026-08-19')
  })
})

describe('settings at their edges', () => {
  it('round-trips a file with every unit at the non-default', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      language: 'tr',
      currency: 'EUR',
      distance: 'mi',
      volume: 'gal',
      consumption: 'mpg',
      decimals_consumption: 0,
      decimals_cost_per_km: 6,
      palette: 'aubergine'
    }

    const back = parseSettings(serialiseSettings(settings)).settings
    expect(back).toEqual(settings)
  })

  it('honours an EMPTY payment-method list — he meant it', () => {
    // §3.8. Inventing the three back would be the app arguing with him.
    expect(readPaymentMethods([], DEFAULT_SETTINGS.payment_methods)).toEqual([])

    const settings: Settings = { ...DEFAULT_SETTINGS, payment_methods: [] }
    expect(parseSettings(serialiseSettings(settings)).settings.payment_methods).toEqual([])
  })

  it('falls back to the three when the key is absent or nonsense', () => {
    expect(readPaymentMethods(undefined, DEFAULT_SETTINGS.payment_methods)).toEqual([
      'eft',
      'kredi-karti',
      'banka-karti'
    ])
    expect(readPaymentMethods('eft', DEFAULT_SETTINGS.payment_methods)).toEqual([
      'eft',
      'kredi-karti',
      'banka-karti'
    ])
  })

  it('drops the rubbish out of a hand-edited list without dropping the list', () => {
    expect(readPaymentMethods(['eft', '', '  ', 'eft', 42, 'havale'], [])).toEqual([
      'eft',
      'havale'
    ])
  })

  it('refuses a precision outside the range it offers', () => {
    const settings = parseSettings(
      ['schema_version = 1', '[format]', 'decimals_consumption = 99', ''].join('\n')
    ).settings
    expect(settings.decimals_consumption).toBe(DEFAULT_SETTINGS.decimals_consumption)
  })

  it('opens on the defaults rather than refusing a corrupt file', () => {
    // Losing a palette choice costs nothing; not opening costs everything.
    const settings = parseSettings('this is not toml [[[').settings
    expect(settings.palette).toBe(DEFAULT_SETTINGS.palette)
    expect(settings.language).toBe('en')
  })
})
