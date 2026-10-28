#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const pluginRoot = join(repoRoot, 'packages/perse-remote-dev')
const installedModules = join(repoRoot, 'node_modules')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'perse-remote-packed-consumer-'))
try {
  const positivePackage = await packWorkspacePlugin()
  const positive = await installPackedConsumer(positivePackage, 'positive')
  assert.equal(positive.diagnostics.length, 0, formatDiagnostics(positive.diagnostics))
  assert.ok(positive.packageManifest.dependencies['@deepseek-ai/cosmokit'], 'the published manifest must declare its public type dependency')

  // Negative control: repack an isolated projection with that one direct
  // declaration removed. Its transitive parent packages still retain their
  // own nested, real dependencies, so this fails only if the plugin's public
  // declaration imports an undeclared package directly.
  const negativeSource = join(temporaryRoot, 'negative-source')
  cpSync(positive.packageRoot, negativeSource, { recursive: true, dereference: true })
  const negativeManifest = readJson(join(negativeSource, 'package.json'))
  delete negativeManifest.dependencies['@deepseek-ai/cosmokit']
  writeFileSync(join(negativeSource, 'package.json'), `${JSON.stringify(negativeManifest, null, 2)}\n`)
  const negativePackage = await packDirectory(negativeSource, join(temporaryRoot, 'negative-pack'))
  const negative = await installPackedConsumer(negativePackage, 'negative')
  assert.ok(
    negative.diagnostics.some((diagnostic) => diagnostic.code === 2307 && diagnostic.message.includes("'@deepseek-ai/cosmokit'")),
    `negative control did not expose TS2307 for @deepseek-ai/cosmokit:\n${formatDiagnostics(negative.diagnostics)}`,
  )

  await verifyTransitivePeerTopology()

  console.log(`[packed-consumer] ${positive.archiveName}: ${positive.fileCount} files; TypeScript ${ts.version} strict consumer declaration graph resolved`)
  console.log('[packed-consumer] negative control: removing @deepseek-ai/cosmokit from the isolated manifest produces TS2307 as expected')
  console.log('[packed-consumer] peer topology: absent unused transitive peer is tolerated; a .d.ts import produces TS2307; required dependency wins direct/transitive overlaps; optionalDependencies override is preserved')
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}

async function packWorkspacePlugin() {
  const packRoot = join(temporaryRoot, 'positive-pack')
  mkdirSync(packRoot)
  const packed = await packDirectory(pluginRoot, packRoot, true)
  assert.ok(packed.fileList.some((file) => file === 'lib/types/settings.d.ts'), 'TGZ omits lib/types/settings.d.ts')
  return packed
}

async function packDirectory(directory, packDestination, workspace = false) {
  mkdirSync(packDestination, { recursive: true })
  const args = workspace
    ? ['pack', '--workspace', 'perse-remote-dev', '--pack-destination', packDestination, '--ignore-scripts', '--json']
    : ['pack', directory, '--pack-destination', packDestination, '--ignore-scripts', '--json']
  const json = execFileSync('npm', args, { cwd: repoRoot, encoding: 'utf8' })
  const [packed] = JSON.parse(json)
  assert.ok(packed?.filename, 'npm pack did not report a tarball')
  return {
    archivePath: join(packDestination, packed.filename),
    archiveName: packed.filename,
    fileCount: packed.files.length,
    fileList: packed.files.map((file) => file.path),
  }
}

async function installPackedConsumer(archive, label) {
  const consumerRoot = join(temporaryRoot, `${label}-consumer`)
  const modulesRoot = join(consumerRoot, 'node_modules')
  mkdirSync(modulesRoot, { recursive: true })
  execFileSync('tar', ['-xzf', archive.archivePath, '-C', modulesRoot], { stdio: 'ignore' })
  const packageRoot = join(modulesRoot, 'package')
  const installedPackageRoot = join(modulesRoot, 'perse-remote-dev')
  renameSync(packageRoot, installedPackageRoot)

  const packageManifest = readJson(join(installedPackageRoot, 'package.json'))
  const direct = new Set([
    ...Object.keys(packageManifest.dependencies ?? {}),
    ...Object.keys(packageManifest.optionalDependencies ?? {}),
    ...Object.keys(packageManifest.peerDependencies ?? {}),
  ])
  for (const name of [...direct].sort()) {
    projectPackage(name, installedModules, modulesRoot, new Map(), missingPolicy(packageManifest, name, true))
  }

  const consumerFile = join(consumerRoot, 'consumer.ts')
  writeFileSync(consumerFile, [
    "import type { RemoteWorkspaceService } from 'perse-remote-dev'",
    'declare const service: RemoteWorkspaceService',
    "declare const signal: Parameters<RemoteWorkspaceService['readConfiguration']>[1]",
    'void service.readConfiguration({ includeCandidates: false }, signal)',
    '',
  ].join('\n'))
  const compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    allowImportingTsExtensions: true,
    types: [],
  }
  const program = ts.createProgram([consumerFile], compilerOptions)
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    file: diagnostic.file?.fileName,
    start: diagnostic.start,
  }))
  return { archiveName: archive.archiveName, fileCount: archive.fileCount, packageRoot: installedPackageRoot, packageManifest, diagnostics }
}

