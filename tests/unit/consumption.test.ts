// XTRITIUM §5.2 — the full-tank algorithm, checked against its own wording.
//
// This is the first figure TRITIUM computes rather than stores, which is also
// the first figure that can be quietly wrong for a year. So each clause of
// §5.2 is its own test, and the arithmetic is checked against sums done by
// hand rather than against the implementation's own output.

import { describe, expect, it } from 'vitest'
import {
  consumptionAt,
  consumptionById,
  consumptionPoints,
  entryTotal,
  sortByOdometer
} from '../../src/shared/consumption.js'
import type { FuelEntry } from '../../src/shared/records.js'
import { toPump } from '../../src/shared/scaled.js'

function fill(
  id: string,
  odometer: number,
  litres: number,
  full: boolean,
  date = '2026-01-01'
): FuelEntry {
  return {
    id,
    date,
    odometer_km: odometer,
    litres: toPump(litres),
    price_per_litre: toPump(73.38),
    full_tank: full,
    fuel_type: 'Kurşunsuz 95'
  }
}

describe('a consumption data point', () => {
  it('exists only at a full tank that has an earlier full tank before it', () => {
    const points = consumptionPoints([
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_500, 30, true)
    ])

    // 30 l over 500 km — 6,00 l/100km, by hand.
    expect(points).toHaveLength(1)
    expect(points[0]?.id).toBe('f-0002')
    expect(points[0]?.distance_km).toBe(500)
    expect(points[0]?.litres).toBe(toPump(30))
    expect(points[0]?.l100km).toBe(6_000)
  })

  it('does not exist at the first-ever entry', () => {
    expect(consumptionPoints([fill('f-0001', 19_000, 40, true)])).toEqual([])
  })

  it('does not exist at a partial entry', () => {
    const points = consumptionPoints([
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_500, 30, true),
      fill('f-0003', 19_800, 20, false)
    ])

    // The trailing partial adds a third entry and no third figure.
    expect(points.map((point) => point.id)).toEqual(['f-0002'])
  })

  it('never exists when nothing was ever filled to the top', () => {
    expect(
      consumptionPoints([
        fill('f-0001', 19_000, 40, false),
        fill('f-0002', 19_500, 30, false),
        fill('f-0003', 20_000, 30, false)
      ])
    ).toEqual([])
  })
})

describe('the litres a point counts', () => {
  it('adds every partial fill in between to the full entry that closes the interval', () => {
    const points = consumptionPoints([
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_200, 10, false),
      fill('f-0003', 19_500, 30, true)
    ])

    // 30 + 10 = 40 l over 500 km — 8,00 l/100km.
    expect(points).toHaveLength(1)
    expect(points[0]?.litres).toBe(toPump(40))
    expect(points[0]?.l100km).toBe(8_000)
  })

  it('counts two partials in the same interval', () => {
    const points = consumptionPoints([
      fill('f-0001', 10_000, 50, true),
      fill('f-0002', 10_150, 12.5, false),
      fill('f-0003', 10_300, 12.5, false),
      fill('f-0004', 10_600, 35, true)
    ])

    // 35 + 12,5 + 12,5 = 60 l over 600 km — 10,00 l/100km.
    expect(points).toHaveLength(1)
    expect(points[0]?.litres).toBe(toPump(60))
    expect(points[0]?.l100km).toBe(10_000)
  })

  it('drops a partial that comes before the first full tank', () => {
    // It belongs to no interval: there is no earlier full tank to measure from,
    // so its litres are not owed to the first interval that does exist.
    const points = consumptionPoints([
      fill('f-0001', 19_000, 15, false),
      fill('f-0002', 19_100, 40, true),
      fill('f-0003', 19_600, 30, true)
    ])

    expect(points).toHaveLength(1)
    expect(points[0]?.litres).toBe(toPump(30))
    expect(points[0]?.distance_km).toBe(500)
  })

  it('starts a fresh interval after each full tank', () => {
    const points = consumptionPoints([
      fill('f-0001', 10_000, 50, true),
      fill('f-0002', 10_400, 20, true),
      fill('f-0003', 10_600, 10, false),
      fill('f-0004', 10_900, 35, true)
    ])

    expect(points.map((point) => point.litres)).toEqual([toPump(20), toPump(45)])
    expect(points.map((point) => point.distance_km)).toEqual([400, 500])
  })
})

