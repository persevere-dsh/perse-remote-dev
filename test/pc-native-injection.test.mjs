import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'

const root = new URL('../', import.meta.url)
const source = readFileSync(new URL('packages/perse-remote-dev/src/client/index.ts', root), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('packages/perse-remote-dev/package.json', root), 'utf8'))
const clientBundle = readFileSync(new URL('packages/perse-remote-dev/client.js', root), 'utf8')

test('PC settings waits for DSH sessions activation before checking optional native APIs', async () => {
  const pluginConfig = source.match(/name:\s*'remote-dev-client\/connection-settings',[\s\S]*?inject:\s*\[([^\]]+)\]/)
  assert.ok(pluginConfig, 'connection-settings plugin registration must declare its dependencies')
  const dependencies = [...pluginConfig[1].matchAll(/'([^']+)'/g)].map(match => match[1])
  assert.ok(dependencies.includes('sessions'), 'the child plugin must wait for sessions activation')

  const ctx = new Context()
  let nativeSupport
  const plugin = ctx.plugin({
    inject: dependencies,
    apply(scope) {
      const sessions = scope.get('sessions')
      nativeSupport = typeof sessions.registerExternalBackend === 'function'
    },
  })
  await Promise.resolve()
  assert.equal(nativeSupport, undefined, 'settings integration must not inspect an inactive sessions service')

  ctx.provide('slots', {})
  ctx.provide('remote.remoteDev', {})
  await Promise.resolve()
  assert.equal(nativeSupport, undefined, 'other dependencies must not activate the child early')

  ctx.provide('sessions', { registerExternalBackend() {} })
  await Promise.resolve()
  assert.equal(nativeSupport, undefined, 'native integration must wait for the locale dependency too')
  ctx.provide('locale', { bind() {} })
  await plugin
  assert.equal(nativeSupport, true, 'the extension API is checked after sessions activation')
  await ctx.root.fiber.dispose()
})

test('client manifest injects the DSH session API and externalizes only its dynamic module', () => {
  const injected = manifest.dsh.client.inject
  const external = manifest.dsh.client.external
  assert.ok(injected.includes('@deepseek-ai/dsh-api-session-controller'))
  assert.ok(!injected.includes('@deepseek-ai/dsh-api-session-controller/client'))
  assert.ok(external.includes('@deepseek-ai/dsh-api-session-controller/client'))
  assert.ok(!external.includes('@deepseek-ai/dsh-typert-protocol'), 'Typert protocol is inline-safe and is not in the frozen shell seed')
  assert.match(clientBundle, /require\(["']@deepseek-ai\/dsh-api-session-controller\/client["']\)/, 'the dynamic session-controller row remains an external module')
  assert.doesNotMatch(clientBundle, /require\(["']@deepseek-ai\/dsh-typert-protocol["']\)/, 'Typert protocol must not be requested as a bare external')
})

test('old DSH ISessions shapes remain connection-only while the extension registry is accepted', async () => {
  const { hasExternalSessionsApi } = await import('../packages/perse-remote-dev/src/client/native-sessions/registry-compat.ts')
  const oldSessions = { retain() {}, list() {} }
  const observable = { getSnapshot() { return [] }, subscribe() { return () => {} } }
  const requiredRegistry = {
    externalCatalog: observable,
    retainedBindings: observable,
    registerExternalBackend() {}, createExternalSession() {}, respondExternalApproval() {},
    externalAddressOf() {}, externalIdentityOf() {}, retain() {}, using() {},
  }
  assert.equal(hasExternalSessionsApi(oldSessions), false)
  assert.equal(hasExternalSessionsApi({ registerExternalBackend() {}, createExternalSession() {}, retain() {} }), false, 'partial extensions must stay connection-only')
  assert.equal(hasExternalSessionsApi({ ...requiredRegistry, externalCatalog: {} }), false, 'missing observable contracts must stay connection-only')
  assert.equal(hasExternalSessionsApi(requiredRegistry), true)
  assert.match(source, /const sessions = ctx\.get\('sessions'\) as ExternalSessionsRegistry/)
  assert.match(source, /const nativeSessions = new PcNativeSessionIntegration\(\{ sessions, controller, remote \}\)/)
})
