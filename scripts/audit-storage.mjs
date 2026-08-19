// Two promises that every milestone document has asserted and nothing has
// checked (F12).
//
// 1. XTRITIUM §4.1 — "Atomic writes, always: write to a temp file in the same
//    directory, fsync, rename over the target." Eight documents from F4 onward
//    carry the line "writeFileSync appears nowhere in src/ outside atomic.ts",
//    and until now a person read it. The guarantee that a power cut yields the
//    old file or the new one is worth exactly what the guarantee that nothing
//    bypasses the helper is worth.
//
// 2. Every write path tells the other windows. This is not a principle of the
//    constitution — it is a lesson. `issues.md` I-01 and I-02 are the SAME
//    defect twice: a handler that wrote a file and told nobody, so a record
//    saved in a form window never reached the shell and looked lost. F5 fixed
//    the first and wrote the second down; F6 inherited it rather than
//    rediscovering it. That worked. A gate means it does not happen a third
//    time.

import { readFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { walk, collect, report, ROOT, SRC } from './lib/scan.mjs'

const ATOMIC_FILE = 'atomic.ts'

/**
 * The repository functions that put bytes on disk. A handler that calls one of
 * these has changed the maker's data, and every window looking at that data
 * needs to hear about it.
 */
const WRITES = /\b(save|add|update|remove)(Vehicle|VehicleRecord|Fuel|Cost|Service)[A-Za-z]*\s*\(/

const findings = []

// ── 1. the atomic helper is the only way to disk ─────────────────────────────
findings.push(
  ...collect(
    walk(SRC, ['.ts', '.tsx']).filter((file) => basename(file) !== ATOMIC_FILE),
    [
      {
        pattern: /\bwriteFileSync\s*\(/,
        why: 'every write goes through the atomic helper (XTRITIUM §4.1) — see storage/atomic.ts'
      },
      {
        pattern: /\bfs\.writeFile\s*\(|\bwriteFile\s*\(/,
        why: 'an async write cannot be atomic here either; use writeFileAtomicSync'
      }
    ]
  )
)

// ── 2. a write path tells the other windows ──────────────────────────────────
//
// Parsed rather than matched line by line: the question is about a BLOCK — does
// this handler, which writes, also broadcast — and a line-wise rule cannot ask
// it. The split is deliberately crude and deliberately loud: a handler it
// cannot parse is reported rather than skipped.
for (const file of walk(SRC, ['.ts'])) {
  const source = readFileSync(file, 'utf8')
  if (!source.includes('ipcMain.handle(')) continue

  const chunks = source.split('ipcMain.handle(')
  chunks.shift() // whatever came before the first handler

  for (const chunk of chunks) {
    const channel = /^\s*'([^']+)'/.exec(chunk)?.[1] ?? '<unknown>'

    // The handler body runs to the next handler, which is where this chunk ends.
    if (!WRITES.test(chunk)) continue
    if (chunk.includes('broadcast(')) continue

    const line = source.slice(0, source.indexOf(chunk)).split('\n').length

    findings.push({
      file: relative(ROOT, file),
      line,
      text: `ipcMain.handle('${channel}', …)`,
      why: 'this handler writes to disk and tells no other window — see issues.md I-01, I-02'
    })
  }
}

report('audit-storage', findings)
