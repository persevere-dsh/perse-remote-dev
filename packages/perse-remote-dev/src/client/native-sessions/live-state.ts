import type { PcRemoteSession } from './protocol.ts'

export interface NativeSessionRuntimeState {
  readonly running: boolean
  readonly blank: boolean
  readonly awaitingFirstTurn: boolean
}

export interface LiveSessionReadState {
  readonly state: NativeSessionRuntimeState
  readonly shouldPublish: boolean
}

/** Reconcile one live read delta with the authoritative Gateway session status. */
export function reconcileLiveSessionRead(
  previous: NativeSessionRuntimeState,
  remoteStatus: PcRemoteSession['status'],
  sourceTypes: readonly string[],
  hasEvents: boolean,
): LiveSessionReadState {
  let blank = previous.blank
  let awaitingFirstTurn = previous.awaitingFirstTurn
  for (const sourceType of sourceTypes) {
    if (sourceType === 'turn/start') {
      blank = false
      awaitingFirstTurn = false
    } else if (sourceType === 'user/message' || sourceType === 'assistant/message') {
      blank = false
    }
  }
  const running = remoteStatus === 'running' || remoteStatus === 'waitingApproval'
  return {
    state: { running, blank, awaitingFirstTurn },
    shouldPublish: hasEvents || running !== previous.running
      || blank !== previous.blank || awaitingFirstTurn !== previous.awaitingFirstTurn,
  }
}
