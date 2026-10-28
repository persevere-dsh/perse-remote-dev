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
const { PcNativeSessionFace } = await import('../packages/perse-remote-dev/src/client/native-sessions/session-face.ts')

const session = {
  id: 'session-a', workspaceId: 'workspace-a', provider: 'dsh', title: 'Remote session', status: 'waitingApproval',
  createdAt: '2026-10-27T00:00:00.000Z', updatedAt: '2026-10-27T00:00:01.000Z', archived: false,
}
const approval = {
  sessionId: session.id, sequence: 1, type: 'approval', timestamp: '2026-10-27T00:00:02.000Z',
  payload: { approvalId: 'approval-old', title: 'Approve command', detail: 'Run command?', choices: ['allowOnce', 'deny'] },
}
const idle = {
  sessionId: session.id, sequence: 10, type: 'status', timestamp: '2026-10-27T00:00:10.000Z', payload: { status: 'idle' },
}

function openRequest() {
  return {
    address: { backendId: 'profile-a', hostId: 'host-a', generation: 'generation-a', workspaceId: 'workspace-a', sessionId: 'session-a' },
    signal: new AbortController().signal,
  }
}
function page(events, retentionFloor, status = session.status) { return { session: { ...session, status }, events, retentionFloor } }
function rpc(result) { return { ok: true, value: { resultJson: JSON.stringify(result) } } }

test('expired recovery replaces approvals and gateway records and retains an uncertainty warning', async () => {
  let reads = 0
  const remote = { pcCall: async () => {
    reads += 1
    if (reads === 1) return rpc(page([approval], 1))
    if (reads === 2) return rpc(page([], 10))
    return rpc(page([idle], 10, 'idle'))
  } }
  const face = new PcNativeSessionFace('local-session-a', 'session-a', openRequest(), remote, () => true, () => {}, () => {})
  await face.open()
  clearTimeout(face.pollTimer)
  face.pollTimer = undefined
  assert.deepEqual(face.approvals.getSnapshot().pending.map(item => item.approvalId), ['approval-old'])
  assert.deepEqual(face.gatewayEvents.getSnapshot().events.map(item => item.remoteSequence), [1])

  await face.readAfterCursor()

  assert.deepEqual(face.approvals.getSnapshot().pending, [])
  assert.deepEqual(face.gatewayEvents.getSnapshot().events.map(item => item.remoteSequence), [10])
  assert.equal(face.getSnapshot().running, false)
  assert.equal(face.getSnapshot().openState, 'open')
  assert.match(face.getSnapshot().openError.message, /retained/i)
  face.dispose()
})

test('a later retained-page failure leaves the pre-recovery projection intact', async () => {
  let reads = 0
  const retainedPage = Array.from({ length: 5_000 }, (_, index) => ({
    sessionId: session.id, sequence: 10 + index, type: 'notice', timestamp: '2026-10-27T00:00:10.000Z', payload: { text: 'retained' },
  }))
  const remote = { pcCall: async () => {
    reads += 1
    if (reads === 1) return rpc(page([approval], 1))
    if (reads === 2) return rpc(page([], 10))
    if (reads === 3) return rpc(page(retainedPage, 10))
    return rpc(page([], 5_012))
  } }
  const face = new PcNativeSessionFace('local-session-a', 'session-a', openRequest(), remote, () => true, () => {}, () => {})
  await face.open()
  clearTimeout(face.pollTimer)
  face.pollTimer = undefined
  await face.readAfterCursor()

  assert.deepEqual(face.approvals.getSnapshot().pending.map(item => item.approvalId), ['approval-old'])
  assert.deepEqual(face.gatewayEvents.getSnapshot().events.map(item => item.remoteSequence), [1])
  assert.equal(face.cursor, 1)
  assert.equal(face.currentSession.status, 'waitingApproval')
  assert.equal(face.getSnapshot().openState, 'error')
  face.dispose()
})