function projectPackage(name, fromRoot, installRoot, seen, missing = 'error') {
  const actualRoot = resolveInstalledPackage(name, fromRoot)
  if (actualRoot === undefined) {
    if (missing === 'allow') return
    throw new Error(`declared dependency ${name} is not installed by the clean npm-ci workspace`)
  }
  const actualRealRoot = realpathSync(actualRoot)
  const destination = join(installRoot, ...name.split('/'))
  const key = `${name}\0${actualRealRoot}`
  if (existsSync(destination)) return
  const known = seen.get(key)
  if (known !== undefined) {
    mkdirSync(dirname(destination), { recursive: true })
    symlinkSync(known, destination, 'dir')
    return
  }

  mkdirSync(dirname(destination), { recursive: true })
  cpSync(actualRealRoot, destination, {
    recursive: true,
    dereference: true,
    filter: (sourcePath) => {
      const rel = relative(actualRealRoot, sourcePath)
      return rel === '' || (!rel.split(sep).includes('node_modules') && !rel.split(sep).includes('.git'))
    },
  })
  seen.set(key, destination)
  const manifest = readJson(join(destination, 'package.json'))
  const descendants = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  }
  for (const child of Object.keys(descendants).sort()) {
    // A package's peerDependencies describe its host environment; they are
    // not all guaranteed to be installed in this workspace. Copy a peer when
    // npm actually installed it, but do not manufacture the host's entire
    // peer graph here. If a public declaration imports an absent peer, the
    // strict consumer compiler below must report TS2307. Package dependencies
    // remain mandatory, and optionalDependencies/optional peers may be absent.
    projectPackage(child, actualRealRoot, join(destination, 'node_modules'), seen, missingPolicy(manifest, child, false))
  }
}

function missingPolicy(manifest, name, isPackageRoot) {
  // npm treats optionalDependencies as overrides of dependencies with the
  // same name. Otherwise, a required dependency always wins over any peer
  // declaration/optional-peer metadata for that same package.
  if (manifest.optionalDependencies?.[name] !== undefined) return 'allow'
  if (manifest.dependencies?.[name] !== undefined) return 'error'
  if (manifest.peerDependencies?.[name] !== undefined) {
    if (!isPackageRoot) return 'allow'
    return manifest.peerDependenciesMeta?.[name]?.optional === true ? 'allow' : 'error'
  }
  return 'error'
}

async function verifyTransitivePeerTopology() {
  const fixtureSource = join(temporaryRoot, 'peer-topology-source')
  const installedModules = join(fixtureSource, 'node_modules')
  const peerPackage = join(installedModules, '@fixture/peer-parent')
  mkdirSync(peerPackage, { recursive: true })
  writeFileSync(join(peerPackage, 'package.json'), `${JSON.stringify({
    name: '@fixture/peer-parent',
    version: '1.0.0',
    main: 'index.js',
    types: 'index.d.ts',
    peerDependencies: { '@fixture/host-only': '^1.0.0' },
  }, null, 2)}\n`)
  writeFileSync(join(peerPackage, 'index.js'), 'module.exports = {}\n')
  writeFileSync(join(peerPackage, 'index.d.ts'), 'export interface PublicValue { value: string }\n')

  const consumerRoot = join(temporaryRoot, 'peer-topology-consumer')
  const projectedModules = join(consumerRoot, 'node_modules')
  projectPackage('@fixture/peer-parent', installedModules, projectedModules, new Map(), 'error')
  const consumerFile = join(consumerRoot, 'consumer.ts')
  writeFileSync(consumerFile, [
    "import type { PublicValue } from '@fixture/peer-parent'",
    'declare const value: PublicValue',
    'void value.value',
    '',
  ].join('\n'))
  assert.deepEqual(compileConsumer(consumerFile), [], 'unused missing transitive peer should not invalidate the actual declaration closure')

  writeFileSync(join(peerPackage, 'index.d.ts'), [
    "import type { HostValue } from '@fixture/host-only'",
    'export interface PublicValue { host: HostValue }',
    '',
  ].join('\n'))
  const importingConsumerRoot = join(temporaryRoot, 'peer-topology-importing-consumer')
  const importingModules = join(importingConsumerRoot, 'node_modules')
  projectPackage('@fixture/peer-parent', installedModules, importingModules, new Map(), 'error')
  const importingFile = join(importingConsumerRoot, 'consumer.ts')
  writeFileSync(importingFile, [
    "import type { PublicValue } from '@fixture/peer-parent'",
    'declare const value: PublicValue',
    'void value.host',
    '',
  ].join('\n'))
  const diagnostics = compileConsumer(importingFile)
  assert.ok(
    diagnostics.some(diagnostic => diagnostic.code === 2307 && diagnostic.message.includes("'@fixture/host-only'")),
    `referenced missing transitive peer must remain a strict TS2307 failure:\n${formatDiagnostics(diagnostics)}`,
  )

  await verifyOverlappingDependencyPolicies(installedModules)
}

