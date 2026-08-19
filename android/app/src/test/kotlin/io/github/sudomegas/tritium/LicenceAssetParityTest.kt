package io.github.sudomegas.tritium

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * `assets/LICENSE` is a copy, not a link — Android's build has no way to read
 * a file from outside its own module at compile time the way the desktop's
 * Vite build reads the repo-root `LICENSE` directly with a `?raw` import
 * (`src/renderer/panes/AboutPane.tsx`). A copy that can silently drift from
 * the file it is supposed to be is exactly the failure shape `issues.md`
 * already records for a table and a set of tags (I-10, I-34) — this is the
 * same thing for two copies of a licence text, caught the same way: measured
 * on every run, not trusted once and forgotten.
 *
 * Gradle's test working directory is the module root (`android/app`), so the
 * repository's `LICENSE` is two levels up.
 */
class LicenceAssetParityTest {

    @Test
    fun `the packaged licence asset matches the repository root LICENSE exactly`() {
        val repoRoot = File("../../LICENSE")
        val packaged = File("src/main/assets/LICENSE")

        assertEquals(
            "run from android/app/ — if this fails on a fresh checkout, " +
                "confirm the working directory rather than the files",
            true,
            repoRoot.isFile,
        )
        assertEquals(repoRoot.readText(), packaged.readText())
    }
}
