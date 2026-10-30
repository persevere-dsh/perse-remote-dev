import type {} from '@deepseek-ai/dsh-typert-protocol'

/**
 * Browser-safe Remote vocabulary for the `remoteDev` namespace, plus the
 * domain failure code table.
 *
 * Rules this file obeys (official typed-remote spec):
 *   · Every type that crosses the Remote boundary is declared here, in this
 *     workspace package, and exported through the public non-root `./types`
 *     subpath. No `Agent`/`Session`/`Context` type from another package is used,
 *     and no `TypertLookupMap` entry is needed because every parameter is plain
 *     JSON data.
 *   · Host identity always travels with the wire value that carries the paths
 *     it qualifies (see {@link RemoteWorkspaceLocation} / {@link RemoteReviewTarget}).
 *     A path is never an independent named parameter that can be freely paired
 *     with an unrelated host.
 *   · Failure codes are `<domain>/<reason>` and are merged into the protocol's
 *     `RemoteErrorDetailsMap` next to the code that throws them.
 */

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** No configured host, ssh-config alias, or `local` matches this identity. */
    'remote-dev/target-unknown': { readonly hostId: string }
    /** The verb needs an ssh host, but the addressed identity is the local machine. */
    'remote-dev/target-not-remote': { readonly hostId: string }
    /** The ssh transport refused or never reached the host. */
    'remote-dev/ssh-unreachable': {
      readonly hostId: string
      readonly stderr: string
    }
    /** ssh reached the host but the remote DSH listener refused the forwarded port. */
    'remote-dev/remote-dsh-down': {
      readonly hostId: string
      readonly port: string
      readonly stderr: string
    }
    /** The tunnel exited or produced no HTTP response, and no known class matched. */
    'remote-dev/tunnel-failed': {
      readonly hostId: string
      readonly port: string
      readonly stderr: string
    }
    /** Every candidate local port in the allocation window was occupied. */
    'remote-dev/tunnel-port-exhausted': {
      readonly from: number
      readonly to: number
    }
    /** No live tunnel is registered for that host identity. */
    'remote-dev/tunnel-not-found': { readonly hostId: string }
    /** The remote DSH authentication token could not be obtained or verified. */
    'remote-dev/token-unavailable': {
      readonly hostId: string
      readonly reason: string
      readonly url: string
    }
    /** A path is empty, relative, or carries characters the ssh carrier cannot ship. */
    'remote-dev/location-invalid': { readonly path: string }
    /**
     * The host-issued location proof does not cover this exact (host identity,
     * path) pair: a path listed on host A can never be committed against host B,
     * because the host — not the client — refuses the mismatched pair.
     */
    'remote-dev/location-mismatch': {
      readonly hostId: string
      readonly path: string
    }
    /** A new directory name is empty, padded, or not a single path segment. */
    'remote-dev/name-invalid': { readonly name: string }
    /** A child of that name already exists. */
    'remote-dev/directory-exists': { readonly path: string }
    /** The directory does not exist, is not a directory, or cannot be read. */
    'remote-dev/directory-unreadable': {
      readonly hostId: string
      readonly path: string
      readonly reason: string
    }
    /** The remote listing command failed without an identifiable reason. */
    'remote-dev/list-failed': {
      readonly hostId: string
      readonly code: number
      readonly stderr: string
    }
    /** The create-directory command failed for a reason other than an existing child. */
    'remote-dev/mkdir-failed': {
      readonly hostId: string
      readonly path: string
      readonly code: number
      readonly reason: string
    }
    /** The settings provider is absent, or its namespace has not been registered yet. */
    'remote-dev/settings-unavailable': {}
    /** One or more host records failed validation before anything was written. */
    'remote-dev/config-invalid': { readonly problems: readonly string[] }
    /** The review loop needs host, project path, batch dir, and hub; some are unset. */
    'remote-dev/review-target-missing': {
      readonly missing: readonly string[]
      readonly hint: string
    }
    /** The rd-core engine path is unset and no bundled engine resolved. */
    'remote-dev/engine-unconfigured': {}
    /** The rd-core engine exited non-zero for a step that must succeed first. */
    'remote-dev/engine-failed': {
      readonly step: string
      readonly code: number
      readonly output: string
    }
    /** The hub has no `rd-base` baseline ref to diff against. */
    'remote-dev/base-missing': { readonly hub: string }
    /** The verb was called with no files selected. */
    'remote-dev/files-empty': {}
    /** None of the selected files carries a change in the current batch. */
    'remote-dev/files-unchanged': { readonly files: readonly string[] }
    /** The file-filtered patch is empty. */
    'remote-dev/patch-empty': {}
    /** A rejection must carry a reason. */
    'remote-dev/comment-empty': {}
    /** A rollback must name a baseline ref. */
    'remote-dev/ref-missing': {}
    /** A forwarded Perse Remote 1.2 method returned a JSON-RPC error. */
    'remote-dev/pc-remote-error': {
      readonly profileId: string
      readonly method: string
      readonly remoteCode: number
      readonly remoteMessage: string
      readonly dataJson?: string
    }
    /** A PC profile is absent, malformed, or no longer usable. */
    'remote-dev/pc-profile-invalid': { readonly profileId: string }
    /** A pairing preview handle is absent, expired, or already consumed. */
    'remote-dev/pc-confirmation-invalid': {}
    /** A pairing link failed strict local validation. */
    'remote-dev/pc-pairing-invalid': { readonly reason: string }
    /** Private profile storage is unsafe or unavailable. */
    'remote-dev/pc-storage-unavailable': { readonly reason: string }
    /** A supplied connection generation is stale. */
    'remote-dev/pc-generation-stale': {
      readonly profileId: string
      readonly expectedGeneration: string
      readonly currentGeneration?: string
    }
    /** The method is outside the 1.2 forwarding allowlist. */
    'remote-dev/pc-method-unsupported': { readonly method: string }
    /** Remote protocol is outside the supported 1.x minor range. */
    'remote-dev/pc-protocol-unsupported': {
      readonly protocolVersion: string
      readonly requiredMajor: 1
      readonly minimumMinor: 1
    }
    /** A bridge request or response exceeded a configured bound. */
    'remote-dev/pc-payload-too-large': { readonly limitBytes: number }
    /** Bridge transport did not complete within its bounded deadline. */
    'remote-dev/pc-transport-failed': {
      readonly profileId: string
      readonly method: string
      readonly reason: string
    }
    /** Legacy URL-opening routes have been retired in favor of paired Perse 1.2 profiles. */
    'remote-dev/pc-legacy-retired': { readonly method: string }
    /** A native DSH session operation is not advertised by the verified host (specs/005 adds the requested model). */
    'remote-dev/pc-native-capability-unavailable': {
      readonly method: string
      readonly capability: string
      /** Model route the request named, when the refusal concerns a specific model. */
      readonly model?: string
    }
    /** Remote native history is no longer retained at the requested cursor. */
    'remote-dev/pc-native-history-expired': {
      readonly sessionId: string
      readonly afterSequence: number
      readonly retentionFloor: number
    }
    /** The remote native session response was invalid or exceeded a safe bound. */
    'remote-dev/pc-native-session-invalid': {
      readonly sessionId: string
      readonly reason: string
    }
    /** This DSH runtime has no host-aware native-session extension. */
    'remote-dev/pc-native-session-unavailable': { readonly requiredApi: string }
    /** A legacy settings file was invalid, changed after preview, or conflicts with this profile. */
    'remote-dev/legacy-config-invalid': {
      readonly reason: string
      readonly conflictFields?: readonly string[]
      readonly unsupportedFields?: readonly string[]
      readonly reasonCode?: string
    }
  }
}

