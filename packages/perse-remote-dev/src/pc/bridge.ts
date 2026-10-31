/** Owner-side bridge from local DSH Remote calls to the authenticated Perse gateway (1.2 base, 1.3 model methods). */

import { randomBytes, randomUUID } from 'node:crypto'
import WebSocket, { type RawData } from 'ws'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { PcProfileStore } from './profile-store.ts'
import { pcDesiredStateOf } from './profile-store.ts'
import type { PcStoredProfile } from './profile-store.ts'
import type {
  PcCallRequest,
  PcConnectValue,
  PcPairConfirmRequest,
  PcPairPreviewValue,
  PcProfileView,
} from '../types.ts'

const PAIR_LINK_MAX_BYTES = 8 * 1024
const PAIR_RESPONSE_MAX_BYTES = 16 * 1024
// A 20 MiB binary image expands to at most 27,962,028 base64 bytes. The 28 MiB
// frame cap reserves 1,398,100 bytes for JSON-RPC and attachment metadata.
const RPC_FRAME_MAX_BYTES = 28 * 1024 * 1024
const RPC_TIMEOUT_MS = 30_000
const PAIR_HANDLE_TTL_MS = 5 * 60_000
const ALLOWED_METHODS = new Set([
  'host.info', 'workspace.list', 'session.list', 'session.create', 'session.read',
  'session.prompt', 'session.attachment', 'session.interrupt', 'session.rename', 'session.archive', 'session.fork',
  // v1.3 (specs/005): read-only host model catalog and explicit host-side selection.
  'model.list', 'session.setModel',
  'approval.respond', 'file.list', 'file.read', 'file.write', 'git.status', 'git.diff', 'git.stage', 'git.unstage',
  'git.commit', 'git.branches', 'terminal.start', 'terminal.read', 'terminal.stop', 'tools.list', 'skills.list',
  'connection.info', 'device.revokeSelf', 'worktree.list', 'worktree.create', 'worktree.remove',
  'review.diff', 'review.list', 'review.read', 'review.delete', 'review.comment.add', 'review.comment.remove',
  'review.viewed.set', 'review.prompt',
])

interface PairPayload {
  readonly v: 1
  readonly hostId: string
  readonly hostName: string
  readonly endpoint: string
  readonly pairingId: string
  readonly secret: string
  readonly expiresAt: string
  readonly networkMode: 'https' | 'tailnet' | 'local'
}

interface ExchangeResult {
  readonly device: { readonly id: string; readonly name: string; readonly createdAt: string }
  readonly token: string
  readonly host: { readonly id: string; readonly name: string }
  readonly endpoint: string
  readonly protocolVersion: string
}

interface RpcResponse {
  readonly jsonrpc?: unknown
  readonly id?: unknown
  readonly result?: unknown
  readonly error?: { readonly code?: unknown; readonly message?: unknown; readonly data?: unknown }
  readonly method?: unknown
}

interface PairHandle {
  readonly payload: PairPayload
  readonly expiresAt: number
}

interface ActiveConnection {
  readonly profileId: string
  readonly generation: string
  readonly socket: WebSocket
  nextId: number
  verified: boolean
  readonly pending: Map<number, { resolve(value: unknown): void; reject(error: Error): void; timeout: NodeJS.Timeout }>
}

/** PC bridge. Pair handles and live sockets exist only in this plugin process. */
export class PcBridge {
  private readonly previews = new Map<string, PairHandle>()
  private readonly connections = new Map<string, ActiveConnection>()

  constructor(private readonly store = new PcProfileStore()) {}

