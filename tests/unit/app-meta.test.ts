// The version the About page states and the version the package declares are
// one fact in two files. The version rolls at every PUTAG (XTRITIUM §9.1), so
// the agreement is checked here rather than remembered each time.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_VERSION, RELEASE_DATE } from '../../src/shared/app-meta.js'

function readJson(name: string): Record<string, unknown> {
  const path = fileURLToPath(new URL(`../../${name}`, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

describe('the version the app states', () => {
  it('is the version package.json declares', () => {
    expect(APP_VERSION).toBe(readJson('package.json')['version'])
  })

  it('is the version the lockfile declares, in both places it says it', () => {
    // npm writes the version twice and neither `npm test` nor `npm run build`
    // rewrites either, so a hand-rolled version leaves the lockfile behind.
    const lock = readJson('package-lock.json')
    const root = (lock['packages'] as Record<string, { version?: string }>)['']

    expect(lock['version']).toBe(APP_VERSION)
    expect(root?.version).toBe(APP_VERSION)
  })

  it('states its release date as GG/AA/YYYY', () => {
    // XTRITIUM §8 — day, month, year, in that order, everywhere in TRITIUM.
    // A fixed shape, not a locale call (§3.6).
    expect(RELEASE_DATE).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })
})
