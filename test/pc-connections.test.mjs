import assert from 'node:assert/strict'
import test from 'node:test'
import { createPcConnectionController } from '../packages/perse-remote-dev/src/client/connections/controller.ts'

const profiles = [
  { profileId: 'profile-a', endpoint: 'wss://host-a.example/ws', networkMode: 'https', hostId: 'host-a', hostName: 'Host A', deviceId: 'device-a', deviceName: 'Desk', status: 'disconnected' },
  { profileId: 'profile-b', endpoint: 'wss://host-b.example/ws', networkMode: 'https', hostId: 'host-b', hostName: 'Host B', deviceId: 'device-b', deviceName: 'Desk', status: 'disconnected' },
]

function success(value) { return Promise.resolve({ ok: true, value }) }
function connectValue(profileId, hostId, generation = `generation-${profileId}`) {
  return { profileId, hostId, generation, hostInfoJson: JSON.stringify({ id: hostId, name: hostId.toUpperCase() }) }
}
function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('pair preview passes through the local redacted preview contract without exchanging or connecting', async () => {
  const calls = []
  const preview = {
    confirmationId: 'opaque-local-handle', hostId: 'host-a', hostName: 'Host A',
    endpoint: 'wss://host-a.example/ws', networkMode: 'https', expiresAt: '2026-10-27T12:00:00Z',
    accessSummary: 'Workspace and session access',
  }
  const controller = createPcConnectionController({ remote: {
    pcProfiles: () => { calls.push('profiles'); return success({ profiles: [] }) },
    pcPairPreview: (request) => { calls.push(['preview', request]); return success(preview) },
    pcPairConfirm: (request) => { calls.push(['confirm', request]); return success(connectValue('profile-a', 'host-a')) },
    pcConnect: (request) => { calls.push(['connect', request]); return success(connectValue(request.profileId, 'host-a')) },
    pcDisconnect: (request) => { calls.push(['disconnect', request]); return success({ profileId: request.profileId, disconnected: true }) },
    pcForget: (request) => { calls.push(['forget', request]); return success({ profileId: request.profileId, forgotten: true }) },
    pcRevoke: (request) => { calls.push(['revoke', request]); return success({ profileId: request.profileId, revoked: true }) },
  } })

  const result = await controller.previewPairing('persevere://pair#test-fixture')
  assert.deepEqual(result, { ok: true, value: preview })
  assert.deepEqual(controller.getSnapshot().pairingPreview, preview)
  assert.deepEqual(calls, [['preview', { link: 'persevere://pair#test-fixture' }]])
  assert.equal(controller.getSnapshot().nativeSessionSupport, 'unavailable')
  controller.dispose()
})

test('explicit confirmation consumes one preview handle and connects only to its verified host', async () => {
  const calls = []
  const preview = {
    confirmationId: 'one-use-handle', hostId: 'host-a', hostName: 'Host A',
    endpoint: 'wss://host-a.example/ws', networkMode: 'https', expiresAt: '2026-10-27T12:00:00Z', accessSummary: 'Limited',
  }
  const controller = createPcConnectionController({ remote: {
    pcProfiles: () => success({ profiles: [] }),
    pcPairPreview: () => success(preview),
    pcPairConfirm: (request) => { calls.push(request); return success(connectValue('profile-a', 'host-a', 'new-generation')) },
    pcConnect: async () => { throw new Error('must not reconnect after pairing confirmation') },
    pcDisconnect: async () => { throw new Error('unused') },
    pcForget: async () => { throw new Error('unused') },
    pcRevoke: async () => { throw new Error('unused') },
  } })
  await controller.previewPairing('persevere://pair#link')
  const result = await controller.confirmPairing('one-use-handle', '  Office Mac  ')
  assert.equal(result.ok, true)
  assert.deepEqual(calls, [{ confirmationId: 'one-use-handle', deviceName: 'Office Mac' }])
  assert.equal(controller.getSnapshot().connection.profileId, 'profile-a')
  assert.equal(controller.getSnapshot().connection.hostId, 'host-a')
  assert.equal(controller.getSnapshot().pairingPreview, null)
  const duplicate = await controller.confirmPairing('one-use-handle', 'Office Mac')
  assert.equal(duplicate.ok, false)
  assert.equal(calls.length, 1)
  controller.dispose()
})

