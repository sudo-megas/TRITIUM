// What both fuel entry paths share (F4): the draft, and the defaults quick-add
// applies without asking.

import { describe, expect, it } from 'vitest'
import {
  draftOf,
  draftTotal,
  emptyDraft,
  entryOf,
  goesBackwards,
  lastOdometer,
  todayIso
} from '../../src/shared/fuel-draft.js'
import { formatDate } from '../../src/shared/format.js'
import type { FuelEntry } from '../../src/shared/records.js'
import { toPump } from '../../src/shared/scaled.js'

const ENTRY: FuelEntry = {
  id: 'f-0001',
  date: '2026-08-16',
  odometer_km: 19_764,
  litres: toPump(29.99),
  price_per_litre: toPump(73.38),
  full_tank: true,
  fuel_type: 'Kurşunsuz 95'
}

describe("today's date", () => {
  it('is the local calendar day, not the UTC one', () => {
    // The whole point of not using toISOString(): this machine is UTC+3, so a
    // fill-up entered at 01:00 would be filed on yesterday through UTC. The
    // invariant checked here holds in any zone — the components that go in are
    // the components that come out.
    expect(todayIso(new Date(2026, 7, 18, 1, 30))).toBe('2026-08-18')
    expect(todayIso(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01')
    expect(todayIso(new Date(2025, 11, 31, 0, 0))).toBe('2025-12-31')
  })

  it('pads a single-digit month and day', () => {
    expect(todayIso(new Date(2026, 2, 5, 12, 0))).toBe('2026-03-05')
  })
})

describe('a new fill-up', () => {
  it('starts on today, as a full tank', () => {
    // §5.2 — quick-add does not ask, and a false default would mean the path
    // built for the common case never produces a consumption point at all.
    const draft = emptyDraft('Dizel')

    expect(draft.full_tank).toBe(true)
    expect(draft.date).toBe(formatDate(todayIso()))
    expect(draft.fuel_type).toBe('Dizel')
    expect(draft.odometer_km).toBe('')
    expect(draft.litres).toBe('')
  })
})

describe('a draft', () => {
  it('shows every figure in the family convention', () => {
    const draft = draftOf(ENTRY)

    expect(draft.date).toBe('16/08/2026')
    expect(draft.odometer_km).toBe('19764')
    expect(draft.litres).toBe('29,990')
    expect(draft.price_per_litre).toBe('73,380')
    expect(draft.full_tank).toBe(true)
  })

  it('round-trips back to the record it came from', () => {
    // The whole point: what is typed, stored and redisplayed is the same figure.
    const { id, ...record } = ENTRY
    expect(id).toBe('f-0001')
    expect(entryOf(draftOf(ENTRY))).toEqual(record)
  })

  it('takes an unreadable figure as not entered, and keeps the rest', () => {
    const draft = { ...draftOf(ENTRY), litres: 'about thirty' }
    const record = entryOf(draft)

    expect(record.litres).toBe(0)
    expect(record.odometer_km).toBe(19_764)
    expect(record.price_per_litre).toBe(toPump(73.38))
  })

  it('carries the live total, and none while there is nothing to multiply', () => {
    expect(draftTotal(draftOf(ENTRY))).toBe(220_067)
    expect(draftTotal({ ...draftOf(ENTRY), price_per_litre: '' })).toBeNull()
  })
})

describe('the odometer hint', () => {
  const entries: FuelEntry[] = [
    { ...ENTRY, id: 'f-0001', odometer_km: 19_000 },
    { ...ENTRY, id: 'f-0002', odometer_km: 19_764 }
  ]

  it('is the highest reading already recorded', () => {
    expect(lastOdometer(entries)).toBe(19_764)
  })

  it('leaves the entry being edited out of its own hint', () => {
    expect(lastOdometer(entries, 'f-0002')).toBe(19_000)
  })

  it('is absent for the first fill-up of all', () => {
    expect(lastOdometer([])).toBeNull()
  })

  it('warns when the reading goes backwards, and only then', () => {
    // §5.1 — a warning, then accepted. Typos in old entries must be fixable.
    const draft = draftOf(ENTRY)

    expect(goesBackwards({ ...draft, odometer_km: '18000' }, 19_000)).toBe(true)
    expect(goesBackwards({ ...draft, odometer_km: '20000' }, 19_000)).toBe(false)
    expect(goesBackwards({ ...draft, odometer_km: '19000' }, 19_000)).toBe(false)
    expect(goesBackwards({ ...draft, odometer_km: '' }, 19_000)).toBe(false)
    expect(goesBackwards({ ...draft, odometer_km: '18000' }, null)).toBe(false)
  })
})
