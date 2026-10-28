import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reconcileLiveSessionRead } from '../packages/perse-remote-dev/lib/types/client/native-sessions/live-state.js'

test('empty open followed by a complete live turn reconciles the face back to idle', () => {
  let state = { running: false, blank: true, awaitingFirstTurn: false }

  // Opening a newly created session yields an empty, idle session.read.
  const emptyOpen = reconcileLiveSessionRead(state, 'idle', [], false)
  state = emptyOpen.state
  assert.deepEqual(state, { running: false, blank: true, awaitingFirstTurn: false })
  assert.equal(emptyOpen.shouldPublish, false)

  // Sanitized event order from native-prompt-evidence.json: the remote read
  // contains the full live delta and the authoritative list status is already idle.
  const completedTurn = reconcileLiveSessionRead(state, 'idle', [
    'turn/start', 'user/message', 'request/header', 'assistant/message', 'step/end', 'turn/end',
  ], true)
  state = completedTurn.state
  assert.deepEqual(state, { running: false, blank: false, awaitingFirstTurn: false })
  assert.equal(completedTurn.shouldPublish, true, 'the updated snapshot must notify the native Session/UI')
})

test('an idle list status clears a stale running snapshot even when the read delta is empty', () => {
  const result = reconcileLiveSessionRead({ running: true, blank: false, awaitingFirstTurn: false }, 'idle', [], false)
  assert.equal(result.state.running, false)
  assert.equal(result.shouldPublish, true)
})
