package io.github.sudomegas.tritium.storage

import java.io.File
import java.time.LocalDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class BackupTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun paths(): TritiumPaths = TritiumPaths(tmp.root)

    @Test
    fun `stampFor sorts chronologically as a string`() {
        val earlier = Backup.stampFor(LocalDateTime.of(2026, 1, 2, 3, 4, 5))
        val later = Backup.stampFor(LocalDateTime.of(2026, 1, 2, 3, 4, 6))
        assertTrue(earlier < later)
    }

    @Test
    fun `backing up files that do not exist yet returns null and copies nothing`() {
        val result = Backup.backupFiles(paths(), listOf(File(tmp.root, "vehicles/kia/fuel.toml")))
        assertNull(result)
    }

    @Test
    fun `backupFiles copies present files, keeping their position under root`() {
        val vehicleDir = File(tmp.root, "vehicles/kia").apply { mkdirs() }
        val fuel = File(vehicleDir, "fuel.toml").apply { writeText("schema_version = 1\n") }

        val round = Backup.backupFiles(paths(), listOf(fuel), LocalDateTime.of(2026, 8, 19, 12, 0, 0))

        assertTrue(round != null)
        val copied = File(round, "vehicles/kia/fuel.toml")
        assertTrue(copied.exists())
        assertEquals("schema_version = 1\n", copied.readText())
    }

    @Test
    fun `only the newest 20 rounds survive a prune`() {
        val storagePaths = paths()
        for (day in 1..25) {
            Backup.backupFiles(
                storagePaths,
                listOf(File(tmp.root, "settings.toml").apply { writeText("x") }),
                LocalDateTime.of(2026, 1, day, 0, 0, 0),
            )
        }

        val rounds = storagePaths.backupsDir.listFiles { f -> f.isDirectory }?.map { it.name }?.sorted().orEmpty()
        assertEquals(Backup.BACKUPS_KEPT, rounds.size)
        // The oldest five (days 1-5) are gone; day 25's round is the newest kept.
        assertTrue(rounds.first().startsWith("2026-01-06"))
        assertTrue(rounds.last().startsWith("2026-01-25"))
    }
}
