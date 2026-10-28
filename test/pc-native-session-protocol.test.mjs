import assert from 'node:assert/strict'
import { test } from 'node:test'
import { attachmentRefsOf, decodePcImageAttachment, decodePcSessionRead, nativeEventOf, MAX_REMOTE_IMAGE_BYTES } from '../packages/perse-remote-dev/src/client/native-sessions/protocol.ts'

const session = {
  id: 'remote-session-1', workspaceId: 'remote-workspace-1', provider: 'dsh', title: 'Example',
  status: 'idle', createdAt: '2026-10-27T00:00:00.000Z', updatedAt: '2026-10-27T00:00:01.000Z', archived: false,
}

function result(events = [], retentionFloor = 1) {
  return JSON.stringify({ session, events, retentionFloor })
}

function event(sequence, payload, type = 'notice') {
  return {
    sessionId: session.id, sequence, type,
    timestamp: '2026-10-27T00:00:02.125Z', payload,
  }
}

test('decodes remote and native sequence spaces separately and preserves raw envelope', () => {
  const wire = event(41, {
    nativeSequence: 17,
    sourceType: 'assistant/message',
    sourceEventSeqs: [11],
    surfaceOp: 'append',
    message: { id: 'message-1', content: [{ type: 'text', text: 'done' }] },
    text: 'done',
    turn: 2,
    step: 1,
  }, 'assistantMessage')
  const decoded = decodePcSessionRead(result([wire]), session.id, 40)
  assert.equal(decoded.ok, true)
  const native = nativeEventOf(decoded.value.events[0])
  assert.equal(native.nativeSequence, 17)
  assert.equal(native.gatewaySequence, 41)
  assert.equal(native.sourceType, 'assistant/message')
  assert.equal(native.time, Date.parse(wire.timestamp))
  assert.deepEqual(native.surfaceOp, 'append')
  assert.deepEqual(native.sourceEventSeqs, [11])
  assert.equal(native.data.turn, 2)
  assert.deepEqual(native.wire, wire)
})

test('unknown native event remains an unclassified raw event instead of being rewritten', () => {
  const wire = event(2, {
    nativeSequence: 1, sourceType: 'future/plugin-record', opaque: { text: 'keep me', list: [1, 2] },
  })
  const decoded = decodePcSessionRead(result([wire]), session.id, 1)
  assert.equal(decoded.ok, true)
  const native = nativeEventOf(decoded.value.events[0])
  assert.equal(native.sourceType, 'future/plugin-record')
  assert.deepEqual(native.wire.payload, wire.payload)
  assert.deepEqual(native.data.opaque, wire.payload.opaque)
})

test('rejects host identity mismatch and malformed event payloads', () => {
  assert.equal(decodePcSessionRead(result([]), 'different-session', 0).error.code, 'session-mismatch')
  assert.equal(decodePcSessionRead(result([event(1, null)]), session.id, 0).error.code, 'invalid-event')
})

test('reports expired cursor before exposing a partial event page', () => {
  const decoded = decodePcSessionRead(result([event(10, { nativeSequence: 9, sourceType: 'turn/start' })], 10), session.id, 0)
  assert.equal(decoded.ok, false)
  assert.equal(decoded.error.code, 'cursor-expired')
  assert.equal(decoded.error.retentionFloor, 10)
})

test('an explicit fresh baseline may recover the retained suffix after the retention floor advances', () => {
  const retained = event(10, { nativeSequence: 9, sourceType: 'turn/start' })
  const decoded = decodePcSessionRead(result([retained], 10), session.id, 0, true)
  assert.equal(decoded.ok, true)
  assert.equal(decoded.value.retentionFloor, 10)
  assert.deepEqual(decoded.value.events.map(item => item.sequence), [10])
  assert.equal(decodePcSessionRead(result([retained], 10), session.id, 0).error.code, 'cursor-expired', 'ordinary polling still rejects an expired cursor')
})

test('enforces monotonic gateway cursors and the 5000-event page bound', () => {
  assert.equal(decodePcSessionRead(result([event(5, {}), event(4, {})]), session.id, 3).error.code, 'invalid-event')
  const tooMany = Array.from({ length: 5_001 }, (_, index) => event(index + 1, {}))
  assert.equal(decodePcSessionRead(result(tooMany), session.id, 0).error.code, 'event-limit')
})

