import type { PcConnectValue, PcPairPreviewValue } from 'perse-remote-dev/types'
import type {
  PcConnectionController,
  PcConnectionControllerOptions,
  PcConnectionSnapshot,
  PcFailure,
  PcOutcome,
  PcProfile,
  PcRemote,
  PcRemoteOutcome,
} from './types.ts'

const EMPTY_CONNECTION: PcConnectionSnapshot['connection'] = {
  status: 'disconnected', profileId: null, hostId: null, generation: null, hostInfo: null, error: null,
}

/** Owns only local pairing/profile and verified socket state. It never creates tasks or native sessions. */
export class PcConnectionModel implements PcConnectionController {
  private readonly remote: PcRemote
  private readonly defaultDeviceName: string
  private readonly listeners = new Set<() => void>()
  private state: PcConnectionSnapshot = {
    profiles: [], connection: EMPTY_CONNECTION, pairingPreview: null, failure: null,
    nativeSessionSupport: 'unavailable',
    pendingCreations: [],
  }
  private revision = 0
  private profileRefresh: Promise<PcOutcome<readonly PcProfile[]>> | undefined
  private previewRequest = 0
  private disposed = false
  private creationReceiptAcknowledger: (operationId: string) => void = () => undefined

  constructor(remote: PcRemote, options: Omit<PcConnectionControllerOptions, 'remote'> = {}) {
    this.remote = remote
    this.defaultDeviceName = options.deviceName ?? 'Persevere with DSH 桌面端'
  }

  getSnapshot = (): PcConnectionSnapshot => this.state

  setNativeSessionSupport(status: PcConnectionSnapshot['nativeSessionSupport']): void {
    if (this.state.nativeSessionSupport === status || this.disposed) return
    this.patch({ nativeSessionSupport: status })
  }

  markConnectionOffline(profileId: string, generation: string, reason: unknown): void {
    const current = this.state.connection
    if (this.disposed || current.profileId !== profileId || current.generation !== generation) return
    const failure = exceptionFailure(reason)
    this.patch({
      connection: { ...current, status: 'error', error: failure },
      profiles: this.state.profiles.map(profile => profile.profileId === profileId
        ? { ...profile, status: 'offline' as const }
        : profile),
      failure,
    })
  }

  setPendingCreations(value: PcConnectionSnapshot['pendingCreations']): void {
    if (this.disposed) return
    this.patch({ pendingCreations: value })
  }

  setCreationReceiptAcknowledger(handler: (operationId: string) => void): void {
    this.creationReceiptAcknowledger = handler
  }

