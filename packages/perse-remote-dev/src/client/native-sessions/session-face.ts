import { MutableSessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import type {
  BeginSubmissionInput,
  PendingSubmission,
  PendingSubmissionRetirement,
  SessionFace,
  SessionAssistantSettlementEntry,
  SessionEventLikeEntry,
  SessionEventSource,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { PromptContentPart, QueueAction, SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SessionSeq, SessionId } from '@deepseek-ai/dsh-session/types'
import type { LlmAttemptId } from '@deepseek-ai/dsh-llm/brand'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteErrorCode, RemoteErrorDetailsMap } from '@deepseek-ai/dsh-typert-protocol'
import type { AttachmentId, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment/types'
import type { PcRemote } from '../connections/types.ts'
import type {
  ExternalSessionOpenRequest,
  NativeRemoteFailure,
  NativeRemoteResult,
  NativeSessionFace,
  NativeSessionSnapshot,
} from './core-types.ts'
import { PcApprovalSource } from './approval-source.ts'
import { PcGatewayEventSource } from './gateway-event-source.ts'
import { pcSubmissionReceipts, prepareSubmissionReceipt } from './submission-receipts.ts'
import { SubmissionEchoLedger } from './submission-echo-ledger.ts'
import { reconcileLiveSessionRead } from './live-state.ts'
import type { NativeEventEntry } from './event-types.ts'
import {
  decodePcSessionRead,
  decodePcImageAttachment,
  nativeEventOf,
  attachmentRefsOf,
  type PcRemoteEvent,
  type PcRemoteSession,
  type PcRemoteSessionRead,
} from './protocol.ts'

const MAX_SESSION_EVENTS = 100_000
const MAX_SESSION_JOURNAL_BYTES = 32 * 1024 * 1024
const POLL_INTERVAL_MS = 1_500
const KNOWN_NATIVE_TYPES = new Set([
  'agent-preset/selected', 'agent/inbox/spliced', 'approval/asked', 'approval/decided', 'approval/policy',
  'assistant/attempt', 'assistant/message', 'compaction/end', 'compaction/prune', 'compaction/start', 'compaction/summary',
  'command/done', 'command/run', 'deliverables/presented', 'developer/message', 'feedback/message-delete',
  'feedback/message-put', 'feedback/record', 'goal/change', 'hook/invoked', 'hook/result', 'image/offload',
  'job/registered', 'job/settled', 'llm/retry', 'llm/retry-started', 'model/selection', 'permission/preset',
  'plan/mode', 'request/context', 'request/header', 'sandbox/mode', 'schedule/change',
  'session-log-deepseek/delivery-accepted', 'session/end-seed', 'session/title', 'session/title-llm-request',
  'step/end', 'step/start', 'subagent/catalog', 'subagent/descriptor', 'system/message', 'team/member',
  'team/message/delivered', 'team/message/queued', 'team/task', 'tool-workflow/agent-end',
  'tool-workflow/agent-start', 'tool-workflow/run-end', 'tool-workflow/run-start', 'tool/call',
  'tool/ptc-dispatch', 'tool/ptc-dispatch-start', 'tool/result', 'turn/end', 'turn/start',
  'user/message', 'web/deepseek-search-llm-request', 'working-directory/change', 'workspace/changes',
])

type SessionSnapshot = NativeSessionSnapshot

interface ProjectionSnapshot {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
}

/** Native SessionFace backed only by the captured external host generation. */
export class PcNativeSessionFace implements NativeSessionFace, SessionFace {
  readonly projections = new PcProjectionStore()
  readonly eventSource: SessionEventSource = new MutableSessionEventSource()
  private readonly mutableEvents: MutableSessionEventSource = this.eventSource as MutableSessionEventSource
  readonly approvals = new PcApprovalSource()
  readonly gatewayEvents = new PcGatewayEventSource()
  private readonly listeners = new Set<() => void>()
  private readonly sourceEntries = new Map<number, NativeEventEntry>()
  private readonly seenGatewaySequences = new Set<number>()
  private readonly seenNativeSequences = new Set<number>()
  private gatewayRecordCount = 0
  private journalBytes = 0
  private pending: readonly PendingSubmission[] = []
  private currentSession: PcRemoteSession | undefined
  private cursor = 0
  private lastNativeSequence = -1
  private modelSelectionState: { lastUsed: Record<string, unknown> | null; pending: Record<string, unknown> | null } = { lastUsed: null, pending: null }
  private transientCount = 0
  private pollTimer: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private polling = false
  private running = false
  private blank = true
  private promptAttempted = false
  private awaitingFirstTurn = false
  private lastAgentError: string | null = null
  private openError: NativeRemoteFailure | null = null
  private openState: SessionSnapshot['openState'] = 'cold'
  private promptError: SessionSnapshot['promptError'] = null
  private readonly pendingRetire = new Map<SessionRequestId, (result: PendingSubmissionRetirement) => void>()
  private readonly submissionEchoes = new SubmissionEchoLedger()
  private promptInFlight = false
  private snapshotCache: SessionSnapshot

  constructor(
    readonly sessionId: SessionId,
    private readonly remoteSessionId: string,
    private readonly request: ExternalSessionOpenRequest,
    private readonly remote: PcRemote,
    private readonly isCurrent: () => boolean,
    private readonly onCatalogUpdate: (session: PcRemoteSession) => void,
    private readonly onOffline: (reason: unknown) => void,
    private readonly onDisposed?: () => void,
    initialTitle?: string,
  ) {
    this.projections.set('title', initialTitle ?? remoteSessionId)
    this.snapshotCache = this.buildSnapshot()
    this.request.signal.addEventListener('abort', this.onAbort, { once: true })
    if (this.request.signal.aborted) this.dispose()
  }

  getSnapshot = (): SessionSnapshot => this.snapshotCache

  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  beginSubmission(input: BeginSubmissionInput): { readonly requestId: SessionRequestId; abandon(): void } {
    const requestId = uuid() as SessionRequestId
    const placement = this.running ? input.mode === 'steer' ? 'steering' : 'queued' : 'transcript'
    const pending: PendingSubmission = {
      requestId, placement, time: Date.now(), text: input.text, attachments: input.attachments,
    }
    this.pending = [...this.pending, pending]
    if (input.onRetire !== undefined) this.pendingRetire.set(requestId, input.onRetire)
    this.promptAttempted = true
    if (this.blank) this.awaitingFirstTurn = true
    this.publish()
    let abandoned = false
    return {
      requestId,
      abandon: () => {
        if (abandoned) return
        abandoned = true
        this.retireSubmission(requestId, { reason: 'failed' })
      },
    }
  }

  async prompt(content: PromptContentPart[], mode: 'queue' | 'steer', signal?: AbortSignal, requestId?: SessionRequestId): Promise<RemoteResultValue<{ accepted: true }>> {
    const requestIdValue = requestId ?? uuid() as SessionRequestId
    if (mode === 'steer') return this.rejectPrompt(requestId, makeRemoteError('remote-dev/pc-native-capability-unavailable', 'This remote host supports queued prompts but not steer.', { method: 'session.prompt', capability: 'steer' }))
    if (signal?.aborted) return this.rejectPrompt(requestId, makeRemoteError('remote-dev/pc-transport-failed', 'The remote prompt was cancelled before dispatch.', { profileId: this.request.address.backendId, method: 'session.prompt', reason: 'aborted before dispatch' }))
    if (this.promptInFlight) return this.rejectPrompt(requestId, makeRemoteError('remote-dev/pc-native-session-unavailable', 'Another remote prompt is still resolving; wait before submitting again.', { requiredApi: 'session.prompt idempotency' }))
    const encoded = encodePrompt(content)
    if (!encoded.ok) return this.rejectPrompt(requestId, makeRemoteError('remote-dev/pc-native-capability-unavailable', encoded.message, { method: 'session.prompt', capability: encoded.capability }))
    const receiptBase = {
      profileId: this.request.address.backendId,
      hostId: this.request.address.hostId,
      workspaceId: this.request.address.workspaceId,
      sessionId: this.remoteSessionId,
    }
    const prepared = await prepareSubmissionReceipt(pcSubmissionReceipts, receiptBase, requestIdValue, JSON.stringify({ text: encoded.text, attachments: encoded.attachments }))
    if (!prepared.ok) return this.rejectPrompt(requestId, makeRemoteError('remote-dev/pc-native-session-unavailable', prepared.message, { requiredApi: prepared.reason }))
    const { receipt } = prepared
    const remoteRequestId = receipt.clientMessageId
    const duplicateLocalRequestId = this.submissionEchoes.bind(remoteRequestId, requestIdValue)
    if (duplicateLocalRequestId !== undefined) {
      // A retry echo represents the same uncertain remote prompt. Keep the
      // original echo and retire the duplicate local presentation row.
      this.retireSubmission(duplicateLocalRequestId, { reason: 'failed' })
    }
    this.promptInFlight = true
    this.promptAttempted = true
    this.blank = false
    this.promptError = null
    this.publish()
    try {
      const result = await this.call('session.prompt', {
        sessionId: this.remoteSessionId,
        text: encoded.text,
        clientMessageId: remoteRequestId,
        ...(encoded.attachments.length > 0 ? { attachments: encoded.attachments } : {}),
      }, signal)
      const receiptPayload = asRecord(result)
      if (receiptPayload?.accepted !== true || typeof receiptPayload.messageId !== 'string') throw invalidSession(this.remoteSessionId, 'the prompt receipt was malformed')
      pcSubmissionReceipts.clear(receipt)
      return { ok: true, value: { accepted: true } }
    } catch (error) {
      this.promptError = { op: 'send', error: asRemoteFailure(error) }
      if (isDefiniteRemoteRejection(error)) {
        pcSubmissionReceipts.clear(receipt)
        const localRequestId = this.submissionEchoes.take(remoteRequestId, requestIdValue)
        this.retireSubmission(localRequestId, { reason: 'failed' })
        if (requestId !== undefined && requestId !== localRequestId) this.retireSubmission(requestId, { reason: 'failed' })
        if (requestId === undefined) this.publish()
      } else this.publish()
      return { ok: false, error: asRemoteFailure(error) }
    } finally {
      this.promptInFlight = false
    }
  }

  private rejectPrompt(requestId: SessionRequestId | undefined, error: RemoteErrorLike): RemoteResultValue<never> {
    this.promptError = { op: 'send', error }
    if (requestId !== undefined) this.retireSubmission(requestId, { reason: 'failed' })
    else this.publish()
    return { ok: false, error }
  }

  async readAttachment(attachmentId: AttachmentId): Promise<RemoteResultValue<{ attachment: ImageAttachmentRef; data: Uint8Array }>> {
    try {
      const value = await this.call('session.attachment', { sessionId: this.remoteSessionId, attachmentId })
      return { ok: true, value: decodePcImageAttachment(value, attachmentId) }
    } catch (error) {
      return { ok: false, error: asRemoteFailure(error) }
    }
  }

  async updateQueue(_itemId: import('@deepseek-ai/dsh-llm/brand').MessageId, _action: QueueAction): Promise<RemoteResultValue<{ accepted: true }>> {
    return remoteFailure('remote-dev/pc-native-capability-unavailable', 'Perse 1.2 does not expose native queue edit/remove operations.', { method: 'session.updateQueue', capability: 'queueEdit' })
  }

  async cancel(): Promise<RemoteResultValue<{ accepted: true }>> {
    try {
      await this.call('session.interrupt', { sessionId: this.remoteSessionId })
      return { ok: true, value: { accepted: true } }
    } catch (error) {
      this.promptError = { op: 'stop', error: asRemoteFailure(error) }
      this.publish()
      return { ok: false, error: asRemoteFailure(error) }
    }
  }

  async respondApproval(approvalId: string, decision: 'allowOnce' | 'deny', signal?: AbortSignal): Promise<void> {
    const pending = this.approvals.getSnapshot().pending.find(item => item.approvalId === approvalId)
    if (pending === undefined || !pending.choices.includes(decision)) {
      throw invalidSession(this.remoteSessionId, 'the approval is no longer pending on this Session or does not offer that decision')
    }
    await this.call('approval.respond', {
      sessionId: this.remoteSessionId,
      approvalId,
      decision,
    }, signal)
  }

  async rename(title: string): Promise<RemoteResultValue<{ title: string; seq: SessionSeq }>> {
    try {
      const result = asRecord(await this.call('session.rename', { sessionId: this.remoteSessionId, title }))
      const renamed = asRecord(result?.session)
      const acceptedTitle = stringOf(renamed?.title)
      if (acceptedTitle === undefined) throw invalidSession(this.remoteSessionId, 'the host rename receipt did not include the accepted title')
      this.projections.set('title', acceptedTitle)
      return { ok: true, value: { title: acceptedTitle, seq: Math.max(0, this.lastNativeSequence) as SessionSeq } }
    } catch (error) {
      return { ok: false, error: asRemoteFailure(error) }
    }
  }

  async loadOlder(): Promise<void> {
    // Initial open exhausts the authoritative forward cursor in bounded pages;
    // protocol 1.2 has no backwards page operation.
  }

  async loadThrough(sequence: SessionSeq): Promise<void> {
    if (this.sourceEntries.has(sequence)) return
    throw makeRemoteError('remote-dev/pc-native-session-invalid', 'The requested native sequence is not present in the loaded remote journal.', {
      sessionId: this.remoteSessionId, reason: `native sequence ${sequence} is not in the loaded journal`,
    })
  }

  async command(_line: string): Promise<RemoteResultValue<{ matched: boolean }>> {
    return remoteFailure('remote-dev/pc-native-capability-unavailable', 'The Perse 1.2 contract does not expose the native slash-command endpoint.', { method: 'session.command', capability: 'command' })
  }

  async open(): Promise<void> {
    if (this.disposed) throw new Error('remote session is disposed')
    this.openState = 'loading'
    this.publish()
    try {
      const entries: NativeEventEntry[] = []
      let total = 0
      let firstPage = true
      while (true) {
        const page = await this.readPage(this.cursor, firstPage)
        this.assertLiveGeneration()
        if (firstPage && page.retentionFloor > 1) {
          this.openError = asRemoteFailure(makeRemoteError('remote-dev/pc-native-history-expired', 'The host no longer retains the beginning of this session history; showing the retained portion.', {
            sessionId: this.remoteSessionId, afterSequence: 0, retentionFloor: page.retentionFloor,
          }))
        }
        if (page.events.length === 0) this.cursor = Math.max(this.cursor, page.retentionFloor - 1)
        firstPage = false
        this.currentSession = page.session
        this.projections.set('status', { status: page.session.status })
        this.onCatalogUpdate(page.session)
        const mapped = this.mapEvents(page.events)
        entries.push(...mapped)
        total += page.events.length
        if (total > MAX_SESSION_EVENTS) throw invalidSession(this.remoteSessionId, `history exceeds the ${MAX_SESSION_EVENTS} event safety limit`)
        if (page.events.length > 0) this.cursor = page.events.at(-1)!.sequence
        if (page.events.length < 5_000) break
      }
      if (this.currentSession !== undefined) this.projections.set('title', this.currentSession.title)
      this.mutableEvents.replace(collapseSettledTransients(entries) as readonly SessionEventLikeEntry[], false)
      this.running = sessionIsRunning(this.currentSession?.status)
      this.blank = !entries.some((entry) => entry.type === 'event' && isTurnOrMessageEvent(entry.event.type))
      this.openState = 'open'
      this.publish()
      this.schedulePoll()
    } catch (error) {
      this.openState = 'error'
      this.openError = asRemoteFailure(error)
      if (isConnectionFailure(error)) this.onOffline(error)
      this.publish()
      throw error
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.pollTimer !== undefined) clearTimeout(this.pollTimer)
    this.pollTimer = undefined
    this.request.signal.removeEventListener('abort', this.onAbort)
    this.approvals.dispose()
    this.gatewayEvents.dispose()
    this.listeners.clear()
    for (const [id, retire] of this.pendingRetire) {
      retire({ reason: 'failed' })
      this.pendingRetire.delete(id)
    }
    this.onDisposed?.()
  }

  private readonly onAbort = (): void => { this.dispose() }

  private async readAfterCursor(): Promise<void> {
    if (this.disposed || this.polling) return
    this.polling = true
    try {
      while (!this.disposed && this.isCurrent()) {
        const page = await this.readPage(this.cursor)
        if (this.disposed || !this.isCurrent() || this.request.signal.aborted) return
        this.currentSession = page.session
        this.projections.set('status', { status: page.session.status })
        this.onCatalogUpdate(page.session)
        const entries = this.mapEvents(page.events)
        const liveState = reconcileLiveSessionRead({
          running: this.running,
          blank: this.blank,
          awaitingFirstTurn: this.awaitingFirstTurn,
        }, page.session.status, page.events
          .map(event => nativeEventOf(event)?.sourceType)
          .filter((sourceType): sourceType is string => sourceType !== undefined), page.events.length > 0)
        this.running = liveState.state.running
        this.blank = liveState.state.blank
        this.awaitingFirstTurn = liveState.state.awaitingFirstTurn
        for (const entry of entries) this.appendEntry(entry)
        this.projections.set('title', page.session.title)
        if (page.events.length > 0) this.cursor = page.events.at(-1)!.sequence
        if (liveState.shouldPublish) this.publish()
        if (page.events.length < 5_000) break
      }
    } catch (error) {
      if (!this.disposed) {
        if (isHistoryExpired(error)) {
          try {
            await this.recoverExpiredHistory(error)
            return
          } catch (recoveryError) {
            error = recoveryError
          }
        }
        this.openState = 'error'
        this.openError = asRemoteFailure(error)
        if (isConnectionFailure(error)) this.onOffline(error)
        this.publish()
      }
    } finally {
      this.polling = false
    }
  }

  private schedulePoll(): void {
    if (this.disposed || this.request.signal.aborted || !this.isCurrent()) return
    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined
      void this.readAfterCursor().finally(() => this.schedulePoll())
    }, POLL_INTERVAL_MS)
  }

  private async recoverExpiredHistory(expiredError: unknown): Promise<void> {
    // A cursor can expire while the native session remains open. Re-read the
    // host's retained baseline into an isolated face. Commit only after every
    // retained page decoded, so a later page failure cannot leave half a reset.
    const staged = new PcNativeSessionFace(
      this.sessionId, this.remoteSessionId, this.request, this.remote,
      this.isCurrent, () => undefined, () => undefined,
    )
    const entries: NativeEventEntry[] = []
    let total = 0
    let firstPage = true
    try {
      while (true) {
        this.assertLiveGeneration()
        const page = await staged.readPage(staged.cursor, firstPage)
        this.assertLiveGeneration()
        firstPage = false
        staged.currentSession = page.session
        staged.projections.set('status', { status: page.session.status })
        staged.projections.set('title', page.session.title)
        entries.push(...staged.mapEvents(page.events, true))
        total += page.events.length
        if (total > MAX_SESSION_EVENTS) throw invalidSession(this.remoteSessionId, `retained history exceeds ${MAX_SESSION_EVENTS} events`)
        if (page.events.length > 0) staged.cursor = page.events.at(-1)!.sequence
        else staged.cursor = Math.max(staged.cursor, page.retentionFloor - 1)
        if (page.events.length < 5_000) break
      }
    } catch (error) {
      staged.dispose()
      throw error
    }
    this.sourceEntries.clear()
    for (const [sequence, entry] of staged.sourceEntries) this.sourceEntries.set(sequence, entry)
    this.seenGatewaySequences.clear()
    for (const sequence of staged.seenGatewaySequences) this.seenGatewaySequences.add(sequence)
    this.seenNativeSequences.clear()
    for (const sequence of staged.seenNativeSequences) this.seenNativeSequences.add(sequence)
    this.gatewayRecordCount = staged.gatewayRecordCount
    this.journalBytes = staged.journalBytes
    this.transientCount = staged.transientCount
    this.lastNativeSequence = staged.lastNativeSequence
    this.cursor = staged.cursor
    this.currentSession = staged.currentSession
    this.modelSelectionState = staged.modelSelectionState
    this.lastAgentError = staged.lastAgentError
    this.promptError = null
    this.projections.set('status', { status: staged.currentSession?.status ?? 'idle' })
    this.projections.set('title', staged.currentSession?.title ?? this.remoteSessionId)
    this.projections.set('modelSelection', {
      lastUsed: staged.modelSelectionState.lastUsed,
      next: staged.modelSelectionState.pending ?? staged.modelSelectionState.lastUsed,
    })
    this.approvals.replaceAll(staged.approvals.getSnapshot().pending)
    this.gatewayEvents.replaceAll(staged.gatewayEvents.getSnapshot().events)
    this.mutableEvents.replace(collapseSettledTransients(entries) as readonly SessionEventLikeEntry[], false)
    this.running = sessionIsRunning(this.currentSession?.status)
    this.blank = !entries.some(entry => entry.type === 'event' && isTurnOrMessageEvent(entry.event.type))
    this.awaitingFirstTurn = false
    if (this.currentSession !== undefined) this.onCatalogUpdate(this.currentSession)
    staged.dispose()
    this.openError = asRemoteFailure(expiredError)
    this.openState = 'open'
    this.publish()
  }

  private async readPage(afterSequence: number, allowExpiredBaseline = false): Promise<PcRemoteSessionRead> {
    const resultJson = await this.call('session.read', { sessionId: this.remoteSessionId, afterSequence }, this.request.signal)
    const decoded = decodePcSessionRead(JSON.stringify(resultJson), this.remoteSessionId, afterSequence, allowExpiredBaseline)
    if (!decoded.ok) {
      if (decoded.error.code === 'cursor-expired') {
        throw makeRemoteError('remote-dev/pc-native-history-expired', decoded.error.message, {
          sessionId: this.remoteSessionId,
          afterSequence: decoded.error.afterSequence,
          retentionFloor: decoded.error.retentionFloor,
        })
      }
      throw invalidSession(this.remoteSessionId, decoded.error.message)
    }
    return decoded.value
  }

  private assertLiveGeneration(): void {
    if (this.disposed || !this.isCurrent() || this.request.signal.aborted) {
      throw staleGeneration(this.request.address.backendId, this.request.generation)
    }
  }

  private mapEvents(events: readonly PcRemoteEvent[], stagingRecovery = false): NativeEventEntry[] {
    const entries: NativeEventEntry[] = []
    for (const wire of events) {
      if (this.seenGatewaySequences.has(wire.sequence)) continue
      if (this.seenGatewaySequences.size >= MAX_SESSION_EVENTS) {
        throw invalidSession(this.remoteSessionId, `journal exceeds the ${MAX_SESSION_EVENTS} event safety limit`)
      }
      const wireBytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength
      if (this.journalBytes + wireBytes > MAX_SESSION_JOURNAL_BYTES) {
        throw invalidSession(this.remoteSessionId, `journal exceeds the ${MAX_SESSION_JOURNAL_BYTES}-byte safety limit`)
      }
      this.journalBytes += wireBytes
      this.seenGatewaySequences.add(wire.sequence)
      if (wire.type === 'approval' && wire.payload.nativeSequence === undefined && wire.payload.sourceType === undefined) {
        this.mapApprovalEvent(wire)
        continue
      }
      const native = nativeEventOf(wire)
      if (native === null) {
        const transient = transientEventOf(wire, this.sessionId, this.lastNativeSequence, this.transientCount)
        if (transient !== null) {
          this.transientCount += 1
          entries.push(transient)
          continue
        }
        this.mapGatewayOnlyEvent(wire)
        continue
      }
      if (this.seenNativeSequences.has(native.nativeSequence)) continue
      this.seenNativeSequences.add(native.nativeSequence)
      this.lastNativeSequence = Math.max(this.lastNativeSequence, native.nativeSequence)
      const opaque = !KNOWN_NATIVE_TYPES.has(native.sourceType)
      const event = opaque
        ? {
          type: 'external/opaque', seq: native.nativeSequence, time: native.time, ignorable: true,
          data: {
            sourceType: native.sourceType,
            remoteSequence: native.gatewaySequence,
            payload: wire.payload,
            ...(numberOf(native.data.turn) === undefined ? {} : { turn: numberOf(native.data.turn) }),
            ...(numberOf(native.data.step) === undefined ? {} : { step: numberOf(native.data.step) }),
          },
          ...(native.surfaceOp === undefined ? {} : { surfaceOp: native.surfaceOp }),
          ...(Array.isArray(native.sourceEventSeqs) ? { sourceEventSeqs: native.sourceEventSeqs } : {}),
        }
        : {
          type: native.sourceType,
          seq: native.nativeSequence,
          time: native.time,
          data: native.data,
          ...(native.surfaceOp === undefined ? {} : { surfaceOp: native.surfaceOp }),
          ...(Array.isArray(native.sourceEventSeqs) ? { sourceEventSeqs: native.sourceEventSeqs } : {}),
        }
      const entry: NativeEventEntry = { type: 'event', event }
      this.sourceEntries.set(native.nativeSequence, entry)
      if (!opaque && native.sourceType === 'assistant/message') {
        const attemptId = stringOf(native.data.messageId)
        if (attemptId !== undefined) {
          entries.push(entry)
          continue
        }
      }
      if (native.sourceType === 'turn/start') {
        this.running = true
        this.awaitingFirstTurn = false
        this.blank = false
      }
      else if (native.sourceType === 'turn/end') {
        this.running = false
      }
      if (native.sourceType === 'error' || native.sourceType.endsWith('/error')) {
        this.lastAgentError = stringOf(native.data.message) ?? 'Remote session reported an error.'
      }
      if (native.sourceType === 'session/title' && typeof native.data.title === 'string') {
        this.projections.set('title', native.data.title)
      }
      this.foldModelSelection(native.sourceType, native.data)
      if (native.sourceType === 'user/message') {
        this.blank = false
        const source = asRecord(native.data.source)
        const rpcId = stringOf(source?.rpcId) ?? stringOf(native.data.rpcId) ?? ''
        this.promptError = null
        if (rpcId !== '' && !stagingRecovery) {
          const receipt = pcSubmissionReceipts.uncertainFor({
            profileId: this.request.address.backendId, hostId: this.request.address.hostId,
            workspaceId: this.request.address.workspaceId, sessionId: this.remoteSessionId,
          })
          if (receipt?.clientMessageId === rpcId) pcSubmissionReceipts.clear(receipt)
          const localRequestId = this.submissionEchoes.take(rpcId, rpcId as SessionRequestId)
          this.retireSubmission(localRequestId, { reason: 'observed', attachments: attachmentRefsOf(native.data) })
        }
      }
      entries.push(entry)
    }
    return entries
  }

  private mapApprovalEvent(wire: PcRemoteEvent): void {
    this.appendGatewayRecord(wire)
    const approvalId = stringOf(wire.payload.approvalId)
    if (approvalId === undefined) return
    if (wire.payload.resolved === true) {
      this.approvals.resolve(approvalId)
      this.running = sessionIsRunning(this.currentSession?.status)
      this.publish()
      return
    }
    const choices = Array.isArray(wire.payload.choices)
      ? wire.payload.choices.filter((choice): choice is 'allowOnce' | 'deny' => choice === 'allowOnce' || choice === 'deny')
      : []
    if (choices.length === 0 || typeof wire.payload.title !== 'string' || typeof wire.payload.detail !== 'string') return
    this.approvals.upsert({
      approvalId,
      title: wire.payload.title,
      detail: wire.payload.detail,
      choices,
      remoteSequence: wire.sequence,
    })
    this.running = true
    this.blank = false
    this.publish()
  }

  private mapGatewayOnlyEvent(wire: PcRemoteEvent): void {
    this.appendGatewayRecord(wire)
    if (wire.type === 'status') {
      const status = stringOf(wire.payload.status)
      if (status === 'running' || status === 'waitingApproval') this.running = true
      else if (status === 'idle' || status === 'error' || status === 'interrupted') this.running = false
      if (status !== undefined) this.projections.set('status', { status })
    } else if (wire.type === 'error') {
      this.lastAgentError = stringOf(wire.payload.message) ?? 'Remote session reported an error.'
    }
    this.publish()
  }

  private appendGatewayRecord(wire: PcRemoteEvent): void {
    this.gatewayRecordCount += 1
    if (this.gatewayRecordCount > MAX_SESSION_EVENTS) {
      throw invalidSession(this.remoteSessionId, `gateway journal exceeds the ${MAX_SESSION_EVENTS} event safety limit`)
    }
      this.gatewayEvents.append({ remoteSequence: wire.sequence, event: wire as unknown as import('./core-types.ts').ExternalGatewayEvent['event'] })
  }

  private foldModelSelection(sourceType: string, data: Readonly<Record<string, unknown>>): void {
    if (sourceType === 'model/selection') {
      const selected = modelSelectionOf(data)
      if (selected !== null) this.modelSelectionState = { ...this.modelSelectionState, pending: selected }
    } else if (sourceType === 'request/header') {
      const header = asRecord(data.header)
      const config = asRecord(header?.config)
      const selected = config === null ? null : modelSelectionOf(config)
      if (selected !== null) {
        const pending = sameModel(this.modelSelectionState.pending, selected) ? null : this.modelSelectionState.pending
        this.modelSelectionState = { lastUsed: selected, pending }
      }
    }
    this.projections.set('modelSelection', {
      lastUsed: this.modelSelectionState.lastUsed,
      next: this.modelSelectionState.pending ?? this.modelSelectionState.lastUsed,
    })
  }

  private appendEntry(entry: NativeEventEntry): void {
    if (entry.type === 'event' && (entry.event.type === 'assistant/message' || entry.event.type === 'assistant/attempt')) {
      const data = asRecord(entry.event.data)
      const attemptId = stringOf(data?.attemptId) ?? stringOf(data?.messageId)
      if (attemptId !== undefined) {
        this.mutableEvents.settleAssistant(attemptId as LlmAttemptId, entry as SessionAssistantSettlementEntry)
        return
      }
    }
    if (entry.type === 'event' && entry.event.type === 'turn/end') {
      for (const current of this.eventSource.getSnapshot().entries) {
        if (current.type === 'transient') this.mutableEvents.settleAssistant(current.event.data.attemptId)
      }
    }
    this.mutableEvents.append(entry as unknown as SessionEventLikeEntry)
  }

  private async call(method: string, params: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<unknown> {
    if (this.disposed || this.request.signal.aborted || !this.isCurrent()) throw staleGeneration(this.request.address.backendId, this.request.generation)
    signal?.throwIfAborted()
    const outcome = await this.remote.pcCall({
      profileId: this.request.address.backendId,
      generation: this.request.generation,
      method,
      paramsJson: JSON.stringify(params),
    }, signal)
    if (!outcome.ok) throw outcome.error
    let result: unknown
    try { result = JSON.parse(outcome.value.resultJson) as unknown } catch {
      throw invalidSession(this.remoteSessionId, `the ${method} response was invalid JSON`)
    }
    return result
  }

  private retireSubmission(requestId: SessionRequestId, result: PendingSubmissionRetirement): void {
    if (requestId === '') return
    const pending = this.pending.find((item) => item.requestId === requestId)
    if (pending === undefined) return
    this.pending = this.pending.filter((item) => item.requestId !== requestId)
    if (this.pending.length === 0 && this.blank) this.awaitingFirstTurn = false
    const callback = this.pendingRetire.get(requestId)
    this.pendingRetire.delete(requestId)
    callback?.(result)
    this.publish()
  }

  private buildSnapshot(): SessionSnapshot {
    return {
      sessionId: this.sessionId,
      pendingSubmissions: this.pending,
      running: this.running,
      subagent: null,
      removed: false,
      openState: this.openState,
      openError: this.openError,
      hasMore: false,
      loadingOlder: false,
      promptError: this.promptError,
      blank: this.blank,
      lastAgentError: this.lastAgentError,
      promptAttempted: this.promptAttempted,
      awaitingFirstTurn: this.awaitingFirstTurn,
    }
  }

  private publish(): void {
    this.snapshotCache = this.buildSnapshot()
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* isolate subscriber failures from remote polling */ }
    }
  }
}

