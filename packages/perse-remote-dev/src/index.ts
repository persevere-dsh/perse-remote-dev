/**
 * `perse-remote-dev` host face — a typed Remote owner.
 *
 * Namespace: `remoteDev` (service key `remoteDev`, same name on the
 * wire). Every capability of the former 14 hand-written `/remote-dev/**`
 * HTTP routes is expressed as a `@Remote` method over package-owned JSON types,
 * served inside the Connection `/api` trust fence. There is deliberately **no**
 * `ctx.webServer.register` call anywhere in this package: the former prefix
 * routes were outside the authentication fence, and moving the handlers into
 * `@Remote` while keeping a self-made entry point would have reproduced the
 * exact "authentication migration illusion" the analysis warned about.
 *
 * Reused semantics (carried over verbatim, see the individual modules):
 * base64 ssh argv, `~/.ssh/config` alias resolution, the tunnel-failure
 * classifier, the rd-core engine protocol, the settings registration pattern,
 * and the path/name assertions.
 *
 * Rewritten: the HTTP dispatcher and `sendJson`, the error surface (`RemoteError`
 * codes instead of hand-built `{error}` bodies with everything folded into 400),
 * the tunnel registry's lifecycle, and identity/path semantics (a host-issued
 * proof binds every path to the host that produced it).
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { EngineExecutionError, brief, filterDiffByFiles, parseBatch, runEngine } from './engine.ts'
import type { EngineBatch, EngineRun } from './engine.ts'
import {
  IdentitySigner,
  InvalidNameError,
  InvalidPathError,
  assertSafeName,
  assertSafePath,
  joinPosix,
  locationFields,
  parentOf,
  reviewFields,
} from './identity.ts'
import { DECODE_PATH, SSH_PROBE_FLAGS, SshExecutionError, foldHosts, parseSshHosts, sshScript } from './ssh.ts'
import type { FoldedSshHost, SshEndpoint } from './ssh.ts'
import {
  MISSING_HINT,
  REVIEW_HUB_HINT,
  RemoteWorkspaceSettingsSchema,
  SETTINGS_NS,
  decisionsPath,
  migrateTargetsToHosts,
  remotePortOf,
} from './settings.ts'
import type { RemoteWorkspaceSettingsDocument, SettingsScope } from './settings.ts'
import { TunnelManager } from './tunnels.ts'
import type {
  RemoteCloseTunnelRequest,
  RemoteConfigurationRequest,
  RemoteConfigurationUpdate,
  RemoteConfigurationUpdateValue,
  RemoteConfigurationValue,
  RemoteDecisionRecord,
  RemoteDescribeRequest,
  RemoteDirectoryEntry,
  RemoteDirectoryListing,
  RemoteHostView,
  RemoteLinkState,
  RemoteWorkspaceHostSetting,
  RemoteListRequest,
  RemoteMkdirRequest,
  RemoteOpenProjectRequest,
  RemoteOpenedProject,
  RemoteReviewApplyRequest,
  RemoteReviewApplyResult,
  RemoteReviewBatch,
  RemoteReviewBatchRequest,
  RemoteReviewRejectRequest,
  RemoteReviewRollbackRequest,
  RemoteReviewRollbackResult,
  RemoteReviewStatus,
  RemoteReviewStatusRequest,
  RemoteReviewStep,
  RemoteReviewTarget,
  RemoteServiceDescription,
  RemoteTargetsRequest,
  RemoteTargetsValue,
  RemoteTunnelClosedValue,
  RemoteTunnelListRequest,
  RemoteTunnelListValue,
  RemoteTunnelRequest,
  RemoteTunnelView,
  RemoteWorkspaceLocation,
  RemoteWorkspaceTarget,
} from './types.ts'

export type * from './types.ts'

/** Cordis service key and wire namespace. */
export const SERVICE_KEY = 'remoteDev'

/** Namespace as it appears on the wire (`<namespace>/<method>`). */
export const NAMESPACE = 'remoteDev'

/** Cache window for the folded `~/.ssh/config` inventory. */
const HOSTS_CACHE_MS = 5000
/** Cache window for ssh reachability probes. */
const PROBE_CACHE_MS = 20000

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `remoteDev` Remote namespace. */
    remoteDev: RemoteWorkspaceService
  }
}

/** One resolved local target. */
interface LocalResolution {
  readonly kind: 'local'
  readonly target: RemoteWorkspaceTarget
  readonly host: string
}

/** One resolved ssh target. */
interface SshResolution {
  readonly kind: 'ssh'
  readonly target: RemoteWorkspaceTarget
  readonly host: string
  readonly endpoint: SshEndpoint
  readonly settings?: RemoteWorkspaceHostSetting
}

/** One resolved target: `local`, or a concrete ssh endpoint. */
type TargetResolution = LocalResolution | SshResolution

/** One resolved review identity bundle. */
interface ReviewResolution {
  readonly target: RemoteReviewTarget
  readonly host: string
  readonly endpoint: SshEndpoint
}

/** A listing as the transport produced it, before identity proofs are attached. */
interface RawListing {
  readonly path: string
  readonly home: string
  readonly entries: readonly { readonly name: string; readonly path: string; readonly hidden: boolean }[]
}

/** Effective target chain resolved from settings. */
interface TargetChain {
  readonly host: string
  readonly hostId: string
  readonly projectPath: string
  readonly mDir: string
  readonly hub: string
  readonly verifyCmd: string
  readonly missing: string[]
}

/**
 * Host face of the remote-development workspace plugin.
 */
export class RemoteWorkspaceService extends TypertRemoteService {
  /**
   * The registry service is part of every base-backed profile and carries the
   * descriptors this package's `./typert` artifact registers.
   */
  static inject = ['typert']

  private readonly host: Context
  private readonly signer = new IdentitySigner()
  private readonly tunnels: TunnelManager
  private scope: SettingsScope | undefined
  private hostCache: { readonly at: number; readonly hosts: FoldedSshHost[] } | undefined
  private probeCache: { readonly at: number; readonly states: Map<string, RemoteLinkState> } | undefined
  private revision: string | undefined

  /** @param ctx - Host context. */
  constructor(ctx: Context) {
    // The generator requires the service key and namespace to be *string
    // literals* here (TypertAnalysisError: "Gateway service key must be a
    // string literal"); the SERVICE_KEY/NAMESPACE constants below must stay in
    // step with these two literals.
    super(ctx, 'remoteDev', { namespace: 'remoteDev' })
    this.host = ctx
    this.tunnels = new TunnelManager({
      readToken: (endpoint, remotePort) => this.readRemoteToken(endpoint, remotePort),
    })
    this.host.inject(['settings'], (settingsCtx) => {
      const settings = (settingsCtx as { settings?: { register(ns: string, schema: unknown): SettingsScope } }).settings
      if (settings === undefined || typeof settings.register !== 'function') {
        console.error('[perse-remote-dev] settings 服务不可用，配置面将报 remote-dev/settings-unavailable')
        return
      }
      try {
        const handle = settings.register(SETTINGS_NS, RemoteWorkspaceSettingsSchema)
        this.scope = handle
        settingsCtx.effect(() => () => {
          if (this.scope === handle) this.scope = undefined
        }, 'remote-dev.settings')
      } catch (error) {
        console.error('[perse-remote-dev] settings 命名空间注册失败：', error)
      }
    })
    this.host.effect(() => () => {
      this.tunnels.dispose()
    }, 'remote-dev.tunnels')
  }

