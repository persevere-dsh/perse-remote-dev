/** Stores only hashes and idempotency keys for prompts with uncertain outcomes. */

export interface SubmissionReceipt {
  readonly kind: 'prompt'
  readonly profileId: string
  readonly hostId: string
  readonly workspaceId: string
  readonly sessionId: string
  readonly clientMessageId: string
  readonly fingerprint: string
}

export interface CreationReceipt {
  readonly kind: 'create'
  readonly profileId: string
  readonly hostId: string
  readonly workspaceId: string
  readonly operationId: string
  readonly startedAt: number
}

export type PcPendingReceipt = SubmissionReceipt | CreationReceipt

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORAGE_KEY = 'perse-remote-dev.native-submission-receipts.v1'
const MAX_RECEIPTS = 256
const MAX_STORAGE_BYTES = 128 * 1024

export class SubmissionReceiptStore {
  private readonly activeCreationOperations = new Set<string>()

  constructor(private readonly storage: KeyValueStorage | undefined = browserStorage()) {}

  list(): readonly PcPendingReceipt[] {
    if (this.storage === undefined) return []
    const raw = this.storage.getItem(STORAGE_KEY)
    if (raw === null) return []
    if (raw.length > MAX_STORAGE_BYTES) {
      throw new Error('Saved remote mutation receipts exceed the safety limit; inspect the remote session list before sending more work.')
    }
    try {
      const value: unknown = JSON.parse(raw)
      if (!Array.isArray(value) || value.length > MAX_RECEIPTS || value.some(item => !isReceipt(item))) {
        throw new Error('Saved remote mutation receipts are invalid; inspect the remote session list before sending more work.')
      }
      return value
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Saved remote mutation receipts')) throw error
      throw new Error('Saved remote mutation receipts could not be read; inspect the remote session list before sending more work.')
    }
  }

  save(receipt: SubmissionReceipt): void {
    if (this.storage === undefined) throw new Error('Persistent browser storage is unavailable for safe remote prompt delivery.')
    const remaining = this.list().filter(item => item.kind !== 'prompt' || !sameSession(item, receipt))
    const next = [...remaining, receipt]
    if (next.length > MAX_RECEIPTS) throw new Error('Too many unresolved remote prompt receipts; reconnect and resolve an earlier prompt first.')
    const encoded = JSON.stringify(next)
    if (encoded.length > MAX_STORAGE_BYTES) throw new Error('Remote prompt receipt storage reached its safety limit.')
    this.storage.setItem(STORAGE_KEY, encoded)
  }

  clear(receipt: SubmissionReceipt): void {
    if (this.storage === undefined) return
    const next = this.list().filter(item => item.kind !== 'prompt' || !sameAttempt(item, receipt))
    if (next.length === 0) this.storage.removeItem(STORAGE_KEY)
    else this.storage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  uncertainFor(receipt: Pick<SubmissionReceipt, 'profileId' | 'hostId' | 'workspaceId' | 'sessionId'>): SubmissionReceipt | undefined {
    return this.list().find((item): item is SubmissionReceipt => item.kind === 'prompt' && sameSession(item, receipt))
  }

  saveCreation(receipt: CreationReceipt): void {
    if (this.storage === undefined) throw new Error('Persistent browser storage is unavailable for safe remote session creation.')
    const next = [...this.list().filter(item => item.kind !== 'create' || item.operationId !== receipt.operationId), receipt]
    if (next.length > MAX_RECEIPTS) throw new Error('Too many unresolved remote creation receipts; check the remote session list first.')
    const encoded = JSON.stringify(next)
    if (encoded.length > MAX_STORAGE_BYTES) throw new Error('Remote creation receipt storage reached its safety limit.')
    this.storage.setItem(STORAGE_KEY, encoded)
  }

  clearCreation(operationId: string): void {
    this.activeCreationOperations.delete(operationId)
    if (this.storage === undefined) return
    const next = this.list().filter(item => item.kind !== 'create' || item.operationId !== operationId)
    if (next.length === 0) this.storage.removeItem(STORAGE_KEY)
    else this.storage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  creationReceipts(profileId?: string): readonly CreationReceipt[] {
    return this.list().filter((item): item is CreationReceipt => item.kind === 'create'
      && !this.activeCreationOperations.has(item.operationId)
      && (profileId === undefined || item.profileId === profileId))
  }

  setCreationInFlight(operationId: string, active: boolean): void {
    if (active) this.activeCreationOperations.add(operationId)
    else this.activeCreationOperations.delete(operationId)
  }
}

export const pcSubmissionReceipts = new SubmissionReceiptStore()

export type PreparedSubmissionReceipt =
  | { readonly ok: true; readonly receipt: SubmissionReceipt; readonly reused: boolean }
  | { readonly ok: false; readonly reason: 'different-uncertain-payload' | 'fingerprint-unavailable' | 'storage-unavailable'; readonly message: string }

export async function prepareSubmissionReceipt(
  store: SubmissionReceiptStore,
  identity: Omit<SubmissionReceipt, 'kind' | 'clientMessageId' | 'fingerprint'>,
  requestedMessageId: string,
  payloadFingerprintSource: string,
): Promise<PreparedSubmissionReceipt> {
  let fingerprint: string
  try { fingerprint = await promptFingerprint(payloadFingerprintSource) } catch {
    return { ok: false, reason: 'fingerprint-unavailable', message: 'Secure prompt fingerprinting is unavailable.' }
  }
  let previous: SubmissionReceipt | undefined
  try { previous = store.uncertainFor(identity) } catch {
    return { ok: false, reason: 'storage-unavailable', message: 'Saved remote mutation receipts cannot be read safely.' }
  }
  if (previous !== undefined && previous.fingerprint !== fingerprint) {
    return { ok: false, reason: 'different-uncertain-payload', message: 'A prior remote prompt has an unknown result.' }
  }
  const receipt: SubmissionReceipt = {
    kind: 'prompt',
    ...identity,
    clientMessageId: previous?.clientMessageId ?? requestedMessageId,
    fingerprint,
  }
  try { store.save(receipt) } catch {
    return { ok: false, reason: 'storage-unavailable', message: 'A persistent idempotency receipt could not be saved.' }
  }
  return { ok: true, receipt, reused: previous !== undefined }
}

export async function promptFingerprint(payload: string): Promise<string> {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.subtle === undefined) throw new Error('Secure prompt fingerprinting is unavailable in this browser.')
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

function browserStorage(): KeyValueStorage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

function isReceipt(value: unknown): value is SubmissionReceipt {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record.kind === 'create') return ['profileId', 'hostId', 'workspaceId', 'operationId']
    .every(key => typeof record[key] === 'string' && record[key].length > 0 && record[key].length <= 512)
    && typeof record.startedAt === 'number' && Number.isFinite(record.startedAt)
  if (record.kind !== 'prompt') return false
  return ['profileId', 'hostId', 'workspaceId', 'sessionId', 'clientMessageId', 'fingerprint']
    .every(key => typeof record[key] === 'string' && record[key].length > 0 && record[key].length <= 512)
}

function sameSession(left: SubmissionReceipt, right: Pick<SubmissionReceipt, 'profileId' | 'hostId' | 'workspaceId' | 'sessionId'>): boolean {
  return left.profileId === right.profileId && left.hostId === right.hostId
    && left.workspaceId === right.workspaceId && left.sessionId === right.sessionId
}

function sameAttempt(left: SubmissionReceipt, right: SubmissionReceipt): boolean {
  return sameSession(left, right) && left.clientMessageId === right.clientMessageId
}
