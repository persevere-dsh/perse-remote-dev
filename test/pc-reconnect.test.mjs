/**
 * Live defect (reproduced 2026-10-30, root cause confirmed): a stored PC connection
 * that was live and then lost — the controlled host restarted — never came back. Not
 * after a page reload, not ever, and the sidebar remote group silently rendered
 * 「还没有已连接的远程主机。」 while the gateway was healthy (/health 200) and the stored
 * device token still answered connection.info over the wire. Writing the loss down as
 * `status:"offline"` destroyed reconnect eligibility, because that was the only field
 * the reconnect gate read, and nothing retried while the app stayed open.
 *
 * These tests pin the separated contract (docs/pc-contract.md: Connection intent,
 * transport loss, and reconnect): the persisted `desiredState` is what the user asked
 * for, `status` is only what this process observes, `autoConnect` is the browser-facing
 * eligibility derived from the intent, and a wanted connection retries with capped
 * exponential backoff while the app stays open — reverification only.
 */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
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
const PROFILE_ID = '9e36c386-cca9-432d-bee5-7eaa03a1e68d'
const DEVICE_ID = '385ec965-6e54-4662-8386-63363b4cc1a8'
// Longer than the ~2s first backoff step, so "no attempt ever" cannot be an accident of timing.
const NO_ATTEMPT_WAIT_MS = 3_000

/** What a 0.3.1-rc.5 store holds for a connection that was live at its last verification. */
function liveDocument(endpoint, token, hostId) {
  return { version: 1, profiles: [{
    profileId: PROFILE_ID,
    endpoint, networkMode: 'local',
    hostId, hostName: 'lxldeMac-mini.local',
    deviceId: DEVICE_ID, deviceName: 'PC phase4 validation', token,
    status: 'connected', protocolVersion: '1.2', verifiedAt: '2026-10-30T02:36:33.280Z',
  }] }
}

async function storedHome(t, document) {
  const home = await mkdtemp(join(canonicalTmp, 'pc-reconnect-'))
  await chmod(home, 0o700)
  const directory = join(home, 'remote-dev', 'pc-profiles')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const file = join(directory, 'profiles.json')
  await writeFile(file, JSON.stringify(document), { mode: 0o600 })
  t.after(() => rm(home, { recursive: true, force: true }))
  return { home, file }
}

async function readStored(file) {
  return JSON.parse(await readFile(file, 'utf8')).profiles[0]
}

/**
 * A real Perse Remote 1.2 host that can be torn down and brought back on the same
 * endpoint — the controlled host restarting. `state.accept = false` makes it refuse
 * upgrades while it is still coming back up.
 */
function gatewayState(hostId) {
  return { hostId, accept: true, upgrades: [], methods: [], sockets: new Set() }
}

async function startGateway(state, port) {
  const server = createServer((_, response) => { response.writeHead(404).end() })
  const wss = new WebSocketServer({ noServer: true })
  // A reconnect attempt may land after teardown started: `closing` destroys any connection
  // that arrives while shutting down, and closeAllConnections ends the rest. A connection
  // left standing would hold server.close() open forever and the test process never exits.
  let closing = false
  server.on('connection', (socket) => {
    if (closing) socket.destroy()
  })
  server.on('upgrade', (request, socket, head) => {
    if (closing) { socket.destroy(); return }
    state.upgrades.push(request.headers.authorization ?? '')
    if (!state.accept) { socket.destroy(); return }
    wss.handleUpgrade(request, socket, head, (ws) => {
      state.sockets.add(ws)
      ws.on('close', () => state.sockets.delete(ws))
      wss.emit('connection', ws)
    })
  })
  wss.on('connection', (socket) => {
    socket.on('message', (frame) => {
      const rpc = JSON.parse(frame.toString())
      state.methods.push(rpc.method)
      if (rpc.method === 'host.info') {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {
          protocolVersion: '1.2', host: { id: state.hostId, name: 'lxldeMac-mini.local', platform: 'darwin' },
          capabilities: [], providers: [], workspaces: [],
        } }))
      } else if (rpc.method === 'workspace.list') {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {
          workspaces: [{ id: 'integration-workspace', name: 'integration-workspace' }],
        } }))
      } else if (rpc.method === 'session.list') {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { sessions: [], nextCursor: null } }))
      } else {
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { events: [], retentionFloor: 1 } }))
      }
    })
  })
  await new Promise((resolve, reject) => {
    const onListening = () => { server.off('error', onError); resolve() }
    const onError = (error) => { server.off('listening', onListening); reject(error) }
    server.once('listening', onListening)
    server.once('error', onError)
    server.listen(port, '127.0.0.1')
  })
  const bound = server.address().port
  const close = async () => {
    // Teardown must neither throw (that would fail the test for the wrong reason) nor wait
    // on a peer that is already gone: an open connection would keep this process alive.
    closing = true
    for (const socket of [...state.sockets]) {
      try { socket.terminate() } catch { /* already ended */ }
    }
    state.sockets.clear()
    try { wss.close() } catch { /* already closed */ }
    try { server.closeAllConnections() } catch { /* not listening */ }
    await new Promise((resolve) => server.close(() => resolve()))
  }
  return { port: bound, endpoint: `ws://127.0.0.1:${bound}/rpc`, close }
}