/** Sanitized profile summary; durable device credentials never cross the Remote boundary. */
export interface PcProfileView {
  readonly profileId: string
  readonly endpoint: string
  readonly networkMode: 'https' | 'tailnet' | 'local'
  readonly hostId: string
  readonly hostName: string
  readonly deviceId: string
  readonly deviceName: string
  readonly status: 'disconnected' | 'connected' | 'offline' | 'revoked'
  readonly protocolVersion?: string
  readonly verifiedAt?: string
  /**
   * True when the saved profile was live at its last verification but this host
   * process has no verified socket for it yet. The display status stays honest
   * (`offline` until a live handshake); this flag alone marks the profile
   * eligible for launch-time auto-reconnect. Absent = not eligible.
   */
  readonly autoConnect?: boolean
}

/** Result of listing locally stored PC connection profiles. */
export interface PcProfilesValue {
  readonly profiles: readonly PcProfileView[]
}

/** Empty request for the saved local PC profile list. */
export interface PcProfilesRequest {}

/** Pairing link supplied for a no-network local preview. */
export interface PcPairPreviewRequest {
  readonly link: string
}

/** Redacted host/access summary and one-use opaque local confirmation handle. */
export interface PcPairPreviewValue {
  readonly confirmationId: string
  readonly hostId: string
  readonly hostName: string
  readonly endpoint: string
  readonly networkMode: 'https' | 'tailnet' | 'local'
  readonly expiresAt: string
  readonly accessSummary: string
}

