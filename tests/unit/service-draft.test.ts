// Periyodik Bakım's shape (F6), and the odometer hint that now reads two files.
//
// The fixtures are the maker's own PERİYODİK BAKIM sheet — four rows, and the
// awkward ones are the point: a vendor that is a shop's name rather than an
// address, and a row whose PARÇA is "SERVİS" with no vendor at all.

import { describe, expect, it } from 'vitest'
import { highestOdometer, sortByDateDesc } from '../../src/shared/entries.js'
import { formatDate, todayIso } from '../../src/shared/format.js'
import type { ServiceEntry } from '../../src/shared/records.js'
import { toMoney } from '../../src/shared/scaled.js'
import {
  emptyServiceDraft,
  serviceDraftOf,
  serviceEntryOf,
  serviceGoesBackwards
} from '../../src/shared/service-draft.js'

/** Row 1: the tyres, at 370 km, from an address. §4.4's own sample. */
const TYRES: ServiceEntry = {
  id: 's-0001',
  date: '2025-05-14',
  part: 'Michelin Primacy 4 S1 235/50R19 103V XL',
  odometer_km: 370,
  amount: toMoney(8664),
  vendor: 'https://www.lastikcim.com.tr/'
}

/** Row 3: a pollen filter, bought from a shop whose name is not an address. */
const FILTER: ServiceEntry = {
  id: 's-0003',
  date: '2025-10-21',
  part: 'Filtron K 1444A Polen Filtresi',
  odometer_km: 8300,
  amount: toMoney(760),
  vendor: 'heryedek'
}

/** Row 4: labour. No part number, no vendor, twelve thousand lira. */
const LABOUR: ServiceEntry = {
  id: 's-0004',
  date: '2026-04-20',
  part: 'SERVİS',
  odometer_km: 15_100,
  amount: toMoney(12_000),
  vendor: ''
}

describe('a new service record', () => {
  it('is dated today, from the local calendar', () => {
    expect(emptyServiceDraft().date).toBe(formatDate(todayIso()))
  })

  it('guesses nothing else', () => {
    const draft = emptyServiceDraft()
    expect(draft.part).toBe('')
    expect(draft.odometer_km).toBe('')
    expect(draft.amount).toBe('')
    expect(draft.vendor).toBe('')
  })
})

describe('the maker’s own four rows survive a round trip', () => {
  it('keeps an address exactly as it was typed', () => {
    expect(serviceEntryOf(serviceDraftOf(TYRES)).vendor).toBe('https://www.lastikcim.com.tr/')
  })

  it('keeps a vendor that is a shop name and not an address at all', () => {
    // ALINDIĞI LİNK / YER — the sheet says "or place", and means it. There is
    // nothing here to validate, because this was never a URL field.
    expect(serviceEntryOf(serviceDraftOf(FILTER)).vendor).toBe('heryedek')
  })

  it('accepts a row with labour instead of a part, and no vendor', () => {
    const record = serviceEntryOf(serviceDraftOf(LABOUR))
    expect(record.part).toBe('SERVİS')
    expect(record.vendor).toBe('')
    expect(record.amount).toBe(toMoney(12_000))
  })

  it('returns every field of §4.4 unchanged', () => {
    expect(serviceEntryOf(serviceDraftOf(TYRES))).toEqual({
      date: TYRES.date,
      part: TYRES.part,
      odometer_km: TYRES.odometer_km,
      amount: TYRES.amount,
      vendor: TYRES.vendor
    })
  })
})

describe('what the draft refuses to store', () => {
  it('keeps the amount positive even when a minus is typed', () => {
    expect(serviceEntryOf({ ...emptyServiceDraft(), amount: '-8.664,00' }).amount).toBe(
      toMoney(8664)
    )
  })

  it('turns an unreadable amount into nothing entered, not a guess', () => {
    expect(serviceEntryOf({ ...emptyServiceDraft(), amount: 'a lot' }).amount).toBe(0)
  })

  it('saves an unparseable date empty rather than refusing the rest', () => {
    const record = serviceEntryOf({
      ...emptyServiceDraft(),
      date: '31/02/2026',
      amount: '760,00'
    })
    expect(record.date).toBe('')
    expect(record.amount).toBe(toMoney(760))
  })
})

describe('the odometer hint reads every file that carries one', () => {
  const fuel = [{ id: 'f-0012', odometer_km: 19_764 }]
  const service = [{ id: 's-0004', odometer_km: 15_100 }]

  it('takes the highest reading across fuel and service', () => {
    expect(highestOdometer([...fuel, ...service])).toBe(19_764)
  })

  it('would have been wrong reading either file alone', () => {
    // The hint existed in F4 and read fuel only. With service records present
    // and no fill-up since, that answer comes from the wrong file.
    expect(highestOdometer(service)).toBe(15_100)
    expect(highestOdometer([...fuel, ...service])).not.toBe(highestOdometer(service))
  })

  it('leaves the entry being edited out of its own hint', () => {
    expect(highestOdometer([...fuel, ...service], 'f-0012')).toBe(15_100)
  })

  it('has nothing to say about a vehicle with no readings', () => {
    expect(highestOdometer([])).toBe(null)
  })
})

describe('a reading that goes backwards (§5.1, §3.8)', () => {
  it('is reported so the form can warn', () => {
    expect(serviceGoesBackwards({ ...emptyServiceDraft(), odometer_km: '9000' }, 15_100)).toBe(true)
  })

  it('is not reported when it moves forward', () => {
    expect(serviceGoesBackwards({ ...emptyServiceDraft(), odometer_km: '19000' }, 15_100)).toBe(
      false
    )
  })

  it('says nothing when there is no previous reading to compare with', () => {
    expect(serviceGoesBackwards({ ...emptyServiceDraft(), odometer_km: '370' }, null)).toBe(false)
  })
})

describe('the order a service list is shown in', () => {
  it('puts the newest first and breaks a tie on the id', () => {
    const rows = sortByDateDesc([TYRES, LABOUR, FILTER])
    expect(rows.map((row) => row.id)).toEqual(['s-0004', 's-0003', 's-0001'])
  })

  it('orders two records taken at the same odometer by their dates', () => {
    // Rows 2 and 3 of the sheet are both at 8.300 km, two days apart.
    const wiper: ServiceEntry = { ...FILTER, id: 's-0002', date: '2025-10-19' }
    expect(sortByDateDesc([wiper, FILTER]).map((row) => row.id)).toEqual(['s-0003', 's-0002'])
  })
})
