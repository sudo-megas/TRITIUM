// XTRITIUM §4.1 — the data layout lives under ~/.local/share/tritium/.
// XDG_DATA_HOME is honoured because that is what "~/.local/share" means on Arch;
// this reads an environment variable, not a locale, and no network is involved.

import { homedir } from 'node:os'
import { join } from 'node:path'

export const APP_DIR_NAME = 'tritium'

export function dataDir(): string {
  const xdg = process.env['XDG_DATA_HOME']
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.local', 'share')
  return join(base, APP_DIR_NAME)
}

export function settingsPath(): string {
  return join(dataDir(), 'settings.toml')
}

export function vehiclesDir(): string {
  return join(dataDir(), 'vehicles')
}