  // ── Remote methods ───────────────────────────────────────────────────────

  /**
   * List selectable targets: the local machine, the user's configured hosts, and
   * (on request) every `~/.ssh/config` alias. Replaces `GET /hosts` and its
   * `all` / `probe` / `fresh` query switches.
   * @param request - scope and probe switches.
   * @param signal - carrier cancellation.
   */
  @Remote
  async listTargets(request: RemoteTargetsRequest, signal: AbortSignal): Promise<RemoteTargetsValue> {
    signal.throwIfAborted()
    const local = this.localView()
    if (request.includeAll) {
      const folded = await this.sshHosts(request.fresh)
      const views = [local, ...folded.map((h) => this.foldedView(h))]
      await this.applyProbe(views, request.probe, request.fresh, signal)
      return { targets: views, configuredOnly: false }
    }
    const { hosts } = this.configuredHosts()
    const folded = await this.sshHosts(request.fresh)
    const views: RemoteHostView[] = [local]
    for (const record of hosts) {
      const key = stableIdOf(record)
      const known = folded.find((h) => h.id === key)
      views.push(known !== undefined
        ? { ...this.foldedView(known), name: record.name !== '' ? record.name : known.name, configured: true }
        : {
          id: key,
          name: record.name !== '' ? record.name : key,
          kind: 'ssh',
          state: 'unknown',
          detail: `${record.username !== '' ? `${record.username}@` : ''}${record.address !== '' ? record.address : key}${record.port !== '' ? `:${record.port}` : ''}`,
          hostName: record.address,
          user: record.username,
          port: record.port,
          proxyJump: '',
          aliases: [],
          jump: false,
          configured: true,
        })
    }
    await this.applyProbe(views, request.probe, request.fresh, signal)
    return { targets: views, configuredOnly: true }
  }

  /**
   * Read the effective configuration. Replaces `GET /config`.
   * @param request - whether to include ssh-config import candidates.
   * @param signal - carrier cancellation.
   */
  @Remote
  async readConfiguration(request: RemoteConfigurationRequest, signal: AbortSignal): Promise<RemoteConfigurationValue> {
    signal.throwIfAborted()
    this.requireScope()
    const document = this.readDocument()
    const { hosts, migrated } = this.configuredHosts()
    const chain = this.resolveChain()
    const candidates = request.includeCandidates
      ? (await this.sshHosts(false)).map((h) => ({ ...this.foldedView(h), configured: false }))
      : []
    return {
      hosts,
      migrated,
      enginePath: document.enginePath ?? '',
      resolved: {
        host: chain.host,
        hostId: chain.hostId,
        projectPath: chain.projectPath,
        mDir: chain.mDir,
        hub: chain.hub,
        verifyCmd: chain.verifyCmd,
      },
      configured: chain.missing.length === 0,
      missing: chain.missing,
      hint: MISSING_HINT,
      candidates,
    }
  }

  /**
   * Write host records and the target chain. Replaces `POST /config`. Validation
   * problems are returned as one typed failure instead of a hand-built body.
   * @param request - the records plus the scalar chain fields.
   * @param signal - carrier cancellation.
   */
  @Remote
  async updateConfiguration(
    request: RemoteConfigurationUpdate,
    signal: AbortSignal,
  ): Promise<RemoteConfigurationUpdateValue> {
    signal.throwIfAborted()
    const problems: string[] = []
    request.hosts.forEach((hp, i) => {
      const at = `第 ${i + 1} 台主机`
      if (!String(hp.id || '').trim()) problems.push(`${at}：缺少标识`)
      if (!String(hp.address || '').trim() && !String(hp.fromAlias || '').trim()) problems.push(`${at}：缺少网络地址`)
      if (String(hp.port || '') !== '' && !/^[0-9]+$/.test(String(hp.port))) problems.push(`${at}：端口必须是数字`)
      const auth = String(hp.auth || '')
      if (auth !== '' && !['key', 'password', 'agent'].includes(auth)) problems.push(`${at}：登陆方式只能是 key / password / agent`)
    })
    if (problems.length > 0) {
      throw new RemoteError('remote-dev/config-invalid', problems.join('；'), { problems })
    }
    const scope = this.requireScope()
    const patch: Record<string, unknown> = { hosts: request.hosts }
    if (request.projectPath !== '') patch['workspace'] = request.projectPath
    if (request.mDir !== '') patch['mDir'] = request.mDir
    if (request.hub !== '') patch['hub'] = request.hub
    if (request.enginePath !== '') patch['enginePath'] = request.enginePath
    await scope.update(patch)
    const chain = this.resolveChain()
    return { configured: chain.missing.length === 0, missing: chain.missing }
  }

  /**
   * List one directory on one host. Replaces `GET /list`.
   *
   * The answer carries a host-issued proof for the resolved directory and for
   * every entry, so a later mutating verb cannot combine this host with a path
   * that came from another one.
   * @param request - host identity and absolute path (empty means home).
   * @param signal - carrier cancellation.
   */
  @Remote
  async listDirectory(request: RemoteListRequest, signal: AbortSignal): Promise<RemoteDirectoryListing> {
    signal.throwIfAborted()
    const resolved = await this.endpointFor(request.target.hostId)
    const listing = resolved.kind === 'local'
      ? await this.listLocal(request.path)
      : await this.listRemote(resolved, request.path)
    const location = this.locationOf(resolved.host, listing.path)
    const entries: RemoteDirectoryEntry[] = listing.entries.map((e) => ({
      name: e.name,
      path: e.path,
      hidden: e.hidden,
      location: this.locationOf(resolved.host, e.path),
    }))
    return {
      target: resolved.target,
      host: resolved.host,
      path: listing.path,
      ...listing.path === '/' ? {} : { parent: parentOf(listing.path) ?? '/' },
      home: listing.home,
      location,
      entries,
    }
  }

