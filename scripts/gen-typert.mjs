/**
 * Reproducible Typert codegen.
 *
 * Calls the PUBLISHED `@deepseek-ai/dsh-typert-generator` directly instead of
 * the repo's tsdown plugin. The isolated analysis workspace contains a copy of
 * the plugin Host entry and the exact public Typert protocol declaration input;
 * its temporary node_modules link supplies installed dependencies. The
 * generator's own `validateExport()` runs on every pass: it refuses to emit
 * unless `exports["./typert"]` / `exports["./remote"]` and `files[]` already
 * match the exact paths it writes.
 *
 * Artifacts, named as the generator emits them, and only ever under `<pkg>/lib/`
 * (never `src/`):
 *
 *   lib/typert.host.js
 *   lib/typert.host.d.ts
 *   lib/typert.remote-client.js
 *   lib/typert.remote-client.d.ts
 *   lib/typert.remote-client.d.ts.map
 *
 * Usage: node scripts/gen-typert.mjs
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { WorkspaceTypertGenerator } from '@deepseek-ai/dsh-typert-generator'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FACES = ['host']
const EXPECTED_PACKAGES = ['perse-remote-dev']

const codegenRoot = mkdtempSync(join(tmpdir(), 'perse-remote-typert-codegen-'))
try {
  const packageRoot = join(root, 'packages/perse-remote-dev')
  const isolatedPackageRoot = join(codegenRoot, 'packages/perse-remote-dev')
  const officialProtocolRoot = resolve(dirname(fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-typert-protocol/package.json'))))
  const isolatedProtocolRoot = join(isolatedPackageRoot, '.codegen-dsh-typert-protocol')
  const officialManifest = JSON.parse(readFileSync(join(officialProtocolRoot, 'package.json'), 'utf8'))
  if (officialManifest.name !== '@deepseek-ai/dsh-typert-protocol' || officialManifest.version !== '0.2.1-rc.2' || officialManifest.license !== 'MIT') {
    throw new Error('codegen requires the exact public @deepseek-ai/dsh-typert-protocol@0.2.1-rc.2 MIT package')
  }

  // Typert 0.2.1-rc.2 recognizes metadata declarations only inside registered
  // workspace packages. Build a temporary workspace registration from the
  // exact installed public package metadata and declaration bytes. The actual
  // TypeScript compiler still resolves the normal node_modules package.
  for (const file of ['tsconfig.base.json', 'tsconfig.host.json']) cpSync(join(root, file), join(codegenRoot, file))
  cpSync(join(root, 'vendor'), join(codegenRoot, 'vendor'), { recursive: true })
  cpSync(packageRoot, isolatedPackageRoot, {
    recursive: true,
    filter: path => !path.split('/').includes('node_modules'),
  })
  cpSync(officialProtocolRoot, isolatedProtocolRoot, {
    recursive: true,
    filter: path => path === officialProtocolRoot
      || path === join(officialProtocolRoot, 'package.json')
      || path === join(officialProtocolRoot, 'LICENSE')
      || path === join(officialProtocolRoot, 'lib')
      || path === join(officialProtocolRoot, 'lib/types')
      || path.startsWith(`${join(officialProtocolRoot, 'lib/types')}/`),
  })
  copyDeclarationSources(join(isolatedProtocolRoot, 'lib/types'), join(isolatedProtocolRoot, 'src'))
  // Use one dependency installation for TypeScript's transitive package types.
  // The temporary registration itself remains an ordinary copied workspace.
  const tempNodeModules = join(codegenRoot, 'node_modules')
  const currentNodeModules = join(root, 'node_modules')
  awaitImportSymlink(tempNodeModules, currentNodeModules)

  const packageTsconfigPath = join(isolatedPackageRoot, 'tsconfig.json')
  const packageTsconfig = JSON.parse(readFileSync(packageTsconfigPath, 'utf8'))
  // Host Remote metadata is reachable from the Host entry and its shared wire
  // vocabulary. Do not put browser-only Client implementation files in this
  // Host analysis program; those files are built and checked by the ordinary
  // package tsconfig, but their DSH augmentation graph is unrelated to Host RPC.
  packageTsconfig.include = ['src/index.ts', 'src/types.ts']
  packageTsconfig.compilerOptions.paths['@deepseek-ai/dsh-typert-protocol'] = ['./.codegen-dsh-typert-protocol/src/index.ts']
  writeFileSync(packageTsconfigPath, `${JSON.stringify(packageTsconfig, null, 2)}\n`)
  const baseTsconfigPath = join(codegenRoot, 'tsconfig.base.json')
  const baseTsconfig = JSON.parse(readFileSync(baseTsconfigPath, 'utf8'))
  baseTsconfig.compilerOptions.paths['@deepseek-ai/dsh-typert-protocol'] = ['packages/perse-remote-dev/.codegen-dsh-typert-protocol/src/index.ts']
  // Local native-source symlinks stay external declaration dependencies in the
  // analyzer input; resolving them to workspace source would merge unrelated
  // private package declarations into this isolated published-package run.
  baseTsconfig.compilerOptions.preserveSymlinks = true
  writeFileSync(baseTsconfigPath, `${JSON.stringify(baseTsconfig, null, 2)}\n`)
  const hostTsconfigPath = join(codegenRoot, 'tsconfig.host.json')
  const hostTsconfig = JSON.parse(readFileSync(hostTsconfigPath, 'utf8'))
  // Register the official declaration package before the consumer package. Its
  // nested input path is in the consumer's reachable graph, while this ordering
  // ensures the analyzer assigns those files to their real package metadata.
  hostTsconfig.references = [
    { path: './packages/perse-remote-dev/.codegen-dsh-typert-protocol' },
    { path: './packages/perse-remote-dev' },
  ]
  writeFileSync(hostTsconfigPath, `${JSON.stringify(hostTsconfig, null, 2)}\n`)
  writeFileSync(join(isolatedProtocolRoot, 'tsconfig.json'), `${JSON.stringify({
    extends: '../../../tsconfig.base.json',
    compilerOptions: { noEmit: true },
    include: ['lib/types/**/*.d.ts'],
  }, null, 2)}\n`)

  const declarations = listDeclarationHashes(join(isolatedProtocolRoot, 'lib/types'))
  const metadataHash = hash(readFileSync(join(isolatedProtocolRoot, 'package.json')))
  const licenseHash = hash(readFileSync(join(isolatedProtocolRoot, 'LICENSE')))
  console.log(`[codegen-input] public @deepseek-ai/dsh-typert-protocol@0.2.1-rc.2 MIT; ${declarations.length} declaration files sha256=${hash(JSON.stringify(declarations))}; package.json sha256=${metadataHash}; LICENSE sha256=${licenseHash}`)

  const generator = new WorkspaceTypertGenerator(codegenRoot, {
    // `npm run build` runs tsc before generation. Keep codegen independent of
    // project-reference ordering while retaining Typert semantic checks.
    checkDiagnostics: false,
  })
  const discovered = generator.discover(FACES, manifest => manifest.name === 'perse-remote-dev')
  console.log('discovered:', JSON.stringify(discovered, null, 2))
  const names = discovered.map(entry => entry.package)
  for (const expected of EXPECTED_PACKAGES) {
    if (!names.includes(expected)) throw new Error(`generator did not discover ${expected}; found ${JSON.stringify(names)}`)
  }

  const artifacts = generator.generate(EXPECTED_PACKAGES, FACES)
  const written = []
  for (const artifact of artifacts) {
    const outputPackageRoot = join(root, artifact.packageRoot)
    written.push(emit(outputPackageRoot, `lib/typert.${artifact.face}.js`, artifact.js))
    written.push(emit(outputPackageRoot, `lib/typert.${artifact.face}.d.ts`, artifact.dts))
    if (artifact.remote === undefined) {
      console.log(`note: ${artifact.package} emitted no Remote artifact (no @Remote methods?)`)
      continue
    }
    written.push(emit(outputPackageRoot, 'lib/typert.remote-client.js', artifact.remote.js))
    written.push(emit(outputPackageRoot, 'lib/typert.remote-client.d.ts', artifact.remote.dts))
    written.push(emit(outputPackageRoot, 'lib/typert.remote-client.d.ts.map', artifact.remote.dtsMap))
  }

  console.log(`\nwrote ${written.length} artifact(s):`)
  for (const file of written) console.log(`  ${relative(root, file)}`)
} finally {
  rmSync(codegenRoot, { recursive: true, force: true })
}

/** Write one artifact under the package root, creating `lib/` when it is absent. */
function emit(packageRoot, relativePath, content) {
  const target = join(packageRoot, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
  return target
}

function listDeclarationHashes(directory, base = directory) {
  const output = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) output.push(...listDeclarationHashes(path, base))
    else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      output.push({ path: relative(base, path), sha256: hash(readFileSync(path)) })
    }
  }
  return output.sort((a, b) => a.path.localeCompare(b.path))
}

function copyDeclarationSources(declarationRoot, sourceRoot) {
  for (const entry of readdirSync(declarationRoot, { withFileTypes: true })) {
    const source = join(declarationRoot, entry.name)
    const target = join(sourceRoot, entry.name.replace(/\.d\.ts$/, '.ts'))
    if (entry.isDirectory()) copyDeclarationSources(source, target)
    else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      mkdirSync(dirname(target), { recursive: true })
      cpSync(source, target)
    }
  }
}

function hash(value) { return createHash('sha256').update(value).digest('hex') }

function awaitImportSymlink(path, target) {
  // Avoid platform-specific symlink text escaping and keep the caller synchronous.
  symlinkSync(target, path, 'junction')
}
