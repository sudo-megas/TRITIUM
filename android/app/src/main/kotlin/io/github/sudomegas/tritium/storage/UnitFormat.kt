package io.github.sudomegas.tritium.storage

import io.github.sudomegas.tritium.storage.Units.ConsumptionUnit
import io.github.sudomegas.tritium.storage.Units.DistanceUnit
import io.github.sudomegas.tritium.storage.Units.VolumeUnit

/**
 * Pairs [Units]'s pure conversions with [Format]'s number rendering and the
 * maker's own settings — the layer `src/renderer/state/units.ts`'s
 * `useUnits()` hook is on the desktop. [Units] itself stays free of
 * [Format]/settings so it is testable as pure arithmetic; this is where a
 * screen actually asks "what do I show, and what does what was typed mean."
 *
 * One instance per composition, built from the maker's current
 * [io.github.sudomegas.tritium.config.AppConfig] — never held longer, so a
 * unit switch is visible the moment it is saved, the same immediacy every
 * other setting in this app already has.
 */
class UnitFormat(
    private val distanceUnit: DistanceUnit,
    private val volumeUnit: VolumeUnit,
    private val consumptionUnit: ConsumptionUnit,
    private val decimalsConsumption: Int,
) {
    val distanceSymbol: String = Units.DISTANCE_SYMBOL.getValue(distanceUnit)
    val volumeSymbol: String = Units.VOLUME_SYMBOL.getValue(volumeUnit)
    val consumptionSymbol: String = Units.CONSUMPTION_SYMBOL.getValue(consumptionUnit)
    private val distanceDecimals: Int = Units.DISTANCE_DECIMALS.getValue(distanceUnit)

    /** `19.764` — the figure alone, for a caller whose label already carries the symbol. */
    fun distance(km: Int): String = Format.formatFigure(Units.showDistance(km, distanceUnit), distanceDecimals)

    /** `19.764 km` — the figure with its symbol, for a hint or a card. */
    fun distanceWith(km: Int): String = "${distance(km)} $distanceSymbol"

    /** A form field's editable text — no grouping, matching [Format.toInput]. */
    fun distanceInput(km: Int): String = Format.toInput(Units.showDistance(km, distanceUnit), distanceDecimals)

    /** What a form field holds, back into the whole kilometres the file stores. */
    fun parseDistance(text: String): Int? =
        Format.parseInput(text, distanceDecimals)?.let { Units.readDistance(it, distanceUnit) }

    /** [Scaled.PUMP_DECIMALS] plus [Units.VOLUME_DECIMALS] — gal needs one more to round-trip. */
    private val volumeDecimals: Int = Scaled.PUMP_DECIMALS + Units.VOLUME_DECIMALS.getValue(volumeUnit)

    /** [Scaled.TANK_DECIMALS] plus [Units.VOLUME_DECIMALS] — the same extra digit, tank's own base. */
    private val tankDecimals: Int = Scaled.TANK_DECIMALS + Units.VOLUME_DECIMALS.getValue(volumeUnit)

    fun volume(scaled: Long): String = Format.formatFigure(Units.showVolume(scaled, volumeUnit), volumeDecimals)

    fun volumeWith(scaled: Long): String = "${volume(scaled)} $volumeSymbol"

    fun volumeInput(scaled: Long): String =
        Format.toInput(Units.showVolume(scaled, volumeUnit), volumeDecimals)

    fun parseVolume(text: String): Long? =
        Format.parseInput(text, volumeDecimals)?.let { Units.readVolume(it, volumeUnit) }

    /**
     * Tank capacity — [Scaled.TANK_DECIMALS], plus [Units.VOLUME_DECIMALS]'s
     * extra digit for a coarser unit: the conversion ratio is scale-agnostic,
     * only the decimal count differs by field (`state/units.ts`'s own
     * `tank`/`parseTank`).
     */
    fun tank(scaled: Long): String = Format.formatFigure(Units.showVolume(scaled, volumeUnit), tankDecimals)

    fun tankInput(scaled: Long): String = Format.toInput(Units.showVolume(scaled, volumeUnit), tankDecimals)

    fun parseTank(text: String): Long? =
        Format.parseInput(text, tankDecimals)?.let { Units.readVolume(it, volumeUnit) }

    /**
     * `45,000 ₺` — a price per volume unit, with its currency symbol.
     * [Scaled.PUMP_DECIMALS], never [Scaled.MONEY_DECIMALS] — the AF7 bug
     * this guards against (`Format.kt`'s own history) is now guarded here
     * instead, and nowhere else reads a per-litre price for display.
     */
    fun pricePerVolumeText(scaled: Long, currency: String): String {
        val symbol = Format.currencySymbol(currency)
        val figure = Format.formatFigure(Units.showPricePerVolume(scaled, volumeUnit), Scaled.PUMP_DECIMALS)
        return if (symbol.isEmpty()) figure else "$figure $symbol"
    }

    fun pricePerVolumeInput(scaled: Long): String =
        Format.toInput(Units.showPricePerVolume(scaled, volumeUnit), Scaled.PUMP_DECIMALS)

    fun parsePricePerVolume(text: String): Long? =
        Format.parseInput(text, Scaled.PUMP_DECIMALS)?.let { Units.readPricePerVolume(it, volumeUnit) }

    /**
     * The maker's chosen precision, applied to a raw [Consumption]
     * ×1000 figure after unit conversion. Null when the figure has no image
     * in the chosen unit — [Units.showConsumption] — never a zero standing
     * in for an absence.
     */
    fun consumption(l100km: Long): String? {
        val converted = Units.showConsumption(l100km, consumptionUnit) ?: return null
        return Format.formatFigure(Consumption.consumptionAt(converted, decimalsConsumption), decimalsConsumption)
    }
}