  /**
   * Create one directory below a host-observed location. Replaces `POST /mkdir`.
   *
   * Remote creation is served, not approximated away: the verb answers for both
   * host kinds, and an unsupported host kind is refused at the host rather than
   * hidden in the UI.
   * @param request - proof-bearing parent location plus the new segment.
   * @param signal - carrier cancellation.
   */
  @Remote
  async createDirectory(request: RemoteMkdirRequest, signal: AbortSignal): Promise<RemoteWorkspaceLocation> {
    signal.throwIfAborted()
    const location = this.assertLocation(request.location)
    const directory = assertSafePath(location.path)
    let name: string
    try {
      name = assertSafeName(request.name)
    } catch (error) {
      if (error instanceof InvalidNameError) {
        throw new RemoteError('remote-dev/name-invalid', error.message, { name: request.name })
      }
      throw error
    }
    const resolved = await this.endpointFor(location.target.hostId)
    const created = joinPosix(directory, name)
    if (resolved.kind === 'local') {
      await this.mkdirLocal(created)
    } else {
      await this.mkdirRemote(resolved, created)
    }
    return this.locationOf(resolved.host, created)
  }

  /**
   * Register a project path on a host and open that host's DSH. Replaces
   * `POST /open-project`.
   * @param request - proof-bearing location, persistence and token strictness.
   * @param signal - carrier cancellation.
   */
  @Remote
  async openProject(request: RemoteOpenProjectRequest, signal: AbortSignal): Promise<RemoteOpenedProject> {
    signal.throwIfAborted()
    const location = this.assertLocation(request.location)
    const path = assertSafePath(location.path)
    const resolved = await this.endpointFor(location.target.hostId)
    if (resolved.kind !== 'ssh') {
      throw new RemoteError(
        'remote-dev/target-not-remote',
        `本机（${resolved.host}）没有需要打开的远端 DSH；请选择一个 ssh 主机`,
        { hostId: resolved.host },
      )
    }
    let saved = false
    if (request.remember) {
      saved = await this.rememberProject(resolved, path)
    }
    const opened = await this.tunnels.open({
      hostId: resolved.host,
      configId: resolved.settings !== undefined ? resolved.settings.id : '',
      endpoint: resolved.endpoint,
      remotePort: resolved.settings !== undefined ? remotePortOf(resolved.settings) : '3080',
      requireAuthentication: request.requireAuthentication,
    }, signal)
    const view = opened.view
    return {
      target: resolved.target,
      host: resolved.host,
      path,
      url: view.url,
      localPort: view.localPort,
      remotePort: view.remotePort,
      reused: opened.reused,
      authenticated: view.authenticated,
      saved,
      ...view.warning === undefined ? {} : { warning: view.warning },
    }
  }

  /**
   * Open or reuse the tunnel to one host's DSH. Replaces `POST /tunnel`.
   * @param request - host identity and token strictness.
   * @param signal - carrier cancellation.
   */
  @Remote
  async openTunnel(request: RemoteTunnelRequest, signal: AbortSignal): Promise<RemoteTunnelView> {
    signal.throwIfAborted()
    const resolved = await this.endpointFor(request.target.hostId)
    if (resolved.kind !== 'ssh') {
      throw new RemoteError(
        'remote-dev/target-not-remote',
        `本机（${resolved.host}）不需要 ssh 隧道`,
        { hostId: resolved.host },
      )
    }
    const opened = await this.tunnels.open({
      hostId: resolved.host,
      configId: resolved.settings !== undefined ? resolved.settings.id : '',
      endpoint: resolved.endpoint,
      remotePort: resolved.settings !== undefined ? remotePortOf(resolved.settings) : '3080',
      requireAuthentication: request.requireAuthentication,
    }, signal)
    return opened.view
  }

  /**
   * List live tunnels. Replaces `GET /tunnel`.
   * @param request - whether to include exited tunnels.
   * @param signal - carrier cancellation.
   */
  @Remote
  listTunnels(request: RemoteTunnelListRequest, signal: AbortSignal): Promise<RemoteTunnelListValue> {
    signal.throwIfAborted()
    const tunnels = this.tunnels.list().filter((t) => request.includeDead || t.alive)
    return Promise.resolve({ tunnels })
  }

  /**
   * Close every tunnel to one host. Replaces `DELETE /tunnel`.
   * @param request - host identity.
   * @param signal - carrier cancellation.
   */
  @Remote
  closeTunnel(request: RemoteCloseTunnelRequest, signal: AbortSignal): Promise<RemoteTunnelClosedValue> {
    signal.throwIfAborted()
    const closed = this.tunnels.closeByHostId(request.hostId)
    if (!closed) {
      throw new RemoteError(
        'remote-dev/tunnel-not-found',
        `没有到 ${request.hostId} 的活动隧道`,
        { hostId: request.hostId },
      )
    }
    return Promise.resolve({ hostId: request.hostId, closed })
  }

  /**
   * Read the review status of one target. Replaces `GET /review/status`.
   * @param request - review identity bundle.
   * @param signal - carrier cancellation.
   */
  @Remote
  async reviewStatus(request: RemoteReviewStatusRequest, signal: AbortSignal): Promise<RemoteReviewStatus> {
    signal.throwIfAborted()
    const resolved = await this.requireReviewTarget(request.target, false)
    const status = await this.reviewStatusOf(resolved, signal)
    return {
      target: this.signedReviewTarget(resolved.target),
      ...status.base === '' ? {} : { base: status.base },
      ...status.head === '' ? {} : { head: status.head },
      dirty: status.dirty,
      missing: status.missing,
    }
  }

  /**
   * Read one review batch. Replaces `GET /review/batch`.
   * @param request - review identity bundle plus an optional explicit base.
   * @param signal - carrier cancellation.
   */
  @Remote
  async reviewBatch(request: RemoteReviewBatchRequest, signal: AbortSignal): Promise<RemoteReviewBatch> {
    signal.throwIfAborted()
    const resolved = await this.requireReviewTarget(request.target, false)
    const base = await this.resolveBase(resolved, request.base, signal)
    const enginePath = this.requireEngine()
    const run = await this.runEngineOrThrow(enginePath, 'batch', ['batch', resolved.target.mDir, base], resolved.host, 90000)
    const batch = parseBatch(run.stdout)
    return {
      target: this.signedReviewTarget(resolved.target),
      engine: 'rd-core',
      base,
      head: batch.head,
      files: batch.files,
      diff: batch.diff,
      empty: batch.empty,
    }
  }

