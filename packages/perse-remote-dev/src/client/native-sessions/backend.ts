import type { PcConnectValue } from 'perse-remote-dev/types'
import type { ExternalBackendGeneration as ExternalBackendGenerationType, ExternalBackendId as ExternalBackendIdType, ExternalHostId as ExternalHostIdType, ExternalSessionId as ExternalSessionIdType, ExternalWorkspaceId as ExternalWorkspaceIdType } from '@deepseek-ai/dsh-api-session-controller/client'
import type { PcProfile, PcRemote } from '../connections/types.ts'
import type {
  ExternalApprovalDecision,
  ExternalSessionAddress,
  ExternalSessionBackend,
  ExternalSessionCatalog,
  ExternalSessionCreateRequest,
  ExternalSessionOpenHandle,
  ExternalSessionOpenRequest,
  ExternalSessionCapabilities,
  ExternalWorkspaceSummary,
  ObservableSnapshot,
} from './core-types.ts'
import { PcNativeSessionFace, makePcRemoteError } from './session-face.ts'
import { pcSubmissionReceipts } from './submission-receipts.ts'
import {
  decodePcModelList,
  decodePcSessionCreate,
  decodePcSessionList,
  decodePcWorkspaceList,
  type PcRemoteModelList,
  type PcRemoteSession,
} from './protocol.ts'

const MAX_WORKSPACES = 1_000
const MAX_SESSIONS = 20_000
const MAX_SESSION_PAGES = 1_000

/** External IDs are branded strings at compile time and plain strings at runtime. */
function asExternalId<T extends string>(value: string): T {
  return value as T
}

interface MutableSnapshot<T> extends ObservableSnapshot<T> {
  set(value: T): void
}

class Snapshot<T> implements MutableSnapshot<T> {
  private value: T
  private readonly listeners = new Set<() => void>()

  constructor(initial: T) { this.value = initial }
  getSnapshot = (): T => this.value
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  set(value: T): void {
    this.value = value
    for (const listener of [...this.listeners]) listener()
  }
}

/** One exact verified PC profile generation exposed through DSH's external native-session seam. */
export class PcNativeSessionBackend implements ExternalSessionBackend {
  readonly backendId: ExternalBackendIdType
  readonly hostId: ExternalHostIdType
  readonly hostName: string
  readonly profileName: string
  readonly generation: ExternalBackendGenerationType
  readonly capabilities: ExternalSessionCapabilities
  /** v1.3 host model advertisement (host.info capabilities `modelList`/`modelSelect`); never assumed. */
  readonly modelSupport: { readonly list: boolean; readonly select: boolean }
  readonly catalog: MutableSnapshot<ExternalSessionCatalog>
  private readonly remote: PcRemote
  private readonly hostInfo: Readonly<Record<string, unknown>>
  private readonly isCurrent: () => boolean
  private readonly onOffline: (reason: unknown) => void
  private readonly onCreationReceiptChange: () => void
  private readonly blankSessions = new Set<string>()
  private readonly defaultModelByWorkspace = new Map<string, string>()
  private modelListFlight: Promise<PcRemoteModelList> | undefined
  private readonly faces = new Map<string, PcNativeSessionFace>()
  private disposed = false
  private refreshFlight: Promise<void> | undefined

  constructor(options: {
    readonly remote: PcRemote
    readonly profile: PcProfile
    readonly connection: PcConnectValue
    readonly hostInfo: Readonly<Record<string, unknown>>
    readonly isCurrent: () => boolean
    readonly onOffline: (reason: unknown) => void
    readonly onCreationReceiptChange?: () => void
  }) {
    this.remote = options.remote
    this.backendId = asExternalId<ExternalBackendIdType>(options.connection.profileId)
    this.hostId = asExternalId<ExternalHostIdType>(options.connection.hostId)
    this.hostName = options.profile.hostName
    this.profileName = options.profile.deviceName
    this.generation = asExternalId<ExternalBackendGenerationType>(options.connection.generation)
    this.hostInfo = options.hostInfo
    this.isCurrent = options.isCurrent
    this.onOffline = options.onOffline
    this.onCreationReceiptChange = options.onCreationReceiptChange ?? (() => undefined)
    this.capabilities = capabilitiesOf(options.hostInfo)
    this.modelSupport = modelSupportOf(options.hostInfo)
    this.catalog = new Snapshot<ExternalSessionCatalog>(this.catalogValue('connected', []))
  }

