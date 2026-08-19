package io.github.sudomegas.tritium.storage

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class CostFileTest {

    @get:Rule
    val tmp = TemporaryFolder()

    /** XTRITIUM §4.4's own sample entry, with the schema stamp §4.2 requires. */
    private val sample = """
        schema_version = 1

        [[entry]]
        id = "c-0001"
        date = 2026-04-11
        group = "tekrar-eden"
        category = "trafik-sigortasi"
        title = "Trafik Sigortası 26/27"
        amount = 11746.00
        income = false
        payment_method = "kredi-karti"
        bank = "Enpara"
        instalment = "Taksit 6"
        note = ""
    """.trimIndent() + "\n"

    private fun writeSample(text: String): File {
        val file = tmp.newFile()
        file.writeText(text)
        return file
    }

    @Test
    fun `the §4_4 sample entry parses to the expected fields`() {
        val entry = readCosts(writeSample(sample)).entries.single()

        assertEquals("c-0001", entry.id)
        assertEquals("2026-04-11", entry.date)
        assertEquals(CostGroup.TEKRAR_EDEN, entry.group)
        assertEquals("trafik-sigortasi", entry.category)
        assertEquals("Trafik Sigortası 26/27", entry.title)
        assertEquals(1174600L, entry.amount)
        assertEquals(false, entry.income)
        assertEquals("kredi-karti", entry.paymentMethod)
        assertEquals("Enpara", entry.bank)
        assertEquals("Taksit 6", entry.instalment)
        assertEquals("", entry.note)
    }

    @Test
    fun `serialising the parsed sample reproduces it exactly`() {
        val document = readCosts(writeSample(sample))
        assertEquals(sample, serialiseEntryDocument(document, CostSpec))
    }

    @Test
    fun `an unrecognised group reads as manual rather than throwing`() {
        val withBadGroup = sample.replace("group = \"tekrar-eden\"", "group = \"not-a-real-group\"")
        val entry = readCosts(writeSample(withBadGroup)).entries.single()
        assertEquals(CostGroup.MANUAL, entry.group)
    }

    @Test
    fun `income true survives the round trip`() {
        val incomeEntry = sample.replace("income = false", "income = true")
        val document = readCosts(writeSample(incomeEntry))
        assertEquals(true, document.entries.single().income)
        assertFalse("income = false" in serialiseEntryDocument(document, CostSpec))
    }
}
