/** Strict boundary decoders for the existing Perse Remote session RPCs. */

import type { AttachmentId, FileAttachmentRef, ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment/types'

/** Read-side caps match the attachment service defaults and bound untrusted RPC allocation. */
export const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_REMOTE_IMAGE_DIMENSION = 8192
const MAX_REMOTE_IMAGE_PIXELS = 64_000_000
const MAX_REMOTE_IMAGE_BASE64_CHARS = 4 * Math.ceil(MAX_REMOTE_IMAGE_BYTES / 3)

export interface PcRemoteSession {
  readonly id: string
  readonly workspaceId: string
  readonly provider: string
  readonly title: string
  readonly status: 'idle' | 'running' | 'waitingApproval' | 'error' | 'interrupted'
  readonly createdAt: string
  readonly updatedAt: string
  readonly archived: boolean
  readonly model?: string
}

export interface PcRemoteEvent {
  readonly sessionId: string
  /** Gateway journal sequence. This is the replay cursor, not native DSH seq. */
  readonly sequence: number
  readonly type: string
  readonly timestamp: string
  readonly payload: Readonly<Record<string, unknown>>
}

export interface PcRemoteSessionRead {
  readonly session: PcRemoteSession
  readonly events: readonly PcRemoteEvent[]
  readonly retentionFloor: number
}

export interface PcRemoteWorkspace {
  readonly id: string
  readonly name: string
  readonly path?: string
}

export interface PcRemoteSessionPage {
  readonly sessions: readonly PcRemoteSession[]
  readonly nextCursor: string | null
}

/** Reconstructed native DSH event fields carried by a durable Perse event. */
export interface PcRemoteNativeEvent {
  readonly sessionId: string
  readonly gatewaySequence: number
  readonly sourceType: string
  readonly nativeSequence: number
  readonly time: number
  readonly data: Readonly<Record<string, unknown>>
  readonly surfaceOp?: unknown
  readonly sourceEventSeqs?: unknown
  /** Keep the complete wire event for future fields and unknown native types. */
  readonly wire: PcRemoteEvent
}

export type PcNativeSessionDecodeError =
  | { readonly code: 'invalid-json'; readonly message: string }
  | { readonly code: 'invalid-session'; readonly message: string }
  | { readonly code: 'session-mismatch'; readonly message: string }
  | { readonly code: 'invalid-event'; readonly message: string; readonly gatewaySequence?: number }
  | { readonly code: 'cursor-expired'; readonly message: string; readonly retentionFloor: number; readonly afterSequence: number }
  | { readonly code: 'event-limit'; readonly message: string; readonly limit: number }

export type PcNativeSessionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PcNativeSessionDecodeError }

const MAX_READ_EVENTS = 5_000

/**
 * Parse one `session.read` JSON result and validate its session/cursor boundary.
 * The result intentionally distinguishes gateway sequence from the native
 * sequence preserved inside each event payload.
 */
export function decodePcSessionRead(
  resultJson: string,
  expectedSessionId: string,
  afterSequence: number,
  allowExpiredBaseline = false,
): PcNativeSessionResult<PcRemoteSessionRead> {
  let input: unknown
  try { input = JSON.parse(resultJson) as unknown } catch {
    return failure({ code: 'invalid-json', message: 'The remote session response was not valid JSON.' })
  }
  const record = asRecord(input)
  if (record === null) return failure({ code: 'invalid-session', message: 'The remote session response did not contain valid session metadata.' })
  const session = decodeSession(record.session)
  if (session === null) return failure({ code: 'invalid-session', message: 'The remote session response did not contain valid session metadata.' })
  if (session.id !== expectedSessionId) return failure({ code: 'session-mismatch', message: 'The remote host returned a different session identity.' })
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    return failure({ code: 'invalid-event', message: 'The requested remote event cursor was invalid.' })
  }
  if (!Array.isArray(record.events) || !Number.isSafeInteger(record.retentionFloor) || Number(record.retentionFloor) < 0) {
    return failure({ code: 'invalid-event', message: 'The remote session response had an invalid event window.' })
  }
  if (record.events.length > MAX_READ_EVENTS) {
    return failure({ code: 'event-limit', message: 'The remote session response exceeded the protocol event page limit.', limit: MAX_READ_EVENTS })
  }
  const retentionFloor = Number(record.retentionFloor)
  if (afterSequence + 1 < retentionFloor && !(allowExpiredBaseline && afterSequence === 0)) {
    return failure({
      code: 'cursor-expired',
      message: 'The requested remote history cursor is no longer retained by the host.',
      retentionFloor,
      afterSequence,
    })
  }
  const events: PcRemoteEvent[] = []
  let previous = afterSequence
  for (const candidate of record.events) {
    const event = decodeEvent(candidate, expectedSessionId)
    if (event === null || event.sequence <= previous) {
      return failure({
        code: 'invalid-event',
        message: 'The remote event page contained an invalid or non-monotonic event.',
        ...(event === null ? {} : { gatewaySequence: event.sequence }),
      })
    }
    events.push(event)
    previous = event.sequence
  }
  return { ok: true, value: { session, events, retentionFloor } }
}

