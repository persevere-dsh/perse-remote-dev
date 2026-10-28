#!/usr/bin/env node
/** Copy only the frozen native controller's generated public declaration closure. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NATIVE_SOURCE_COMMIT, NATIVE_SOURCE_TREE, NATIVE_TYPE_FILES } from './native-session-type-files.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceArgIndex = process.argv.indexOf('--source')
const sourceRootArg = sourceArgIndex < 0 ? undefined : process.argv[sourceArgIndex + 1]
if (sourceRootArg === undefined) fail('provide --source <frozen isolated DSH checkout>')
const sourceRoot = resolve(sourceRootArg)
const sourcePackage = join(sourceRoot, 'packages/api/session-controller')
const artifactRoot = join(root, 'vendor/native-dsh-session-controller-types')
const manifestPath = join(artifactRoot, 'artifact-manifest.json')
const actualCommit = git(sourceRoot, 'rev-parse', 'HEAD')
const actualTree = git(sourceRoot, 'rev-parse', 'HEAD^{tree}')
if (actualCommit !== NATIVE_SOURCE_COMMIT || actualTree !== NATIVE_SOURCE_TREE) {
  fail(`source checkout must be frozen at ${NATIVE_SOURCE_COMMIT} (${NATIVE_SOURCE_TREE}); found ${actualCommit} (${actualTree})`)
}
if (git(sourceRoot, 'status', '--porcelain', '--untracked-files=no') !== '') fail('source checkout has tracked modifications')
const pkg = JSON.parse(await readFile(join(sourcePackage, 'package.json'), 'utf8'))
if (pkg.name !== '@deepseek-ai/dsh-api-session-controller' || pkg.version !== '0.2.1-rc.2' || pkg.license !== 'MIT') {
  fail('frozen source package name/version/license did not match the expected official owner')
}

await mkdir(artifactRoot, { recursive: true })
const files = []
for (const path of NATIVE_TYPE_FILES) {
  const sourceFile = join(sourcePackage, path)
  const targetFile = join(artifactRoot, path)
  const bytes = await readFile(sourceFile).catch(() => fail(`missing generated declaration ${path}; build the frozen DSH source first`))
  await mkdir(dirname(targetFile), { recursive: true })
  await copyFile(sourceFile, targetFile)
  files.push({ path, sha256: hash(bytes) })
}
const licensePath = join(sourceRoot, 'LICENSE')
await copyFile(licensePath, join(artifactRoot, 'LICENSE'))
const license = await readFile(licensePath)
const manifest = {
  artifact: 'development-only generated declaration input',
  package: `${pkg.name}@${pkg.version}`,
  sourceCommit: actualCommit,
  sourceTree: actualTree,
  generationCommand: 'pnpm run build:lib:client (TypeScript declarations); pnpm run codegen (Typert remote declarations)',
  tools: { node: '24.13.0', pnpm: '11.28.5', typescript: '6.0.3', typertPackageVersion: '0.2.1-rc.2' },
  license: 'MIT',
  copyright: 'DeepSeek',
  licenseSha256: hash(license),
  files,
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`[import-native-types] copied ${files.length} generated declaration files from frozen source ${actualCommit}`)

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
}
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex') }
function fail(message) { console.error(`[import-native-types] ${message}`); process.exit(1) }
