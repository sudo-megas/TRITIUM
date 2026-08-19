package io.github.sudomegas.tritium.storage

/**
 * The record shapes of XTRITIUM §4.4, ported from `src/shared/records.ts`
 * field for field. Every money and measure field holds a SCALED INTEGER
 * ([Scaled]) — never a `Double`. Dates are plain `YYYY-MM-DD` strings, empty
 * when unset: a TOML local date carries no time and no zone, and a typed
 * date crossing this boundary risks exactly the shift-a-day bug the desktop
 * avoids by staying a string.
 *
 * Derived values are never stored (§4.4): a fill-up's total is
 * `litres × price`, computed where it is shown, absent from the file.
 */

const val RECORD_SCHEMA_VERSION = 1

private val DATE_PATTERN = Regex("^\\d{4}-\\d{2}-\\d{2}$")

fun isDateString(value: String): Boolean = DATE_PATTERN.matches(value)

// ---------------------------------------------------------------------------
// Vocabularies — fixed lists live here as data, not as strings scattered
// through the code that happens to need them.
// ---------------------------------------------------------------------------

/** XTRITIUM §4.4: `fuel_type` comes "from a fixed pick-list (95, 97, dizel, LPG…)". */
val FUEL_TYPES: List<String> = listOf("Kurşunsuz 95", "Kurşunsuz 97", "Dizel", "LPG")

/** XTRITIUM §6.1 — the three columns of the category tree. */
enum class CostGroup(val token: String) {
    ILK_ALIS("ilk-alis"),
    TEKRAR_EDEN("tekrar-eden"),
    MANUAL("manual");

    companion object {
        fun fromToken(value: String?): CostGroup? = entries.firstOrNull { it.token == value }
    }
}

/**
 * XTRITIUM §6.1, the user-authored tree, final. `MANUAL` carries no fixed
 * categories: it is where the maker adds their own. Periyodik Bakım appears
 * here for completeness but its entries do not live in `costs.toml` — they
 * land in `service.toml` (§6.2).
 */
val COST_CATEGORIES: Map<CostGroup, List<String>> = mapOf(
    CostGroup.ILK_ALIS to listOf("kapora", "arac-bedeli", "noter-ruhsat", "plaka-noter", "plaka-so"),
    CostGroup.TEKRAR_EDEN to listOf("periyodik-bakim", "mtv-1", "mtv-2", "trafik-sigortasi", "kasko"),
    CostGroup.MANUAL to emptyList(),
)

/** The one category in the tree whose entries do not live in `costs.toml`. */
const val SERVICE_CATEGORY = "periyodik-bakim"

/** XTRITIUM §4.4 — "editable list; ships: EFT, kredi kartı, banka kartı". */
val PAYMENT_METHODS: List<String> = listOf("eft", "kredi-karti", "banka-karti")

/** The categories a cost form may offer for a group — §6.1's tree minus Periyodik Bakım (AF6's job). */
fun pickableCategories(group: CostGroup): List<String> =
    (COST_CATEGORIES[group] ?: emptyList()).filter { it != SERVICE_CATEGORY }

/** True for MANUAL alone — read from the tree's emptiness rather than restated beside it. */
fun takesTypedCategory(group: CostGroup): Boolean = (COST_CATEGORIES[group] ?: emptyList()).isEmpty()

// ---------------------------------------------------------------------------
// The four records
// ---------------------------------------------------------------------------

/** `vehicle.toml` — a flat table. NO photo field: vehicles have no photos anywhere. */
data class Vehicle(
    val name: String = "",
    val make: String = "",
    val model: String = "",
    val year: Int = 0,
    val engine: String = "",
    val fuelSpec: String = "",
    val plate: String = "",
    val vin: String = "",
    /** scaled ×10 */
    val tankCapacityL: Long = 0,
    val purchaseDate: String = "",
    /** scaled ×100 */
    val purchasePrice: Long = 0,
    val registrationDate: String = "",
    /** Passive reference only — nothing watches it, nothing notifies. */
    val inspectionDue: String = "",
)

/** `fuel.toml` — one `[[entry]]` per fill-up. */
data class FuelEntry(
    val id: String,
    val date: String = "",
    val odometerKm: Int = 0,
    /** scaled ×1000 */
    val litres: Long = 0,
    /** scaled ×1000 */
    val pricePerLitre: Long = 0,
    /** Meaningful — the consumption engine reads it (AF4). */
    val fullTank: Boolean = false,
    val fuelType: String = "",
) : HasId

/** `costs.toml` — İLK ALIŞ, TEKRAR EDEN (except Periyodik Bakım), and manual entries. */
data class CostEntry(
    val id: String,
    val date: String = "",
    val group: CostGroup = CostGroup.MANUAL,
    val category: String = "",
    val title: String = "",
    /** scaled ×100 */
    val amount: Long = 0,
    /** Negative costs — payouts, refunds — are income. */
    val income: Boolean = false,
    val paymentMethod: String = "",
    val bank: String = "",
    /** Plain text, no engine behind it. */
    val instalment: String = "",
    val note: String = "",
) : HasId

/** `service.toml` — the Periyodik Bakım sheet's shape. */
data class ServiceEntry(
    val id: String,
    val date: String = "",
    val part: String = "",
    val odometerKm: Int = 0,
    /** scaled ×100 */
    val amount: Long = 0,
    /** A pasted address: selectable text ONLY, never a link (XTRITIUM §5). */
    val vendor: String = "",
) : HasId

interface HasId {
    val id: String
}

// ---------------------------------------------------------------------------
// Ids — f-0001, c-0001, s-0001
// ---------------------------------------------------------------------------

enum class RecordKind(val prefix: String) {
    FUEL("f"), COST("c"), SERVICE("s"),
}

private val ID_PATTERN = Regex("^[fcs]-(\\d+)$")

fun formatId(kind: RecordKind, sequence: Int): String =
    "${kind.prefix}-${sequence.toString().padStart(4, '0')}"

/**
 * The numeric part of an id, or 0 if it does not parse. Ids are allocated
 * from the highest one already in the file rather than from a count, so a
 * hand-edited file — the maker deleting a middle entry — cannot produce a
 * duplicate.
 */
fun idSequence(id: String): Int {
    val match = ID_PATTERN.find(id) ?: return 0
    return match.groupValues[1].toIntOrNull() ?: 0
}

fun nextId(kind: RecordKind, existing: List<HasId>): String {
    var highest = 0
    for (entry in existing) {
        val sequence = idSequence(entry.id)
        if (sequence > highest) highest = sequence
    }
    return formatId(kind, highest + 1)
}

/** A vehicle with nothing filled in — the starting point of a new record. */
val EMPTY_VEHICLE = Vehicle()
