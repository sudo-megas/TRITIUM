// XTRITIUM §3.6 / §8 — no locale detection. English on first launch, Turkish by
// manual switch, nothing read from the OS. Every Intl constructor must name its
// locale explicitly.

import { walk, collect, report, SRC } from './lib/scan.mjs'

const rules = [
  { pattern: /navigator\s*\.\s*languages?\b/, why: 'reads the browser locale' },
  { pattern: /\bapp\s*\.\s*getLocale(CountryCode)?\b/, why: 'reads the OS locale' },
  { pattern: /\bapp\s*\.\s*getSystemLocale\b/, why: 'reads the OS locale' },
  { pattern: /\bnew\s+Intl\.[A-Za-z]+\s*\(\s*\)/, why: 'Intl constructor without an explicit locale' },
  { pattern: /\bnew\s+Intl\.[A-Za-z]+\s*\(\s*undefined/, why: 'Intl with undefined locale falls back to the system' },
  { pattern: /\btoLocaleString\s*\(\s*\)/, why: 'toLocaleString() without an explicit locale' },
  { pattern: /\btoLocaleDateString\s*\(\s*\)/, why: 'toLocaleDateString() without an explicit locale' },
  { pattern: /\btoLocaleTimeString\s*\(\s*\)/, why: 'toLocaleTimeString() without an explicit locale' },
  { pattern: /LanguageDetector/, why: 'i18next language detection is forbidden' },
  { pattern: /\bIntl\.\s*DateTimeFormat\s*\(\s*\)/, why: 'DateTimeFormat without an explicit locale' }
]

const files = walk(SRC, ['.ts', '.tsx', '.js', '.mjs', '.json', '.html'])
report('audit-locale', collect(files, rules))