  refresh(): Promise<void> {
    this.assertCurrent('workspace.list')
    if (this.refreshFlight !== undefined) return this.refreshFlight
    const flight = this.refreshCatalog()
    this.refreshFlight = flight
    void flight.then(
      () => { if (this.refreshFlight === flight) this.refreshFlight = undefined },
      () => { if (this.refreshFlight === flight) this.refreshFlight = undefined },
    )
    return flight
  }

  private async refreshCatalog(): Promise<void> {
    try {
      const workspaceValue = decodePcWorkspaceList(await this.call('workspace.list', {}))
      if (!workspaceValue.ok) throw invalidCatalog('workspace.list', workspaceValue.error.message)
      if (workspaceValue.value.length > MAX_WORKSPACES) throw invalidCatalog('workspace.list', `workspace count exceeds ${MAX_WORKSPACES}`)
      const workspaces: ExternalWorkspaceSummary[] = []
      let totalSessions = 0
      for (const workspace of workspaceValue.value) {
        const sessions: PcRemoteSession[] = []
        let cursor: string | null = null
        const seenCursors = new Set<string>()
        let pages = 0
        while (true) {
          pages += 1
          if (pages > MAX_SESSION_PAGES) throw invalidCatalog('session.list', `workspace pagination exceeds ${MAX_SESSION_PAGES} pages`)
          const result = decodePcSessionList(await this.call('session.list', {
            workspaceId: workspace.id,
            archived: false,
            ...(cursor === null ? {} : { cursor }),
          }))
          if (!result.ok) throw invalidCatalog('session.list', result.error.message)
          for (const session of result.value.sessions) {
            if (session.workspaceId !== workspace.id) throw invalidCatalog('session.list', 'host returned a session outside the requested workspace')
            sessions.push(session)
            totalSessions += 1
            if (totalSessions > MAX_SESSIONS) throw invalidCatalog('session.list', `session count exceeds ${MAX_SESSIONS}`)
          }
          const next = result.value.nextCursor
          if (next === null) break
          if (seenCursors.has(next)) throw invalidCatalog('session.list', 'host repeated a pagination cursor')
          seenCursors.add(next)
          cursor = next
        }
        workspaces.push({
          id: asExternalId<ExternalWorkspaceIdType>(workspace.id),
          name: workspace.name,
          ...(workspace.path === undefined ? {} : { path: workspace.path }),
          sessions: sessions.map((session) => this.catalogRow(session)),
        })
      }
      this.catalog.set(this.catalogValue('connected', workspaces))
    } catch (error) {
      if (isConnectionFailure(error)) {
        this.catalog.set(this.catalogValue('offline', this.catalog.getSnapshot().workspaces))
        this.onOffline(error)
      }
      throw error
    }
  }

