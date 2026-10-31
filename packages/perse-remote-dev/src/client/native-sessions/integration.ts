import type { PcConnectValue } from 'perse-remote-dev/types'
import type { PcConnectionController, PcConnectionSnapshot, PcProfile, PcRemote } from '../connections/types.ts'
import type { RemoteNavBackend } from '../remote-nav/model.ts'
import { PcNativeSessionBackend } from './backend.ts'
import { pcSubmissionReceipts } from './submission-receipts.ts'
import { hasExternalSessionsApi } from './registry-compat.ts'
import type { ExternalSessionsRegistry } from './core-types.ts'

const LOG = '[perse-remote-dev]'

// Capped exponential reconnect backoff (docs/pc-contract.md: Connection intent,
// transport loss, and reconnect). The first retry after an observed loss waits one
// first-delay, then each consecutive failure doubles it up to the cap.
const RECONNECT_FIRST_DELAY_MS = 2_000
const RECONNECT_MAX_DELAY_MS = 30_000

// How often a visible page re-reads the stored rows: the host's own observation of its
// socket, and the only thing that lets an idle page notice a dead host at all.
const RECONNECT_PROFILE_POLL_MS = 10_000

/** Connects the settings controller to DSH's optional native external-session registry. */
export class PcNativeSessionIntegration {
  private readonly sessions: ExternalSessionsRegistry | undefined
  private readonly controller: PcConnectionController
  private readonly remote: PcRemote
  private backend: PcNativeSessionBackend | undefined
  private unregister: (() => void) | undefined
  private activeProfileId: string | undefined
  /**
   * The connection this process had verified and installed. Its disappearance is the
   * transport-loss trigger; an explicit user action is not.
   */
  private liveConnection: { readonly profileId: string; readonly generation: string } | undefined
  private readonly reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /**
   * The last generation whose row this page saw reported `connected` by the host, per
   * profile. Only a transition away from it counts as a host-reported loss, which is why
   * it is not cleared when a backoff stops: the healthy snapshot that stops the backoff is
   * the same observation the next loss is measured against. Bounded by the profile count.
   */
  private readonly rowSaidConnected = new Map<string, string>()
  /** Set only when a real document exists; the visibility rule is browser-side by nature. */
  private pollTimer: ReturnType<typeof setTimeout> | undefined
  private visibilityDocument: { removeEventListener?: (type: string, listener: () => void) => void } | undefined
  private readonly onVisibilityChange = (): void => { this.attemptPendingReconnects() }
  private readonly reconnecting = new Set<string>()
  private readonly reconnectFailures = new Map<string, number>()
  private disposed = false
  private readonly stopController: () => void
  private readonly navListeners = new Set<() => void>()
  private navCatalogStop: (() => void) | undefined
  private navBoundBackend: PcNativeSessionBackend | undefined
  private navCatalogError: string | undefined

  /** Host rows for the plugin's own remote navigation group. */
  getBackends(): readonly RemoteNavBackend[] {
    const backend = this.backend
    if (backend === undefined) return []
    const catalog = backend.catalog.getSnapshot()
    return [{
      backendId: backend.backendId,
      hostId: backend.hostId,
      hostName: backend.hostName,
      profileName: backend.profileName,
      status: catalog.status === 'connected' ? 'connected' : 'offline',
      warning: catalog.warning,
      catalogError: this.navCatalogError,
      workspaces: catalog.workspaces,
    }]
  }

  /**
   * The stored profile whose installed generation currently owns native
   * sessions, if any. Exactly one backend is installed at a time — `install()`
   * unregisters the previous one — so at most one host is active for
   * sessions, even though `bridge.ts` can hold verified sockets for several
   * profiles concurrently (its `connections` map is keyed by profileId and a
   * connect only replaces that profile's own previous socket).
   */
  getActiveProfileId(): string | undefined {
    return this.backend === undefined ? undefined : this.activeProfileId
  }