  /**
   * Approve the selected files: apply, verify, push the baseline, resync M.
   * Replaces `POST /review/apply`. Step failures are values (`ok: false`), not
   * thrown errors — the caller needs the step trail either way.
   * @param request - review bundle, selected files, base, verification switch.
   * @param signal - carrier cancellation.
   */
  @Remote
  async reviewApply(request: RemoteReviewApplyRequest, signal: AbortSignal): Promise<RemoteReviewApplyResult> {
    signal.throwIfAborted()
    const resolved = await this.requireReviewTarget(request.target, true)
    const files = request.files.map((f) => String(f).trim()).filter((f) => f !== '')
    if (files.length === 0) {
      throw new RemoteError('remote-dev/files-empty', '未选择任何文件', {})
    }
    const base = await this.resolveBase(resolved, request.base, signal)
    const enginePath = this.requireEngine()
    const run = await this.runEngineOrThrow(enginePath, 'batch', ['batch', resolved.target.mDir, base], resolved.host, 90000)
    const batch: EngineBatch = parseBatch(run.stdout)
    const { patch, kept } = filterDiffByFiles(batch.diff, files)
    if (kept.length === 0) {
      throw new RemoteError('remote-dev/files-unchanged', '所选文件在当前批次里没有改动', { files })
    }
    if (patch.trim() === '') {
      throw new RemoteError('remote-dev/patch-empty', '裁剪后补丁为空', {})
    }

    const patchPath = join(tmpdir(), `rws-review-${Date.now()}.patch`)
    await writeFile(patchPath, patch, 'utf8')
    const steps: RemoteReviewStep[] = []
    const projectPath = resolved.target.projectPath

    const applied = await this.step(enginePath, 'apply', ['apply', projectPath, patchPath], resolved.host, 60000, steps)
    if (applied.code !== 0) {
      return {
        ok: false,
        failedAt: 'apply',
        steps,
        base,
        head: batch.head,
        files: kept,
        verified: false,
        note: 'apply 被拒（W 漂移或冲突）——W 未被改动，基线未推进',
      }
    }

    const verifyCmd = resolved.target.verifyCmd.trim()
    if (verifyCmd !== '' && request.verify) {
      const verified = await this.step(enginePath, 'verify', ['verify', projectPath, 'bash', '-lc', verifyCmd], resolved.host, 300000, steps)
      if (verified.code !== 0) {
        await this.recordDecision({
          kind: 'apply-verify-failed',
          host: resolved.host,
          base,
          files: kept,
          comment: '',
        })
        return {
          ok: false,
          failedAt: 'verify',
          steps,
          base,
          head: batch.head,
          files: kept,
          verified: true,
          note: '已应用到 W 但本地验证未通过：按闸门语义未回灌 M，可用回滚回到基线',
        }
      }
    }

    const pushed = await this.step(enginePath, 'push-base', ['push-base', projectPath], resolved.host, 60000, steps)
    if (pushed.code !== 0) {
      return {
        ok: false,
        failedAt: 'push-base',
        steps,
        base,
        head: batch.head,
        files: kept,
        verified: verifyCmd !== '' && request.verify,
        note: 'W 已更新但基线推送失败',
      }
    }

    const synced = await this.step(enginePath, 'm-sync', ['m-sync', resolved.target.mDir, resolved.target.hub], resolved.host, 180000, steps)
    await this.recordDecision({
      kind: 'approve',
      host: resolved.host,
      base,
      files: kept,
      comment: synced.code === 0 ? '' : 'm-sync 未完成',
    })
    return {
      ok: synced.code === 0,
      ...synced.code === 0 ? {} : { failedAt: 'm-sync' },
      steps,
      base,
      head: batch.head,
      files: kept,
      verified: verifyCmd !== '' && request.verify,
      note: synced.code === 0 ? '已并入 W 并回灌 M' : '已并入 W 并推进基线，但 M 回灌未完成',
    }
  }

  /**
   * Record a rejection (append-only ledger). Replaces `POST /review/reject`.
   * @param request - review bundle, files, base, and the mandatory reason.
   * @param signal - carrier cancellation.
   */
  @Remote
  async reviewReject(request: RemoteReviewRejectRequest, signal: AbortSignal): Promise<RemoteDecisionRecord> {
    signal.throwIfAborted()
    const resolved = await this.requireReviewTarget(request.target, true)
    const comment = request.comment.trim()
    if (comment === '') {
      throw new RemoteError('remote-dev/comment-empty', '拒因不能为空', {})
    }
    const files = request.files.map((f) => String(f).trim()).filter((f) => f !== '')
    return this.recordDecision({
      kind: 'reject',
      host: resolved.host,
      base: request.base,
      files,
      comment,
    })
  }

  /**
   * Roll the project tree back to a baseline ref. Replaces `POST /review/rollback`.
   * @param request - review bundle plus the baseline ref.
   * @param signal - carrier cancellation.
   */
  @Remote
  async reviewRollback(request: RemoteReviewRollbackRequest, signal: AbortSignal): Promise<RemoteReviewRollbackResult> {
    signal.throwIfAborted()
    const resolved = await this.requireReviewTarget(request.target, true)
    const ref = request.ref.trim()
    if (ref === '') {
      throw new RemoteError('remote-dev/ref-missing', '缺少 ref', {})
    }
    const enginePath = this.requireEngine()
    const run = await this.runEngineOrThrow(enginePath, 'rollback', ['rollback', resolved.target.projectPath, ref], resolved.host, 90000)
    await this.recordDecision({ kind: 'rollback', host: resolved.host, base: ref, files: [], comment: '' })
    return {
      ok: run.code === 0,
      code: run.code,
      ref,
      output: brief(run.stdout + run.stderr),
      note: run.code === 0 ? '已回滚' : '回滚失败（多为 W 脏或 ref 无效）',
    }
  }

  /**
   * Runtime self-attestation: which endpoints this live instance carries, and a
   * content hash of the loaded artifacts. The former deployment drifted
   * (source deleted from disk, routes still served from memory) with no way to
   * tell; this is the observable that makes that drift detectable.
   * @param request - whether to include the endpoint list.
   * @param signal - carrier cancellation.
   */
  @Remote
  async describe(request: RemoteDescribeRequest, signal: AbortSignal): Promise<RemoteServiceDescription> {
    signal.throwIfAborted()
    const endpoints = request.includeEndpoints
      ? remoteMethods(this).map((m) => `${NAMESPACE}/${m.exportName ?? m.method}`)
      : []
    return {
      package: 'perse-remote-dev',
      face: 'host',
      serviceKey: SERVICE_KEY,
      namespace: NAMESPACE,
      endpoints,
      revision: await this.revisionOf(),
      protocolModule: moduleUrl('@deepseek-ai/dsh-typert-protocol'),
      cordisModule: moduleUrl('@deepseek-ai/cordis'),
      node: process.version,
    }
  }

  // ── settings / target chain ─────────────────────────────────────────────

  private requireScope(): SettingsScope {
    if (this.scope === undefined) {
      throw new RemoteError(
        'remote-dev/settings-unavailable',
        'settings 服务尚未就绪（本 profile 未挂载 dsh-settings-file，或注册失败）',
        {},
      )
    }
    return this.scope
  }

  private readDocument(): RemoteWorkspaceSettingsDocument {
    const scope = this.scope
    if (scope === undefined) return {}
    const raw = scope.get() as RemoteWorkspaceSettingsDocument | undefined
    return raw ?? {}
  }