/** Bring the same host back on the same endpoint; the OS may need a moment to free the port. */
async function restartGateway(state, port) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await startGateway(state, port) }
    catch (error) {
      if (error.code !== 'EADDRINUSE' || attempt > 40) throw error
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
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

function waitUntil(predicate, timeoutMs = 8000) {
  const start = Date.now()
  return (async () => {
    for (;;) {
      if (await predicate()) return
      if (Date.now() - start > timeoutMs) throw new Error('condition timed out')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  })()
}

/** Capture console output for the duration of a test; never swallow a credential. */
function captureConsole(t) {
  const lines = []
  const originals = { log: console.log, warn: console.warn, error: console.error }
  const record = (level) => (...args) => { lines.push({ level, text: args.map(String).join(' ') }) }
  console.log = record('log')
  console.warn = record('warn')
  console.error = record('error')
  t.after(() => { Object.assign(console, originals) })
  return lines
}

function activationHarness(t, remote) {
  const { registry, registrations } = registryHarness()
  const controller = createPcConnectionController({ remote })
  const integration = new PcNativeSessionIntegration({ sessions: registry, controller, remote })
  t.after(() => { integration.dispose(); controller.dispose() })
  return { controller, integration, registrations }
}

test('a lost live connection keeps the intent, lists offline + autoConnect, and reconnects the restarted host', async (t) => {
  const lines = captureConsole(t)
  const state = gatewayState(randomUUID())
  let gateway = await startGateway(state, 0)
  const token = randomBytes(32).toString('base64url')
  const { home, file } = await storedHome(t, liveDocument(gateway.endpoint, token, state.hostId))
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const remote = remoteFor(bridge)
  // A second reader with no socket of its own: this is what the profile list reports.
  const listingBridge = new PcBridge(new PcProfileStore(home))
  t.after(() => listingBridge.dispose())

  const { integration, registrations } = activationHarness(t, remote)
  await waitUntil(() => integration.getBackends()[0]?.status === 'connected')
  const firstGeneration = registrations[0].generation
  assert.equal((await readStored(file)).desiredState, 'connected', 'a verified connect stores the intent')

  // The controlled host restarts: its listener goes away with the live socket.
  await gateway.close()
  await waitUntil(async () => (await readStored(file)).status === 'offline', 5_000)
  state.accept = false
  gateway = await restartGateway(state, gateway.port)
  const methodsAtLoss = state.methods.length
  const upgradesAtLoss = state.upgrades.length

  // The loss reaches the client through the verified generation's next remote read. Which
  // read notices first is not fixed (the catalog read that install started may still be in
  // flight), so issue reads until the client has reacted instead of assuming the race.
  for (let round = 0; round < 50 && integration.getBackends()[0]?.status !== 'offline'; round += 1) {
    await registrations[0].refresh().catch(() => undefined)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(integration.getBackends()[0]?.status, 'offline', 'the client noticed the loss and shows the host offline')

  // Observation is written down; intent is not, so eligibility survives the write. The host
  // still refuses upgrades, so no reconnect can succeed and this state is stable to read.
  const stored = await readStored(file)
  assert.equal(stored.status, 'offline')
  assert.equal(stored.desiredState, 'connected', 'transport loss never rewrites the intent')
  const listed = await listingBridge.profiles()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].status, 'offline', 'the honest display status')
  assert.equal(listed[0].autoConnect, true, 'still reconnect-eligible, because the intent says so')
  assert.equal(JSON.stringify(listed).includes(token), false, 'the view never carries the token')

  // And a reconnect attempt is made against the stored endpoint — without any reload. An
  // attempt that landed while the old listener was still closing recorded no upgrade, so
  // wait for the loop's next one rather than assuming which attempt is observed.
  await waitUntil(() => state.upgrades.length > upgradesAtLoss, 6_000)
  assert.equal(state.upgrades.at(-1), `Bearer ${token}`, 'the attempt carries the stored device credential')

  // The host finishes coming back up: the same profile is live again on a fresh
  // generation, reverified, with nothing replayed.
  state.accept = true
  await waitUntil(() => integration.getBackends()[0]?.status === 'connected', 12_000)
  const lastGeneration = registrations.at(-1).generation
  assert.notEqual(lastGeneration, firstGeneration, 'the recovered link is a fresh verified generation')
  assert.equal((await readStored(file)).status, 'connected')
  const afterLoss = state.methods.slice(methodsAtLoss)
  assert.ok(afterLoss.includes('host.info'), 'reconnect revalidates the host identity')
  assert.equal(afterLoss.some((method) => method === 'session.create' || method === 'session.prompt' || method === 'worktree.create'), false,
    'reconnect recreates no Session and replays no prompt or mutation')
  // Logging is asserted over the whole capture, keyed by generation. Where the launch
  // restore's line ends and the first retry's begins is exactly the boundary this test must
  // not have to guess: the first retry can be refused before this test finishes noticing.
  const failures = lines.filter(line => line.level === 'warn' && line.text.includes('主机自动重连失败'))
  assert.ok(failures.length >= 1, 'one line per failed attempt')
  assert.match(failures[0].text, new RegExp(`profile=${PROFILE_ID}`))
  assert.equal(JSON.stringify(lines).includes(token), false, 'credentials are scrubbed out of every line')
  const successes = lines.filter(line => line.level === 'log' && line.text.includes('主机自动重连成功'))
  assert.equal(successes.filter(line => line.text.includes(lastGeneration)).length, 1, 'the recovered link logs exactly one line')
  assert.equal(successes.filter(line => line.text.includes(firstGeneration)).length, 1, 'the launch restore logged its own line')
})

test('an explicit user disconnect withdraws the intent and is never retried', async (t) => {
  const state = gatewayState(randomUUID())
  const gateway = await startGateway(state, 0)
  const token = randomBytes(32).toString('base64url')
  const { home, file } = await storedHome(t, liveDocument(gateway.endpoint, token, state.hostId))
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const remote = remoteFor(bridge)
  const listingBridge = new PcBridge(new PcProfileStore(home))
  t.after(() => listingBridge.dispose())
  const { controller, integration } = activationHarness(t, remote)
  await waitUntil(() => integration.getBackends()[0]?.status === 'connected')

  const upgradesBefore = state.upgrades.length
  const disconnected = await controller.disconnectProfile(PROFILE_ID)
  assert.equal(disconnected.ok, true)

  const stored = await readStored(file)
  assert.equal(stored.desiredState, 'disconnected', 'only the user withdraws the intent')
  assert.equal(stored.status, 'disconnected', 'and the honest observation follows')
  const listed = await listingBridge.profiles()
  assert.equal(listed.length, 1, 'the saved host is still listed')
  assert.equal('autoConnect' in listed[0], false, 'it is no longer reconnect-eligible')
  assert.equal(integration.getBackends()[0]?.status, 'offline', 'shown honestly offline, not silently gone')

  // The host is still perfectly reachable, and yet nothing ever reconnects it.
  await new Promise((resolve) => setTimeout(resolve, NO_ATTEMPT_WAIT_MS))
  assert.equal(state.upgrades.length, upgradesBefore, 'no reconnect attempt is ever made after an explicit disconnect')
})

test('a legacy stored status:"connected" migrates to intent connected and still reconnects', async (t) => {
  const state = gatewayState(randomUUID())
  const gateway = await startGateway(state, 0)
  const token = randomBytes(32).toString('base64url')
  // Byte-for-byte pre-desiredState document: no intent field at all.
  const { home, file } = await storedHome(t, liveDocument(gateway.endpoint, token, state.hostId))
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const listingBridge = new PcBridge(new PcProfileStore(home))
  t.after(() => listingBridge.dispose())

  const listed = await listingBridge.profiles()
  assert.equal(listed[0].status, 'offline')
  assert.equal(listed[0].autoConnect, true, 'a legacy live profile derives intent connected and stays eligible')
  assert.equal('desiredState' in listed[0], false, 'the stored intent is never returned to the browser')

  const remote = remoteFor(bridge)
  const { integration } = activationHarness(t, remote)
  await waitUntil(() => integration.getBackends()[0]?.status === 'connected')
  assert.ok(state.upgrades.length >= 1, 'regression for 4174dcb: the launch-time restore reconnects it')
  assert.equal((await readStored(file)).desiredState, 'connected', 'the derived intent lands in the store on the next write')
})

test('a legacy stored status:"offline" does not start reconnecting', async (t) => {
  const state = gatewayState(randomUUID())
  const gateway = await startGateway(state, 0)
  const token = randomBytes(32).toString('base64url')
  const document = liveDocument(gateway.endpoint, token, state.hostId)
  document.profiles[0].status = 'offline'
  const { home } = await storedHome(t, document)
  const bridge = new PcBridge(new PcProfileStore(home))
  t.after(() => { bridge.dispose(); return gateway.close() })
  const listingBridge = new PcBridge(new PcProfileStore(home))
  t.after(() => listingBridge.dispose())

  const listed = await listingBridge.profiles()
  assert.equal(listed.length, 1, 'the saved host is still listed')
  assert.equal(listed[0].status, 'offline')
  assert.equal('autoConnect' in listed[0], false, 'a connection the user left offline stays offline')

  const remote = remoteFor(bridge)
  const { integration } = activationHarness(t, remote)
  await new Promise((resolve) => setTimeout(resolve, NO_ATTEMPT_WAIT_MS))
  assert.equal(state.upgrades.length, 0, 'no reconnect is attempted for a legacy offline profile')
  assert.equal(state.methods.length, 0)
  assert.equal(integration.getBackends().length, 0, 'and the remote group stays empty by intent, not by accident')
})

test('a failing reconnect retries more than once with an increasing delay', async (t) => {
  captureConsole(t)
  const attempts = []
  const remote = failingRemote(attempts)
  const { integration, controller } = activationHarness(t, remote)
  await waitUntil(() => attempts.length >= 3, 20_000)
  integration.dispose()
  controller.dispose()
  const firstGap = attempts[1] - attempts[0]
  const secondGap = attempts[2] - attempts[1]
  // A timer never fires before its deadline and each gap also carries the settle time of
  // the previous attempt, so the nominal steps are floors. The loose ceilings only catch a
  // loop that stopped backing off (a constant step) or jumped straight to the 30s cap.
  assert.ok(firstGap >= 1_900 && firstGap <= 6_000, `first retry waits the ~2s step, saw ${firstGap}ms`)
  assert.ok(secondGap >= 3_800 && secondGap <= 15_000, `second retry waits the doubled ~4s step, saw ${secondGap}ms`)
  assert.ok(secondGap > firstGap, `the delay increases (${firstGap}ms then ${secondGap}ms)`)
})

test('disposing the integration stops the pending reconnect attempt', async (t) => {
  const lines = captureConsole(t)
  const attempts = []
  const remote = failingRemote(attempts)
  const { integration, controller } = activationHarness(t, remote)
  await waitUntil(() => attempts.length >= 1)
  // The next attempt is pending at about +2s; disposal must cancel it outright.
  integration.dispose()
  controller.dispose()
  await new Promise((resolve) => setTimeout(resolve, 2_600))
  assert.equal(attempts.length, 1, 'no attempt is dispatched after disposal')
  const failed = lines.filter(line => line.level === 'warn' && line.text.includes('主机自动重连失败'))
  assert.equal(failed.length, 1, 'exactly one line for the one failed attempt')
  assert.equal(lines.some(line => line.text.includes('主机自动重连成功')), false)
})

/** A host that answers the profile list but refuses every connect, recording attempt times. */
function failingRemote(attempts) {
  const profile = {
    profileId: PROFILE_ID, endpoint: 'wss://host-a.example/rpc', networkMode: 'https',
    hostId: 'host-a', hostName: 'Host A', deviceId: DEVICE_ID, deviceName: 'Desk',
    status: 'offline', autoConnect: true,
  }
  const failure = { code: 'remote-dev/pc-transport-failed', message: '无法连接到 Perse Remote 主机；已保留本地配对授权，可稍后重试', details: { reason: 'connect refused' } }
  return {
    pcProfiles: async () => ({ ok: true, value: { profiles: [profile] } }),
    pcPairPreview: async () => ({ ok: false, error: failure }),
    pcPairConfirm: async () => ({ ok: false, error: failure }),
    pcConnect: async () => { attempts.push(Date.now()); return { ok: false, error: failure } },
    pcDisconnect: async () => ({ ok: true, value: {} }),
    pcForget: async () => ({ ok: true, value: {} }),
    pcRevoke: async () => ({ ok: true, value: {} }),
    pcCall: async () => ({ ok: false, error: failure }),
  }
}

/** A minimal document stand-in: the visibility rule is about the browser exposing this
 * exact shape, and node has none, so the integration must also work without it. */
function visibilityDocument(t) {
  const listeners = new Map()
  const doc = {
    visibilityState: 'hidden',
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== listener))
    },
    dispatch(type) {
      for (const listener of listeners.get(type) ?? []) listener()
    },
    listenerCount(type) {
      return (listeners.get(type) ?? []).length
    },
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true })
  t.after(() => {
    if (previous === undefined) delete globalThis.document
    else Object.defineProperty(globalThis, 'document', previous)
  })
  return doc
}

