/** Private local storage for PC device grants. Credentials never cross the owner Remote. */

import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { z } from 'zod'
import type { PcProfileView } from '../types.ts'

const profileSchema = z.object({
  profileId: z.string().uuid(),
  endpoint: z.string().min(1).max(2048),
  networkMode: z.enum(['https', 'tailnet', 'local']),
  hostId: z.string().min(1).max(256),
  hostName: z.string().min(1).max(256),
  deviceId: z.string().min(1).max(256),
  deviceName: z.string().min(1).max(100),
  token: z.string().min(32).max(4096),
  status: z.enum(['disconnected', 'connected', 'offline', 'revoked']),
  /**
   * Persisted connection intent (docs/pc-contract.md: Connection intent, transport
   * loss, and reconnect). Optional on disk: a file written before this field
   * existed derives its intent from the stored status at read time.
   */
  desiredState: z.enum(['connected', 'disconnected']).optional(),
  protocolVersion: z.string().max(32).optional(),
  verifiedAt: z.string().datetime().optional(),
}).strict()

export type PcStoredProfile = z.infer<typeof profileSchema>

/**
 * The stored intent of a profile. A legacy document has no `desiredState`, so its
 * intent is read from the stored status: a profile recorded as live was wanted
 * connected, and one recorded as `offline` or `disconnected` was left offline by
 * its user and must not start reconnecting. Read-time derivation only — loading
 * never rewrites the store; the derived value lands with the next write.
 */
export function pcDesiredStateOf(profile: PcStoredProfile): 'connected' | 'disconnected' {
  return profile.desiredState ?? (profile.status === 'connected' ? 'connected' : 'disconnected')
}

const documentSchema = z.object({ version: z.literal(1), profiles: z.array(profileSchema).max(1000) }).strict()
const PROFILE_FILE_MAX_BYTES = 8 * 1024 * 1024

/** Owns a private, symlink-free profile directory. */
export class PcProfileStore {
  readonly directory: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(home = defaultDshHome()) {
    if (!isAbsolute(home)) throw new Error('DSH_HOME must be an absolute path')
    this.directory = join(resolve(home), 'remote-dev', 'pc-profiles')
  }

  async list(): Promise<PcStoredProfile[]> {
    const document = await this.load()
    return document.profiles
  }

  async get(profileId: string): Promise<PcStoredProfile | undefined> {
    return (await this.list()).find((p) => p.profileId === profileId)
  }

  async put(profile: PcStoredProfile): Promise<void> {
    await this.serialize(async () => {
      const parsed = profileSchema.parse(profile)
      const current = await this.load()
      const profiles = current.profiles.filter((p) => p.profileId !== parsed.profileId)
      profiles.push(parsed)
      await this.save({ version: 1, profiles })
    })
  }

  async update(profileId: string, transform: (profile: PcStoredProfile) => PcStoredProfile): Promise<PcStoredProfile> {
    return this.serialize(async () => {
      const current = await this.load()
      const index = current.profiles.findIndex((p) => p.profileId === profileId)
      if (index < 0) throw new Error('profile not found')
      const next = profileSchema.parse(transform(current.profiles[index]!))
      const profiles = [...current.profiles]
      profiles[index] = next
      await this.save({ version: 1, profiles })
      return next
    })
  }

  async remove(profileId: string): Promise<void> {
    await this.serialize(async () => {
      const current = await this.load()
      await this.save({ version: 1, profiles: current.profiles.filter((p) => p.profileId !== profileId) })
    })
  }

  /**
   * The browser-facing view. It carries neither the token nor the stored intent:
   * intent reaches the UI only as the derived `autoConnect` eligibility marker.
   */
  view(profile: PcStoredProfile, status: PcProfileView['status']): PcProfileView {
    const { token: _secret, desiredState: _intent, protocolVersion, verifiedAt, ...safe } = profile
    return {
      ...safe,
      status,
      ...(protocolVersion === undefined ? {} : { protocolVersion }),
      ...(verifiedAt === undefined ? {} : { verifiedAt }),
    }
  }

  private async initialize(): Promise<void> {
    const home = resolve(dirname(dirname(this.directory)))
    await assertNoSymlinkPath(home)
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    await assertNoSymlinkPath(this.directory)
    const stat = await lstat(this.directory)
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) throw new Error('PC profile directory must be a private 0700 directory')
    if ((stat.mode & 0o777) !== 0o700) await chmod(this.directory, 0o700)
  }

  private async load(): Promise<{ version: 1; profiles: PcStoredProfile[] }> {
    await this.initialize()
    const file = join(this.directory, 'profiles.json')
    try {
      const stat = await lstat(file)
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('profile file must be a regular file')
      if ((stat.mode & 0o077) !== 0) throw new Error('profile file permissions must be 0600')
      if ((stat.mode & 0o777) !== 0o600) await chmod(file, 0o600)
      if (stat.size > PROFILE_FILE_MAX_BYTES) throw new Error('profile file exceeds the 8 MiB limit')
      const parsed = documentSchema.parse(JSON.parse(await readFile(file, 'utf8')))
      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, profiles: [] }
      // One structured line naming the file and the failure class, so a stored
      // profile list that never loads is never a silent black box. Never a token.
      console.error(`[perse-remote-dev] pc-profile-store load failed file=${file} class=${errorName(error)} reason=${redactReason(error)}`)
      throw error
    }
  }

  private async save(document: { version: 1; profiles: PcStoredProfile[] }): Promise<void> {
    await this.initialize()
    const file = join(this.directory, 'profiles.json')
    try {
      const stat = await lstat(file)
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('profile file must be a regular file')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const parsed = documentSchema.parse(document)
    const contents = JSON.stringify(parsed)
    if (Buffer.byteLength(contents, 'utf8') > PROFILE_FILE_MAX_BYTES) throw new Error('profile file exceeds the 8 MiB limit')
    const temp = join(this.directory, `.profiles-${randomUUID()}.tmp`)
    await writeFile(temp, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await chmod(temp, 0o600)
    await rename(temp, file)
    const stat = await lstat(file)
    if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error('profile file must be a private 0600 regular file')
  }

  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(operation)
    this.writeQueue = next.then(() => undefined, () => undefined)
    return next
  }
}

function defaultDshHome(): string {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured !== '' ? configured : join(homedir(), '.dsh')
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name !== '' ? error.name : typeof error
}

/** Failure reason safe for one log line: shape/class text only, credentials scrubbed. */
function redactReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : `non-error ${typeof error}`
  return raw
    .replace(/(?:secret|token|bearer)[=: ]+\S+/gi, '[redacted]')
    .replace(/[A-Za-z0-9_-]{40,}/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
}

async function assertNoSymlinkPath(path: string): Promise<void> {
  const absolute = resolve(path)
  const segments = absolute.split(sep).filter(Boolean)
  let cursor: string = sep
  for (const segment of segments) {
    cursor = join(cursor, segment)
    try {
      const stat = await lstat(cursor)
      if (stat.isSymbolicLink()) throw new Error(`storage path contains a symbolic link: ${cursor}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await mkdir(cursor, { mode: 0o700 })
        continue
      }
      throw error
    }
  }
  const actual = await realpath(absolute)
  if (actual !== absolute) throw new Error('storage path is not canonical')
}
