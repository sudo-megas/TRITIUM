package io.github.sudomegas.tritium.storage

import java.io.File

/**
 * Every path the vehicle storage layer touches, derived from one root — the
 * same injection pattern `ConfigStore` already uses (AF1), for the same
 * reason: a plain JVM temp directory in tests, `filesDir` and nothing else in
 * the app.
 *
 * ```
 * files/
 * ├── vehicles/<slug>/
 * │   ├── vehicle.toml
 * │   ├── fuel.toml
 * │   ├── costs.toml
 * │   └── service.toml
 * ├── settings.toml
 * └── backups/<timestamp>/          copies of files about to be overwritten
 * ```
 *
 * Mirrors the desktop's `~/.local/share/tritium/vehicles/<slug>/` layout
 * (XTRITIUM §4.1) exactly, one level down: the desktop's data directory is
 * this app's `root`.
 */
class TritiumPaths(val root: File) {

    val vehiclesDir: File get() = File(root, VEHICLES)
    val backupsDir: File get() = File(root, BACKUPS)

    fun vehicleDir(slug: String): File = File(vehiclesDir, slug)

    fun vehicleToml(slug: String): File = File(vehicleDir(slug), VEHICLE_FILENAME)
    fun fuelToml(slug: String): File = File(vehicleDir(slug), FUEL_FILENAME)
    fun costsToml(slug: String): File = File(vehicleDir(slug), COSTS_FILENAME)
    fun serviceToml(slug: String): File = File(vehicleDir(slug), SERVICE_FILENAME)

    companion object {
        const val VEHICLES = "vehicles"
        const val BACKUPS = "backups"
        const val VEHICLE_FILENAME = "vehicle.toml"
        const val FUEL_FILENAME = "fuel.toml"
        const val COSTS_FILENAME = "costs.toml"
        const val SERVICE_FILENAME = "service.toml"
    }
}