  async createSession(request: ExternalSessionCreateRequest): Promise<ExternalSessionIdType> {
    this.assertCurrent('session.create')
    if (request.signal.aborted) throw request.signal.reason
    if (request.address.backendId !== this.backendId || request.address.hostId !== this.hostId) {
      throw staleBackend(this.backendId, this.generation)
    }
    if (!this.catalog.getSnapshot().workspaces.some(item => item.id === request.address.workspaceId)) {
      throw invalidCatalog('session.create', 'workspace is not present in the verified host catalog')
    }
    if (request.options.agentPreset !== undefined) {
      throw makePcRemoteError('remote-dev/pc-native-capability-unavailable', 'This Perse 1.2 contract does not expose remote Agent preset selection.', {
        method: 'session.create(agentPreset)', capability: 'agentPreset',
      })
    }
    const provider = request.options.provider ?? defaultProviderOf(this.hostInfo)
    if (provider === undefined) {
      throw makePcRemoteError('remote-dev/pc-native-capability-unavailable', 'The verified host did not advertise an available provider.', {
        method: 'session.create', capability: 'providers',
      })
    }
    // A model may come from the caller or from the plugin's stored workspace choice. The
    // verified host must advertise model selection, or the request fails explicitly here —
    // nothing is dispatched, and no local model is ever substituted (005 contract).
    const requestedModel = request.options.model ?? this.defaultModelByWorkspace.get(request.address.workspaceId)
    if (requestedModel !== undefined && !this.modelSelectionAvailable()) {
      throw makePcRemoteError('remote-dev/pc-native-capability-unavailable',
        'The verified host does not advertise model selection, so the requested model was not sent and no local model was substituted.',
        { method: 'session.create(model)', capability: 'modelSelection', model: requestedModel },
      )
    }
    const operationId = createOperationId()
    const creationReceipt = {
      kind: 'create' as const,
      profileId: this.backendId,
      hostId: this.hostId,
      workspaceId: request.address.workspaceId,
      operationId,
      startedAt: Date.now(),
    }
    try { pcSubmissionReceipts.saveCreation(creationReceipt) } catch {
      throw makePcRemoteError('remote-dev/pc-native-session-unavailable', 'The browser could not persist a session-creation receipt, so the remote operation was not sent.', {
        requiredApi: 'persistent browser storage',
      })
    }
    pcSubmissionReceipts.setCreationInFlight(operationId, true)
    this.updateCreationWarning()
    this.onCreationReceiptChange()
    try {
      const resultJson = await this.call('session.create', {
        workspaceId: request.address.workspaceId,
        provider,
        ...(requestedModel === undefined ? {} : { model: requestedModel }),
      }, request.signal)
      const decoded = decodePcSessionCreate(resultJson, request.address.workspaceId)
      if (!decoded.ok) throw invalidCatalog('session.create', decoded.error.message)
      pcSubmissionReceipts.clearCreation(operationId)
      this.blankSessions.add(decoded.value.id)
      // The Host has already accepted the creation. Never turn that success into
      // a retryable error because the follow-up navigation catalog is unavailable.
      return asExternalId<ExternalSessionIdType>(decoded.value.id)
    } catch (error) {
      // Cancellation is not proof that session.create was never sent. The bridge
      // marks only pre-send failures as no-dispatch; every post-send transport
      // failure must leave the durable receipt for explicit reconciliation.
      if (isNoDispatchFailure(error) || isDefiniteRemoteRejection(error)) {
        pcSubmissionReceipts.clearCreation(operationId)
      }
      throw error
    } finally {
      pcSubmissionReceipts.setCreationInFlight(operationId, false)
      this.updateCreationWarning()
      this.onCreationReceiptChange()
    }
  }

  /** The 1.3 seat surface may render only when the verified host advertises both wire capabilities. */
  modelSelectionAvailable(): boolean {
    return this.modelSupport.list && this.modelSupport.select
  }

  /** Read the verified host's own model catalog. Never guesses, never falls back to local models. */
  async listModels(options: { readonly fresh?: boolean } = {}): Promise<PcRemoteModelList> {
    this.assertCurrent('model.list')
    if (!this.modelSupport.list) throw modelCapabilityUnavailable('model.list')
    if (!options.fresh && this.modelListFlight !== undefined) return this.modelListFlight
    const flight = (async (): Promise<PcRemoteModelList> => {
      const resultJson = await this.call('model.list', {})
      const decoded = decodePcModelList(resultJson)
      if (!decoded.ok) {
        throw invalidCatalog('model.list', `catalog payload was invalid (${decoded.error.code}): ${decoded.error.message}`)
      }
      return decoded.value
    })()
    this.modelListFlight = flight
    void flight.catch(() => { if (this.modelListFlight === flight) this.modelListFlight = undefined })
    return flight
  }

