#!/usr/bin/env node
// Loads the actual candidate browser bundle through the frozen DSH ClientModuleSystem.
// No production app, profile, GUI, or live gateway is involved.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const nativeRoot = resolve(process.env.PERSE_DSH_SOURCE_ROOT ?? resolve(workspaceRoot, '../dsh-remote-native-integration'))
const expectedCommit = 'b9e77c1316dd54245062419f6fd6d8c13f247214'
const expectedTree = 'ccf24e58defd055d0912070f425e791fa4e7b300'
const actualCommit = execFileSync('git', ['-C', nativeRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const actualTree = execFileSync('git', ['-C', nativeRoot, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
assert.equal(actualCommit, expectedCommit, 'the test must use the frozen native DSH source commit')
assert.equal(actualTree, expectedTree, 'the test must use the frozen native DSH source tree')

// The actual Web seed imports CSS that Node cannot load. Replace only CSS assets
// with empty style maps; the DSH seed table, module system, candidate bundle, and
// dynamic package bundles remain the actual frozen/built implementations.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export default {}', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

const nativeUrl = (relativePath) => pathToFileURL(resolve(nativeRoot, relativePath)).href
const { getStaticModules } = await import(nativeUrl('packages/client/web/src/seed.ts'))
const { PLATFORM_MODULES: frozenPlatformModules } = await import(nativeUrl('packages/client/web/src/platform.ts'))
const { createClientModuleSystem } = await import(nativeUrl('packages/client/modules/src/client/index.ts'))
const actualSeed = getStaticModules()
assert.deepEqual(Object.keys(actualSeed).sort(), [...frozenPlatformModules].sort(), 'real shell seed exports match real platform words')

const clientConfig = await readFile(resolve(workspaceRoot, 'tsdown.client.config.ts'), 'utf8')
const configBlock = clientConfig.match(/PLATFORM_MODULES\s*=\s*\[([\s\S]*?)\]/)
assert.ok(configBlock, 'browser bundler config has no frozen seed declaration')
const configuredSeed = [...configBlock[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1])
assert.deepEqual(configuredSeed, [...frozenPlatformModules], 'bundle externals use the frozen DSH shell seed vocabulary verbatim')

const apiGatewayId = '@deepseek-ai/dsh-api-gateway'
const sessionControllerId = '@deepseek-ai/dsh-api-session-controller'
const pluginId = 'perse-remote-dev'
const entries = [
  { id: apiGatewayId, url: '/fixture/dsh-api-gateway/client.js?rev=1', rev: '1' },
  {
    id: sessionControllerId,
    url: '/fixture/dsh-api-session-controller/client.js?rev=1',
    rev: '1',
    inject: [apiGatewayId],
    external: [`${apiGatewayId}/client`],
  },
  {
    id: pluginId,
    url: '/fixture/perse-remote-dev/client.js?rev=1',
    rev: '1',
    inject: [sessionControllerId],
    external: [`${sessionControllerId}/client`],
  },
]
const bundleUrl = '/fixture/application.js?rev=application'
const boot = {
  rev: 'fixture-graph',
  entries,
  batches: [{ phase: 'application', url: bundleUrl, rev: 'application', entries: entries.map(({ id }) => id) }],
}

const pendingQueue = []
const target = {
  mode: 'queue',
  pendingQueue,
  load(registration) { pendingQueue.push(registration) },
  create(options) { return createClientModuleSystem(target, { id: '@deepseek-ai/dsh-client-modules', exports: {} }, options) },
}
globalThis.window = { __ModuleLoader__: target }

const bundlePaths = [
  'packages/api/gateway/lib/client.browser.js',
  'packages/api/session-controller/lib/client.js',
].map(path => resolve(nativeRoot, path))
const candidatePath = resolve(workspaceRoot, 'packages/perse-remote-dev/client.js')
const candidateSource = await readFile(candidatePath, 'utf8')
const candidateRequires = [...new Set(
  [...candidateSource.matchAll(/\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g)].map(match => match[1]),
)].sort()
const packageManifest = JSON.parse(await readFile(resolve(workspaceRoot, 'packages/perse-remote-dev/package.json'), 'utf8'))
const dynamicExternals = packageManifest.dsh?.client?.external ?? []
assert.ok(packageManifest.dsh?.client?.inject?.includes(sessionControllerId), 'the client manifest must inject the package that supplies its dynamic external')
assert.deepEqual(dynamicExternals, [`${sessionControllerId}/client`], 'session controller is the only package-specific external')
const modules = target.create({
  boot,
  staticModules: actualSeed,
  loadBundle: async requestedUrl => {
    assert.equal(requestedUrl, bundleUrl, 'module loader should request the single composed fixture batch')
    const source = [...await Promise.all([...bundlePaths, candidatePath].map(path => readFile(path, 'utf8')))].join('\n')
    runInThisContext(source, { filename: 'frozen-dsh-and-perse-client-fixture.js' })
  },
})

const plugin = await modules.import(pluginId)
assert.equal(typeof plugin.apply, 'function', 'candidate browser package materialized through the actual DSH loader')
assert.ok(modules.loadCache.has(sessionControllerId), 'actual native session-controller client row materialized')
assert.ok(modules.loadCache.has(apiGatewayId), 'actual gateway client row materialized transitively')

const pluginEdges = [...(modules.loadCache.get(pluginId)?.edges ?? [])].sort()
assert.deepEqual(pluginEdges, candidateRequires, 'the production module loader observed every real candidate require')
assert.ok(pluginEdges.every(specifier => Object.hasOwn(actualSeed, specifier) || dynamicExternals.includes(specifier)))
assert.ok(!pluginEdges.includes('@deepseek-ai/dsh-typert-protocol'), 'Typert protocol is included in the candidate bundle, not requested from the shell table')

console.log(JSON.stringify({
  frozenDshCommit: actualCommit,
  frozenDshTree: actualTree,
  shellSeedEntries: frozenPlatformModules.length,
  materializedRows: [apiGatewayId, sessionControllerId, pluginId],
  pluginRuntimeRequires: pluginEdges,
  result: 'candidate client bundle materialized through frozen DSH ClientModuleSystem',
}))
