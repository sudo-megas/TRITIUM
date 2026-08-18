// What a list of costs is asked, wherever it is shown (XTRITIUM §6).
//
// Nothing here is stored. §3.7 — derived values are computed at read time, and
// a cost's sign is derived from its `income` flag rather than kept a second time
// in its amount.

import { idSequence, type CostEntry } from './records.js'

/**
 * Newest first, by date.
 *
 * A cost has no odometer, so F4's `sortByOdometer` does not apply to it. The
 * tie-break on id is not decoration: the maker entered Trafik Sigortası 26/27
 * and Kasko 26/27 on the same eleventh of April, and two entries that compare
 * equal would be free to swap places between renders. Descending id puts the
 * later-entered one first, which is the same "newest first" the date gives.
 *
 * An entry with no date sorts to the end: it is unfinished, not ancient.
 */
export function sortByDateDesc(entries: readonly CostEntry[]): CostEntry[] {
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) {
      if (left.date.length === 0) return 1
      if (right.date.length === 0) return -1
      return left.date < right.date ? 1 : -1
    }
    return idSequence(right.id) - idSequence(left.id)
  })
}

/**
 * The amount as it is shown: negative when the entry is income.
 *
 * XTRITIUM §4.4 calls these "negative costs (payouts, refunds)", and the flag
 * is the sign. The file keeps `amount` positive beside `income = true`; storing
 * a negative amount as well would be two sources of truth for one fact (§3.7).
 */
export function signedAmount(entry: Pick<CostEntry, 'amount' | 'income'>): number {
  return entry.income ? -entry.amount : entry.amount
}
