/**
 * Client model for the remote-dev UI.
 *
 * This is the **object layer**: it owns business state (host inventory,
 * effective configuration, tunnels, review batch) and performs every typed
 * Remote call. It is created once per `apply` by the consumer plugin that holds
 * `inject = ['slots', 'remote', 'remote.remoteDev']`, so the call sites
 * below read `ctx.remote.remoteDev.<method>(request)` verbatim with the
 * generated signatures — no `Pick`, no manually written signature, no wire
 * intermediary.
 *
 * Failure discipline:
 *   * results are `RemoteResult<T>`; every branch discriminates on `error.code`;
 *   * no `instanceof`, no `catch` around a Remote call — assembly faults are
 *     supposed to be loud.
 *
 * Components never touch this object's `ctx`; they receive read hooks and
 * actions through the slot registration's `inject` face.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteFailure } from '@deepseek-ai/dsh-typert-protocol'
import type {
  RemoteConfigurationValue,
  RemoteDirectoryListing,
  RemoteHostView,
  RemoteLinkState,
  RemoteOpenedProject,
  RemoteReviewApplyResult,
  RemoteReviewBatch,
  RemoteReviewTarget,
  RemoteServiceDescription,
  RemoteTunnelClosedValue,
  RemoteTunnelView,
  RemoteWorkspaceHostSetting,
  RemoteWorkspaceLocation,
} from 'perse-remote-dev/types'

/** One Remote failure, flattened for UI use. */
export interface Failure {
  readonly code: string
  readonly message: string
  readonly details: unknown
}

/** The five link-state words the host vocabulary defines. */
export const STATE_LABEL: Record<RemoteLinkState, string> = {
  connected: '已连接',
  connecting: '连接中',
  reconnecting: '重连中',
  disconnected: '已断开',
  unknown: '未探测',
}

/**
 * Flatten one `RemoteFailure` for the UI.
 *
 * Callers discriminate with the canonical `if (!result.ok)` branch —
 * `instanceof` is never used, and the branch narrows `error.details` for free.
 * @param error - the failure half of a `RemoteResult`.
 * @returns the UI-shaped failure.
 */
function toFailure(error: RemoteFailure): Failure {
  return { code: error.code, message: error.message, details: error.details }
}

/** Discriminated outcome for read verbs. */
export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: Failure }

function okOutcome<T>(value: T): Outcome<T> {
  return { ok: true, value }
}

function failedOutcome<T>(failure: Failure): Outcome<T> {
  return { ok: false, failure }
}

/**
 * Minimal observable cell: the framework's slot-store contract is not reachable
 * from this workspace, so the model exposes a `getSnapshot`/`subscribe` pair and
 * the components bind it through the inject face's hooks. The instance lives on
 * this per-apply model (object layer), never at module scope.
 */
export class Cell<T> {
  private value: T

  private readonly listeners = new Set<() => void>()

  /** @param initial - first snapshot value. */
  constructor(initial: T) {
    this.value = initial
  }

  /** @returns the current snapshot. */
  readonly get = (): T => this.value

  /**
   * @param listener - change callback.
   * @returns unsubscribe function.
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** @param next - replacement snapshot. */
  set(next: T): void {
    this.value = next
    for (const listener of [...this.listeners]) listener()
  }

  /** @param patch - partial snapshot merged over the current one. */
  patch(patch: Partial<T>): void {
    this.set({ ...this.value, ...patch })
  }
}

/** Host inventory snapshot. */
export interface HostsSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly targets: readonly RemoteHostView[]
  readonly configuredOnly: boolean
  readonly probed: boolean
  readonly failure: Failure | null
}

/** Effective configuration snapshot. */
export interface ConfigSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly value: RemoteConfigurationValue | null
  readonly failure: Failure | null
}

/** Host-face self-description snapshot (`describe`). */
export interface HostFaceSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly value: RemoteServiceDescription | null
  readonly failure: Failure | null
}

/** Tunnel registry snapshot (`listTunnels`). */
export interface TunnelsSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly tunnels: readonly RemoteTunnelView[]
  readonly failure: Failure | null
}

