/** Reactive source for the plugin-owned remote host → project → session group.
 *
 * The plugin already constructs the external backend and holds its catalog, so this
 * group needs nothing from the core Workspace browser: it reads the plugin's own
 * backend catalog plus the stored profile list and the native selection, and it
 * drives the native navigation service to open or create a Session. Nothing here
 * re-executes a Session locally.
 *
 * Row inventory: one row per stored profile, never only the active one
 * (docs/pc-contract.md: Sidebar host row display states). The row state is derived
 * from exactly two contract facts — the observed `status` and the `autoConnect`
 * intent marker — so the view can never invent a connection intent; the durable
 * `desiredState` stays host-side and is never read here.
 */
import type { PcProfileView } from '../../types.ts'
import type {
  ExternalBackendId, ExternalHostId, ExternalSessionAddress, ExternalSessionBindingInfo,
  ExternalWorkspaceAddress, ExternalWorkspaceSummary,
} from '../native-sessions/core-types.ts'
import type { ExternalSessionsRegistry, ObservableSnapshot } from '../native-sessions/core-types.ts'

/** One host row: the plugin's verified backend plus its current catalog state. */
export interface RemoteNavBackend {
  readonly backendId: ExternalBackendId
  readonly hostId: ExternalHostId
  readonly hostName: string
  readonly profileName: string
  readonly status: 'connected' | 'offline'
  readonly warning: string | undefined
  readonly catalogError: string | undefined
  readonly workspaces: readonly ExternalWorkspaceSummary[]
}

/** The four honest row readings over (observed status, autoConnect intent marker). */
export type RemoteHostRowState = 'connected' | 'reconnect' | 'not-connected' | 'revoked'

/** One stored profile rendered as a row. `backend` exists only for the host whose
 * generation currently owns native sessions (see `active`).
 *
 * Multi-host facts, from what the code actually does — not a guess:
 * `bridge.ts` keys its live connections by `profileId` and `connectProfile`
 * replaces only that profile's own previous socket, so several stored hosts may
 * each hold a live verified socket in this process at the same time.
 * `PcNativeSessionIntegration.install()` however keeps exactly one external
 * backend (it unregisters the previous one) and the controller's `connection` is
 * singular, so at most ONE host is active for native sessions — the last
 * verified connect. A connected-but-not-active host therefore stays true-state
 * (green dot) with no session tree; it is not hidden and not drawn as active.
 */
export interface RemoteNavHost {
  readonly profileId: string
  readonly hostName: string
  readonly deviceName: string
  readonly rowState: RemoteHostRowState
  /** True only for the single host the plugin's installed backend serves sessions for. */
  readonly active: boolean
  readonly backend: RemoteNavBackend | undefined
}

/** What the remote group renders: one row per stored host, the current native selection, capability state. */
export interface RemoteNavSnapshot {
  readonly hosts: readonly RemoteNavHost[]
  readonly selectedAddress: ExternalSessionAddress | undefined
  /** False on a DSH core without the external-session seam (connection-only mode). */
  readonly nativeSessionsAvailable: boolean
}

/** The native navigation surface the group drives; only the patched core provides it. */
export interface RemoteNavigation {
  readonly selection: ObservableSnapshot<{ readonly externalAddress?: ExternalSessionAddress }>
  openExternalSession(address: ExternalSessionAddress): void
  createExternalSession(address: ExternalWorkspaceAddress): Promise<unknown>
}

/** The session id type the core session service accepts, without rebranding it here. */
export type NativeSessionId = Parameters<ExternalSessionsRegistry['externalIdentityOf']>[0]

/** The header seat hands the row's Session id as a plain string; brand it for the service call. */
export const asNativeSessionId = (value: string): NativeSessionId => value as NativeSessionId

/** Runtime detection: an older core has `uiWorkspace` but no external-session navigation. */
export function navigationApiOf(value: unknown): RemoteNavigation | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const service = value as Record<string, unknown>
  const selection = service.selection as Record<string, unknown> | null | undefined
  if (typeof service.openExternalSession !== 'function' || typeof service.createExternalSession !== 'function') return undefined
  if (selection === null || typeof selection !== 'object'
    || typeof selection.getSnapshot !== 'function' || typeof selection.subscribe !== 'function') return undefined
  return service as unknown as RemoteNavigation
}

export interface RemoteNavSources {
  getBackends(): readonly RemoteNavBackend[]
  subscribeBackends(listener: () => void): () => void
  /** Every stored profile — the row inventory comes from here, not from the backend. */
  getProfiles(): readonly PcProfileView[]
  subscribeProfiles(listener: () => void): () => void
  /** The stored profile whose installed generation currently owns native sessions. */
  getActiveProfileId(): string | undefined
  /** One explicit user-requested connect/reconnect for exactly that profile (never automatic). */
  connectProfile(profileId: string): void
  readonly navigation: RemoteNavigation | undefined
  /** Optional hook so a failed native action can reach the plugin's own surfaces. */
  onActionError?: (error: unknown) => void
}

