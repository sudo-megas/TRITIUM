package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.Toml
import dev.eav.tomlkt.TomlTable

/**
 * The interchange format F16 already fixed and the desktop's `importBundle`
 * already reads (AF8.md §1.1). AF8 only ever wrote one; AF9b (§1.1) adds
 * the other direction the maker asked for — a phone reading a bundle
 * another phone (or the desktop) wrote — so both `build` and `read` live
 * here now, the same split the desktop's own `shared/bundle.ts` keeps: the
 * envelope, pure, with no filesystem in it.
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

    private val toml = Toml {}

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

    /**
     * Read and check the envelope — F16 decision 5, ported from the
     * desktop's own `readBundle` (`import.ts`). A bundle stamped higher
     * than this build understands is REFUSED rather than read. The record
     * files' own habit — read `schema_version`, then always write back the
     * current constant — is right for a file this app owns, and wrong
     * across a boundary between two applications: there it would silently
     * relabel a phone's newer format as this build's older one and lose
     * the fact that anything was different. `format_version` absent reads
     * as `0`, same as [readInteger]'s own default — never "too new", since
     * a bundle from before this key existed is not from the future.
     */
    fun read(text: String): TomlTable {
        val document = try {
            toml.parseToTomlTable(text)
        } catch (e: Exception) {
            throw BundleError(BundleRefusal.Unreadable)
        }

        if (readString(document, "format") != FORMAT) {
            throw BundleError(BundleRefusal.NotABundle)
        }

        val version = readInteger(document, "format_version")
        if (version > FORMAT_VERSION) {
            throw BundleError(BundleRefusal.TooNew(found = version, understood = FORMAT_VERSION))
        }

        return document
    }
}

/** What an import did to one vehicle, kind by kind — reported, never assumed. */
data class Counts(val fuel: Int, val costs: Int, val service: Int)

data class ImportTally(
    val slug: String,
    val vehicleCreated: Boolean,
    val added: Counts,
    val skipped: Counts,
) {
    /** Whether this vehicle is one [VehicleRepository.importBundle] needs to back up before writing. */
    fun totalAdded(): Int = added.fuel + added.costs + added.service
}

data class ImportResult(val vehicles: List<ImportTally>)

/** Why a bundle was refused. Nothing is written when one of these is raised. */
sealed class BundleRefusal {
    object Unreadable : BundleRefusal()
    object NotABundle : BundleRefusal()
    data class TooNew(val found: Int, val understood: Int) : BundleRefusal()
}

class BundleError(val refusal: BundleRefusal) : Exception("bundle refused: $refusal")

/*
 * ── identity ──────────────────────────────────────────────────────────────
 *
 * Two devices number their entries independently, so an id cannot say
 * whether two records are the same record — [mergeEntries] (`Import.kt`)
 * ignores whatever id a bundle carries and allocates its own from the
 * receiving file's highest. Identity is carried by facts about the world
 * instead, one key per kind. A match means the incoming entry is SKIPPED —
 * SAAT's rule via F16, and the reason re-importing the same file twice is
 * never destructive.
 */

/** A fill-up: you cannot fill twice at one reading on one day. */
fun fuelKey(entry: FuelEntry): String = "${entry.date}|${entry.odometerKm}"

/**
 * A service record: date and reading are not enough on their own — tyres
 * and an oil change on the same day at the same odometer is ordinary.
 */
fun serviceKey(entry: ServiceEntry): String = "${entry.date}|${entry.odometerKm}|${entry.part}"

/** A cost carries no odometer at all: a bill is identified by what it is — a sum, in a category, on a day. */
fun costKey(entry: CostEntry): String = "${entry.date}|${entry.category}|${entry.amount}"