export function decodePcWorkspaceList(resultJson: string): PcNativeSessionResult<readonly PcRemoteWorkspace[]> {
  const parsed = parseResult(resultJson)
  if (!parsed.ok) return parsed
  const rows = parsed.value.workspaces
  if (!Array.isArray(rows)) return failure({ code: 'invalid-session', message: 'The remote host returned an invalid workspace catalog.' })
  const workspaces: PcRemoteWorkspace[] = []
  const ids = new Set<string>()
  for (const row of rows) {
    const value = asRecord(row)
    if (value === null || !nonEmpty(value.id) || typeof value.name !== 'string'
      || (value.path !== undefined && typeof value.path !== 'string') || ids.has(value.id)) {
      return failure({ code: 'invalid-session', message: 'The remote host returned an invalid workspace row.' })
    }
    ids.add(value.id)
    workspaces.push({ id: value.id, name: value.name, ...(typeof value.path === 'string' ? { path: value.path } : {}) })
  }
  return { ok: true, value: workspaces }
}

export function decodePcSessionList(resultJson: string): PcNativeSessionResult<PcRemoteSessionPage> {
  const parsed = parseResult(resultJson)
  if (!parsed.ok) return parsed
  const rows = parsed.value.sessions
  const nextCursor = parsed.value.nextCursor
  if (!Array.isArray(rows) || !(nextCursor === null || typeof nextCursor === 'string')) {
    return failure({ code: 'invalid-session', message: 'The remote host returned an invalid session catalog page.' })
  }
  const sessions: PcRemoteSession[] = []
  const ids = new Set<string>()
  for (const row of rows) {
    const session = decodeSession(row)
    if (session === null || ids.has(session.id)) {
      return failure({ code: 'invalid-session', message: 'The remote host returned an invalid or duplicate session row.' })
    }
    ids.add(session.id)
    sessions.push(session)
  }
  return { ok: true, value: { sessions, nextCursor } }
}

export function decodePcSessionCreate(resultJson: string, expectedWorkspaceId: string): PcNativeSessionResult<PcRemoteSession> {
  const parsed = parseResult(resultJson)
  if (!parsed.ok) return parsed
  const session = decodeSession(parsed.value.session)
  if (session === null || session.workspaceId !== expectedWorkspaceId) {
    return failure({ code: 'invalid-session', message: 'The remote host returned an invalid created session identity.' })
  }
  return { ok: true, value: session }
}

/** Recover native event fields without discarding the original gateway envelope. */
export function nativeEventOf(event: PcRemoteEvent): PcRemoteNativeEvent | null {
  const payload = event.payload
  const nativeSequence = payload.nativeSequence
  const sourceType = payload.sourceType
  if (!Number.isSafeInteger(nativeSequence) || Number(nativeSequence) < 0 || typeof sourceType !== 'string' || sourceType.length === 0) return null
  const data: Record<string, unknown> = { ...payload }
  delete data.nativeSequence
  delete data.sourceType
  // `status` is added by the gateway only for turn start/end. For other event
  // types an original native `status` field remains part of the data payload.
  if ((sourceType === 'turn/start' || sourceType === 'turn/end') && data.status === statusFor(sourceType, payload)) delete data.status
  const surfaceOp = data.surfaceOp
  const sourceEventSeqs = data.sourceEventSeqs
  delete data.surfaceOp
  delete data.sourceEventSeqs
  return {
    sessionId: event.sessionId,
    gatewaySequence: event.sequence,
    sourceType,
    nativeSequence: Number(nativeSequence),
    time: Date.parse(event.timestamp),
    data,
    ...(surfaceOp === undefined ? {} : { surfaceOp }),
    ...(sourceEventSeqs === undefined ? {} : { sourceEventSeqs }),
    wire: event,
  }
}

