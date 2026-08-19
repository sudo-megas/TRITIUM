// The cost model of XTRITIUM §6 (F5): the tree the form may offer, the order a
// list is shown in, and the sign an amount is shown with.

import { describe, expect, it } from 'vitest'
import { signedAmount, sortByDateDesc } from '../../src/shared/costs.js'
import {
  COST_CATEGORIES,
  SERVICE_CATEGORY,
  pickableCategories,
  takesTypedCategory,
  type CostEntry
} from '../../src/shared/records.js'
import { toMoney } from '../../src/shared/scaled.js'

function cost(id: string, date: string, over: Partial<CostEntry> = {}): CostEntry {
  return {
    id,
    date,
    group: 'tekrar-eden',
    category: 'kasko',
    title: '',
    amount: toMoney(100),
    income: false,
    payment_method: '',
    bank: '',
    instalment: '',
    note: '',
    ...over
  }
}

describe('the tree a cost form may offer (§6.1)', () => {
  it('offers İLK ALIŞ whole — none of it lives anywhere but costs.toml', () => {
    expect(pickableCategories('ilk-alis')).toEqual(COST_CATEGORIES['ilk-alis'])
  })

  it('withholds Periyodik Bakım from TEKRAR EDEN', () => {
    // §6.2 sends its entries to service.toml, and the cost form writes
    // costs.toml. F6 gives it its own entry path (F5.md decision 3).
    expect(COST_CATEGORIES['tekrar-eden']).toContain(SERVICE_CATEGORY)
    expect(pickableCategories('tekrar-eden')).not.toContain(SERVICE_CATEGORY)
  })

  it('leaves the rest of TEKRAR EDEN alone', () => {
    expect(pickableCategories('tekrar-eden')).toEqual([
      'mtv-1',
      'mtv-2',
      'trafik-sigortasi',
      'kasko'
    ])
  })

  it('keeps Periyodik Bakım in the tree itself, so a stored one still reads back', () => {
    // Withheld from the picker is not the same as removed: a costs.toml that
    // carries one, hand-written or left by an earlier version, must still read
    // as itself rather than falling through to manual.
    expect(COST_CATEGORIES['tekrar-eden']).toContain(SERVICE_CATEGORY)
  })

  it('asks MANUAL for a typed category, and nothing else', () => {
    expect(takesTypedCategory('manual')).toBe(true)
    expect(takesTypedCategory('ilk-alis')).toBe(false)
    expect(takesTypedCategory('tekrar-eden')).toBe(false)
  })
})

describe('the order a cost list is shown in', () => {
  it('puts the newest date first', () => {
    const rows = sortByDateDesc([
      cost('c-0001', '2025-04-22'),
      cost('c-0002', '2026-04-11'),
      cost('c-0003', '2025-07-16')
    ])
    expect(rows.map((row) => row.id)).toEqual(['c-0002', 'c-0003', 'c-0001'])
  })

  it('breaks an equal date on the id, newest entered first', () => {
    // The maker entered Trafik Sigortası 26/27 and Kasko 26/27 on the same
    // eleventh of April. Two entries that compared equal would be free to swap
    // places between renders.
    const rows = sortByDateDesc([cost('c-0009', '2026-04-11'), cost('c-0010', '2026-04-11')])
    expect(rows.map((row) => row.id)).toEqual(['c-0010', 'c-0009'])
  })

  it('is stable enough to give the same answer twice', () => {
    const entries = [
      cost('c-0001', '2026-04-11'),
      cost('c-0002', '2026-04-11'),
      cost('c-0003', '2025-04-22')
    ]
    expect(sortByDateDesc(entries)).toEqual(sortByDateDesc(entries))
  })

  it('sorts an undated entry to the end — unfinished, not ancient', () => {
    const rows = sortByDateDesc([cost('c-0001', ''), cost('c-0002', '2025-04-22')])
    expect(rows.map((row) => row.id)).toEqual(['c-0002', 'c-0001'])
  })

  it('does not disturb the list it was given', () => {
    const entries = [cost('c-0001', '2025-04-22'), cost('c-0002', '2026-04-11')]
    sortByDateDesc(entries)
    expect(entries.map((row) => row.id)).toEqual(['c-0001', 'c-0002'])
  })
})

describe('income is the sign (§4.4)', () => {
  it('leaves an ordinary cost positive', () => {
    expect(signedAmount({ amount: toMoney(11746), income: false })).toBe(toMoney(11746))
  })

  it('shows a payout negative without the record holding a negative', () => {
    const entry = cost('c-0001', '2026-04-11', { amount: toMoney(11746), income: true })
    expect(entry.amount).toBeGreaterThan(0)
    expect(signedAmount(entry)).toBe(-toMoney(11746))
  })
})
