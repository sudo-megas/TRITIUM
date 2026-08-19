package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RangeTest {

    private val today = "2026-08-16"

    @Test
    fun `all time is open on both ends`() {
        assertEquals(DateBounds(from = null, to = null), boundsFor(RangeKey.ALL, today))
    }

    @Test
    fun `ytd runs from the first of january to today`() {
        assertEquals(DateBounds(from = "2026-01-01", to = "2026-08-16"), boundsFor(RangeKey.YTD, today))
    }

    @Test
    fun `ytd on the first of january is just that one day`() {
        assertEquals(
            DateBounds(from = "2026-01-01", to = "2026-01-01"),
            boundsFor(RangeKey.YTD, today = "2026-01-01"),
        )
    }

    @Test
    fun `previous year is the whole calendar year before this one`() {
        assertEquals(DateBounds(from = "2025-01-01", to = "2025-12-31"), boundsFor(RangeKey.PREVIOUS_YEAR, today))
    }

    @Test
    fun `previous year from inside january still reaches back a full year`() {
        assertEquals(
            DateBounds(from = "2025-01-01", to = "2025-12-31"),
            boundsFor(RangeKey.PREVIOUS_YEAR, today = "2026-01-15"),
        )
    }

    @Test
    fun `this month runs from its first day to today`() {
        assertEquals(DateBounds(from = "2026-08-01", to = "2026-08-16"), boundsFor(RangeKey.THIS_MONTH, today))
    }

    @Test
    fun `previous month is the whole calendar month before this one`() {
        assertEquals(DateBounds(from = "2026-07-01", to = "2026-07-31"), boundsFor(RangeKey.PREVIOUS_MONTH, today))
    }

    @Test
    fun `previous month from inside january reaches back into last december`() {
        assertEquals(
            "a naive month - 1 produces month zero; january must reach back to december",
            DateBounds(from = "2025-12-01", to = "2025-12-31"),
            boundsFor(RangeKey.PREVIOUS_MONTH, today = "2026-01-15"),
        )
    }

    @Test
    fun `previous month gets february's real length in a leap year`() {
        assertEquals(DateBounds(from = "2024-02-01", to = "2024-02-29"), boundsFor(RangeKey.PREVIOUS_MONTH, today = "2024-03-10"))
    }

    @Test
    fun `custom carries its two bounds through unchanged`() {
        val custom = CustomRange(from = "2026-01-01", to = "2026-06-30")
        assertEquals(DateBounds(from = "2026-01-01", to = "2026-06-30"), boundsFor(RangeKey.CUSTOM, today, custom))
    }

    @Test
    fun `custom with nothing typed yet is open on both ends, not filtering to nothing`() {
        assertEquals(DateBounds(from = null, to = null), boundsFor(RangeKey.CUSTOM, today, custom = null))
    }

    @Test
    fun `withinBounds is true for a date on either boundary, inclusive`() {
        val bounds = DateBounds(from = "2026-01-01", to = "2026-06-30")
        assertTrue(withinBounds("2026-01-01", bounds))
        assertTrue(withinBounds("2026-06-30", bounds))
        assertTrue(withinBounds("2026-03-15", bounds))
        assertFalse(withinBounds("2025-12-31", bounds))
        assertFalse(withinBounds("2026-07-01", bounds))
    }

    @Test
    fun `a dateless entry is shown only when the window is open at both ends`() {
        assertTrue(withinBounds("", ALL_TIME))
        assertFalse(withinBounds("", DateBounds(from = "2026-01-01", to = null)))
        assertFalse(withinBounds("", DateBounds(from = null, to = "2026-01-01")))
    }

    @Test
    fun `filterByBounds admits entries within the window, in the order they arrived`() {
        data class Row(val id: String, val date: String)
        val rows = listOf(Row("a", "2026-01-01"), Row("b", "2026-03-01"), Row("c", "2026-12-31"))
        val bounds = DateBounds(from = "2026-02-01", to = "2026-06-30")
        assertEquals(listOf("b"), filterByBounds(rows, bounds) { it.date }.map { it.id })
    }

    @Test
    fun `an excluding range returns an empty list, not all of them`() {
        data class Row(val id: String, val date: String)
        val rows = listOf(Row("a", "2026-01-01"), Row("b", "2026-03-01"))
        val bounds = DateBounds(from = "2030-01-01", to = "2030-12-31")
        assertEquals(emptyList<String>(), filterByBounds(rows, bounds) { it.date })
    }
}