/** Review-loop snapshot. */
export interface ReviewSnapshot {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly batch: RemoteReviewBatch | null
  /** Signed review identity returned by the host; required by apply/reject/rollback. */
  readonly target: RemoteReviewTarget | null
  readonly failure: Failure | null
  readonly busy: boolean
  /** Last apply result: step failures are **values** here, never thrown codes. */
  readonly applyResult: RemoteReviewApplyResult | null
  readonly note: string
}

/** Machine-readable self-check surface rendered into the DOM for acceptance. */
export interface DiagnosticsSnapshot {
  readonly describe: 'idle' | 'ok' | 'error'
  readonly targets: 'idle' | 'ok' | 'error'
  readonly config: 'idle' | 'ok' | 'error'
  readonly endpoints: number
  readonly revision: string
  readonly targetsCount: number
  readonly slots: Readonly<Record<string, boolean>>
}

/** One host as the badge resolves it. */
export interface ActiveHost {
  readonly id: string
  readonly name: string
  readonly state: RemoteLinkState
  readonly detail: string
}

/** Local fallback, mirroring the host's own `localView()`. */
export const LOCAL_VIEW: RemoteHostView = {
  id: 'local',
  name: '本机',
  kind: 'local',
  state: 'connected',
  detail: '',
  hostName: '',
  user: '',
  port: '',
  proxyJump: '',
  aliases: [],
  jump: false,
  configured: true,
}

/** Empty host record used by the settings form's "add host" action. */
export function blankHost(id: string): RemoteWorkspaceHostSetting {
  return {
    id,
    name: '',
    address: '',
    port: '22',
    username: '',
    auth: 'agent',
    keyPath: '',
    passwordRef: '',
    fromAlias: '',
    projectPath: '',
    remotePort: '3080',
    projects: [],
  }
}

/** The five slots this plugin occupies, in registration order. */
export const SLOT_NAMES = [
  'conversation.session.header.actions',
  'settings.section',
  'conversation.hero.workspace.directoryFlow',
  'sidebar.workspaces.directoryFlow',
  'shell.overlay',
] as const

/** Remote-workspace client model. */
export class RemoteWorkspaceClient {
  readonly hosts = new Cell<HostsSnapshot>({
    status: 'idle', targets: [LOCAL_VIEW], configuredOnly: false, probed: false, failure: null,
  })

  readonly config = new Cell<ConfigSnapshot>({ status: 'idle', value: null, failure: null })

  readonly hostFace = new Cell<HostFaceSnapshot>({ status: 'idle', value: null, failure: null })

  readonly tunnels = new Cell<TunnelsSnapshot>({ status: 'idle', tunnels: [], failure: null })

  readonly review = new Cell<ReviewSnapshot>({
    status: 'idle', batch: null, target: null, failure: null, busy: false, applyResult: null, note: '待审阅',
  })

  /** Which of {@link SLOT_NAMES} have actually had their declaration observed. */
  readonly slots = new Cell<Record<string, boolean>>(
    Object.fromEntries(SLOT_NAMES.map((name) => [name, false])),
  )

  private readonly ctx: Context

  /** @param ctx - the consumer plugin's context (carries `remote.remoteDev`). */
  constructor(ctx: Context) {
    this.ctx = ctx
  }

  /** Mark one slot declaration observed (called from each `slots.inject` callback). */
  markSlot(name: string): void {
    this.slots.patch({ [name]: true })
  }

  /** @returns the sibling-list diagnostics snapshot. */
  diagnostics(): DiagnosticsSnapshot {
    return {
      describe: this.hostFace.get().status === 'ready' ? 'ok' : this.hostFace.get().status === 'error' ? 'error' : 'idle',
      targets: this.hosts.get().status === 'ready' ? 'ok' : this.hosts.get().status === 'error' ? 'error' : 'idle',
      config: this.config.get().status === 'ready' ? 'ok' : this.config.get().status === 'error' ? 'error' : 'idle',
      endpoints: this.hostFace.get().value?.endpoints.length ?? 0,
      revision: this.hostFace.get().value?.revision ?? '',
      targetsCount: this.hosts.get().targets.length,
      slots: this.slots.get(),
    }
  }

