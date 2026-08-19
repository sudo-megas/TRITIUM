package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.TomlTable
import java.io.File

/** `service.toml` — the Periyodik Bakım sheet's shape (XTRITIUM §4.4), ported from `service-file.ts`. */

private val KNOWN_KEYS = setOf("id", "date", "part", "odometer_km", "amount", "vendor")

object ServiceSpec : EntrySpec<ServiceEntry> {
    override val kind = RecordKind.SERVICE
    override val knownKeys = KNOWN_KEYS

    override fun readEntry(table: TomlTable, id: String): ServiceEntry = ServiceEntry(
        id = id,
        date = readDate(table, "date"),
        part = readString(table, "part"),
        odometerKm = readInteger(table, "odometer_km"),
        amount = Scaled.toMoney(readNumber(table, "amount")),
        // A pasted address: selectable text ONLY, never a link (XTRITIUM §5)
        // — enforced by the UI (AF6), not by the storage layer, which just
        // carries the string.
        vendor = readString(table, "vendor"),
    )

    override fun emitEntryFields(entry: ServiceEntry): List<String> = buildList {
        addAll(dateLines("date", entry.date))
        add(line("part", basicString(entry.part)))
        add(line("odometer_km", entry.odometerKm.toString()))
        add(line("amount", Scaled.formatMoney(entry.amount)))
        add(line("vendor", basicString(entry.vendor)))
    }
}

typealias ServiceDocument = EntryDocument<ServiceEntry>

fun emptyService(): ServiceDocument = emptyDocument()
fun readService(file: File): ServiceDocument = readEntryFile(file, ServiceSpec)
fun writeService(file: File, document: ServiceDocument) = writeEntryFile(file, document, ServiceSpec)
