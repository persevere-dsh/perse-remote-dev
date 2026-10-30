/**
 * Regression (2026-10-30): a legacy stored profiles.json — written by an older
 * plugin with `status:"connected"`, `protocolVersion:"1.2"` and no new fields —
 * must still load, still auto-reconnect at launch, and still list the host,
 * against a host that never advertises v1.3 model capabilities (model.list /
 * session.setModel answer -32601). A store that fails to load must log one
 * structured line naming the file path and failure class, never the token.
 */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

const nativeClientPath = new URL('./fixtures/native-session-controller-client.mjs', import.meta.url).href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-api-session-controller/client') return { url: nativeClientPath, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
const { PcBridge } = await import('../packages/perse-remote-dev/src/pc/bridge.ts')
const { PcProfileStore } = await import('../packages/perse-remote-dev/src/pc/profile-store.ts')
const { createPcConnectionController } = await import('../packages/perse-remote-dev/src/client/connections/controller.ts')
const { PcNativeSessionIntegration } = await import('../packages/perse-remote-dev/src/client/native-sessions/integration.ts')

const canonicalTmp = await realpath(tmpdir())

// A real Perse Remote 0.3.0 host: protocol 1.2, no modelList/modelSelect.
async function legacyGateway() {
  const hostId = randomUUID()
  const seenMethods = []
  const upgrades = []
  const server = createServer((_, response) => { response.writeHead(404).end() })
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (request, socket, head) => {
    upgrades.push(request.headers.authorization)
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws))
  })
  wss.on('connection', (socket) => {
    socket.on('message', (frame) => {
      const rpc = JSON.parse(frame.toString())
      seenMethods.push(rpc.method)
      if (rpc.method === 'host.info') {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {
          protocolVersion: '1.2', host: { id: hostId, name: 'lxldeMac-mini.local', platform: 'darwin' },
          capabilities: [], providers: [], workspaces: [],
        } }))
      } else if (rpc.method === 'workspace.list') {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {
          workspaces: [{ id: 'integration-workspace', name: 'integration-workspace' }],
        } }))
      } else if (rpc.method === 'session.list') {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { sessions: [], nextCursor: null } }))
      } else if (rpc.method === 'model.list' || rpc.method === 'session.setModel') {
        // Exactly what the older gateway answers: the method does not exist.
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'unknown method' } }))
      } else {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { events: [], retentionFloor: 1 } }))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const endpoint = `ws://127.0.0.1:${server.address().port}/rpc`
  return {
    hostId, endpoint, seenMethods, upgrades,
    close: () => new Promise((resolve) => { wss.close(() => server.close(resolve)) }),
  }
}

// Byte-for-byte legacy document: no autoConnect, protocolVersion 1.2, verifiedAt.
function legacyDocument(gateway, token) {
  return JSON.stringify({ version: 1, profiles: [{
    profileId: '9e36c386-cca9-432d-bee5-7eaa03a1e68d',
    endpoint: gateway.endpoint, networkMode: 'local',
    hostId: gateway.hostId, hostName: 'lxldeMac-mini.local',
    deviceId: '385ec965-6e54-4662-8386-63363b4cc1a8',
    deviceName: 'PC phase4 validation', token,
    status: 'connected', protocolVersion: '1.2', verifiedAt: '2026-10-30T02:36:33.280Z',
  }] })
}

async function storedHome(t, contents) {
  const home = await mkdtemp(join(canonicalTmp, 'pc-legacy-restore-'))
  await chmod(home, 0o700)
  const directory = join(home, 'remote-dev', 'pc-profiles')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(join(directory, 'profiles.json'), contents, { mode: 0o600 })
  t.after(() => rm(home, { recursive: true, force: true }))
  return { home, file: join(directory, 'profiles.json') }
}

function remoteFor(bridge) {
  return {
    pcProfiles: async () => {
      try { return { ok: true, value: { profiles: await bridge.profiles() } } }
      catch (error) { return { ok: false, error } }
    },
    pcPairPreview: async () => ({ ok: false, error: new Error('unused') }),
    pcPairConfirm: async () => ({ ok: false, error: new Error('unused') }),
    pcConnect: async ({ profileId }) => {
      try { return { ok: true, value: await bridge.connect(profileId, new AbortController().signal) } }
      catch (error) { return { ok: false, error } }
    },
    pcDisconnect: async ({ profileId }) => ({ ok: true, value: await bridge.disconnect(profileId) }),
    pcForget: async ({ profileId }) => ({ ok: true, value: await bridge.forget(profileId) }),
    pcRevoke: async () => ({ ok: true, value: {} }),
    pcCall: async ({ profileId, generation, method, paramsJson }) => {
      try {
        return { ok: true, value: { resultJson: await bridge.call({ profileId, generation, method, paramsJson }, new AbortController().signal) } }
      } catch (error) { return { ok: false, error } }
    },
  }
}

