#!/usr/bin/env node
/**
 * verify-generated.mjs — manifest ↔ generated-artifact consistency gate.
 *
 * Proves, on the built tree, that the Typert codegen surface and the package
 * manifest agree, and that the package cannot declare a file it does not ship.
 *
 * Checks
 *   1. the five generated artifacts exist under `<pkg>/lib/`;
 *   2. every `types` / `default` target of `exports[".", "./types", "./typert",
 *      "./remote"]` resolves to a real file on disk;
 *   3. `dsh.bundle.patch` resolves to a real file on disk;
 *   4. every `files[]` entry matches **at least one** real file — a manifest that
 *      declares a non-existent file (this repo's skeleton once kept a stray
 *      `apply-helper.mjs` entry) is a packing bug and fails here;
 *   5. `lib/typert.host.js` carries all 15 frozen `@Remote` method names;
 *   6. the shipped surface never names a `src/` path — neither as a shipped file
 *      location nor as a module specifier.
 *
 * KNOWN FALSE POSITIVE for check 6 (do not "fix" it by grepping the raw text):
 * the generator stamps `sourceLocation: {"file":"packages/perse-remote-dev/src/…"}`
 * into `lib/typert.host.js` / `lib/typert.remote-client.js`, and rolldown keeps
 * `//#region packages/perse-remote-dev/src/…` comments in `client.js`. Those are
 * inert diagnostic strings, not resolvable paths — `src/` is never packed. Check
 * 6 therefore asserts on shipped *paths* and on `import` / `require` *specifiers*,
 * which is the invariant that actually matters at install time.
 *
 * Usage
 *   node scripts/verify-generated.mjs [--package <dir>]
 *   PERSE_REMOTE_DEV_PACKAGE=<dir> node scripts/verify-generated.mjs
 *   node scripts/verify-generated.mjs --help
 *
 * `--package` points at the *package* directory (the one with package.json and
 * lib/). It exists so the negative controls can run against a throwaway copy.
 * Only node builtins are used.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(HERE, '..')
const DEFAULT_PACKAGE_DIR = join(WORKSPACE_ROOT, 'packages', 'perse-remote-dev')

/** The five artifacts `scripts/gen-typert.mjs` promises to write. */
const GENERATED_ARTIFACTS = [
  'lib/typert.host.js',
  'lib/typert.host.d.ts',
  'lib/typert.remote-client.js',
  'lib/typert.remote-client.d.ts',
  'lib/typert.remote-client.d.ts.map',
]

/** `exports` subpaths that must carry both faces and resolve on disk. */
const EXPORT_SUBPATHS = ['.', './types', './typert', './remote']

/** Faces every checked `exports` entry must carry. */
const EXPORT_FACES = ['types', 'default']

/** The frozen `@Remote` method set (must all be present in `lib/typert.host.js`). */
const FROZEN_METHODS = [
  'listTargets',
  'readConfiguration',
  'updateConfiguration',
  'describe',
  'listDirectory',
  'createDirectory',
  'openTunnel',
  'listTunnels',
  'closeTunnel',
  'openProject',
  'reviewStatus',
  'reviewBatch',
  'reviewApply',
  'reviewReject',
  'reviewRollback',
]

// --- entry point -------------------------------------------------------------

let options
try {
  options = parseArguments(process.argv.slice(2))
} catch (error) {
  report(`error: ${error.message}`)
  printUsage()
  process.exit(2)
}
if (options.help) {
  printUsage()
  process.exit(0)
}
const packageDir = options.packageDir

const results = []
report(`package: ${packageDir}`)

// 1 ---------------------------------------------------------------------------
const missingArtifacts = GENERATED_ARTIFACTS.filter(
  (artifact) => !isFile(join(packageDir, artifact)),
)
check(
  '1. all 5 generated artifacts exist under lib/',
  missingArtifacts.length === 0,
  `every one of ${JSON.stringify(GENERATED_ARTIFACTS)} present under lib/`,
  missingArtifacts.length === 0 ? 'all present' : `missing: ${JSON.stringify(missingArtifacts)}`,
)

