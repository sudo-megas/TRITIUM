// What the Summary page states (XTRITIUM §7.1, F9), against figures worked by
// hand.
//
// The first describe is the one that matters. Everything else on the page is a
// sum; the average is the one figure with a wrong answer that looks right.

import { describe, expect, it } from 'vitest'
import { consumptionPoints } from '../../src/shared/consumption.js'
import type { CostEntry, FuelEntry, ServiceEntry, VehicleBundle } from '../../src/shared/records.js'
import { toMoney, toPump } from '../../src/shared/scaled.js'
import { monthlyCostSeries } from '../../src/shared/series.js'
import {
  averageConsumption,
  compare,
  lastConsumption,
  lastPrice,
  latestOdometer,
  lifetimeDistance,
  lifetimeLitres,
  lifetimeSpend,
  recentEntries
} from '../../src/shared/summary.js'

const fuel = (
  id: string,
  date: string,
  odometer: number,
  litres: number,
  full: boolean,
  price = 73.38
): FuelEntry => ({
  id,
  date,
  odometer_km: odometer,
  litres: toPump(litres),
  price_per_litre: toPump(price),
  full_tank: full,
  fuel_type: 'Kurşunsuz 95'
})

/*
 * Two intervals, chosen so the two candidate averages differ visibly:
 *
 *   19.000 -> 19.400   40 l over 400 km   = 10,00 l/100km
 *   19.400 -> 19.900   10 l over 500 km   =  2,00 l/100km
 *
 *   mean of the ratios   (10,00 + 2,00) ÷ 2      = 6,00
 *   ratio of the sums    50 l ÷ 900 km × 100     = 5,56
 */
const UNEVEN: FuelEntry[] = [
  fuel('f-0001', '2026-01-10', 19_000, 30, true),
  fuel('f-0002', '2026-02-10', 19_400, 40, true),
  fuel('f-0003', '2026-03-10', 19_900, 10, true)
]

describe('the average consumption', () => {
  it('is the ratio of the sums', () => {
    // 50 l ÷ 900 km × 100 = 5,5555… -> 5,556 at the engine's three decimals.
    expect(averageConsumption(UNEVEN)).toBe(5556)
  })

  it('is NOT the mean of the per-interval figures', () => {
    // The obvious implementation — averaging the consumption column — weights a
    // 400 km interval exactly as heavily as a 900 km one, and produces a figure
    // the vehicle never achieved.
    const points = consumptionPoints(UNEVEN)
    const mean = Math.round(
      points.reduce((total, point) => total + point.l100km, 0) / points.length
    )

    expect(points.map((point) => point.l100km)).toEqual([10_000, 2000])
    expect(mean).toBe(6000)
    expect(averageConsumption(UNEVEN)).not.toBe(mean)
  })

  it('has nothing to say about a vehicle with no interval', () => {
    expect(averageConsumption([])).toBe(null)
    expect(averageConsumption([UNEVEN[0] as FuelEntry])).toBe(null)
  })

  it('reports the most recent interval as the last consumption', () => {
    expect(lastConsumption(UNEVEN)).toBe(2000)
  })
})

describe('the gas card', () => {
  it('takes the price and date from the most recent priced fill-up', () => {
    expect(lastPrice(UNEVEN)).toEqual({ price: toPump(73.38), date: '2026-03-10' })
  })

  it('ignores an entry with no price rather than reporting zero', () => {
    const unpriced = [fuel('f-0004', '2026-04-01', 20_000, 10, true, 0)]
    expect(lastPrice(unpriced)).toBe(null)
  })
})