  /** Configured host records, with the legacy `targets[]` shape folded in on read. */
  private configuredHosts(): { hosts: readonly RemoteWorkspaceHostSetting[]; migrated: boolean } {
    const document = this.readDocument()
    const configured = Array.isArray(document.hosts) ? document.hosts : []
    if (configured.length === 0 && Array.isArray(document.targets) && document.targets.length > 0) {
      return { hosts: migrateTargetsToHosts(document.targets), migrated: true }
    }
    return { hosts: configured, migrated: false }
  }

  /** The effective target chain, exactly the former `resolveTargets()` semantics. */
  private resolveChain(): TargetChain {
    const document = this.readDocument()
    const { hosts } = this.configuredHosts()
    const first = hosts[0]
    const legacy = Array.isArray(document.targets) && document.targets.length > 0 ? document.targets[0] : undefined
    const host = first === undefined ? '' : sshTargetOf(first)
    const hostId = first === undefined ? '' : stableIdOf(first)
    const projectPath = (first !== undefined && first.projectPath !== '' ? first.projectPath : '')
      || document.workspace
      || (legacy !== undefined ? legacy.workspace : '')
      || ''
    const mDir = document.mDir ?? ''
    const hub = document.hub ?? (legacy !== undefined ? legacy.hub : '') ?? ''
    const verifyCmd = legacy !== undefined ? legacy.verifyCmd : ''
    const missing: string[] = []
    if (host === '') missing.push('主机（请到设置 › 远程开发添加）')
    if (projectPath === '') missing.push('项目路径')
    return { host, hostId, projectPath, mDir, hub, verifyCmd, missing }
  }

  /** Persist the project path (and remember it on the host record). */
  private async rememberProject(resolved: SshResolution, path: string): Promise<boolean> {
    // D-HOST-2: a `remember:true` request must never report `saved:true` without an actual write.
    // A target that is not part of the configured host records (the `~/.ssh/config` alias case the
    // directory flow offers) has no record to update, so report `false` instead of the former silent
    // no-op. Auto-registering it into `document.hosts` would erase the configured-vs-alias boundary
    // that `configuredOnly` relies on, so that is deliberately not done.
    // D-HOST-1: `record.projectPath` is the *local* W (the settings form stores the user's working
    // copy there, and `resolveChain` reads it as `RemoteReviewTarget.projectPath`), while
    // `openProject` receives a *remote* path from the host-issued location. Writing that remote path
    // into `projectPath` handed it to the local-W consumers. The remembered remote project is
    // therefore persisted on the host record's `projects[]` only; `projectPath` keeps its single
    // local-W meaning, so a remote path can never leak into the local-W chain.
    const scope = this.requireScope()
    const { hosts } = this.configuredHosts()
    const target = resolved.settings !== undefined ? stableIdOf(resolved.settings) : resolved.host
    let changed = false
    const updated = hosts.map((record) => {
      if (stableIdOf(record) !== target && record.id !== target) return record
      if (record.projects.includes(path)) return record
      changed = true
      return { ...record, projects: [...record.projects, path] }
    })
    if (!changed) return false
    await scope.update({ hosts: updated })
    return true
  }

  // ── host inventory ──────────────────────────────────────────────────────

  private localView(): RemoteHostView {
    return {
      id: 'local',
      name: '本机',
      kind: 'local',
      state: 'connected',
      detail: homedir(),
      hostName: '',
      user: '',
      port: '',
      proxyJump: '',
      aliases: [],
      jump: false,
      configured: true,
    }
  }

  private foldedView(h: FoldedSshHost): RemoteHostView {
    const detail = [
      h.user !== '' ? `${h.user}@` : '',
      h.hostName,
      h.port !== '' ? `:${h.port}` : '',
      h.proxyJump !== '' ? `（经 ${h.proxyJump}）` : '',
    ].join('')
    return {
      id: h.id,
      name: h.name,
      kind: 'ssh',
      state: 'unknown' as RemoteLinkState,
      detail,
      hostName: h.hostName,
      user: h.user,
      port: h.port,
      proxyJump: h.proxyJump,
      aliases: h.aliases,
      jump: h.jump,
      configured: false,
    }
  }

  private async sshHosts(fresh: boolean): Promise<readonly FoldedSshHost[]> {
    const now = Date.now()
    if (!fresh && this.hostCache !== undefined && now - this.hostCache.at <= HOSTS_CACHE_MS) {
      return this.hostCache.hosts
    }
    let hosts: FoldedSshHost[] = []
    try {
      const text = await readFile(join(homedir(), '.ssh', 'config'), 'utf8')
      hosts = foldHosts(parseSshHosts(text))
    } catch {
      /* no ~/.ssh/config is normal: only the local machine is offered */
    }
    this.hostCache = { at: now, hosts }
    return hosts
  }

  /** Probe every ssh view (state mutated on the view objects, cached). */
  private async applyProbe(
    views: RemoteHostView[],
    probe: boolean,
    fresh: boolean,
    signal: AbortSignal,
  ): Promise<void> {
    if (!probe) return
    const sshViews = views.filter((v) => v.kind === 'ssh')
    const now = Date.now()
    let cache = this.probeCache
    if (fresh || cache === undefined || now - cache.at > PROBE_CACHE_MS) {
      const states = new Map<string, RemoteLinkState>()
      for (const view of sshViews) {
        signal.throwIfAborted()
        states.set(view.id, await this.probeHost(view.id))
      }
      cache = { at: now, states }
      this.probeCache = cache
    }
    for (let i = 0; i < views.length; i++) {
      const view = views[i]
      if (view === undefined || view.kind !== 'ssh') continue
      const state = cache.states.get(view.id)
      if (state !== undefined) views[i] = { ...view, state }
    }
  }

  /** Short, BatchMode-only reachability probe. */
  private probeHost(alias: string): Promise<RemoteLinkState> {
    return new Promise((resolve) => {
      execFile('ssh', [...SSH_PROBE_FLAGS, alias, '--', 'true'], { timeout: 6000 }, (err) => {
        resolve(err ? 'disconnected' : 'connected')
      })
    })
  }

  // ── target resolution (defect fix: direct-address hosts use the real ssh target) ──

