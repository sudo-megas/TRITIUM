package io.github.sudomegas.tritium.storage

import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Write a file so that a reader either sees the whole previous version or the
 * whole new one, never a truncated file — the Android counterpart of the
 * desktop's own atomic-write helper (XTRITIUM §4.1: "temp file in the same
 * directory, fsync, rename over the target"), the same guarantee stated for
 * the platform Android is.
 *
 * The temp file is created in the SAME directory as the target, because
 * `ATOMIC_MOVE` is only guaranteed within one filesystem. `fsync` before the
 * rename is what makes the content durable rather than merely visible; without
 * it a power loss can leave a correctly-named file full of zeroes.
 */
fun writeAtomically(target: File, content: String) {
    val dir = target.parentFile ?: error("target has no parent directory: $target")
    dir.mkdirs()

    val temp = File.createTempFile(".${target.name}.", ".tmp", dir)
    try {
        FileOutputStream(temp).use { out ->
            out.write(content.toByteArray(Charsets.UTF_8))
            out.flush()
            out.fd.sync()
        }
        Files.move(
            temp.toPath(),
            target.toPath(),
            StandardCopyOption.ATOMIC_MOVE,
            StandardCopyOption.REPLACE_EXISTING,
        )
    } catch (e: Throwable) {
        temp.delete()
        throw e
    }
}