test('a page becoming visible again runs a waiting retry instead of trusting the frozen timer', async (t) => {
  captureConsole(t)
  const doc = visibilityDocument(t)
  const attempts = []
  const remote = failingRemote(attempts)
  const { integration, controller } = activationHarness(t, remote)
  await waitUntil(() => attempts.length >= 1)
  const pending = attempts.length

  // Still hidden: a visibility change is not a reason to reach the host.
  doc.visibilityState = 'hidden'
  doc.dispatch('visibilitychange')
  await new Promise((resolve) => setTimeout(resolve, 400))
  assert.equal(attempts.length, pending, 'a hidden resume attempts nothing')

  // Visible again: the attempt that was waiting on a throttled timer runs now, well
  // inside the smallest backoff step (~2s), so timing is the assertion here.
  doc.visibilityState = 'visible'
  const at = Date.now()
  doc.dispatch('visibilitychange')
  await waitUntil(() => attempts.length > pending, 1_500)
  assert.ok(Date.now() - at < 1_500, 'the waiting retry ran on resume, not on the frozen timer')

  integration.dispose()
  controller.dispose()
  assert.equal(doc.listenerCount('visibilitychange'), 0, 'disposing removes the listener')
})

test('without a document the integration still runs the same reconnect loop', async (t) => {
  captureConsole(t)
  assert.equal(typeof globalThis.document, 'undefined', 'node-side harness really has no document')
  const attempts = []
  const remote = failingRemote(attempts)
  const { integration, controller } = activationHarness(t, remote)
  await waitUntil(() => attempts.length >= 2, 20_000)
  integration.dispose()
  controller.dispose()
  assert.ok(attempts.length >= 2, 'the loop is not gated on a browser document existing')
})

