/**
 * Settings seam for the host face.
 *
 * Native DSH profile Config owned by the stable `perse-remote-dev` Loader entry
 * is the persisted source of truth. DSH SettingsForms edits the volatile fields
 * through its native settings API. The historical `remote-dev` section in
 * settings.yaml is read only by the explicit legacy-import flow. The schema is
 * a real schemastery schema, while the Typert artifact pipeline keeps zod v4.
 *
 * `resolveEnginePath` has no silently-undefined default: an unset `enginePath`
 * falls back to the engine bundled in `engine/`.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import type { Volatile } from '@deepseek-ai/cordis'
import type { RemoteWorkspaceHostSetting } from './types.ts'

/** Stable Loader entry id and owner of the native profile Config. */
export const CONFIG_ENTRY_ID = 'perse-remote-dev'

/** Historical settings.yaml section name; used only by explicit migration. */
export const LEGACY_SETTINGS_NS = 'remote-dev'

/** Actionable hint shown whenever the target chain is incomplete. */
export const MISSING_HINT = '请在 DSH「设置 › 远程开发」中配置目标（主机 / 项目路径）。旧配置请使用该页面的“导入旧配置”进行预览和显式导入。'

/** Separate hint for the review loop, which additionally needs a hub repository. */
export const REVIEW_HUB_HINT = '审查回路需要「汇总仓库」：请在 DSH「设置 › 远程开发」中配置 hub。旧配置请通过“导入旧配置”预览并显式导入。'

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
  /** Legacy rows; preserved by explicit import and folded into hosts on read. */
  readonly targets?: readonly RemoteWorkspaceLegacyTarget[]
  readonly workspace?: string
  /** Batch directory (M) used by the review loop. */
  readonly mDir?: string
  readonly hub?: string
}

/** The live Cordis Config fields passed to the plugin service. */
export interface RemoteWorkspaceSettingsConfig {
  readonly enginePath: Volatile<string>
  readonly hosts: Volatile<RemoteWorkspaceHostSetting[]>
  readonly targets: Volatile<RemoteWorkspaceLegacyTarget[]>
  readonly workspace: Volatile<string>
  readonly mDir: Volatile<string>
  readonly hub: Volatile<string>
}

function hostSettingSchema() {
  return z.object({
    id: z.string().default(''),
    name: z.string().default(''),
    address: z.string().default(''),
    port: z.string().default(''),
    username: z.string().default(''),
    auth: z.string().default('agent'),
    keyPath: z.string().default(''),
    passwordRef: z.string().default(''),
    fromAlias: z.string().default(''),
    projectPath: z.string().default(''),
    remotePort: z.string().default('3080'),
    projects: z.array(z.string()).default([]),
  })
}

/**
 * The real Cordis Config schema for the stable {@link CONFIG_ENTRY_ID} entry.
 * Fields stay volatile so native SettingsForms can import/edit them.
 */
export const RemoteWorkspaceSettingsSchema = z.object({
  enginePath: z.string().default('').volatile(),
  hosts: z.array(hostSettingSchema()).default([]).volatile(),
  targets: z.array(z.object({
    name: z.string().default(''),
    host: z.string().default(''),
    workspace: z.string().default(''),
    hub: z.string().default(''),
    verifyCmd: z.string().default(''),
  })).default([]).volatile(),
  workspace: z.string().default('').volatile(),
  mDir: z.string().default('').volatile(),
  hub: z.string().default('').volatile(),
})

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
