/**
 * Same scenario as pc-reconnect.test.mjs, but with an information boundary between the host
 * side (bridge + profile store + fake remote host) and the page side (controller +
 * integration), the way production has one: the page reaches the host side only through an
 * RPC proxy that carries data, and the host's socket death reaches the page through nothing
 * except the profile rows it reads. That boundary is what the in-process tests lack, and it
 * is where the live failure ("an idle page never reconnects") lives: three shipped fixes each
 * passed the in-process suite and failed on a real page.
 */
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


/** A page-side remote that carries data only: nothing in-process leaks through it. */
function serializingRemote(remote, calls) {
  const clone = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value))
  const wrap = (method) => async (request, signal) => {
    calls.push(method)
    const outcome = await remote[method](clone(request ?? {}), signal)
    return JSON.parse(JSON.stringify(outcome))
  }
  return new Proxy({}, {
    get: (target, prop) => (typeof prop === 'string' && prop.startsWith('pc') ? wrap(prop) : undefined),
  })
}

test('with only the row read available to the page, an idle page still reconnects a dead host', async (t) => {
  const lines = captureConsole(t)
  const state = gatewayState(randomUUID())
  let gateway = await startGateway(state, 0)
  const token = randomBytes(32).toString('base64url')
  const { home, file } = await storedHome(t, liveDocument(gateway.endpoint, token, state.hostId))
  const bridge = new PcBridge(new PcProfileStore(home))
  // Registered before anything can throw: a leaked bridge keeps timers alive and the runner
  // would then wait forever instead of reporting the failure.
  t.after(() => { bridge.dispose(); return gateway.close() })
  const calls = []
  const remote = serializingRemote(remoteFor(bridge), calls)
  const { integration, controller } = activationHarness(t, remote)
  await waitUntil(() => integration.getBackends()[0]?.status === 'connected', 15_000)

  // The host dies quietly: the socket closes and the host side writes the loss into the
  // rows. No page-side call fails, because the page is doing nothing — the production shape.
  const connectsBefore = calls.filter(name => name === 'pcConnect').length
  await gateway.close()
  let storedOffline = false
  try {
    await waitUntil(async () => (await readStored(file)).status === 'offline', 10_000)
    storedOffline = true
  } catch { storedOffline = false }

  gateway = await restartGateway(state, gateway.port)
  // The stored row, not the in-memory backend: a stale backend keeps saying connected, which
  // is precisely the state that hid this defect. The host-side truth is what recovered.
  let reconnected = false
  try {
    await waitUntil(async () => (await readStored(file)).status === 'connected', 20_000)
    reconnected = true
  } catch { reconnected = false }
  const connectsAfter = calls.filter(name => name === 'pcConnect').length
  process.stdout.write(`\n边界复现: 断线前 pcConnect=${connectsBefore} 次, 之后 ${connectsAfter} 次; 主机行记下离线=${storedOffline}; 页面自己恢复=${reconnected}\n`)
  process.stdout.write(`页面侧调用种类: ${[...new Set(calls)].join(', ') || '(无)'} (共 ${calls.length} 次)\n`)
  process.stdout.write(`相关日志: ${lines.filter(l => /重连|离线|失败/.test(l.text)).slice(-3).map(l => l.text.slice(0, 70)).join(' | ') || '(无)'}\n`)
  assert.ok(storedOffline, '主机侧把断线写进了页面能读到的行')
  assert.ok(connectsAfter > connectsBefore, `空闲页面没有再次发起 pcConnect (${connectsBefore} → ${connectsAfter})`)
  assert.ok(reconnected, '页面读到的主机行最终自己回到 connected')
})
