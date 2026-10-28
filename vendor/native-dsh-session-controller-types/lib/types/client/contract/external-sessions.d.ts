/** Host-qualified Client identities and provider seam for external Sessions. */
import { type Branded } from '@deepseek-ai/dsh-brand';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import { type SessionId as SessionIdType, type SessionSeq, type SurfaceOp } from '@deepseek-ai/dsh-session/types';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { SessionFace } from './session.ts';
import type { SessionEventSource } from './events.ts';
/** Identifies one registered external connection profile. */
export type ExternalBackendId = Branded<'ExternalBackendId'>;
/**
 * Brand a profile id for external-session routing.
 * @param value - profile identifier.
 * @returns the branded backend id.
 */
export declare function ExternalBackendId(value: string): ExternalBackendId;
/** Identifies the verified remote DSH Host. */
export type ExternalHostId = Branded<'ExternalHostId'>;
/**
 * Brand a verified Host id.
 * @param value - verified Host identifier.
 * @returns the branded Host id.
 */
export declare function ExternalHostId(value: string): ExternalHostId;
/** Identifies a Workspace on one external Host. */
export type ExternalWorkspaceId = Branded<'ExternalWorkspaceId'>;
/**
 * Brand a Workspace id received from an external Host.
 * @param value - external Workspace identifier.
 * @returns the branded Workspace id.
 */
export declare function ExternalWorkspaceId(value: string): ExternalWorkspaceId;
/** Identifies a Session on one external Host. */
export type ExternalSessionId = Branded<'ExternalSessionId'>;
/**
 * Brand a Session id received from an external Host.
 * @param value - external Session identifier.
 * @returns the branded Session id.
 */
export declare function ExternalSessionId(value: string): ExternalSessionId;
/** Identifies one verified connection generation. */
export type ExternalBackendGeneration = Branded<'ExternalBackendGeneration'>;
/**
 * Brand a connection generation captured when a backend is registered.
 * @param value - connection generation identifier.
 * @returns the branded generation.
 */
