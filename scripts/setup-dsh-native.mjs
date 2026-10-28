#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceArg = process.argv.find((arg, index) => process.argv[index - 1] === '--source')
const configuredSourceRoot = sourceArg ?? process.env.PERSE_DSH_SOURCE_ROOT
if (!configuredSourceRoot) fail('provide --source <isolated-dsh-checkout> or set PERSE_DSH_SOURCE_ROOT')
const sourceRoot = resolve(configuredSourceRoot)
const links = [
  ['packages/api/session-controller', '@deepseek-ai/dsh-api-session-controller', ['lib/client.js', 'lib/types/client/index.d.ts']],
  ['packages/core/session', '@deepseek-ai/dsh-session', ['lib/types/index.d.ts']],
  ['packages/llm/llm', '@deepseek-ai/dsh-llm', ['lib/types/brand.d.ts']],
  ['packages/attachment/attachment', '@deepseek-ai/dsh-attachment', ['lib/types/types.d.ts']],
]

if (!existsSync(sourceRoot)) fail(`DSH source root does not exist: ${sourceRoot}`)
const actualSourceRoot = realpathSync(sourceRoot)

for (const [relativePath, expectedName, artifacts] of links) {
  const target = join(actualSourceRoot, relativePath)
  const manifestPath = join(target, 'package.json')
  if (!existsSync(manifestPath)) fail(`missing package manifest: ${manifestPath}`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== expectedName || manifest.version !== '0.2.1-rc.2') {
    fail(`${relativePath} must be ${expectedName}@0.2.1-rc.2; found ${manifest.name}@${manifest.version}`)
  }
  for (const artifact of artifacts) {
    if (!existsSync(join(target, artifact))) fail(`missing built artifact ${join(target, artifact)}; build the isolated DSH source first`)
  }
}

const protocolManifest = join(repoRoot, 'node_modules', '@deepseek-ai', 'dsh-typert-protocol', 'package.json')
if (!existsSync(protocolManifest)) fail('install workspace dependencies before setup (missing @deepseek-ai/dsh-typert-protocol)')
const protocol = JSON.parse(readFileSync(protocolManifest, 'utf8'))
if (protocol.version !== '0.2.1-rc.2') fail(`workspace protocol dependency must be 0.2.1-rc.2; found ${protocol.version}`)

const scopePath = join(repoRoot, 'node_modules', '@deepseek-ai')
mkdirSync(scopePath, { recursive: true })
for (const [relativePath, packageName] of links) {
  const target = join(actualSourceRoot, relativePath)
  const linkPath = join(scopePath, packageName.slice('@deepseek-ai/'.length))
  if (existsSync(linkPath) || lstatMaybe(linkPath)) {
    if (!lstatSync(linkPath).isSymbolicLink() || realpathSync(linkPath) !== realpathSync(target)) {
      fail(`${linkPath} already exists and does not point to ${target}; remove or move it explicitly before setup`)
    }
    console.log(`ok   ${packageName} -> ${target}`)
  } else {
    symlinkSync(target, linkPath, 'dir')
    console.log(`link ${packageName} -> ${target}`)
  }
}
console.log(`Ready to typecheck against isolated DSH ${actualSourceRoot}`)

function lstatMaybe(path) {
  try { lstatSync(path); return true } catch { return false }
}

function fail(message) {
  console.error(`[setup-dsh-native] ${message}`)
  process.exit(1)
}