// --- manifest -----------------------------------------------------------------
const manifestPath = join(packageDir, 'package.json')
if (!isFile(manifestPath)) {
  report(`FATAL: no package.json under ${packageDir}`)
  process.exit(2)
}
let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (error) {
  report(`FATAL: ${manifestPath} is not valid JSON: ${error.message}`)
  process.exit(2)
}

// 2 ---------------------------------------------------------------------------
for (const subpath of EXPORT_SUBPATHS) {
  const entry = manifest.exports?.[subpath]
  if (entry === undefined || typeof entry !== 'object' || entry === null) {
    check(
      `2. exports["${subpath}"] declares types + default`,
      false,
      `object with ${JSON.stringify(EXPORT_FACES)}`,
      JSON.stringify(entry),
    )
    continue
  }
  for (const face of EXPORT_FACES) {
    const target = entry[face]
    const resolves = typeof target === 'string' && isFile(join(packageDir, target))
    check(
      `2. exports["${subpath}"].${face} resolves on disk`,
      resolves,
      typeof target === 'string' ? `existing file ${target}` : 'a string target',
      typeof target === 'string'
        ? `${target} (${resolves ? 'exists' : 'MISSING on disk'})`
        : JSON.stringify(target),
    )
  }
}

// 3 ---------------------------------------------------------------------------
const patch = manifest.dsh?.bundle?.patch
const patchResolves = typeof patch === 'string' && isFile(join(packageDir, patch))
check(
  '3. dsh.bundle.patch resolves on disk',
  patchResolves,
  'a string target that exists',
  typeof patch === 'string'
    ? `${patch} (${patchResolves ? 'exists' : 'MISSING on disk'})`
    : JSON.stringify(patch),
)

// --- files[] ------------------------------------------------------------------
const files = Array.isArray(manifest.files) ? manifest.files : []
const onDisk = walkFiles(packageDir)
const filesMatches = new Map()
const unmatched = []
for (const entry of files) {
  const matched = onDisk.filter((candidate) => globToRegExp(entry).test(candidate))
  filesMatches.set(entry, matched)
  if (matched.length === 0) unmatched.push(entry)
}
check(
  `4. every files[] entry matches ≥1 real file (${files.length} entries)`,
  files.length > 0 && unmatched.length === 0,
  'no files[] entry with 0 matches',
  files.length === 0
    ? 'files[] is empty or missing'
    : unmatched.length === 0
      ? `all ${files.length} entries match`
      : `0 matches for: ${JSON.stringify(unmatched)}`,
)

// 5 ---------------------------------------------------------------------------
const hostJsPath = join(packageDir, 'lib', 'typert.host.js')
const hostJs = isFile(hostJsPath) ? readFileSync(hostJsPath, 'utf8') : ''
const missingMethods = FROZEN_METHODS.filter(
  (method) => !new RegExp(`\\b${method}\\b`).test(hostJs),
)
check(
  `5. lib/typert.host.js carries all ${FROZEN_METHODS.length} frozen method names`,
  missingMethods.length === 0,
  `all of ${JSON.stringify(FROZEN_METHODS)}`,
  missingMethods.length === 0
    ? `all ${FROZEN_METHODS.length} present`
    : `missing: ${JSON.stringify(missingMethods)}`,
)

// 6 ---------------------------------------------------------------------------
const shipped = [
  ...new Set([
    ...GENERATED_ARTIFACTS.map((artifact) => toPosix(artifact)),
    ...files.flatMap((entry) => filesMatches.get(entry) ?? []),
  ]),
].sort()

