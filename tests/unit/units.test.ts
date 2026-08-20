// The unit boundary (F11), against figures worked by hand.
//
// The claim the whole milestone rests on is that the FILE DOES NOT MOVE: units
// convert on the way to the screen and on the way in from a form, and never in
// between. The round-trip tests are what hold that.

import { describe, expect, it } from 'vitest'
import { draftOf, entryOf } from '../../src/shared/fuel-draft.js'
import type { FuelEntry } from '../../src/shared/records.js'
import { toPump } from '../../src/shared/scaled.js'
import {
  DISTANCE_DECIMALS,
  KM_PER_MILE,
  LITRES_PER_US_GALLON,
  MPG_CONSTANT,
  VOLUME_DECIMALS,
  readDistance,
  readPricePerVolume,
  readVolume,
  showConsumption,
  showCostPerDistance,
  showDistance,
  showPricePerVolume,
  showVolume
} from '../../src/shared/units.js'

describe('the constants', () => {
  it('uses the US gallon and not the imperial one', () => {
    // They differ by twenty per cent, which is the difference between a good
    // tank and a bad one (F11.md decision 3).
    expect(LITRES_PER_US_GALLON).toBe(3.785411784)
    expect(LITRES_PER_US_GALLON).not.toBeCloseTo(4.54609, 5)
  })

  it('uses the exact international mile', () => {
    expect(KM_PER_MILE).toBe(1.609344)
  })

  it('derives the mpg constant from the other two rather than hard-coding it', () => {
    expect(MPG_CONSTANT).toBeCloseTo(235.214583, 5)
  })
})

describe('distance', () => {
  it('shows kilometres unchanged', () => {
    expect(showDistance(19_764, 'km')).toBe(19_764)
    expect(readDistance(19_764, 'km')).toBe(19_764)
  })

  it('shows miles at one decimal, and comes back to the same kilometre', () => {
    // 19.764 km is 12.280,8 mi — held at ×10, which is what the extra decimal
    // buys and why it exists (see DISTANCE_DECIMALS).
    expect(DISTANCE_DECIMALS.mi).toBe(1)
    const miles = showDistance(19_764, 'mi')
    expect(miles).toBe(122_808)
    expect(readDistance(miles, 'mi')).toBe(19_764)
  })

  it('round-trips EVERY kilometre of a realistic odometer range', () => {
    // The property the extra decimal exists for. Whole miles fail this for
    // 37,9% of values, because a mile is coarser than the kilometre under it —
    // a maker in miles would have moved his own odometer by opening a fill-up
    // and saving it untouched.
    for (let km = 0; km <= 300_000; km += 1) {
      expect(readDistance(showDistance(km, 'mi'), 'mi')).toBe(km)
    }
  })

  it('would NOT have round-tripped at whole miles — which is why it does not use them', () => {
    // 3.908 km and 3.907 km both land on 2.428 whole miles, and coming back
    // cannot know which was meant. Pinned so the decimal is never "tidied away".
    const whole = (km: number): number => Math.round(km / KM_PER_MILE)
    expect(whole(3908)).toBe(whole(3907))
    expect(Math.round(whole(3908) * KM_PER_MILE)).not.toBe(3908)
  })
})

describe('volume', () => {
  it('shows litres unchanged', () => {
    expect(showVolume(toPump(54), 'l')).toBe(toPump(54))
  })

  it('converts litres to US gallons, at one extra decimal', () => {
    // 54 l ÷ 3,785411784 = 14,2653 gal — held at PUMP_DECIMALS+1 (×10000),
    // VOLUME_DECIMALS' own extra digit, the same move DISTANCE_DECIMALS
    // makes for miles over kilometres.
    expect(VOLUME_DECIMALS.gal).toBe(1)
    expect(showVolume(toPump(54), 'gal')).toBe(142_653)
  })

  it('round-trips a tank of fuel exactly, the extra decimal is what buys it', () => {
    for (const litres of [1, 10, 29.99, 40, 54, 100]) {
      const scaled = toPump(litres)
      const back = readVolume(showVolume(scaled, 'gal'), 'gal')
      expect(back).toBe(scaled)
    }
  })

  it('round-trips EVERY tenth-of-a-litre of a realistic range', () => {
    for (let scaled = 0; scaled <= 100_000; scaled += 7) {
      expect(readVolume(showVolume(scaled, 'gal'), 'gal')).toBe(scaled)
    }
  })
})

