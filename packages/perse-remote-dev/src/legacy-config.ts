import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parse } from 'yaml'
import { isDeepStrictEqual } from 'node:util'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { LEGACY_SETTINGS_NS } from './settings.ts'

export type LegacyConfigSource = 'settings.yaml' | 'settings.yaml.imported'

export interface LegacyConfigDescriptor {
  readonly ns: string
  readonly revision: number
  readonly user?: unknown
}

export interface LegacyConfigPreview {
  readonly sources: readonly LegacyConfigSource[]
  readonly source?: LegacyConfigSource
  readonly sourcePath?: string
  readonly sha256?: string
  /** Field names only. Values, including host credentials, never leave this owner. */
  readonly importableFields: readonly string[]
  readonly conflictFields: readonly string[]
  readonly unsupportedFields: readonly string[]
  readonly canApply: boolean
}

export interface LegacyConfigApplyResult {
  readonly source: LegacyConfigSource
  readonly importedFields: readonly string[]
  readonly alreadyAppliedFields: readonly string[]
}

export interface LegacyConfigDocument {
  readonly source: LegacyConfigSource
  readonly sourcePath: string
  readonly sha256: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly unsupportedFields: readonly string[]
}

export interface LegacyConfigPlan {
  readonly preview: LegacyConfigPreview
  readonly revision: number
  readonly patch: Readonly<Record<string, unknown>>
  readonly alreadyAppliedFields: readonly string[]
}

const MAX_LEGACY_FILE_BYTES = 256 * 1024
const TOP_LEVEL_FIELDS = new Set(['enginePath', 'hosts', 'targets', 'workspace', 'mDir', 'hub'])
const HOST_FIELDS = new Set([
  'id', 'name', 'address', 'port', 'username', 'auth', 'keyPath', 'passwordRef',
  'fromAlias', 'projectPath', 'remotePort', 'projects',
])
const TARGET_FIELDS = new Set(['name', 'host', 'workspace', 'hub', 'verifyCmd'])

function migrationError(reason: string, details: Record<string, unknown> = {}): RemoteError {
  return new RemoteError('remote-dev/legacy-config-invalid', `旧配置无法安全导入：${reason}`, { reason, ...details })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value)) return Object.keys(value).length > 0
  return true
}

function allowedObjectFields(value: unknown, allowed: ReadonlySet<string>, at: string, unsupported: string[]): boolean {
  if (!isRecord(value)) throw migrationError(`${at} 必须是对象`)
  for (const key of Object.keys(value)) if (!allowed.has(key)) unsupported.push(`${at}.${key}`)
  return true
}

function validateLegacyFields(raw: unknown): { fields: Record<string, unknown>; unsupportedFields: string[] } {
  if (!isRecord(raw)) throw migrationError(`「${LEGACY_SETTINGS_NS}」必须是对象`)
  const fields: Record<string, unknown> = {}
  const unsupportedFields = Object.keys(raw).filter(key => !TOP_LEVEL_FIELDS.has(key))
  for (const [key, value] of Object.entries(raw)) {
    if (!TOP_LEVEL_FIELDS.has(key)) continue
    if (['enginePath', 'workspace', 'mDir', 'hub'].includes(key)) {
      if (typeof value !== 'string') throw migrationError(`${key} 必须是字符串`)
      fields[key] = value
      continue
    }
    if (key === 'hosts' || key === 'targets') {
      if (!Array.isArray(value)) throw migrationError(`${key} 必须是数组`)
      const rows = key === 'hosts' ? value.map((row, index) => {
        const at = `hosts[${index}]`
        allowedObjectFields(row, HOST_FIELDS, at, unsupportedFields)
        const record = row as Record<string, unknown>
        for (const [field, fieldValue] of Object.entries(record)) {
          if (field === 'projects') {
            if (!Array.isArray(fieldValue) || !fieldValue.every(item => typeof item === 'string')) throw migrationError(`${at}.projects 必须是字符串数组`)
          } else if (typeof fieldValue !== 'string') throw migrationError(`${at}.${field} 必须是字符串`)
        }
        return {
          id: '', name: '', address: '', port: '', username: '', auth: 'agent', keyPath: '', passwordRef: '',
          fromAlias: '', projectPath: '', remotePort: '3080', projects: [],
          ...structuredClone(record),
        }
      }) : value.map((row, index) => {
        const at = `targets[${index}]`
        allowedObjectFields(row, TARGET_FIELDS, at, unsupportedFields)
        const record = row as Record<string, unknown>
        for (const [field, fieldValue] of Object.entries(record)) {
          if (typeof fieldValue !== 'string') throw migrationError(`${at}.${field} 必须是字符串`)
        }
        return { name: '', host: '', workspace: '', hub: '', verifyCmd: '', ...structuredClone(record) }
      })
      fields[key] = rows
    }
  }
  return { fields, unsupportedFields }
}

