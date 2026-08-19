// The seven series of XTRITIUM §7.2 (F8), against figures worked by hand.
//
// One history serves every test so the charts can be checked against each other
// as well as against arithmetic:
//
//   fuel     10/01 19.000 km  40 l @ 73,380   full
//            05/02 19.200 km  15 l @ 73,380   partial
//            10/03 19.500 km  30 l @ 73,380   full
//   costs    15/01  1.000,00                  (a cost)
//            20/01    400,00                  (income — subtracts)
//   service  01/03 19.400 km    500,00

import { describe, expect, it } from 'vitest'
import { filterByBounds } from '../../src/shared/range.js'
import type { CostEntry, FuelEntry, ServiceEntry } from '../../src/shared/records.js'
import { toMoney, toPump } from '../../src/shared/scaled.js'
import {
  consumptionSeries,
  costPerKmSeries,
  fillupCostSeries,
  gasPriceSeries,
  monthOf,
  monthlyCostSeries,
  monthlyDistanceSeries,
  odometerSeries
} from '../../src/shared/series.js'

const fuel = (
  id: string,
  date: string,
  odometer: number,
  litres: number,
  full: boolean
): FuelEntry => ({
  id,
  date,
  odometer_km: odometer,
  litres: toPump(litres),
  price_per_litre: toPump(73.38),
  full_tank: full,
  fuel_type: 'Kurşunsuz 95'
})

const FUEL: FuelEntry[] = [
  fuel('f-0001', '2026-01-10', 19_000, 40, true),
  fuel('f-0002', '2026-02-05', 19_200, 15, false),
  fuel('f-0003', '2026-03-10', 19_500, 30, true)
]

const cost = (id: string, date: string, amount: number, income: boolean): CostEntry => ({
  id,
  date,
  group: 'tekrar-eden',
  category: 'kasko',
  title: '',
  amount: toMoney(amount),
  income,
  payment_method: '',
  bank: '',
  instalment: '',
  note: ''
})

const COSTS: CostEntry[] = [
  cost('c-0001', '2026-01-15', 1000, false),
  cost('c-0002', '2026-01-20', 400, true)
]

const SERVICE: ServiceEntry[] = [
  {
    id: 's-0001',
    date: '2026-03-01',
    part: 'SERVİS',
    odometer_km: 19_400,
    amount: toMoney(500),
    vendor: ''
  }
]

describe('a month key', () => {
  it('is cut out of the string, not built from a Date', () => {
    // A Date would move an entry made at 01:00 into the month before on this
    // machine (§3.6, and F4's UTC+3 trap).
    expect(monthOf('2026-08-16')).toBe('2026-08')
    expect(monthOf('2026-01-01')).toBe('2026-01')
    expect(monthOf('2025-12-31')).toBe('2025-12')
  })
})

describe('Fuel Consumption', () => {
  it('plots a point only where §5.2 says one exists', () => {
    // 30 l plus the 15 l partial, over 500 km: 9,00 l/100km.
    expect(consumptionSeries(FUEL)).toEqual([{ date: '2026-03-10', value: 9000 }])
  })

  it('is destroyed by filtering the fill-ups instead of the result', () => {
    // F7's hazard, in its new home. March alone hides the full tank the figure
    // is measured against AND the partial counted into it.
    const march = { from: '2026-03-01', to: '2026-03-31' }

    expect(consumptionSeries(filterByBounds(FUEL, march))).toEqual([])
    expect(filterByBounds(consumptionSeries(FUEL), march)).toEqual([
      { date: '2026-03-10', value: 9000 }
    ])
  })
})

describe('Gas Price', () => {
  it('plots the price as entered, at three decimals', () => {
    expect(gasPriceSeries(FUEL).map((point) => point.value)).toEqual([
      toPump(73.38),
      toPump(73.38),
      toPump(73.38)
    ])
  })

  it('is in date order whatever order it was handed', () => {
    const shuffled = [FUEL[2], FUEL[0], FUEL[1]] as FuelEntry[]
    expect(gasPriceSeries(shuffled).map((point) => point.date)).toEqual([
      '2026-01-10',
      '2026-02-05',
      '2026-03-10'
    ])
  })
})

describe('Fill-up Costs', () => {
  it('plots what each fill-up cost, and is not a monthly figure', () => {
    // 40 × 73,380 = 2.935,20 · 15 × 73,380 = 1.100,70 · 30 × 73,380 = 2.201,40
    expect(fillupCostSeries(FUEL).map((point) => point.value)).toEqual([
      toMoney(2935.2),
      toMoney(1100.7),
      toMoney(2201.4)
    ])
  })
})