  /**
   * Resolve one wire identity to a concrete target.
   *
   * `hostId` is matched against a configured record's id *and* its `fromAlias`,
   * then against `~/.ssh/config` aliases. The ssh command line always uses
   * {@link sshTargetOf}: `fromAlias` when imported, otherwise `user@address`.
   * The former half passed the configured **id** to ssh for direct-address
   * hosts, so exactly the hosts that were configured by address could never be
   * probed or browsed.
   */
  private async endpointFor(hostId: string): Promise<TargetResolution> {
    const id = String(hostId || '')
    if (id === '' || id === 'local') {
      return { kind: 'local', target: { hostId: 'local' }, host: 'local' }
    }
    const { hosts } = this.configuredHosts()
    const record = hosts.find((x) => x.id === id || stableIdOf(x) === id)
    if (record !== undefined) {
      const alias = record.fromAlias !== '' ? record.fromAlias : ''
      const endpoint: SshEndpoint = {
        hostId: stableIdOf(record),
        sshTarget: sshTargetOf(record),
        port: alias === '' ? record.port : '',
        keyPath: alias === '' ? record.keyPath : '',
      }
      return { kind: 'ssh', target: { hostId: endpoint.hostId }, host: endpoint.hostId, endpoint, settings: record }
    }
    const folded = await this.sshHosts(false)
    const known = folded.find((h) => h.id === id)
    if (known !== undefined) {
      const endpoint: SshEndpoint = {
        hostId: known.id,
        sshTarget: known.id,
        port: '',
        keyPath: '',
      }
      return { kind: 'ssh', target: { hostId: known.id }, host: known.id, endpoint }
    }
    throw new RemoteError(
      'remote-dev/target-unknown',
      `未知主机：${id}（请先在设置 › 远程开发 添加，或检查 ssh 别名）`,
      { hostId: id },
    )
  }

  // ── listings ────────────────────────────────────────────────────────────

