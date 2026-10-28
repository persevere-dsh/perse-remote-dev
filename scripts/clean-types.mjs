#!/usr/bin/env node
/** Remove only this package's tsc-owned output before a forced full emit. */

import { rm } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_ROOT = resolve(ROOT, 'packages', 'perse-remote-dev')
const TYPES_DIR = resolve(PACKAGE_ROOT, 'lib', 'types')

if (!TYPES_DIR.startsWith(`${PACKAGE_ROOT}${sep}`)) {
  throw new Error('refusing to clean an output path outside the package')
}

await rm(TYPES_DIR, { recursive: true, force: true })
console.log('[clean-types] removed packages/perse-remote-dev/lib/types')
