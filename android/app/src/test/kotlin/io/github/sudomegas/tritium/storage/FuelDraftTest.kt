package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FuelDraftTest {

    private fun fuelEntry(odometer: Int) = FuelEntry(id = "f-0001", odometerKm = odometer)
    private fun serviceEntry(odometer: Int) = ServiceEntry(id = "s-0001", odometerKm = odometer)

    @Test
    fun `highestOdometer is null with no entries in either file`() {
        assertNull(FuelDraft.highestOdometer(emptyList(), emptyList()))
    }

    @Test
    fun `highestOdometer is the highest fuel reading, regardless of entry order`() {
        val fuel = listOf(fuelEntry(19764), fuelEntry(19500), fuelEntry(19900))
        assertEquals(19900, FuelDraft.highestOdometer(fuel, emptyList()))
    }

    @Test
    fun `highestOdometer reads service entries too, not fuel alone`() {
        val fuel = listOf(fuelEntry(15000))
        val service = listOf(serviceEntry(19764))
        assertEquals(
            "a service entry can outrun the last fill-up; ignoring it states the wrong number confidently",
            19764,
            FuelDraft.highestOdometer(fuel, service),
        )
    }

    @Test
    fun `highestOdometer takes the higher file when fuel outranks service`() {
        val fuel = listOf(fuelEntry(19900))
        val service = listOf(serviceEntry(15100))
        assertEquals(19900, FuelDraft.highestOdometer(fuel, service))
    }

    @Test
    fun `goesBackwards is false with no previous reading at all`() {
        assertFalse(FuelDraft.goesBackwards(19764, null))
    }

    @Test
    fun `goesBackwards is true only when the new reading is lower`() {
        assertTrue(FuelDraft.goesBackwards(19000, 19764))
        assertFalse(FuelDraft.goesBackwards(19764, 19764))
        assertFalse(FuelDraft.goesBackwards(20000, 19764))
    }

    @Test
    fun `quickAddDefaults carries the vehicle's own fuel spec and defaults full_tank true`() {
        val defaults = FuelDraft.quickAddDefaults("Kurşunsuz 95", today = "2026-08-16")
        assertEquals("2026-08-16", defaults.date)
        assertEquals("Kurşunsuz 95", defaults.fuelType)
        assertTrue(
            "full_tank must default true, or the fast path never produces a consumption point",
            defaults.fullTank,
        )
    }
}