  async profiles(): Promise<PcProfileView[]> {
    let profiles: PcStoredProfile[]
    try { profiles = await this.store.list() } catch (error) { throw storageError(error) }
    return profiles.map((profile) => {
      try { validateEndpoint(profile.endpoint, profile.networkMode) } catch { throw remoteError('remote-dev/pc-storage-unavailable', '本机配对配置中的主机地址无效；未返回该配置', { reason: 'stored endpoint rejected' }) }
      const active = this.connections.get(profile.profileId)
      const connected = active !== undefined && active.verified && active.socket.readyState === WebSocket.OPEN
      const status = connected ? 'connected' : profile.status === 'revoked' ? 'revoked' : 'offline'
      // Eligibility is the stored intent, never the observation. Writing down a
      // transport loss as `offline` therefore keeps a wanted connection eligible;
      // only an explicit user disconnect, or a revoked grant, ends it. A revoked
      // grant is never eligible, whatever the intent says.
      const reconnectable = status !== 'revoked' && !connected && pcDesiredStateOf(profile) === 'connected'
      return { ...this.store.view(profile, status), ...(reconnectable ? { autoConnect: true } : {}) }
    })
  }

  preview(link: string): PcPairPreviewValue {
    const payload = parsePairLink(link)
    this.prunePreviews()
    const confirmationId = randomBytes(24).toString('base64url')
    this.previews.set(confirmationId, { payload, expiresAt: Date.now() + PAIR_HANDLE_TTL_MS })
    return {
      confirmationId,
      hostId: payload.hostId,
      hostName: payload.hostName,
      endpoint: payload.endpoint,
      networkMode: payload.networkMode,
      expiresAt: payload.expiresAt,
      accessSummary: '仅访问该主机已授权的工作区与远程开发能力',
    }
  }

  async confirm(request: PcPairConfirmRequest, signal: AbortSignal): Promise<PcConnectValue> {
    const handle = this.previews.get(request.confirmationId)
    this.previews.delete(request.confirmationId)
    if (handle === undefined || handle.expiresAt <= Date.now()) throw remoteError('remote-dev/pc-confirmation-invalid', '配对确认已过期，请重新预览二维码或链接', {})
    const name = request.deviceName
    if (typeof name !== 'string' || name.trim() !== name || name.length < 1 || name.length > 100) {
      throw remoteError('remote-dev/pc-pairing-invalid', '设备名称必须为 1 到 100 个字符', { reason: 'invalid device name' })
    }
    signal.throwIfAborted()
    let exchange: ExchangeResult
    try {
      exchange = await exchangePair(handle.payload, name, signal)
    } catch (error) {
      throw remoteError('remote-dev/pc-pairing-invalid', '配对兑换失败，请确认主机仍在线并重新生成链接', { reason: safeReason(error) })
    }
    if (exchange.endpoint !== handle.payload.endpoint || exchange.host.id !== handle.payload.hostId) {
      throw remoteError('remote-dev/pc-pairing-invalid', '配对响应中的主机身份或地址与确认信息不匹配', { reason: 'pairing identity mismatch' })
    }
    if (!isSupportedProtocol(exchange.protocolVersion)) throw unsupportedProtocol(exchange.protocolVersion)
    const profile: PcStoredProfile = {
      profileId: randomUUID(),
      endpoint: handle.payload.endpoint,
      networkMode: handle.payload.networkMode,
      hostId: exchange.host.id,
      hostName: exchange.host.name,
      deviceId: exchange.device.id,
      deviceName: exchange.device.name,
      token: exchange.token,
      status: 'offline',
    }
    try {
      await this.store.put(profile)
    } catch (error) {
      throw remoteError('remote-dev/pc-storage-unavailable', '配对兑换已完成，但本机无法安全保存凭证；请重新配对后重试', { reason: safeReason(error) })
    }
    try {
      const connected = await this.connectProfile(profile, signal)
      return connected
    } catch (error) {
      if (error instanceof IdentityMismatchError) {
        await this.store.remove(profile.profileId)
        throw remoteError('remote-dev/pc-pairing-invalid', '配对后的 host.info 身份不匹配，已移除本地凭证；主机可能仍保留此设备授权，请在主机管理页撤销', { reason: 'host.info identity mismatch' })
      }
      throw error
    }
  }

