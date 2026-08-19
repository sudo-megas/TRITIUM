// The Statistics section (XTRITIUM §7.3, F10), against figures worked by hand.
//
// The projection is the figure with the sharpest edge: §3.3 forbids projections
// OF FUTURE ENTRIES and permits projections AS STATISTICS in the same breath,
// and §7.3 asks for this one by name. What the tests hold is that it is an
// aggregate, that it refuses to run on too little, and that it creates nothing.

import { describe, expect, it } from 'vitest'
import type { CostEntry, FuelEntry, ServiceEntry, Vehicle } from '../../src/shared/records.js'
import { EMPTY_VEHICLE } from '../../src/shared/records.js'
import { toMoney, toPump } from '../../src/shared/scaled.js'
import {
  MINIMUM_PROJECTION_DAYS,
  bestTank,
  daysBetween,
  kmPerDay,
  projectedAnnualCost,
  runningCostPerKm,
  singleInterval,
  trueCostPerKm,
  worstTank
} from '../../src/shared/statistics.js'

const fill = (
  id: string,
  date: string,
  odometer: number,
  litres: number,
  price = 10,
  full = true
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
 * Ninety days, nine thousand kilometres, two thousand lira of fuel.
 *   01/01/2026  10.000 km  100 l @ 10,000  = 1.000,00
 *   01/04/2026  19.000 km  100 l @ 10,000  = 1.000,00
 */
const SPAN: FuelEntry[] = [
  fill('f-0001', '2026-01-01', 10_000, 100),
  fill('f-0002', '2026-04-01', 19_000, 100)
]

const VEHICLE: Vehicle = { ...EMPTY_VEHICLE, purchase_price: toMoney(2_160_000) }

describe('counting days', () => {
  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-01-01', '2026-04-01')).toBe(90)
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1)
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('crosses a year end without losing a day', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })

  it('counts the extra day in a leap year', () => {
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29)
    expect(daysBetween('2026-02-01', '2026-03-01')).toBe(28)
  })

  it('is UTC arithmetic, so a local offset cannot shorten a day', () => {
    // This machine is UTC+3 and other machines observe DST. A day is 86.400.000
    // ms in UTC always; it is only in local time that one can be 23 hours long.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('best and worst tank', () => {
  /*
   * Three full tanks, two intervals:
   *   10.000 -> 10.400   40 l over 400 km  = 10,00 l/100km   (worst)
   *   10.400 -> 11.400   20 l over 1000 km =  2,00 l/100km   (best)
   */
  const tanks: FuelEntry[] = [
    fill('f-0001', '2026-01-01', 10_000, 30),
    fill('f-0002', '2026-02-01', 10_400, 40),
    fill('f-0003', '2026-03-01', 11_400, 20)
  ]

  it('are the extremes of the §5.2 intervals', () => {
    expect(bestTank(tanks).value?.l100km).toBe(2000)
    expect(worstTank(tanks).value?.l100km).toBe(10_000)
  })

  it('are intervals, and carry the distance and litres that made them', () => {
    const best = bestTank(tanks).value
    expect(best?.distance_km).toBe(1000)
    expect(best?.litres).toBe(toPump(20))
    expect(bestTank(tanks).from).toBe('2026-03-01')
  })

  it('report why they are absent rather than showing a zero', () => {
    expect(bestTank([]).value).toBe(null)
    expect(bestTank([]).missing).toBe('no-intervals')
    // One full tank is no interval at all (§5.2).
    expect(bestTank([tanks[0] as FuelEntry]).missing).toBe('no-intervals')
  })

  it('know when the best and the worst are the same interval', () => {
    expect(singleInterval(SPAN)).toBe(true)
    expect(singleInterval(tanks)).toBe(false)
    expect(bestTank(SPAN).value?.l100km).toBe(worstTank(SPAN).value?.l100km)
  })
})