export type RemoteErrorLike = NativeRemoteFailure
export type RemoteResultValue<T> = NativeRemoteResult<T>

function encodePrompt(parts: readonly PromptContentPart[]): { ok: true; text: string; attachments: readonly { mimeType: string; data: string; name?: string }[] } | { ok: false; capability: string; message: string } {
  const textParts: string[] = []
  const attachments: { mimeType: string; data: string; name?: string }[] = []
  for (const part of parts) {
    if (part.type === 'text') {
      if (typeof part.text !== 'string') return { ok: false, capability: 'prompt', message: 'The native prompt contained an invalid text part.' }
      textParts.push(part.text)
    } else if (part.type === 'image') {
      if (typeof part.mediaType !== 'string' || typeof part.data !== 'string') return { ok: false, capability: 'attachments', message: 'The native image attachment was invalid.' }
      attachments.push({ mimeType: part.mediaType, data: part.data, ...(typeof part.name === 'string' ? { name: part.name } : {}) })
    } else {
      return { ok: false, capability: 'fileUpload', message: 'File upload receipts cannot be sent through the current Perse Remote contract.' }
    }
  }
  return { ok: true, text: textParts.join(''), attachments }
}

function transientEventOf(wire: PcRemoteEvent, clientSessionId: string, lastNativeSeq: number, transientCount: number): NativeEventEntry | null {
  if (wire.type !== 'assistantDelta' && wire.type !== 'thinking') return null
  const turn = numberOf(wire.payload.turn)
  const step = numberOf(wire.payload.step)
  const attemptId = stringOf(wire.payload.messageId)
  const text = stringOf(wire.payload.text)
  if (turn === undefined || step === undefined || attemptId === undefined || text === undefined) return null
  const seq = lastNativeSeq + 1 - 1 / (transientCount + 2)
  return {
    type: 'transient',
    event: {
      type: 'assistant/live-chunk', seq,
      time: Date.parse(wire.timestamp),
      data: {
        attemptId,
        turn,
        step,
        chunk: { type: wire.type === 'thinking' ? 'reasoning-delta' : 'text-delta', text },
      },
      remoteSequence: wire.sequence,
      sessionId: clientSessionId,
    },
  }
}

