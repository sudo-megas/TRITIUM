package io.github.sudomegas.tritium.storage

import java.time.YearMonth

/**
 * XTRITIUM §7.2 — the five time ranges the lists filter by, plus a custom
 * pair. Ported from the desktop's `src/shared/range.ts`, function for
 * function.
 *
 * Nothing here reads a clock — `today` always arrives as a parameter, the
 * same discipline [FuelDraft.quickAddDefaults] already uses, so every
 * boundary is testable without freezing time. Dates are compared as
 * `YYYY-MM-DD` strings: fixed-width and zero-padded, so lexical order IS
 * chronological order.
 *
 * This module answers only "what window does a chip mean" and "is this date
 * inside it" — never what gets computed. [Consumption.consumptionById] is
 * always fed a vehicle's whole fuel history; a range here only ever filters
 * rows already rendered, at the screen (AF7.md §1.2).
 */
enum class RangeKey { ALL, YTD, PREVIOUS_YEAR, THIS_MONTH, PREVIOUS_MONTH, CUSTOM }

/** An inclusive window. `null` on either side means open in that direction. */
data class DateBounds(val from: String?, val to: String?)

val ALL_TIME = DateBounds(from = null, to = null)

/** A custom range as the two fields hold it, before parsing. */
data class CustomRange(val from: String?, val to: String?)

private fun pad(value: Int, width: Int): String = value.toString().padStart(width, '0')
private fun firstOfMonth(year: Int, month: Int): String = "${pad(year, 4)}-${pad(month, 2)}-01"
private fun endOfMonth(year: Int, month: Int): String {
    val lastDay = YearMonth.of(year, month).lengthOfMonth()
    return "${pad(year, 4)}-${pad(month, 2)}-${pad(lastDay, 2)}"
}

/**
 * The window a chip means, given today.
 *
 * `to` is today, not the end of the period, for the two ranges still
 * running — a "this month" reaching the 31st would describe days that have
 * not happened (§3.3).
 */
fun boundsFor(key: RangeKey, today: String, custom: CustomRange? = null): DateBounds {
    val year = today.substring(0, 4).toInt()
    val month = today.substring(5, 7).toInt()

    return when (key) {
        RangeKey.ALL -> ALL_TIME
        RangeKey.YTD -> DateBounds(from = firstOfMonth(year, 1), to = today)
        RangeKey.PREVIOUS_YEAR -> DateBounds(from = "${pad(year - 1, 4)}-01-01", to = "${pad(year - 1, 4)}-12-31")
        RangeKey.THIS_MONTH -> DateBounds(from = firstOfMonth(year, month), to = today)
        RangeKey.PREVIOUS_MONTH -> {
            // January reaches back into last December — a naive month - 1
            // produces month zero.
            val y = if (month == 1) year - 1 else year
            val m = if (month == 1) 12 else month - 1
            DateBounds(from = firstOfMonth(y, m), to = endOfMonth(y, m))
        }
        // An unreadable bound is simply not applied — filtering to nothing
        // while the maker is still typing the year would look like data
        // loss (§3.8).
        RangeKey.CUSTOM -> DateBounds(from = custom?.from, to = custom?.to)
    }
}

/**
 * Whether a date falls inside the window. An entry with no date is shown
 * only when the window is open at both ends — it belongs to no period, so
 * any bounded period naming one would claim something not known, but
 * hiding it from "all time" would make it unreachable (§3.8).
 */
fun withinBounds(date: String, bounds: DateBounds): Boolean {
    if (date.isEmpty()) return bounds.from == null && bounds.to == null
    if (bounds.from != null && date < bounds.from) return false
    if (bounds.to != null && date > bounds.to) return false
    return true
}

/** The entries a window admits, in the order they arrived. */
fun <T> filterByBounds(entries: List<T>, bounds: DateBounds, dateOf: (T) -> String): List<T> =
    entries.filter { withinBounds(dateOf(it), bounds) }