/** Extract admitted attachment references in the same order as the user message. */
export function attachmentRefsOf(data: Readonly<Record<string, unknown>>): readonly (ImageAttachmentRef | FileAttachmentRef)[] {
  const message = asRecord(data.message)
  const content = message?.content ?? data.content
  if (!Array.isArray(content)) return []
  const refs: (ImageAttachmentRef | FileAttachmentRef)[] = []
  for (const blockValue of content) {
    const block = asRecord(blockValue)
    const attachment = asRecord(block?.attachment)
    if (attachment === null || typeof attachment.attachmentId !== 'string' || typeof attachment.bytes !== 'number') continue
    if (block?.type === 'image' && typeof attachment.mediaType === 'string'
      && typeof attachment.width === 'number' && typeof attachment.height === 'number') {
      refs.push(attachment as unknown as ImageAttachmentRef)
    } else if (block?.type === 'file' && typeof attachment.name === 'string') {
      refs.push(attachment as unknown as FileAttachmentRef)
    }
  }
  return refs
}

/** Validate and decode the canonical `{attachment, data}` image read response. */
export function decodePcImageAttachment(
  input: unknown,
  requestedAttachmentId: AttachmentId,
): { readonly attachment: ImageAttachmentRef; readonly data: Uint8Array } {
  const value = asRecord(input)
  const raw = asRecord(value?.attachment)
  if (value === null || raw === null || typeof value.data !== 'string') {
    throw new Error('The remote image attachment response was malformed.')
  }
  if (raw.attachmentId !== requestedAttachmentId) throw new Error('The remote image attachment ID did not match the request.')
  const mediaType = parseImageMediaType(raw.mediaType)
  if (mediaType === null) {
    throw new Error('The remote image attachment media type was invalid.')
  }
  if (typeof raw.bytes !== 'number' || !Number.isSafeInteger(raw.bytes) || raw.bytes < 1 || raw.bytes > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error('The remote image attachment byte count was outside the supported range.')
  }
  const dimensions = parseImageDimensions(raw.width, raw.height)
  if (dimensions === null) throw new Error('The remote image attachment dimensions were invalid.')
  let name: string | undefined
  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string' || raw.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(raw.name)) {
      throw new Error('The remote image attachment name was invalid.')
    }
    name = raw.name
  }
  let originalDimensions: ImageAttachmentRef['originalDimensions']
  if (raw.originalDimensions !== undefined) {
    const dimensions = asRecord(raw.originalDimensions)
    const parsedDimensions = dimensions === null ? null : parseImageDimensions(dimensions.width, dimensions.height)
    if (parsedDimensions === null) {
      throw new Error('The remote image attachment original dimensions were invalid.')
    }
    originalDimensions = parsedDimensions
  }
  const data = decodeCanonicalBase64(value.data)
  if (data.byteLength !== raw.bytes) throw new Error('The remote image attachment byte count did not match its data.')
  const attachment: ImageAttachmentRef = {
    attachmentId: requestedAttachmentId,
    mediaType,
    bytes: raw.bytes,
    width: dimensions.width,
    height: dimensions.height,
    ...(name === undefined ? {} : { name }),
    ...(originalDimensions === undefined ? {} : { originalDimensions }),
  }
  return { attachment, data }
}

function parseImageMediaType(value: unknown): ImageMediaType | null {
  switch (value) {
    case 'image/png': case 'image/jpeg': case 'image/webp': case 'image/gif': return value
    default: return null
  }
}

function parseImageDimensions(width: unknown, height: unknown): { readonly width: number; readonly height: number } | null {
  if (typeof width !== 'number' || typeof height !== 'number'
    || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1 || width > MAX_REMOTE_IMAGE_DIMENSION || height > MAX_REMOTE_IMAGE_DIMENSION
    || width * height > MAX_REMOTE_IMAGE_PIXELS) return null
  return { width, height }
}

