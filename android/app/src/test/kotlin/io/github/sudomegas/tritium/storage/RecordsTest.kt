package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Test

class RecordsTest {

    @Test
    fun `formatId pads to four digits with the kind's prefix`() {
        assertEquals("f-0001", formatId(RecordKind.FUEL, 1))
        assertEquals("c-0042", formatId(RecordKind.COST, 42))
        assertEquals("s-1234", formatId(RecordKind.SERVICE, 1234))
    }

    @Test
    fun `idSequence reads the numeric part, or 0 if it does not parse`() {
        assertEquals(1, idSequence("f-0001"))
        assertEquals(42, idSequence("c-0042"))
        assertEquals(0, idSequence("not-an-id"))
        assertEquals(0, idSequence(""))
    }

    @Test
    fun `nextId allocates from the highest id present, not from a count`() {
        val existing = listOf(FuelEntry(id = "f-0001"), FuelEntry(id = "f-0003"))
        // A gap at f-0002 (deleted by hand) must not be reused.
        assertEquals("f-0004", nextId(RecordKind.FUEL, existing))
    }

    @Test
    fun `nextId on an empty list starts at 1`() {
        assertEquals("f-0001", nextId(RecordKind.FUEL, emptyList()))
    }

    @Test
    fun `deleting the highest entry frees its number — issues_md I-07's settled answer`() {
        val afterDeletingHighest = listOf(FuelEntry(id = "f-0001"))
        assertEquals("f-0002", nextId(RecordKind.FUEL, afterDeletingHighest))
    }

    @Test
    fun `pickableCategories drops Periyodik Bakim from tekrar-eden`() {
        val categories = pickableCategories(CostGroup.TEKRAR_EDEN)
        assertEquals(false, categories.contains(SERVICE_CATEGORY))
        assertEquals(true, categories.contains("trafik-sigortasi"))
    }

    @Test
    fun `only manual takes a typed category`() {
        assertEquals(true, takesTypedCategory(CostGroup.MANUAL))
        assertEquals(false, takesTypedCategory(CostGroup.ILK_ALIS))
        assertEquals(false, takesTypedCategory(CostGroup.TEKRAR_EDEN))
    }

    @Test
    fun `CostGroup fromToken round-trips the XTRITIUM §4_4 tokens`() {
        assertEquals(CostGroup.ILK_ALIS, CostGroup.fromToken("ilk-alis"))
        assertEquals(CostGroup.TEKRAR_EDEN, CostGroup.fromToken("tekrar-eden"))
        assertEquals(CostGroup.MANUAL, CostGroup.fromToken("manual"))
        assertEquals(null, CostGroup.fromToken("not-a-group"))
    }
}
