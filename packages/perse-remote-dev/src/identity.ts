/**
 * Path/name safety plus the host-issued identity proof.
 *
 * The former hand-written half relied on three client-side race guards to keep a
 * path listed on host A from being committed against host B (a real incident is
 * recorded in `UX-PATH-AND-TESTCASES.v1.md:90`). Typed Remote removes those
 * guards on purpose: the host, not the browser, must refuse the mismatched pair.
 *
 * Mechanism: whenever *this* instance produces a path for a host (a directory
 * listing, a created directory, a resolved review bundle) it mints an HMAC over
 * the exact identity fields with a per-instance random secret. Mutating verbs
 * recompute the HMAC from the identity they were handed. A token minted for
 * (`host-a`, `/Users/x`) therefore never validates for (`host-b`, `/Users/x`),
 * and the failure is `remote-dev/location-mismatch`.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Mints and verifies identity proofs for one plugin instance. */
export class IdentitySigner {
  private readonly secret: Uint8Array = randomBytes(32)

  /**
   * Mint a proof over one identity vector.
   * @param kind - proof domain (`location`, `review-target`).
   * @param fields - identity fields, order-significant.
   * @returns base64url HMAC-SHA256.
   */
  sign(kind: string, fields: readonly string[]): string {
    return createHmac('sha256', this.secret)
      .update(JSON.stringify([kind, ...fields]))
      .digest('base64url')
  }

  /**
   * Verify a proof against one identity vector.
   * @param token - proof presented by the caller.
   * @param kind - proof domain.
   * @param fields - identity fields, order-significant.
   */
  verify(token: string, kind: string, fields: readonly string[]): boolean {
    if (typeof token !== 'string' || token === '') return false
    const expected = Buffer.from(this.sign(kind, fields), 'utf8')
    const actual = Buffer.from(token, 'utf8')
    if (expected.length !== actual.length) return false
    return timingSafeEqual(expected, actual)
  }
}

/** Identity fields a location proof covers. */
export function locationFields(hostId: string, path: string): string[] {
  return [hostId, path]
}

/** Identity fields a review-bundle proof covers: all three repositories plus the host. */
export function reviewFields(target: {
  readonly hostId: string
  readonly projectPath: string
  readonly mDir: string
  readonly hub: string
  readonly verifyCmd: string
}): string[] {
  return [target.hostId, target.projectPath, target.mDir, target.hub, target.verifyCmd]
}

/**
 * Assert one absolute, carrier-safe path.
 * @param p - candidate path.
 * @returns the same path.
 */
export function assertSafePath(p: string): string {
  if (typeof p !== 'string' || p === '') throw new InvalidPathError('path 为空')
  if (!p.startsWith('/')) throw new InvalidPathError('path 必须是绝对路径')
  if (/[\n\r\0]/.test(p)) throw new InvalidPathError('path 含非法字符')
  return p
}

/**
 * Assert one single path segment usable as a new directory name.
 * @param n - candidate name.
 * @returns the same name.
 */
export function assertSafeName(n: string): string {
  if (typeof n !== 'string' || n === '' || n.trim() !== n) throw new InvalidNameError('name 为空或含首尾空白')
  if (n === '.' || n === '..' || /[/\n\r\0]/.test(n)) throw new InvalidNameError('name 非法')
  return n
}

/** Local validation failure for a path; the service maps it to a RemoteError code. */
export class InvalidPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPathError'
  }
}

/** Local validation failure for a directory name; the service maps it to a RemoteError code. */
export class InvalidNameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidNameError'
  }
}

/**
 * Parent directory in the same coordinates as `p`.
 * @param p - absolute POSIX path.
 * @returns the parent path, or `null` at the filesystem root.
 */
export function parentOf(p: string): string | null {
  if (p === '/') return null
  const i = p.lastIndexOf('/')
  return i <= 0 ? '/' : p.slice(0, i)
}

/**
 * Join one segment onto a POSIX path without assuming the caller's platform.
 * @param dir - absolute directory.
 * @param name - single segment.
 */
export function joinPosix(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}
