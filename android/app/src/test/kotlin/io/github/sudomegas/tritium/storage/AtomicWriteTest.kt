package io.github.sudomegas.tritium.storage

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AtomicWriteTest {

    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun `writes content that can be read back`() {
        val target = File(tmp.root, "settings.toml")
        writeAtomically(target, "language = \"en\"")
        assertEquals("language = \"en\"", target.readText())
    }

    @Test
    fun `creates the parent directory if it does not exist yet`() {
        val target = File(tmp.root, "nested/dir/settings.toml")
        writeAtomically(target, "language = \"en\"")
        assertEquals("language = \"en\"", target.readText())
    }

    @Test
    fun `an overwrite fully replaces the previous content, never appends`() {
        val target = File(tmp.root, "settings.toml")
        writeAtomically(target, "language = \"en\"")
        writeAtomically(target, "language = \"tr\"")
        assertEquals("language = \"tr\"", target.readText())
    }

    @Test
    fun `no temp file survives a successful write`() {
        val target = File(tmp.root, "settings.toml")
        writeAtomically(target, "language = \"en\"")
        val leftovers = tmp.root.listFiles { f -> f.name.endsWith(".tmp") }
        assertTrue(
            "expected no .tmp leftovers, found ${leftovers?.toList()}",
            leftovers.isNullOrEmpty(),
        )
    }

    @Test
    fun `a write that throws leaves the previous file intact and no temp file behind`() {
        val target = File(tmp.root, "settings.toml")
        writeAtomically(target, "language = \"en\"")

        // Simulate a torn write: the target's parent is made read-only so the
        // ATOMIC_MOVE step fails after the temp file has already been written
        // and fsync'd — the exact window the whole helper exists to protect.
        val locked = File(tmp.root, "locked")
        locked.mkdirs()
        val lockedTarget = File(locked, "settings.toml")
        writeAtomically(lockedTarget, "language = \"en\"")
        assertTrue(locked.setReadOnly())
        try {
            runCatching { writeAtomically(lockedTarget, "language = \"tr\"") }
        } finally {
            locked.setWritable(true)
        }

        assertEquals(
            "the previous version must survive a failed write intact",
            "language = \"en\"",
            lockedTarget.readText(),
        )
        val leftovers = locked.listFiles { f -> f.name.endsWith(".tmp") }
        assertTrue(
            "a failed write must clean up its own temp file",
            leftovers.isNullOrEmpty(),
        )
    }
}
