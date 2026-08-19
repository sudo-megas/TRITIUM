package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConsumptionTest {

    private fun full(id: String, odometer: Int, litres: Long, date: String = "2026-01-01") =
        FuelEntry(id = id, date = date, odometerKm = odometer, litres = litres, fullTank = true)

    private fun partial(id: String, odometer: Int, litres: Long, date: String = "2026-01-01") =
        FuelEntry(id = id, date = date, odometerKm = odometer, litres = litres, fullTank = false)

    @Test
    fun `the first-ever entry produces no point, full tank or not`() {
        assertEquals(emptyList<Any>(), Consumption.consumptionPoints(listOf(full("f-0001", 1000, 30000))))
        assertEquals(emptyList<Any>(), Consumption.consumptionPoints(listOf(partial("f-0001", 1000, 10000))))
    }

    @Test
    fun `a run of only partials produces no point`() {
        val entries = listOf(
            partial("f-0001", 1000, 10000),
            partial("f-0002", 1200, 12000),
            partial("f-0003", 1400, 11000),
        )
        assertEquals(emptyList<Any>(), Consumption.consumptionPoints(entries))
    }

    @Test
    fun `a partial before the first full tank is dropped, not carried forward`() {
        val entries = listOf(
            partial("f-0001", 1000, 10000),
            full("f-0002", 1300, 20000),
            full("f-0003", 1600, 25000),
        )
        val points = Consumption.consumptionPoints(entries)
        // Only one point (f-0003), and its litres must be 25000 alone — the
        // partial before f-0002 must not have leaked into this interval.
        assertEquals(1, points.size)
        assertEquals(25000L, points.single().litres)
    }

    @Test
    fun `a partial between two full tanks is summed into the LATER one`() {
        val entries = listOf(
            full("f-0001", 1000, 30000),
            partial("f-0002", 1100, 8000),
            partial("f-0003", 1150, 5000),
            full("f-0004", 1300, 20000),
        )
        val points = Consumption.consumptionPoints(entries)
        assertEquals(1, points.size)
        val point = points.single()
        assertEquals("f-0004", point.id)
        assertEquals(300, point.distanceKm)
        // 20000 + 8000 + 5000
        assertEquals(33000L, point.litres)
        // 33000 * 100 / 300 = 11000 (scaled x1000 -> 11.000 l/100km)
        assertEquals(11000L, point.l100km)
    }

    @Test
    fun `a trailing partial after the last full tank produces no point of its own`() {
        val entries = listOf(
            full("f-0001", 1000, 30000),
            full("f-0002", 1300, 20000),
            partial("f-0003", 1350, 4000),
        )
        val points = Consumption.consumptionPoints(entries)
        // Exactly one point, for f-0002 — the trailing partial never becomes
        // a point of its own, and nothing after it exists to absorb it yet.
        assertEquals(1, points.size)
        assertEquals("f-0002", points.single().id)
    }

    @Test
    fun `entries out of storage order are sorted by odometer before anything else`() {
        val entries = listOf(
            full("f-0002", 1300, 20000),
            full("f-0001", 1000, 30000),
        )
        val points = Consumption.consumptionPoints(entries)
        assertEquals(1, points.size)
        assertEquals("f-0002", points.single().id)
        assertEquals(300, points.single().distanceKm)
    }

    @Test
    fun `two entries at the same odometer produce no point, but the interval boundary still advances`() {
        val entries = listOf(
            full("f-0001", 1000, 30000),
            full("f-0002", 1300, 20000),
            // A duplicate reading right after f-0002 — same odometer.
            full("f-0003", 1300, 5000, date = "2026-01-02"),
            full("f-0004", 1600, 18000),
        )
        val points = Consumption.consumptionPoints(entries)
        // f-0002 produces a point against f-0001. f-0003 ties f-0002's
        // reading and produces none, but becomes the new interval boundary.
        // f-0004 is measured against f-0003, not f-0002.
        assertEquals(2, points.size)
        assertEquals(listOf("f-0002", "f-0004"), points.map { it.id })
        val last = points.last()
        assertEquals(300, last.distanceKm)
        assertEquals(18000L, last.litres)
    }

    @Test
    fun `mis-flagging full-tank shifts the figures on both sides of it`() {
        val correctlyFlagged = listOf(
            full("f-0001", 1000, 30000),
            partial("f-0002", 1100, 8000),
            full("f-0003", 1300, 20000),
        )
        val misFlagged = listOf(
            full("f-0001", 1000, 30000),
            // f-0002 marked full instead of partial.
            full("f-0002", 1100, 8000),
            full("f-0003", 1300, 20000),
        )

        val correctPoints = Consumption.consumptionPoints(correctlyFlagged)
        val misFlaggedPoints = Consumption.consumptionPoints(misFlagged)

        // Correct: one point at f-0003, litres = 20000 + 8000 = 28000 over 300km.
        assertEquals(1, correctPoints.size)
        assertEquals(28000L, correctPoints.single().litres)

        // Mis-flagged: TWO points now exist — f-0002 wrongly starts an
        // interval of its own — and neither matches the correct figures.
        assertEquals(2, misFlaggedPoints.size)
        assertTrue(
            "mis-flagging must change the figures on both sides, not just add a point",
            misFlaggedPoints.none { it.litres == 28000L && it.distanceKm == 300 },
        )
    }

    @Test
    fun `l100km is litres times 100 divided by distance, rounded once`() {
        val entries = listOf(
            full("f-0001", 0, 10000),
            full("f-0002", 500, 25000),
        )
        val point = Consumption.consumptionPoints(entries).single()
        // 25000 * 100 / 500 = 5000 -> 5.000 l/100km
        assertEquals(5000L, point.l100km)
    }

    @Test
    fun `consumptionAt cuts the internal 3-decimal figure to a display precision`() {
        // 5.000 l100km at 3 internal decimals -> 2 decimals -> 5.00 -> 500
        assertEquals(500L, Consumption.consumptionAt(5000L, 2))
        // -> 0 decimals -> 5
        assertEquals(5L, Consumption.consumptionAt(5000L, 0))
        // widening back to 3 decimals is a no-op
        assertEquals(5000L, Consumption.consumptionAt(5000L, 3))
    }

    @Test
    fun `consumptionById maps a point to every entry that has one, and only those`() {
        val entries = listOf(
            full("f-0001", 0, 10000),
            partial("f-0002", 200, 4000),
            full("f-0003", 500, 25000),
        )
        val byId = Consumption.consumptionById(entries)
        assertEquals(setOf("f-0003"), byId.keys)
    }

    @Test
    fun `feeding the whole entry list vs a filtered one gives different, and the whole one is correct`() {
        // The correctness rule AF4.md §1.2 states explicitly: the engine must
        // see the WHOLE list. Proved here by showing a filtered view produces
        // a wrong answer for the entry that survives the filter.
        val entries = listOf(
            full("f-0001", 1000, 30000),
            partial("f-0002", 1100, 8000),
            full("f-0003", 1300, 20000),
        )

        val whole = Consumption.consumptionById(entries)
        // A "filtered" view that drops the partial, as a range chip might if
        // applied to the engine's input instead of only to displayed rows.
        val filtered = Consumption.consumptionById(entries.filter { it.fullTank })

        assertEquals(28000L, whole.getValue("f-0003").litres)
        assertEquals(20000L, filtered.getValue("f-0003").litres) // wrong: missing the partial
        assertTrue(whole.getValue("f-0003").litres != filtered.getValue("f-0003").litres)
    }
}