  // ── host inventory ────────────────────────────────────────────────────────

  /**
   * Read the host inventory. `probe` spawns one short ssh per ssh host, so it is
   * an explicit user action — the host has no event stream, and the model must
   * not pretend it has a subscription.
   * @param options - probe / cache-bypass switches.
   */
  async loadTargets(options: { probe?: boolean; fresh?: boolean } = {}): Promise<void> {
    this.hosts.patch({ status: 'loading', failure: null })
    const probe = options.probe === true
    const fresh = options.fresh === true
    // TWO reads, because the host contract splits the inventory:
    //   * `includeAll: false` answers the user's CONFIGURED hosts (the only set
    //     a probe may touch — hosts the user has not added are never probed);
    //   * `includeAll: true` answers the full `~/.ssh/config` inventory, which
    //     is what the "更多主机（N）" escape counts.
    // Reading only the second one silently drops every configured host, which
    // is exactly how the badge and the flow's host row lost the real host.
    const [configuredResult, allResult] = await Promise.all([
      this.ctx.remote.remoteDev.listTargets({ includeAll: false, probe, fresh }),
      this.ctx.remote.remoteDev.listTargets({ includeAll: true, probe: false, fresh }),
    ])
    if (!configuredResult.ok) {
      this.hosts.patch({ status: 'error', failure: toFailure(configuredResult.error) })
      return
    }
    if (!allResult.ok) {
      this.hosts.patch({ status: 'error', failure: toFailure(allResult.error) })
      return
    }
    const configured = configuredResult.value.targets
    const known = new Set(configured.map((target) => target.id))
    const extras = allResult.value.targets.filter((target) => target.kind === 'ssh' && !known.has(target.id))
    this.hosts.set({
      failure: null,
      status: 'ready',
      // Configured first (with their real names/state), then the ssh-config-only
      // remainder explicitly marked `configured: false` for the escape hatch.
      targets: [...configured, ...extras.map((target) => ({ ...target, configured: false }))],
      configuredOnly: configuredResult.value.configuredOnly,
      probed: probe,
    })
  }

  /** @returns hosts the user configured (plus the always-present local target). */
  selectableHosts(showAll: boolean): readonly RemoteHostView[] {
    const targets = this.hosts.get().targets
    return showAll ? targets : targets.filter((t) => t.kind === 'local' || t.configured)
  }

  /** @returns how many `~/.ssh/config`-only hosts the "more hosts" escape hides. */
  extraHostCount(): number {
    return this.hosts.get().targets.filter((t) => t.kind === 'ssh' && !t.configured).length
  }

  /** @returns the host record for one id, falling back to the local view. */
  hostOf(hostId: string): RemoteHostView {
    return this.hosts.get().targets.find((t) => t.id === hostId) ?? LOCAL_VIEW
  }

  /**
   * Resolve the badge host from **real** data: the effective configuration's
   * resolved target (`readConfiguration`) joined against the live target list
   * (`listTargets`). When nothing is configured the local view is the honest
   * answer. There is no session→host model in the host face (no G-09 identity),
   * so this is "the configured target", not "the session's workspace host".
   * @returns the active host projection.
   */
  activeHost(): ActiveHost {
    const resolved = this.config.get().value?.resolved
    const hostId = resolved !== undefined && resolved.hostId !== '' ? resolved.hostId : 'local'
    const view = this.hostOf(hostId)
    return { id: view.id, name: view.name, state: view.state, detail: view.detail }
  }

  // ── configuration ─────────────────────────────────────────────────────────

  /** Read the effective configuration plus `~/.ssh/config` import candidates. */
  async loadConfig(): Promise<void> {
    this.config.patch({ status: 'loading', failure: null })
    const result = await this.ctx.remote.remoteDev.readConfiguration({ includeCandidates: true })
    if (!result.ok) {
      this.config.patch({ status: 'error', failure: toFailure(result.error) })
      return
    }
    this.config.set({ status: 'ready', value: result.value, failure: null })
  }

