import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, lstat, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { PcBridge } from '../packages/perse-remote-dev/src/pc/bridge.ts'
import { PcProfileStore } from '../packages/perse-remote-dev/src/pc/profile-store.ts'
import { decodePcImageAttachment, MAX_REMOTE_IMAGE_BYTES } from '../packages/perse-remote-dev/src/client/native-sessions/protocol.ts'

const canonicalTmp = await realTmp()

test('PC pair preview is offline; explicit confirm sends bearer only in websocket header and keeps it private', async (t) => {
  const token = randomBytes(32).toString('base64url')
  const gateway = await fakeGateway({ token })
  const home = await isolatedHome(t)
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const link = pairingLink(gateway.endpoint)
  const preview = bridge.preview(link)
  assert.equal(gateway.exchangeCount, 0)
  assert.equal(preview.hostId, 'host-test')
  assert.equal(JSON.stringify(preview).includes(token), false)
  const connected = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC test' }, new AbortController().signal)
  assert.equal(connected.hostId, 'host-test')
  assert.equal(connected.generation.length > 10, true)
  assert.equal(gateway.authHeaders.at(-1), `Bearer ${token}`)
  assert.equal(connected.hostInfoJson.includes(token), false)
  const profiles = await bridge.profiles()
  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].status, 'connected')
  assert.equal(JSON.stringify(profiles).includes(token), false)
  await assert.rejects(() => bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC test' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-confirmation-invalid')
  await assert.rejects(() => bridge.call({ profileId: connected.profileId, generation: connected.generation, method: 'filesystem.deleteRoot', paramsJson: '{}' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-method-unsupported')
})

test('pair exchange refuses redirects and host identity mismatches before saving credentials', async (t) => {
  const redirect = await fakeGateway({ redirectExchange: true })
  const redirectBridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { redirectBridge.dispose(); return redirect.close() })
  const redirectPreview = redirectBridge.preview(pairingLink(redirect.endpoint))
  await assert.rejects(() => redirectBridge.confirm({ confirmationId: redirectPreview.confirmationId, deviceName: 'PC' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-pairing-invalid')
  assert.equal(redirect.upgradeCount, 0)

  const mismatch = await fakeGateway({ exchangeHostId: 'other-host' })
  const mismatchHome = await isolatedHome(t)
  const mismatchBridge = new PcBridge(new PcProfileStore(mismatchHome))
  t.after(() => { mismatchBridge.dispose(); return mismatch.close() })
  const mismatchPreview = mismatchBridge.preview(pairingLink(mismatch.endpoint))
  await assert.rejects(() => mismatchBridge.confirm({ confirmationId: mismatchPreview.confirmationId, deviceName: 'PC' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-pairing-invalid')
  assert.deepEqual(await mismatchBridge.profiles(), [])
})

test('the bridge transports and decodes a 20 MiB attachment within the 28 MiB wire budget', async (t) => {
  const gateway = await fakeGateway({ attachmentBytes: MAX_REMOTE_IMAGE_BYTES })
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  const connection = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC image test' }, new AbortController().signal)
  const resultJson = await bridge.call({
    profileId: connection.profileId,
    generation: connection.generation,
    method: 'session.attachment',
    paramsJson: JSON.stringify({ sessionId: 'session-a', attachmentId: 'image-a' }),
  }, new AbortController().signal)
  const decoded = decodePcImageAttachment(JSON.parse(resultJson), 'image-a')
  assert.equal(decoded.data.byteLength, MAX_REMOTE_IMAGE_BYTES)
  assert.equal(gateway.rpcMethods.at(-1), 'session.attachment')
})

test('the bridge rejects a response whose base64 frame exceeds 28 MiB', async (t) => {
  const gateway = await fakeGateway({ attachmentBytes: 21 * 1024 * 1024 })
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  const connection = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC over-limit test' }, new AbortController().signal)
  await assert.rejects(() => bridge.call({
    profileId: connection.profileId,
    generation: connection.generation,
    method: 'session.attachment',
    paramsJson: JSON.stringify({ sessionId: 'session-a', attachmentId: 'image-a' }),
  }, new AbortController().signal), error => error.code === 'remote-dev/pc-transport-failed')
})

test('offline socket after successful exchange retains a reconnectable offline profile', async (t) => {
  const gateway = await fakeGateway({ rejectRpc: true })
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  await assert.rejects(() => bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-transport-failed')
  const profiles = await bridge.profiles()
  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].status, 'offline')
  assert.equal(gateway.exchangeCount, 1)
})

test('host.info identity mismatch after exchange erases the newly issued grant', async (t) => {
  const gateway = await fakeGateway({ infoHostId: 'different-host' })
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  await assert.rejects(() => bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-pairing-invalid' && error.message.includes('主机管理页撤销'))
  assert.deepEqual(await bridge.profiles(), [])
})

test('restart shows saved profile offline and reconnects without another exchange', async (t) => {
  const gateway = await fakeGateway()
  const home = await isolatedHome(t)
  const firstProcess = new PcBridge(new PcProfileStore(home))
  t.after(() => gateway.close())
  const preview = firstProcess.preview(pairingLink(gateway.endpoint))
  const initial = await firstProcess.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal)
  firstProcess.dispose()
  const restarted = new PcBridge(new PcProfileStore(home))
  t.after(() => restarted.dispose())
  assert.equal((await restarted.profiles())[0].status, 'offline')
  const resumed = await restarted.connect(initial.profileId, new AbortController().signal)
  assert.notEqual(resumed.generation, initial.generation)
  assert.equal(gateway.exchangeCount, 1)
})

test('socket drop rejects pending calls and profile status becomes offline', async (t) => {
  const gateway = await fakeGateway({ hangMethods: new Set(['session.read']) })
  const store = new PcProfileStore(await isolatedHome(t))
  const bridge = new PcBridge(store)
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  const connected = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal)
  const pending = bridge.call({ profileId: connected.profileId, generation: connected.generation, method: 'session.read', paramsJson: '{"sessionId":"s"}' }, new AbortController().signal)
  await waitUntil(() => gateway.rpcMethods.includes('session.read'))
  gateway.dropSockets()
  await assert.rejects(() => pending, (error) => error.code === 'remote-dev/pc-transport-failed')
  await waitUntil(async () => (await store.list())[0]?.status === 'offline')
})

test('RPC cancellation marks the socket.send boundary precisely for mutation recovery', async (t) => {
  const gateway = await fakeGateway({ hangMethods: new Set(['session.create']) })
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  const connected = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal)

  const beforeSend = new AbortController()
  beforeSend.abort()
  await assert.rejects(() => bridge.call({ profileId: connected.profileId, generation: connected.generation, method: 'session.create', paramsJson: '{}' }, beforeSend.signal), (error) => error.code === 'remote-dev/pc-no-dispatch')
  assert.equal(gateway.rpcMethods.includes('session.create'), false, 'pre-aborted create never crossed the dispatch boundary')

  const afterSend = new AbortController()
  const pending = bridge.call({ profileId: connected.profileId, generation: connected.generation, method: 'session.create', paramsJson: '{}' }, afterSend.signal)
  await waitUntil(() => gateway.rpcMethods.includes('session.create'))
  afterSend.abort()
  await assert.rejects(() => pending, (error) => error.code === 'remote-dev/pc-outcome-unknown')
})

test('same-major protocol minors remain compatible; a new major fails without deleting the grant', async (t) => {
  const compatible = await fakeGateway({ protocolVersion: '1.3' })
  const compatibleBridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { compatibleBridge.dispose(); return compatible.close() })
  const preview = compatibleBridge.preview(pairingLink(compatible.endpoint))
  const connected = await compatibleBridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal)
  assert.equal(JSON.parse(connected.hostInfoJson).protocolVersion, '1.3')

  const futureMajor = await fakeGateway({ protocolVersion: '2.0' })
  const store = new PcProfileStore(await isolatedHome(t))
  const bridge = new PcBridge(store)
  t.after(() => { bridge.dispose(); return futureMajor.close() })
  const futurePreview = bridge.preview(pairingLink(futureMajor.endpoint))
  await assert.rejects(() => bridge.confirm({ confirmationId: futurePreview.confirmationId, deviceName: 'PC' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-protocol-unsupported')
  assert.equal((await bridge.profiles())[0].status, 'offline')
  assert.equal((await store.list()).length, 1)
})

test('an already aborted call is never dispatched', async (t) => {
  const gateway = await fakeGateway()
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  const connected = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal)
  const methodsBefore = gateway.rpcMethods.length
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => bridge.call({ profileId: connected.profileId, generation: connected.generation, method: 'session.read', paramsJson: '{}' }, controller.signal))
  assert.equal(gateway.rpcMethods.length, methodsBefore)
})

test('concurrent reconnect and forget cannot resurrect a forgotten profile', async (t) => {
  const gateway = await fakeGateway({ delayHostInfoMs: 100 })
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  const connected = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal)
  const reconnect = bridge.connect(connected.profileId, new AbortController().signal)
  await waitUntil(() => gateway.upgradeCount >= 2)
  const forgotten = bridge.forget(connected.profileId)
  await Promise.allSettled([reconnect, forgotten])
  assert.deepEqual(await bridge.profiles(), [])
})

test('legacy URL routes are inert and log-token scraping is gone', async () => {
  const source = await readFile(new URL('../packages/perse-remote-dev/src/index.ts', import.meta.url), 'utf8')
  assert.match(source, /throw legacyPcRoute\('openTunnel'\)/)
  assert.match(source, /throw legacyPcRoute\('openProject'\)/)
  assert.doesNotMatch(source, /readRemoteToken|web\.log|this\.tunnels\.open/)
})

test('connection generations block stale calls; numeric remote errors survive with secret redaction', async (t) => {
  const token = randomBytes(32).toString('base64url')
  const gateway = await fakeGateway({ token, rpcError: true })
  const bridge = new PcBridge(new PcProfileStore(await isolatedHome(t)))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const preview = bridge.preview(pairingLink(gateway.endpoint))
  const first = await bridge.confirm({ confirmationId: preview.confirmationId, deviceName: 'PC' }, new AbortController().signal)
  await bridge.disconnect(first.profileId)
  const second = await bridge.connect(first.profileId, new AbortController().signal)
  assert.notEqual(first.generation, second.generation)
  const sentBeforeStale = gateway.rpcMethods.length
  await assert.rejects(() => bridge.call({ profileId: first.profileId, generation: first.generation, method: 'session.read', paramsJson: '{"sessionId":"s"}' }, new AbortController().signal), (error) => error.code === 'remote-dev/pc-generation-stale')
  assert.equal(gateway.rpcMethods.length, sentBeforeStale)
  await assert.rejects(() => bridge.call({ profileId: first.profileId, generation: second.generation, method: 'session.read', paramsJson: '{"sessionId":"s"}' }, new AbortController().signal), (error) => {
    assert.equal(error.code, 'remote-dev/pc-remote-error')
    assert.equal(error.details.remoteCode, -32009)
    assert.equal(JSON.stringify(error.details).includes(token), false)
    return true
  })
})

test('private profile store uses 0700/0600, serializes writes, and rejects symlink storage', async (t) => {
  const home = await isolatedHome(t)
  const store = new PcProfileStore(home)
  const tokenA = randomBytes(32).toString('base64url')
  const tokenB = randomBytes(32).toString('base64url')
  const profile = (profileId, token) => ({ profileId, endpoint: 'wss://example.test/rpc', networkMode: 'https', hostId: 'host', hostName: 'Host', deviceId: randomUUID(), deviceName: 'PC', token, status: 'offline' })
  await Promise.all([store.put(profile(randomUUID(), tokenA)), store.put(profile(randomUUID(), tokenB))])
  const directory = await lstat(store.directory)
  const file = await lstat(join(store.directory, 'profiles.json'))
  assert.equal(directory.mode & 0o777, 0o700)
  assert.equal(file.mode & 0o777, 0o600)
  assert.equal((await store.list()).length, 2)
  const text = await readFile(join(store.directory, 'profiles.json'), 'utf8')
  assert.equal(text.includes(tokenA), true)
  assert.equal(text.includes(tokenB), true)

  const linkHome = join(canonicalTmp, `pc-link-${randomUUID()}`)
  await symlink(home, linkHome)
  t.after(() => rm(linkHome, { force: true }))
  const unsafe = new PcProfileStore(linkHome)
  await assert.rejects(() => unsafe.list(), /symbolic link/)
})

test('pair parser rejects noncanonical, insecure remote, and expired links without exchange', async () => {
  const token = randomBytes(32).toString('base64url')
  const base = { v: 1, hostId: 'h', hostName: 'H', endpoint: 'wss://example.test/rpc', pairingId: 'id', secret: token, expiresAt: new Date(Date.now() + 60_000).toISOString(), networkMode: 'https' }
  const link = (payload) => `persevere://pair#${Buffer.from(JSON.stringify(payload)).toString('base64url')}`
  const bridge = new PcBridge(new PcProfileStore(join(canonicalTmp, `pc-parser-${randomUUID()}`)))
  assert.throws(() => bridge.preview(link({ ...base, endpoint: 'ws://example.test/rpc' })), (error) => error.code === 'remote-dev/pc-pairing-invalid')
  assert.throws(() => bridge.preview(link({ ...base, expiresAt: new Date(Date.now() - 1000).toISOString() })), (error) => error.code === 'remote-dev/pc-pairing-invalid')
  assert.throws(() => bridge.preview(`persevere://pair#${Buffer.from(JSON.stringify({ ...base, masterToken: 'should-not-be-accepted' })).toString('base64url')}`), (error) => error.code === 'remote-dev/pc-pairing-invalid')
})

async function fakeGateway(options = {}) {
  const authHeaders = []
  const rpcMethods = []
  const sockets = new Set()
  let exchangeCount = 0
  let upgradeCount = 0
  const token = options.token ?? randomBytes(32).toString('base64url')
  const server = createServer((request, response) => {
    if (request.url !== '/pair/exchange') { response.writeHead(404).end(); return }
    exchangeCount++
    if (options.redirectExchange) { response.writeHead(302, { location: '/other' }).end(); return }
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString())
      assert.equal(typeof payload.secret, 'string')
      const body = {
        device: { id: 'device-1', name: payload.deviceName, createdAt: new Date().toISOString() },
        token,
        host: { id: options.exchangeHostId ?? 'host-test', name: 'Test host' },
        endpoint,
        protocolVersion: options.exchangeProtocolVersion ?? '1.2',
      }
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body))
    })
  })
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (request, socket, head) => {
    upgradeCount++
    authHeaders.push(request.headers.authorization)
    if (options.rejectRpc) { socket.destroy(); return }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws)
    })
  })
  wss.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    socket.on('message', (frame) => {
      const rpc = JSON.parse(frame.toString())
      rpcMethods.push(rpc.method)
      if (options.rpcError && rpc.method !== 'host.info') {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, error: { code: -32009, message: `stale ${token}`, data: { credential: token } } }))
      } else if (rpc.method === 'host.info') {
        setTimeout(() => {
          if (socket.readyState === 1) socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { protocolVersion: options.protocolVersion ?? '1.2', host: { id: options.infoHostId ?? 'host-test', name: 'Test host', platform: 'test' }, capabilities: [], providers: [], workspaces: [] } }))
        }, options.delayHostInfoMs ?? 0)
      } else if (options.attachmentBytes !== undefined && rpc.method === 'session.attachment') {
        const bytes = Buffer.alloc(options.attachmentBytes, 1)
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {
          attachment: { attachmentId: 'image-a', mediaType: 'image/png', bytes: options.attachmentBytes, width: 8000, height: 8000 },
          data: bytes.toString('base64'),
        } }))
      } else if (options.hangMethods?.has(rpc.method)) {
        // Keep this request pending until the test closes its socket.
      } else {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { events: [], retentionFloor: 1 } }))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const endpoint = `ws://127.0.0.1:${address.port}/rpc`
  return {
    endpoint,
    authHeaders,
    rpcMethods,
    get exchangeCount() { return exchangeCount },
    get upgradeCount() { return upgradeCount },
    dropSockets() { for (const socket of sockets) socket.close(1011, 'test socket drop') },
    close: () => new Promise((resolve) => {
      for (const socket of sockets) socket.terminate()
      wss.close(() => server.close(resolve))
    }),
  }
}

function pairingLink(endpoint) {
  const payload = {
    v: 1, hostId: 'host-test', hostName: 'Test host', endpoint,
    pairingId: randomUUID(), secret: randomBytes(32).toString('base64url'),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), networkMode: 'local',
  }
  return `persevere://pair#${Buffer.from(JSON.stringify(payload)).toString('base64url')}`
}

async function isolatedHome(t) {
  const path = await mkdtemp(join(canonicalTmp, 'pc-bridge-test-'))
  await chmod(path, 0o700)
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

async function realTmp() {
  return await (await import('node:fs/promises')).realpath(tmpdir())
}

async function waitUntil(predicate, timeoutMs = 3000) {
  const start = Date.now()
  for (;;) {
    if (await predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('condition timed out')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}
