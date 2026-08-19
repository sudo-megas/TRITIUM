// Nothing is destroyed quietly (F16).
//
// The rule is the family's, from SAAT: "Before any destructive change the
// previous version is copied into backups/ (newest 20 kept)." TRITIUM had no
// such folder because until F16 it had nothing that overwrote a file the maker
// did not have open in front of him. An import does.
//
// backups/ sits beside vehicles/ at the data root, which is safe by
// construction: listVehicleSlugs walks only vehiclesDir(), and further requires
// a vehicle.toml, so nothing in the application can mistake a backup for a
// vehicle no matter what is under here.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { dataDir } from './paths.js'

/** How many rounds are kept. SAAT's number, and there is no reason to differ. */
export const BACKUPS_KEPT = 20

export function backupsDir(): string {
  return join(dataDir(), 'backups')
}

/**
 * A directory name that sorts chronologically as a string.
 *
 * Colons are legal on the filesystems this app targets but make a path awkward
 * to type, and the maker is the one who will be typing it when he restores by
 * hand — which is the whole point of keeping these as plain copies rather than
 * an archive.
 */
export function stampFor(now: Date): string {
  const pad = (value: number, width = 2): string => value.toString().padStart(width, '0')
  return (
    `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  )
}

/**
 * Copy the given files into a fresh round, keeping the layout they had under the
 * data directory so a restore is a copy back rather than a puzzle.
 *
 * Files that do not exist yet are skipped rather than raising: an import that
 * creates a vehicle has nothing to preserve for it, and that is not an error.
 *
 * Returns the round's directory, or null when there was nothing to copy at all.
 */
export function backupFiles(files: readonly string[], now: Date = new Date()): string | null {
  const present = files.filter((file) => existsSync(file))
  if (present.length === 0) return null

  const round = join(backupsDir(), stampFor(now))

  for (const file of present) {
    const target = join(round, relative(dataDir(), file))
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(file, target)
  }

  prune()
  return round
}

/**
 * Keep the newest BACKUPS_KEPT rounds and remove the rest.
 *
 * Sorted by name rather than by mtime, which is what makes stampFor's format
 * load-bearing: the string order and the chronological order are the same, and a
 * copied-in directory cannot jump the queue by carrying an odd timestamp.
 */
export function prune(): void {
  const root = backupsDir()
  if (!existsSync(root)) return

  const rounds = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const stale of rounds.slice(0, Math.max(0, rounds.length - BACKUPS_KEPT))) {
    const path = join(root, stale)
    if (statSync(path).isDirectory()) rmSync(path, { recursive: true, force: true })
  }
}
