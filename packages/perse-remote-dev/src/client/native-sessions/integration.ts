import type { PcConnectValue } from 'perse-remote-dev/types'
import type { PcConnectionController, PcConnectionSnapshot, PcProfile, PcRemote } from '../connections/types.ts'
import type { RemoteNavBackend } from '../remote-nav/model.ts'
import { PcNativeSessionBackend } from './backend.ts'
import { pcSubmissionReceipts } from './submission-receipts.ts'
import { hasExternalSessionsApi } from './registry-compat.ts'
import type { ExternalSessionsRegistry } from './core-types.ts'

/** Connects the settings controller to DSH's optional native external-session registry. */
export class PcNativeSessionIntegration {
  private readonly sessions: ExternalSessionsRegistry | undefined
  private readonly controller: PcConnectionController
  private readonly remote: PcRemote
  private backend: PcNativeSessionBackend | undefined
  private unregister: (() => void) | undefined
  private activeProfileId: string | undefined
  private readonly attemptedRecovery = new Set<string>()
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
    if (supported) void this.restoreConnectedProfiles()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
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

  private async restoreConnectedProfiles(): Promise<void> {
    const profiles = await this.controller.refreshProfiles()
    if (this.disposed || !profiles.ok) return
    for (const profile of profiles.value) {
      if (profile.status !== 'connected' || this.attemptedRecovery.has(profile.profileId)) continue
      this.attemptedRecovery.add(profile.profileId)
      // Reverify a previously live bridge socket and obtain a fresh generation;
      // never recreate a Session or replay a prompt during restoration.
      const connected = await this.controller.connectProfile(profile.profileId)
      if (!connected.ok) continue
      // connectProfile publishes the accepted connection synchronously. The
      // controller subscription above is the single installation owner; doing
      // another install here would retire that exact generation and its bindings.
    }
  }

  private sync(snapshot: PcConnectionSnapshot): void {
    if (this.disposed || this.sessions === undefined) return
    const connection = snapshot.connection
    if (connection.status === 'connected' && connection.profileId !== null
      && connection.hostId !== null && connection.generation !== null && connection.hostInfo !== null) {
      const profile = snapshot.profiles.find(item => item.profileId === connection.profileId)
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
