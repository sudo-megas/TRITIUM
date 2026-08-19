package io.github.sudomegas.tritium.storage

/** Everything one vehicle directory holds, read whole at once (XTRITIUM §4.1). */
data class VehicleBundle(
    val slug: String,
    val vehicle: VehicleDocument?,
    val fuel: FuelDocument,
    val costs: CostDocument,
    val service: ServiceDocument,
)

/**
 * The vehicle directory layout of XTRITIUM §4.1, ported from the desktop's
 * `repository.ts`:
 *
 * ```
 * <root>/vehicles/<slug>/
 *   vehicle.toml · fuel.toml · costs.toml · service.toml
 * ```
 *
 * Whole files are loaded into memory at launch and whole files are written
 * back on change. At ~600 records per decade per vehicle this costs
 * milliseconds, and it keeps the on-disk state something the maker can
 * inspect directly.
 *
 * **Stateless by design, matching the desktop exactly, not SAAT's cached
 * collection**: every mutation reads the file fresh, right before writing
 * it — AF1.md §1.2's correction of its own AF-map. Two entry paths and a
 * shell all looking at the same file (the desktop's own reason, F4's
 * decision) is not this milestone's problem yet, since AF2 has no UI at
 * all, but the shape is worth keeping identical now rather than diverging
 * and having to reconcile it once AF3 needs it.
 */
class VehicleRepository(private val paths: TritiumPaths) {

    fun vehicleDir(slug: String) = paths.vehicleDir(slug)

    fun vehicleFiles(slug: String): List<java.io.File> = listOf(
        paths.vehicleToml(slug),
        paths.fuelToml(slug),
        paths.costsToml(slug),
        paths.serviceToml(slug),
    )

    /** Every vehicle slug on disk, sorted. A directory without a `vehicle.toml` is not one. */
    fun listVehicleSlugs(): List<String> {
        val root = paths.vehiclesDir
        if (!root.isDirectory) return emptyList()

        return root.listFiles { file -> file.isDirectory }
            ?.map { it.name }
            ?.filter { slug -> paths.vehicleToml(slug).isFile }
            ?.sorted()
            ?: emptyList()
    }

    /**
     * Slug to display name, for a future picker — every vehicle's name
     * without reading its fill-ups. A record that will not parse is simply
     * absent from the map rather than raising: one unreadable vehicle must
     * not empty the picker, and the caller shows the slug, which is the
     * truth about where the file is.
     */
    fun vehicleNames(): Map<String, String> {
        val names = mutableMapOf<String, String>()
        for (slug in listVehicleSlugs()) {
            val document = runCatching { readVehicle(paths.vehicleToml(slug)) }.getOrNull()
            if (document != null && document.vehicle.name.isNotEmpty()) {
                names[slug] = document.vehicle.name
            }
        }
        return names
    }

    /**
     * Whole files in, at once (§4.1). A file that will not parse throws
     * [CorruptRecordException] rather than resolving to an empty document —
     * the caller reports it and the maker's data stays on disk exactly as
     * it was found.
     */
    fun loadVehicle(slug: String): VehicleBundle = VehicleBundle(
        slug = slug,
        vehicle = readVehicle(paths.vehicleToml(slug)),
        fuel = readFuel(paths.fuelToml(slug)),
        costs = readCosts(paths.costsToml(slug)),
        service = readService(paths.serviceToml(slug)),
    )

    fun emptyBundle(slug: String): VehicleBundle =
        VehicleBundle(slug = slug, vehicle = null, fuel = emptyFuel(), costs = emptyCosts(), service = emptyService())

    /** `slugFor`, with a numeric suffix when the name is already taken among the vehicles on disk. */
    fun uniqueSlugForNewVehicle(name: String): String = uniqueSlug(name, listVehicleSlugs().toSet())

    fun saveVehicleRecord(slug: String, document: VehicleDocument) {
        writeVehicle(paths.vehicleToml(slug), document)
    }

    // -- Fuel --------------------------------------------------------------

    fun saveFuel(slug: String, document: FuelDocument) {
        writeFuel(paths.fuelToml(slug), document)
    }

