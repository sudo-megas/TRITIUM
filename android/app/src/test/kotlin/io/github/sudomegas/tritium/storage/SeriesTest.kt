package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Test

class SeriesTest {

    private fun fuel(id: String, date: String, odometer: Int, litres: Long, price: Long) =
        FuelEntry(id = id, date = date, odometerKm = odometer, litres = litres, pricePerLitre = price, fullTank = true)

    private fun service(id: String, date: String, odometer: Int, amount: Long) =
        ServiceEntry(id = id, date = date, odometerKm = odometer, amount = amount)

    private fun cost(id: String, date: String, amount: Long, income: Boolean = false) =
        CostEntry(id = id, date = date, amount = amount, income = income)

    @Test
    fun `monthOf cuts the month out of the date string, not by calendar arithmetic`() {
        assertEquals("2026-08", monthOf("2026-08-16"))
    }

    @Test
    fun `odometerSeries merges both files and sorts by date`() {
        val fuel = listOf(fuel("f-0001", "2026-03-01", 1000, 30000, 45000))
        val service = listOf(service("s-0001", "2026-01-15", 500, 150000))
        val series = odometerSeries(fuel, service)
        assertEquals(listOf("2026-01-15" to 500, "2026-03-01" to 1000), series.map { it.date to it.value })
    }

    @Test
    fun `odometerSeries drops readings with no date or a zero odometer`() {
        val fuel = listOf(fuel("f-0001", "", 1000, 30000, 45000), fuel("f-0002", "2026-01-01", 0, 30000, 45000))
        assertEquals(emptyList<DatePoint>(), odometerSeries(fuel, emptyList()))
    }

    @Test
    fun `monthlyCostSeries sums fuel, cost and service amounts within the same month`() {
        val fuel = listOf(fuel("f-0001", "2026-08-01", 1000, 30000, 45000)) // 30000*45000 scaled -> fuelTotal
        val costs = listOf(cost("c-0001", "2026-08-15", 50000))
        val service = listOf(service("s-0001", "2026-08-20", 1200, 20000))
        val fuelTotal = Scaled.fuelTotal(30000, 45000)

        val series = monthlyCostSeries(fuel, costs, service)
        assertEquals(1, series.size)
        assertEquals("2026-08", series.single().month)
        assertEquals(fuelTotal + 50000 + 20000, series.single().value)
    }

    @Test
    fun `monthlyCostSeries subtracts income costs rather than adding them`() {
        val costs = listOf(cost("c-0001", "2026-08-01", 10000), cost("c-0002", "2026-08-02", 3000, income = true))
        val series = monthlyCostSeries(emptyList(), costs, emptyList())
        assertEquals(7000L, series.single().value)
    }

    @Test
    fun `monthlyCostSeries separates months and sorts them`() {
        val costs = listOf(cost("c-0001", "2026-09-01", 10000), cost("c-0002", "2026-01-01", 5000))
        val series = monthlyCostSeries(emptyList(), costs, emptyList())
        assertEquals(listOf("2026-01", "2026-09"), series.map { it.month })
    }

    @Test
    fun `monthlyCostSeries ignores entries with no date`() {
        val costs = listOf(cost("c-0001", "", 10000))
        assertEquals(emptyList<MonthPoint>(), monthlyCostSeries(emptyList(), costs, emptyList()))
    }
}