/**
 * The two loss triggers are not both reachable through the fake gateway: a real socket
 * close also fails a call, which takes the `error` path. These tests drive `sync`
 * directly so the host-reported-offline trigger is exercised on its own — the shape an
 * idle page actually sees.
 */
function stubControllerHarness() {
  const attempts = []
  let reads = 0
  let listener = null
  const snapshot = {
    connection: {
      status: 'connected', profileId: 'p1', hostId: 'h1', generation: 'g1',
      hostInfo: { id: 'h1', name: 'stub', platform: 'linux', protocolVersion: '1.4', capabilities: [] },
      error: null,
    },
    profiles: [{ profileId: 'p1', hostName: 'stub', status: 'connected', autoConnect: true }],
  }
  const controller = {
    setNativeSessionSupport() {},
    setCreationReceiptAcknowledger() {},
    setPendingCreations() {},
    subscribe(cb) { listener = cb; return () => { listener = null } },
    getSnapshot: () => snapshot,
    refreshProfiles: async () => {
      // A real controller notifies its subscribers after a read patches the list; the
      // poll's effect on sync is exactly what this harness must reproduce.
      reads += 1
      const result = { ok: true, value: snapshot.profiles }
      listener?.(snapshot)
      return result
    },
    connectProfile: async (profileId) => {
      attempts.push(profileId)
      return { ok: true, value: { profileId, hostId: 'h1', generation: 'g1', hostInfo: snapshot.connection.hostInfo } }
    },
    dispose() {},
  }
  const observable = { getSnapshot: () => ({}), subscribe: () => () => {} }
  const sessions = {
    registerExternalBackend: () => () => {},
    createExternalSession: async () => { throw new Error('not used') },
    respondExternalApproval: async () => { throw new Error('not used') },
    externalAddressOf: () => undefined,
    externalIdentityOf: () => undefined,
    retain: () => () => {},
    using: () => () => {},
    externalCatalog: observable,
    retainedBindings: observable,
  }
  const remote = new Proxy({}, {
    get: (target, prop) => async () => prop === 'pcCall'
      ? { ok: true, value: { resultJson: JSON.stringify({ workspaces: [] }) } }   // what the catalog parses
      : { ok: true, value: { receipts: [] } },
  })
  const integration = new PcNativeSessionIntegration({ sessions, controller, remote })
  return {
    integration,
    snapshot,
    attempts,
    refreshCount: () => reads,
    notify: () => { listener?.(snapshot) },
  }
}

