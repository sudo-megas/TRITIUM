package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SummaryTest {

    private fun full(id: String, odometer: Int, litres: Long, date: String = "2026-01-01", price: Long = 0) =
        FuelEntry(id = id, date = date, odometerKm = odometer, litres = litres, pricePerLitre = price, fullTank = true)

    private fun service(id: String, date: String, odometer: Int, amount: Long = 0, part: String = "") =
        ServiceEntry(id = id, date = date, odometerKm = odometer, amount = amount, part = part)

    private fun cost(id: String, date: String, amount: Long, income: Boolean = false, title: String = "") =
        CostEntry(id = id, date = date, amount = amount, income = income, title = title)

    @Test
    fun `averageConsumption is the ratio of the sums, never the mean of the ratios`() {
        // The two intervals summary ts states by name: 40 l over 400 km,
        // then 10 l over 500 km. Mean of the ratios is 6,00; ratio of the
        // sums is 5,56 — and only the second is what the car did.
        val entries = listOf(
            full("f-0001", 0, 0),
            full("f-0002", 400, 40000),
            full("f-0003", 900, 10000),
        )
        // 50000 * 100 / 900 = 5555.5..., +distance/2 rounding -> 5556
        assertEquals(5556L, Summary.averageConsumption(entries))
    }

    @Test
    fun `averageConsumption is null with no interval at all`() {
        assertNull(Summary.averageConsumption(emptyList()))
        assertNull(Summary.averageConsumption(listOf(full("f-0001", 0, 30000))))
    }

    @Test
    fun `lastConsumption is the most recent interval's own figure`() {
        val entries = listOf(full("f-0001", 0, 0), full("f-0002", 400, 40000), full("f-0003", 900, 10000))
        assertEquals(2000L, Summary.lastConsumption(entries))
    }

    @Test
    fun `lastConsumption is null with no interval yet`() {
        assertNull(Summary.lastConsumption(listOf(full("f-0001", 0, 30000))))
    }

    @Test
    fun `lastPrice is the most recent priced fill-up, ignoring unpriced ones`() {
        val entries = listOf(
            full("f-0001", 0, 10000, date = "2026-01-01", price = 45000),
            full("f-0002", 400, 10000, date = "2026-03-01", price = 0),
            full("f-0003", 800, 10000, date = "2026-02-01", price = 47000),
        )
        assertEquals(Summary.LastPrice(47000, "2026-02-01"), Summary.lastPrice(entries))
    }

    @Test
    fun `lastPrice is null with no priced fill-up at all`() {
        assertNull(Summary.lastPrice(listOf(full("f-0001", 0, 10000, price = 0))))
    }

    @Test
    fun `latestOdometer is the highest reading across both files`() {
        val fuel = listOf(full("f-0001", 1000, 30000))
        val service = listOf(service("s-0001", "2026-01-02", 15100))
        assertEquals(15100, Summary.latestOdometer(fuel, service))
    }

    @Test
    fun `lifetimeDistance is the span between the readings that exist, not the sum of intervals`() {
        val fuel = listOf(
            full("f-0001", 1000, 30000, date = "2026-01-01"),
            full("f-0002", 1500, 20000, date = "2026-02-01"),
        )
        // A trailing partial-equivalent gap is irrelevant here: span is
        // simply max - min of every reading, from both files.
        assertEquals(500, Summary.lifetimeDistance(fuel, emptyList()))
    }

    @Test
    fun `lifetimeDistance is zero with fewer than two readings`() {
        assertEquals(0, Summary.lifetimeDistance(listOf(full("f-0001", 1000, 30000)), emptyList()))
        assertEquals(0, Summary.lifetimeDistance(emptyList(), emptyList()))
    }

    @Test
    fun `lifetimeLitres sums every litre entered`() {
        val fuel = listOf(full("f-0001", 0, 30000), full("f-0002", 400, 40000))
        assertEquals(70000L, Summary.lifetimeLitres(fuel))
    }

    @Test
    fun `lifetimeSpend sums fuel, cost and service, income subtracting, purchase price excluded`() {
        val fuel = listOf(full("f-0001", 0, 30000, price = 45000))
        val costs = listOf(cost("c-0001", "2026-01-01", 10000), cost("c-0002", "2026-01-02", 3000, income = true))
        val service = listOf(service("s-0001", "2026-01-03", 500, amount = 5000))
        val fuelTotal = Scaled.fuelTotal(30000, 45000)

        assertEquals(fuelTotal + 10000 - 3000 + 5000, Summary.lifetimeSpend(fuel, costs, service))
    }

    @Test
    fun `recentEntries merges all three files, newest first, and stops at the limit`() {
        val fuel = listOf(full("f-0001", 0, 10000, date = "2026-01-01"))
        val costs = listOf(cost("c-0001", "2026-03-01", 5000, title = "Kapora"))
        val service = listOf(service("s-0001", "2026-02-01", 500, amount = 2000, part = "Lastik"))

        val entries = Summary.recentEntries(fuel, costs, service, limit = 2)
        assertEquals(2, entries.size)
        assertEquals(listOf("c-0001", "s-0001"), entries.map { it.id })
        assertEquals(Summary.EntryKind.COST, entries.first().kind)
        assertEquals("Kapora", entries.first().label)
    }

    @Test
    fun `recentEntries falls back to category when a cost has no title`() {
        val costs = listOf(cost("c-0001", "2026-01-01", 5000, title = "").copy(category = "kapora"))
        val entries = Summary.recentEntries(emptyList(), costs, emptyList(), limit = 8)
        assertEquals("kapora", entries.single().label)
    }

    @Test
    fun `recentEntries drops entries with no date`() {
        val costs = listOf(cost("c-0001", "", 5000))
        assertEquals(emptyList<Summary.RecentEntry>(), Summary.recentEntries(emptyList(), costs, emptyList(), limit = 8))
    }
}