function registryHarness() {
  const registrations = []
  return {
    registrations,
    registry: {
      externalCatalog: { getSnapshot: () => [], subscribe: () => () => {} },
      retainedBindings: { getSnapshot: () => [], subscribe: () => () => {} },
      registerExternalBackend(backend) {
        registrations.push(backend)
        return () => { const index = registrations.indexOf(backend); if (index >= 0) registrations.splice(index, 1) }
      },
      async createExternalSession() { return {} },
      respondExternalApproval() {}, externalAddressOf() {}, externalIdentityOf() {}, retain() {}, using() {},
    },
  }
}

function waitUntil(predicate, timeoutMs = 5000) {
  const start = Date.now()
  return (async () => {
    for (;;) {
      if (await predicate()) return
      if (Date.now() - start > timeoutMs) throw new Error('condition timed out')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  })()
}

test('legacy stored profile auto-reconnects a modelless 1.2 host and lists it as online', async (t) => {
  const gateway = await legacyGateway()
  const token = randomBytes(32).toString('base64url')
  const { home } = await storedHome(t, legacyDocument(gateway, token))
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const remote = remoteFor(bridge)
  // A second store reader, before any restore connection exists, to check the list shape.
  const listingBridge = new PcBridge(new PcProfileStore(home))
  const listed = await listingBridge.profiles()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].status, 'offline')
  assert.equal(listed[0].autoConnect, true)
  assert.equal(listed[0].protocolVersion, '1.2')
  assert.equal(listed[0].verifiedAt, '2026-10-30T02:36:33.280Z')
  assert.equal(JSON.stringify(listed).includes(token), false, 'the view never carries the token')
  listingBridge.dispose()

  const { registry, registrations } = registryHarness()
  const controller = createPcConnectionController({ remote })
  const integration = new PcNativeSessionIntegration({ sessions: registry, controller, remote })
  t.after(() => { integration.dispose(); controller.dispose() })

  await waitUntil(() => gateway.seenMethods.includes('host.info'))
  await waitUntil(() => integration.getBackends().length === 1)
  const [row] = integration.getBackends()
  assert.equal(row.status, 'connected')
  assert.equal(row.hostName, 'lxldeMac-mini.local')
  assert.deepEqual(row.workspaces.map(workspace => workspace.id), ['integration-workspace'])
  assert.equal(registrations.length, 1)
  // A 1.2 host without modelList/modelSelect connects anyway; only the seat is off.
  assert.equal(registrations[0].modelSelectionAvailable(), false)
  assert.equal(gateway.upgrades.at(-1) !== undefined, true)
})

test('profiles saved disconnected or offline are listed but never auto-reconnected', async (t) => {
  const gateway = await legacyGateway()
  const token = randomBytes(32).toString('base64url')
  const document = JSON.parse(legacyDocument(gateway, token))
  document.profiles[0].status = 'disconnected'
  const { home } = await storedHome(t, JSON.stringify(document))
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const remote = remoteFor(bridge)
  const { registry } = registryHarness()
  const controller = createPcConnectionController({ remote })
  const integration = new PcNativeSessionIntegration({ sessions: registry, controller, remote })
  t.after(() => { integration.dispose(); controller.dispose() })

  const listed = await bridge.profiles()
  assert.equal(listed.length, 1, 'the saved profile is still listed')
  assert.equal(listed[0].status, 'offline')
  assert.equal('autoConnect' in listed[0], false, 'an explicitly disconnected profile is not reconnect-eligible')
  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(gateway.seenMethods.includes('host.info'), false, 'no reconnect is attempted for it')
  assert.equal(integration.getBackends().length, 0)
})

test('a profile store that fails to load logs one structured line naming the file and class, never the token', async (t) => {
  const gateway = await legacyGateway()
  const token = randomBytes(32).toString('base64url')
  const broken = legacyDocument(gateway, token) + 'corrupt-trailing-bytes'
  const { home, file } = await storedHome(t, broken)
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })

  const original = console.error
  const lines = []
  console.error = (...args) => { lines.push(args.map(String).join(' ')) }
  t.after(() => { console.error = original })
  await assert.rejects(() => bridge.profiles(), (error) => error.code === 'remote-dev/pc-storage-unavailable')

  const storeLines = lines.filter(line => line.includes('pc-profile-store load failed'))
  assert.equal(storeLines.length, 1, 'exactly one structured load-failure line')
  assert.match(storeLines[0], /file=.+profiles\.json/)
  assert.match(storeLines[0], /class=\S+/)
  assert.ok(storeLines[0].includes(file), 'the log names the exact stored file path')
  assert.equal(storeLines[0].includes(token), false, 'the token never reaches the log')
  assert.equal(JSON.stringify(lines).includes(token), false)
})
