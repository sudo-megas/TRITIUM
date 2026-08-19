package io.github.sudomegas.tritium.storage

import java.time.LocalDate
import java.time.LocalDateTime

/**
 * XTRITIUM §8 — how figures and dates are shown, in both languages:
 * `1.234,56 ₺` and `GG.AA.YYYY`. Ported from the desktop's
 * `src/shared/format.ts`, function for function.
 *
 * This is a family convention, not a locale. It is written by hand rather
 * than reached for from a locale-aware API, because that renders the same
 * number differently depending on ambient state — exactly the dependency
 * XTRITIUM §3 principle 6 forbids.
 *
 * Reads as well as writes: a figure typed into a form, stored, and shown
 * again must be the same figure, so [parseInput] is the inverse of
 * [formatFigure] and both go through [Scaled]'s integers.
 */
object Format {

    private const val GROUP = '.'
    private const val DECIMAL = ','

    /**
     * Currency symbols for the codes worth spelling out. The currency is
     * asked once as free text (§8), so an unrecognised code prints as
     * itself rather than being refused — TRITIUM never claims to know
     * every currency, and it never converts between any of them.
     */
    private val SYMBOLS: Map<String, String> = mapOf(
        "TRY" to "₺", "USD" to "$", "EUR" to "€", "GBP" to "£",
    )

    fun currencySymbol(code: String): String {
        val trimmed = code.trim()
        return SYMBOLS[trimmed.uppercase()] ?: trimmed
    }

    /** Group the integer part in threes: `1234567` -> `1.234.567`. */
    private fun group(digits: String): String {
        if (digits.isEmpty()) return "0"
        var out = ""
        var index = digits.length
        while (index > 0) {
            val start = (index - 3).coerceAtLeast(0)
            out = digits.substring(start, index) + (if (out.isEmpty()) "" else "$GROUP$out")
            index -= 3
        }
        return out.ifEmpty { "0" }
    }

    /**
     * A scaled integer as the maker reads it: `1.234,56`. Built from
     * [Scaled.formatScaled]'s fixed-decimal text, so it inherits that
     * function's one guarantee — the digits come from the integer, never
     * from a `Double`'s string form, and a trailing zero is a real
     * trailing zero.
     */
    fun formatFigure(scaled: Long, decimals: Int): String {
        val fixed = Scaled.formatScaled(scaled, decimals)
        val negative = fixed.startsWith("-")
        val body = if (negative) fixed.substring(1) else fixed
        val dot = body.indexOf('.')
        val whole = if (dot >= 0) body.substring(0, dot) else body
        val fraction = if (dot >= 0) body.substring(dot + 1) else null
        val grouped = group(whole)
        val text = if (fraction == null) grouped else "$grouped$DECIMAL$fraction"
        return if (negative) "-$text" else text
    }

    /**
     * A money figure with its symbol: `1.234,56 ₺`. With no currency yet —
     * the question of §8 asked but not answered — the figure stands alone
     * rather than trailing an empty space where a symbol would go.
     */
    fun formatMoneyText(scaled: Long, currency: String): String {
        val symbol = currencySymbol(currency)
        val figure = formatFigure(scaled, Scaled.MONEY_DECIMALS)
        return if (symbol.isEmpty()) figure else "$figure $symbol"
    }

    /**
     * A price-per-litre figure with its symbol: `45,000 ₺`. `price_per_litre`
     * is scaled at [Scaled.PUMP_DECIMALS] (3), not [Scaled.MONEY_DECIMALS]
     * (2) — [formatMoneyText] would read its integer at the wrong decimal
     * place and print ten times the real price. Matches the desktop's own
     * `ChartsPane.tsx` (`formatFigure(value, PUMP_DECIMALS)` for gas price)
     * and `FuelPane.tsx` (`units.pricePerVolume`), neither of which ever
     * routes a per-litre price through the money formatter.
     */
    fun formatPricePerLitreText(scaled: Long, currency: String): String {
        val symbol = currencySymbol(currency)
        val figure = formatFigure(scaled, Scaled.PUMP_DECIMALS)
        return if (symbol.isEmpty()) figure else "$figure $symbol"
    }

