package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class VehicleFileTest {

    @get:Rule
    val tmp = TemporaryFolder()

    /** XTRITIUM §4.4's own sample, literally. */
    private val sample = """
        schema_version = 1
        name = "SPORTAGE 1.6 T-GDI"
        make = "Kia"
        model = "Sportage"
        year = 2025
        engine = "1.6 T-GDI"
        fuel_spec = "Kurşunsuz 95"
        plate = ""
        vin = ""
        tank_capacity_l = 54.0
        purchase_date = 2025-04-25
        purchase_price = 2160000.00
        registration_date = 2025-04-26
        inspection_due = 2027-04-01
    """.trimIndent() + "\n"

    @Test
    fun `the §4_4 sample parses to the expected fields`() {
        val document = parseVehicle(sample, tmp.newFile("vehicle.toml"))
        val vehicle = document.vehicle

        assertEquals("SPORTAGE 1.6 T-GDI", vehicle.name)
        assertEquals("Kia", vehicle.make)
        assertEquals("Sportage", vehicle.model)
        assertEquals(2025, vehicle.year)
        assertEquals("1.6 T-GDI", vehicle.engine)
        assertEquals("Kurşunsuz 95", vehicle.fuelSpec)
        assertEquals(540L, vehicle.tankCapacityL)
        assertEquals("2025-04-25", vehicle.purchaseDate)
        assertEquals(216000000L, vehicle.purchasePrice)
        assertEquals("2025-04-26", vehicle.registrationDate)
        assertEquals("2027-04-01", vehicle.inspectionDue)
        assertEquals(1, document.schemaVersion)
    }

    @Test
    fun `serialising the parsed sample reproduces it exactly, key for key`() {
        val document = parseVehicle(sample, tmp.newFile("vehicle.toml"))
        assertEquals(sample, serialiseVehicle(document))
    }

    @Test
    fun `writing then reading round-trips through the real file, atomically`() {
        val file = java.io.File(tmp.root, "vehicle.toml")
        val document = parseVehicle(sample, file)
        writeVehicle(file, document)

        assertEquals(sample, file.readText())
        val reread = readVehicle(file)
        assertEquals(document.vehicle, reread?.vehicle)
    }

    @Test
    fun `a missing file reads as null, not as an empty vehicle`() {
        val file = java.io.File(tmp.root, "vehicle.toml")
        assertEquals(null, readVehicle(file))
    }

    @Test
    fun `an older schema_version is upgraded in memory and written back current`() {
        val old = "schema_version = 2\nname = \"Old\"\n"
        val file = java.io.File(tmp.root, "vehicle.toml")
        val document = parseVehicle(old, file)
        assertEquals(2, document.schemaVersion)

        val text = serialiseVehicle(document)
        assertTrue(text.lines().first() == "schema_version = 1")
    }

    @Test
    fun `unknown keys survive a read-modify-write untouched`() {
        val withExtra = sample.trimEnd() + "\nfuture_field = \"kept\"\n"
        val file = java.io.File(tmp.root, "vehicle.toml")
        val document = parseVehicle(withExtra, file)

        val rewritten = serialiseVehicle(document)
        assertTrue(rewritten.contains("future_field = \"kept\""))
    }

    @Test
    fun `a corrupt vehicle_toml is reported and the file on disk is left untouched`() {
        val file = java.io.File(tmp.root, "vehicle.toml")
        file.writeText("this is not valid toml [[[")

        assertThrows(CorruptRecordException::class.java) { readVehicle(file) }
        assertEquals("this is not valid toml [[[", file.readText())
    }
}