  /**
   * Resolve the remote model seat host (specs/005) for a client Session id: defined only
   * for Sessions owned by the current backend generation; local Sessions get undefined.
   */
  seatHostFor(clientSessionId: string): { readonly backend: PcNativeSessionBackend; readonly remoteSessionId: string } | undefined {
    const backend = this.backend
    if (backend === undefined) return undefined
    const registry = this.sessions as unknown as {
      externalIdentityOf?: (id: string) => { backendId: string; generation: string; address: { sessionId: string } } | undefined
    } | undefined
    if (typeof registry?.externalIdentityOf !== 'function') return undefined
    let identity: { backendId: string; generation: string; address: { sessionId: string } } | undefined
    try { identity = registry.externalIdentityOf(clientSessionId) } catch { return undefined }
    if (identity === undefined) return undefined
    if (String(identity.backendId) !== String(backend.backendId) || String(identity.generation) !== String(backend.generation)) return undefined
    return { backend, remoteSessionId: String(identity.address.sessionId) }
  }

  /** Subscribe to backend install/retire and catalog changes; the group renders from this alone. */
  subscribeBackends(listener: () => void): () => void {
    this.navListeners.add(listener)
    this.bindNavCatalog()
    return () => {
      this.navListeners.delete(listener)
      this.bindNavCatalog()
    }
  }

  private readonly notifyNav = (): void => {
    for (const listener of [...this.navListeners]) listener()
  }

  private bindNavCatalog(): void {
    const target = this.disposed || this.navListeners.size === 0 ? undefined : this.backend
    if (target === this.navBoundBackend) return
    this.navCatalogStop?.()
    this.navCatalogStop = undefined
    this.navBoundBackend = undefined
    if (target === undefined) return
    this.navCatalogStop = target.catalog.subscribe(this.notifyNav)
    this.navBoundBackend = target
  }

  constructor(options: { sessions: ExternalSessionsRegistry | undefined; controller: PcConnectionController; remote: PcRemote }) {
    const supported = hasExternalSessionsApi(options.sessions)
    this.sessions = supported ? options.sessions : undefined
    this.controller = options.controller
    this.remote = options.remote
    this.controller.setNativeSessionSupport(supported ? 'available' : 'unavailable')
    this.refreshPendingCreationWarning()
    this.controller.setCreationReceiptAcknowledger(operationId => this.acknowledgeCreation(operationId))
    this.stopController = this.controller.subscribe(() => this.sync(this.controller.getSnapshot()))
    if (supported) {
      void this.restoreConnectedProfiles()
      this.attachVisibilityHook()
      this.scheduleProfilePoll(RECONNECT_PROFILE_POLL_MS)
    }
  }

  /**
   * Browsers throttle and eventually freeze timers in a hidden tab, so a retry that is
   * merely waiting on a backoff timer can be arbitrarily late — which is exactly the
   * state an operator sees after leaving the page in the background overnight. The page
   * becoming visible again is the honest moment to run what was waiting.
   */
  private attachVisibilityHook(): void {
    const doc = (globalThis as {
      document?: { addEventListener?: (type: string, listener: () => void) => void }
    }).document
    if (typeof doc?.addEventListener !== 'function') return
    doc.addEventListener('visibilitychange', this.onVisibilityChange)
    this.visibilityDocument = doc as { removeEventListener?: (type: string, listener: () => void) => void }
  }

  /** Runs every pending backoff attempt now; see the contract's hidden-page rule. */
  private attemptPendingReconnects(): void {
    if (!this.pageVisible()) return
    for (const [profileId, timer] of [...this.reconnectTimers]) {
      clearTimeout(timer)
      this.reconnectTimers.delete(profileId)
      // The ladder is deliberately untouched: a resume is not a success, and the
      // attempt still re-reads the stored intent before it reaches the host.
      void this.attemptReconnect(profileId)
    }
    // Coming back into view is also the moment to re-read the rows rather than wait
    // for the next tick: a host that died while the page was hidden becomes visible here.
    void this.readProfileRows()
  }