describe('Odometer', () => {
  it('reads every file that carries a reading, not fuel alone', () => {
    expect(odometerSeries(FUEL, SERVICE)).toEqual([
      { date: '2026-01-10', value: 19_000 },
      { date: '2026-02-05', value: 19_200 },
      { date: '2026-03-01', value: 19_400 },
      { date: '2026-03-10', value: 19_500 }
    ])
  })

  it('ignores a record with no reading rather than plotting a zero', () => {
    const noReading: ServiceEntry[] = [{ ...(SERVICE[0] as ServiceEntry), odometer_km: 0 }]
    expect(odometerSeries([], noReading)).toEqual([])
  })
})

describe('Monthly Costs', () => {
  it('adds fuel, costs and service together', () => {
    // Jan: 2.935,20 fuel + 1.000,00 cost − 400,00 income = 3.535,20
    // Feb: 1.100,70 fuel
    // Mar: 2.201,40 fuel + 500,00 service = 2.701,40
    expect(monthlyCostSeries(FUEL, COSTS, SERVICE)).toEqual([
      { month: '2026-01', value: toMoney(3535.2) },
      { month: '2026-02', value: toMoney(1100.7) },
      { month: '2026-03', value: toMoney(2701.4) }
    ])
  })

  it('subtracts an income entry rather than adding it', () => {
    const withoutIncome = monthlyCostSeries(FUEL, [COSTS[0] as CostEntry], SERVICE)
    expect(withoutIncome[0]?.value).toBe(toMoney(3935.2))
  })

  it('ignores an entry with no date rather than filing it under nothing', () => {
    const undated = cost('c-0003', '', 999, false)
    expect(monthlyCostSeries([], [undated], [])).toEqual([])
  })
})

describe('Monthly Distance', () => {
  const readings = odometerSeries(FUEL, SERVICE)

  it('measures between the highest reading of each month', () => {
    expect(monthlyDistanceSeries(readings)).toEqual([
      { month: '2026-02', value: 200, from: '2026-01-10', to: '2026-02-05' },
      { month: '2026-03', value: 300, from: '2026-02-05', to: '2026-03-10' }
    ])
  })

  it('gives the first month no bar — there is nothing to measure it against', () => {
    // The same answer §5.2 gives the first-ever fill-up.
    expect(monthlyDistanceSeries(readings).some((point) => point.month === '2026-01')).toBe(false)
  })

  it('gives a month with no reading no bar, rather than a zero', () => {
    // Zero kilometres and no record of driving are different claims, and only
    // one of them is in the file (§3.3).
    const sparse = [
      { date: '2026-01-10', value: 19_000 },
      { date: '2026-04-10', value: 19_900 }
    ]
    const points = monthlyDistanceSeries(sparse)

    expect(points.map((point) => point.month)).toEqual(['2026-04'])
    // And it says what span it actually covers, rather than implying one month.
    expect(points[0]).toEqual({
      month: '2026-04',
      value: 900,
      from: '2026-01-10',
      to: '2026-04-10'
    })
  })

  it('says nothing about an interval that did not move', () => {
    const stalled = [
      { date: '2026-01-10', value: 19_000 },
      { date: '2026-02-10', value: 19_000 }
    ]
    expect(monthlyDistanceSeries(stalled)).toEqual([])
  })
})

describe('Cost per Kilometer', () => {
  const spend = monthlyCostSeries(FUEL, COSTS, SERVICE)
  const distance = monthlyDistanceSeries(odometerSeries(FUEL, SERVICE))

  it('divides the month by the month, at three decimals', () => {
    // Feb: 1.100,70 ÷ 200 km = 5,5035 -> 5,504 at three decimals
    // Mar: 2.701,40 ÷ 300 km = 9,00466… -> 9,005
    expect(costPerKmSeries(spend, distance)).toEqual([
      { month: '2026-02', value: 5504, from: '2026-01-10', to: '2026-02-05' },
      { month: '2026-03', value: 9005, from: '2026-02-05', to: '2026-03-10' }
    ])
  })

  it('gives a month with spend but no measured distance no point at all', () => {
    // January has 3.535,20 of spend and no distance. Dividing by an unknown is
    // a guess, and an app that targets precision does not guess (§5.2).
    expect(costPerKmSeries(spend, distance).some((point) => point.month === '2026-01')).toBe(false)
  })

  it('gives a month with distance but no spend no point either', () => {
    expect(costPerKmSeries([], distance)).toEqual([])
  })
})
