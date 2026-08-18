// The five audits are the project's guard rails (XTRITIUM §9.4). A gate that
// cannot fail is decoration, so each one is pointed at a file that breaks its
// rule and must reject it — and at a clean file it must let through.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = fileURLToPath(new URL('../..', import.meta.url))

const AUDITS = ['egress', 'strings', 'colours', 'locale', 'overlap'] as const

function runAudit(name: string, src: string): { status: number; output: string } {
  const result = spawnSync(process.execPath, [`scripts/audit-${name}.mjs`], {
    cwd: REPO,
    env: { ...process.env, TRITIUM_AUDIT_SRC: src },
    encoding: 'utf8'
  })
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`
  }
}

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/audits/${name}`, import.meta.url))
}

describe('the five audits', () => {
  for (const name of AUDITS) {
    it(`audit-${name} rejects a file that breaks its rule`, () => {
      const { status, output } = runAudit(name, fixture(name))
      expect(status).toBe(1)
      expect(output).toContain('violation')
    })

    it(`audit-${name} passes a clean file`, () => {
      const { status, output } = runAudit(name, fixture('clean'))
      expect(status).toBe(0)
      expect(output).toContain('clean')
    })

    it(`audit-${name} passes the real tree`, () => {
      const { status } = runAudit(name, fileURLToPath(new URL('../../src', import.meta.url)))
      expect(status).toBe(0)
    })
  }
})