/** Read only one of the two native Settings importer filenames beneath the active profile home. */
export async function readLegacyConfig(profileHome: string, source: LegacyConfigSource): Promise<LegacyConfigDocument> {
  if (source !== 'settings.yaml' && source !== 'settings.yaml.imported') throw migrationError('来源文件名无效')
  let home: string
  try { home = await realpath(profileHome) }
  catch (error) { throw migrationError('原生 profile 目录不可用', { reasonCode: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN' }) }
  const sourcePath = join(home, source)
  if (basename(sourcePath) !== source) throw migrationError('来源路径无效')
  let handle
  try {
    const metadata = await lstat(sourcePath)
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw migrationError('来源必须是普通文件')
    if (metadata.size > MAX_LEGACY_FILE_BYTES) throw migrationError('来源文件超过 256 KiB 限制')
    handle = await open(sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const opened = await handle.stat()
    if (!opened.isFile() || opened.size > MAX_LEGACY_FILE_BYTES) throw migrationError('来源文件类型或大小无效')
    const bytes = await handle.readFile()
    const raw = bytes.toString('utf8')
    let parsed: unknown
    try { parsed = parse(raw, { uniqueKeys: true }) }
    catch { throw migrationError('YAML 格式无效') }
    if (!isRecord(parsed) || !Object.hasOwn(parsed, LEGACY_SETTINGS_NS)) throw migrationError(`没有「${LEGACY_SETTINGS_NS}」段`)
    const validated = validateLegacyFields(parsed[LEGACY_SETTINGS_NS])
    return {
      source,
      sourcePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      fields: validated.fields,
      unsupportedFields: [...new Set(validated.unsupportedFields)].sort(),
    }
  } catch (error) {
    if (error instanceof RemoteError) throw error
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw migrationError(`找不到 ${source}`)
    if (code === 'ELOOP') throw migrationError('不接受符号链接来源')
    throw migrationError('无法读取来源文件', { reasonCode: code ?? 'UNKNOWN' })
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

export function previewLegacyConfig(
  document: LegacyConfigDocument,
  descriptors: readonly LegacyConfigDescriptor[],
): LegacyConfigPreview {
  const descriptor = descriptors.find(row => row.ns === 'perse-remote-dev')
  if (descriptor === undefined) throw migrationError('当前 profile 未启用远程开发配置项')
  const user = isRecord(descriptor.user) ? descriptor.user : {}
  const importableFields: string[] = []
  const conflictFields: string[] = []
  for (const [field, value] of Object.entries(document.fields)) {
    if (!hasValue(value)) continue
    importableFields.push(field)
    const existing = user[field]
    if (hasValue(existing) && !isDeepStrictEqual(existing, value)) conflictFields.push(field)
  }
  return {
    sources: [document.source],
    source: document.source,
    sourcePath: document.sourcePath,
    sha256: document.sha256,
    importableFields: importableFields.sort(),
    conflictFields: conflictFields.sort(),
    unsupportedFields: [...document.unsupportedFields],
    canApply: importableFields.length > 0 && conflictFields.length === 0 && document.unsupportedFields.length === 0,
  }
}

/** Build a non-destructive sparse patch against the current user profile layer. */
export function planLegacyConfig(
  document: LegacyConfigDocument,
  descriptors: readonly LegacyConfigDescriptor[],
): LegacyConfigPlan {
  const descriptor = descriptors.find(row => row.ns === 'perse-remote-dev')
  if (descriptor === undefined) throw migrationError('当前 profile 未启用远程开发配置项')
  const preview = previewLegacyConfig(document, descriptors)
  const user = isRecord(descriptor.user) ? descriptor.user : {}
  const patch: Record<string, unknown> = {}
  const alreadyAppliedFields: string[] = []
  for (const [field, value] of Object.entries(document.fields)) {
    if (!hasValue(value)) continue
    const existing = user[field]
    if (!hasValue(existing)) patch[field] = value
    else if (isDeepStrictEqual(existing, value)) alreadyAppliedFields.push(field)
  }
  return {
    preview,
    revision: descriptor.revision,
    patch,
    alreadyAppliedFields: alreadyAppliedFields.sort(),
  }
}

/** Determine the only candidates exposed by the native profile home. */
export async function legacyConfigSources(profileHome: string): Promise<readonly LegacyConfigSource[]> {
  let home: string
  try { home = await realpath(profileHome) } catch { throw migrationError('原生 profile 目录不可用') }
  const found: LegacyConfigSource[] = []
  for (const source of ['settings.yaml', 'settings.yaml.imported'] as const) {
    try {
      const info = await lstat(join(home, source))
      if (info.isSymbolicLink()) throw migrationError(`不接受 ${source} 符号链接`)
      if (!info.isFile()) throw migrationError(`${source} 不是普通文件`)
      if (info.size > MAX_LEGACY_FILE_BYTES) throw migrationError(`${source} 超过 256 KiB 限制`)
      found.push(source)
    } catch (error) {
      if (error instanceof RemoteError) throw error
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw migrationError(`无法检查 ${source}`)
    }
  }
  return found
}
