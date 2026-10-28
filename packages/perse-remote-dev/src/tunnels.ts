/**
 * Legacy tunnel metadata lifecycle.
 *
 * Token-bearing browser URLs have been retired. New PC connections use a local
 * owner-Remote bridge and the Perse Remote 1.2 bearer-authenticated websocket.
 * The legacy list/close Remote methods remain for compatibility, but a process
 * started with this version never creates or returns a token URL.
 */

import type { RemoteTunnelView } from './types.ts'

export class TunnelManager {
  /** No legacy tunnel is created by the retired URL-opening routes. */
  list(): RemoteTunnelView[] {
    return []
  }

  /** There are no current-process legacy tunnels after migration. */
  closeByHostId(_hostId: string): boolean {
    return false
  }

  dispose(): void {}
}
