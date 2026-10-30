import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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
const { createPcConnectionController } = await import('../packages/perse-remote-dev/src/client/connections/controller.ts')
const { PcNativeSessionIntegration } = await import('../packages/perse-remote-dev/src/client/native-sessions/integration.ts')

const profile = {
  profileId: 'profile-a', endpoint: 'wss://host-a.example/rpc', networkMode: 'https',
  hostId: 'host-a', hostName: 'Host A', deviceId: 'device-a', deviceName: 'Desk',
  // Exactly what the real bridge reports for a profile saved while live but not
  // yet re-verified in this process: honest offline display + the autoConnect mark.
  status: 'offline', autoConnect: true,
}
const preview = {
  confirmationId: 'pair-handle', hostId: 'host-a', hostName: 'Host A',
  endpoint: profile.endpoint, networkMode: 'https', expiresAt: '2026-10-27T12:00:00Z', accessSummary: 'Limited',
}
const connected = (generation) => ({
  profileId: profile.profileId, hostId: profile.hostId, generation,
  hostInfoJson: JSON.stringify({ id: profile.hostId, name: profile.hostName, protocolVersion: '1.2', capabilities: [], providers: [], workspaces: [] }),
})

function registryHarness() {
  const registrations = []
  const registerEvents = []
  const unregisterEvents = []
  const retainedBindings = []
  const observable = { getSnapshot: () => retainedBindings, subscribe: () => () => {} }
  return {
    registrations, registerEvents, unregisterEvents, retainedBindings,
    registry: {
      externalCatalog: { getSnapshot: () => [], subscribe: () => () => {} }, retainedBindings: observable,
      registerExternalBackend(backend) {
        registerEvents.push(backend)
        registrations.push(backend)
        return () => {
          unregisterEvents.push(backend)
          const index = registrations.indexOf(backend)
          if (index >= 0) registrations.splice(index, 1)
        }
      },
      async createExternalSession(address) {
        const backend = registrations.find(item => item.backendId === address.backendId)
        const binding = { address, generation: backend?.generation, backend }
        retainedBindings.push(binding)
        return binding
      },
      respondExternalApproval() {}, externalAddressOf() {},
      externalIdentityOf() {}, retain() {}, using() {},
    },
  }
}

function baseRemote(overrides = {}) {
  return {
    pcProfiles: async () => ({ ok: true, value: { profiles: [] } }),
    pcPairPreview: async () => ({ ok: true, value: preview }),
    pcPairConfirm: async () => ({ ok: true, value: connected('paired-generation') }),
    pcConnect: async ({ profileId }) => ({ ok: true, value: connected(`reconnected-${profileId}`) }),
    pcDisconnect: async ({ profileId }) => ({ ok: true, value: { profileId, disconnected: true } }),
    pcForget: async ({ profileId }) => ({ ok: true, value: { profileId, forgotten: true } }),
    pcRevoke: async ({ profileId }) => ({ ok: true, value: { profileId, revoked: true } }),
    pcCall: async () => ({ ok: true, value: { resultJson: JSON.stringify({ workspaces: [] }) } }),
    ...overrides,
  }
}

test('first pairing reconciles saved profile and registers the already-verified generation without reconnecting', async () => {
  let profileReads = 0
  let reconnects = 0
  let pairComplete = false
  const remote = baseRemote({
    pcProfiles: async () => { profileReads += 1; return { ok: true, value: { profiles: pairComplete ? [profile] : [] } } },
    pcPairConfirm: async () => { pairComplete = true; return { ok: true, value: connected('paired-generation') } },
    pcConnect: async () => { reconnects += 1; throw new Error('pair flow must keep the confirmed socket') },
  })
  const { registry, registrations } = registryHarness()
  const controller = createPcConnectionController({ remote })
  const integration = new PcNativeSessionIntegration({ sessions: registry, controller, remote })
  await controller.previewPairing('persevere://pair#fixture')
  const result = await controller.confirmPairing(preview.confirmationId)

  assert.equal(result.ok, true)
  assert.equal(profileReads, 2)
  assert.equal(reconnects, 0)
  assert.equal(controller.getSnapshot().profiles[0].profileId, profile.profileId)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].generation, 'paired-generation')
  integration.dispose()
  controller.dispose()
})