  acknowledgeCreationReceipt(operationId: string): void {
    if (!this.disposed) this.creationReceiptAcknowledger(operationId)
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async refreshProfiles(): Promise<PcOutcome<readonly PcProfile[]>> {
    if (this.profileRefresh !== undefined) return this.profileRefresh
    const pending = this.loadProfiles().finally(() => {
      if (this.profileRefresh === pending) this.profileRefresh = undefined
    })
    this.profileRefresh = pending
    return pending
  }

  async previewPairing(link: string): Promise<PcOutcome<PcPairPreviewValue>> {
    this.patch({ pairingPreview: null, failure: null })
    if (link.length > 8192) return this.fail(makeFailure('remote-dev/pc-pairing-invalid', '配对链接不能超过 8 KiB。', { limitBytes: 8192 }))
    const request = ++this.previewRequest
    const outcome = await this.bridge(this.remote.pcPairPreview({ link }))
    if (!outcome.ok) return this.fail(outcome.failure)
    if (this.disposed || request !== this.previewRequest) return failed(stale('pair preview'))
    this.patch({ pairingPreview: outcome.value, failure: null })
    return success(outcome.value)
  }

  async confirmPairing(confirmationId: string, deviceName = this.defaultDeviceName): Promise<PcOutcome<PcConnectValue>> {
    const preview = this.state.pairingPreview
    if (preview === null || preview.confirmationId !== confirmationId) {
      return this.fail(makeFailure('remote-dev/pc-pairing-invalid', '配对预览已失效，请重新预览链接。', null))
    }
    const normalizedName = deviceName.trim()
    if (normalizedName.length < 1 || normalizedName.length > 100) {
      return this.fail(makeFailure('remote-dev/pc-pairing-invalid', '设备名称需为 1 到 100 个字符。', null))
    }
    // A pairing handle is one-use. Consume it locally before dispatch.
    this.previewRequest += 1
    const revision = this.beginConnection(preview.hostId)
    this.patch({ pairingPreview: null })
    const outcome = await this.bridge(this.remote.pcPairConfirm({ confirmationId, deviceName: normalizedName }))
    if (revision !== this.revision || this.disposed) {
      if (outcome.ok) void this.refreshProfiles()
      return failed(stale('pair confirmation'))
    }
    if (!outcome.ok) return this.connectionFailure(outcome.failure)
    return this.accept(outcome.value, revision, preview.hostId, true)
  }

  async connectProfile(profileId: string): Promise<PcOutcome<PcConnectValue>> {
    if (!profileId) return this.fail(makeFailure('remote-dev/pc-profile-required', '请选择一个已保存的主机。', null))
    const profile = this.state.profiles.find((item) => item.profileId === profileId)
    if (profile === undefined) return this.fail(makeFailure('remote-dev/pc-profile-required', '找不到该主机配置，请刷新连接列表。', { profileId }))
    const revision = this.beginConnection(profileId)
    const outcome = await this.bridge(this.remote.pcConnect({ profileId }))
    if (revision !== this.revision || this.disposed) {
      if (outcome.ok) void this.refreshProfiles()
      return failed(stale('connect'))
    }
    if (!outcome.ok) return this.connectionFailure(outcome.failure)
    if (outcome.value.hostId !== profile.hostId) {
      const identityFailure = makeFailure('remote-dev/pc-pairing-invalid', '已连接主机的身份与保存配置不匹配。', {
        expectedHostId: profile.hostId, actualHostId: outcome.value.hostId,
      })
      return this.connectionFailure(identityFailure)
    }
    return this.accept(outcome.value, revision, profile.hostId)
  }

  async disconnectProfile(profileId = this.state.connection.profileId ?? ''): Promise<PcOutcome<void>> {
    if (!profileId) return this.fail(makeFailure('remote-dev/pc-profile-required', '当前没有已连接的主机。', null))
    const wasActive = this.state.connection.profileId === profileId
    const previous = this.state.connection
    const revision = ++this.revision
    this.patch({
      ...(wasActive ? { connection: { ...EMPTY_CONNECTION, status: 'connecting' as const, profileId } } : {}),
      failure: null,
    })
    const outcome = await this.bridge(this.remote.pcDisconnect({ profileId }))
    if (revision !== this.revision || this.disposed) return failed(stale('disconnect'))
    if (!outcome.ok) {
      if (wasActive) this.patch({ connection: { ...previous, error: outcome.failure } })
      return this.fail(outcome.failure)
    }
    this.patch({
      profiles: this.state.profiles.map((profile) => profile.profileId === profileId ? { ...profile, status: 'disconnected' as const } : profile),
      ...(wasActive ? { connection: EMPTY_CONNECTION } : {}),
      failure: null,
    })
    return success(undefined)
  }

  async forgetProfile(profileId: string): Promise<PcOutcome<void>> {
    if (!profileId) return this.fail(makeFailure('remote-dev/pc-profile-required', '请选择要移除的主机配置。', null))
    const wasActive = this.state.connection.profileId === profileId
    const previous = this.state.connection
    const revision = ++this.revision
    this.patch({
      ...(wasActive ? { connection: { ...EMPTY_CONNECTION, status: 'connecting' as const, profileId } } : {}),
      failure: null,
    })
    const outcome = await this.bridge(this.remote.pcForget({ profileId }))
    if (revision !== this.revision || this.disposed) return failed(stale('forget'))
    if (!outcome.ok) {
      if (wasActive) this.patch({ connection: { ...previous, error: outcome.failure } })
      return this.fail(outcome.failure)
    }
    this.patch({
      profiles: this.state.profiles.filter((profile) => profile.profileId !== profileId),
      ...(wasActive ? { connection: EMPTY_CONNECTION } : {}),
      failure: null,
    })
    return success(undefined)
  }

  async revokeSelf(profileId = this.state.connection.profileId ?? ''): Promise<PcOutcome<void>> {
    const connection = this.state.connection
    if (!profileId || connection.profileId !== profileId || connection.status !== 'connected' || connection.generation === null) {
      return this.fail(makeFailure('remote-dev/pc-connection-required', '撤销本设备授权前，请先连接并验证对应主机。', null))
    }
    const capturedGeneration = connection.generation
    const revision = ++this.revision
    this.patch({ connection: { ...EMPTY_CONNECTION, status: 'connecting', profileId }, failure: null })
    const outcome = await this.bridge(this.remote.pcRevoke({ profileId, generation: capturedGeneration }))
    if (revision !== this.revision || this.disposed) return failed(stale('revoke'))
    if (!outcome.ok) {
      this.patch({ connection: { ...connection, error: outcome.failure } })
      return this.fail(outcome.failure)
    }
    this.patch({
      profiles: this.state.profiles.filter((profile) => profile.profileId !== profileId),
      connection: EMPTY_CONNECTION,
      failure: null,
    })
    return success(undefined)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.revision += 1
    this.previewRequest += 1
    this.listeners.clear()
  }

  private beginConnection(profileId: string): number {
    const revision = ++this.revision
    this.patch({
      connection: { ...EMPTY_CONNECTION, status: 'connecting', profileId },
      failure: null,
    })
    return revision
  }

  private async accept(value: PcConnectValue, revision: number, expectedHostId: string, reconcilePairedProfile = false): Promise<PcOutcome<PcConnectValue>> {
    const parsed = parseHostInfo(value.hostInfoJson)
    if (!parsed.ok) return this.connectionFailure(parsed.failure)
    if (value.profileId.length === 0 || value.hostId.length === 0 || value.generation.length === 0) {
      return this.connectionFailure(makeFailure('remote-dev/pc-pairing-invalid', '连接响应缺少 profile、host 或 generation 身份。', null))
    }
    if (value.hostId !== expectedHostId) {
      return this.connectionFailure(makeFailure('remote-dev/pc-pairing-invalid', '已验证主机身份与预览或保存的主机不匹配。', {
        expectedHostId, actualHostId: value.hostId,
      }))
    }
    const hostInfoId = stringOf(parsed.value.id)
    if (hostInfoId !== '' && hostInfoId !== expectedHostId) {
      return this.connectionFailure(makeFailure('remote-dev/pc-pairing-invalid', 'host.info 中的主机 ID 与连接配置不匹配。', {
        expectedHostId, actualHostId: hostInfoId,
      }))
    }
    if (revision !== this.revision || this.disposed) {
      void this.refreshProfiles()
      return failed(stale('connect response'))
    }
    this.patch({
      connection: {
        status: 'connected', profileId: value.profileId, hostId: value.hostId,
        generation: value.generation, hostInfo: parsed.value, error: null,
      },
      profiles: this.state.profiles.map((profile) => profile.profileId === value.profileId ? { ...profile, status: 'connected' as const } : profile),
      failure: null,
    })
    if (!reconcilePairedProfile) return success(value)
    // Pair confirmation already established a verified socket and generation.
    // Reconcile its saved profile for the native backend without reconnecting.
    const profiles = await this.refreshProfilesAfterPair()
    if (revision !== this.revision || this.disposed) return failed(stale('paired profile reconciliation'))
    if (!profiles.ok) {
      this.patch({ failure: makeFailure(
        'remote-dev/pc-profile-recovery-required',
        '主机已配对并验证，但无法刷新本机连接列表；请重试刷新以启用原生远程会话。',
        { profileId: value.profileId, generation: value.generation },
      ) })
    } else {
      const saved = profiles.value.find(profile => profile.profileId === value.profileId)
      if (saved === undefined || saved.hostId !== value.hostId) {
        this.patch({ failure: makeFailure(
          'remote-dev/pc-profile-recovery-required',
          '主机已配对并验证，但保存配置未能与当前连接匹配；请刷新配置列表或重新配对。',
          { profileId: value.profileId, expectedHostId: value.hostId, savedHostId: saved?.hostId ?? null },
        ) })
      }
    }
    return success(value)
  }

  private async loadProfiles(): Promise<PcOutcome<readonly PcProfile[]>> {
    const outcome = await this.bridge(this.remote.pcProfiles({}))
    if (!outcome.ok) return this.fail(outcome.failure)
    if (this.disposed) return failed(stale('profile list'))
    this.patch({ profiles: outcome.value.profiles, failure: null })
    return success(outcome.value.profiles)
  }

  private async refreshProfilesAfterPair(): Promise<PcOutcome<readonly PcProfile[]>> {
    // A list request may have started before the one-time pairing exchange and
    // therefore cannot include the newly stored profile. Let the single-owner
    // request settle, then issue one fresh reconciliation read.
    const earlier = this.profileRefresh
    if (earlier !== undefined) await earlier
    return this.refreshProfiles()
  }

  private connectionFailure<T>(failure: PcFailure): PcOutcome<T> {
    const profileId = this.state.connection.profileId
    this.patch({
      connection: { ...EMPTY_CONNECTION, status: 'error', profileId, error: failure },
      failure,
    })
    void this.refreshProfiles()
    return { ok: false, failure }
  }

  private async bridge<T>(promise: Promise<PcRemoteOutcome<T>>): Promise<PcOutcome<T>> {
    try {
      const outcome = await promise
      return outcome.ok ? success(outcome.value) : { ok: false, failure: remoteFailure(outcome.error) }
    } catch (error) {
      return { ok: false, failure: exceptionFailure(error) }
    }
  }

  private fail<T>(failure: PcFailure): PcOutcome<T> {
    if (!this.disposed) this.patch({ failure })
    return { ok: false, failure }
  }

  private patch(patch: Partial<PcConnectionSnapshot>): void {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    for (const listener of [...this.listeners]) listener()
  }
}

export function createPcConnectionController(options: PcConnectionControllerOptions): PcConnectionController {
  const { remote, ...rest } = options
  return new PcConnectionModel(remote, rest)
}

function success<T>(value: T): PcOutcome<T> { return { ok: true, value } }
function failed<T>(failure: PcFailure): PcOutcome<T> { return { ok: false, failure } }
function makeFailure(code: string, message: string, details: unknown): PcFailure { return { code, message, details } }
function stale(operation: string): PcFailure {
  return makeFailure('remote-dev/pc-stale-generation', `连接在 ${operation} 完成前已切换；过期结果未覆盖当前连接。`, null)
}

function parseHostInfo(json: string): PcOutcome<Readonly<Record<string, unknown>>> {
  try {
    const value: unknown = JSON.parse(json)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return failed(makeFailure('remote-dev/pc-pairing-invalid', 'host.info 不是有效 JSON 对象。', null))
    }
    return success(value as Readonly<Record<string, unknown>>)
  } catch {
    return failed(makeFailure('remote-dev/pc-pairing-invalid', 'host.info 不是有效 JSON。', null))
  }
}

function remoteFailure(error: unknown): PcFailure {
  const record = asRecord(error)
  const details = record?.details
  const detailRecord = asRecord(details)
  const remoteCode = typeof detailRecord?.remoteCode === 'number' ? detailRecord.remoteCode : undefined
  let remoteData: unknown = detailRecord?.dataJson
  if (typeof remoteData === 'string') {
    const rawRemoteData = remoteData
    try { remoteData = JSON.parse(rawRemoteData) as unknown } catch { remoteData = rawRemoteData.slice(0, 4000) }
  }
  return {
    code: stringOf(record?.code) || 'remote-dev/pc-failed',
    message: stringOf(detailRecord?.remoteMessage) || stringOf(record?.message) || 'PC 连接操作失败。',
    details,
    ...(remoteCode === undefined ? {} : { remoteCode, remoteData }),
  }
}

function exceptionFailure(error: unknown): PcFailure {
  const record = asRecord(error)
  return {
    code: stringOf(record?.code) || 'remote-dev/pc-transport-failed',
    message: stringOf(record?.message) || 'PC 连接操作失败。',
    details: record?.details ?? null,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function stringOf(value: unknown): string { return typeof value === 'string' ? value : '' }
