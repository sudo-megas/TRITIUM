// XTRITIUM §8 — every user-visible string lives in the i18n JSON, never in a .tsx.
// Two shapes are caught: literal JSX text nodes, and literal values on the
// attributes a user can actually read.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { walk, report, ROOT, SRC } from './lib/scan.mjs'

const READABLE_ATTRS =
  /\b(title|placeholder|alt|aria-label|aria-description|label)\s*=\s*"([^"]+)"/g
const JSX_TEXT = />([^<>{}]+)</g

// A run of two or more letters is prose; punctuation, digits and glyphs are not.
const LOOKS_LIKE_PROSE = /\p{L}{2,}/u

/**
 * Depth of JSX expression containers at `index`. Text found inside `{...}` is
 * JavaScript — a ternary between two elements, say — not a string the user
 * reads, so it is not the strings audit's business.
 */
function braceDepthAt(line, index) {
  let depth = 0
  for (let i = 0; i < index; i += 1) {
    if (line[i] === '{') depth += 1
    else if (line[i] === '}') depth -= 1
  }
  return depth
}

const findings = []

for (const file of walk(SRC, ['.tsx'])) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return

    for (const match of line.matchAll(JSX_TEXT)) {
      const text = match[1].trim()
      if (!text || !LOOKS_LIKE_PROSE.test(text)) continue
      if (braceDepthAt(line, match.index ?? 0) > 0) continue
      findings.push({
        file: relative(ROOT, file),
        line: index + 1,
        text: trimmed,
        why: `JSX text "${text}" is not in the i18n catalogue`
      })
    }

    for (const match of line.matchAll(READABLE_ATTRS)) {
      const value = match[2].trim()
      if (!LOOKS_LIKE_PROSE.test(value)) continue
      findings.push({
        file: relative(ROOT, file),
        line: index + 1,
        text: trimmed,
        why: `${match[1]}="${value}" is a user-visible literal; use t()`
      })
    }
  })
}

report('audit-strings', findings)