/** Explicit confirmation request; the original pairing secret is not accepted here. */
export interface PcPairConfirmRequest {
  readonly confirmationId: string
  readonly deviceName: string
}

/** Result after one-time exchange and a verified host.info handshake. */
export interface PcConnectValue {
  readonly profileId: string
  readonly hostId: string
  readonly generation: string
  readonly hostInfoJson: string
}

/** Selects an existing locally stored profile for connection. */
export interface PcConnectRequest {
  readonly profileId: string
}

/** Selects an existing local profile for a disconnect operation. */
export interface PcDisconnectRequest {
  readonly profileId: string
}

/** Confirmation that a local bridge socket was closed. */
export interface PcDisconnectValue {
  readonly profileId: string
  readonly disconnected: true
}

/** Selects an existing local profile for deletion. */
export interface PcForgetRequest {
  readonly profileId: string
}

/** Confirmation that one local profile and its credential were removed. */
export interface PcForgetValue {
  readonly profileId: string
  readonly forgotten: true
}

/** Revokes the authenticated device grant on its current verified connection. */
export interface PcRevokeRequest {
  readonly profileId: string
  readonly generation: string
}

/** Confirmation that self-revocation succeeded and the local profile was forgotten. */
export interface PcRevokeValue {
  readonly profileId: string
  readonly revoked: true
}

/** Request to forward one allowlisted 1.2 method over the captured generation. */
export interface PcCallRequest {
  readonly profileId: string
  readonly generation: string
  readonly method: string
  /** JSON-encoded object params, bounded and schema-checked by the bridge. */
  readonly paramsJson: string
}

/** JSON-encoded result from one allowlisted 1.2 method. */
export interface PcCallValue {
  readonly resultJson: string
}

/**
 * Host identity as it crosses the wire. One value object, never a bare string
 * sitting beside an unrelated path.
 */
export interface RemoteWorkspaceTarget {
  /** `local`, a configured host id, its `fromAlias`, or an ssh-config alias. */
  readonly hostId: string
}

/**
 * A path together with the host identity that gives it meaning, plus the
 * host-issued proof that the pair was actually observed by this instance.
 *
 * The token is an HMAC over the exact (host identity, path) pair minted when
 * the host itself produced that path (`listDirectory`, `createDirectory`).
 * Mutating verbs re-verify it, so a path listed on one host can never be
 * committed against another.
 */
export interface RemoteWorkspaceLocation {
  readonly target: RemoteWorkspaceTarget
  /** Canonical path on that host, as the host resolved it. */
  readonly path: string
  readonly token: string
}

/** Link state vocabulary shared with the official client wording. */
export type RemoteLinkState =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'unknown'

/** One selectable target: the local machine, or an ssh host. */
export interface RemoteHostView {
  /** Stable identity used on the wire. */
  readonly id: string
  readonly name: string
  readonly kind: 'local' | 'ssh'
  readonly state: RemoteLinkState
  /** Human-readable address summary. */
  readonly detail: string
  /** Resolved ssh `HostName` for ssh targets; empty for `local`. */
  readonly hostName: string
  /** Resolved ssh user; empty when ssh itself decides. */
  readonly user: string
  /** Resolved ssh port; empty for the ssh default or when an alias decides. */
  readonly port: string
  readonly proxyJump: string
  /** Every `~/.ssh/config` alias that folds onto the same endpoint. */
  readonly aliases: readonly string[]
  /** This alias is only reachable as another host's ProxyJump. */
  readonly jump: boolean
  /** This row comes from the user's configured host list, not from ssh config. */
  readonly configured: boolean
}