  async connect(profileId: string, signal: AbortSignal): Promise<PcConnectValue> {
    const profile = await this.requireProfile(profileId)
    // Pressing 连接 is intent even if this handshake then fails, so a later transport
    // loss still finds the connection wanted. Only a user disconnect withdraws it.
    if (pcDesiredStateOf(profile) !== 'connected') await this.storeIntent(profileId, 'connected')
    try {
      return await this.connectProfile(profile, signal)
    } catch (error) {
      if (error instanceof IdentityMismatchError) throw remoteError('remote-dev/pc-pairing-invalid', '主机身份与已保存的配对身份不匹配', { reason: 'host.info identity mismatch' })
      throw error
    }
  }

  async disconnect(profileId: string): Promise<void> {
    await this.requireProfile(profileId)
    // The user withdrawing intent is recorded before the socket goes away, so the
    // transport `close` that follows cannot be mistaken for a reconnectable loss.
    await this.storeIntent(profileId, 'disconnected')
    this.closeSocket(profileId)
  }

  /**
   * Tear the live socket down without touching the stored intent. A new connect
   * replaces its own previous socket, and replacing a socket is not the user asking
   * for less — only an explicit disconnect withdraws the intent.
   */
  private closeSocket(profileId: string): void {
    const active = this.connections.get(profileId)
    if (active === undefined) return
    this.connections.delete(profileId)
    rejectPending(active, new Error('connection disconnected'))
    active.socket.close(1000, 'client disconnect')
  }

  async forget(profileId: string): Promise<void> {
    await this.requireProfile(profileId)
    await this.disconnect(profileId)
    try { await this.store.remove(profileId) } catch (error) { throw storageError(error) }
  }

  async revoke(profileId: string, generation: string, signal: AbortSignal): Promise<void> {
    const resultJson = await this.call({ profileId, generation, method: 'device.revokeSelf', paramsJson: '{}' }, signal)
    void resultJson
    await this.forget(profileId)
  }

  async call(request: PcCallRequest, signal: AbortSignal): Promise<string> {
    if (typeof request.method !== 'string' || !ALLOWED_METHODS.has(request.method)) {
      throw remoteError('remote-dev/pc-method-unsupported', '该方法不属于 Perse Remote 开发接口', { method: request.method })
    }
    let params: unknown
    try {
      if (typeof request.paramsJson !== 'string' || Buffer.byteLength(request.paramsJson, 'utf8') > RPC_FRAME_MAX_BYTES) throw new Error('too large')
      params = JSON.parse(request.paramsJson)
    } catch {
      throw remoteError('remote-dev/pc-payload-too-large', '请求参数不是有效 JSON 或超过大小限制', { limitBytes: RPC_FRAME_MAX_BYTES })
    }
    if (params === null || Array.isArray(params) || typeof params !== 'object') {
      throw remoteError('remote-dev/pc-pairing-invalid', 'RPC 参数必须是 JSON 对象', { reason: 'params must be an object' })
    }
    const profile = await this.requireProfile(request.profileId)
    const active = this.connections.get(profile.profileId)
    if (active === undefined) throw remoteError('remote-dev/pc-transport-failed', '主机当前未连接，请重新连接后重试', { profileId: profile.profileId, method: request.method, reason: 'offline' })
    if (!active.verified || active.socket.readyState !== WebSocket.OPEN) throw remoteError('remote-dev/pc-transport-failed', '主机连接尚未完成身份验证', { profileId: profile.profileId, method: request.method, reason: 'not verified' })
    if (active.generation !== request.generation) {
      throw remoteError('remote-dev/pc-generation-stale', '连接已变化，请刷新主机状态后重试', { profileId: profile.profileId, expectedGeneration: request.generation, currentGeneration: active.generation })
    }
    let result: unknown
    try {
      result = await rpcCall(active, request.method, params, signal, () => this.connections.get(profile.profileId) === active && active.generation === request.generation)
    } catch (error) {
      if (error instanceof RemoteError) {
        if (error.code === 'remote-dev/pc-protocol-unsupported') await this.updateStatus(profile, 'offline')
        throw error
      }
      if (error instanceof RpcRemoteFailure) throw mapRemoteFailure(profile.profileId, profile.token, request.method, error)
      throw remoteError('remote-dev/pc-transport-failed', 'Perse Remote 连接中断或请求超时', {
        profileId: profile.profileId, method: request.method, reason: safeReason(error),
      })
    }
    const rawResultJson = JSON.stringify(result)
    if (typeof rawResultJson !== 'string' || Buffer.byteLength(rawResultJson, 'utf8') > RPC_FRAME_MAX_BYTES) {
      throw remoteError('remote-dev/pc-payload-too-large', '远端响应超过桥接大小限制', { limitBytes: RPC_FRAME_MAX_BYTES })
    }
    const resultJson = redact(rawResultJson, profile.token)
    return resultJson
  }

