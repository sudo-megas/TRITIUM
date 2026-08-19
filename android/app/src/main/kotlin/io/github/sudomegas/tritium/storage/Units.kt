package io.github.sudomegas.tritium.storage

import kotlin.math.round

/**
 * The unit boundary (XTRITIUM §4.4 [units], §8, F11) — ported field-for-field
 * from the desktop's `src/shared/units.ts`, paired with a caller's settings the
 * way `src/renderer/state/units.ts`'s `useUnits()` hook pairs them there.
 *
 * THE FILE STAYS METRIC, WHATEVER THE SETTINGS SAY. `fuel.toml` holds
 * `odometer_km` and `litres`; `vehicle.toml` holds `tank_capacity_l`. A unit is
 * a boundary: converted on the way to the screen and on the way in from a
 * form, and never in between — [Consumption]'s engine is fed raw kilometres
 * and litres always, the same AF4/AF7 rule that keeps the engine fed the
 * unfiltered entry list, extended to a new axis rather than reopened.
 *
 * Everything here is scaled integers in and scaled integers out (§4.3), at
 * whatever decimal count the caller already had — a conversion ratio is
 * scale-agnostic, so the same [showVolume] serves litres at
 * [Scaled.PUMP_DECIMALS] and a tank capacity at [Scaled.TANK_DECIMALS] alike.
 */
object Units {

    enum class DistanceUnit(val token: String) { KM("km"), MI("mi") }
    enum class VolumeUnit(val token: String) { L("l"), GAL("gal") }
    enum class ConsumptionUnit(val token: String) { L100KM("l100km"), KML("kml"), MPG("mpg") }

    fun distanceUnitOf(token: String?): DistanceUnit =
        DistanceUnit.entries.firstOrNull { it.token == token } ?: DistanceUnit.KM

    fun volumeUnitOf(token: String?): VolumeUnit =
        VolumeUnit.entries.firstOrNull { it.token == token } ?: VolumeUnit.L

    fun consumptionUnitOf(token: String?): ConsumptionUnit =
        ConsumptionUnit.entries.firstOrNull { it.token == token } ?: ConsumptionUnit.L100KM

    /** 1 mile, in kilometres. Exact by international agreement since 1959. */
    const val KM_PER_MILE = 1.609344

    /**
     * 1 US gallon, in litres. Exact. TRITIUM uses the US gallon, not the
     * imperial one (4.54609 l) — a twenty-per-cent difference, which is the
     * difference between a good tank and a bad one, not a rounding error.
     * §4.4 offers one `gal`; a second setting for the imperial gallon would
     * answer a question the constitution did not ask.
     */
    const val LITRES_PER_US_GALLON = 3.785411784

    /** 100 km ÷ 1.609344 = 62.1371 miles; 1 l = 0.264172 US gal — reduces to this. */
    val MPG_CONSTANT = (100 / KM_PER_MILE) * LITRES_PER_US_GALLON

    /**
     * How many decimals a distance is SHOWN with. Kilometres get none — the
     * file stores whole kilometres. Miles get one, and it is not cosmetic: a
     * mile is 1.609 km, so a whole mile is coarser than the whole kilometre
     * underneath it. Measured over 0–300,000 km, whole miles fail to
     * round-trip for 37.9% of values; one decimal makes the display finer
     * than the storage, and the round trip becomes exact.
     */
    val DISTANCE_DECIMALS: Map<DistanceUnit, Int> = mapOf(DistanceUnit.KM to 0, DistanceUnit.MI to 1)

    /**
     * Unit symbols are NOT string resources — `km`, `mi`, `l`, `gal`,
     * `l/100km`, `km/l`, `mpg` are the same characters in both languages,
     * notation like `₺` and like the digits themselves.
     */
    val DISTANCE_SYMBOL: Map<DistanceUnit, String> = mapOf(DistanceUnit.KM to "km", DistanceUnit.MI to "mi")
    val VOLUME_SYMBOL: Map<VolumeUnit, String> = mapOf(VolumeUnit.L to "l", VolumeUnit.GAL to "gal")
    val CONSUMPTION_SYMBOL: Map<ConsumptionUnit, String> = mapOf(
        ConsumptionUnit.L100KM to "l/100km",
        ConsumptionUnit.KML to "km/l",
        ConsumptionUnit.MPG to "mpg",
    )

    /** Kilometres into what the screen shows, scaled by [DISTANCE_DECIMALS]. */
    fun showDistance(km: Int, unit: DistanceUnit): Long =
        if (unit == DistanceUnit.KM) km.toLong() else round(km * 10.0 / KM_PER_MILE).toLong()

    /** What the screen shows, back into the whole kilometres the file holds. */
    fun readDistance(value: Long, unit: DistanceUnit): Int =
        if (unit == DistanceUnit.KM) value.toInt() else round(value * KM_PER_MILE / 10.0).toInt()

    fun showVolume(scaled: Long, unit: VolumeUnit): Long =
        if (unit == VolumeUnit.L) scaled else round(scaled / LITRES_PER_US_GALLON).toLong()

    fun readVolume(value: Long, unit: VolumeUnit): Long =
        if (unit == VolumeUnit.L) value else round(value * LITRES_PER_US_GALLON).toLong()

    /**
     * A price per litre becomes a price per gallon by MULTIPLYING — a gallon
     * is more litres, so it costs more. The inverse of [showVolume], and the
     * one place it is easy to divide by mistake.
     */
    fun showPricePerVolume(perLitre: Long, unit: VolumeUnit): Long =
        if (unit == VolumeUnit.L) perLitre else round(perLitre * LITRES_PER_US_GALLON).toLong()

    fun readPricePerVolume(value: Long, unit: VolumeUnit): Long =
        if (unit == VolumeUnit.L) value else round(value / LITRES_PER_US_GALLON).toLong()

    /**
     * l/100km ×1000 into the chosen unit, still ×1000 — [Consumption]'s own
     * scale ([Consumption.CONSUMPTION_DECIMALS]), so [Consumption.consumptionAt]
     * cuts the converted figure to display precision exactly as it already
     * cuts the raw one. Never recomputed from litres and distance — that
     * would give a second arithmetic path to the one figure AF4 built a
     * whole milestone around.
     *
     * Both alternate units are INVERSE measures — more litres per hundred
     * kilometres is worse, more kilometres per litre is better — so zero has
     * no image and returns null rather than infinity.
     */
    fun showConsumption(l100km: Long, unit: ConsumptionUnit): Long? {
        if (unit == ConsumptionUnit.L100KM) return l100km
        if (l100km <= 0) return null
        return if (unit == ConsumptionUnit.KML) {
            round(100_000_000.0 / l100km).toLong()
        } else {
            round(MPG_CONSTANT * 1_000_000.0 / l100km).toLong()
        }
    }
}
