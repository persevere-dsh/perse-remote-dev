/** Reactive source for the plugin-owned remote host → project → session group.
 *
 * The plugin already constructs the external backend and holds its catalog, so this
 * group needs nothing from the core Workspace browser: it reads the plugin's own
 * backend catalog plus the native selection, and it drives the native navigation
 * service to open or create a Session. Nothing here re-executes a Session locally.
 */
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

/** What the remote group renders: host rows, the current native selection, capability state. */
export interface RemoteNavSnapshot {
  readonly backends: readonly RemoteNavBackend[]
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
  readonly navigation: RemoteNavigation | undefined
  /** Optional hook so a failed native action can reach the plugin's own surfaces. */
  onActionError?: (error: unknown) => void
}

export interface RemoteNavModel extends ObservableSnapshot<RemoteNavSnapshot> {
  /** Open a Host-qualified Session through the native binding; never a local Session id. */
  openSession(address: ExternalSessionAddress): void
  /** Create a Session on the addressed Host Workspace and open it natively. */
  createSession(address: ExternalWorkspaceAddress): void
  dispose(): void
}

const EMPTY: RemoteNavSnapshot = { backends: [], selectedAddress: undefined, nativeSessionsAvailable: false }

/** Compare two Host-qualified addresses by value, so an equal re-read is not a re-render. */
export const sameAddress = (left: ExternalSessionAddress | undefined, right: ExternalSessionAddress | undefined): boolean =>
  left === right || (left !== undefined && right !== undefined
    && left.backendId === right.backendId && left.hostId === right.hostId
    && left.workspaceId === right.workspaceId && left.sessionId === right.sessionId)

/** Merge the plugin catalog and the native selection into one stable snapshot. */
export function createRemoteNavModel(sources: RemoteNavSources): RemoteNavModel {
  let snapshot: RemoteNavSnapshot = EMPTY
  const listeners = new Set<() => void>()
  let disposed = false

  const publish = (): void => {
    if (disposed) return
    const navigation = sources.navigation
    const next: RemoteNavSnapshot = {
      backends: sources.getBackends(),
      selectedAddress: navigation?.selection.getSnapshot().externalAddress,
      nativeSessionsAvailable: navigation !== undefined,
    }
    const previous = snapshot
    const sameSelection = sameAddress(previous.selectedAddress, next.selectedAddress)
    // Keep referential stability so React's external-store read does not re-render on no-op events.
    if (previous.backends === next.backends && sameSelection
      && previous.nativeSessionsAvailable === next.nativeSessionsAvailable) return
    snapshot = {
      ...next,
      selectedAddress: sameSelection ? previous.selectedAddress : next.selectedAddress,
    }
    for (const listener of [...listeners]) listener()
  }

  const stopBackends = sources.subscribeBackends(publish)
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
    dispose: () => {
      if (disposed) return
      disposed = true
      stopBackends()
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