export interface RemoteNavModel extends ObservableSnapshot<RemoteNavSnapshot> {
  /** Open a Host-qualified Session through the native binding; never a local Session id. */
  openSession(address: ExternalSessionAddress): void
  /** Create a Session on the addressed Host Workspace and open it natively. */
  createSession(address: ExternalWorkspaceAddress): void
  /**
   * One explicit connect/reconnect attempt for exactly one profile, on click.
   * 「重连」 and 「连接」 share this entry: the bridge-side connect is the same
   * reverify-only path (fresh generation, host identity validated, no Session
   * recreated, no prompt or mutation replayed); the row labels state the user's
   * intent, they do not select different transports. Neither label ever
   * schedules an automatic retry.
   */
  connectHost(profileId: string): void
  dispose(): void
}

const EMPTY: RemoteNavSnapshot = { hosts: [], selectedAddress: undefined, nativeSessionsAvailable: false }

/** Compare two Host-qualified addresses by value, so an equal re-read is not a re-render. */
export const sameAddress = (left: ExternalSessionAddress | undefined, right: ExternalSessionAddress | undefined): boolean =>
  left === right || (left !== undefined && right !== undefined
    && left.backendId === right.backendId && left.hostId === right.hostId
    && left.workspaceId === right.workspaceId && left.sessionId === right.sessionId)

/**
 * The decision table from docs/pc-contract.md, in code. The observation is
 * primary; the intent marker only splits a not-connected observation into
 * transport loss (reconnectable) versus withdrawn intent. `autoConnect` is the
 * single allowed intent signal — nothing here reads or reconstructs
 * `desiredState`, so the view cannot invent intent.
 */
export function remoteHostRowState(profile: PcProfileView): RemoteHostRowState {
  if (profile.status === 'connected') return 'connected'
  if (profile.status === 'revoked') return 'revoked'
  return profile.autoConnect === true ? 'reconnect' : 'not-connected'
}

/** Merge the plugin catalog and the native selection into one stable snapshot. */
export function createRemoteNavModel(sources: RemoteNavSources): RemoteNavModel {
  let snapshot: RemoteNavSnapshot = EMPTY
  const listeners = new Set<() => void>()
  let disposed = false

  const buildHosts = (): readonly RemoteNavHost[] => {
    const backends = sources.getBackends()
    const activeProfileId = sources.getActiveProfileId()
    return sources.getProfiles().map(profile => {
      const backend = backends.find(candidate => String(candidate.backendId) === profile.profileId)
      return {
        profileId: profile.profileId,
        hostName: profile.hostName,
        deviceName: profile.deviceName,
        rowState: remoteHostRowState(profile),
        active: activeProfileId !== undefined && activeProfileId === profile.profileId,
        backend,
      }
    })
  }

  // The merge above allocates fresh objects every time; keeping the previous
  // array while it is field-for-field equal preserves the referential
  // stability React's external-store read relies on.
  const sameHosts = (left: readonly RemoteNavHost[], right: readonly RemoteNavHost[]): boolean =>
    left.length === right.length && left.every((host, index) => {
      const other = right[index]
      return other !== undefined && host.profileId === other.profileId && host.hostName === other.hostName
        && host.deviceName === other.deviceName && host.rowState === other.rowState
        && host.active === other.active && host.backend === other.backend
    })

  const publish = (): void => {
    if (disposed) return
    const navigation = sources.navigation
    const hosts = buildHosts()
    const next: RemoteNavSnapshot = {
      hosts: sameHosts(snapshot.hosts, hosts) ? snapshot.hosts : hosts,
      selectedAddress: navigation?.selection.getSnapshot().externalAddress,
      nativeSessionsAvailable: navigation !== undefined,
    }
    const previous = snapshot
    const sameSelection = sameAddress(previous.selectedAddress, next.selectedAddress)
    // Keep referential stability so React's external-store read does not re-render on no-op events.
    if (previous.hosts === next.hosts && sameSelection
      && previous.nativeSessionsAvailable === next.nativeSessionsAvailable) return
    snapshot = {
      ...next,
      selectedAddress: sameSelection ? previous.selectedAddress : next.selectedAddress,
    }
    for (const listener of [...listeners]) listener()
  }

  const stopBackends = sources.subscribeBackends(publish)
  const stopProfiles = sources.subscribeProfiles(publish)
  const navigation = sources.navigation
  const stopSelection = navigation === undefined ? undefined : navigation.selection.subscribe(publish)
  publish()

  const guard = (action: () => unknown): void => {
    if (navigation === undefined) return
    try {
      const result = action()
      if (result !== null && typeof result === 'object' && typeof (result as Promise<unknown>).catch === 'function') {
        void (result as Promise<unknown>).catch((error: unknown) => { sources.onActionError?.(error) })
      }
    } catch (error) { sources.onActionError?.(error) }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    openSession: address => { void guard(() => navigation?.openExternalSession(address)) },
    createSession: address => { void guard(() => navigation?.createExternalSession(address)) },
    // One dispatch per call, for exactly this profile; no timer is ever armed here.
    connectHost: profileId => { sources.connectProfile(profileId) },
    dispose: () => {
      if (disposed) return
      disposed = true
      stopBackends()
      stopProfiles()
      stopSelection?.()
      listeners.clear()
    },
  }
}

/** Resolve the header badge label for one native Session id from the plugin's own catalog. */
export function externalBindingOf(sessions: ExternalSessionsRegistry | undefined, sessionId: NativeSessionId): ExternalSessionBindingInfo | undefined {
  if (sessions === undefined) return undefined
  try {
    return sessions.externalIdentityOf(sessionId)
  } catch {
    return undefined
  }
}
