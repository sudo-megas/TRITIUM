// Run by tests/unit/atomic.test.ts in a child process, which SIGKILLs it while
// the write is in flight. Node runs this file directly — no build step.

import { writeFileAtomicSync } from '../../../src/main/storage/atomic.ts'

const target = process.argv[2]
const bytes = Number(process.argv[3])

if (target === undefined || !Number.isFinite(bytes)) {
  process.exit(2)
}

// Announce readiness so the parent's timer starts at the right moment.
process.stdout.write('ready\n')
writeFileAtomicSync(target, 'x'.repeat(bytes))
process.stdout.write('done\n')
