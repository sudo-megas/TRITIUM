package io.github.sudomegas.tritium.storage

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ServiceFileTest {

    @get:Rule
    val tmp = TemporaryFolder()

    /** XTRITIUM §4.4's own sample entry, with the schema stamp §4.2 requires. */
    private val sample = """
        schema_version = 1

        [[entry]]
        id = "s-0001"
        date = 2025-05-14
        part = "Michelin Primacy 4 S1 235/50R19 103V XL"
        odometer_km = 370
        amount = 8664.00
        vendor = "https://www.lastikcim.com.tr/…"
    """.trimIndent() + "\n"

    private fun writeSample(text: String): File {
        val file = tmp.newFile()
        file.writeText(text)
        return file
    }

    @Test
    fun `the §4_4 sample entry parses to the expected fields`() {
        val entry = readService(writeSample(sample)).entries.single()

        assertEquals("s-0001", entry.id)
        assertEquals("2025-05-14", entry.date)
        assertEquals("Michelin Primacy 4 S1 235/50R19 103V XL", entry.part)
        assertEquals(370, entry.odometerKm)
        assertEquals(866400L, entry.amount)
        assertEquals("https://www.lastikcim.com.tr/…", entry.vendor)
    }

    @Test
    fun `serialising the parsed sample reproduces it exactly`() {
        val document = readService(writeSample(sample))
        assertEquals(sample, serialiseEntryDocument(document, ServiceSpec))
    }

    @Test
    fun `the vendor address round-trips verbatim as plain text, never parsed as a link`() {
        // XTRITIUM §5: every address is selectable text. The storage layer's
        // job is to carry the string exactly; the UI (AF6) is what must
        // never render it as a clickable link.
        val document = readService(writeSample(sample))
        assertEquals(sample, serialiseEntryDocument(document, ServiceSpec))
        assertEquals("https://www.lastikcim.com.tr/…", document.entries.single().vendor)
    }
}