  /** No document (node-side harnesses) counts as visible: there is no hidden state to respect. */
  private pageVisible(): boolean {
    const doc = (globalThis as { document?: { visibilityState?: string } }).document
    return doc?.visibilityState === undefined || doc.visibilityState === 'visible'
  }

  private scheduleProfilePoll(delayMs: number): void {
    if (this.disposed) return
    if (this.pollTimer !== undefined) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined
      void this.readProfileRows()
    }, delayMs)
  }

  /**
   * The stored rows are the host's own observation of its socket. A page nobody is
   * interacting with otherwise never learns that the link died, and a host-reported
   * offline row is one of the two loss triggers (docs/pc-contract.md), so the read is
   * what makes an idle page recover on its own. It is the same profile-list read the UI
   * already performs — no extra wire method, no extra credential.
   */
  private async readProfileRows(): Promise<void> {
    if (this.disposed) return
    try {
      if (this.pageVisible()) await this.controller.refreshProfiles()
    } finally {
      if (!this.disposed) this.scheduleProfilePoll(RECONNECT_PROFILE_POLL_MS)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (typeof this.visibilityDocument?.removeEventListener === 'function') {
      this.visibilityDocument.removeEventListener('visibilitychange', this.onVisibilityChange)
    }
    this.visibilityDocument = undefined
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer)
    this.reconnectTimers.clear()
    if (this.pollTimer !== undefined) clearTimeout(this.pollTimer)
    this.pollTimer = undefined
    this.reconnectFailures.clear()
    this.rowSaidConnected.clear()
    this.reconnecting.clear()
    this.liveConnection = undefined
    this.controller.setCreationReceiptAcknowledger(() => undefined)
    this.stopController()
    this.unregister?.()
    this.unregister = undefined
    this.backend?.dispose()
    this.backend = undefined
    this.navCatalogStop?.()
    this.navCatalogStop = undefined
    this.navBoundBackend = undefined
    this.navListeners.clear()
  }

  /**
   * Launch-time restore: every reconnect-eligible profile gets one immediate
   * reverification from the list already read here. A failure keeps the eligibility
   * and re-enters the same backoff loop that serves a lost live connection, so a
   * host that is briefly down is not given up on for the rest of the session.
   */
  private async restoreConnectedProfiles(): Promise<void> {
    const profiles = await this.controller.refreshProfiles()
    if (this.disposed) return
    if (!profiles.ok) {
      // Surfaced once per activation: a profile store that cannot load must never
      // fail silently, or the host list stays empty with no trace anywhere.
      console.warn(LOG, `PC 配对配置读取失败：${profiles.failure.code} — ${profiles.failure.message}`)
      return
    }
    for (const profile of profiles.value) {
      // The bridge honestly reports a not-yet-verified saved profile as `offline`;
      // only its autoConnect flag states the stored intent, so writing down an
      // earlier transport loss never removed this eligibility.
      if (profile.autoConnect !== true) continue
      if (this.reconnecting.has(profile.profileId)) continue
      this.reconnecting.add(profile.profileId)
      try {
        await this.dispatchReconnect(profile.profileId)
      } finally {
        this.reconnecting.delete(profile.profileId)
      }
    }
  }

  /**
   * One pending attempt per profile: however many state changes point at the same lost
   * connection, only one timer is armed. Scheduling is legal while an attempt is still
   * in flight — the attempt schedules its own successor — so the timer re-arms instead
   * of being lost if that attempt has not settled by the time it fires.
   */
  private scheduleReconnect(profileId: string, delayMs: number): void {
    if (this.disposed) return
    if (this.reconnectTimers.has(profileId)) return
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(profileId)
      if (this.reconnecting.has(profileId)) {
        this.scheduleReconnect(profileId, RECONNECT_FIRST_DELAY_MS)
        return
      }
      void this.attemptReconnect(profileId)
    }, delayMs)
    this.reconnectTimers.set(profileId, timer)
  }

  /** After `failures` consecutive failures: about 2s, then 4s, 8s, 16s, capped at 30s. */
  private reconnectDelayMs(failures: number): number {
    return Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_FIRST_DELAY_MS * 2 ** Math.max(0, failures - 1))
  }

  private stopReconnect(profileId: string): void {
    const timer = this.reconnectTimers.get(profileId)
    if (timer !== undefined) clearTimeout(timer)
    this.reconnectTimers.delete(profileId)
    this.reconnectFailures.delete(profileId)
  }

  /**
   * A scheduled attempt re-reads the stored intent before dispatching, so a user
   * disconnect, a forget/revoke or a removed profile ends the loop without ever
   * reaching the host.
   */
  private async attemptReconnect(profileId: string): Promise<void> {
    if (this.disposed || this.reconnecting.has(profileId)) return
    this.reconnecting.add(profileId)
    try {
      const profiles = await this.controller.refreshProfiles()
      if (this.disposed) return
      if (!profiles.ok) {
        // The unreadable store already logged itself once; keep the loop alive at the
        // current delay rather than silently ending a connection the user wants back.
        this.scheduleReconnect(profileId, this.reconnectDelayMs(this.reconnectFailures.get(profileId) ?? 1))
        return
      }
      const profile = profiles.value.find(item => item.profileId === profileId)
      if (profile === undefined || profile.autoConnect !== true) {
        this.stopReconnect(profileId)
        return
      }
      const connection = this.controller.getSnapshot().connection
      // "Already connected" only counts while the host agrees: a page whose snapshot is
      // stale must not use it to cancel the retry its own row says is needed.
      if (connection.status === 'connected' && connection.profileId === profileId && profile.status !== 'offline') {
        this.stopReconnect(profileId)
        return
      }
      await this.dispatchReconnect(profileId)
    } finally {
      this.reconnecting.delete(profileId)
    }
  }

  /**
   * Reverify only, under the same rule as the launch-time restore: the bridge takes a
   * fresh generation and validates the host identity, no Session is recreated and no
   * prompt or mutation is replayed. A success installs through the single-owner
   * controller subscription below; installing here as well would retire the exact
   * generation the acceptance just published.
   */
  private async dispatchReconnect(profileId: string): Promise<void> {
    const result = await this.controller.connectProfile(profileId)
    if (this.disposed) return
    if (result.ok) {
      this.reconnectFailures.delete(profileId)
      console.log(LOG, `主机自动重连成功：profile=${profileId} generation=${result.value.generation}`)
      return
    }
    const failures = (this.reconnectFailures.get(profileId) ?? 0) + 1
    this.reconnectFailures.set(profileId, failures)
    // One line per failed attempt: the profile and the failure the bridge reported,
    // which is already credential-free. Credentials are never logged.
    console.warn(LOG, `主机自动重连失败，继续退避重试：profile=${profileId} attempt=${failures} ${result.failure.code} — ${result.failure.message}`)
    this.scheduleReconnect(profileId, this.reconnectDelayMs(failures))
  }

  private sync(snapshot: PcConnectionSnapshot): void {
    if (this.disposed || this.sessions === undefined) return
    const connection = snapshot.connection
    if (connection.status === 'connected' && connection.profileId !== null
      && connection.hostId !== null && connection.generation !== null && connection.hostInfo !== null) {
      const profile = snapshot.profiles.find(item => item.profileId === connection.profileId)
      if (profile?.status === 'offline') {
        // The row is the host's own observation of its socket. Seeing it offline *after*
        // it said connected for this very generation means the link was lost while the
        // page was idle and no call has failed yet — the state whose row already reads
        // 离线. A row that never said connected is not evidence of a loss: right after a
        // pairing the saved row can still read offline while the confirmed socket is live.
        if (this.rowSaidConnected.get(connection.profileId) === connection.generation) {
          this.liveConnection = undefined
          this.scheduleReconnect(connection.profileId, 0)
          return
        }
      } else if (profile?.status === 'connected') {
        this.rowSaidConnected.set(connection.profileId, connection.generation)
      }
      // A verified link exists in this process. It is the fact a later loss is
      // measured against, and any backoff for this profile is over.
      this.liveConnection = { profileId: connection.profileId, generation: connection.generation }
      this.stopReconnect(connection.profileId)
      if (profile === undefined) return
      if (this.backend?.generation === connection.generation && this.backend.backendId === connection.profileId) return
      this.install(profile, {
        profileId: connection.profileId,
        hostId: connection.hostId,
        generation: connection.generation,
        hostInfoJson: JSON.stringify(connection.hostInfo),
      })
      return
    }
    const lost = this.liveConnection
    if (lost !== undefined && connection.status === 'error' && connection.profileId === lost.profileId) {
      // The verified link disappeared while the user still wanted it: the stored
      // intent is untouched, so the same reverification path serves it, starting now.
      this.liveConnection = undefined
      this.scheduleReconnect(lost.profileId, 0)
    } else if (lost !== undefined && connection.status === 'disconnected'
      && (connection.profileId === lost.profileId || connection.profileId === null)) {
      // An explicit user action — 断开, 移除 or 撤销 — not a transport event. The
      // bridge already stored the withdrawn intent; the loop ends without a dispatch.
      this.liveConnection = undefined
      this.stopReconnect(lost.profileId)
    }
    if (this.activeProfileId !== undefined) {
      const stillExists = snapshot.profiles.some(profile => profile.profileId === this.activeProfileId)
      if (!stillExists) {
        this.unregister?.()
        this.unregister = undefined
        this.backend?.dispose()
        this.backend = undefined
        this.activeProfileId = undefined
        this.bindNavCatalog()
        this.notifyNav()
      } else {
        this.backend?.setOffline()
      }
    }
  }

  private install(profile: PcProfile, connection: PcConnectValue): void {
    if (this.sessions === undefined || this.disposed) return
    let parsed: Readonly<Record<string, unknown>>
    try {
      const value: unknown = JSON.parse(connection.hostInfoJson)
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return
      parsed = value as Readonly<Record<string, unknown>>
    } catch { return }
    this.unregister?.()
    this.backend?.dispose()
    const capturedProfileId = connection.profileId
    const capturedGeneration = connection.generation
    const backend = new PcNativeSessionBackend({
      remote: this.remote,
      profile,
      connection,
      hostInfo: parsed,
      isCurrent: () => {
        const current = this.controller.getSnapshot().connection
        return current.status === 'connected' && current.profileId === capturedProfileId
          && current.generation === capturedGeneration && current.hostId === connection.hostId
      },
      onOffline: reason => this.controller.markConnectionOffline(capturedProfileId, capturedGeneration, reason),
      onCreationReceiptChange: () => this.refreshPendingCreationWarning(),
    })
    this.backend = backend
    this.activeProfileId = connection.profileId
    this.navCatalogError = undefined
    this.unregister = this.sessions.registerExternalBackend(backend)
    this.bindNavCatalog()
    this.notifyNav()
    void backend.refresh().then(() => {
      if (this.disposed || this.backend !== backend || this.navCatalogError === undefined) return
      this.navCatalogError = undefined
      this.notifyNav()
    }, (error: unknown) => {
      if (this.disposed || this.backend !== backend) return
      this.navCatalogError = error instanceof Error ? error.message : 'catalog refresh failed'
      this.notifyNav()
    })
  }

  private refreshPendingCreationWarning(): void {
    try {
      this.controller.setPendingCreations(pcSubmissionReceipts.creationReceipts().map(({ profileId, hostId, workspaceId, operationId, startedAt }) => ({
        profileId, hostId, workspaceId, operationId, startedAt,
      })))
    } catch {
      this.controller.setPendingCreations([{
        profileId: 'unknown', hostId: 'unknown', workspaceId: 'unknown',
        operationId: 'receipt-storage-unreadable', startedAt: 0,
      }])
    }
  }

  private acknowledgeCreation(operationId: string): void {
    if (this.disposed) return
    try { pcSubmissionReceipts.clearCreation(operationId) } catch { return }
    this.backend?.refreshWarnings()
    this.refreshPendingCreationWarning()
  }
}