  dispose(): void {
    for (const [id, active] of this.connections) {
      this.connections.delete(id)
      rejectPending(active, new Error('bridge disposed'))
      // Shutdown ends the socket instead of waiting for a close handshake that a dead or
      // restarting host never answers; a lingering socket would outlive the plugin.
      active.socket.terminate()
    }
    this.previews.clear()
  }

  private prunePreviews(): void {
    const now = Date.now()
    for (const [id, handle] of this.previews) if (handle.expiresAt <= now) this.previews.delete(id)
  }

  private async connectProfile(profile: PcStoredProfile, signal: AbortSignal): Promise<PcConnectValue> {
    // Replace our own previous socket only. Going through disconnect() here would
    // record a user withdrawal that the user never asked for.
    this.closeSocket(profile.profileId)
    validateEndpoint(profile.endpoint, profile.networkMode)
    const socket = new WebSocket(profile.endpoint, {
      headers: { Authorization: `Bearer ${profile.token}` },
      followRedirects: false,
      handshakeTimeout: 10_000,
      maxPayload: RPC_FRAME_MAX_BYTES,
      perMessageDeflate: false,
    })
    const active: ActiveConnection = {
      profileId: profile.profileId,
      generation: randomUUID(),
      socket,
      nextId: 0,
      verified: false,
      pending: new Map(),
    }
    this.connections.set(profile.profileId, active)
    bindSocket(active, () => this.connections.get(profile.profileId) === active)
    socket.once('close', () => {
      if (this.connections.get(profile.profileId) === active) {
        this.connections.delete(profile.profileId)
        void this.updateStatus(profile, 'offline')
      }
    })
    const abort = (): void => socket.terminate()
    signal.addEventListener('abort', abort, { once: true })
    try {
      await waitForOpen(socket)
      if (signal.aborted) signal.throwIfAborted()
      const result = await rpcCall(active, 'host.info', {}, signal, () => this.connections.get(profile.profileId) === active)
      const info = asRecord(result)
      const host = asRecord(info.host)
      const version = info.protocolVersion
      if (host.id !== profile.hostId) throw new IdentityMismatchError()
      if (typeof version !== 'string' || !isSupportedProtocol(version)) throw unsupportedProtocol(typeof version === 'string' ? version : 'unknown')
      const verifiedAt = new Date().toISOString()
      try {
        await this.store.update(profile.profileId, (current) => {
          if (this.connections.get(profile.profileId) !== active || socket.readyState !== WebSocket.OPEN) throw new Error('connection generation became stale')
          if (current.hostId !== profile.hostId || current.token !== profile.token) throw new Error('profile identity changed')
          return { ...current, status: 'connected', desiredState: 'connected', protocolVersion: version, verifiedAt }
        })
      } catch (error) {
        if (error instanceof Error && /generation|identity changed|profile not found/.test(error.message)) throw error
        throw storageError(error)
      }
      if (this.connections.get(profile.profileId) !== active || socket.readyState !== WebSocket.OPEN) throw new Error('connection closed after verification')
      active.verified = true
      const rawHostInfoJson = JSON.stringify(result)
      if (typeof rawHostInfoJson !== 'string' || Buffer.byteLength(rawHostInfoJson, 'utf8') > RPC_FRAME_MAX_BYTES) throw new Error('invalid or oversized host.info result')
      const hostInfoJson = redact(rawHostInfoJson, profile.token)
      return { profileId: profile.profileId, hostId: profile.hostId, generation: active.generation, hostInfoJson }
    } catch (error) {
      if (this.connections.get(profile.profileId) === active) this.connections.delete(profile.profileId)
      rejectPending(active, new Error('connection failed'))
      socket.terminate()
      if (error instanceof RemoteError) throw error
      if (error instanceof IdentityMismatchError) {
        await this.updateStatus(profile, 'revoked')
        throw error
      }
      if (error instanceof RpcRemoteFailure) throw mapRemoteFailure(profile.profileId, profile.token, 'host.info', error)
      await this.updateStatus(profile, 'offline')
      throw remoteError('remote-dev/pc-transport-failed', '无法连接到 Perse Remote 主机；已保留本地配对授权，可稍后重试', {
        profileId: profile.profileId, method: 'host.info', reason: safeReason(error),
      })
    } finally {
      signal.removeEventListener('abort', abort)
    }
  }

