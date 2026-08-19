package io.github.sudomegas.tritium.storage

import kotlin.math.abs
import kotlin.math.round

/**
 * XTRITIUM §4.3 — Money and measures. A direct port of the desktop's
 * `src/shared/scaled.ts`; the doubled comment is deliberate, because the
 * arithmetic and the reason for it are the same on both platforms.
 *
 * TOML stores the human-readable figures exactly as entered (`73.380`,
 * `36.789`). Internally, every arithmetic runs on scaled integers, converted
 * once at load: money ×100, litres and prices ×1000, tank capacity ×10. Sums
 * are exact — a hundred fill-ups add up to the cent — and the files on disk
 * stay readable.
 *
 * Decimals are a property of the FIELD, not of the file: money at 2, pump
 * figures at 3, tank capacity at 1 (XTRITIUM §4.4 samples it as `54.0`).
 */
object Scaled {
    const val MONEY_DECIMALS = 2
    const val PUMP_DECIMALS = 3
    const val TANK_DECIMALS = 1

    fun scaleOf(decimals: Int): Long {
        var scale = 1L
        repeat(decimals) { scale *= 10 }
        return scale
    }

    /**
     * Convert a figure read from TOML into its scaled integer.
     *
     * Rounding is not optional — tomlkt hands back IEEE doubles just as
     * smol-toml does on the desktop, and scaling one lands just under the
     * integer often enough to matter: `19.99 * 100` is
     * `1998.9999999999998` in a `Double` on the JVM, exactly as it is in a
     * JS engine. Truncating any of those loses a cent or a millilitre, and a
     * cent an entry compounds. Applied to the magnitude so negatives behave
     * symmetrically.
     */
    fun toScaled(value: Double, decimals: Int): Long {
        if (!value.isFinite()) return 0
        val sign = if (value < 0) -1 else 1
        return sign * round(abs(value) * scaleOf(decimals)).toLong()
    }

    /** Convert a scaled integer back to its human figure. Lossy by design — display only. */
    fun fromScaled(scaled: Long, decimals: Int): Double = scaled.toDouble() / scaleOf(decimals)

    /**
     * Render a scaled integer as the fixed-decimal figure that belongs in the
     * file. This is what keeps `amount = 11746.00` from degrading to `11746`
     * on a round trip: the text is built from the integer, never from a
     * `Double`'s string form, so the XTRITIUM §4.4 samples are reproduced
     * exactly.
     */
    fun formatScaled(scaled: Long, decimals: Int): String {
        val sign = if (scaled < 0) "-" else ""
        val digits = abs(scaled).toString().padStart(decimals + 1, '0')
        if (decimals == 0) return "$sign$digits"
        val whole = digits.substring(0, digits.length - decimals)
        val fraction = digits.substring(digits.length - decimals)
        return "$sign$whole.$fraction"
    }

    /** Named helpers, so call sites read as prose rather than as arithmetic. */
    fun toMoney(value: Double): Long = toScaled(value, MONEY_DECIMALS)
    fun formatMoney(scaled: Long): String = formatScaled(scaled, MONEY_DECIMALS)

    fun toPump(value: Double): Long = toScaled(value, PUMP_DECIMALS)
    fun formatPump(scaled: Long): String = formatScaled(scaled, PUMP_DECIMALS)

    fun toTank(value: Double): Long = toScaled(value, TANK_DECIMALS)
    fun formatTank(scaled: Long): String = formatScaled(scaled, TANK_DECIMALS)

    /**
     * `litres × price/litre`, both already scaled ×1000 (`PUMP_DECIMALS`),
     * rescaled to money's ×100 — XTRITIUM §5.1's live total, AF4.md §2.1
     * decision 3. Two scaled `Long`s multiply to a ×1,000,000 figure;
     * dividing by 10,000 brings it to ×100, with the rounding folded into
     * the division so a `Double` is never formed at all — the same
     * discipline `toScaled` uses rounding for, applied where two already-
     * scaled figures meet instead of where one float figure gets scaled.
     *
     * Checked against §5.1's own worked example:
     * `29.990 l × 73.380 ₺/l → 2.200,67 ₺` is
     * `29990 × 73380 = 2,200,666,200`, `(2,200,666,200 + 5000) / 10000 = 220067`,
     * `formatMoney(220067) = "2200.67"`.
     */
    fun fuelTotal(litresScaled: Long, pricePerLitreScaled: Long): Long {
        val rescale = scaleOf(PUMP_DECIMALS * 2 - MONEY_DECIMALS)
        return (litresScaled * pricePerLitreScaled + rescale / 2) / rescale
    }
}