  /** Local directory listing (directories and symlinks only, as the UI expects). */
  private async listLocal(path: string): Promise<RawListing> {
    const directory = path === '' ? homedir() : this.assertPath(path)
    let dirents
    try {
      dirents = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      throw new RemoteError(
        'remote-dev/directory-unreadable',
        `本机目录不可访问：${directory}`,
        { hostId: 'local', path: directory, reason: errorMessage(error) },
      )
    }
    const entries: { name: string; path: string; hidden: boolean }[] = []
    for (const d of dirents) {
      if (!d.isDirectory() && !d.isSymbolicLink()) continue
      entries.push({ name: d.name, path: join(directory, d.name), hidden: d.name.startsWith('.') })
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    return { path: directory, home: homedir(), entries }
  }

  /** Remote directory listing over the base64-argv ssh script. */
  private async listRemote(resolved: SshResolution, path: string): Promise<RawListing> {
    if (path !== '') this.assertPath(path)
    const script = DECODE_PATH + [
      'if [ -n "$RWS_PATH" ]; then cd "$RWS_PATH" 2>/dev/null || { printf "ERR_NO_DIR\\n"; exit 3; }; fi',
      'printf "HOME:%s\\n" "$HOME"',
      'printf "PWD:%s\\n" "$(pwd)"',
      'printf "ENTRIES:\\n"',
      'ls -1Ap 2>/dev/null | while IFS= read -r n; do case "$n" in */) printf "%s\\n" "${n%/}";; esac; done',
    ].join('\n') + '\n'
    let result
    try {
      result = await sshScript(resolved.endpoint, script, [path])
    } catch (error) {
      throw this.sshFailure(error, resolved.endpoint, `列举远端目录失败：${path === '' ? '(家目录)' : path}`)
    }
    const lines = result.stdout.split(/\r?\n/)
    if (lines.some((l) => l === 'ERR_NO_DIR')) {
      throw new RemoteError(
        'remote-dev/directory-unreadable',
        `远端目录不可访问：${path === '' ? '(家目录)' : path}`,
        { hostId: resolved.host, path: path === '' ? '' : path, reason: 'ERR_NO_DIR' },
      )
    }
    if (result.code !== 0 && lines.indexOf('ENTRIES:') < 0) {
      throw new RemoteError(
        'remote-dev/list-failed',
        `远端列举失败（exit ${result.code}）：${result.stderr.trim().slice(0, 200)}`,
        { hostId: resolved.host, code: result.code, stderr: result.stderr.trim().slice(0, 200) },
      )
    }
    const home = (lines.find((l) => l.startsWith('HOME:')) || 'HOME:').slice(5)
    const directory = (lines.find((l) => l.startsWith('PWD:')) || 'PWD:').slice(4)
    const i = lines.indexOf('ENTRIES:')
    const names = i >= 0 ? lines.slice(i + 1).filter((n) => n !== '') : []
    return {
      path: directory,
      home,
      entries: names.map((n) => ({ name: n, path: joinPosix(directory, n), hidden: n.startsWith('.') })),
    }
  }

  private async mkdirLocal(created: string): Promise<void> {
    try {
      await mkdir(created, { recursive: false })
    } catch (error) {
      if ((error as { code?: unknown }).code === 'EEXIST') {
        throw new RemoteError('remote-dev/directory-exists', `目录已存在：${created}`, { path: created })
      }
      throw new RemoteError(
        'remote-dev/mkdir-failed',
        `本机创建目录失败：${created}（${errorMessage(error)}）`,
        { hostId: 'local', path: created, code: 0, reason: errorMessage(error) },
      )
    }
  }

  private async mkdirRemote(resolved: SshResolution, created: string): Promise<void> {
    const script = 'RWS_TARGET=$(printf %s "$1" | base64 -d) || exit 9\n'
      + 'mkdir "$RWS_TARGET" 2>/dev/null || { printf "ERR_MKDIR\\n"; exit 4; }\n'
      + 'printf "OK:%s\\n" "$RWS_TARGET"\n'
    let result
    try {
      result = await sshScript(resolved.endpoint, script, [created])
    } catch (error) {
      throw this.sshFailure(error, resolved.endpoint, `远端创建目录失败：${created}`)
    }
    if (result.stdout.includes('ERR_MKDIR') || result.code !== 0) {
      throw new RemoteError(
        'remote-dev/mkdir-failed',
        `远端创建目录失败：${created}`,
        { hostId: resolved.host, path: created, code: result.code, reason: result.stdout.includes('ERR_MKDIR') ? 'ERR_MKDIR' : 'exit' },
      )
    }
  }

  // ── review ──────────────────────────────────────────────────────────────

  private async requireReviewTarget(request: RemoteReviewTarget, requireToken: boolean): Promise<ReviewResolution> {
    const chain = this.resolveChain()
    const hostId = request.hostId !== '' ? request.hostId : chain.hostId
    const resolved = await this.endpointFor(hostId)
    if (resolved.kind !== 'ssh') {
      throw new RemoteError(
        'remote-dev/target-not-remote',
        `审查回路只能作用于 ssh 主机，收到的是 ${resolved.host}`,
        { hostId: resolved.host },
      )
    }
    const merged: RemoteReviewTarget = {
      hostId: resolved.host,
      projectPath: request.projectPath !== '' ? request.projectPath : chain.projectPath,
      mDir: request.mDir !== '' ? request.mDir : chain.mDir,
      hub: request.hub !== '' ? request.hub : chain.hub,
      verifyCmd: request.verifyCmd !== '' ? request.verifyCmd : chain.verifyCmd,
    }
    const missing: string[] = []
    if (merged.projectPath === '') missing.push('项目路径')
    if (merged.mDir === '') missing.push('批次目录（M）')
    if (merged.hub === '') missing.push('汇总仓库')
    if (missing.length > 0) {
      const parts: string[] = []
      const notReady = missing.filter((x) => x !== '汇总仓库')
      if (notReady.length > 0) parts.push(`远端项目未就绪：${notReady.join('、')}`)
      if (missing.includes('汇总仓库')) parts.push(REVIEW_HUB_HINT)
      throw new RemoteError('remote-dev/review-target-missing', parts.join('；'), { missing, hint: MISSING_HINT })
    }
    if (requireToken) {
      const token = request.token
      if (token === undefined || !this.signer.verify(token, 'review-target', reviewFields(merged))) {
        throw new RemoteError(
          'remote-dev/location-mismatch',
          `审查目标的身份凭证与该主机不匹配（host=${resolved.host}）`,
          { hostId: resolved.host, path: merged.projectPath },
        )
      }
    }
    return { target: merged, host: resolved.host, endpoint: resolved.endpoint }
  }

  private async reviewStatusOf(
    resolved: ReviewResolution,
    signal: AbortSignal,
  ): Promise<{ base: string; head: string; dirty: number; missing: boolean }> {
    signal.throwIfAborted()
    const hub = resolved.target.hub
    // D-POST-1: this script runs on the *remote* host, so `$RWS_PATH` must be the
    // remote mirror M (`mDir`). `projectPath` is the contract's *local* W (the tree
    // the engine applies to), which never exists on the remote and would make
    // `missing=true`/`head` empty on every valid target.
    const mDir = resolved.target.mDir
    const script = DECODE_PATH + 'RWS_HUB=$(printf %s "$2" | base64 -d) || exit 9\n' + [
      // D-POST-2: `git rev-parse <ref>` *echoes the literal ref* when it does not
      // exist (exit 128, stderr swallowed), so the old guard could not see a hub
      // that is a valid bare repo but has no `rd-base`. `--verify --quiet` resolves
      // only a real ref and prints nothing otherwise, which is what the guard reads.
      'printf "BASE:%s\\n" "$(git --git-dir="$RWS_HUB" rev-parse --verify --quiet refs/heads/rd-base 2>/dev/null)"',
      'printf "HEAD:%s\\n" "$(git -C "$RWS_PATH" rev-parse HEAD 2>/dev/null)"',
      'printf "DIRTY:%s\\n" "$(git -C "$RWS_PATH" status --porcelain 2>/dev/null | wc -l | tr -d " ")"',
      'printf "MISSING:%s\\n" "$([ -d "$RWS_PATH/.git" ] && echo 0 || echo 1)"',
    ].join('\n') + '\n'
    let result
    try {
      result = await sshScript(resolved.endpoint, script, [mDir, hub], 25000)
    } catch (error) {
      throw this.sshFailure(error, resolved.endpoint, `读取审查状态失败：${mDir}`)
    }
    const get = (tag: string): string => {
      const l = result.stdout.split(/\r?\n/).find((x) => x.startsWith(`${tag}:`))
      return l !== undefined ? l.slice(tag.length + 1) : ''
    }
    return {
      base: get('BASE'),
      head: get('HEAD'),
      dirty: Number(get('DIRTY') || 0),
      missing: get('MISSING') === '1',
    }
  }

  private async resolveBase(resolved: ReviewResolution, explicit: string, signal: AbortSignal): Promise<string> {
    const given = explicit.trim()
    if (given !== '') return given
    const status = await this.reviewStatusOf(resolved, signal)
    if (status.base === '') {
      throw new RemoteError(
        'remote-dev/base-missing',
        'hub 上没有 rd-base 基线',
        { hub: resolved.target.hub },
      )
    }
    return status.base
  }

  /**
   * The engine path: an explicit `remote-dev.enginePath` wins, an empty setting
   * falls back to the engine shipped inside this package
   * (`<pkg>/engine/rd-sync.sh`), and when that file is missing the original
   * typed refusal is raised. Never `undefined`.
   */
  private requireEngine(): string {
    const enginePath = this.readDocument().enginePath
    if (enginePath !== undefined && enginePath.trim() !== '') return enginePath
    const bundled = bundledEnginePath()
    if (existsSync(bundled)) return bundled
    throw new RemoteError(
      'remote-dev/engine-unconfigured',
      '未配置 rd-core 引擎路径（remote-dev.enginePath），且包内 engine/rd-sync.sh 缺失；请在设置 › 远程开发 里填写 rd-sync.sh 的绝对路径',
      {},
    )
  }

  private async runEngineOrThrow(
    enginePath: string,
    step: string,
    args: readonly string[],
    sshHost: string,
    timeoutMs: number,
  ): Promise<EngineRun> {
    let run: EngineRun
    try {
      run = await runEngine(enginePath, args, sshHost, timeoutMs)
    } catch (error) {
      if (error instanceof EngineExecutionError) {
        throw new RemoteError(
          'remote-dev/engine-failed',
          error.message,
          { step, code: -1, output: error.message },
          { cause: error },
        )
      }
      throw error
    }
    if (run.code !== 0) {
      throw new RemoteError(
        'remote-dev/engine-failed',
        `引擎步骤 ${step} 失败（exit ${run.code}）：${(run.stderr || run.stdout).slice(0, 300)}`,
        { step, code: run.code, output: (run.stderr || run.stdout).slice(0, 300) },
      )
    }
    return run
  }

  /** One engine step whose failure is a value (apply/verify/push-base/m-sync). */
  private async step(
    enginePath: string,
    step: string,
    args: readonly string[],
    sshHost: string,
    timeoutMs: number,
    steps: RemoteReviewStep[],
  ): Promise<EngineRun> {
    let run: EngineRun
    try {
      run = await runEngine(enginePath, args, sshHost, timeoutMs)
    } catch (error) {
      if (error instanceof EngineExecutionError) {
        run = { stdout: '', stderr: error.message, code: -1 }
      } else {
        throw error
      }
    }
    steps.push({ step, code: run.code, output: brief(run.stdout + run.stderr) })
    return run
  }

  /** Append one decision record; a ledger write failure is logged, never fatal. */
  private async recordDecision(input: {
    readonly kind: string
    readonly host: string
    readonly base: string
    readonly files: readonly string[]
    readonly comment: string
  }): Promise<RemoteDecisionRecord> {
    const record: RemoteDecisionRecord = {
      ts: new Date().toISOString(),
      kind: input.kind,
      host: input.host,
      base: input.base,
      files: input.files,
      comment: input.comment,
    }
    const path = decisionsPath()
    try {
      await mkdir(dirname(path), { recursive: true })
      await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8')
    } catch (error) {
      console.error('[perse-remote-dev] 决定留痕写入失败：', error)
    }
    return record
  }

  // ── identity proofs ─────────────────────────────────────────────────────

  private locationOf(hostId: string, path: string): RemoteWorkspaceLocation {
    return {
      target: { hostId },
      path,
      token: this.signer.sign('location', locationFields(hostId, path)),
    }
  }

  private assertLocation(location: RemoteWorkspaceLocation): RemoteWorkspaceLocation {
    const hostId = location.target.hostId
    const path = location.path
    if (!this.signer.verify(location.token, 'location', locationFields(hostId, path))) {
      throw new RemoteError(
        'remote-dev/location-mismatch',
        `目录身份凭证与 (host=${hostId}, path=${path}) 不匹配：该路径不是本实例为这台主机列出的`,
        { hostId, path },
      )
    }
    return location
  }

  private signedReviewTarget(target: RemoteReviewTarget): RemoteReviewTarget {
    return { ...target, token: this.signer.sign('review-target', reviewFields(target)) }
  }

  // ── ssh odds and ends ───────────────────────────────────────────────────

  /** Read the remote DSH's current token from its own log (never cached). */
  private async readRemoteToken(endpoint: SshEndpoint, remotePort: string): Promise<{ token?: string; error?: string }> {
    const port = /^[0-9]+$/.test(String(remotePort || '')) ? String(remotePort) : '3080'
    const script = [
      'RWS_LOG="${DSH_HOME:-$HOME/.dsh}/web.log"',
      '[ -f "$RWS_LOG" ] || { printf "ERR_NOLOG\\n"; exit 0; }',
      `RWS_TOK=$(grep -E "127\\.0\\.0\\.1:${port}/" "$RWS_LOG" 2>/dev/null | tail -1 | grep -oE "token=[A-Za-z0-9_-]+" | tail -1 | cut -d= -f2-)`,
      '[ -n "$RWS_TOK" ] || RWS_TOK=$(grep -oE "token=[A-Za-z0-9_-]+" "$RWS_LOG" 2>/dev/null | tail -1 | cut -d= -f2-)',
      '[ -n "$RWS_TOK" ] || { printf "ERR_NOTOKEN\\n"; exit 0; }',
      'printf "TOKEN:%s\\n" "$RWS_TOK"',
    ].join('\n') + '\n'
    let result
    try {
      result = await sshScript(endpoint, script, [], 12000)
    } catch (error) {
      return { error: `ssh ${endpoint.hostId} 取 token 失败：${errorMessage(error)}` }
    }
    const out = result.stdout
    const line = out.split(/\r?\n/).find((l) => l.startsWith('TOKEN:'))
    const token = line !== undefined ? line.slice('TOKEN:'.length).trim() : ''
    if (token !== '') return { token }
    if (out.includes('ERR_NOLOG')) return { error: `远端 ${endpoint.hostId} 上 $DSH_HOME/web.log 不存在（远端 dsh web 未启动过？）` }
    if (out.includes('ERR_NOTOKEN')) return { error: `远端 ${endpoint.hostId} 的 web.log 里没有 token= 行（远端 dsh web 未打印启动地址？）` }
    return {
      error: `远端 ${endpoint.hostId} 的 web.log 解析不到 token（exit ${result.code}）`
        + (result.stderr.trim() !== '' ? `：${result.stderr.trim().slice(0, 160)}` : ''),
    }
  }

  /** Map one typed transport failure onto its domain code. */
  private sshFailure(error: unknown, endpoint: SshEndpoint, context: string): RemoteError {
    if (error instanceof SshExecutionError) {
      const stderr = error.stderr.trim().slice(0, 300)
      if (error.kind === 'unreachable' || error.kind === 'timeout' || error.kind === 'spawn-missing') {
        return new RemoteError(
          'remote-dev/ssh-unreachable',
          `${context}：${error.message}`,
          { hostId: endpoint.hostId, stderr },
          { cause: error },
        )
      }
      return new RemoteError(
        'remote-dev/list-failed',
        `${context}：${error.message}`,
        { hostId: endpoint.hostId, code: error.code, stderr },
        { cause: error },
      )
    }
    return new RemoteError(
      'remote-dev/list-failed',
      `${context}：${errorMessage(error)}`,
      { hostId: endpoint.hostId, code: 0, stderr: errorMessage(error) },
      { cause: error },
    )
  }

  private assertPath(path: string): string {
    try {
      return assertSafePath(path)
    } catch (error) {
      if (error instanceof InvalidPathError) {
        throw new RemoteError('remote-dev/location-invalid', error.message, { path })
      }
      throw error
    }
  }

  /** Content hash of the loaded host artifacts (runtime-vs-disk identity). */
  private async revisionOf(): Promise<string> {
    if (this.revision !== undefined) return this.revision
    try {
      const base = new URL('./', import.meta.url)
      const parts: string[] = []
      for (const file of ['index.js', 'typert.host.js']) {
        parts.push(await readFile(new URL(file, base), 'utf8'))
      }
      this.revision = createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 16)
    } catch {
      this.revision = 'unavailable'
    }
    return this.revision
  }
}