  private async requireProfile(profileId: string): Promise<PcStoredProfile> {
    let profile: PcStoredProfile | undefined
    try { profile = await this.store.get(profileId) } catch (error) { throw storageError(error) }
    if (profile === undefined) throw remoteError('remote-dev/pc-profile-invalid', '找不到已保存的 PC 连接', { profileId })
    return profile
  }

  private async updateStatus(profile: PcStoredProfile, status: PcStoredProfile['status']): Promise<void> {
    try {
      // Status only: a transport observation never rewrites the stored intent.
      await this.store.update(profile.profileId, (current) => ({ ...current, status }))
    } catch {
      // The original transport failure is authoritative; the profile remains available for explicit inspection.
    }
  }

  /**
   * Persist what the user asked for; only a user action reaches this. A lost socket,
   * a failed handshake or a host-side error never comes through here, so recording a
   * loss can never remove reconnect eligibility. A withdrawn intent also records the
   * honest `disconnected` observation, except over a revoked grant, which is the more
   * serious fact. A write failure is logged once without any credential: a lost
   * disconnect intent would otherwise resurrect a connection the user closed.
   */
  private async storeIntent(profileId: string, desiredState: 'connected' | 'disconnected'): Promise<void> {
    try {
      await this.store.update(profileId, (current) => ({
        ...current,
        desiredState,
        ...(desiredState === 'disconnected' && current.status !== 'revoked' ? { status: 'disconnected' as const } : {}),
      }))
    } catch (error) {
      const name = error instanceof Error && error.name !== '' ? error.name : typeof error
      console.error(`[perse-remote-dev] pc-profile-intent write failed profile=${profileId} state=${desiredState} class=${name} reason=${safeReason(error)}`)
    }
  }
}