    /** A scaled integer as an editable field shows it: `54,0` — no grouping. */
    fun toInput(scaled: Long, decimals: Int): String =
        Scaled.formatScaled(scaled, decimals).replace('.', DECIMAL)

    /**
     * Text typed into a form, back to a scaled integer. Returns null for
     * anything that is not a figure, so a caller can tell "nothing entered"
     * from "zero".
     *
     * Both separators are accepted, because both get typed and both get
     * pasted:
     * - both present -> the LAST one is the decimal, the other groups
     *   (`1.234,56` and `1,234.56` both read as 1234.56)
     * - one, appearing once -> the decimal separator (`54,0`, `54.0`)
     * - one, appearing repeatedly -> grouping (`1.234.567`)
     *
     * `1.234` therefore reads as one-point-two-three-four, not as a
     * thousand — pump figures carry exactly three decimals (§4.3), so
     * `8.165` is a real price per litre and guessing would corrupt it.
     */
    fun parseInput(text: String, decimals: Int): Long? {
        val trimmed = text.trim().replace(Regex("\\s"), "")
        if (trimmed.isEmpty()) return null
        if (!Regex("^-?[\\d.,]+$").matches(trimmed)) return null

        val negative = trimmed.startsWith("-")
        val body = if (negative) trimmed.substring(1) else trimmed
        if (body.isEmpty()) return null

        val lastComma = body.lastIndexOf(',')
        val lastDot = body.lastIndexOf('.')

        val decimalAt = when {
            lastComma >= 0 && lastDot >= 0 -> maxOf(lastComma, lastDot)
            lastComma >= 0 -> if (body.indexOf(',') == lastComma) lastComma else -1
            lastDot >= 0 -> if (body.indexOf('.') == lastDot) lastDot else -1
            else -> -1
        }

        // Separators left in the whole part are grouping, and grouping is
        // threes. `1,2,3` is not a figure in any convention, so it is
        // refused rather than quietly read as 123.
        val wholeRaw = if (decimalAt >= 0) body.substring(0, decimalAt) else body
        if (Regex("[.,]").containsMatchIn(wholeRaw) &&
            !Regex("^\\d{1,3}([.,]\\d{3})*$").matches(wholeRaw)
        ) {
            return null
        }

        val whole = wholeRaw.replace(Regex("[.,]"), "")
        val fraction = if (decimalAt >= 0) body.substring(decimalAt + 1) else ""
        if ('.' in fraction || ',' in fraction) return null
        if (whole.isEmpty() && fraction.isEmpty()) return null
        if (!Regex("^\\d*$").matches(whole) || !Regex("^\\d*$").matches(fraction)) return null

        val value = "${whole.ifEmpty { "0" }}.${fraction.ifEmpty { "0" }}".toDoubleOrNull()
            ?: return null

        return Scaled.toScaled(if (negative) -value else value, decimals)
    }

    /** `2026-08-16` -> `16.08.2026`. An unparseable date shows as nothing. */
    fun formatDate(iso: String): String {
        if (!isDateString(iso)) return ""
        val (year, month, day) = iso.split("-")
        return "$day.$month.$year"
    }

    /**
     * `16.08.2026` -> `2026-08-16`, or null. The day is checked against the
     * real calendar via [LocalDate], so `31.02.2026` is refused rather than
     * rolling into March.
     */
    fun parseDate(text: String): String? {
        val match = Regex("^(\\d{2})\\.(\\d{2})\\.(\\d{4})$").find(text.trim()) ?: return null
        val (dayText, monthText, yearText) = match.destructured

        val date = runCatching {
            LocalDate.of(yearText.toInt(), monthText.toInt(), dayText.toInt())
        }.getOrNull() ?: return null

        return date.toString()
    }

    /**
     * Today, from the local calendar — deliberately not a UTC-based
     * timestamp, the same reasoning the desktop's `todayIso` states: an
     * entry made late at night in a zone ahead of UTC would otherwise file
     * on the wrong day. Nothing here reads a locale either (§3 principle
     * 6) — the calendar is not a locale.
     */
    fun todayIso(now: LocalDateTime = LocalDateTime.now()): String = now.toLocalDate().toString()
}