test('activation refresh is shared with UI initialization and restores one exact live generation', async () => {
  let profileReads = 0
  let reconnects = 0
  let catalogCalls = 0
  const remote = baseRemote({
    pcProfiles: async () => { profileReads += 1; return { ok: true, value: { profiles: [profile] } } },
    pcConnect: async ({ profileId }) => { reconnects += 1; return { ok: true, value: connected(`restored-${profileId}`) } },
    pcCall: async () => { catalogCalls += 1; return { ok: true, value: { resultJson: JSON.stringify({ workspaces: [] }) } } },
  })
  const { registry, registrations, registerEvents, unregisterEvents, retainedBindings } = registryHarness()
  const controller = createPcConnectionController({ remote })
  const integration = new PcNativeSessionIntegration({ sessions: registry, controller, remote })
  const uiRefresh = controller.refreshProfiles()
  assert.equal((await uiRefresh).ok, true)
  for (let i = 0; i < 20 && (registerEvents.length === 0 || catalogCalls === 0); i += 1) await new Promise(resolve => setTimeout(resolve, 0))

  const firstBackend = registrations[0]
  const binding = await registry.createExternalSession({ backendId: profile.profileId, hostId: profile.hostId, workspaceId: 'workspace-a' })

  assert.equal(profileReads, 1)
  assert.equal(reconnects, 1)
  assert.equal(registerEvents.length, 1, 'reload registers the accepted generation once cumulatively')
  assert.equal(unregisterEvents.length, 0, 'reload does not retire the first accepted backend')
  assert.equal(catalogCalls, 1, 'reload performs one workspace catalog RPC')
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0], firstBackend, 'the initially registered backend instance remains active')
  assert.equal(firstBackend.generation, 'restored-profile-a')
  assert.equal(binding.backend, firstBackend)
  assert.equal(binding.generation, 'restored-profile-a')
  assert.equal(retainedBindings[0], binding, 'the first external-session binding remains retained')
  integration.dispose()
  assert.equal(registerEvents.length, 1, 'the full lifecycle contains one cumulative registration')
  assert.equal(unregisterEvents.length, 1, 'only explicit integration disposal unregisters the backend')
  assert.equal(retainedBindings[0], binding, 'disposing the integration does not erase the retained binding')
  controller.dispose()
})

test('pairing remains confirmed and gives an actionable refresh recovery when profile reconciliation fails', async () => {
  let pairComplete = false
  const remote = baseRemote({
    pcProfiles: async () => pairComplete
      ? { ok: false, error: { code: 'remote-dev/pc-transport-failed', message: 'profile read failed' } }
      : { ok: true, value: { profiles: [] } },
    pcPairConfirm: async () => { pairComplete = true; return { ok: true, value: connected('paired-generation') } },
  })
  const { registry, registrations } = registryHarness()
  const controller = createPcConnectionController({ remote })
  const integration = new PcNativeSessionIntegration({ sessions: registry, controller, remote })
  await controller.previewPairing('persevere://pair#fixture')
  const result = await controller.confirmPairing(preview.confirmationId)

  assert.equal(result.ok, true)
  assert.equal(controller.getSnapshot().connection.status, 'connected')
  assert.equal(controller.getSnapshot().connection.generation, 'paired-generation')
  assert.equal(controller.getSnapshot().failure.code, 'remote-dev/pc-profile-recovery-required')
  assert.equal(registrations.length, 0, 'native registration waits for an explicitly refreshed saved profile')
  integration.dispose()
  controller.dispose()
})