test('late result from an old profile switch cannot replace the currently connected profile', async () => {
  const pendingA = deferred()
  const pendingB = deferred()
  const controller = createPcConnectionController({ remote: {
    pcProfiles: () => success({ profiles }),
    pcPairPreview: () => { throw new Error('unused') },
    pcPairConfirm: () => { throw new Error('unused') },
    pcConnect: ({ profileId }) => profileId === 'profile-a' ? pendingA.promise : pendingB.promise,
    pcDisconnect: ({ profileId }) => success({ profileId, disconnected: true }),
    pcForget: ({ profileId }) => success({ profileId, forgotten: true }),
    pcRevoke: ({ profileId }) => success({ profileId, revoked: true }),
  } })
  await controller.refreshProfiles()

  const first = controller.connectProfile('profile-a')
  const second = controller.connectProfile('profile-b')
  pendingB.resolve({ ok: true, value: connectValue('profile-b', 'host-b', 'generation-b') })
  assert.equal((await second).ok, true)
  pendingA.resolve({ ok: true, value: connectValue('profile-a', 'host-a', 'generation-a') })
  const stale = await first

  assert.equal(stale.ok, false)
  if (!stale.ok) assert.equal(stale.failure.code, 'remote-dev/pc-stale-generation')
  assert.equal(controller.getSnapshot().connection.profileId, 'profile-b')
  assert.equal(controller.getSnapshot().connection.hostId, 'host-b')
  assert.equal(controller.getSnapshot().connection.generation, 'generation-b')
  controller.dispose()
})

test('remote error keeps the actionable message, numeric code and structured data', async () => {
  const controller = createPcConnectionController({ remote: {
    pcProfiles: () => Promise.resolve({ ok: false, error: {
      code: 'remote-dev/pc-remote-error', message: '远端调用失败',
      details: { remoteCode: 4107, remoteMessage: 'workspace is dirty', dataJson: '{"workspaceId":"ws-1"}' },
    } }),
    pcPairPreview: async () => { throw new Error('unused') },
    pcPairConfirm: async () => { throw new Error('unused') },
    pcConnect: async () => { throw new Error('unused') },
    pcDisconnect: async () => { throw new Error('unused') },
    pcForget: async () => { throw new Error('unused') },
    pcRevoke: async () => { throw new Error('unused') },
  } })
  const result = await controller.refreshProfiles()
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.failure.message, 'workspace is dirty')
    assert.equal(result.failure.remoteCode, 4107)
    assert.deepEqual(result.failure.remoteData, { workspaceId: 'ws-1' })
  }
  controller.dispose()
})

test('connection controller exposes no task/session/file RPC and revokes only its captured active generation', async () => {
  const calls = []
  const controller = createPcConnectionController({ remote: {
    pcProfiles: () => success({ profiles }),
    pcPairPreview: () => success({ confirmationId: 'handle', hostId: 'host-a', hostName: 'Host A', endpoint: 'wss://host-a.example/ws', networkMode: 'https', expiresAt: '2026-10-27T12:00:00Z', accessSummary: 'Limited' }),
    pcPairConfirm: ({ confirmationId, deviceName }) => { calls.push(['pair', confirmationId, deviceName]); return success(connectValue('profile-a', 'host-a', 'pair-gen')) },
    pcConnect: ({ profileId }) => { calls.push(['connect', profileId]); return success(connectValue(profileId, profileId === 'profile-a' ? 'host-a' : 'host-b', 'active-gen')) },
    pcDisconnect: ({ profileId }) => { calls.push(['disconnect', profileId]); return success({ profileId, disconnected: true }) },
    pcForget: ({ profileId }) => { calls.push(['forget', profileId]); return success({ profileId, forgotten: true }) },
    pcRevoke: ({ profileId, generation }) => { calls.push(['revoke', profileId, generation]); return success({ profileId, revoked: true }) },
  } })
  await controller.refreshProfiles()
  await controller.connectProfile('profile-a')
  assert.deepEqual(await controller.revokeSelf(), { ok: true, value: undefined })
  assert.deepEqual(calls, [['connect', 'profile-a'], ['revoke', 'profile-a', 'active-gen']])
  assert.equal(controller.getSnapshot().profiles.some((profile) => profile.profileId === 'profile-a'), false)
  assert.equal('sendTask' in controller, false)
  assert.equal('loadSessions' in controller, false)
  assert.equal('call' in controller, false)
  controller.dispose()
})

test('disconnect failure preserves verified identity and surfaces the structured failure', async () => {
  const controller = createPcConnectionController({ remote: {
    pcProfiles: () => success({ profiles: [profiles[0]] }),
    pcPairPreview: async () => { throw new Error('unused') },
    pcPairConfirm: async () => { throw new Error('unused') },
    pcConnect: () => success(connectValue('profile-a', 'host-a', 'generation-a')),
    pcDisconnect: () => Promise.resolve({ ok: false, error: { code: 'remote-dev/pc-transport-failed', message: 'socket close failed' } }),
    pcForget: async () => { throw new Error('unused') },
    pcRevoke: async () => { throw new Error('unused') },
  } })
  await controller.refreshProfiles()
  await controller.connectProfile('profile-a')
  const result = await controller.disconnectProfile()
  assert.equal(result.ok, false)
  assert.equal(controller.getSnapshot().connection.profileId, 'profile-a')
  assert.equal(controller.getSnapshot().connection.hostId, 'host-a')
  assert.equal(controller.getSnapshot().connection.generation, 'generation-a')
  assert.equal(controller.getSnapshot().connection.error?.message, 'socket close failed')
  controller.dispose()
})
