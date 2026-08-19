// The time ranges of XTRITIUM §7.2 (F7), and the hazard they sit next to.
//
// Every case here hands `boundsFor` an explicit today, so nothing depends on
// the day the suite happens to run.

import { describe, expect, it } from 'vitest'
import { consumptionById } from '../../src/shared/consumption.js'
import type { FuelEntry } from '../../src/shared/records.js'
import { toPump } from '../../src/shared/scaled.js'
import { boundsFor, filterByBounds, withinBounds } from '../../src/shared/range.js'

describe('the five chips (§7.2)', () => {
  const today = '2026-08-19'

  it('all time is open at both ends', () => {
    expect(boundsFor('all', today)).toEqual({ from: null, to: null })
  })

  it('YTD runs from the first of January to today', () => {
    expect(boundsFor('ytd', today)).toEqual({ from: '2026-01-01', to: '2026-08-19' })
  })

  it('previous year is the whole of the year before', () => {
    expect(boundsFor('previous-year', today)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  it('this month runs from the first of the month to today, not to the 31st', () => {
    // §3.3 keeps TRITIUM out of the future in every other respect; a window
    // claiming days that have not happened would be the same mistake.
    expect(boundsFor('this-month', today)).toEqual({ from: '2026-08-01', to: '2026-08-19' })
  })

  it('previous month is a whole calendar month', () => {
    expect(boundsFor('previous-month', today)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
  })
})

describe('the turns of the year and the month', () => {
  it('gives YTD a single day on the first of January', () => {
    expect(boundsFor('ytd', '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-01' })
  })

  it('reaches back into December for the previous month from inside January', () => {
    // The case a naive `month - 1` gets wrong by producing month zero.
    expect(boundsFor('previous-month', '2026-01-09')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31'
    })
  })

  it('knows February has 29 days in a leap year', () => {
    expect(boundsFor('previous-month', '2028-03-04')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29'
    })
  })

  it('knows it has 28 in a common year', () => {
    expect(boundsFor('previous-month', '2026-03-04')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28'
    })
  })

  it('knows a century year divisible by 400 is a leap year', () => {
    expect(boundsFor('previous-month', '2400-03-01')).toEqual({
      from: '2400-02-01',
      to: '2400-02-29'
    })
  })
})

describe('the custom range', () => {
  const today = '2026-08-19'

  it('uses both bounds when both read as dates', () => {
    expect(boundsFor('custom', today, { from: '2026-04-01', to: '2026-04-30' })).toEqual({
      from: '2026-04-01',
      to: '2026-04-30'
    })
  })

  it('leaves an unreadable bound open rather than filtering to nothing', () => {
    // The maker is still typing the year. Emptying the list mid-keystroke would
    // look like data loss (§3.8 — the app does not argue with what is typed).
    expect(boundsFor('custom', today, { from: '2026-04-01', to: null })).toEqual({
      from: '2026-04-01',
      to: null
    })
    expect(boundsFor('custom', today, { from: null, to: null })).toEqual({
      from: null,
      to: null
    })
  })
})

describe('what a window admits', () => {
  const window = { from: '2026-04-01', to: '2026-04-30' }

  it('includes both ends', () => {
    expect(withinBounds('2026-04-01', window)).toBe(true)
    expect(withinBounds('2026-04-30', window)).toBe(true)
  })

  it('excludes the days either side', () => {
    expect(withinBounds('2026-03-31', window)).toBe(false)
    expect(withinBounds('2026-05-01', window)).toBe(false)
  })

  it('shows an undated entry only when the window is open at both ends', () => {
    // It belongs to no period — but hiding it from "all time" would make it
    // unreachable, and an unreachable record cannot be repaired (§3.8).
    expect(withinBounds('', { from: null, to: null })).toBe(true)
    expect(withinBounds('', window)).toBe(false)
  })

  it('returns an empty list rather than all of them when nothing matches', () => {
    const entries = [{ date: '2025-01-01' }, { date: '2027-01-01' }]
    expect(filterByBounds(entries, window)).toEqual([])
  })

  it('keeps the order it was given', () => {
    const entries = [{ date: '2026-04-20' }, { date: '2026-04-02' }]
    expect(filterByBounds(entries, window)).toEqual(entries)
  })
})

/*
 * The reason F7 computes consumption over the WHOLE history and filters
 * afterwards, rather than the other way round.
 *
 * These tests do not check the pane. They pin the hazard the pane is written to
 * avoid, so that anyone who later "simplifies" it by filtering first meets a
 * red test with the explanation attached.
 */
describe('a filter applied BEFORE the consumption engine', () => {
  const fuel = (id: string, date: string, odometer: number, litres: number, full: boolean): FuelEntry => ({
    id,
    date,
    odometer_km: odometer,
    litres: toPump(litres),
    price_per_litre: toPump(73.38),
    full_tank: full,
    fuel_type: 'Kurşunsuz 95'
  })

  // 40 l full in January, 15 l partial in February, 30 l full in March.
  // Over 500 km that is (30 + 15) ÷ 500 × 100 = 9,00 l/100km at the March entry.
  const history = [
    fuel('f-0001', '2026-01-10', 19_000, 40, true),
    fuel('f-0002', '2026-02-05', 19_200, 15, false),
    fuel('f-0003', '2026-03-10', 19_500, 30, true)
  ]

  const march = { from: '2026-03-01', to: '2026-03-31' }
  const febToMarch = { from: '2026-02-01', to: '2026-03-31' }

  it('computes 9,00 l/100km over the whole history', () => {
    expect(consumptionById(history)['f-0003']?.l100km).toBe(9000)
  })

  it('LOSES the figure entirely when March is filtered first', () => {
    // The full tank it was measured against is in January and now gone, so the
    // engine correctly reports no data point — for a fill-up that has one.
    const wrong = consumptionById(filterByBounds(history, march))
    expect(wrong['f-0003']).toBeUndefined()
  })

  it('LOSES it just as thoroughly when the partial is included but the full is not', () => {
    const wrong = consumptionById(filterByBounds(history, febToMarch))
    expect(wrong['f-0003']).toBeUndefined()
  })

  it('keeps the figure when the engine is fed everything and the ROWS are filtered', () => {
    // What F7 actually does, and the only order that is correct.
    const points = consumptionById(history)
    const rows = filterByBounds(history, march)

    expect(rows.map((row) => row.id)).toEqual(['f-0003'])
    expect(points[rows[0]?.id ?? '']?.l100km).toBe(9000)
  })
})