/** One directory entry as the host observed it. */
export interface RemoteDirectoryEntry {
  readonly name: string
  readonly path: string
  readonly hidden: boolean
  /** Proof binding `path` to the host that listed it. */
  readonly location: RemoteWorkspaceLocation
}

/** One directory listing, with its own identity-bearing location. */
export interface RemoteDirectoryListing {
  readonly target: RemoteWorkspaceTarget
  /** Stable identity of the host that answered. */
  readonly host: string
  /** Canonical directory path the host resolved (may differ from the request). */
  readonly path: string
  /** Parent directory in the same coordinates; absent at the root. */
  readonly parent?: string
  /** Login home directory on that host. */
  readonly home: string
  readonly location: RemoteWorkspaceLocation
  readonly entries: readonly RemoteDirectoryEntry[]
}

/** One persisted host record, exactly as the settings seam stores it. */
export interface RemoteWorkspaceHostSetting {
  readonly id: string
  readonly name: string
  /** Network address; empty when an ssh alias is used. */
  readonly address: string
  readonly port: string
  readonly username: string
  /** `key` | `password` | `agent`; validated on write. */
  readonly auth: string
  /** Private key path for direct connections; empty means the ssh default/agent. */
  readonly keyPath: string
  /** Credential reference name; plaintext passwords are never stored. */
  readonly passwordRef: string
  /** `~/.ssh/config` alias this record was imported from, when any. */
  readonly fromAlias: string
  /** Last project path used on this host. */
  readonly projectPath: string
  /** Remote DSH listen port; `3080` when unset. */
  readonly remotePort: string
  readonly projects: readonly string[]
}

/** The effective configuration the settings page reads. */
export interface RemoteConfigurationValue {
  readonly hosts: readonly RemoteWorkspaceHostSetting[]
  /** The legacy `targets` array was folded into `hosts` for this read. */
  readonly migrated: boolean
  readonly enginePath: string
  readonly resolved: RemoteResolvedTarget
  readonly configured: boolean
  readonly missing: readonly string[]
  readonly hint: string
  /** `~/.ssh/config` aliases offered as import sources. */
  readonly candidates: readonly RemoteHostView[]
}

/** The effective target chain, as resolved from settings. */
export interface RemoteResolvedTarget {
  /** ssh target the host would use: alias first, else `user@address`. */
  readonly host: string
  /** Stable identity of the same target. */
  readonly hostId: string
  readonly projectPath: string
  /** Stored batch directory (M) for the review loop; empty when unset. */
  readonly mDir: string
  readonly hub: string
  readonly verifyCmd: string
}

/** Result of listing targets. */
export interface RemoteTargetsValue {
  readonly targets: readonly RemoteHostView[]
  /** `true` when only the user's configured hosts are returned. */
  readonly configuredOnly: boolean
}

/** Mutation input for the settings document. */
export interface RemoteConfigurationUpdate {
  readonly hosts: readonly RemoteWorkspaceHostSetting[]
  /** Empty string leaves the stored project path untouched. */
  readonly projectPath: string
  /** Empty string leaves the stored batch directory (M) untouched. */
  readonly mDir: string
  /** Empty string leaves the stored hub untouched. */
  readonly hub: string
  /** Empty string leaves the stored engine path untouched. */
  readonly enginePath: string
}

/** Receipt after a settings write. */
export interface RemoteConfigurationUpdateValue {
  readonly configured: boolean
  readonly missing: readonly string[]
}

/** One of the two native Settings importer files under the active profile home. */
export type LegacyConfigSource = 'settings.yaml' | 'settings.yaml.imported'

/** Explicitly select a source; omitting it previews only when there is one candidate. */
export interface LegacyConfigPreviewRequest {
  readonly source?: LegacyConfigSource
}

