package io.github.sudomegas.tritium.storage

/**
 * XTRITIUM §7.2 — the two series [Summary] needs, ported from the desktop's
 * `src/shared/series.ts`. Not the other five that file exports: those serve
 * F8/F10 charts with no Android home in the current AF-map (AF7.md §1.4).
 *
 * Every `value` is a scaled integer, exactly as the entry it came from
 * carries it — money ×100, odometer in whole kilometres.
 */

/** A point on a series whose x is a date. */
data class DatePoint(val date: String, val value: Int)

/** A point on a monthly series — money ×100, summed over the calendar month. */
data class MonthPoint(val month: String, val value: Long)

/** `2026-08-16` -> `2026-08`. String surgery, not calendar arithmetic. */
fun monthOf(date: String): String = date.take(7)

/** Every odometer reading the vehicle has, from both files that carry one (F6's reasoning). */
fun odometerSeries(fuel: List<FuelEntry>, service: List<ServiceEntry>): List<DatePoint> {
    val readings = fuel.filter { it.date.isNotEmpty() && it.odometerKm > 0 }
        .map { DatePoint(it.date, it.odometerKm) } +
        service.filter { it.date.isNotEmpty() && it.odometerKm > 0 }
            .map { DatePoint(it.date, it.odometerKm) }
    return readings.sortedBy { it.date }
}

/**
 * Every lira the vehicle cost that month, all three files together — fuel
 * totals (derived, never stored), cost amounts with income subtracting
 * (§4.4), and service amounts.
 */
fun monthlyCostSeries(fuel: List<FuelEntry>, costs: List<CostEntry>, service: List<ServiceEntry>): List<MonthPoint> {
    val totals = mutableMapOf<String, Long>()
    fun add(date: String, amount: Long) {
        if (date.isEmpty()) return
        val key = monthOf(date)
        totals[key] = (totals[key] ?: 0) + amount
    }

    for (entry in fuel) add(entry.date, Scaled.fuelTotal(entry.litres, entry.pricePerLitre))
    for (entry in costs) add(entry.date, entry.signedAmount())
    for (entry in service) add(entry.date, entry.amount)

    return totals.entries.map { (month, value) -> MonthPoint(month, value) }.sortedBy { it.month }
}
