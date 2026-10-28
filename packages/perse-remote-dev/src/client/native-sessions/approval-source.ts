/** Binding-scoped actionable approvals reconstructed from Perse 1.2 journal records. */

export interface PcPendingApproval {
  readonly approvalId: string
  readonly title: string
  readonly detail: string
  readonly choices: readonly ('allowOnce' | 'deny')[]
  readonly remoteSequence: number
}

export interface PcApprovalSnapshot {
  readonly pending: readonly PcPendingApproval[]
  readonly revision: number
}

export class PcApprovalSource {
  private readonly listeners = new Set<() => void>()
  private snapshot: PcApprovalSnapshot = { pending: [], revision: 0 }

  getSnapshot = (): PcApprovalSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  upsert(approval: PcPendingApproval): void {
    const previous = this.snapshot.pending.filter(item => item.approvalId !== approval.approvalId)
    this.publish([...previous, approval])
  }

  resolve(approvalId: string): void {
    const pending = this.snapshot.pending.filter(item => item.approvalId !== approvalId)
    if (pending.length !== this.snapshot.pending.length) this.publish(pending)
  }

  replaceAll(pending: readonly PcPendingApproval[]): void {
    this.publish([...pending])
  }

  dispose(): void { this.listeners.clear() }

  private publish(pending: readonly PcPendingApproval[]): void {
    this.snapshot = { pending, revision: this.snapshot.revision + 1 }
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* isolate UI subscribers from gateway event processing */ }
    }
  }
}
