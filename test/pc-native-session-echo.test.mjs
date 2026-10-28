import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SubmissionEchoLedger } from '../packages/perse-remote-dev/lib/types/client/native-sessions/submission-echo-ledger.js'

test('same-face retry keeps one optimistic echo and retires it once the durable rpcId arrives', () => {
  const ledger = new SubmissionEchoLedger()
  const pending = new Set(['local-first', 'local-retry'])
  const retirements = []

  assert.equal(ledger.bind('remote-idempotency-key', 'local-first'), undefined)
  const duplicate = ledger.bind('remote-idempotency-key', 'local-retry')
  assert.equal(duplicate, 'local-retry')
  pending.delete(duplicate)
  retirements.push([duplicate, 'failed'])
  assert.deepEqual([...pending], ['local-first'])

  const admitted = ledger.take('remote-idempotency-key', 'remote-idempotency-key')
  pending.delete(admitted)
  retirements.push([admitted, 'observed'])
  assert.deepEqual(retirements, [['local-retry', 'failed'], ['local-first', 'observed']])
  assert.deepEqual([...pending], [])
})
