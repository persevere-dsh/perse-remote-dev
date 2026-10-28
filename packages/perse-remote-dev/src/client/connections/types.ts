import type {
  PcConnectValue,
  PcCallValue,
  PcPairPreviewValue,
  PcProfileView,
  PcProfilesValue,
} from 'perse-remote-dev/types'

export type PcOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: PcFailure }

export interface PcFailure {
  readonly code: string
  readonly message: string
  readonly details: unknown
  readonly remoteCode?: number
  readonly remoteData?: unknown
}

export type PcProfile = PcProfileView

export interface PcRemote {
  pcProfiles(request: {}): Promise<PcRemoteOutcome<PcProfilesValue>>
  pcPairPreview(request: { readonly link: string }): Promise<PcRemoteOutcome<PcPairPreviewValue>>
  pcPairConfirm(request: { readonly confirmationId: string; readonly deviceName: string }): Promise<PcRemoteOutcome<PcConnectValue>>
  pcConnect(request: { readonly profileId: string }): Promise<PcRemoteOutcome<PcConnectValue>>
  pcDisconnect(request: { readonly profileId: string }): Promise<PcRemoteOutcome<{ readonly profileId: string; readonly disconnected: true }>>
  pcForget(request: { readonly profileId: string }): Promise<PcRemoteOutcome<{ readonly profileId: string; readonly forgotten: true }>>
  pcRevoke(request: { readonly profileId: string; readonly generation: string }): Promise<PcRemoteOutcome<{ readonly profileId: string; readonly revoked: true }>>
  /** Forward one 1.2 method through the owner bridge, bound to this generation. */
  pcCall(request: {
    readonly profileId: string
    readonly generation: string
    readonly method: string
    readonly paramsJson: string
  }, signal?: AbortSignal): Promise<PcRemoteOutcome<PcCallValue>>
}

export type PcRemoteOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown }

export interface PcConnectionState {
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error'
  readonly profileId: string | null
  readonly hostId: string | null
  readonly generation: string | null
  readonly hostInfo: Readonly<Record<string, unknown>> | null
  readonly error: PcFailure | null
}

export interface PcConnectionSnapshot {
  readonly profiles: readonly PcProfile[]
  readonly connection: PcConnectionState
  readonly pairingPreview: PcPairPreviewValue | null
  readonly failure: PcFailure | null
  /** Native DSH remote-session support depends on the running DSH core version. */
  readonly nativeSessionSupport: 'available' | 'unavailable'
  readonly pendingCreations: readonly { readonly profileId: string; readonly hostId: string; readonly workspaceId: string; readonly operationId: string; readonly startedAt: number }[]
}

export interface PcConnectionController {
  getSnapshot(): PcConnectionSnapshot
  subscribe(listener: () => void): () => void
  refreshProfiles(): Promise<PcOutcome<readonly PcProfile[]>>
  previewPairing(link: string): Promise<PcOutcome<PcPairPreviewValue>>
  confirmPairing(confirmationId: string, deviceName?: string): Promise<PcOutcome<PcConnectValue>>
  connectProfile(profileId: string): Promise<PcOutcome<PcConnectValue>>
  disconnectProfile(profileId?: string): Promise<PcOutcome<void>>
  forgetProfile(profileId: string): Promise<PcOutcome<void>>
  revokeSelf(profileId?: string): Promise<PcOutcome<void>>
  /** Update the connection-only page's native integration status. */
  setNativeSessionSupport(status: PcConnectionSnapshot['nativeSessionSupport']): void
  markConnectionOffline(profileId: string, generation: string, reason: unknown): void
  setPendingCreations(value: PcConnectionSnapshot['pendingCreations']): void
  setCreationReceiptAcknowledger(handler: (operationId: string) => void): void
  acknowledgeCreationReceipt(operationId: string): void
  dispose(): void
}

export interface PcConnectionControllerOptions {
  readonly remote: PcRemote
  readonly deviceName?: string
}
