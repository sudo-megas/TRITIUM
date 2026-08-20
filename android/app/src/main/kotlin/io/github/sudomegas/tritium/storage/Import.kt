package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.TomlTable
import dev.eav.tomlkt.buildTomlTable

/**
 * Reading a bundle another phone (or the desktop) wrote (F16, AF9b.md §1) —
 * the pure half, with no filesystem in it, ported from the desktop's own
 * `src/main/storage/import.ts`. [VehicleRepository.importBundle] is the
 * filesystem-touching half: planning which vehicles to create, backing up
 * what is about to change, and writing once per file.
 */

data class MergeCounts(val added: Int, val skipped: Int)

/**
 * Merge one kind of record into the document already on disk — ported from
 * the desktop's own `mergeEntries`. Incoming entries are read through the
 * record's OWN [EntrySpec] — never a second parser, matching the same
 * reason [EntryFile.kt]'s own reader is shared by every record file — and
 * given a fresh id from the receiving document's own highest, never the id
 * they arrived with ([Bundle.kt]'s own identity comment).
 */
fun <T : HasId> mergeEntries(
    document: EntryDocument<T>,
    incoming: List<TomlTable>,
    spec: EntrySpec<T>,
    keyOf: (T) -> String,
    kind: RecordKind,
): Pair<EntryDocument<T>, MergeCounts> {
    val seen = document.entries.map(keyOf).toMutableSet()
    var highest = document.entries.maxOfOrNull { idSequence(it.id) } ?: 0
    val merged = document.entries.toMutableList()

    var added = 0
    var skipped = 0

    for (table in incoming) {
        // Read first, with a placeholder id: the key comes from the
        // entry's own fields, and the id is not one of them.
        val candidate = spec.readEntry(table, "")
        if (!seen.add(keyOf(candidate))) {
            skipped += 1
            continue
        }

        highest += 1
        merged += spec.readEntry(table, formatId(kind, highest))
        added += 1
    }

    return document.copy(entries = merged) to MergeCounts(added, skipped)
}

/**
 * The keys a bundle's `[[vehicle]]` table carries that a vehicle record
 * does not — ported from the desktop's own `BUNDLE_VEHICLE_KEYS`.  `slug`
 * is how the bundle addresses a vehicle; the other three are where its
 * entries hang. Leaving them in is not cosmetic: [readVehicleTable] carries
 * every key it does not recognise into `rest`, and the writer renders
 * `rest` inline — a whole fill-up history would land in `vehicle.toml` as
 * one line, `fuel = [{ date = ..., ... }]`. These four are not unknown,
 * they are structure, and structure is consumed before the vehicle is
 * read.
 */
val BUNDLE_VEHICLE_KEYS = setOf("slug", "fuel", "costs", "service")

fun vehicleTableOf(raw: TomlTable): TomlTable = buildTomlTable {
    for ((key, value) in raw.entries) {
        if (key !in BUNDLE_VEHICLE_KEYS) element(key, value)
    }
}