/** Redacted migration preview. No imported configuration values are included. */
export interface LegacyConfigPreviewValue {
  readonly sources: readonly LegacyConfigSource[]
  readonly source?: LegacyConfigSource
  readonly sourcePath?: string
  readonly sha256?: string
  readonly importableFields: readonly string[]
  readonly conflictFields: readonly string[]
  readonly unsupportedFields: readonly string[]
  readonly canApply: boolean
}

/** SHA-256 from the explicit preview, required to prevent applying changed source bytes. */
export interface LegacyConfigApplyRequest {
  readonly source: LegacyConfigSource
  readonly sha256: string
}

/** Result of applying a source document into the active profile patch. */
export interface LegacyConfigApplyValue {
  readonly source: LegacyConfigSource
  readonly importedFields: readonly string[]
  readonly alreadyAppliedFields: readonly string[]
}

/** Input for listing targets. */
export interface RemoteTargetsRequest {
  /** Include every `~/.ssh/config` alias, not only configured hosts. */
  readonly includeAll: boolean
  /** Run an ssh reachability probe for each ssh target. */
  readonly probe: boolean
  /** Bypass the probe cache. Ignored unless `probe` is true. */
  readonly fresh: boolean
}

/** Input for reading the effective configuration. */
export interface RemoteConfigurationRequest {
  /** Include the `~/.ssh/config` import candidates. */
  readonly includeCandidates: boolean
}

/** Input for one directory listing. */
export interface RemoteListRequest {
  readonly target: RemoteWorkspaceTarget
  /** Absolute directory path; empty string means that host's home directory. */
  readonly path: string
}

/** Input for creating one directory below a host-observed location. */
export interface RemoteMkdirRequest {
  readonly location: RemoteWorkspaceLocation
  readonly name: string
}

/** Input for registering a project path and opening its remote DSH. */
export interface RemoteOpenProjectRequest {
  readonly location: RemoteWorkspaceLocation
  /** Persist the path on the host record. */
  readonly remember: boolean
  /** Fail with `remote-dev/token-unavailable` instead of degrading. */
  readonly requireAuthentication: boolean
}

/** Input for opening (or reusing) one ssh tunnel. */
export interface RemoteTunnelRequest {
  readonly target: RemoteWorkspaceTarget
  /** Fail with `remote-dev/token-unavailable` instead of degrading. */
  readonly requireAuthentication: boolean
}

/** Input for closing one tunnel. */
export interface RemoteCloseTunnelRequest {
  readonly hostId: string
}

/** Input for listing tunnels. */
export interface RemoteTunnelListRequest {
  /** Include tunnels whose ssh process already exited. */
  readonly includeDead: boolean
}

/** Input for the runtime self-description. */
export interface RemoteDescribeRequest {
  /** Include the endpoint list this live instance carries markers for. */
  readonly includeEndpoints: boolean
}

/** One live or dead tunnel. */
export interface RemoteTunnelView {
  readonly hostId: string
  readonly url: string
  readonly localPort: number
  readonly remotePort: string
  readonly alive: boolean
  readonly openedAt: number
  readonly refreshedAt: number
  readonly authenticated: boolean
  /** Present when the address was handed over without a verified token. */
  readonly warning?: string
}

/** Result of listing tunnels. */
export interface RemoteTunnelListValue {
  readonly tunnels: readonly RemoteTunnelView[]
}

/** Receipt after closing a tunnel. */
export interface RemoteTunnelClosedValue {
  readonly hostId: string
  readonly closed: boolean
}

/** Result of opening a project on a remote DSH. */
export interface RemoteOpenedProject {
  readonly target: RemoteWorkspaceTarget
  /** Stable identity of the host that answered. */
  readonly host: string
  /** The path registered/opened on that host. */
  readonly path: string
  readonly url: string
  readonly localPort: number
  readonly remotePort: string
  readonly reused: boolean
  readonly authenticated: boolean
  readonly saved: boolean
  readonly warning?: string
}

