package io.github.sudomegas.tritium.storage

import io.github.sudomegas.tritium.storage.Units.ConsumptionUnit
import io.github.sudomegas.tritium.storage.Units.DistanceUnit
import io.github.sudomegas.tritium.storage.Units.VolumeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UnitsTest {

    // units.ts's own stated invariant: "Switching to miles and back leaves
    // every file byte-identical, and a test asserts exactly that." Every
    // kilometre reading from 0 to 300,000 — the same range units.ts itself
    // measured the 37.9%-failure-at-zero-decimals claim against — must
    // survive showDistance(MI) then readDistance(MI) unchanged. THE FILE
    // STAYS METRIC is not a comment if nothing checks it.
    @Test
    fun `switching to miles and back leaves the kilometre reading byte-identical`() {
        for (km in 0..300_000) {
            val shown = Units.showDistance(km, DistanceUnit.MI)
            val roundTripped = Units.readDistance(shown, DistanceUnit.MI)
            assertEquals("km=$km round-tripped through miles", km, roundTripped)
        }
    }

    @Test
    fun `kilometres pass through showDistance and readDistance unchanged`() {
        for (km in intArrayOf(0, 1, 19764, 300_000)) {
            assertEquals(km.toLong(), Units.showDistance(km, DistanceUnit.KM))
            assertEquals(km, Units.readDistance(km.toLong(), DistanceUnit.KM))
        }
    }

    @Test
    fun `distance decimals are zero for km and one for mi`() {
        assertEquals(0, Units.DISTANCE_DECIMALS.getValue(DistanceUnit.KM))
        assertEquals(1, Units.DISTANCE_DECIMALS.getValue(DistanceUnit.MI))
    }

    @Test
    fun `19764 km is 12280,8 miles — one decimal, not a whole mile`() {
        // 19764 × 10 / 1.609344 = 122807.9... -> shown as tenths-of-a-mile: 122808
        val shown = Units.showDistance(19764, DistanceUnit.MI)
        assertEquals(122808L, shown)
        assertEquals(19764, Units.readDistance(shown, DistanceUnit.MI))
    }

    @Test
    fun `volume converts to gallons at one extra decimal — exact, like distance`() {
        // 29990 (litres, PUMP_DECIMALS=3, i.e. 29.990 l) -> US gallons at
        // VOLUME_DECIMALS[GAL]=1 extra decimal, so ×10000: 29.990 / 3.785411784
        // = 7.92251... gal -> 79225 at four decimals. The extra digit is
        // exactly DISTANCE_DECIMALS's own move for miles over kilometres,
        // and it buys the same thing: the round trip is exact.
        val gallons = Units.showVolume(29990L, VolumeUnit.GAL)
        assertEquals(79225L, gallons) // round(29990 × 10 / 3.785411784)
        assertEquals(29990L, Units.readVolume(gallons, VolumeUnit.GAL))

        // The same ratio at TANK_DECIMALS (×10, i.e. 54.0 l) — scale-agnostic,
        // per state/units.ts's own tank()/parseTank() reuse of showVolume/readVolume.
        val tankGallons = Units.showVolume(540L, VolumeUnit.GAL)
        assertEquals(1427L, tankGallons) // round(540 × 10 / 3.785411784)
        assertEquals(540L, Units.readVolume(tankGallons, VolumeUnit.GAL))
    }

    @Test
    fun `volume decimals are zero for litres and one extra for gallons`() {
        assertEquals(0, Units.VOLUME_DECIMALS.getValue(VolumeUnit.L))
        assertEquals(1, Units.VOLUME_DECIMALS.getValue(VolumeUnit.GAL))
    }

    @Test
    fun `switching to gallons and back leaves the litre reading byte-identical`() {
        for (litres in 0..100_000 step 7) {
            val shown = Units.showVolume(litres.toLong(), VolumeUnit.GAL)
            val roundTripped = Units.readVolume(shown, VolumeUnit.GAL)
            assertEquals("litres=$litres round-tripped through gallons", litres.toLong(), roundTripped)
        }
    }

    @Test
    fun `litres pass through volume conversion unchanged`() {
        assertEquals(29990L, Units.showVolume(29990L, VolumeUnit.L))
        assertEquals(29990L, Units.readVolume(29990L, VolumeUnit.L))
    }

    @Test
    fun `price per volume multiplies to gallons, divides back to litres`() {
        // A gallon is more litres, so it costs more — units.ts's own warning
        // that this is "the one place it is easy to divide by mistake."
        val perGallon = Units.showPricePerVolume(73380L, VolumeUnit.GAL)
        assertTrue("a price per gallon must be higher than per litre", perGallon > 73380L)
        assertEquals(73380L, Units.readPricePerVolume(perGallon, VolumeUnit.GAL))
    }

    @Test
    fun `showConsumption is identity for l100km, whatever the value`() {
        assertEquals(7000L, Units.showConsumption(7000L, ConsumptionUnit.L100KM))
        assertEquals(0L, Units.showConsumption(0L, ConsumptionUnit.L100KM))
    }

    @Test
    fun `showConsumption returns null at zero for kml and mpg — inverse measures have no image`() {
        assertNull(Units.showConsumption(0L, ConsumptionUnit.KML))
        assertNull(Units.showConsumption(0L, ConsumptionUnit.MPG))
    }

    @Test
    fun `showConsumption converts a real l100km figure to km per litre and mpg`() {
        // 7 l/100km (×1000 = 7000) -> 100/7 = 14.2857 km/l -> ×1000 = 14286
        assertEquals(14286L, Units.showConsumption(7000L, ConsumptionUnit.KML))
        // MPG_CONSTANT (235.214583) / 7 = 33.602... -> ×1000 = 33602
        assertEquals(33602L, Units.showConsumption(7000L, ConsumptionUnit.MPG))
    }

    @Test
    fun `an unrecognised or missing token falls back to the metric default`() {
        assertEquals(DistanceUnit.KM, Units.distanceUnitOf(null))
        assertEquals(DistanceUnit.KM, Units.distanceUnitOf("furlongs"))
        assertEquals(VolumeUnit.L, Units.volumeUnitOf("firkin"))
        assertEquals(ConsumptionUnit.L100KM, Units.consumptionUnitOf("parsecs-per-fortnight"))
    }
}
