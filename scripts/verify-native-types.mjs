#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { NATIVE_TYPE_FILES } from './native-session-type-files.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactRoot = join(root, 'vendor/native-dsh-session-controller-types')
const manifestPath = join(artifactRoot, 'artifact-manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const expectedPaths = new Set([...NATIVE_TYPE_FILES, 'LICENSE', 'artifact-manifest.json'])
const actualPaths = await listFiles(artifactRoot)
if (actualPaths.length !== expectedPaths.size || actualPaths.some(path => !expectedPaths.has(path))) {
  throw new Error(`native type artifact has a non-allowlisted file: ${actualPaths.filter(path => !expectedPaths.has(path)).join(', ')}`)
}
if (manifest.sourceCommit !== 'b9e77c1316dd54245062419f6fd6d8c13f247214'
  || manifest.sourceTree !== 'ccf24e58defd055d0912070f425e791fa4e7b300'
  || manifest.package !== '@deepseek-ai/dsh-api-session-controller@0.2.1-rc.2'
  || manifest.license !== 'MIT'
  || JSON.stringify(manifest.files.map(file => file.path).sort()) !== JSON.stringify(NATIVE_TYPE_FILES.toSorted())) {
  throw new Error('native type artifact provenance or file allowlist does not match the frozen source')
}
const license = await readFile(join(artifactRoot, 'LICENSE'), 'utf8')
if (!license.includes('MIT License') || !license.includes('DeepSeek')) throw new Error('native type artifact is missing its MIT/DeepSeek license notice')
const fileRecords = new Map(manifest.files.map(file => [file.path, file.sha256]))
for (const path of NATIVE_TYPE_FILES) {
  const bytes = await readFile(join(artifactRoot, path))
  if (hash(bytes) !== fileRecords.get(path)) throw new Error(`native type artifact hash mismatch: ${path}`)
}
if (hash(await readFile(join(artifactRoot, 'LICENSE'))) !== manifest.licenseSha256) throw new Error('native type artifact license hash mismatch')

const config = ts.readConfigFile(join(root, 'tsconfig.base.json'), ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const rootFiles = NATIVE_TYPE_FILES.map(path => resolve(artifactRoot, path))
const visited = new Set()
const pending = [...rootFiles]
while (pending.length > 0) {
  const containingFile = pending.pop()
  if (containingFile === undefined || visited.has(containingFile)) continue
  visited.add(containingFile)
  const source = ts.createSourceFile(containingFile, await readFile(containingFile, 'utf8'), ts.ScriptTarget.Latest, true)
  const imports = []
  source.forEachChild(node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text)
    }
  })
  for (const specifier of imports) {
    const resolution = ts.resolveModuleName(specifier, containingFile, parsedConfig.options, ts.sys).resolvedModule
    if (resolution === undefined) throw new Error(`unresolved generated declaration import ${specifier} from ${relative(root, containingFile)}`)
    if (resolution.resolvedFileName.startsWith(`${artifactRoot}${sep}`)) pending.push(resolution.resolvedFileName)
  }
}
console.log(`[verify-native-types] verified ${NATIVE_TYPE_FILES.length} frozen declarations, hashes, license and ${visited.size} resolved declaration files`)

async function listFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(path)).map(child => join(entry.name, child)))
    else if (entry.isFile()) files.push(entry.name)
    else throw new Error(`non-regular file in native type artifact: ${path}`)
  }
  return files
}

function hash(bytes) { return createHash('sha256').update(bytes).digest('hex') }
