package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Test

class ScaledTest {

    @Test
    fun `money round-trips exactly`() {
        assertEquals(1174600L, Scaled.toMoney(11746.00))
        assertEquals("11746.00", Scaled.formatMoney(1174600L))
    }

    @Test
    fun `fuelTotal matches XTRITIUM §5_1's own worked example exactly`() {
        // 29.990 l × 73.380 ₺/l → 2.200,67 ₺
        val litres = Scaled.toPump(29.990)
        val price = Scaled.toPump(73.380)
        val total = Scaled.fuelTotal(litres, price)
        assertEquals(220067L, total)
        assertEquals("2200.67", Scaled.formatMoney(total))
    }

    @Test
    fun `fuelTotal rounds rather than truncates`() {
        // 1.000 l x 0.005 -> 0.005, which rounds to 0.01 rather than 0.00.
        val litres = Scaled.toPump(1.000)
        val price = Scaled.toPump(0.005)
        assertEquals(1L, Scaled.fuelTotal(litres, price))
    }

    @Test
    fun `pump figures keep three decimals`() {
        assertEquals(29990L, Scaled.toPump(29.990))
        assertEquals("29.990", Scaled.formatPump(29990L))
        assertEquals(73380L, Scaled.toPump(73.380))
        assertEquals("73.380", Scaled.formatPump(73380L))
    }

    @Test
    fun `tank capacity keeps one decimal, matching the §4_4 sample`() {
        assertEquals(540L, Scaled.toTank(54.0))
        assertEquals("54.0", Scaled.formatTank(540L))
    }

    @Test
    fun `a trailing zero survives the round trip rather than degrading`() {
        // The exact defect XTRITIUM §4.3 exists to prevent: a naive
        // Double-to-string conversion of 11746.0 would print "11746.0" or
        // "11746", either of which drops the money shape §4.4 fixes.
        assertEquals("11746.00", Scaled.formatMoney(Scaled.toMoney(11746.00)))
    }

    @Test
    fun `IEEE double drift does not cost a cent`() {
        // 19.99 * 100 is 1998.9999999999998 in a Double on the JVM, exactly
        // as it is in a JS engine. Truncating loses a cent; rounding does not.
        assertEquals(1999L, Scaled.toMoney(19.99))
        assertEquals(435L, Scaled.toMoney(4.35))
        assertEquals(8165L, Scaled.toPump(8.165))
    }

    @Test
    fun `negative figures scale symmetrically`() {
        assertEquals(-1174600L, Scaled.toMoney(-11746.00))
        assertEquals("-11746.00", Scaled.formatMoney(-1174600L))
    }

    @Test
    fun `summing a hundred entries in scaled integers is exact, unlike summing the raw doubles`() {
        // Each entry is scaled and rounded individually — the same order the
        // storage layer actually performs, entry by entry as it reads a
        // file — then summed as integers, which is always exact. Compared
        // against a hand-computed expectation rather than against a
        // differently-ordered float calculation, so the test cannot fail
        // over its own rounding rather than the code's.
        val litres = List(100) { i -> 10.0 + i * 0.01 } // 10.00, 10.01, ..., 19.99
        val scaledSum = litres.sumOf { Scaled.toPump(it) }

        // litres[i] = 10 + i/100, scaled x1000 = 10000 + i*10, for i in 0..99.
        // Sum = 100*10000 + 10*(0+1+...+99) = 1,000,000 + 10*4950 = 1,049,500.
        assertEquals(1_049_500L, scaledSum)

        // The float sum drifts; the scaled-integer sum, converted back, does not
        // need to match it exactly — that IS the property being demonstrated.
        val floatSum = litres.sum()
        assertEquals(1049.5, floatSum, 0.01) // sanity: same ballpark, not bit-exact
    }
}
