package io.github.sudomegas.tritium.storage

/**
 * The interchange format F16 already fixed and the desktop's `importBundle`
 * already reads (AF8.md §1.1) — Android only ever writes one, never reads
 * one: the phone exports, the desktop imports, one direction.
 *
 * One file, every vehicle the phone has (AF8.md §1.2 — never a per-vehicle
 * picker), no ids, no derived totals, every figure exactly as
 * `fuel.toml`/`costs.toml`/`service.toml`/`vehicle.toml` themselves already
 * render it. This module owns none of that formatting itself — every line
 * comes from [EntrySpec.emitEntryFields]/[emitVehicleFields], the same
 * functions the record files use, so a bundle can never drift from what
 * this same app would write to its own files (mirroring the desktop's own
 * reason for reusing `FUEL_SPEC.readEntry` on its read side: "a second
 * reader here would drift from the first one within a milestone").
 */
object Bundle {
    const val FORMAT = "tritium-export"
    const val FORMAT_VERSION = 1
    const val SOURCE = "android"

    /**
     * [exportedDate] arrives as a parameter, never read from a live clock
     * inside this function — the same discipline [boundsFor]'s own `today`
     * parameter already established.
     */
    fun build(vehicles: List<VehicleBundle>, exportedDate: String): String {
        val parts = mutableListOf(
            line("format", basicString(FORMAT)),
            line("format_version", FORMAT_VERSION.toString()),
        )
        parts += dateLines("exported", exportedDate)
        parts += line("source", basicString(SOURCE))

        for (bundle in vehicles) {
            // A vehicle.toml this build cannot parse is skipped, not fatal
            // to the whole export — the same leniency HomeViewModel's own
            // summary load already applies to one unreadable file.
            val vehicle = bundle.vehicle?.vehicle ?: continue

            parts += ""
            parts += "[[vehicle]]"
            parts += line("slug", basicString(bundle.slug))
            parts += emitVehicleFields(vehicle)

            for (entry in bundle.fuel.entries) {
                parts += ""
                parts += "[[vehicle.fuel]]"
                parts += FuelSpec.emitEntryFields(entry)
            }
            for (entry in bundle.costs.entries) {
                parts += ""
                parts += "[[vehicle.costs]]"
                parts += CostSpec.emitEntryFields(entry)
            }
            for (entry in bundle.service.entries) {
                parts += ""
                parts += "[[vehicle.service]]"
                parts += ServiceSpec.emitEntryFields(entry)
            }
        }

        return parts.joinToString("\n") + "\n"
    }
}
