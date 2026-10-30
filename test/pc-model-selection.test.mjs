// specs/005: remote model discovery/selection stays on the verified host. The frozen
// `modelSelection: false` bit must never flip, unsupported hosts fail explicitly, and no
// path may dispatch a model choice anywhere but through the gateway (never a local model).
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Creation receipts require durable storage; provide an in-memory stand-in before the
// backend module builds its singleton (same guarantee the browser adapter gives).
const memoryStorage = new Map()
globalThis.localStorage = {
  getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
  setItem: (key, value) => { memoryStorage.set(key, String(value)) },
  removeItem: (key) => { memoryStorage.delete(key) },
}

const nativeSourceRoot = process.env.PERSE_DSH_SOURCE_ROOT
const nativeClientPath = nativeSourceRoot === undefined
  ? new URL('./fixtures/native-session-controller-client.mjs', import.meta.url).href
  : pathToFileURL(resolve(nativeSourceRoot, 'packages/api/session-controller/src/client/contract/events.ts')).href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-api-session-controller/client') return { url: nativeClientPath, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
const { PcNativeSessionBackend } = await import('../packages/perse-remote-dev/src/client/native-sessions/backend.ts')
const { PcNativeSessionIntegration } = await import('../packages/perse-remote-dev/src/client/native-sessions/integration.ts')
const { decodePcModelList } = await import('../packages/perse-remote-dev/src/client/native-sessions/protocol.ts')
const { createPcConnectionController } = await import('../packages/perse-remote-dev/src/client/connections/controller.ts')

const PROFILE_ID = 'profile-model'
const HOST_ID = 'host-a'
const GENERATION = 'gen-model'
const profile = {
  profileId: PROFILE_ID, endpoint: 'wss://host-a.example/rpc', networkMode: 'https',
  hostId: HOST_ID, hostName: 'Host A', deviceId: 'device-a', deviceName: 'Desk', status: 'connected',
}

const modelRow = (id, overrides = {}) => ({
  id, provider: id.split('/')[0], providerName: 'Alpha', name: id,
  isDefault: false, selectable: true, ...overrides,
})
const modelListPayload = {
  models: [modelRow('alpha/m0', { isDefault: true }), modelRow('beta/b1', { selectable: false })],
  default: { provider: 'alpha', model: 'm0' },
  failures: [{ provider: 'gamma', reason: 'provider auth failed' }],
  truncated: false,
}

function fakeRemote(calls = [], overrides = {}) {
  return {
    pcCall: async (request) => {
      calls.push(request)
      if (request.method === 'workspace.list') {
        return { ok: true, value: { resultJson: JSON.stringify({ workspaces: [{ id: 'workspace-a', name: 'Project A' }] }) } }
      }
      if (request.method === 'session.list') {
        return { ok: true, value: { resultJson: JSON.stringify({ sessions: [], nextCursor: null }) } }
      }
      if (request.method === 'model.list') {
        return { ok: true, value: { resultJson: JSON.stringify(modelListPayload) } }
      }
      if (request.method === 'session.setModel') {
        return { ok: true, value: { resultJson: JSON.stringify({ model: { provider: 'alpha', model: 'm0' } }) } }
      }
      if (request.method === 'session.create') {
        const params = JSON.parse(request.paramsJson)
        return { ok: true, value: { resultJson: JSON.stringify({ session: {
          id: 'session-new', workspaceId: 'workspace-a', provider: params.provider ?? 'dsh',
          title: 'created', status: 'idle', createdAt: '2026-10-30T02:00:00.000Z', updatedAt: '2026-10-30T02:00:00.000Z', archived: false,
          ...(params.model === undefined ? {} : { model: params.model }),
        } }) } }
      }
      return { ok: false, error: { code: 'remote-dev/gateway-error', message: `unexpected method ${request.method}` } }
    },
    ...overrides,
  }
}

async function makeBackend(capabilities, overrides = {}) {
  const calls = []
  const remote = fakeRemote(calls, overrides)
  const backend = new PcNativeSessionBackend({
    remote,
    profile,
    connection: { profileId: PROFILE_ID, hostId: HOST_ID, generation: GENERATION },
    hostInfo: {
      id: HOST_ID, name: 'Host A', protocolVersion: '1.3',
      capabilities, providers: [{ id: 'dsh', available: true }], workspaces: [],
    },
    isCurrent: () => true,
    onOffline: () => undefined,
  })
  await backend.refresh()
  return { backend, calls }
}

const createRequest = (model) => ({
  address: { backendId: PROFILE_ID, hostId: HOST_ID, workspaceId: 'workspace-a' },
  options: model === undefined ? {} : { model },
  signal: new AbortController().signal,
})