export function parsePairLink(link: string, now = Date.now()): PairPayload {
  if (typeof link !== 'string' || Buffer.byteLength(link, 'utf8') > PAIR_LINK_MAX_BYTES || !link.startsWith('persevere://pair#')) {
    throw remoteError('remote-dev/pc-pairing-invalid', '配对链接格式无效或超过 8 KiB', { reason: 'invalid link' })
  }
  const encoded = link.slice('persevere://pair#'.length)
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw remoteError('remote-dev/pc-pairing-invalid', '配对链接编码无效', { reason: 'invalid base64url' })
  let value: unknown
  try {
    const raw = Buffer.from(encoded, 'base64url')
    if (raw.toString('base64url') !== encoded) throw new Error('noncanonical')
    value = JSON.parse(raw.toString('utf8'))
  } catch {
    throw remoteError('remote-dev/pc-pairing-invalid', '配对链接内容无效', { reason: 'invalid payload' })
  }
  let p: Record<string, unknown>
  try { p = asRecord(value) } catch { throw remoteError('remote-dev/pc-pairing-invalid', '配对链接内容不是对象', { reason: 'invalid payload object' }) }
  const exactKeys = ['endpoint', 'expiresAt', 'hostId', 'hostName', 'networkMode', 'pairingId', 'secret', 'v'].sort()
  if (Object.keys(p).sort().join('\0') !== exactKeys.join('\0')) throw remoteError('remote-dev/pc-pairing-invalid', '配对链接字段不符合 1.1 契约', { reason: 'unexpected fields' })
  if (p.v !== 1 || !isShortString(p.hostId, 1, 256) || !isShortString(p.hostName, 1, 256) || !isShortString(p.pairingId, 1, 128)
    || typeof p.secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(p.secret) || !isShortString(p.expiresAt, 1, 64)
    || !['https', 'tailnet', 'local'].includes(String(p.networkMode)) || typeof p.endpoint !== 'string') {
    throw remoteError('remote-dev/pc-pairing-invalid', '配对链接内容无效', { reason: 'invalid fields' })
  }
  const secretBytes = Buffer.from(p.secret, 'base64url')
  if (secretBytes.byteLength !== 32 || secretBytes.toString('base64url') !== p.secret) {
    throw remoteError('remote-dev/pc-pairing-invalid', '配对密钥编码无效', { reason: 'invalid secret encoding' })
  }
  const expiresAt = Date.parse(p.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + PAIR_HANDLE_TTL_MS + 30_000) {
    throw remoteError('remote-dev/pc-pairing-invalid', '配对链接已过期或有效期超出限制', { reason: 'expired or overlong' })
  }
  validateEndpoint(p.endpoint, p.networkMode as PairPayload['networkMode'])
  return p as unknown as PairPayload
}

function validateEndpoint(endpoint: string, mode: PairPayload['networkMode']): void {
  let url: URL
  try { url = new URL(endpoint) } catch { throw remoteError('remote-dev/pc-pairing-invalid', '配对地址无效', { reason: 'invalid endpoint' }) }
  const localHost = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname.toLowerCase())
  const transportAllowed = url.protocol === 'wss:' || (url.protocol === 'ws:' && localHost && mode === 'local')
  if (url.username || url.password || url.pathname !== '/rpc' || url.search || url.hash || url.href !== endpoint
    || !transportAllowed || (url.protocol === 'ws:' && !localHost)) {
    throw remoteError('remote-dev/pc-pairing-invalid', '配对地址必须是规范的 wss://host/rpc；明文 ws 仅允许本地 loopback', { reason: 'endpoint policy rejected' })
  }
}

async function exchangePair(payload: PairPayload, deviceName: string, signal: AbortSignal): Promise<ExchangeResult> {
  const rpcUrl = new URL(payload.endpoint)
  const exchange = new URL(payload.endpoint)
  exchange.protocol = rpcUrl.protocol === 'wss:' ? 'https:' : 'http:'
  exchange.pathname = '/pair/exchange'
  exchange.search = ''
  exchange.hash = ''
  let response: Response
  const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(10_000)])
  try {
    response = await fetch(exchange, {
      method: 'POST',
      redirect: 'error',
      signal: boundedSignal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ pairingId: payload.pairingId, secret: payload.secret, deviceName }),
    })
  } catch {
    throw new Error('pairing exchange failed')
  }
  const length = Number(response.headers.get('content-length') ?? '0')
  if (length > PAIR_RESPONSE_MAX_BYTES) throw new Error('pairing response too large')
  const bytes = await readBoundedBody(response, PAIR_RESPONSE_MAX_BYTES)
  if (!response.ok) throw new Error(`pairing exchange rejected (${response.status})`)
  let value: unknown
  try { value = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new Error('invalid pairing response') }
  const body = asRecord(value)
  const device = asRecord(body.device)
  const host = asRecord(body.host)
  if (typeof body.token !== 'string' || body.token.length < 32 || body.token.length > 4096
    || typeof body.endpoint !== 'string' || typeof body.protocolVersion !== 'string'
    || typeof device.id !== 'string' || typeof device.name !== 'string' || typeof device.createdAt !== 'string'
    || typeof host.id !== 'string' || typeof host.name !== 'string') throw new Error('invalid pairing response')
  return body as unknown as ExchangeResult
}