function remoteFailure(
  code: 'remote-dev/pc-native-capability-unavailable',
  message: string,
  details: { readonly method: string; readonly capability: string },
): RemoteResultValue<never> {
  return { ok: false, error: makeRemoteError(code, message, details) }
}

function staleGeneration(profileId: string, generation: string): RemoteErrorLike {
  return makeRemoteError('remote-dev/pc-generation-stale', 'The remote session belongs to an expired connection generation.', {
    profileId, expectedGeneration: generation,
  })
}

function invalidSession(sessionId: string, reason: string): RemoteErrorLike {
  return makeRemoteError('remote-dev/pc-native-session-invalid', 'The remote native session response was invalid.', { sessionId, reason })
}

function asRemoteFailure(error: unknown): RemoteErrorLike {
  if (isRemoteError(error)) return error
  return makeRemoteError('remote-dev/pc-transport-failed', 'The remote session request failed.', {
    profileId: 'unknown', method: 'session', reason: error instanceof Error ? error.name : 'unknown failure',
  })
}

function isHistoryExpired(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { isDSHRemoteError?: unknown }).isDSHRemoteError === true
    && (error as { code?: unknown }).code === 'remote-dev/pc-native-history-expired'
}

function isRemoteError(error: unknown): error is RemoteErrorLike {
  return typeof error === 'object' && error !== null
    && (error as { isDSHRemoteError?: unknown }).isDSHRemoteError === true
    && typeof (error as { code?: unknown }).code === 'string'
}