test('modelSelection stays false even when the host advertises modelList and modelSelect', async () => {
  const { backend } = await makeBackend(['modelList', 'modelSelect'])
  assert.equal(backend.capabilities.modelSelection, false, 'the frozen seam bit must never be flipped')
  assert.equal(backend.modelSupport.list, true)
  assert.equal(backend.modelSupport.select, true)
  assert.equal(backend.modelSelectionAvailable(), true)
})

test('listModels reads the host catalog through the gateway only', async () => {
  const { backend, calls } = await makeBackend(['modelList', 'modelSelect'])
  const list = await backend.listModels()
  assert.equal(list.models.length, 2)
  assert.equal(list.default.provider, 'alpha')
  assert.equal(list.failures[0].provider, 'gamma')
  const modelCalls = calls.filter(call => call.method === 'model.list')
  assert.equal(modelCalls.length, 1, 'one fetch is cached')
  assert.deepEqual(JSON.parse(modelCalls[0].paramsJson), {})
})

test('a host without the model capabilities fails explicitly and is never dispatched to', async () => {
  const { backend, calls } = await makeBackend([])
  assert.equal(backend.modelSupport.list, false)
  assert.equal(backend.modelSelectionAvailable(), false)
  await assert.rejects(backend.listModels(), error =>
    error.code === 'remote-dev/pc-native-capability-unavailable'
    && error.details.method === 'model.list' && error.details.capability === 'modelSelection')
  await assert.rejects(backend.setModel('session-1', 'alpha/m0'), error =>
    error.code === 'remote-dev/pc-native-capability-unavailable'
    && error.details.method === 'session.setModel' && error.details.capability === 'modelSelection')
  assert.deepEqual(calls.filter(call => call.method === 'model.list' || call.method === 'session.setModel'), [])
})

test('session.create with a requested model fails on an unsupported host without dispatching anything', async () => {
  const { backend, calls } = await makeBackend([])
  await assert.rejects(backend.createSession(createRequest('alpha/m0')), error =>
    error.code === 'remote-dev/pc-native-capability-unavailable'
    && error.details.method === 'session.create(model)' && error.details.capability === 'modelSelection')
  assert.deepEqual(calls.filter(call => call.method === 'session.create'), [], 'no remote create may be dispatched for an unselectable model')
})

test('session.create forwards the requested or stored model to the gateway, never to a local runtime', async () => {
  const { backend, calls } = await makeBackend(['modelList', 'modelSelect'])
  const created = await backend.createSession(createRequest('alpha/m0'))
  assert.equal(String(created), 'session-new')
  const create = calls.filter(call => call.method === 'session.create').at(-1)
  assert.equal(JSON.parse(create.paramsJson).model, 'alpha/m0')

  await backend.setDefaultModel('workspace-a', 'alpha/m0')
  const stored = await backend.createSession(createRequest(undefined))
  assert.equal(String(stored), 'session-new')
  const second = calls.filter(call => call.method === 'session.create').at(-1)
  assert.equal(JSON.parse(second.paramsJson).model, 'alpha/m0')
  // The plugin owns no local session API: every model-bearing call went through pcCall.
  assert.ok(calls.every(call => typeof call.method === 'string' && typeof call.profileId === 'string'))
})

test('setDefaultModel rejects a model absent from the host catalog', async () => {
  const { backend } = await makeBackend(['modelList', 'modelSelect'])
  await assert.rejects(backend.setDefaultModel('workspace-a', 'alpha/nope'), error =>
    error.code === 'remote-dev/pc-native-capability-unavailable' && error.details.model === 'alpha/nope')
  await assert.rejects(backend.setDefaultModel('workspace-a', 'beta/b1'), error =>
    error.code === 'remote-dev/pc-native-capability-unavailable', 'non-selectable rows may not become the default')
})

test('setModel dispatches exactly once and never auto-retries an unknown outcome', async () => {
  const { backend, calls } = await makeBackend(['modelList', 'modelSelect'])
  const result = await backend.setModel('session-1', 'alpha/m0', 'high')
  assert.deepEqual(result, { provider: 'alpha', model: 'm0' })
  const setCalls = calls.filter(call => call.method === 'session.setModel')
  assert.equal(setCalls.length, 1)
  assert.deepEqual(JSON.parse(setCalls[0].paramsJson), { sessionId: 'session-1', model: 'alpha/m0', reasoningEffort: 'high' })
})