async function verifyOverlappingDependencyPolicies(installedModules) {
  const overlapName = '@fixture/missing-required-overlap'
  const directFixtureRoot = join(temporaryRoot, 'direct-overlap-source')
  mkdirSync(directFixtureRoot, { recursive: true })
  writeFileSync(join(directFixtureRoot, 'package.json'), `${JSON.stringify({
    name: 'direct-overlap-fixture',
    version: '1.0.0',
    dependencies: { [overlapName]: '^1.0.0' },
    peerDependencies: { [overlapName]: '^1.0.0' },
    peerDependenciesMeta: { [overlapName]: { optional: true } },
  }, null, 2)}\n`)
  const directManifest = readJson(join(directFixtureRoot, 'package.json'))
  assert.equal(missingPolicy(directManifest, overlapName, true), 'error')
  assert.throws(
    () => projectPackage(overlapName, installedModules, join(temporaryRoot, 'direct-overlap-consumer', 'node_modules'), new Map(), missingPolicy(directManifest, overlapName, true)),
    /declared dependency @fixture\/missing-required-overlap is not installed/,
    'a direct required dependency must not become optional because it is also an optional peer',
  )

  const transitiveSource = join(temporaryRoot, 'transitive-overlap-source')
  const transitiveModules = join(transitiveSource, 'node_modules')
  const parentRoot = join(transitiveModules, '@fixture/transitive-overlap-parent')
  mkdirSync(parentRoot, { recursive: true })
  writeFileSync(join(parentRoot, 'package.json'), `${JSON.stringify({
    name: '@fixture/transitive-overlap-parent',
    version: '1.0.0',
    main: 'index.js',
    dependencies: { [overlapName]: '^1.0.0' },
    peerDependencies: { [overlapName]: '^1.0.0' },
    peerDependenciesMeta: { [overlapName]: { optional: true } },
  }, null, 2)}\n`)
  writeFileSync(join(parentRoot, 'index.js'), 'module.exports = {}\n')
  const parentManifest = readJson(join(parentRoot, 'package.json'))
  assert.equal(missingPolicy(parentManifest, overlapName, false), 'error')
  assert.throws(
    () => projectPackage('@fixture/transitive-overlap-parent', transitiveModules, join(temporaryRoot, 'transitive-overlap-consumer', 'node_modules'), new Map(), 'error'),
    /declared dependency @fixture\/missing-required-overlap is not installed/,
    'a transitive required dependency must not become optional because it is also a peer',
  )

  const npmOptionalName = '@fixture/missing-npm-optional-overlap'
  const npmOptionalManifest = {
    dependencies: { [npmOptionalName]: '^1.0.0' },
    optionalDependencies: { [npmOptionalName]: '^1.0.0' },
  }
  assert.equal(missingPolicy(npmOptionalManifest, npmOptionalName, true), 'allow')
  assert.doesNotThrow(
    () => projectPackage(npmOptionalName, installedModules, join(temporaryRoot, 'npm-optional-overlap-consumer', 'node_modules'), new Map(), missingPolicy(npmOptionalManifest, npmOptionalName, true)),
    'npm optionalDependencies must retain override semantics when also listed as a dependency',
  )
}

function compileConsumer(consumerFile) {
  const compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    allowImportingTsExtensions: true,
    types: [],
  }
  const program = ts.createProgram([consumerFile], compilerOptions)
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    file: diagnostic.file?.fileName,
    start: diagnostic.start,
  }))
}

function resolveInstalledPackage(name, fromRoot) {
  try {
    const resolver = createRequire(join(fromRoot, 'package.json'))
    const entry = resolver.resolve(name)
    let directory = dirname(entry)
    while (directory !== dirname(directory)) {
      const manifestPath = join(directory, 'package.json')
      if (existsSync(manifestPath)) {
        const manifest = readJson(manifestPath)
        if (manifest.name === name) return directory
      }
      directory = dirname(directory)
    }
  } catch {}
  if (fromRoot !== installedModules) return resolveInstalledPackage(name, installedModules)
  return undefined
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function formatDiagnostics(diagnostics) {
  return diagnostics.map((diagnostic) => `${diagnostic.file ?? '<compiler>'}: TS${diagnostic.code} ${diagnostic.message}`).join('\n')
}