export declare function ExternalBackendGeneration(value: string): ExternalBackendGeneration;
/** Workspace summary received from an external Host; its `path` is display metadata only. */
export interface ExternalWorkspaceCatalogEntry {
    readonly id: ExternalWorkspaceId;
    readonly name: string;
    readonly path?: string;
    readonly sessions: readonly ExternalSessionCatalogEntry[];
}
/** Session summary received from an external Host. */
export interface ExternalSessionCatalogEntry {
    readonly id: ExternalSessionId;
    readonly title: string;
    readonly updatedAt: number;
    readonly running: boolean;
    readonly blank: boolean;
}
/** Workspace on an external Host with Client-qualified session rows. */
export interface ExternalWorkspaceSummary extends Omit<ExternalWorkspaceCatalogEntry, 'sessions'> {
    readonly sessions: readonly ExternalSessionSummary[];
}
/** Session row with a stable Client id added by the session controller. */
export interface ExternalSessionSummary extends ExternalSessionCatalogEntry {
    /** Stable Client Session id derived by the session controller from the full address. */
    readonly clientSessionId: SessionIdType;
}
/** One boolean per operation family available through the native remote adapter. */
export interface ExternalSessionCapabilities {
    readonly prompt: boolean;
    /** Prompt admission in queue mode; this is distinct from editing existing queue occurrences. */
    readonly queue: boolean;
    /** Editing/removing/steering queued occurrences uses a separate Host API and is disabled by this adapter. */
    readonly queueEdit: false;
    /** Interrupting a running turn while submitting a prompt is distinct from stopping it. */
    readonly steer: false;
    readonly cancel: boolean;
    readonly rename: boolean;
    readonly readAttachment: boolean;
    /** File upload is a separate capability from reading an existing attachment and is not routed by this seam. */
    readonly fileUpload: false;
    /** Model selection has no SessionFace verb and must never fall through to local model state. */
    readonly modelSelection: false;
    /** Only explicit one-shot allow/deny responses with an archive-scoped approval id are exposed. */
    readonly approvalActions: boolean;
    readonly command: boolean;
}
/** One-shot decisions supported by the external Host approval protocol. */
export type ExternalApprovalDecision = 'allowOnce' | 'deny';
/** One durable, unresolved approval request projected from an external Host journal. */
export interface ExternalPendingApproval {
    readonly approvalId: string;
    readonly title: string;
    readonly detail: string;
    readonly choices: readonly ExternalApprovalDecision[];
    /** Gateway archive sequence used only for stable source ordering/deduplication. */
    readonly remoteSequence: number;
}
/** Current unresolved external approvals for one retained Host Session binding. */
export interface ExternalApprovalSnapshot {
    readonly pending: readonly ExternalPendingApproval[];
}
/** Observable approval source scoped to one exact external Session generation. */
export type ExternalApprovalSource = ObservableSnapshot<ExternalApprovalSnapshot>;
/** One exact Gateway event envelope retained without inventing a native Session sequence. */
export interface ExternalGatewayEvent {
    readonly remoteSequence: number;
    readonly event: JsonValue;
}
/** Raw Gateway event envelopes for diagnostics and future native projection. */
export interface ExternalGatewayEventSnapshot {
    readonly events: readonly ExternalGatewayEvent[];
}
/** Observable raw Gateway archive source scoped to one external Session binding. */
export type ExternalGatewayEventSource = ObservableSnapshot<ExternalGatewayEventSnapshot>;
/** A Host-scoped approval response; never carries local remember/approve-all policy. */
export interface ExternalApprovalResponseRequest {
    readonly address: ExternalSessionAddress;
    readonly approvalId: string;
    readonly decision: ExternalApprovalDecision;
    readonly signal: AbortSignal;
}
/** Host-qualified address for opening an existing external Session. */
export interface ExternalSessionAddress {
    readonly kind: 'external-session';
    readonly backendId: ExternalBackendId;
    readonly hostId: ExternalHostId;
    readonly workspaceId: ExternalWorkspaceId;
    readonly sessionId: ExternalSessionId;
}
/** Host-qualified address for creating a Session without supplying a local `cwd`. */
export interface ExternalWorkspaceAddress {
    readonly kind: 'external-workspace';
    readonly backendId: ExternalBackendId;
    readonly hostId: ExternalHostId;
    readonly workspaceId: ExternalWorkspaceId;
}
/** User-selected settings forwarded to the remote Host when creating a Session. */
export interface ExternalSessionCreateOptions {
    readonly provider?: string;
    readonly model?: string;
    readonly agentPreset?: string;
}
/** Catalog rows exposed to native Client navigation. */
export interface ExternalBackendCatalogView {
    readonly backendId: ExternalBackendId;
    readonly hostId: ExternalHostId;
    readonly hostName: string;
    readonly profileName: string;
    readonly generation: ExternalBackendGeneration;
    readonly status: 'connected' | 'offline';
    /** Provider-authored user-facing notice, such as an acknowledged create awaiting catalog reconciliation. */
    readonly warning?: string;
    /** Most recent catalog refresh failure; successful Session creation remains acknowledged independently. */
    readonly catalogError: string | null;
    readonly capabilities: ExternalSessionCapabilities;
    readonly workspaces: readonly ExternalWorkspaceSummary[];
}
/** Aggregate ordered by backend registration; each provider owns workspace and Session order. */
export interface ExternalSessionCatalogSnapshot {
    readonly backends: readonly ExternalBackendCatalogView[];
}
/** Exact external identity and capabilities attached to a native binding. */
export interface ExternalSessionBindingInfo {
    readonly address: ExternalSessionAddress;
    readonly backendId: ExternalBackendId;
    readonly hostId: ExternalHostId;
    readonly hostName: string;
    readonly profileName: string;
    readonly generation: ExternalBackendGeneration;
    readonly capabilities: ExternalSessionCapabilities;
}
/** External provider's current host-side catalog; offline providers retain their last rows. */
export interface ExternalSessionCatalog {
    readonly status: 'connected' | 'offline';
    /** Provider-authored user-facing notice; do not place raw protocol data or secrets here. */
    readonly warning?: string;
    readonly workspaces: readonly ExternalWorkspaceCatalogEntry[];
}
/** Arguments for opening one remote Session as a namespaced Client identity. */
export interface ExternalSessionOpenRequest {
    readonly address: ExternalSessionAddress;
    /** Client-owned namespaced identity the returned SessionFace must expose. */
    readonly sessionId: SessionIdType;
    /** Connection generation registered with this backend. */
    readonly generation: ExternalBackendGeneration;
    /** Aborted when the exact Client reference or backend generation retires. */
    readonly signal: AbortSignal;
}
/** Synchronously available native Session face and journal source with asynchronous opening. */
export interface ExternalSessionOpenHandle {
    readonly session: SessionFace;
    readonly eventSource: SessionEventSource;
    /** Pending approvals reconstructed from the Host approval archive, independent of native SessionEvent projection. */
    readonly approvals: ExternalApprovalSource;
    /** Raw gateway envelopes for events that do not map to native Session events. */
    readonly gatewayEvents: ExternalGatewayEventSource;
    /** Settles after initial remote read/follow is ready; rejection is exposed by `SessionReference.ready`. */
    readonly ready: Promise<void>;
    /** Stop this exact remote event source and release its provider resources. */
    dispose(): void | Promise<void>;
}
/** Create request sent through a registered external backend. */
export interface ExternalSessionCreateRequest {
    readonly address: ExternalWorkspaceAddress;
    readonly options: ExternalSessionCreateOptions;
    readonly signal: AbortSignal;
}
/** Session face supplied by a remote backend. */
export interface ExternalSessionBackend {
    readonly backendId: ExternalBackendId;
    readonly hostId: ExternalHostId;
    readonly hostName: string;
    readonly profileName: string;
    readonly generation: ExternalBackendGeneration;
    readonly capabilities: ExternalSessionCapabilities;
    readonly catalog: ObservableSnapshot<ExternalSessionCatalog>;
    /** Refresh this Host's real workspace/session catalog. */
    refresh(): Promise<void>;
    /** Create a Host-owned session in an identified remote workspace. */
    createSession(request: ExternalSessionCreateRequest): Promise<ExternalSessionId>;
    /** Open the remote journal as a native Client Session without creating a local Session or Agent. */
    openSession(request: ExternalSessionOpenRequest): ExternalSessionOpenHandle;
    /** Answer one exact Host approval request; implementations must not remember or broaden the decision. */
    respondApproval(request: ExternalApprovalResponseRequest): Promise<void>;
}
/** Client-only unknown remote event retained losslessly outside local Session persistence. */
export interface ExternalOpaqueSessionEvent {
    readonly type: 'external/opaque';
    readonly seq: SessionSeq;
    readonly time: number;
    readonly ignorable: true;
    readonly data: {
        readonly sourceType: string;
        readonly remoteSequence: number;
        readonly payload: JsonValue;
        readonly turn?: number;
        readonly step?: number;
    };
    readonly surfaceOp?: SurfaceOp;
    readonly sourceEventSeqs?: readonly SessionSeq[];
}
/**
 * Derive the stable Client id for one full remote Session address.
 * @param address - complete Host-qualified Session identity.
 * @returns the stable Client-namespaced Session id.
 */
export declare function externalSessionIdOf(address: ExternalSessionAddress): SessionIdType;
//# sourceMappingURL=external-sessions.d.ts.map