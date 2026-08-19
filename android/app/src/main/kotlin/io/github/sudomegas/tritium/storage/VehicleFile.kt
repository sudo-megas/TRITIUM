package io.github.sudomegas.tritium.storage

import dev.eav.tomlkt.Toml
import dev.eav.tomlkt.TomlElement
import dev.eav.tomlkt.TomlTable
import java.io.File

/**
 * `vehicle.toml` — the vehicle record (XTRITIUM §4.4), ported from the
 * desktop's `vehicle-file.ts`.
 *
 * A flat table, not an `[[entry]]` list: one file, one vehicle. The keys are
 * emitted in the order the constitution draws them. There is NO photo
 * field, and there never will be — vehicles have no photos anywhere in
 * TRITIUM, on either platform.
 */

private val toml = Toml {}

private val KNOWN_KEYS = setOf(
    "schema_version", "name", "make", "model", "year", "engine", "fuel_spec",
    "plate", "vin", "tank_capacity_l", "purchase_date", "purchase_price",
    "registration_date", "inspection_due",
)

data class VehicleDocument(
    val schemaVersion: Int,
    val vehicle: Vehicle,
    val rest: Map<String, TomlElement>,
)

/**
 * A parsed table becomes a vehicle. Split from [parseVehicle] for the same
 * reason the desktop split it in F16: AF8's import will need to read a
 * vehicle from a bundle's `[[vehicle]]` table without re-implementing this.
 */
fun readVehicleTable(table: TomlTable): VehicleDocument {
    val vehicle = Vehicle(
        name = readString(table, "name"),
        make = readString(table, "make"),
        model = readString(table, "model"),
        year = readInteger(table, "year"),
        engine = readString(table, "engine"),
        fuelSpec = readString(table, "fuel_spec"),
        plate = readString(table, "plate"),
        vin = readString(table, "vin"),
        tankCapacityL = Scaled.toTank(readNumber(table, "tank_capacity_l")),
        purchaseDate = readDate(table, "purchase_date"),
        purchasePrice = Scaled.toMoney(readNumber(table, "purchase_price")),
        registrationDate = readDate(table, "registration_date"),
        inspectionDue = readDate(table, "inspection_due"),
    )

    val schemaVersion = readInteger(table, "schema_version").takeIf { it != 0 } ?: RECORD_SCHEMA_VERSION
    return VehicleDocument(schemaVersion = schemaVersion, vehicle = vehicle, rest = unknownKeys(table, KNOWN_KEYS))
}

fun parseVehicle(text: String, file: File): VehicleDocument {
    val table = try {
        toml.parseToTomlTable(text)
    } catch (e: Exception) {
        throw CorruptRecordException(file, e)
    }
    return readVehicleTable(table)
}

/**
 * A vehicle's own lines, without `schema_version` — what a bundle's
 * `[[vehicle]]` table carries (AF8.md §1.1). [serialiseVehicle] is
 * `vehicle.toml`'s own use of this, with the schema stamp prepended;
 * `Bundle.kt` uses this directly, with `slug` prepended instead.
 */
fun emitVehicleFields(vehicle: Vehicle): List<String> = buildList {
    add(line("name", basicString(vehicle.name)))
    add(line("make", basicString(vehicle.make)))
    add(line("model", basicString(vehicle.model)))
    add(line("year", vehicle.year.toString()))
    add(line("engine", basicString(vehicle.engine)))
    add(line("fuel_spec", basicString(vehicle.fuelSpec)))
    add(line("plate", basicString(vehicle.plate)))
    add(line("vin", basicString(vehicle.vin)))
    add(line("tank_capacity_l", Scaled.formatTank(vehicle.tankCapacityL)))
    addAll(dateLines("purchase_date", vehicle.purchaseDate))
    add(line("purchase_price", Scaled.formatMoney(vehicle.purchasePrice)))
    addAll(dateLines("registration_date", vehicle.registrationDate))
    addAll(dateLines("inspection_due", vehicle.inspectionDue))
}

fun serialiseVehicle(document: VehicleDocument): String {
    val parts = mutableListOf(line("schema_version", RECORD_SCHEMA_VERSION.toString()))
    parts += emitVehicleFields(document.vehicle)
    parts += carriedLines(document.rest)

    return parts.joinToString("\n") + "\n"
}

/** The document, or null when the file is simply not there yet. */
fun readVehicle(file: File): VehicleDocument? {
    if (!file.exists()) return null
    return parseVehicle(file.readText(), file)
}

fun writeVehicle(file: File, document: VehicleDocument) {
    writeAtomically(file, serialiseVehicle(document))
}