test('the host row going offline after saying connected arms the retry even with no failed call', async (t) => {
  captureConsole(t)
  const h = stubControllerHarness()
  await waitUntil(() => h.attempts.length >= 1)   // launch-time restore from the stub
  h.notify()                                     // the row says connected for this generation
  const before = h.attempts.length
  h.snapshot.profiles[0].status = 'offline'       // the host lost its socket; the page is idle
  h.notify()
  await waitUntil(() => h.attempts.length > before, 2_000)
  h.integration.dispose()
  assert.ok(h.attempts.length > before, 'a host-reported loss starts the same backoff loop')
})

// (The "row never said connected" shape is covered where it truly belongs, on the real
// controller: pc-native-connection-lifecycle's pairing test asserts reconnects === 0 for a
// just-confirmed pairing whose saved row still reads offline.)

test('an idle page notices a dead host through the row read and retries on its own', async (t) => {
  captureConsole(t)
  const doc = visibilityDocument(t)
  doc.visibilityState = 'visible'
  const h = stubControllerHarness()
  await waitUntil(() => h.attempts.length >= 1)
  h.notify()                                   // the row said connected for this generation
  const before = h.attempts.length
  h.snapshot.profiles[0].status = 'offline'     // the host lost the socket
  // Deliberately no notify(): only the periodic row read can surface the loss.
  await waitUntil(() => h.attempts.length > before, 14_000)
  h.integration.dispose()
  assert.ok(h.attempts.length > before, 'the row read surfaced the loss and the retry ran')
})

test('a hidden page does not spend row reads', async (t) => {
  captureConsole(t)
  const doc = visibilityDocument(t)
  doc.visibilityState = 'hidden'
  const h = stubControllerHarness()
  await waitUntil(() => h.attempts.length >= 1)
  const reads = h.refreshCount()
  await new Promise(resolve => setTimeout(resolve, 11_000))
  h.integration.dispose()
  assert.equal(h.refreshCount(), reads, 'no read while the page cannot see the answer')
})
