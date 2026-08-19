// Deliberately broken, so audit-storage can be proved to bite (F12).
//
// Two violations, one of each rule:
//   1. a write that bypasses the atomic helper (XTRITIUM §4.1)
//   2. a handler that changes the maker's data and tells no other window
//      — which is `issues.md` I-01 and I-02, the same defect twice

import { writeFileSync } from 'node:fs'
import { ipcMain } from 'electron'
import { saveFuel } from './repository.js'

export function writeDirectly(file: string, text: string): void {
  writeFileSync(file, text)
}

export function register(): void {
  ipcMain.handle('fuel:save', (_event, slug: unknown, document: unknown) => {
    saveFuel(String(slug), document)
    // No broadcast. The shell goes on showing the file as it was when it last
    // rendered, and to the maker the save silently failed.
  })
}
