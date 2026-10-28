/** Minimal event-source contract used only when CI has no private native runtime checkout. */
export class MutableSessionEventSource {
  entries = []
  getSnapshot = () => ({ entries: this.entries, revision: this.revision })
  revision = 0
  replace(entries) { this.entries = [...entries]; this.revision += 1 }
  append(entry) { this.entries = [...this.entries, entry]; this.revision += 1 }
  settleAssistant(_attemptId, entry) { this.append(entry) }
}