  /**
   * Persist host records and the scalar target chain.
   * @param hosts - full replacement list of host records.
   * @param scalars - chain fields; empty strings mean "leave unchanged" (host contract).
   */
  async saveConfig(
    hosts: readonly RemoteWorkspaceHostSetting[],
    scalars: { projectPath: string; mDir: string; hub: string; enginePath: string },
  ): Promise<Outcome<{ configured: boolean; missing: readonly string[] }>> {
    const result = await this.ctx.remote.remoteDev.updateConfiguration({
      hosts: [...hosts],
      projectPath: scalars.projectPath,
      mDir: scalars.mDir,
      hub: scalars.hub,
      enginePath: scalars.enginePath,
    })
    if (!result.ok) return failedOutcome(toFailure(result.error))
    return okOutcome({ configured: result.value.configured, missing: result.value.missing })
  }

  // ── host-face self description ────────────────────────────────────────────

  /** Ask the host face to describe itself (runtime self-proof, G-11). */
  async loadHostFace(): Promise<void> {
    this.hostFace.patch({ status: 'loading', failure: null })
    const result = await this.ctx.remote.remoteDev.describe({ includeEndpoints: true })
    if (!result.ok) {
      this.hostFace.patch({ status: 'error', failure: toFailure(result.error) })
      return
    }
    this.hostFace.set({ status: 'ready', value: result.value, failure: null })
  }

  // ── tunnels ───────────────────────────────────────────────────────────────

  /** Read the live tunnel registry. */
  async loadTunnels(): Promise<void> {
    this.tunnels.patch({ status: 'loading', failure: null })
    const result = await this.ctx.remote.remoteDev.listTunnels({ includeDead: false })
    if (!result.ok) {
      this.tunnels.patch({ status: 'error', failure: toFailure(result.error) })
      return
    }
    this.tunnels.set({ status: 'ready', tunnels: result.value.tunnels, failure: null })
  }

  /**
   * Open (or reuse) a tunnel to one ssh host.
   * @param hostId - configured id or alias.
   * @param requireAuthentication - ask the host to fail rather than degrade when no token is available.
   */
  async openTunnel(hostId: string, requireAuthentication: boolean): Promise<Outcome<RemoteTunnelView>> {
    const result = await this.ctx.remote.remoteDev.openTunnel({
      target: { hostId },
      requireAuthentication,
    })
    if (!result.ok) return failedOutcome(toFailure(result.error))
    return okOutcome(result.value)
  }

  /**
   * Close one host's tunnel.
   * @param hostId - configured id or alias.
   */
  async closeTunnel(hostId: string): Promise<Outcome<RemoteTunnelClosedValue>> {
    const result = await this.ctx.remote.remoteDev.closeTunnel({ hostId })
    if (!result.ok) return failedOutcome(toFailure(result.error))
    return okOutcome(result.value)
  }

  // ── directory flow ────────────────────────────────────────────────────────

  /**
   * List one directory. The returned `location` (and every `entries[].location`)
   * carries the host-issued proof that mutating verbs must echo back verbatim;
   * the client never builds a `{ hostId, path }` pair on its own.
   * @param hostId - target host id (`local` or a configured id / alias).
   * @param path - absolute path; empty means that host's home directory.
   */
  async listDirectory(hostId: string, path: string): Promise<Outcome<RemoteDirectoryListing>> {
    const result = await this.ctx.remote.remoteDev.listDirectory({
      target: { hostId },
      path,
    })
    if (!result.ok) return failedOutcome(toFailure(result.error))
    return okOutcome(result.value)
  }

  /**
   * Create one directory inside a listing's location.
   * @param location - the host-issued location proof.
   * @param name - new directory name.
   */
  async createDirectory(location: RemoteWorkspaceLocation, name: string): Promise<Outcome<RemoteWorkspaceLocation>> {
    const result = await this.ctx.remote.remoteDev.createDirectory({ location, name })
    if (!result.ok) return failedOutcome(toFailure(result.error))
    return okOutcome(result.value)
  }

