// XTRITIUM §4.1 — Atomic writes, always.
//
// Write to a temp file in the same directory, fsync it, then rename over the
// target. A power loss yields the old file intact or the new file complete,
// never a torn one. The directory is fsynced too, so the rename itself is
// durable and not merely the bytes it points at.
//
// This is the ONLY write path in TRITIUM. Every later milestone goes through it.

import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, unlinkSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'

let counter = 0

function tempNameFor(target: string): string {
  counter += 1
  // Same directory as the target — rename is only atomic within one filesystem.
  return join(dirname(target), `.${process.pid}-${counter}.tmp`)
}

/** Write `contents` to `target` atomically, creating the directory if needed. */
export function writeFileAtomicSync(target: string, contents: string): void {
  mkdirSync(dirname(target), { recursive: true })

  const temp = tempNameFor(target)
  let handle: number | undefined

  try {
    handle = openSync(temp, 'wx', 0o600)
    writeSync(handle, contents)
    fsyncSync(handle)
    closeSync(handle)
    handle = undefined

    renameSync(temp, target)
    fsyncDirectory(dirname(target))
  } catch (error) {
    if (handle !== undefined) {
      try {
        closeSync(handle)
      } catch {
        // The write already failed; a close failure adds nothing.
      }
    }
    try {
      unlinkSync(temp)
    } catch {
      // The temp file may never have been created.
    }
    throw error
  }
}

function fsyncDirectory(directory: string): void {
  let handle: number | undefined
  try {
    handle = openSync(directory, 'r')
    fsyncSync(handle)
  } catch {
    // Some filesystems refuse to fsync a directory handle. The rename itself is
    // still atomic; only its durability across a power cut is weakened.
  } finally {
    if (handle !== undefined) {
      try {
        closeSync(handle)
      } catch {
        // Nothing left to do.
      }
    }
  }
}
