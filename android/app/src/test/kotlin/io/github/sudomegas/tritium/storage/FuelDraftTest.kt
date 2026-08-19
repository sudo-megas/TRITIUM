package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FuelDraftTest {

    private fun entry(odometer: Int) = FuelEntry(id = "f-0001", odometerKm = odometer)

    @Test
    fun `lastOdometer is null with no entries yet`() {
        assertNull(FuelDraft.lastOdometer(emptyList()))
    }

    @Test
    fun `lastOdometer is the highest reading, regardless of entry order`() {
        val entries = listOf(entry(19764), entry(19500), entry(19900))
        assertEquals(19900, FuelDraft.lastOdometer(entries))
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