test('observed user message returns image and file references in composer order', () => {
  const data = { message: { content: [
    { type: 'text', text: 'see these' },
    { type: 'image', attachment: { attachmentId: 'image-a', mediaType: 'image/png', bytes: 10, width: 2, height: 3 } },
    { type: 'file', attachment: { attachmentId: 'file-b', name: 'notes.txt', bytes: 20 } },
    { type: 'image', attachment: { attachmentId: 'image-c', mediaType: 'image/webp', bytes: 30, width: 4, height: 5 } },
  ] } }
  assert.deepEqual(attachmentRefsOf(data).map(ref => ref.attachmentId), ['image-a', 'file-b', 'image-c'])
})

test('reads only a bounded canonical image attachment matching the requested identity', () => {
  const response = {
    attachment: {
      attachmentId: 'image-a', mediaType: 'image/png', bytes: 3, width: 2, height: 2,
      name: 'preview.png', originalDimensions: { width: 4, height: 4 },
    },
    data: 'AQID',
  }
  const decoded = decodePcImageAttachment(response, 'image-a')
  assert.deepEqual([...decoded.data], [1, 2, 3])
  assert.deepEqual(decoded.attachment, response.attachment)
  assert.throws(() => decodePcImageAttachment(response, 'image-b'), /ID did not match/)
})

test('rejects invalid image media types, base64, and byte declarations', () => {
  const response = { attachment: { attachmentId: 'image-a', mediaType: 'image/png', bytes: 3, width: 2, height: 2 }, data: 'AQID' }
  assert.throws(() => decodePcImageAttachment({ ...response, attachment: { ...response.attachment, mediaType: 'image/svg+xml' } }, 'image-a'), /media type/)
  assert.throws(() => decodePcImageAttachment({ ...response, data: 'AQ!D' }, 'image-a'), /base64/)
  assert.throws(() => decodePcImageAttachment({ ...response, data: 'AR==' }, 'image-a'), /canonical base64/)
  assert.throws(() => decodePcImageAttachment({ ...response, attachment: { ...response.attachment, bytes: 2 } }, 'image-a'), /byte count did not match/)
})

test('rejects oversized image data and invalid intrinsic dimensions before returning a reference', () => {
  const response = { attachment: { attachmentId: 'image-a', mediaType: 'image/webp', bytes: 3, width: 2, height: 2 }, data: 'AQID' }
  assert.throws(() => decodePcImageAttachment({ ...response, attachment: { ...response.attachment, bytes: MAX_REMOTE_IMAGE_BYTES + 1 } }, 'image-a'), /supported range/)
  assert.throws(() => decodePcImageAttachment({ ...response, attachment: { ...response.attachment, width: 8193 } }, 'image-a'), /dimensions/)
  assert.throws(() => decodePcImageAttachment({ ...response, attachment: { ...response.attachment, width: 8192, height: 8192 } }, 'image-a'), /dimensions/)
  assert.throws(() => decodePcImageAttachment({ ...response, attachment: { ...response.attachment, originalDimensions: { width: 1, height: 0 } } }, 'image-a'), /original dimensions/)
})

test('decodes a canonical 4 MiB image and the exact 20 MiB commitment without regexp stack growth', () => {
  for (const bytes of [4 * 1024 * 1024, MAX_REMOTE_IMAGE_BYTES]) {
    const binary = Buffer.alloc(bytes, 1)
    const dimension = bytes === MAX_REMOTE_IMAGE_BYTES ? 8000 : 2048
    const response = {
      attachment: { attachmentId: 'image-large', mediaType: 'image/png', bytes, width: dimension, height: dimension },
      data: binary.toString('base64'),
    }
    const decoded = decodePcImageAttachment(response, 'image-large')
    assert.equal(decoded.data.byteLength, bytes)
    assert.equal(decoded.data[0], 1)
    assert.equal(decoded.data.at(-1), 1)
  }
})

test('rejects large malformed base64 interiors and noncanonical padding bits', () => {
  const binary = Buffer.alloc(4 * 1024 * 1024, 1).toString('base64')
  const badInterior = `${binary.slice(0, 1_000_000)}!${binary.slice(1_000_001)}`
  assert.throws(() => decodePcImageAttachment({
    attachment: { attachmentId: 'image-large', mediaType: 'image/png', bytes: 4 * 1024 * 1024, width: 2, height: 2 },
    data: badInterior,
  }, 'image-large'), /base64/)
  assert.throws(() => decodePcImageAttachment({
    attachment: { attachmentId: 'image-small', mediaType: 'image/png', bytes: 1, width: 1, height: 1 },
    data: 'AR==',
  }, 'image-small'), /canonical base64/)
  assert.throws(() => decodePcImageAttachment({
    attachment: { attachmentId: 'image-large', mediaType: 'image/png', bytes: MAX_REMOTE_IMAGE_BYTES + 1, width: 1, height: 1 },
    data: 'AQ==',
  }, 'image-large'), /supported range/)
})
