// Launching the real app against a throwaway data directory — the one place
// that knows how, so a change to launch conditions is a change in one file.
//
// Every spec here seeds a settings.toml before launching. From F3 the app asks
// the currency question whenever that key is absent (XTRITIUM §8), and a suite
// that launched into an empty directory would meet that question in all twelve
// of its existing tests. Seeding says "this is not a first launch"; the specs
// that mean to test a first launch leave the file out on purpose.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'

export const REPO = fileURLToPath(new URL('../..', import.meta.url))

export interface SeedOptions {
  /** Left out entirely when null — that is what makes a launch a first launch. */
  currency?: string | null
  language?: string
  palette?: string
  activeVehicle?: string
}

export function makeDataDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function settingsPathIn(dataDir: string): string {
  return join(dataDir, 'tritium', 'settings.toml')
}

/** Write a settings.toml the app will read as an existing installation. */
export function seedSettings(dataDir: string, options: SeedOptions = {}): void {
  const { currency = 'TRY', language = 'en', palette = 'default-dark', activeVehicle } = options

  const general = [`language = "${language}"`]
  if (currency !== null) general.push(`currency = "${currency}"`)
  if (activeVehicle !== undefined) general.push(`active_vehicle = "${activeVehicle}"`)

  const text = [
    'schema_version = 1',
    '',
    '[general]',
    ...general,
    '',
    '[appearance]',
    `palette = "${palette}"`,
    ''
  ].join('\n')

  mkdirSync(join(dataDir, 'tritium'), { recursive: true })
  writeFileSync(settingsPathIn(dataDir), text)
}

export async function launchApp(
  dataDir: string,
  extraArgs: readonly string[] = []
): Promise<ElectronApplication> {
  return electron.launch({
    args: [REPO, ...extraArgs],
    cwd: REPO,
    env: { ...process.env, XDG_DATA_HOME: dataDir }
  })
}

/**
 * The window showing a given test id.
 *
 * From F3 an app can have two windows at once — the shell and a form — so
 * firstWindow() is ambiguous and a spec must say which one it means. Polled,
 * because a window exists before its bundle has run.
 */
export async function windowWith(app: ElectronApplication, testId: string): Promise<Page> {
  let found: Page | undefined

  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if ((await page.getByTestId(testId).count()) > 0) {
            found = page
            return true
          }
        }
        return false
      },
      { timeout: 15_000 }
    )
    .toBe(true)

  if (found === undefined) throw new Error(`no window showing ${testId}`)
  return found
}
