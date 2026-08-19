package io.github.sudomegas.tritium.storage

import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Nothing is destroyed quietly — SAAT's rule, in the desktop's own words
 * (`backup.ts`): "Before any destructive change the previous version is
 * copied into `backups/` (newest 20 kept)." The desktop only wired this in
 * at F16, because until import nothing overwrote a file the maker did not
 * have open in front of him. AF3–AF6 give the phone forms that edit and
 * delete entries directly, so [VehicleRepository]'s `update*`/`remove*`
 * functions call this from AF2 (AF2.md §2.7), ahead of the UI that will
 * make it visible.
 *
 * `backups/` sits beside `vehicles/` at the data root — safe by
 * construction: [listVehicleSlugs] walks only `vehiclesDir`, and further
 * requires a `vehicle.toml`, so nothing in the app can mistake a backup
 * round for a vehicle.
 */
object Backup {

    /** SAAT's number, ported unchanged — there is no reason to differ. */
    const val BACKUPS_KEPT = 20

    private val STAMP_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH-mm-ss")

    /**
     * A directory name that sorts chronologically as a string. Colons are
     * legal on the filesystems this app targets but awkward to type, and the
     * maker is the one who would type it restoring by hand — the whole point
     * of a plain copy rather than an archive.
     */
    fun stampFor(now: LocalDateTime): String = now.format(STAMP_FORMAT)

    /**
     * Copy [files] into a fresh round under [paths], keeping each file's
     * position relative to [TritiumPaths.root] so a restore is a copy back
     * rather than a puzzle. A file that does not exist yet is skipped rather
     * than failing — a fresh vehicle has nothing to preserve for a kind it
     * has never written, and that is not an error.
     *
     * Returns the round's directory, or null when there was nothing to copy.
     */
    fun backupFiles(paths: TritiumPaths, files: List<File>, now: LocalDateTime = LocalDateTime.now()): File? {
        val present = files.filter { it.exists() }
        if (present.isEmpty()) return null

        val round = File(paths.backupsDir, stampFor(now))
        for (file in present) {
            val relative = file.relativeTo(paths.root)
            val target = File(round, relative.path)
            target.parentFile?.mkdirs()
            file.copyTo(target, overwrite = true)
        }

        prune(paths)
        return round
    }

    /**
     * Keep the newest [BACKUPS_KEPT] rounds and remove the rest. Sorted by
     * name rather than by modification time — [stampFor]'s format is what
     * makes that safe, since the string order and the chronological order
     * are the same, and a copied-in directory cannot jump the queue by
     * carrying an odd timestamp.
     */
    fun prune(paths: TritiumPaths) {
        val root = paths.backupsDir
        if (!root.isDirectory) return

        val rounds = root.listFiles { file -> file.isDirectory }
            ?.map { it.name }
            ?.sorted()
            ?: return

        val stale = rounds.dropLast(BACKUPS_KEPT.coerceAtLeast(0))
        for (name in stale) {
            File(root, name).deleteRecursively()
        }
    }
}