    /**
     * Append a fill-up, allocating its id here. Read-modify-write against
     * the file as it stands right now, not a copy held elsewhere — the
     * desktop's own reasoning for `addFuelEntry` (`repository.ts`).
     */
    fun addFuelEntry(slug: String, entry: (id: String) -> FuelEntry): FuelEntry {
        val file = paths.fuelToml(slug)
        val document = readFuel(file)
        val added = entry(nextId(RecordKind.FUEL, document.entries))
        writeFuel(file, document.copy(entries = document.entries + added))
        return added
    }

    /**
     * Replace one fill-up in place, by id (XTRITIUM §3 principle 8 — entries
     * are editable at any time). Backs up the file first (AF2.md §2.7). An
     * id no longer in the file is left alone — it was deleted by hand while
     * a form was open, and re-adding it would be the app arguing with the
     * maker's own edit.
     */
    fun updateFuelEntry(slug: String, entry: FuelEntry): Boolean {
        val file = paths.fuelToml(slug)
        val document = readFuel(file)
        val index = document.entries.indexOfFirst { it.id == entry.id }
        if (index < 0) return false

        Backup.backupFiles(paths, vehicleFiles(slug))
        writeFuel(file, document.copy(entries = document.entries.toMutableList().apply { this[index] = entry }))
        return true
    }

    /**
     * Remove one fill-up by id. Backs up first. Nothing is renumbered —
     * [nextId] allocates from the highest id present, so a hand-deleted
     * middle entry cannot produce a duplicate, and deleting through the app
     * is the same situation and gets the same answer.
     */
    fun removeFuelEntry(slug: String, id: String): Boolean {
        val file = paths.fuelToml(slug)
        val document = readFuel(file)
        if (document.entries.none { it.id == id }) return false

        Backup.backupFiles(paths, vehicleFiles(slug))
        writeFuel(file, document.copy(entries = document.entries.filterNot { it.id == id }))
        return true
    }

    // -- Costs ---------------------------------------------------------------

    fun saveCosts(slug: String, document: CostDocument) {
        writeCosts(paths.costsToml(slug), document)
    }

    fun addCostEntry(slug: String, entry: (id: String) -> CostEntry): CostEntry {
        val file = paths.costsToml(slug)
        val document = readCosts(file)
        val added = entry(nextId(RecordKind.COST, document.entries))
        writeCosts(file, document.copy(entries = document.entries + added))
        return added
    }

    fun updateCostEntry(slug: String, entry: CostEntry): Boolean {
        val file = paths.costsToml(slug)
        val document = readCosts(file)
        val index = document.entries.indexOfFirst { it.id == entry.id }
        if (index < 0) return false

        Backup.backupFiles(paths, vehicleFiles(slug))
        writeCosts(file, document.copy(entries = document.entries.toMutableList().apply { this[index] = entry }))
        return true
    }

    fun removeCostEntry(slug: String, id: String): Boolean {
        val file = paths.costsToml(slug)
        val document = readCosts(file)
        if (document.entries.none { it.id == id }) return false

        Backup.backupFiles(paths, vehicleFiles(slug))
        writeCosts(file, document.copy(entries = document.entries.filterNot { it.id == id }))
        return true
    }

    // -- Service ---------------------------------------------------------------

    fun saveService(slug: String, document: ServiceDocument) {
        writeService(paths.serviceToml(slug), document)
    }

    fun addServiceEntry(slug: String, entry: (id: String) -> ServiceEntry): ServiceEntry {
        val file = paths.serviceToml(slug)
        val document = readService(file)
        val added = entry(nextId(RecordKind.SERVICE, document.entries))
        writeService(file, document.copy(entries = document.entries + added))
        return added
    }

    fun updateServiceEntry(slug: String, entry: ServiceEntry): Boolean {
        val file = paths.serviceToml(slug)
        val document = readService(file)
        val index = document.entries.indexOfFirst { it.id == entry.id }
        if (index < 0) return false

        Backup.backupFiles(paths, vehicleFiles(slug))
        writeService(file, document.copy(entries = document.entries.toMutableList().apply { this[index] = entry }))
        return true
    }

    fun removeServiceEntry(slug: String, id: String): Boolean {
        val file = paths.serviceToml(slug)
        val document = readService(file)
        if (document.entries.none { it.id == id }) return false

        Backup.backupFiles(paths, vehicleFiles(slug))
        writeService(file, document.copy(entries = document.entries.filterNot { it.id == id }))
        return true
    }
}
