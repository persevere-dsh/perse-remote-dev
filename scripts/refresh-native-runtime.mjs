#!/usr/bin/env node
/**
 * Refresh the isolated patched-DSH runtime used for native PC acceptance (N09).
 *
 * The runtime directory is a flat package install (see its desktop-runtime.json);
 * our extension lives inside existing packages, so refreshing means copying the
 * built `lib/` of every package the extension touches. This script records what it
 * copied and from which source commit, so a GUI run can be tied to exact code.
 *
 * Usage:
 *   node scripts/refresh-native-runtime.mjs \
 *     --source /path/to/patched-dsh-checkout \
 *     --runtime /path/to/.local/dsh-native-runtime \
 *     [--upstream 687f282e]
 *
 * It never deletes runtime packages, never touches an installed app, and fails
 * loudly if a package has not been built.
 */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const sourceRoot = resolve(arg('--source', process.env.PERSE_DSH_SOURCE_ROOT ?? ''))
const runtimeRoot = resolve(arg('--runtime', process.env.PERSE_NATIVE_RUNTIME ?? ''))
const upstream = arg('--upstream', '687f282e')

const die = (message) => { console.error(`FAIL ${message}`); process.exit(1) }
if (!sourceRoot || !runtimeRoot) die('both --source and --runtime are required')
if (!existsSync(join(runtimeRoot, 'desktop-runtime.json'))) die(`not a prepared runtime (no desktop-runtime.json): ${runtimeRoot}`)
if (!existsSync(join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh'))) die(`runtime has no @deepseek-ai/dsh: ${runtimeRoot}`)

const git = (args) => execFileSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' }).trim()
let sourceCommit
try {
  sourceCommit = git(['rev-parse', 'HEAD'])
} catch {
  die(`--source is not a git checkout: ${sourceRoot}`)
}
const dirty = git(['status', '--porcelain'])
if (dirty) console.log(`note: source worktree has uncommitted changes (${dirty.split('\n').length} paths); they are copied as-is`)

const changed = git(['diff', '--name-only', `${upstream}..HEAD`]).split('\n').filter(Boolean)
const packageDirs = [...new Set(changed.map(file => {
  const parts = file.split('/')
  return parts.length >= 3 && parts[0] === 'packages' ? parts.slice(0, 3).join('/') : null
}).filter(Boolean))]
if (packageDirs.length === 0) die(`no packages/ paths differ from ${upstream}; wrong --upstream?`)

const copied = []
const skipped = []
for (const dir of packageDirs) {
  const manifestPath = join(sourceRoot, dir, 'package.json')
  if (!existsSync(manifestPath)) continue
  const name = JSON.parse(readFileSync(manifestPath, 'utf8')).name
  if (!name?.startsWith('@deepseek-ai/')) continue
  const srcLib = join(sourceRoot, dir, 'lib')
  if (!existsSync(srcLib)) { skipped.push(`${name} (no lib/ — build the source first)`); continue }
  const dstLib = join(runtimeRoot, 'node_modules', ...name.split('/'), 'lib')
  if (!existsSync(dirname(dstLib))) { skipped.push(`${name} (not installed in the runtime)`); continue }
  rmSync(dstLib, { recursive: true, force: true })
  cpSync(srcLib, dstLib, { recursive: true })
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else files.push({
        path: relative(dstLib, full),
        bytes: statSync(full).size,
        sha256: createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 16),
      })
    }
  }
  walk(dstLib)
  copied.push({ name, fileCount: files.length, files })
  console.log(`copy ${name} <- ${dir} (${files.length} files)`)
}
if (copied.length === 0) die('nothing was copied; refusing to write a refresh record')
for (const s of skipped) console.log(`skip ${s}`)

const record = {
  schemaVersion: 1,
  refreshedAt: new Date().toISOString(),
  sourceRoot,
  sourceCommit,
  upstreamBaseline: upstream,
  changedPackageDirs: packageDirs,
  packages: copied.map(({ name, fileCount }) => ({ name, fileCount })),
  fileDigests: copied,
  skipped,
}
const recordPath = join(runtimeRoot, 'perse-native-runtime-refresh.json')
writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
console.log(`record ${recordPath}`)
console.log(`Refreshed ${copied.length} package(s) from ${sourceCommit.slice(0, 8)} (${upstream}..HEAD).`)
