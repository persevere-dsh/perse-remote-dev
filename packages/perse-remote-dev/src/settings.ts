/**
 * Settings seam for the host face.
 *
 * The persisted truth stays the `remote-dev` namespace of `$DSH_HOME/settings.yaml`,
 * registered through the `ctx.inject(['settings'], …)` +
 * `scope.register(ns, schema)` + effect-disposal pattern. The seam takes a real
 * schemastery schema instance, exactly like every official consumer, while the
 * Typert artifact pipeline keeps zod v4.
 *
 * `resolveEnginePath` has no silently-undefined default: an unset `enginePath`
 * falls back to the engine bundled in `engine/`.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import type { RemoteWorkspaceHostSetting } from './types.ts'

/** Settings namespace this plugin owns. */
export const SETTINGS_NS = 'remote-dev'

/** Actionable hint shown whenever the target chain is incomplete. */
export const MISSING_HINT = '请在「设置 › 远程开发」中配置目标（主机 / 项目路径），或直接编辑 ~/.dsh/settings.yaml 的 remote-dev 段。'

/** Separate hint for the review loop, which additionally needs a hub repository. */
export const REVIEW_HUB_HINT = '审查回路需要「汇总仓库」：请在设置 › 远程开发 里配置 hub（写入 ~/.dsh/settings.yaml 的 remote-dev.hub，或旧结构 remote-dev.targets[0].hub）。'

/** The legacy `targets[]` row shape, read only for migration. */
export interface RemoteWorkspaceLegacyTarget {
  readonly name: string
  readonly host: string
  readonly workspace: string
  readonly hub: string
  readonly verifyCmd: string
}

/** The `remote-dev` settings document. */
export interface RemoteWorkspaceSettingsDocument {
  /** Absolute path to `rd-core/rd-sync.sh`; when unset the service falls back to the engine bundled in `engine/`. */
  readonly enginePath?: string
  readonly hosts?: readonly RemoteWorkspaceHostSetting[]
  /** Legacy rows; migrated on read, never written by the UI. */
  readonly targets?: readonly RemoteWorkspaceLegacyTarget[]
  readonly workspace?: string
  /** Batch directory (M) used by the review loop. */
  readonly mDir?: string
  readonly hub?: string
}

/** Minimal structural view of one registered settings namespace. */
export interface SettingsScope {
  get(): RemoteWorkspaceSettingsDocument
  update(patch: object): Promise<void>
}

/** One schema value as the settings seam consumes it. */
export interface SettingsSchema<T> {
  (value: unknown): T
  toJSON(): unknown
}

function hostSettingSchema(): unknown {
  return z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    port: z.string(),
    username: z.string(),
    auth: z.string(),
    keyPath: z.string(),
    passwordRef: z.string(),
    fromAlias: z.string(),
    projectPath: z.string(),
    remotePort: z.string(),
    projects: z.array(z.string()),
  })
}

/** The schemastery schema registered for {@link SETTINGS_NS}. */
export const RemoteWorkspaceSettingsSchema = z.object({
  enginePath: z.string(),
  hosts: z.array(hostSettingSchema() as never),
  targets: z.array(z.object({
    name: z.string(),
    host: z.string(),
    workspace: z.string(),
    hub: z.string(),
    verifyCmd: z.string(),
  })),
  workspace: z.string(),
  mDir: z.string(),
  hub: z.string(),
}) as unknown as SettingsSchema<RemoteWorkspaceSettingsDocument>

/**
 * Fold legacy `targets[]` rows into host records. The alias is the source of
 * truth; every other field is left for the user to complete.
 * @param targets - legacy rows.
 */
export function migrateTargetsToHosts(
  targets: readonly RemoteWorkspaceLegacyTarget[],
): RemoteWorkspaceHostSetting[] {
  const out: RemoteWorkspaceHostSetting[] = []
  for (const t of targets) {
    const id = String((t && t.host) || '').trim()
    if (id === '') continue
    out.push({
      id,
      name: (t && t.name) || id,
      address: '',
      port: '',
      username: '',
      auth: 'agent',
      keyPath: '',
      passwordRef: '',
      fromAlias: id,
      projectPath: (t && t.workspace) || '',
      remotePort: '3080',
      projects: [],
    })
  }
  return out
}

/** Harness home: `$DSH_HOME`, else `~/.dsh`. */
export function dshHome(): string {
  const fromEnv = process.env.DSH_HOME
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : join(homedir(), '.dsh')
}

/** Append-only decision ledger (approve / reject / rollback / verify failure). */
export function decisionsPath(): string {
  return join(dshHome(), 'remote-dev', 'decisions.jsonl')
}

/** Default remote DSH port used when a host record leaves it empty. */
export function remotePortOf(host: RemoteWorkspaceHostSetting): string {
  return /^[0-9]+$/.test(String(host.remotePort || '')) ? String(host.remotePort) : '3080'
}
