package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FormatTest {

    @Test
    fun `currencySymbol recognises the four presets, case-insensitively`() {
        assertEquals("₺", Format.currencySymbol("TRY"))
        assertEquals("$", Format.currencySymbol("usd"))
        assertEquals("€", Format.currencySymbol("Eur"))
        assertEquals("£", Format.currencySymbol("GBP"))
    }

    @Test
    fun `an unrecognised currency code prints as itself`() {
        assertEquals("XAG", Format.currencySymbol("XAG"))
    }

    @Test
    fun `formatFigure groups the whole part in threes, XTRITIUM §4_4 style`() {
        assertEquals("1.234,56", Format.formatFigure(123456L, 2))
        assertEquals("11.746,00", Format.formatFigure(1174600L, 2))
        assertEquals("54,0", Format.formatFigure(540L, 1))
    }

    @Test
    fun `formatFigure handles negatives and small values`() {
        assertEquals("-11.746,00", Format.formatFigure(-1174600L, 2))
        assertEquals("0,00", Format.formatFigure(0L, 2))
    }

    @Test
    fun `formatMoneyText appends the symbol, or stands alone with no currency`() {
        assertEquals("11.746,00 ₺", Format.formatMoneyText(1174600L, "TRY"))
        assertEquals("11.746,00", Format.formatMoneyText(1174600L, ""))
    }

    @Test
    fun `toInput never groups`() {
        assertEquals("54,0", Format.toInput(540L, Scaled.TANK_DECIMALS))
        assertEquals("11746,00", Format.toInput(1174600L, Scaled.MONEY_DECIMALS))
    }

    @Test
    fun `parseInput reads a comma or a dot as the decimal separator`() {
        assertEquals(1174600L, Format.parseInput("11746,00", 2))
        assertEquals(1174600L, Format.parseInput("11746.00", 2))
    }

    @Test
    fun `parseInput reads grouped figures with both separators`() {
        assertEquals(123456L, Format.parseInput("1.234,56", 2))
        assertEquals(123456L, Format.parseInput("1,234.56", 2))
    }

    @Test
    fun `parseInput does not mistake three pump decimals for grouping`() {
        // §4.3: pump figures carry exactly three decimals, so 8.165 must read
        // as eight point one six five, never as eight thousand one sixty-five.
        assertEquals(8165L, Format.parseInput("8.165", 3))
    }

    @Test
    fun `parseInput repeated grouping reads as thousands`() {
        assertEquals(123456700L, Format.parseInput("1.234.567", 2))
    }

    @Test
    fun `parseInput rejects nonsense`() {
        assertNull(Format.parseInput("", 2))
        assertNull(Format.parseInput("abc", 2))
        assertNull(Format.parseInput("1,2,3", 2))
    }

    @Test
    fun `parseInput is the inverse of toInput for a round trip`() {
        val original = 8165L
        val text = Format.toInput(original, Scaled.PUMP_DECIMALS)
        assertEquals(original, Format.parseInput(text, Scaled.PUMP_DECIMALS))
    }

    @Test
    fun `formatDate and parseDate round-trip the family convention`() {
        assertEquals("16.08.2026", Format.formatDate("2026-08-16"))
        assertEquals("2026-08-16", Format.parseDate("16.08.2026"))
    }

    @Test
    fun `formatDate on an unparseable value shows nothing`() {
        assertEquals("", Format.formatDate(""))
        assertEquals("", Format.formatDate("not-a-date"))
    }

    @Test
    fun `parseDate refuses a day the real calendar does not have`() {
        // 2026 is not a leap year — no 29 February.
        assertNull(Format.parseDate("29.02.2026"))
        assertNull(Format.parseDate("31.04.2026"))
    }

    @Test
    fun `parseDate refuses the wrong shape entirely`() {
        assertNull(Format.parseDate("2026-08-16"))
        assertNull(Format.parseDate(""))
    }

    @Test
    fun `todayIso reads the local calendar date, not a UTC one`() {
        val now = java.time.LocalDateTime.of(2026, 8, 16, 1, 0, 0)
        assertEquals("2026-08-16", Format.todayIso(now))
    }
}
