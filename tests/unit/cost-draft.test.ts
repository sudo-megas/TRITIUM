// What the cost form holds while it is being filled in (F5), and what it turns
// into on the way to costs.toml.

import { describe, expect, it } from 'vitest'
import { costDraftOf, costEntryOf, emptyCostDraft } from '../../src/shared/cost-draft.js'
import { formatDate, todayIso } from '../../src/shared/format.js'
import type { CostEntry } from '../../src/shared/records.js'
import { toMoney } from '../../src/shared/scaled.js'
import { categorySlug, slugFor } from '../../src/shared/slug.js'

/** The maker's own ninth row: Trafik Sigortası 26/27, 11.746,00, Kredi Kartı. */
const ENTRY: CostEntry = {
  id: 'c-0001',
  date: '2026-04-11',
  group: 'tekrar-eden',
  category: 'trafik-sigortasi',
  title: 'Trafik Sigortası 26/27',
  amount: toMoney(11746),
  income: false,
  payment_method: 'kredi-karti',
  bank: 'Enpara',
  instalment: 'Taksit 6',
  note: ''
}

describe('a new cost', () => {
  it('is dated today, from the local calendar', () => {
    expect(emptyCostDraft().date).toBe(formatDate(todayIso()))
  })

  it('leads with the first group of the tree and chooses no category', () => {
    const draft = emptyCostDraft()
    expect(draft.group).toBe('ilk-alis')
    // §3.3 — nothing is chosen on the maker's behalf.
    expect(draft.category).toBe('')
    expect(draft.title).toBe('')
    expect(draft.amount).toBe('')
    expect(draft.income).toBe(false)
  })
})

describe('an existing cost, opened for editing (§3.8)', () => {
  it('round-trips every field it was given', () => {
    expect(costEntryOf(costDraftOf(ENTRY))).toEqual({
      date: ENTRY.date,
      group: ENTRY.group,
      category: ENTRY.category,
      title: ENTRY.title,
      amount: ENTRY.amount,
      income: ENTRY.income,
      payment_method: ENTRY.payment_method,
      bank: ENTRY.bank,
      instalment: ENTRY.instalment,
      note: ENTRY.note
    })
  })

  it('keeps the bank and the instalment apart', () => {
    // The whole point of the milestone: on the maker's sheet these were one
    // AÇIKLAMA cell reading "Enpara / Taksit 6", which is why neither could
    // ever be summed.
    const draft = costDraftOf(ENTRY)
    expect(draft.bank).toBe('Enpara')
    expect(draft.instalment).toBe('Taksit 6')
  })

  it('carries a payment method that is not one of the shipped three', () => {
    // §4.4 calls the list editable and F11 owns settings; until then a value
    // typed into the file by hand must survive an edit of the same entry.
    const hand = { ...ENTRY, payment_method: 'havale' }
    expect(costEntryOf(costDraftOf(hand)).payment_method).toBe('havale')
  })

  it('shows an amount in the family convention and reads it back exactly', () => {
    expect(costDraftOf(ENTRY).amount).toBe('11746,00')
    expect(costEntryOf(costDraftOf(ENTRY)).amount).toBe(toMoney(11746))
  })
})

describe('a MANUAL category, typed by the maker (§6.1)', () => {
  it('is stored as a key, so two spellings are one category', () => {
    const draft = { ...emptyCostDraft(), group: 'manual' as const, amount: '100,00' }
    const upper = costEntryOf({ ...draft, category: 'Lastik' }).category
    const lower = costEntryOf({ ...draft, category: 'lastik' }).category
    expect(upper).toBe('lastik')
    expect(upper).toBe(lower)
  })

  it('transliterates the Turkish letters rather than consulting a locale', () => {
    expect(categorySlug('Şöför Odası')).toBe('sofor-odasi')
    expect(categorySlug('Çekici Ücreti')).toBe('cekici-ucreti')
  })

  it('leaves an untyped category empty rather than inventing one', () => {
    // slugFor gives a vehicle a directory whatever it is called; a category
    // must not be invented, so the empty case does not fall through to it.
    expect(slugFor('')).toBe('vehicle')
    expect(categorySlug('')).toBe('')
    expect(categorySlug('   ')).toBe('')
  })
})

describe('what the draft refuses to store', () => {
  it('keeps the amount positive however income is flagged (§3.7)', () => {
    const draft = { ...emptyCostDraft(), amount: '11746,00', income: true }
    expect(costEntryOf(draft).amount).toBe(toMoney(11746))
  })

  it('keeps it positive even when a minus is typed into the field', () => {
    const draft = { ...emptyCostDraft(), amount: '-11746,00', income: true }
    expect(costEntryOf(draft).amount).toBe(toMoney(11746))
  })

  it('turns an unreadable amount into nothing entered, not a guess', () => {
    expect(costEntryOf({ ...emptyCostDraft(), amount: 'lots' }).amount).toBe(0)
  })

  it('saves an unparseable date empty rather than refusing the rest', () => {
    const draft = { ...emptyCostDraft(), date: '31/02/2026', amount: '10,00' }
    const record = costEntryOf(draft)
    expect(record.date).toBe('')
    expect(record.amount).toBe(toMoney(10))
  })
})
