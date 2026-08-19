package io.github.sudomegas.tritium.storage

/**
 * What Home's summary block states (XTRITIUM §7.1), as arithmetic. Ported
 * from the desktop's `src/shared/summary.ts` — eight of its nine functions;
 * `compare` and the month-over-month trend cards it feeds are named out of
 * scope in AF7.md §1.4, not silently dropped.
 *
 * Nothing here is stored and nothing here is a projection (§3.3): every
 * figure is computed from records the maker actually entered, at read time.
 */
object Summary {

    /**
     * Average consumption — the RATIO OF THE SUMS, never the mean of the
     * ratios. Two intervals, 40 l over 400 km and 10 l over 500 km: the
     * mean of the ratios is (10,00 + 2,00) ÷ 2 = 6,00 l/100km; the ratio of
     * the sums is 50 l ÷ 900 km × 100 = 5,56 l/100km. The mean weights a
     * four-hundred-kilometre interval as heavily as a nine-hundred, which
     * is how averaging the consumption column produces a figure the
     * vehicle never achieved. Kept at ×1000 like the engine's own points,
     * rounded once, at the end. Null with no interval at all.
     */
    fun averageConsumption(fuel: List<FuelEntry>): Long? {
        val points = Consumption.consumptionPoints(fuel)
        if (points.isEmpty()) return null

        val litres = points.sumOf { it.litres }
        val distance = points.sumOf { it.distanceKm }
        if (distance <= 0) return null

        return (litres * 100 + distance / 2) / distance
    }

    /** The most recent interval's figure, ×1000, or null. */
    fun lastConsumption(fuel: List<FuelEntry>): Long? = Consumption.consumptionPoints(fuel).lastOrNull()?.l100km

    data class LastPrice(val price: Long, val date: String)

    /** The price and date of the most recent fill-up that carries a price. */
    fun lastPrice(fuel: List<FuelEntry>): LastPrice? =
        fuel.filter { it.pricePerLitre > 0 && it.date.isNotEmpty() }
            .sortedBy { it.date }
            .lastOrNull()
            ?.let { LastPrice(it.pricePerLitre, it.date) }

    /** The highest odometer reading the vehicle has, from either file (F6). */
    fun latestOdometer(fuel: List<FuelEntry>, service: List<ServiceEntry>): Int? =
        odometerSeries(fuel, service).maxOfOrNull { it.value }

    /**
     * Lifetime distance — the span between the readings that exist.
     * Deliberately NOT the sum of the consumption intervals: those run full
     * tank to full tank, so a vehicle whose most recent fill was partial
     * would under-report the kilometres actually done.
     */
    fun lifetimeDistance(fuel: List<FuelEntry>, service: List<ServiceEntry>): Int {
        val readings = odometerSeries(fuel, service)
        if (readings.size < 2) return 0
        val values = readings.map { it.value }
        return values.max() - values.min()
    }

    /** Lifetime litres — every litre entered, ×1000. */
    fun lifetimeLitres(fuel: List<FuelEntry>): Long = fuel.sumOf { it.litres }

    /**
     * Lifetime spend — every lira from all three files, income subtracting.
     * Computed through [monthlyCostSeries] rather than beside it, so this
     * figure can never drift from a future chart built on the same series.
     * The purchase price is not in it — that is "true cost per km," out of
     * scope here (AF7.md §1.4).
     */
    fun lifetimeSpend(fuel: List<FuelEntry>, costs: List<CostEntry>, service: List<ServiceEntry>): Long =
        monthlyCostSeries(fuel, costs, service).sumOf { it.value }

    /** Which file a recent entry came from, so one merged list can say so. */
    enum class EntryKind { FUEL, COST, SERVICE }

    data class RecentEntry(val id: String, val kind: EntryKind, val date: String, val label: String, val amount: Long)

    /**
     * The last entries block — one merged list, not three. Three short
     * lists would waste the width and hide the thing the block is for:
     * what has happened to this vehicle lately, in the order it happened.
     */
    fun recentEntries(
        fuel: List<FuelEntry>,
        costs: List<CostEntry>,
        service: List<ServiceEntry>,
        limit: Int,
    ): List<RecentEntry> {
        val rows = fuel.map {
            RecentEntry(it.id, EntryKind.FUEL, it.date, it.fuelType, Scaled.fuelTotal(it.litres, it.pricePerLitre))
        } + costs.map {
            RecentEntry(it.id, EntryKind.COST, it.date, it.title.ifEmpty { it.category }, it.signedAmount())
        } + service.map {
            RecentEntry(it.id, EntryKind.SERVICE, it.date, it.part, it.amount)
        }

        return rows.filter { it.date.isNotEmpty() }
            .sortedByDescending { it.date }
            .take(limit)
    }
}
