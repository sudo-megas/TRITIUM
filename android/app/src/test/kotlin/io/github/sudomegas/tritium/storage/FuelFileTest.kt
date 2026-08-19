package io.github.sudomegas.tritium.storage

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class FuelFileTest {

    @get:Rule
    val tmp = TemporaryFolder()

    /** XTRITIUM §4.4's own sample entry, with the schema stamp §4.2 requires and §4.4 elides. */
    private val sample = """
        schema_version = 1

        [[entry]]
        id = "f-0001"
        date = 2026-08-16
        odometer_km = 19764
        litres = 29.990
        price_per_litre = 73.380
        full_tank = true
        fuel_type = "Kurşunsuz 95"
    """.trimIndent() + "\n"

    @Test
    fun `the §4_4 sample entry parses to the expected fields`() {
        val document = readFuel(writeSample(sample))
        val entry = document.entries.single()

        assertEquals("f-0001", entry.id)
        assertEquals("2026-08-16", entry.date)
        assertEquals(19764, entry.odometerKm)
        assertEquals(29990L, entry.litres)
        assertEquals(73380L, entry.pricePerLitre)
        assertTrue(entry.fullTank)
        assertEquals("Kurşunsuz 95", entry.fuelType)
    }

    @Test
    fun `serialising the parsed sample reproduces it exactly`() {
        val document = readFuel(writeSample(sample))
        assertEquals(sample, serialiseEntryDocument(document, FuelSpec))
    }

    @Test
    fun `total is dropped on read, never written back`() {
        val withTotal = sample.trimEnd().replace(
            "fuel_type = \"Kurşunsuz 95\"",
            "fuel_type = \"Kurşunsuz 95\"\ntotal = 2200.67",
        ) + "\n"
        val document = readFuel(writeSample(withTotal))

        val text = serialiseEntryDocument(document, FuelSpec)
        assertFalse("total" in text)
    }

    @Test
    fun `an unknown key inside an entry survives a read-modify-write`() {
        val withExtra = sample.trimEnd().replace(
            "fuel_type = \"Kurşunsuz 95\"",
            "fuel_type = \"Kurşunsuz 95\"\nstation = \"Shell\"",
        ) + "\n"
        val document = readFuel(writeSample(withExtra))

        val text = serialiseEntryDocument(document, FuelSpec)
        assertTrue(text.contains("station = \"Shell\""))
    }

    @Test
    fun `an id is allocated from the highest present when one entry has none`() {
        val text = """
            schema_version = 1

            [[entry]]
            id = "f-0003"
            odometer_km = 100

            [[entry]]
            odometer_km = 200
        """.trimIndent() + "\n"
        val document = readFuel(writeSample(text))

        assertEquals(listOf("f-0003", "f-0004"), document.entries.map { it.id })
    }

    @Test
    fun `a missing file reads as an empty document, not an error`() {
        val document = readFuel(File(tmp.root, "fuel.toml"))
        assertEquals(emptyList<FuelEntry>(), document.entries)
        assertEquals(RECORD_SCHEMA_VERSION, document.schemaVersion)
    }

    @Test
    fun `a corrupt fuel_toml is reported and the file is left untouched`() {
        val file = File(tmp.root, "fuel.toml")
        file.writeText("not valid toml [[[")

        assertThrows(CorruptRecordException::class.java) { readFuel(file) }
        assertEquals("not valid toml [[[", file.readText())
    }

    @Test
    fun `a failed write leaves the previous version of a record file intact`() {
        // AF1's AtomicWrite guarantee (AtomicWriteTest), pointed at a record
        // file instead of settings.toml — AF2.md acceptance criterion 9.
        val locked = File(tmp.root, "locked")
        locked.mkdirs()
        val target = File(locked, "fuel.toml")
        writeFuel(target, readFuel(writeSample(sample)))

        assertTrue(locked.setReadOnly())
        try {
            runCatching { writeFuel(target, emptyDocument()) }
        } finally {
            locked.setWritable(true)
        }

        assertEquals(sample, target.readText())
    }

    private fun writeSample(text: String): File {
        val file = tmp.newFile()
        file.writeText(text)
        return file
    }
}
