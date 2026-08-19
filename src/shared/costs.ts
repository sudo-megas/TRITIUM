// What a list of costs is asked (XTRITIUM §6).
//
// Nothing here is stored. §3.7 — derived values are computed at read time, and
// a cost's sign is derived from its `income` flag rather than kept a second time
// in its amount.
//
// The newest-first ordering that used to live here moved to `entries.ts` in F6,
// when service became its second caller.

import type { CostEntry } from './records.js'

export { sortByDateDesc } from './entries.js'

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
