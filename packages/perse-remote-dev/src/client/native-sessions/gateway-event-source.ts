/** Lossless gateway-only journal records, kept separate from native Session seq. */

import type { ExternalGatewayEvent } from './core-types.ts'

export type GatewayEventRecord = ExternalGatewayEvent

export interface GatewayEventSnapshot {
  readonly events: readonly GatewayEventRecord[]
  readonly revision: number
}

export class PcGatewayEventSource {
  private readonly listeners = new Set<() => void>()
  private snapshot: GatewayEventSnapshot = { events: [], revision: 0 }

  getSnapshot = (): GatewayEventSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  append(record: GatewayEventRecord): void {
    this.snapshot = { events: [...this.snapshot.events, record], revision: this.snapshot.revision + 1 }
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* isolate UI subscribers from gateway event processing */ }
    }
  }

  replaceAll(events: readonly GatewayEventRecord[]): void {
    this.snapshot = { events: [...events], revision: this.snapshot.revision + 1 }
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* isolate UI subscribers from gateway event processing */ }
    }
  }

  dispose(): void { this.listeners.clear() }
}