/**
 * The review loop's identity bundle. `mDir`, `projectPath`, and `hub` are three
 * different repositories on one host, so they travel as one object; `token`
 * proves the host issued this exact bundle and is required by every mutating
 * review verb.
 */
export interface RemoteReviewTarget {
  readonly hostId: string
  /** W: the project working tree the batch is applied to. */
  readonly projectPath: string
  /** M: the source tree the batch was produced from. */
  readonly mDir: string
  /** The hub repository holding the `rd-base` baseline. */
  readonly hub: string
  /** Local verification command; empty means no verification step. */
  readonly verifyCmd: string
  /** Host-issued proof over every field above; required by mutating verbs. */
  readonly token?: string
}

/** Read-only review status for one target. */
export interface RemoteReviewStatus {
  readonly target: RemoteReviewTarget
  readonly base?: string
  readonly head?: string
  readonly dirty: number
  readonly missing: boolean
}

/** One file in a review batch. */
export interface RemoteReviewFile {
  readonly path: string
  /** Added lines; absent for a deletion. */
  readonly add?: number
  /** Deleted lines; absent for an addition. */
  readonly del?: number
  readonly status: 'A' | 'M' | 'D'
}

/** One review batch: the file list plus the full diff. */
export interface RemoteReviewBatch {
  readonly target: RemoteReviewTarget
  readonly engine: string
  readonly base: string
  readonly head: string
  readonly files: readonly RemoteReviewFile[]
  readonly diff: string
  readonly empty: boolean
}

/** One executed engine step, with a tail of its output. */
export interface RemoteReviewStep {
  readonly step: string
  readonly code: number
  readonly output: string
}

/** Outcome of approve-and-apply. Step failures are values, not thrown errors. */
export interface RemoteReviewApplyResult {
  readonly ok: boolean
  readonly failedAt?: string
  readonly steps: readonly RemoteReviewStep[]
  readonly base: string
  readonly head: string
  readonly files: readonly string[]
  readonly verified: boolean
  readonly note: string
}

/** One append-only decision record. */
export interface RemoteDecisionRecord {
  readonly ts: string
  readonly kind: string
  readonly host: string
  readonly base: string
  readonly files: readonly string[]
  readonly comment: string
}

/** Outcome of a rollback. */
export interface RemoteReviewRollbackResult {
  readonly ok: boolean
  readonly code: number
  readonly ref: string
  readonly output: string
  readonly note: string
}

/** Runtime self-attestation for the loaded host face. */
export interface RemoteServiceDescription {
  readonly package: string
  readonly face: string
  readonly serviceKey: string
  readonly namespace: string
  /** Endpoints this live instance actually carries decorator markers for. */
  readonly endpoints: readonly string[]
  /** Content hash of the loaded host artifacts; proves running code identity. */
  readonly revision: string
  /**
   * Module URL the running process bound for the Remote protocol. A duplicate
   * protocol copy is what silently disables the Remote layer, so the runtime
   * attests which copy it actually loaded instead of leaving it to a doc.
   */
  readonly protocolModule: string
  /** Module URL the running process bound for Cordis. */
  readonly cordisModule: string
  readonly node: string
}

/** Input for one review status read. */
export interface RemoteReviewStatusRequest {
  readonly target: RemoteReviewTarget
}

/** Input for one batch read. */
export interface RemoteReviewBatchRequest {
  readonly target: RemoteReviewTarget
  /** Explicit baseline; empty string asks the host to resolve `rd-base`. */
  readonly base: string
}

/** Input for approve-and-apply. */
export interface RemoteReviewApplyRequest {
  readonly target: RemoteReviewTarget
  readonly files: readonly string[]
  /** Explicit baseline; empty string asks the host to resolve `rd-base`. */
  readonly base: string
  /** Run the target's `verifyCmd` between apply and baseline push. */
  readonly verify: boolean
}

/** Input for a rejection record. */
export interface RemoteReviewRejectRequest {
  readonly target: RemoteReviewTarget
  readonly files: readonly string[]
  readonly base: string
  readonly comment: string
}

/** Input for a rollback. */
export interface RemoteReviewRollbackRequest {
  readonly target: RemoteReviewTarget
  readonly ref: string
}