  /**
   * Select the model for one existing remote Session on the owning host. One dispatch only:
   * an unknown transport outcome is never auto-retried (the caller re-reads state instead).
   */
  async setModel(sessionId: string, model: string, reasoningEffort?: string): Promise<{ readonly provider: string; readonly model: string; readonly reasoningEffort?: string }> {
    this.assertCurrent('session.setModel')
    if (!this.modelSelectionAvailable()) throw modelCapabilityUnavailable('session.setModel')
    const resultJson = await this.call('session.setModel', {
      sessionId,
      model,
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    })
    let parsed: unknown
    try { parsed = JSON.parse(resultJson) as unknown } catch {
      throw invalidCatalog('session.setModel', 'response was not valid JSON')
    }
    const record = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null
    const selection = record !== null && typeof record.model === 'object' && record.model !== null && !Array.isArray(record.model)
      ? record.model as Record<string, unknown> : null
    if (selection === null || typeof selection.provider !== 'string' || !selection.provider
      || typeof selection.model !== 'string' || !selection.model) {
      throw invalidCatalog('session.setModel', 'response did not contain the accepted selection')
    }
    return {
      provider: selection.provider,
      model: selection.model,
      ...(typeof selection.reasoningEffort === 'string' ? { reasoningEffort: selection.reasoningEffort } : {}),
    }
  }

  /**
   * Store the workspace's chosen remote model for future remote Session creates. The model
   * must appear in the verified host's own catalog; unsupported hosts fail explicitly.
   */
  async setDefaultModel(workspaceId: string, model: string | null): Promise<void> {
    this.assertCurrent('session.setModel')
    if (model === null) {
      this.defaultModelByWorkspace.delete(workspaceId)
      return
    }
    const catalog = await this.listModels()
    const match = catalog.models.find(entry => entry.id === model)
    if (match === undefined || !match.selectable) {
      throw makePcRemoteError('remote-dev/pc-native-capability-unavailable',
        `Model ${model} is not selectable on the verified host; nothing was stored and no local model was substituted.`,
        { method: 'session.create(model)', capability: 'modelSelection', model })
    }
    this.defaultModelByWorkspace.set(workspaceId, model)
  }

  getDefaultModel(workspaceId: string): string | undefined {
    return this.defaultModelByWorkspace.get(workspaceId)
  }

  /** Durable host model selection projected for an open remote Session, for the remote model seat. */
  currentSelectionOf(remoteSessionId: string): { readonly provider: string; readonly model: string } | null {
    const face = this.faces.get(remoteSessionId)
    if (face === undefined) return null
    const projected = face.projections.faceOf('modelSelection').getSnapshot() as
      { next?: { provider?: unknown; model?: unknown } | null } | undefined
    const selection = projected?.next
    if (selection === null || selection === undefined || typeof selection.provider !== 'string' || typeof selection.model !== 'string') return null
    return { provider: selection.provider, model: selection.model }
  }

  openSession(request: ExternalSessionOpenRequest): ExternalSessionOpenHandle {
    if (this.disposed || !this.isCurrent() || request.generation !== this.generation
      || request.address.backendId !== this.backendId || request.address.hostId !== this.hostId) {
      throw staleBackend(this.backendId, this.generation)
    }
    const face = new PcNativeSessionFace(
      request.sessionId,
      request.address.sessionId,
      request,
      this.remote,
      () => !this.disposed && this.isCurrent() && request.generation === this.generation,
      session => this.updateSession(request.address.workspaceId, session),
      reason => this.markOffline(reason),
      () => { if (this.faces.get(request.address.sessionId) === face) this.faces.delete(request.address.sessionId) },
      this.catalog.getSnapshot().workspaces.find(item => item.id === request.address.workspaceId)?.sessions
        .find(item => item.id === request.address.sessionId)?.title,
    )
    this.faces.set(request.address.sessionId, face)
    return {
      session: face,
      eventSource: face.eventSource,
      approvals: face.approvals,
      gatewayEvents: face.gatewayEvents,
      ready: face.open(),
      dispose: () => face.dispose(),
    }
  }