/** Identity that never changes when the user renames a host: alias first, else id. */
function stableIdOf(record: RemoteWorkspaceHostSetting): string {
  return record.fromAlias !== '' ? record.fromAlias : record.id
}

/**
 * The ssh command-line target for one configured record.
 *
 * An imported record uses its alias (which carries the user's own port,
 * identity, and ProxyJump settings). A direct record uses `user@address`, and
 * only then do the explicit `-p`/`-i` flags apply.
 */
function sshTargetOf(record: RemoteWorkspaceHostSetting): string {
  if (record.fromAlias !== '') return record.fromAlias
  const address = record.address !== '' ? record.address : record.id
  return record.username !== '' ? `${record.username}@${address}` : address
}

/**
 * Absolute path of the rd-core engine shipped with this package.
 *
 * The built entry is `<pkg>/lib/index.js`, so `../engine/rd-sync.sh` resolves to
 * `<pkg>/engine/rd-sync.sh` — the same file `files[]` publishes.
 */
function bundledEnginePath(): string {
  return fileURLToPath(new URL('../engine/rd-sync.sh', import.meta.url))
}

/**
 * Resolve one module specifier against *this* module's URL, in-process.
 * @param specifier - bare specifier to resolve.
 * @returns the resolved URL, or `unavailable` when the runtime cannot answer.
 */
function moduleUrl(specifier: string): string {
  const resolve = (import.meta as { resolve?: (s: string) => string }).resolve
  if (typeof resolve !== 'function') return 'unavailable'
  try {
    return resolve.call(import.meta, specifier)
  } catch {
    return 'unavailable'
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default RemoteWorkspaceService
