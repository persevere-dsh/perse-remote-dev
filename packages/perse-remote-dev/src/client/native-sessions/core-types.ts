/** Type aliases for the optional DSH 0.2.1 native-session extension. */

import type {
  ExternalApprovalDecision as DshExternalApprovalDecision,
  ExternalPendingApproval as DshExternalPendingApproval,
  ExternalSessionAddress as DshExternalSessionAddress,
  ExternalSessionBackend as DshExternalSessionBackend,
  ExternalSessionCapabilities as DshExternalSessionCapabilities,
  ExternalSessionCatalog as DshExternalSessionCatalog,
  ExternalSessionCatalogSnapshot as DshExternalSessionCatalogSnapshot,
  ExternalSessionCreateRequest as DshExternalSessionCreateRequest,
  ExternalSessionOpenHandle as DshExternalSessionOpenHandle,
  ExternalSessionOpenRequest as DshExternalSessionOpenRequest,
  ExternalGatewayEvent as DshExternalGatewayEvent,
  ExternalWorkspaceAddress as DshExternalWorkspaceAddress,
  ExternalWorkspaceCatalogEntry as DshExternalWorkspaceCatalogEntry,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { RemoteFailure, RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  BeginSubmissionInput,
  PendingSubmission,
  PendingSubmissionAttachment,
  PendingSubmissionRetirement,
  SessionSnapshot,
  SessionFace,
  SubmissionHandle,
} from '@deepseek-ai/dsh-api-session-controller/client'

export interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

export type ExternalBackendId = import('@deepseek-ai/dsh-api-session-controller/client').ExternalBackendId
export type ExternalHostId = import('@deepseek-ai/dsh-api-session-controller/client').ExternalHostId
export type ExternalSessionBindingInfo = import('@deepseek-ai/dsh-api-session-controller/client').ExternalSessionBindingInfo
export type ExternalSessionAddress = DshExternalSessionAddress
export type ExternalWorkspaceAddress = DshExternalWorkspaceAddress
export type ExternalSessionCapabilities = DshExternalSessionCapabilities
export type ExternalSessionSummary = import('@deepseek-ai/dsh-api-session-controller/client').ExternalSessionSummary
export type ExternalWorkspaceSummary = DshExternalWorkspaceCatalogEntry
export type ExternalSessionCatalog = DshExternalSessionCatalog
export type ExternalSessionCatalogSnapshot = DshExternalSessionCatalogSnapshot
export type ExternalSessionCreateRequest = DshExternalSessionCreateRequest
export type ExternalSessionOpenRequest = DshExternalSessionOpenRequest
export type ExternalSessionOpenHandle = DshExternalSessionOpenHandle
export type ExternalApprovalDecision = DshExternalApprovalDecision
export type ExternalPendingApproval = DshExternalPendingApproval
export type NativeSessionSnapshot = SessionSnapshot
export type NativeSessionFace = SessionFace
export type NativeRemoteFailure = RemoteFailure
export type NativeRemoteResult<T> = RemoteResult<T>
export type ExternalSessionBackend = DshExternalSessionBackend
export type ExternalSessionsRegistry = import('@deepseek-ai/dsh-api-session-controller/client').ISessions
export type ExternalGatewayEvent = DshExternalGatewayEvent
export type { BeginSubmissionInput, PendingSubmission, PendingSubmissionAttachment, PendingSubmissionRetirement, SubmissionHandle }