function bindSocket(active: ActiveConnection, isCurrent: () => boolean): void {
  active.socket.on('message', (data) => {
    const bytes = rawDataBuffer(data)
    if (bytes.byteLength > RPC_FRAME_MAX_BYTES) {
      active.socket.terminate()
      return
    }
    let response: RpcResponse
    try { response = JSON.parse(bytes.toString('utf8')) as RpcResponse } catch { return }
    if (response.jsonrpc !== '2.0' || !Number.isInteger(response.id) || !isCurrent()) return
    const pending = active.pending.get(response.id as number)
    if (pending === undefined) return
    active.pending.delete(response.id as number)
    clearTimeout(pending.timeout)
    if (response.error !== undefined) pending.reject(new RpcRemoteFailure(response.error))
    else pending.resolve(response.result)
  })
  active.socket.on('close', () => rejectPending(active, new Error('socket closed')))
  active.socket.on('error', () => rejectPending(active, new Error('socket error')))
}

function rpcCall(active: ActiveConnection, method: string, params: unknown, signal: AbortSignal, isCurrent: () => boolean): Promise<unknown> {
  if (signal.aborted) return Promise.reject(noDispatchFailure(method, 'request was cancelled before dispatch'))
  if (!isCurrent()) return Promise.reject(noDispatchFailure(method, 'connection generation is stale'))
  const id = ++active.nextId
  const frame = JSON.stringify({ jsonrpc: '2.0', id, method, params })
  if (Buffer.byteLength(frame, 'utf8') > RPC_FRAME_MAX_BYTES) {
    return Promise.reject(remoteError('remote-dev/pc-payload-too-large', 'RPC 请求超过大小限制', { limitBytes: RPC_FRAME_MAX_BYTES }))
  }
  if (active.socket.readyState !== WebSocket.OPEN) return Promise.reject(noDispatchFailure(method, 'socket was offline before dispatch'))
  return new Promise((resolve, reject) => {
    let dispatched = false
    const timeout = setTimeout(() => {
      active.pending.delete(id)
      signal.removeEventListener('abort', abort)
      reject(new Error('RPC timed out'))
    }, RPC_TIMEOUT_MS)
    const abort = (): void => {
      active.pending.delete(id)
      clearTimeout(timeout)
      reject(dispatched
        ? remoteError('remote-dev/pc-outcome-unknown', 'RPC was cancelled after dispatch; the remote outcome is unknown', { method, dispatchBoundary: 'socket.send' })
        : noDispatchFailure(method, 'request was cancelled before dispatch'))
    }
    signal.addEventListener('abort', abort, { once: true })
    active.pending.set(id, {
      resolve: (value) => { signal.removeEventListener('abort', abort); resolve(value) },
      reject: (error) => { signal.removeEventListener('abort', abort); reject(error) },
      timeout,
    })
    // Recheck immediately before the actual dispatch: a queued old-generation call never crosses a new socket.
    if (!isCurrent() || active.socket.readyState !== WebSocket.OPEN) {
      active.pending.delete(id)
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      reject(noDispatchFailure(method, 'connection generation or socket became stale before dispatch'))
      return
    }
    if (signal.aborted) {
      active.pending.delete(id)
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      reject(noDispatchFailure(method, 'request was cancelled before dispatch'))
      return
    }
    // Calling send is the dispatch boundary. A later abort, close, or lost
    // response cannot establish whether the remote mutation was accepted.
    dispatched = true
    active.socket.send(frame, (error) => {
      if (error == null) return
      const item = active.pending.get(id)
      if (item === undefined) return
      active.pending.delete(id)
      clearTimeout(item.timeout)
      item.reject(error)
    })
  })
}

