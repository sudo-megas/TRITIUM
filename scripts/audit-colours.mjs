// XTRITIUM §8 — every colour is a custom property defined in palettes.css.
// Nothing else in src/ may carry a colour literal.

import { basename } from 'node:path'
import { walk, collect, report, SRC } from './lib/scan.mjs'

const PALETTE_FILE = 'palettes.css'

const rules = [
  { pattern: /#[0-9a-fA-F]{3,8}\b/, why: 'hex colour literal' },
  { pattern: /\brgba?\s*\(/, why: 'rgb()/rgba() colour literal' },
  { pattern: /\bhsla?\s*\(/, why: 'hsl()/hsla() colour literal' },
  { pattern: /\boklch\s*\(/, why: 'oklch() colour literal' },
  { pattern: /\boklab\s*\(/, why: 'oklab() colour literal' },
  { pattern: /\bhwb\s*\(/, why: 'hwb() colour literal' },
  { pattern: /\bcolor-mix\s*\(/, why: 'color-mix() derives a colour outside the palette' }
]

const files = walk(SRC, ['.css', '.ts', '.tsx', '.html']).filter(
  (file) => basename(file) !== PALETTE_FILE
)

report('audit-colours', collect(files, rules))