const shippedUnderSrc = shipped.filter((candidate) => /(^|\/)src\//.test(candidate))
check(
  '6a. no shipped artifact path resolves under src/',
  shippedUnderSrc.length === 0,
  'every shipped path outside src/',
  shippedUnderSrc.length === 0
    ? `all ${shipped.length} shipped paths are outside src/`
    : `src/ paths in the shipped surface: ${JSON.stringify(shippedUnderSrc)}`,
)

const specifierOffenders = []
for (const candidate of shipped) {
  if (!/\.(?:js|cjs|mjs|ts|mts|cts|yml|yaml|json)$/.test(candidate)) continue
  const text = readFileSync(join(packageDir, candidate), 'utf8')
  for (const match of text.matchAll(
    /(?:from\s*|require\s*\(\s*|import\s*\(\s*|import\s+)["']([^"'\n]+)["']/g,
  )) {
    if (/(^|\/)src\//.test(match[1])) specifierOffenders.push(`${candidate}: ${match[1]}`)
  }
}
check(
  '6b. no shipped artifact imports/requires a src/ path',
  specifierOffenders.length === 0,
  'no module specifier containing src/',
  specifierOffenders.length === 0
    ? `all module specifiers in ${shipped.length} shipped paths are src/-free`
    : JSON.stringify(specifierOffenders),
)

// --- summary ------------------------------------------------------------------
const failed = results.filter((result) => !result.ok)
if (failed.length === 0) {
  report(`PASS: ${results.length}/${results.length} checks passed`)
  process.exit(0)
}
report(`FAIL: ${failed.length}/${results.length} checks failed`)
for (const result of failed) {
  report(`  - ${result.label}`)
  report(`      expected: ${result.expected}`)
  report(`      actual:   ${result.actual}`)
}
process.exit(1)

// --- helpers ------------------------------------------------------------------

/** Record and print one assertion. */
function check(label, ok, expected, actual) {
  results.push({ label, ok: Boolean(ok), expected, actual })
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  console.log(`  FAIL ${label}`)
  console.log(`       expected: ${expected}`)
  console.log(`       actual:   ${actual}`)
}

/** Prefix one line with the script name so interleaved output stays readable. */
function report(line) {
  console.log(`[verify-generated] ${line}`)
}

/**
 * Parse CLI arguments. `--package` overriding the package directory is the
 * documented entry point for running this script against a throwaway copy.
 */
function parseArguments(argv) {
  const parsed = { packageDir: process.env.PERSE_REMOTE_DEV_PACKAGE ?? DEFAULT_PACKAGE_DIR, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      parsed.help = true
    } else if (argument === '--package' || argument === '--package-dir') {
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${argument} needs a directory`)
      parsed.packageDir = resolve(value)
      index += 1
    } else {
      throw new Error(`unknown argument ${argument} (try --help)`)
    }
  }
  parsed.packageDir = resolve(parsed.packageDir)
  return parsed
}

/** Print the supported invocation surface. */
function printUsage() {
  console.log(`Usage: node scripts/verify-generated.mjs [options]

Options:
  --package <dir>   package directory to verify (default: packages/perse-remote-dev)
  --help, -h        print this help

Environment:
  PERSE_REMOTE_DEV_PACKAGE   same as --package (the CLI flag wins)

Exit code 0 only when every check passes; every failure prints the check label,
the expected value and the actual value.`)
}

/** True when `candidate` is an existing regular file. */
function isFile(candidate) {
  return existsSync(candidate) && !readdirSafe(candidate)
}

/** True when `candidate` is a directory (used to reject dirs in isFile). */
function readdirSafe(candidate) {
  try {
    readdirSync(candidate)
    return true
  } catch {
    return false
  }
}

/** Recursively list regular files under `dir`, as posix-relative paths. */
function walkFiles(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, base, out)
    else if (entry.isFile()) out.push(toPosix(relative(base, full)))
  }
  return out
}

/** Normalise a path to forward slashes so glob matching is platform-stable. */
function toPosix(candidate) {
  return candidate.split(sep).join('/')
}

/**
 * Compile one npm-`files[]`-style glob into a RegExp.
 *
 * Supports `**` (any number of path segments), `*` (within one segment) and
 * `?` (one character). Everything else is escaped literally.
 */
function globToRegExp(glob) {
  const normalised = toPosix(glob).replace(/^\.\//, '').replace(/\/+$/, '')
  let pattern = ''
  for (let index = 0; index < normalised.length; index += 1) {
    const character = normalised[index]
    if (character === '*') {
      if (normalised[index + 1] === '*') {
        if (normalised[index + 2] === '/') {
          pattern += '(?:[^/]+/)*'
          index += 2
        } else {
          pattern += '.*'
          index += 1
        }
      } else {
        pattern += '[^/]*'
      }
    } else if (character === '?') {
      pattern += '[^/]'
    } else {
      pattern += character.replace(/[.+^${}()|[\]\\]/, '\\$&')
    }
  }
  return new RegExp(`^${pattern}$`)
}