function decodeCanonicalBase64(input: string): Uint8Array {
  if (input.length === 0 || input.length > MAX_REMOTE_IMAGE_BASE64_CHARS
    || input.length % 4 !== 0) {
    throw new Error('The remote image attachment data was not valid bounded base64.')
  }
  const padding = input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0
  const contentLength = input.length - padding
  for (let index = 0; index < contentLength; index += 1) {
    const code = input.charCodeAt(index)
    const base64 = (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
      || (code >= 48 && code <= 57) || code === 43 || code === 47
    if (!base64) throw new Error('The remote image attachment data was not valid bounded base64.')
  }
  if (padding === 2 && contentLength % 4 !== 2 || padding === 1 && contentLength % 4 !== 3
    || padding === 0 && contentLength % 4 !== 0) {
    throw new Error('The remote image attachment data was not valid bounded base64.')
  }
  // RFC 4648 requires zero unused bits in the final sextet for canonical
  // encoding. Validate this directly rather than re-encoding a multi-MiB
  // binary string or running a large backtracking regular expression.
  if (padding > 0) {
    const sextet = base64Sextet(input.charCodeAt(contentLength - 1))
    const unusedMask = padding === 2 ? 0x0f : 0x03
    if (sextet === -1 || (sextet & unusedMask) !== 0) {
      throw new Error('The remote image attachment data was not canonical base64.')
    }
  }
  let binary: string
  try { binary = atob(input) } catch { throw new Error('The remote image attachment data was not valid bounded base64.') }
  const data = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index)
  return data
}

function base64Sextet(code: number): number {
  if (code >= 65 && code <= 90) return code - 65
  if (code >= 97 && code <= 122) return code - 97 + 26
  if (code >= 48 && code <= 57) return code - 48 + 52
  if (code === 43) return 62
  if (code === 47) return 63
  return -1
}

function statusFor(sourceType: string, payload: Readonly<Record<string, unknown>>): string | undefined {
  if (sourceType === 'turn/start') return 'running'
  if (sourceType !== 'turn/end') return undefined
  const reason = asRecord(payload.reason)?.kind
  return reason === 'error' ? 'error' : reason === 'aborted' || reason === 'interrupted' ? 'interrupted' : 'idle'
}

function decodeSession(input: unknown): PcRemoteSession | null {
  const value = asRecord(input)
  if (value === null || !nonEmpty(value.id) || !nonEmpty(value.workspaceId) || !nonEmpty(value.provider)
    || typeof value.title !== 'string' || !isSessionStatus(value.status)
    || !isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || typeof value.archived !== 'boolean') return null
  if (value.model !== undefined && typeof value.model !== 'string') return null
  return {
    id: value.id,
    workspaceId: value.workspaceId,
    provider: value.provider,
    title: value.title,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    archived: value.archived,
    ...(typeof value.model === 'string' ? { model: value.model } : {}),
  }
}

function parseResult(resultJson: string): PcNativeSessionResult<Record<string, unknown>> {
  try {
    const value = asRecord(JSON.parse(resultJson) as unknown)
    return value === null
      ? failure({ code: 'invalid-json', message: 'The remote response was not a JSON object.' })
      : { ok: true, value }
  } catch {
    return failure({ code: 'invalid-json', message: 'The remote response was not valid JSON.' })
  }
}

function decodeEvent(input: unknown, expectedSessionId: string): PcRemoteEvent | null {
  const value = asRecord(input)
  if (value === null || value.sessionId !== expectedSessionId || !Number.isSafeInteger(value.sequence)
    || Number(value.sequence) < 1 || typeof value.type !== 'string' || value.type.length === 0
    || !isIsoDate(value.timestamp)) return null
  const payload = asRecord(value.payload)
  if (payload === null) return null
  return { sessionId: expectedSessionId, sequence: Number(value.sequence), type: value.type, timestamp: value.timestamp, payload }
}

function isSessionStatus(value: unknown): value is PcRemoteSession['status'] {
  return value === 'idle' || value === 'running' || value === 'waitingApproval' || value === 'error' || value === 'interrupted'
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function failure(error: PcNativeSessionDecodeError): PcNativeSessionResult<never> {
  return { ok: false, error }
}
