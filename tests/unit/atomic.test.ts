// The atomic write helper is the only write path in TRITIUM (XTRITIUM §4.1),
// so it is tested harder than anything else in F1.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileAtomicSync } from '../../src/main/storage/atomic.js'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tritium-atomic-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('writeFileAtomicSync', () => {
  it('creates the file and its directory', () => {
    const target = join(dir, 'nested', 'settings.toml')
    writeFileAtomicSync(target, 'schema_version = 1\n')
    expect(readFileSync(target, 'utf8')).toBe('schema_version = 1\n')
  })

  it('replaces an existing file', () => {
    const target = join(dir, 'settings.toml')
    writeFileAtomicSync(target, 'first\n')
    writeFileAtomicSync(target, 'second\n')
    expect(readFileSync(target, 'utf8')).toBe('second\n')
  })

  it('leaves no temp files behind', () => {
    const target = join(dir, 'settings.toml')
    writeFileAtomicSync(target, 'a\n')
    writeFileAtomicSync(target, 'b\n')
    expect(readdirSync(dir)).toEqual(['settings.toml'])
  })

  it('does not clobber the target when the write itself fails', () => {
    const target = join(dir, 'settings.toml')
    writeFileSync(target, 'original\n')
    // The directory path cannot be replaced by a file write of this shape.
    expect(() => writeFileAtomicSync(dir, 'x')).toThrow()
    expect(existsSync(target)).toBe(true)
    expect(readFileSync(target, 'utf8')).toBe('original\n')
  })

  it('never leaves a torn file when the process is killed mid-write', async () => {
    const helper = fileURLToPath(new URL('./helpers/kill-mid-write.ts', import.meta.url))
    const target = join(dir, 'settings.toml')
    const original = 'schema_version = 1\n[general]\nlanguage = "en"\n'
    const bytes = 96 * 1024 * 1024

    let torn = 0
    let killedBeforeRename = 0

    // Repeat: the kill must land somewhere inside the write, and a large
    // payload keeps that window wide. Whatever the timing, the file on disk is
    // only ever the whole old content or the whole new content.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      writeFileSync(target, original)

      await new Promise<void>((resolve) => {
        const child = spawn(process.execPath, [helper, target, String(bytes)], { stdio: 'pipe' })
        child.stdout.once('data', () => {
          setTimeout(() => child.kill('SIGKILL'), 2)
        })
        child.once('exit', () => resolve())
      })

      const after = readFileSync(target, 'utf8')
      if (after === original) killedBeforeRename += 1
      else if (after !== 'x'.repeat(bytes)) torn += 1

      // Abandoned work is always recognisable as a temp file, never the target.
      for (const entry of readdirSync(dir)) {
        if (entry !== 'settings.toml') expect(entry.endsWith('.tmp')).toBe(true)
      }
      for (const entry of readdirSync(dir)) {
        if (entry !== 'settings.toml') rmSync(join(dir, entry), { force: true })
      }
    }

    expect(torn).toBe(0)
    // At least one kill must actually have landed before the rename, or the
    // test proved nothing.
    expect(killedBeforeRename).toBeGreaterThan(0)
  }, 60_000)
})
