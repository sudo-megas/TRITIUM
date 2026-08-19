package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.TomlTable
import java.io.File

/**
 * `costs.toml` — İLK ALIŞ, TEKRAR EDEN (except Periyodik Bakım), and manual
 * entries (XTRITIUM §4.4, §6.1), ported from `cost-file.ts`.
 */

private val KNOWN_KEYS = setOf(
    "id", "date", "group", "category", "title", "amount", "income",
    "payment_method", "bank", "instalment", "note",
)

object CostSpec : EntrySpec<CostEntry> {
    override val kind = RecordKind.COST
    override val knownKeys = KNOWN_KEYS

    override fun readEntry(table: TomlTable, id: String): CostEntry = CostEntry(
        id = id,
        date = readDate(table, "date"),
        // An unrecognised group reads as MANUAL rather than throwing — a
        // group nothing else defines is, by construction, one the maker
        // typed for themselves.
        group = CostGroup.fromToken(readString(table, "group")) ?: CostGroup.MANUAL,
        category = readString(table, "category"),
        title = readString(table, "title"),
        amount = Scaled.toMoney(readNumber(table, "amount")),
        income = readBoolean(table, "income"),
        paymentMethod = readString(table, "payment_method"),
        bank = readString(table, "bank"),
        instalment = readString(table, "instalment"),
        note = readString(table, "note"),
    )

    override fun emitEntry(entry: CostEntry): List<String> = buildList {
        add(line("id", basicString(entry.id)))
        addAll(dateLines("date", entry.date))
        add(line("group", basicString(entry.group.token)))
        add(line("category", basicString(entry.category)))
        add(line("title", basicString(entry.title)))
        add(line("amount", Scaled.formatMoney(entry.amount)))
        add(line("income", if (entry.income) "true" else "false"))
        add(line("payment_method", basicString(entry.paymentMethod)))
        add(line("bank", basicString(entry.bank)))
        add(line("instalment", basicString(entry.instalment)))
        add(line("note", basicString(entry.note)))
    }
}

typealias CostDocument = EntryDocument<CostEntry>

fun emptyCosts(): CostDocument = emptyDocument()
fun readCosts(file: File): CostDocument = readEntryFile(file, CostSpec)
fun writeCosts(file: File, document: CostDocument) = writeEntryFile(file, document, CostSpec)