  /**
   * Register a remote project and open that machine's DSH through a tunnel.
   * @param location - the host-issued location proof.
   * @param remember - ask the host to persist the project on the host record.
   * @param requireAuthentication - ask for a token-bearing URL or a typed failure.
   */
  async openProject(
    location: RemoteWorkspaceLocation,
    remember: boolean,
    requireAuthentication: boolean,
  ): Promise<Outcome<RemoteOpenedProject>> {
    const result = await this.ctx.remote.remoteDev.openProject({
      location,
      remember,
      requireAuthentication,
    })
    if (!result.ok) return failedOutcome(toFailure(result.error))
    return okOutcome(result.value)
  }

  // ── review loop ───────────────────────────────────────────────────────────

  /** Read the review status. The host fills any blank target field from its own chain. */
  async reviewStatus(): Promise<void> {
    this.review.patch({ status: 'loading', failure: null })
    const result = await this.ctx.remote.remoteDev.reviewStatus({
      target: { hostId: '', projectPath: '', mDir: '', hub: '', verifyCmd: '' },
    })
    if (!result.ok) {
      this.review.patch({ status: 'error', failure: toFailure(result.error) })
      return
    }
    this.review.patch({
      status: 'ready',
      target: result.value.target,
      note: result.value.missing ? '镜像缺失' : `${result.value.dirty} 个改动`,
      failure: null,
    })
  }

  /** Fetch one review batch (ssh + engine round trip; user-initiated only). */
  async reviewBatch(): Promise<void> {
    this.review.patch({ status: 'loading', busy: true, failure: null })
    const result = await this.ctx.remote.remoteDev.reviewBatch({
      target: { hostId: '', projectPath: '', mDir: '', hub: '', verifyCmd: '' },
      base: '',
    })
    if (!result.ok) {
      this.review.patch({ status: 'error', busy: false, failure: toFailure(result.error) })
      return
    }
    this.review.patch({
      status: 'ready',
      busy: false,
      batch: result.value,
      target: result.value.target,
      failure: null,
      note: result.value.empty ? '没有待审批次' : `${result.value.files.length} 个文件待审`,
    })
  }

  /**
   * Approve files. Step failures arrive as `ok:false` **values** with a step
   * trail, not as Remote error codes.
   * @param files - selected file paths.
   * @param verify - run the target's verification command.
   */
  async reviewApply(files: readonly string[], verify: boolean): Promise<void> {
    const target = this.review.get().target
    if (target === null) return
    this.review.patch({ busy: true, note: '提交中…', failure: null })
    const result = await this.ctx.remote.remoteDev.reviewApply({
      target,
      files: [...files],
      base: this.review.get().batch?.base ?? '',
      verify,
    })
    if (!result.ok) {
      this.review.patch({ busy: false, failure: toFailure(result.error), note: result.error.message })
      return
    }
    this.review.patch({
      busy: false,
      applyResult: result.value,
      note: result.value.ok ? '已应用并推进基线' : `步骤失败：${result.value.failedAt ?? '未知'}`,
    })
    await this.reviewBatch()
  }

  /**
   * Record a rejection (append-only decision ledger).
   * @param files - rejected file paths.
   * @param comment - required rejection reason.
   */
  async reviewReject(files: readonly string[], comment: string): Promise<void> {
    const target = this.review.get().target
    if (target === null) return
    this.review.patch({ busy: true, note: '记录中…', failure: null })
    const result = await this.ctx.remote.remoteDev.reviewReject({
      target,
      files: [...files],
      base: this.review.get().batch?.base ?? '',
      comment,
    })
    if (!result.ok) {
      this.review.patch({ busy: false, failure: toFailure(result.error), note: result.error.message })
      return
    }
    this.review.patch({ busy: false, note: `拒因已留痕：${result.value.comment}` })
  }

  /**
   * Roll the hub baseline back to a ref.
   * @param ref - commit to roll back to.
   */
  async reviewRollback(ref: string): Promise<void> {
    const target = this.review.get().target
    if (target === null) return
    this.review.patch({ busy: true, note: '回滚中…', failure: null })
    const result = await this.ctx.remote.remoteDev.reviewRollback({ target, ref })
    if (!result.ok) {
      this.review.patch({ busy: false, failure: toFailure(result.error), note: result.error.message })
      return
    }
    this.review.patch({ busy: false, note: `${result.value.note}（${result.value.ref.slice(0, 8)}）` })
    await this.reviewBatch()
  }
}
