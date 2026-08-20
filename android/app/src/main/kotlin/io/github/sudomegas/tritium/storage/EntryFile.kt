package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.Toml
import dev.eav.tomlkt.TomlElement
import dev.eav.tomlkt.TomlTable
import java.io.File

/**
 * The shape shared by `fuel.toml`, `costs.toml` and `service.toml` — a port
 * of the desktop's `entry-file.ts`. All three are the same document: a
 * schema stamp, then a run of `[[entry]]` tables. Only the fields inside an
 * entry differ, so the reading, the id allocation, the unknown-key
 * preservation and the emitting live here once; `FuelFile.kt`/`CostFile.kt`/
 * `ServiceFile.kt` each supply only their own field handling.
 */

private val toml = Toml {}

/** A parsed `[[entry]]` file. */
data class EntryDocument<T : HasId>(
    val schemaVersion: Int,
    val entries: List<T>,
    /** Unknown keys per entry id, so inserting or deleting an entry cannot misalign them. */
    val entryRest: Map<String, Map<String, TomlElement>>,
    /** Unknown keys at the top level of the document. */
    val rest: Map<String, TomlElement>,
)

interface EntrySpec<T : HasId> {
    val kind: RecordKind

    /** Every key this milestone recognises. Anything else is carried untouched. */
    val knownKeys: Set<String>
    fun readEntry(table: TomlTable, id: String): T

    /**
     * The entry's lines in XTRITIUM §4.4's order, without `id` — what a
     * bundle carries (AF8.md §1.1: identity never crosses the export
     * boundary, F16 decision 2). [emitEntry] is a record file's own use of
     * this, with `id` prepended; a bundle uses this directly.
     */
    fun emitEntryFields(entry: T): List<String>

    /** The full line list a record file's own `[[entry]]` table uses. */
    fun emitEntry(entry: T): List<String> = buildList {
        add(line("id", basicString(entry.id)))
        addAll(emitEntryFields(entry))
    }
}

fun <T : HasId> emptyDocument(): EntryDocument<T> =
    EntryDocument(schemaVersion = RECORD_SCHEMA_VERSION, entries = emptyList(), entryRest = emptyMap(), rest = emptyMap())

fun <T : HasId> parseEntryDocument(text: String, spec: EntrySpec<T>, file: File): EntryDocument<T> {
    val document = try {
        toml.parseToTomlTable(text)
    } catch (e: Exception) {
        throw CorruptRecordException(file, e)
    }

    val rawEntries = asTableArray(document["entry"])

    // Ids are allocated from the highest one already present, so a
    // hand-edited file with a gap in the middle cannot produce a duplicate.
    var highest = 0
    for (raw in rawEntries) {
        val sequence = idSequence(readString(raw, "id"))
        if (sequence > highest) highest = sequence
    }

    val entries = mutableListOf<T>()
    val entryRest = mutableMapOf<String, Map<String, TomlElement>>()
    val seen = mutableSetOf<String>()

    for (raw in rawEntries) {
        var id = readString(raw, "id")
        // Empty, OR already used by an earlier entry in this same file — a
        // hand-edited duplicate (an [[entry]] block copy-pasted with the id
        // left unchanged) is exactly as unsafe as no id at all: entryRest is
        // keyed by id, so two entries sharing one would corrupt each other's
        // carried keys on the next write, and every id-keyed lookup
        // downstream (removeXEntry, updateXEntry) would touch both at once.
        if (id.isEmpty() || !seen.add(id)) {
            highest += 1
            id = formatId(spec.kind, highest)
            seen += id
        }
        entries += spec.readEntry(raw, id)
        val rest = unknownKeys(raw, spec.knownKeys)
        if (rest.isNotEmpty()) entryRest[id] = rest
    }

    val schemaVersion = readInteger(document, "schema_version").takeIf { it != 0 } ?: RECORD_SCHEMA_VERSION

    return EntryDocument(
        schemaVersion = schemaVersion,
        entries = entries,
        entryRest = entryRest,
        rest = unknownKeys(document, setOf("schema_version", "entry")),
    )
}

fun <T : HasId> serialiseEntryDocument(document: EntryDocument<T>, spec: EntrySpec<T>): String {
    // XTRITIUM §4.2 — the stamp rides first, and it is written at the
    // CURRENT version: an older file read into memory is upgraded by being
    // written back.
    val parts = mutableListOf(line("schema_version", RECORD_SCHEMA_VERSION.toString()))

    parts += carriedLines(document.rest)

    for (entry in document.entries) {
        parts += ""
        parts += "[[entry]]"
        parts += spec.emitEntry(entry)
        document.entryRest[entry.id]?.let { rest -> parts += carriedLines(rest) }
    }

    return parts.joinToString("\n") + "\n"
}

fun <T : HasId> readEntryFile(file: File, spec: EntrySpec<T>): EntryDocument<T> {
    if (!file.exists()) return emptyDocument()
    return parseEntryDocument(file.readText(), spec, file)
}

fun <T : HasId> writeEntryFile(file: File, document: EntryDocument<T>, spec: EntrySpec<T>) {
    writeAtomically(file, serialiseEntryDocument(document, spec))
}