function isConnectionFailure(error: unknown): boolean {
  if (!isRemoteError(error)) return false
  return error.code === 'remote-dev/pc-transport-failed' || error.code === 'remote-dev/pc-generation-stale'
}

function isDefiniteRemoteRejection(error: unknown): boolean {
  if (!isRemoteError(error) || error.code !== 'remote-dev/pc-remote-error') return false
  return typeof asRecord(error.details)?.remoteCode === 'number'
}

function makeRemoteError<Code extends RemoteErrorCode>(code: Code, message: string, details: RemoteErrorDetailsMap[Code]): RemoteError<Code> {
  return new RemoteError(code, message, details)
}

export const makePcRemoteError = makeRemoteError

class PcProjectionStore {
  private readonly values = new Map<string, ProjectionSnapshot>()
  private readonly listeners = new Map<string, Set<() => void>>()

  faceOf(key: string): ProjectionSnapshot {
    let face = this.values.get(key)
    if (face !== undefined) return face
    const listeners = this.listeners.get(key) ?? new Set<() => void>()
    this.listeners.set(key, listeners)
    face = {
      getSnapshot: () => this.snapshots.get(key),
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    }
    this.values.set(key, face)
    return face
  }

  set(key: string, value: unknown): void {
    const current = this.faceOf(key)
    if (Object.is(current.getSnapshot(), value)) return
    this.snapshots.set(key, value)
    const listeners = this.listeners.get(key)
    if (listeners === undefined) return
    for (const listener of [...listeners]) {
      try { listener() } catch { /* isolate projection subscribers */ }
    }
  }

