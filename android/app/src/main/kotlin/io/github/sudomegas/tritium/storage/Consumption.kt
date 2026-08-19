package io.github.sudomegas.tritium.storage

/**
 * XTRITIUM §5.2 — consumption, the full-tank algorithm. Ported from the
 * desktop's `src/shared/consumption.ts`, function for function.
 *
 * Partial fills exist, so consumption is computed ONLY between consecutive
 * full-tank entries. Everything here is derived and nothing is stored
 * (§4.4): this object is called where a figure is shown and its results
 * live no longer than the composition that asked for them.
 *
 * The arithmetic is [Scaled]'s — integers throughout, rounded once at the
 * end, never a `Double` carried through an intermediate step. Litres arrive
 * ×1000; [ConsumptionPoint.l100km] is kept at ×1000 too (`CONSUMPTION_DECIMALS`)
 * so a caller can ask for two decimals or five without this object having an
 * opinion about it.
 *
 * There is no tank-level estimation here, and there is none anywhere: an
 * app that targets precision does not guess.
 */
object Consumption {

    const val CONSUMPTION_DECIMALS = 3

    data class ConsumptionPoint(
        val id: String,
        val date: String,
        val odometerKm: Int,
        val distanceKm: Int,
        /** scaled ×1000 — this entry's litres plus every partial fill since the previous full tank */
        val litres: Long,
        /** scaled ×1000 — litres ÷ distance × 100 */
        val l100km: Long,
    )

    /**
     * By odometer; tied readings break by date, then by the numeric part of
     * the id — deterministic, so two runs over the same file never disagree
     * with each other about order.
     */
    fun sortByOdometer(entries: List<FuelEntry>): List<FuelEntry> =
        entries.sortedWith(
            compareBy<FuelEntry> { it.odometerKm }
                .thenBy { it.date }
                .thenBy { idSequence(it.id) },
        )

    /**
     * A point exists only at a full-tank entry that has an earlier full-tank
     * entry before it. Every edge case is deliberate, not an omission:
     *
     * - The first-ever entry, and a run of only partials, produce no point —
     *   `previousFull` starts null and nothing sets it until a full tank is
     *   seen.
     * - A partial fill before the first full tank is dropped, not carried
     *   forward: there is no interval yet for it to belong to.
     * - Two entries at the same odometer reading produce no point — sorted
     *   by odometer, that is the only way `distance` is not positive, and it
     *   measures nothing — but the interval boundary still advances to the
     *   later one, so a real fill-up right after a duplicate reading is
     *   still measured against something.
     */
    fun consumptionPoints(entries: List<FuelEntry>): List<ConsumptionPoint> {
        val points = mutableListOf<ConsumptionPoint>()
        var previousFull: FuelEntry? = null
        var between = mutableListOf<Long>()

        for (entry in sortByOdometer(entries)) {
            if (!entry.fullTank) {
                if (previousFull != null) between.add(entry.litres)
                continue
            }

            val previous = previousFull
            if (previous != null) {
                val distance = entry.odometerKm - previous.odometerKm
                if (distance > 0) {
                    val litres = entry.litres + between.sum()
                    points += ConsumptionPoint(
                        id = entry.id,
                        date = entry.date,
                        odometerKm = entry.odometerKm,
                        distanceKm = distance,
                        litres = litres,
                        // litres(×1000) × 100 ÷ distance = the actual figure
                        // ×1000 — the same scale shift that makes formatScaled's
                        // 3-decimal convention line up, done here in integers:
                        // (numerator + distance/2) / distance rounds half up
                        // without ever forming a Double.
                        l100km = (litres * 100 + distance / 2) / distance,
                    )
                }
            }

            previousFull = entry
            between = mutableListOf()
        }

        return points
    }

    /** Cut the engine's own 3-decimal figure to a display precision. */
    fun consumptionAt(l100km: Long, decimals: Int): Long {
        val shift = CONSUMPTION_DECIMALS - decimals
        if (shift <= 0) return l100km * Scaled.scaleOf(-shift)
        val divisor = Scaled.scaleOf(shift)
        return (l100km + divisor / 2) / divisor
    }

    /** What the UI actually reads: a point per entry id, for every entry that has one. */
    fun consumptionById(entries: List<FuelEntry>): Map<String, ConsumptionPoint> =
        consumptionPoints(entries).associateBy { it.id }
}