describe('kilometres per day', () => {
  it('divides the distance by the days between the readings', () => {
    // 9.000 km over 90 days = 100,00 km/day.
    const figure = kmPerDay(SPAN, [])
    expect(figure.value).toBe(10_000)
    expect(figure.days).toBe(90)
    expect(figure.from).toBe('2026-01-01')
  })

  it('spans the readings, not the calendar', () => {
    // A vehicle bought in April and first recorded in August is measured from
    // August: the app knows what it was told (§3.3).
    const late = [
      fill('f-0001', '2026-08-01', 10_000, 50),
      fill('f-0002', '2026-08-31', 10_300, 50)
    ]
    expect(kmPerDay(late, []).from).toBe('2026-08-01')
    expect(kmPerDay(late, []).days).toBe(30)
  })

  it('refuses on a single reading rather than dividing by nothing', () => {
    expect(kmPerDay([SPAN[0] as FuelEntry], []).value).toBe(null)
    expect(kmPerDay([SPAN[0] as FuelEntry], []).missing).toBe('no-readings')
  })

  it('reads a service reading as readily as a fuel one', () => {
    const service: ServiceEntry[] = [
      { id: 's-0001', date: '2026-07-01', part: '', odometer_km: 28_000, amount: 0, vendor: '' }
    ]
    expect(kmPerDay(SPAN, service).days).toBe(daysBetween('2026-01-01', '2026-07-01'))
  })
})

describe('the projected annual cost', () => {
  it('is the observed spend rate times 365', () => {
    // 2.000,00 over 90 days -> 2.000,00 × 365 ÷ 90 = 8.111,11
    const figure = projectedAnnualCost(SPAN, [], [])
    expect(figure.value).toBe(811_111)
    expect(figure.days).toBe(90)
  })

  it('is not a monthly figure multiplied by twelve', () => {
    // That would weight a part-month exactly as heavily as a whole one. The
    // three months here hold 1.000,00 / 0 / 1.000,00, so a monthly mean × 12
    // would say 8.000,00 rather than 8.111,11.
    expect(projectedAnnualCost(SPAN, [], []).value).not.toBe(toMoney(8000))
  })

  it('REFUSES below the minimum observation and says how short it is', () => {
    const short = [
      fill('f-0001', '2026-01-01', 10_000, 100),
      fill('f-0002', '2026-02-28', 11_000, 100)
    ]
    const figure = projectedAnnualCost(short, [], [])

    expect(daysBetween('2026-01-01', '2026-02-28')).toBe(58)
    expect(figure.value).toBe(null)
    expect(figure.missing).toBe('too-short')
    expect(figure.days).toBe(58)
  })

  it('runs at exactly the minimum and not one day below it', () => {
    const at = [
      fill('f-0001', '2026-01-01', 10_000, 100),
      fill('f-0002', '2026-03-02', 11_000, 100)
    ]
    expect(daysBetween('2026-01-01', '2026-03-02')).toBe(MINIMUM_PROJECTION_DAYS)
    expect(projectedAnnualCost(at, [], []).value).not.toBe(null)

    const below = [
      fill('f-0001', '2026-01-01', 10_000, 100),
      fill('f-0002', '2026-03-01', 11_000, 100)
    ]
    expect(projectedAnnualCost(below, [], []).missing).toBe('too-short')
  })

  it('counts costs and service in the rate, not only fuel', () => {
    const costs: CostEntry[] = [
      {
        id: 'c-0001',
        date: '2026-02-01',
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
    const withCost = projectedAnnualCost(SPAN, costs, [])
    const without = projectedAnnualCost(SPAN, [], [])
    expect(withCost.value as number).toBeGreaterThan(without.value as number)
  })
})

describe('cost per kilometre', () => {
  it('reports the running figure without the purchase price', () => {
    // 2.000,00 over 9.000 km = 0,222 ₺/km
    expect(runningCostPerKm(SPAN, [], []).value).toBe(222)
  })

  it('adds the purchase price for the true figure, and only there', () => {
    // (2.000,00 + 2.160.000,00) ÷ 9.000 km = 240,222 ₺/km
    expect(trueCostPerKm(VEHICLE, SPAN, [], []).value).toBe(240_222)
  })

  it('differs from the running figure by exactly the purchase price per km', () => {
    const running = runningCostPerKm(SPAN, [], []).value as number
    const truth = trueCostPerKm(VEHICLE, SPAN, [], []).value as number
    // 2.160.000,00 ÷ 9.000 km = 240,000 ₺/km
    expect(truth - running).toBe(240_000)
  })

  it('says so when the record carries no purchase price', () => {
    expect(trueCostPerKm(EMPTY_VEHICLE, SPAN, [], []).value).toBe(null)
    expect(trueCostPerKm(EMPTY_VEHICLE, SPAN, [], []).missing).toBe('no-purchase-price')
    expect(trueCostPerKm(null, SPAN, [], []).missing).toBe('no-purchase-price')
  })

  it('refuses rather than dividing by no distance', () => {
    expect(runningCostPerKm([], [], []).missing).toBe('no-distance')
    expect(trueCostPerKm(VEHICLE, [], [], []).missing).toBe('no-distance')
  })
})
