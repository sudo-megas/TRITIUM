// The time ranges of XTRITIUM §7.2, as pure arithmetic over `YYYY-MM-DD`.
//
// §7 gives the lists "the same time-range chips as the charts", so this module
// is written to be used twice: F7's tables now, F8's charts next. It lives in
// shared/ from the start rather than inside a pane a later milestone would have
// to reach into.
//
// Nothing here reads a clock. Today arrives as a string — from `todayIso`, which
// is built from the local calendar and never from UTC (§3.6, and F4's UTC+3
// trap) — so every boundary is testable without freezing time.
//
// Dates are compared as strings. `YYYY-MM-DD` is fixed-width and zero-padded, so
// lexical order IS chronological order, and no Date object is constructed to
// answer a question about a calendar.

/** XTRITIUM §7.2, in the order the chips are shown. */
export const RANGE_KEYS = [
  'all',
  'ytd',
  'previous-year',
  'this-month',
  'previous-month',
  'custom'
] as const

export type RangeKey = (typeof RANGE_KEYS)[number]

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === 'string' && (RANGE_KEYS as readonly string[]).includes(value)
}

/** An inclusive window. `null` on either side means open in that direction. */
export interface DateBounds {
  from: string | null
  to: string | null
}

export const ALL_TIME: DateBounds = { from: null, to: null }

/** A custom range as the two fields hold it, before parsing. */
export interface CustomRange {
  from: string | null
  to: string | null
}

function pad(value: number, width: number): string {
  return value.toString().padStart(width, '0')
}

/**
 * The last day of a month, by the real calendar.
 *
 * `Date.UTC(year, month, 0)` is the day before the first of `month`, which is
 * the last day of the month before it — the standard trick, and the reason
 * February is right in a leap year without a table. Only UTC getters are read,
 * so no local offset and no locale enters (§3.6).
 */
function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function firstOfMonth(year: number, month: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-01`
}

function endOfMonth(year: number, month: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(lastDayOf(year, month), 2)}`
}

/**
 * The window a chip means, given today.
 *
 * `to` is today rather than the end of the period for the two ranges that are
 * still running — a "this month" that claimed to reach the 31st would be
 * describing days that have not happened, and §3.3 keeps TRITIUM out of the
 * future in every other respect too.
 */
export function boundsFor(key: RangeKey, today: string, custom?: CustomRange): DateBounds {
  const year = Number.parseInt(today.slice(0, 4), 10)
  const month = Number.parseInt(today.slice(5, 7), 10)

  switch (key) {
    case 'all':
      return ALL_TIME

    case 'ytd':
      return { from: firstOfMonth(year, 1), to: today }

    case 'previous-year':
      return { from: `${pad(year - 1, 4)}-01-01`, to: `${pad(year - 1, 4)}-12-31` }

    case 'this-month':
      return { from: firstOfMonth(year, month), to: today }

    case 'previous-month': {
      // January reaches back into last December, which is the case a naive
      // `month - 1` gets wrong by producing month zero.
      const y = month === 1 ? year - 1 : year
      const m = month === 1 ? 12 : month - 1
      return { from: firstOfMonth(y, m), to: endOfMonth(y, m) }
    }

    case 'custom':
      // An unreadable bound is simply not applied. The alternative — filtering
      // to nothing while the maker is still typing the year — would look like
      // data loss (§3.8: the app does not argue with what is being typed).
      return { from: custom?.from ?? null, to: custom?.to ?? null }
  }
}

/**
 * Whether a date falls inside the window.
 *
 * An entry with no date is shown only when the window is open at both ends. It
 * belongs to no period, so any period that named one would be claiming
 * something about it that is not known — but hiding it from "all time" would
 * make it unreachable, and an unreachable record cannot be repaired (§3.8).
 */
export function withinBounds(date: string, bounds: DateBounds): boolean {
  if (date.length === 0) return bounds.from === null && bounds.to === null
  if (bounds.from !== null && date < bounds.from) return false
  if (bounds.to !== null && date > bounds.to) return false
  return true
}

/** The entries a window admits, in the order they arrived. */
export function filterByBounds<T extends { date: string }>(
  entries: readonly T[],
  bounds: DateBounds
): T[] {
  return entries.filter((entry) => withinBounds(entry.date, bounds))
}