  private readonly snapshots = new Map<string, unknown>()
}

function uuid(): string {
  const value = globalThis.crypto?.randomUUID?.()
  if (value !== undefined) return value
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function modelSelectionOf(value: Readonly<Record<string, unknown>>): Record<string, unknown> | null {
  const provider = stringOf(value.provider)
  const model = stringOf(value.model)
  const reasoningEffort = value.reasoningEffort
  if (provider === undefined || provider.length === 0 || model === undefined || model.length === 0) return null
  return {
    provider,
    model,
    ...(typeof reasoningEffort === 'string' && reasoningEffort.length > 0 ? { reasoningEffort } : {}),
  }
}

function sameModel(left: Readonly<Record<string, unknown>> | null, right: Readonly<Record<string, unknown>>): boolean {
  return left !== null && left.provider === right.provider && left.model === right.model
    && left.reasoningEffort === right.reasoningEffort
}

function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isTurnOrMessageEvent(type: unknown): boolean {
  return type === 'turn/start' || type === 'user/message' || type === 'assistant/message'
}

function sessionIsRunning(status: PcRemoteSession['status'] | undefined): boolean {
  return status === 'running' || status === 'waitingApproval'
}

function collapseSettledTransients(entries: readonly NativeEventEntry[]): readonly NativeEventEntry[] {
  const settled = new Set<string>()
  for (const entry of entries) {
    if (entry.type !== 'event' || (entry.event.type !== 'assistant/message' && entry.event.type !== 'assistant/attempt')) continue
    const data = asRecord(entry.event.data)
    const attemptId = stringOf(data?.attemptId) ?? stringOf(data?.messageId)
    if (attemptId !== undefined) settled.add(attemptId)
  }
  return entries.filter(entry => entry.type !== 'transient'
    || !settled.has(stringOf(asRecord(entry.event.data)?.attemptId) ?? ''))
}
