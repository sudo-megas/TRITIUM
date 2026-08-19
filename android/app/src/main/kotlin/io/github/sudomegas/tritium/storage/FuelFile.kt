package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.TomlTable
import java.io.File

/** `fuel.toml` — one `[[entry]]` per fill-up (XTRITIUM §4.4), ported from `fuel-file.ts`. */

/**
 * `total` is listed here so it is recognised precisely to be **dropped**,
 * not carried: `litres × price` is derived and never stored (§4.4 — XTRITIUM
 * §3 principle 7). A file arriving with one loses it on the next save.
 */
private val KNOWN_KEYS = setOf(
    "id", "date", "odometer_km", "litres", "price_per_litre", "full_tank", "fuel_type", "total",
)

object FuelSpec : EntrySpec<FuelEntry> {
    override val kind = RecordKind.FUEL
    override val knownKeys = KNOWN_KEYS

    override fun readEntry(table: TomlTable, id: String): FuelEntry = FuelEntry(
        id = id,
        date = readDate(table, "date"),
        odometerKm = readInteger(table, "odometer_km"),
        litres = Scaled.toPump(readNumber(table, "litres")),
        pricePerLitre = Scaled.toPump(readNumber(table, "price_per_litre")),
        fullTank = readBoolean(table, "full_tank"),
        fuelType = readString(table, "fuel_type"),
    )

    override fun emitEntry(entry: FuelEntry): List<String> = buildList {
        add(line("id", basicString(entry.id)))
        addAll(dateLines("date", entry.date))
        add(line("odometer_km", entry.odometerKm.toString()))
        add(line("litres", Scaled.formatPump(entry.litres)))
        add(line("price_per_litre", Scaled.formatPump(entry.pricePerLitre)))
        add(line("full_tank", if (entry.fullTank) "true" else "false"))
        add(line("fuel_type", basicString(entry.fuelType)))
    }
}

typealias FuelDocument = EntryDocument<FuelEntry>

fun emptyFuel(): FuelDocument = emptyDocument()
fun readFuel(file: File): FuelDocument = readEntryFile(file, FuelSpec)
fun writeFuel(file: File, document: FuelDocument) = writeEntryFile(file, document, FuelSpec)