  async respondApproval(request: {
    readonly address: ExternalSessionAddress
    readonly approvalId: string
    readonly decision: ExternalApprovalDecision
    readonly signal: AbortSignal
  }): Promise<void> {
    this.assertCurrent('approval.respond')
    if (request.signal.aborted) throw request.signal.reason
    if (request.address.backendId !== this.backendId || request.address.hostId !== this.hostId) {
      throw staleBackend(this.backendId, this.generation)
    }
    const face = this.faces.get(request.address.sessionId)
    if (face === undefined) throw invalidCatalog('approval.respond', 'the addressed native session is not retained')
    await face.respondApproval(request.approvalId, request.decision, request.signal)
  }

  setOffline(reason?: unknown): void {
    if (this.disposed) return
    this.catalog.set(this.catalogValue('offline', this.catalog.getSnapshot().workspaces))
    if (reason !== undefined) this.onOffline(reason)
  }

  refreshWarnings(): void {
    if (!this.disposed) this.updateCreationWarning()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const face of this.faces.values()) face.dispose()
    this.faces.clear()
  }

  private async call(method: string, params: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<string> {
    this.assertCurrent(method)
    signal?.throwIfAborted()
    const outcome = await this.remote.pcCall({
      profileId: this.backendId,
      generation: this.generation,
      method,
      paramsJson: JSON.stringify(params),
    }, signal)
    if (!outcome.ok) throw outcome.error
    return outcome.value.resultJson
  }

  private assertCurrent(method: string): void {
    if (this.disposed || !this.isCurrent()) throw staleBackend(this.backendId, this.generation)
    if (this.catalog.getSnapshot().status === 'offline') {
      throw makePcRemoteError('remote-dev/pc-transport-failed', 'The remote host is offline.', {
        profileId: this.backendId, method, reason: 'backend offline',
      })
    }
  }

  private markOffline(reason: unknown): void {
    this.setOffline(reason)
  }

  private creationWarning(): string | undefined {
    let count: number
    try {
      count = pcSubmissionReceipts.creationReceipts(this.backendId)
        .filter(receipt => receipt.hostId === this.hostId).length
    } catch {
      return '本地操作核实记录无法读取。请先检查此主机的会话列表，再继续创建会话。'
    }
    return count === 0 ? undefined : `有 ${count} 次远程会话创建结果未知，请检查此主机的会话列表。系统不会自动重试或猜测会话归属。`
  }

  private catalogValue(status: ExternalSessionCatalog['status'], workspaces: ExternalSessionCatalog['workspaces']): ExternalSessionCatalog {
    const warning = this.creationWarning()
    return { status, workspaces, ...(warning === undefined ? {} : { warning }) }
  }

  private updateCreationWarning(): void {
    const current = this.catalog.getSnapshot()
    this.catalog.set(this.catalogValue(current.status, current.workspaces))
  }

  private catalogRow(session: PcRemoteSession) {
    return {
      id: asExternalId<ExternalSessionIdType>(session.id),
      title: session.title,
      updatedAt: Date.parse(session.updatedAt),
      running: session.status === 'running' || session.status === 'waitingApproval',
      blank: this.blankSessions.has(session.id),
    }
  }

  private updateSession(workspaceId: string, session: PcRemoteSession): void {
    const workspaces = this.catalog.getSnapshot().workspaces.map((workspace) => {
      if (workspace.id !== workspaceId) return workspace
      const exists = workspace.sessions.some(item => item.id === session.id)
      const sessions = exists
        ? workspace.sessions.map(item => item.id === session.id ? this.catalogRow(session) : item)
        : [...workspace.sessions, this.catalogRow(session)]
      return { ...workspace, sessions }
    })
    this.catalog.set({ ...this.catalog.getSnapshot(), workspaces })
  }
}

