import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareSubmissionReceipt, SubmissionReceiptStore } from '../packages/perse-remote-dev/src/client/native-sessions/submission-receipts.ts'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, value) }
  removeItem(key) { this.values.delete(key) }
}

test('a host-accepted prompt with a lost response retries using the same idempotency key', async () => {
  const storage = new MemoryStorage()
  const receipts = new SubmissionReceiptStore(storage)
  const identity = { profileId: 'profile-1', hostId: 'host-1', workspaceId: 'workspace-1', sessionId: 'session-1' }
  const payload = JSON.stringify({ text: '修复连接', attachments: [{ mimeType: 'image/png', data: 'AQID' }] })
  const acceptedKeys = new Set()
  let acceptedCount = 0

  const first = await prepareSubmissionReceipt(receipts, identity, 'client-request-1', payload)
  assert.equal(first.ok, true)
  // The host admits the request, but the response is lost before the client can clear its receipt.
  if (!acceptedKeys.has(first.receipt.clientMessageId)) {
    acceptedKeys.add(first.receipt.clientMessageId)
    acceptedCount += 1
  }
  assert.deepEqual(receipts.uncertainFor(identity), first.receipt)
  assert.equal(storage.values.values().next().value.includes('修复连接'), false, 'storage contains no prompt body')

  const retry = await prepareSubmissionReceipt(receipts, identity, 'client-request-2', payload)
  assert.equal(retry.ok, true)
  assert.equal(retry.reused, true)
  assert.equal(retry.receipt.clientMessageId, first.receipt.clientMessageId)
  if (!acceptedKeys.has(retry.receipt.clientMessageId)) {
    acceptedKeys.add(retry.receipt.clientMessageId)
    acceptedCount += 1
  }
  assert.equal(acceptedCount, 1, 'the fake host idempotency table admits this payload only once')

  const changedPayload = await prepareSubmissionReceipt(receipts, identity, 'client-request-3', '{"text":"different"}')
  assert.equal(changedPayload.ok, false)
  assert.equal(changedPayload.reason, 'different-uncertain-payload')
  receipts.clear(retry.receipt)
  assert.equal(receipts.uncertainFor(identity), undefined)
})

test('an uncertain session creation survives reload as identity and start-time metadata only', () => {
  const storage = new MemoryStorage()
  const first = new SubmissionReceiptStore(storage)
  first.saveCreation({
    kind: 'create', profileId: 'profile-1', hostId: 'host-1', workspaceId: 'workspace-1',
    operationId: 'operation-1', startedAt: 1_793_039_400_000,
  })
  const reloaded = new SubmissionReceiptStore(storage)
  assert.deepEqual(reloaded.creationReceipts('profile-1'), [{
    kind: 'create', profileId: 'profile-1', hostId: 'host-1', workspaceId: 'workspace-1',
    operationId: 'operation-1', startedAt: 1_793_039_400_000,
  }])
  const serialized = storage.values.values().next().value
  assert.equal(serialized.includes('credential'), false)
  assert.equal(serialized.includes('prompt'), false)
})

test('an in-flight create is persisted before dispatch but is not presented as unknown', () => {
  const storage = new MemoryStorage()
  const receipts = new SubmissionReceiptStore(storage)
  const receipt = {
    kind: 'create', profileId: 'profile-1', hostId: 'host-1', workspaceId: 'workspace-1',
    operationId: 'operation-live', startedAt: 1_793_039_400_000,
  }
  receipts.saveCreation(receipt)
  assert.equal(storage.values.values().next().value.includes('operation-live'), true, 'receipt is durable before remote dispatch')
  receipts.setCreationInFlight(receipt.operationId, true)
  assert.deepEqual(receipts.creationReceipts(), [], 'active operation is filtered from unknown-result warnings')
  receipts.setCreationInFlight(receipt.operationId, false)
  assert.deepEqual(receipts.creationReceipts(), [receipt], 'unresolved operation becomes a warning after it leaves in-flight state')
})

test('corrupt receipt storage fails closed instead of forgetting an uncertain mutation', async () => {
  const storage = new MemoryStorage()
  const receipts = new SubmissionReceiptStore(storage)
  storage.setItem('perse-remote-dev.native-submission-receipts.v1', '{broken')
  const prepared = await prepareSubmissionReceipt(receipts,
    { profileId: 'p', hostId: 'h', workspaceId: 'w', sessionId: 's' }, 'message-1', '{"text":"x"}')
  assert.equal(prepared.ok, false)
  assert.equal(prepared.reason, 'storage-unavailable')
  assert.throws(() => receipts.saveCreation({
    kind: 'create', profileId: 'p', hostId: 'h', workspaceId: 'w', operationId: 'create-1', startedAt: 1,
  }), /receipts could not be read/)
})

test('acknowledging one reviewed create receipt removes only that local warning', () => {
  const storage = new MemoryStorage()
  const receipts = new SubmissionReceiptStore(storage)
  receipts.saveCreation({ kind: 'create', profileId: 'p', hostId: 'h', workspaceId: 'w1', operationId: 'op-1', startedAt: 1 })
  receipts.saveCreation({ kind: 'create', profileId: 'p', hostId: 'h', workspaceId: 'w2', operationId: 'op-2', startedAt: 2 })
  receipts.clearCreation('op-1')
  assert.deepEqual(receipts.creationReceipts().map(item => item.operationId), ['op-2'])
})