function noDispatchFailure(method: string, reason: string): RemoteError {
  return remoteError('remote-dev/pc-no-dispatch', 'RPC was not sent to the remote host', { method, reason, dispatchBoundary: 'socket.send' })
}

function rejectPending(active: ActiveConnection, error: Error): void {
  for (const [id, item] of active.pending) {
    active.pending.delete(id)
    clearTimeout(item.timeout)
    item.reject(error)
  }
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const onOpen = (): void => { cleanup(); resolve() }
    const onError = (): void => { cleanup(); reject(new Error('socket open failed')) }
    const onClose = (): void => { cleanup(); reject(new Error('socket closed before opening')) }
    const cleanup = (): void => {
      socket.off('open', onOpen)
      socket.off('error', onError)
      socket.off('close', onClose)
    }
    socket.once('open', onOpen)
    socket.once('error', onError)
    socket.once('close', onClose)
  })
}

class RpcRemoteFailure extends Error {
  constructor(readonly remote: NonNullable<RpcResponse['error']>) { super('remote RPC returned an error') }
}

class IdentityMismatchError extends Error {}

function isSupportedProtocol(version: string): boolean {
  const match = /^1\.(\d+)$/.exec(version)
  return match !== null && Number(match[1]) >= 1
}

function unsupportedProtocol(version: string): RemoteError {
  return remoteError('remote-dev/pc-protocol-unsupported', '主机协议版本不受 PC 客户端支持', {
    protocolVersion: version, requiredMajor: 1, minimumMinor: 1,
  })
}

function mapRemoteFailure(profileId: string, token: string, method: string, error: RpcRemoteFailure): RemoteError {
  const code = error.remote.code
  const message = error.remote.message
  const data = error.remote.data
  return remoteError('remote-dev/pc-remote-error', '远端 Perse Remote 调用失败', {
    profileId, method,
    remoteCode: typeof code === 'number' && Number.isInteger(code) ? code : -32603,
    remoteMessage: redact(typeof message === 'string' ? message.slice(0, 2000) : 'Unknown remote error', token),
    ...(data === undefined ? {} : { dataJson: redact(boundedJson(data) ?? '', token) }),
  })
}

function remoteError(code: string, message: string, details: Record<string, unknown>): RemoteError {
  return new RemoteError(code as never, message, details as never)
}

function storageError(error: unknown): RemoteError {
  const reason = safeReason(error).replace(/(?:secret|token)[=: ]+[^\s,;]+/gi, '[redacted]')
  return remoteError('remote-dev/pc-storage-unavailable', '本机 PC 配对配置无法安全读取或保存', { reason })
}

function safeReason(error: unknown): string {
  const value = error instanceof Error ? error.message : `non-error ${typeof error} ${Object.prototype.toString.call(error)}`
  return value.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').slice(0, 120)
}

function redact(value: string, secret: string): string {
  return secret === '' ? value : value.split(secret).join('[redacted]')
}

function isShortString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max && value.trim() === value
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected object')
  return value as Record<string, unknown>
}

function rawDataBuffer(data: RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data)
  return Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
}

function boundedJson(value: unknown): string | undefined {
  try {
    const json = JSON.stringify(value)
    return Buffer.byteLength(json, 'utf8') <= 16 * 1024 ? json : '{"truncated":true}'
  } catch { return undefined }
}

async function readBoundedBody(response: Response, limit: number): Promise<Uint8Array> {
  if (response.body === null) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel()
        throw new Error('pairing response too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength }
  return output
}