function capabilitiesOf(hostInfo: Readonly<Record<string, unknown>>): ExternalSessionCapabilities {
  const methods = new Set(Array.isArray(hostInfo.capabilities)
    ? hostInfo.capabilities.filter((item): item is string => typeof item === 'string')
    : [])
  const sessionSupport = methods.has('sessions')
  return {
    prompt: methods.has('prompt'),
    queue: methods.has('queue') && methods.has('prompt'),
    queueEdit: false,
    steer: false,
    cancel: methods.has('interrupt'),
    rename: sessionSupport,
    readAttachment: methods.has('attachments'),
    fileUpload: false,
    // Frozen seam rule (005): the core model seat reads the one Host-generation LOCAL
    // catalog, so it must stay false for external bindings. Remote model discovery and
    // selection ride the plugin's composer-seam contribution (`conversation.input.right`)
    // over the host's `model.list`/`session.setModel`; the local reject path stays intact.
    modelSelection: false,
    approvalActions: methods.has('approvals'),
    command: false,
  }
}

function defaultProviderOf(hostInfo: Readonly<Record<string, unknown>>): string | undefined {
  if (!Array.isArray(hostInfo.providers)) return undefined
  const providers = hostInfo.providers.filter((value): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  ))
  const selected = providers.find(provider => provider.available === true && typeof provider.id === 'string' && provider.id === 'dsh')
    ?? providers.find(provider => provider.available === true && typeof provider.id === 'string')
  return typeof selected?.id === 'string' ? selected.id : undefined
}

function modelSupportOf(hostInfo: Readonly<Record<string, unknown>>): { readonly list: boolean; readonly select: boolean } {
  const methods = new Set(Array.isArray(hostInfo.capabilities)
    ? hostInfo.capabilities.filter((item): item is string => typeof item === 'string')
    : [])
  return { list: methods.has('modelList'), select: methods.has('modelSelect') }
}

function modelCapabilityUnavailable(method: string): Error {
  return makePcRemoteError('remote-dev/pc-native-capability-unavailable',
    'The verified host does not advertise model selection, so the model request was not sent and no local model was substituted.',
    { method, capability: 'modelSelection' })
}

function invalidCatalog(method: string, reason: string): Error {
  return makePcRemoteError('remote-dev/pc-native-session-invalid', `Remote ${method} did not return a valid catalog.`, {
    sessionId: method, reason,
  })
}

function staleBackend(profileId: string, generation: string): Error {
  return makePcRemoteError('remote-dev/pc-generation-stale', 'The external session backend generation is no longer active.', {
    profileId, expectedGeneration: generation,
  })
}

function isConnectionFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { isDSHRemoteError?: unknown }).isDSHRemoteError === true
    && ['remote-dev/pc-transport-failed', 'remote-dev/pc-generation-stale'].includes(String((error as { code?: unknown }).code))
}

function isDefiniteRemoteRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null
    || (error as { isDSHRemoteError?: unknown }).isDSHRemoteError !== true
    || (error as { code?: unknown }).code !== 'remote-dev/pc-remote-error') return false
  const details = (error as { details?: unknown }).details
  return typeof details === 'object' && details !== null && typeof (details as { remoteCode?: unknown }).remoteCode === 'number'
}

function isNoDispatchFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { isDSHRemoteError?: unknown }).isDSHRemoteError === true
    && ['remote-dev/pc-generation-stale', 'remote-dev/pc-no-dispatch'].includes(String((error as { code?: unknown }).code))
}

function createOperationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
