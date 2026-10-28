/** Tracks one native optimistic echo per remote idempotency key across retries. */

import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'

export class SubmissionEchoLedger {
  private readonly localByRemoteId = new Map<string, SessionRequestId>()

  bind(remoteMessageId: string, localRequestId: SessionRequestId): SessionRequestId | undefined {
    const existing = this.localByRemoteId.get(remoteMessageId)
    if (existing !== undefined) return existing === localRequestId ? undefined : localRequestId
    this.localByRemoteId.set(remoteMessageId, localRequestId)
    return undefined
  }

  take(remoteMessageId: string, fallback: SessionRequestId): SessionRequestId {
    const localRequestId = this.localByRemoteId.get(remoteMessageId) ?? fallback
    this.localByRemoteId.delete(remoteMessageId)
    return localRequestId
  }
}
