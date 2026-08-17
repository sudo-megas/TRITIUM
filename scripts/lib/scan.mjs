// Shared plumbing for the four audits. Each audit owns its own rules; this file
// only walks the tree and prints findings in one consistent shape.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The audits always scan src/. The override exists so the test suite can point
// them at fixtures and prove each gate still bites (tests/unit/audits.test.ts).
export const SRC = process.env['TRITIUM_AUDIT_SRC'] ?? join(ROOT, 'src')

const SKIP_DIRS = new Set(['node_modules', 'out', 'dist', 'release', '.git', 'assets'])

/** Every file under `dir` whose extension is in `exts`. */
export function walk(dir, exts) {
  const found = []
  const visit = (current) => {
    let entries
    try {
      entries = readdirSync(current)
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry)
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(entry)) visit(full)
      } else if (exts.includes(extname(entry))) {
        found.push(full)
      }
    }
  }
  visit(dir)
  return found
}

/**
 * Apply `rules` line by line to every file in `files`.
 * A rule is `{ pattern: RegExp, why: string, allow?: (line, file) => boolean }`.
 */
export function collect(files, rules) {
  const findings = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      for (const rule of rules) {
        rule.pattern.lastIndex = 0
        if (!rule.pattern.test(line)) continue
        if (rule.allow?.(line, file)) continue
        findings.push({
          file: relative(ROOT, file),
          line: index + 1,
          text: line.trim(),
          why: rule.why
        })
      }
    })
  }
  return findings
}

/** Print findings and exit non-zero when there are any. */
export function report(name, findings) {
  if (findings.length === 0) {
    console.log(`${name}: clean`)
    return
  }
  console.error(`${name}: ${findings.length} violation(s)\n`)
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`)
    console.error(`    ${f.why}`)
    console.error(`    ${f.text}\n`)
  }
  process.exit(1)
}