test('setModel keeps a gateway refusal structured and does not retry', async () => {
  const calls = []
  const remote = fakeRemote(calls)
  const original = remote.pcCall
  remote.pcCall = async (request) => {
    if (request.method === 'session.setModel') {
      calls.push(request)
      return { ok: false, error: { code: 'remote-dev/gateway-error', message: 'model is not selectable here', details: { method: 'session.setModel', reason: 'model-unavailable' } } }
    }
    return original(request)
  }
  const backend = new PcNativeSessionBackend({
    remote, profile,
    connection: { profileId: PROFILE_ID, hostId: HOST_ID, generation: GENERATION },
    hostInfo: { id: HOST_ID, name: 'Host A', protocolVersion: '1.3', capabilities: ['modelList', 'modelSelect'], providers: [{ id: 'dsh', available: true }], workspaces: [] },
    isCurrent: () => true,
    onOffline: () => undefined,
  })
  await backend.refresh()
  await assert.rejects(backend.setModel('session-1', 'alpha/ghost'))
  assert.equal(calls.filter(call => call.method === 'session.setModel').length, 1, 'an unknown or failed outcome must not be retried')
})

test('seatHostFor resolves only Sessions of the current backend generation', async () => {
  const calls = []
  const remote = {
    ...fakeRemote(calls),
    pcProfiles: async () => ({ ok: true, value: { profiles: [profile] } }),
    pcConnect: async () => ({ ok: true, value: { profileId: PROFILE_ID, hostId: HOST_ID, generation: GENERATION, hostInfoJson: JSON.stringify({ id: HOST_ID, name: 'Host A', protocolVersion: '1.3', capabilities: ['modelList', 'modelSelect'], providers: [{ id: 'dsh', available: true }], workspaces: [] }) } }),
    pcDisconnect: async () => ({ ok: true, value: {} }), pcForget: async () => ({ ok: true, value: {} }), pcRevoke: async () => ({ ok: true, value: {} }),
    pcPairPreview: async () => ({ ok: false, error: { code: 'x', message: 'unused' } }), pcPairConfirm: async () => ({ ok: false, error: { code: 'x', message: 'unused' } }),
  }
  const registrations = []
  const identity = { current: () => undefined }
  const registry = {
    externalCatalog: { getSnapshot: () => [], subscribe: () => () => {} },
    retainedBindings: { getSnapshot: () => [], subscribe: () => () => {} },
    registerExternalBackend(backend) { registrations.push(backend); return () => {} },
    async createExternalSession() { return {} },
    respondExternalApproval() {}, externalAddressOf() {},
    externalIdentityOf: (id) => identity.current(id), retain() {}, using() {},
  }
  const controller = createPcConnectionController({ remote })
  const integration = new PcNativeSessionIntegration({ sessions: registry, controller, remote })
  await controller.refreshProfiles()
  for (let attempt = 0; attempt < 100 && registrations.length === 0; attempt += 1) await new Promise(resolvePromise => setTimeout(resolvePromise, 0))
  assert.equal(registrations.length, 1)
  identity.current = (sessionId) => sessionId === `external:${PROFILE_ID}:${HOST_ID}:workspace-a:remote-1`
    ? {
      backendId: PROFILE_ID, generation: GENERATION, hostId: HOST_ID, hostName: 'Host A', profileName: 'Desk',
      capabilities: registrations[0].capabilities,
      address: { sessionId: 'remote-1', workspaceId: 'workspace-a', backendId: PROFILE_ID, hostId: HOST_ID },
    }
    : undefined
  const seat = integration.seatHostFor(`external:${PROFILE_ID}:${HOST_ID}:workspace-a:remote-1`)
  assert.equal(seat?.remoteSessionId, 'remote-1')
  assert.equal(integration.seatHostFor('local-session-1'), undefined, 'local Sessions render no remote seat')
  integration.dispose()
  controller.dispose()
})

test('decodePcModelList enforces the v1.3 payload bounds', () => {
  const base = JSON.stringify(modelListPayload)
  assert.equal(decodePcModelList(base).ok, true)
  assert.equal(decodePcModelList(JSON.stringify({ ...modelListPayload, models: Array.from({ length: 257 }, (_, index) => modelRow(`p/m${index}`)) })).ok, false)
  assert.equal(decodePcModelList(JSON.stringify({ ...modelListPayload, models: [modelRow('alpha/m0'), modelRow('alpha/m0')] })).ok, false, 'duplicate ids are rejected')
  assert.equal(decodePcModelList(JSON.stringify({ ...modelListPayload, models: [modelRow('alpha/m0', { isDefault: true }), modelRow('beta/b1', { isDefault: true })] })).ok, false, 'two defaults are rejected')
  assert.equal(decodePcModelList(JSON.stringify({ ...modelListPayload, models: [modelRow('no-slash-id')] })).ok, false, 'ids must be <provider>/<model>')
  assert.equal(decodePcModelList(JSON.stringify({ ...modelListPayload, truncated: 'false' })).ok, false)
  assert.equal(decodePcModelList(JSON.stringify({ ...modelListPayload, failures: Array.from({ length: 17 }, (_, index) => ({ provider: `p${index}`, reason: 'x' })) })).ok, false)
  const parsed = decodePcModelList(base)
  assert.equal(parsed.ok && parsed.value.models[1].selectable, false)
})
