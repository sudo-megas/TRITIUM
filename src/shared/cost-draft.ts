// What the cost form holds while it is being filled in (XTRITIUM §6.2).
//
// The same shape as `fuel-draft.ts`, and for the same reason: a draft holds
// every field as the text the maker sees, in the family convention, and becomes
// a record only on save. One place decides what "11.746,00" means.
//
// A cost has no derived figure — the amount is entered, not multiplied out —
// which is the one way this form is simpler than the fuel form.

import { formatDate, parseDate, parseInput, toInput, todayIso } from './format.js'
import { COST_GROUPS, type CostEntry, type CostGroup } from './records.js'
import { MONEY_DECIMALS } from './scaled.js'
import { categorySlug } from './slug.js'

export interface CostDraft {
  date: string
  group: CostGroup
  /**
   * A slug for a picked category, and whatever the maker typed for a MANUAL
   * one. Both go through `categorySlug` on save — a slug slugifies to itself,
   * so the two paths need no separate handling and cannot disagree.
   */
  category: string
  title: string
  amount: string
  income: boolean
  payment_method: string
  bank: string
  instalment: string
  note: string
}

/**
 * A new cost: today, and the first group of §6.1's tree.
 *
 * İLK ALIŞ leads because the tree leads with it, and because it is what a
 * vehicle's first costs are. Nothing else is guessed — a category the maker has
 * not chosen stays empty rather than defaulting to whichever one happens to be
 * first in its column.
 */
export function emptyCostDraft(): CostDraft {
  return {
    date: formatDate(todayIso()),
    group: COST_GROUPS[0],
    category: '',
    title: '',
    amount: '',
    income: false,
    payment_method: '',
    bank: '',
    instalment: '',
    note: ''
  }
}

export function costDraftOf(entry: CostEntry): CostDraft {
  return {
    date: formatDate(entry.date),
    group: entry.group,
    category: entry.category,
    title: entry.title,
    amount: entry.amount > 0 ? toInput(entry.amount, MONEY_DECIMALS) : '',
    income: entry.income,
    payment_method: entry.payment_method,
    bank: entry.bank,
    instalment: entry.instalment,
    note: entry.note
  }
}

/**
 * A draft back into a record, without an id — the id is allocated in the main
 * process. Anything unreadable becomes the empty value the record already uses
 * for "not entered": never a guess, and never a refusal that would throw away
 * the rest of what was typed (§3.8).
 *
 * `amount` stays positive whatever `income` says. The flag is the sign (§4.4),
 * and a negative amount beside it would be the same fact stored twice (§3.7).
 */
export function costEntryOf(draft: CostDraft): Omit<CostEntry, 'id'> {
  return {
    date: parseDate(draft.date) ?? '',
    group: draft.group,
    category: categorySlug(draft.category),
    title: draft.title.trim(),
    amount: Math.abs(parseInput(draft.amount, MONEY_DECIMALS) ?? 0),
    income: draft.income,
    payment_method: draft.payment_method,
    bank: draft.bank.trim(),
    instalment: draft.instalment.trim(),
    note: draft.note.trim()
  }
}
