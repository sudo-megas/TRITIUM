package io.github.sudomegas.tritium.storage

/**
 * The small shared logic both fuel entry screens need — ported from the
 * desktop's `src/shared/fuel-draft.ts`. Kept separate from [Consumption],
 * which is about entries already on disk; this is about the one entry
 * being typed right now.
 */
object FuelDraft {

    /**
     * The highest odometer reading the vehicle knows, from any file
     * (AF6.md §1.2) — a service entry carries an odometer too, and a hint
     * built from fuel entries alone would state the wrong number
     * confidently once a service record outran the last fill-up.
     */
    fun highestOdometer(fuel: List<FuelEntry>, service: List<ServiceEntry>): Int? =
        (fuel.asSequence().map { it.odometerKm } + service.asSequence().map { it.odometerKm }).maxOrNull()

    /**
     * A backwards odometer WARNS and is then accepted (XTRITIUM §5.1, §3
     * principle 8) — typos in old entries must stay fixable, and the
     * maker's word is final. This function only answers the question;
     * nothing here blocks a save.
     */
    fun goesBackwards(newOdometer: Int, last: Int?): Boolean = last != null && newOdometer < last

    /**
     * Quick-add's three silent defaults (XTRITIUM §5.1, AF4.md §1.2
     * decision 1) — shown to the maker as a note before saving, never
     * asked. `full_tank = true` is not filler: a `false` default would
     * mean the fast path never produces a consumption point at all.
     */
    fun quickAddDefaults(vehicleFuelSpec: String, today: String = Format.todayIso()): QuickAddDefaults =
        QuickAddDefaults(date = today, fuelType = vehicleFuelSpec, fullTank = true)

    data class QuickAddDefaults(val date: String, val fuelType: String, val fullTank: Boolean)
}