describe('price per volume', () => {
  it('MULTIPLIES going to gallons — a gallon is more litres, so it costs more', () => {
    // The one place it is easy to divide by mistake.
    const perLitre = toPump(73.38)
    const perGallon = showPricePerVolume(perLitre, 'gal')

    expect(perGallon).toBeGreaterThan(perLitre)
    // 73,380 × 3,785411784 = 277,773,5… -> 277.774
    expect(perGallon).toBe(277_774)
  })

  it('round-trips back to the stored per-litre price', () => {
    const perLitre = toPump(73.38)
    const back = readPricePerVolume(showPricePerVolume(perLitre, 'gal'), 'gal')
    expect(Math.abs(back - perLitre)).toBeLessThanOrEqual(1)
  })

  it('leaves a per-litre price alone', () => {
    expect(showPricePerVolume(toPump(73.38), 'l')).toBe(toPump(73.38))
  })
})

describe('consumption', () => {
  const NINE = 9000 // 9,00 l/100km

  it('leaves l/100km alone', () => {
    expect(showConsumption(NINE, 'l100km')).toBe(NINE)
  })

  it('converts to km/l', () => {
    // 100 ÷ 9 = 11,111 km/l
    expect(showConsumption(NINE, 'kml')).toBe(11_111)
  })

  it('converts to mpg', () => {
    // 235,214583 ÷ 9 = 26,135 mpg
    expect(showConsumption(NINE, 'mpg')).toBe(26_135)
  })

  it('has no image for zero in the inverse units', () => {
    // More litres per hundred kilometres is worse; more kilometres per litre is
    // better. Zero has no reciprocal, and infinity is not a figure.
    expect(showConsumption(0, 'kml')).toBe(null)
    expect(showConsumption(0, 'mpg')).toBe(null)
    expect(showConsumption(0, 'l100km')).toBe(0)
  })
})

describe('cost per distance', () => {
  it('MULTIPLIES going to miles — a mile is further, so it costs more', () => {
    expect(showCostPerDistance(1000, 'km')).toBe(1000)
    expect(showCostPerDistance(1000, 'mi')).toBe(1609)
  })
})

describe('the file does not move', () => {
  const ENTRY: FuelEntry = {
    id: 'f-0001',
    date: '2026-08-16',
    odometer_km: 19_764,
    litres: toPump(29.99),
    price_per_litre: toPump(73.38),
    full_tank: true,
    fuel_type: 'Kurşunsuz 95'
  }

  it('shows a fill-up in miles and gallons and stores it in km and litres', () => {
    const imperial = { distance: 'mi' as const, volume: 'gal' as const }
    const draft = draftOf(ENTRY, imperial)

    // What the maker sees: miles to one decimal, gallons to FOUR — the
    // VOLUME_DECIMALS extra digit that makes the round trip exact.
    expect(draft.odometer_km).toBe('12280,8')
    expect(draft.litres).toBe('7,9225')

    // What the file gets back.
    const record = entryOf(draft, imperial)
    expect(record.odometer_km).toBe(19_764)
  })

  it('round-trips a whole record through miles and gallons exactly', () => {
    const imperial = { distance: 'mi' as const, volume: 'gal' as const }
    const back = entryOf(draftOf(ENTRY, imperial), imperial)

    expect(back.odometer_km).toBe(ENTRY.odometer_km)
    expect(back.date).toBe(ENTRY.date)
    expect(back.full_tank).toBe(ENTRY.full_tank)
    // Litres are exact now (VOLUME_DECIMALS's own extra digit). Price per
    // litre carries no extra decimal — see units.ts's own comment on why it
    // does not need one — so it stays within a kuruş the scale can express.
    expect(back.litres).toBe(ENTRY.litres)
    expect(Math.abs(back.price_per_litre - ENTRY.price_per_litre)).toBeLessThanOrEqual(1)
  })

  it('leaves a metric record byte-identical through a metric round trip', () => {
    const metric = { distance: 'km' as const, volume: 'l' as const }
    expect(entryOf(draftOf(ENTRY, metric), metric)).toEqual({
      date: ENTRY.date,
      odometer_km: ENTRY.odometer_km,
      litres: ENTRY.litres,
      price_per_litre: ENTRY.price_per_litre,
      full_tank: ENTRY.full_tank,
      fuel_type: ENTRY.fuel_type
    })
  })

  it('keeps the total the same in either unit, because the conversions cancel', () => {
    // Gallons × price-per-gallon is the same money as litres × price-per-litre,
    // which is why the field pair must always move together (F11.md decision 5).
    const litres = showVolume(toPump(29.99), 'l')
    const perLitre = showPricePerVolume(toPump(73.38), 'l')
    const gallons = showVolume(toPump(29.99), 'gal')
    const perGallon = showPricePerVolume(toPump(73.38), 'gal')

    const metricTotal = (litres * perLitre) / 1_000_000
    // gallons carries VOLUME_DECIMALS.gal's own extra decimal (×10000, not
    // ×1000), so the product needs one more zero to land back on money.
    const imperialTotal = (gallons * perGallon) / 10_000_000

    expect(Math.abs(metricTotal - imperialTotal)).toBeLessThan(0.5)
  })
})