describe('the order the entries arrive in', () => {
  it('is the odometer, not the file', () => {
    // §5.2 opens by sorting on the odometer. A fill-up entered late still
    // happened at the reading it carries.
    const sorted = sortByOdometer([
      fill('f-0003', 19_500, 30, true),
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_200, 10, false)
    ])

    expect(sorted.map((entry) => entry.odometer_km)).toEqual([19_000, 19_200, 19_500])
  })

  it('produces the same figures however the list is shuffled', () => {
    const entries = [
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_200, 10, false),
      fill('f-0003', 19_500, 30, true)
    ]

    const forwards = consumptionPoints(entries)
    const backwards = consumptionPoints([...entries].reverse())
    expect(backwards).toEqual(forwards)
  })

  it('places an entry typed with a lower odometer by its reading', () => {
    // §5.1 accepts a backwards odometer — the maker's word is final. Sorting on
    // the reading is what that acceptance means downstream: the entry lands
    // where its number says, and the intervals close around it.
    const points = consumptionPoints([
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_800, 30, true),
      fill('f-0003', 19_400, 20, true)
    ])

    expect(points.map((point) => point.odometer_km)).toEqual([19_400, 19_800])
    expect(points.map((point) => point.distance_km)).toEqual([400, 400])
  })

  it('says nothing about two entries at the same reading', () => {
    // Zero distance measures nothing. The interval is skipped; the second entry
    // still becomes the mark the next one is measured from.
    const points = consumptionPoints([
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_000, 5, true),
      fill('f-0003', 19_500, 30, true)
    ])

    expect(points).toHaveLength(1)
    expect(points[0]?.id).toBe('f-0003')
    expect(points[0]?.distance_km).toBe(500)
  })
})

describe('a mis-flagged entry', () => {
  it('shifts the figures on both sides of it', () => {
    // §5.2 — "Mis-flagging full/partial shifts the figures on both sides — the
    // flag is a real field, not decoration." This test is the proof, and the
    // reason the flag is offered as a checkbox rather than inferred.
    const entries = [
      fill('f-0001', 10_000, 50, true),
      fill('f-0002', 10_400, 20, true),
      fill('f-0003', 10_900, 35, true)
    ]

    const asFlagged = consumptionPoints(entries)
    expect(asFlagged.map((point) => point.l100km)).toEqual([5_000, 7_000])

    const misflagged = [...entries]
    misflagged[1] = fill('f-0002', 10_400, 20, false)
    const after = consumptionPoints(misflagged)

    // Two intervals become one: 35 + 20 = 55 l over 900 km.
    expect(after).toHaveLength(1)
    expect(after[0]?.litres).toBe(toPump(55))
    expect(after[0]?.l100km).toBe(6_111)
  })
})

describe('the derived total of a fill-up', () => {
  it('is litres × price per litre, and matches XTRITIUM §5.1 to the kuruş', () => {
    // 29,990 l × 73,380 ₺/l → 2.200,67 ₺, the constitution's own example.
    const entry: FuelEntry = {
      id: 'f-0001',
      date: '2026-08-16',
      odometer_km: 19_764,
      litres: toPump(29.99),
      price_per_litre: toPump(73.38),
      full_tank: true,
      fuel_type: 'Kurşunsuz 95'
    }

    expect(entryTotal(entry)).toBe(220_067)
  })

  it('rounds the half-kuruş once, not the litres and then the price', () => {
    // 10 l at 8,165 ₺/l is exactly 81,65 ₺ — the price carries three decimals
    // because pump prices do, and truncating it would lose money every fill-up.
    const entry = fill('f-0001', 1_000, 10, true)
    expect(entryTotal({ ...entry, price_per_litre: toPump(8.165) })).toBe(8_165)
  })

  it('is exact across a hundred fill-ups', () => {
    // §4.3 — sums are exact because the arithmetic runs on integers. A float
    // path would drift by a kuruş or two over a year of fill-ups.
    const entry = fill('f-0001', 1_000, 33.33, true)
    const one = entryTotal({ ...entry, price_per_litre: toPump(73.38) })
    let total = 0
    for (let index = 0; index < 100; index += 1) total += one

    // 33,330 × 73,380 = 2.445.755.400, and ÷10.000 lands on 244.575,54 — the
    // half-kuruş is rounded once, here, and never again.
    expect(one).toBe(244_576)
    expect(total).toBe(24_457_600)
  })
})

describe('the precision the figure is shown at', () => {
  it('cuts three decimals down to what settings.toml asks for', () => {
    // §4.4 — decimals_consumption, default 2. The engine keeps three so the
    // setting can be raised later without the arithmetic having been discarded.
    expect(consumptionAt(6_111, 2)).toBe(611)
    expect(consumptionAt(6_115, 2)).toBe(612)
    expect(consumptionAt(6_111, 3)).toBe(6_111)
    expect(consumptionAt(6_111, 1)).toBe(61)
    expect(consumptionAt(6_111, 0)).toBe(6)
  })

  it('can be asked for more decimals than it keeps', () => {
    expect(consumptionAt(6_111, 4)).toBe(61_110)
  })
})

describe('points addressed by entry', () => {
  it('answers for the entries that have a figure, and not for the others', () => {
    const byId = consumptionById([
      fill('f-0001', 19_000, 40, true),
      fill('f-0002', 19_200, 10, false),
      fill('f-0003', 19_500, 30, true)
    ])

    expect(byId['f-0001']).toBeUndefined()
    expect(byId['f-0002']).toBeUndefined()
    expect(byId['f-0003']?.l100km).toBe(8_000)
  })
})
