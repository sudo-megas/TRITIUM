// What every `[[entry]]` list is asked, whichever file it came from.
//
// F5 wrote the newest-first ordering inside `costs.ts`, when costs were the only
// dated list without an odometer to sort by. F6 gave service the same question,
// and service code importing cost code to learn how to sort would have been the
// wrong shape for a fact neither of them owns — the same move `slugFor` and
// `todayIso` made in F5. The second caller is what promotes a helper.

/**
 * Two `YYYY-MM-DD` dates, compared. Fixed-width and zero-padded, so lexical
 * order is chronological order and no Date object is built to ask a calendar
 * question.
 *
 * It exists as a named function rather than inline in each caller because the
 * three panes each sort by date, and because an inline `a.date < b.date` inside
 * a one-line arrow reads to `audit-strings` as JSX text between a `>` and a `<`.
 * Better a helper the three of them share than a gate taught to look away.
 */
export function compareDate(left: string, right: string): number {
  if (left === right) return 0
  return left > right ? 1 : -1
}

/** The least an entry must have to be ordered or hinted from. */
export interface DatedEntry {
  id: string
  date: string
}

/** The numeric part of an id, or 0. Kept here so ordering needs nothing else. */
function sequenceOf(id: string): number {
  const match = /^[fcs]-(\d+)$/.exec(id)
  return match === null ? 0 : Number.parseInt(match[1] as string, 10)
}

/**
 * Newest first, by date, with the id breaking a tie.
 *
 * The tie-break is not decoration. The maker entered Trafik Sigortası 26/27 and
 * Kasko 26/27 on the same eleventh of April, and his service sheet holds a
 * wiper and a pollen filter two days apart at the same 8.300 km. Two entries
 * that compared equal would be free to swap places between renders.
 *
 * An entry with no date sorts to the end: it is unfinished, not ancient.
 */
export function sortByDateDesc<T extends DatedEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) {
      if (left.date.length === 0) return 1
      if (right.date.length === 0) return -1
      return left.date < right.date ? 1 : -1
    }
    return sequenceOf(right.id) - sequenceOf(left.id)
  })
}

/**
 * The highest odometer reading the vehicle knows about, from every file that
 * carries one — or null when nothing does.
 *
 * F4 built this hint from `fuel.toml` alone, because fuel was the only record
 * with an odometer. F6's service entries have one too, and a hint that read only
 * the fuel file would tell the maker his car had 19.764 km when the last service
 * said 15.100 — from the wrong file, and confidently.
 *
 * The entry being edited is left out of its own hint.
 */
export function highestOdometer(
  entries: readonly { id: string; odometer_km: number }[],
  exceptId?: string
): number | null {
  let highest: number | null = null

  for (const entry of entries) {
    if (entry.id === exceptId) continue
    if (highest === null || entry.odometer_km > highest) highest = entry.odometer_km
  }

  return highest
}