describe('the lifetime totals', () => {
  const service: ServiceEntry[] = [
    {
      id: 's-0001',
      date: '2026-04-01',
      part: 'SERVİS',
      odometer_km: 20_400,
      amount: toMoney(500),
      vendor: ''
    }
  ]

  it('spans the readings of BOTH files, not fuel alone', () => {
    // 19.000 -> 20.400, and the far end of that is in service.toml.
    expect(lifetimeDistance(UNEVEN, service)).toBe(1400)
    expect(lifetimeDistance(UNEVEN, [])).toBe(900)
  })

  it('is not the sum of the §5.2 intervals', () => {
    // Those run full tank to full tank. A vehicle whose last fill was partial
    // would under-report by the whole of the last interval.
    const trailingPartial = [...UNEVEN, fuel('f-0004', '2026-04-10', 20_300, 20, false)]
    const intervals = consumptionPoints(trailingPartial).reduce(
      (total, point) => total + point.distance_km,
      0
    )

    expect(intervals).toBe(900)
    expect(lifetimeDistance(trailingPartial, [])).toBe(1300)
  })

  it('adds every litre entered', () => {
    expect(lifetimeLitres(UNEVEN)).toBe(toPump(80))
  })

  it('agrees with the monthly cost series summed', () => {
    const costs: CostEntry[] = [
      {
        id: 'c-0001',
        date: '2026-01-15',
        group: 'tekrar-eden',
        category: 'kasko',
        title: '',
        amount: toMoney(1000),
        income: false,
        payment_method: '',
        bank: '',
        instalment: '',
        note: ''
      }
    ]

    const monthly = monthlyCostSeries(UNEVEN, costs, service).reduce(
      (total, point) => total + point.value,
      0
    )
    expect(lifetimeSpend(UNEVEN, costs, service)).toBe(monthly)
  })

  it('subtracts an income entry', () => {
    const income: CostEntry[] = [
      {
        id: 'c-0002',
        date: '2026-01-20',
        group: 'manual',
        category: 'iade',
        title: '',
        amount: toMoney(400),
        income: true,
        payment_method: '',
        bank: '',
        instalment: '',
        note: ''
      }
    ]

    const withIncome = lifetimeSpend(UNEVEN, income, [])
    const without = lifetimeSpend(UNEVEN, [], [])
    expect(without - withIncome).toBe(toMoney(400))
  })

  it('excludes the purchase price — that belongs to §7.3, and to F10', () => {
    // 2.160.000,00 sits on the vehicle record and is not spend on this page.
    // If it ever leaks in, this figure jumps by four orders of magnitude.
    expect(lifetimeSpend(UNEVEN, [], [])).toBeLessThan(toMoney(100_000))
  })

  it('reports the highest reading of either file as the odometer', () => {
    expect(latestOdometer(UNEVEN, service)).toBe(20_400)
    expect(latestOdometer([], [])).toBe(null)
  })
})

describe('a comparison of two months', () => {
  it('states the difference when there is a previous month', () => {
    expect(compare(300, 200, true)).toEqual({ current: 300, previous: 200, change: 100 })
  })

  it('states NO change when there is no previous month', () => {
    // A rise from nothing is not a rise; reporting one would invent a trend out
    // of an absence (§3.3).
    expect(compare(300, 0, false)).toEqual({ current: 300, previous: 0 })
  })

  it('reports a fall as a negative rather than hiding it', () => {
    expect(compare(200, 300, true).change).toBe(-100)
  })
})

describe('the last entries block', () => {
  const bundle = (): VehicleBundle => ({
    slug: 'sportage',
    vehicle: null,
    fuel: { schemaVersion: 1, entries: [fuel('f-0001', '2026-01-10', 19_000, 30, true)], entryRest: {}, rest: {} },
    costs: {
      schemaVersion: 1,
      entries: [
        {
          id: 'c-0001',
          date: '2026-03-01',
          group: 'tekrar-eden',
          category: 'kasko',
          title: 'Kasko 26/27',
          amount: toMoney(1000),
          income: false,
          payment_method: '',
          bank: '',
          instalment: '',
          note: ''
        }
      ],
      entryRest: {},
      rest: {}
    },
    service: {
      schemaVersion: 1,
      entries: [
        {
          id: 's-0001',
          date: '2026-02-01',
          part: 'SERVİS',
          odometer_km: 19_400,
          amount: toMoney(500),
          vendor: ''
        }
      ],
      entryRest: {},
      rest: {}
    }
  })

  it('merges all three files into one list, newest first', () => {
    expect(recentEntries(bundle(), 8).map((row) => row.kind)).toEqual(['cost', 'service', 'fuel'])
  })

  it('says which file each row came from', () => {
    const rows = recentEntries(bundle(), 8)
    expect(rows[0]?.label).toBe('Kasko 26/27')
    expect(rows[1]?.label).toBe('SERVİS')
  })

  it('honours its limit', () => {
    expect(recentEntries(bundle(), 2)).toHaveLength(2)
  })

  it('has nothing to say about a vehicle that is not loaded', () => {
    expect(recentEntries(null, 8)).toEqual([])
  })
})
