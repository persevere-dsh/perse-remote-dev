/**
 * Browser-half components.
 *
 * Components never touch `ctx`: every read comes from a
 * hook projected by the registration's `inject` factory and every write goes
 * through an action on that same face. All markup is `React.createElement`
 * because the dynamic-package shape cannot import the design-system components.
 *
 * The `data-rws-*` attributes are the frozen public test contract; the extra
 * `data-testid` seats are additive and never replace them.
 */
import * as React from 'react'
import type {
  RemoteDirectoryEntry,
  RemoteDirectoryListing,
  RemoteHostView,
  RemoteOpenedProject,
  RemoteReviewApplyResult,
  RemoteReviewFile,
  RemoteTunnelClosedValue,
  RemoteTunnelView,
  RemoteWorkspaceHostSetting,
  RemoteWorkspaceLocation,
} from 'perse-remote-dev/types'
import type {
  ActiveHost,
  Cell,
  ConfigSnapshot,
  DiagnosticsSnapshot,
  Failure,
  HostFaceSnapshot,
  HostsSnapshot,
  Outcome,
  ReviewSnapshot,
  TunnelsSnapshot,
} from './model.ts'
import { LOCAL_VIEW, STATE_LABEL, blankHost } from './model.ts'

const h = React.createElement

/** Bind a model cell to a component-local snapshot state. */
export function useCell<T>(cell: Cell<T>): T {
  const [snapshot, setSnapshot] = React.useState<T>(cell.get)
  React.useEffect(() => cell.subscribe(() => setSnapshot(cell.get())), [cell])
  return snapshot
}

/** One coloured link-state dot. */
function Dot(state: string): unknown {
  return h('span', { className: 'rws_dot', 'data-state': state })
}

// ── slot 1: conversation.session.header.actions ─────────────────────────────

/** Inject face of the session-header host badge. */
export interface BadgeFace {
  useActiveHost(): ActiveHost
}

/**
 * Session-header host badge.
 *
 * Renders the host that the **effective configuration
 * resolves to** (real `readConfiguration` data) joined with that host's live
 * `listTargets` link state — falling back to the local view only when nothing
 * is configured. A hard-coded `find(id === 'local')` would pin the badge to 本机
 * forever, which is exactly what this component exists to avoid. There is no
 * session→host identity in the host face, so this is deliberately "the
 * configured target", never a fabricated session fact.
 * @param props - badge face.
 * @returns badge element.
 */
export function HostBadge(props: BadgeFace): unknown {
  const host = props.useActiveHost()
  return h(
    'span',
    {
      className: 'rws_badge',
      'data-rws-host': host.id,
      'data-rws-state': host.state,
      'data-testid': 'rws.session.hostBadge',
      title: `当前工作区所在主机：${host.detail === '' ? host.name : host.detail}`,
    },
    Dot(host.state),
    h('span', { className: 'rws_host', 'data-testid': 'rws.session.hostName' }, host.name),
    h('span', { className: 'rws_sep' }, '·'),
    h('span', { 'data-testid': 'rws.session.hostState' }, STATE_LABEL[host.state]),
  )
}

// ── slot 2: settings.section ────────────────────────────────────────────────

/** One editable form field descriptor. */
interface FieldSpec {
  readonly key: keyof RemoteWorkspaceHostSetting
  readonly label: string
  readonly placeholder: string
  readonly options?: readonly { readonly value: string; readonly label: string }[]
}

const AUTH_OPTIONS = [
  { value: 'agent', label: 'SSH 密钥 / agent' },
  { value: 'key', label: '指定私钥文件' },
  { value: 'password', label: '密码' },
]

const HOST_FIELDS: readonly FieldSpec[] = [
  { key: 'name', label: '名称', placeholder: '例如 my-remote-host' },
  { key: 'address', label: '网络地址', placeholder: 'IP 或主机名' },
  { key: 'port', label: '端口', placeholder: '22' },
  { key: 'username', label: '用户名', placeholder: '例如 root' },
  { key: 'auth', label: '登陆方式', placeholder: '', options: AUTH_OPTIONS },
  { key: 'projectPath', label: '项目路径（可选）', placeholder: '/home/me/proj' },
  { key: 'remotePort', label: '远端 DSH 端口', placeholder: '3080' },
]

/** Inject face of the settings section. */
export interface SectionFace {
  useConfig(): ConfigSnapshot
  useHostFace(): HostFaceSnapshot
  useHosts(): HostsSnapshot
  useTunnels(): TunnelsSnapshot
  loadConfig(): void
  loadHostFace(): void
  loadTargets(options?: { probe?: boolean; fresh?: boolean }): void
  loadTunnels(): void
  saveConfig(
    hosts: readonly RemoteWorkspaceHostSetting[],
    scalars: { projectPath: string; mDir: string; hub: string; enginePath: string },
  ): Promise<Outcome<{ configured: boolean; missing: readonly string[] }>>
  openTunnel(hostId: string, requireAuthentication: boolean): Promise<Outcome<RemoteTunnelView>>
  closeTunnel(hostId: string): Promise<Outcome<RemoteTunnelClosedValue>>
  failureText(failure: Failure): string
}

/** Chain-level scalar fields (empty string = "leave unchanged" on the host). */
interface Scalars {
  projectPath: string
  mDir: string
  hub: string
  enginePath: string
}

const EMPTY_SCALARS: Scalars = { projectPath: '', mDir: '', hub: '', enginePath: '' }

/** Read one host field as an editable string. */
function hostFieldValue(host: RemoteWorkspaceHostSetting, key: keyof RemoteWorkspaceHostSetting): string {
  const value = host[key]
  return typeof value === 'string' ? value : ''
}

/**
 * 「设置 › 远程开发」 — host connections plus the review-chain scalars.
 *
 * Reads: `readConfiguration` (hosts, candidates, resolved chain), `describe`
 * (host-face revision + endpoint count), `listTunnels` (live tunnels), and
 * `listTargets` (so the badge/flow share one inventory). Writes:
 * `updateConfiguration`, `openTunnel`, `closeTunnel`.
 * @param props - settings face.
 * @returns section element.
 */
export function RemoteDevSection(props: SectionFace): unknown {
  const config = props.useConfig()
  const hostFace = props.useHostFace()
  const tunnels = props.useTunnels()
  const hosts = props.useHosts()
  const [draft, setDraft] = React.useState<RemoteWorkspaceHostSetting[]>([])
  const [scalars, setScalars] = React.useState<Scalars>(EMPTY_SCALARS)
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const seeded = React.useRef(false)

  // No fetch on mount: the consumer plugin already performed the activation-time
  // reads, and a slot that re-reads on every mount can drive a render loop.
  // Refresh stays an explicit user action.
  const value = config.value
  React.useEffect(() => {
    if (value === null || seeded.current) return
    seeded.current = true
    setDraft(value.hosts.map((host) => ({ ...host })))
    setScalars({
      projectPath: '',
      mDir: value.resolved.mDir,
      hub: value.resolved.hub,
      enginePath: value.enginePath,
    })
  }, [value])

  const edit = (index: number, key: keyof RemoteWorkspaceHostSetting, next: string): void => {
    setDraft((current) => current.map((host, i) => (i === index ? { ...host, [key]: next } : host)))
  }

  const addHost = (): void => {
    setDraft((current) => [...current, blankHost(`host-${Date.now().toString(36)}`)])
  }

  const importAlias = (candidate: RemoteHostView): void => {
    setDraft((current) => [...current, {
      id: candidate.id,
      name: candidate.id,
      address: candidate.hostName === '' ? candidate.id : candidate.hostName,
      port: candidate.port === '' ? '22' : candidate.port,
      username: candidate.user,
      auth: 'agent',
      keyPath: '',
      passwordRef: '',
      fromAlias: candidate.id,
      projectPath: '',
      remotePort: '3080',
      projects: [],
    }])
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    setMessage('保存中…')
    const outcome = await props.saveConfig(draft, scalars)
    setBusy(false)
    if (!outcome.ok) {
      setMessage(`保存失败：${props.failureText(outcome.failure)}`)
      return
    }
    setMessage(outcome.value.configured ? '已保存（已就绪）' : `已保存；还缺：${outcome.value.missing.join('、')}`)
    props.loadConfig()
    props.loadTargets()
  }

  const openRemote = async (host: RemoteWorkspaceHostSetting): Promise<void> => {
    setMessage(`正在连接 ${host.name === '' ? host.id : host.name} …`)
    const outcome = await props.openTunnel(host.fromAlias === '' ? host.id : host.fromAlias, true)
    if (!outcome.ok) {
      setMessage(`连接失败：${props.failureText(outcome.failure)}`)
      return
    }
    setMessage(`隧道就绪 127.0.0.1:${outcome.value.localPort}`)
    try {
      window.open(outcome.value.url, '_blank', 'noopener')
    } catch {
      /* popup blocked: the URL stays visible in the message */
    }
    props.loadTunnels()
  }

  const closeTunnel = async (hostId: string): Promise<void> => {
    const outcome = await props.closeTunnel(hostId)
    setMessage(outcome.ok ? `隧道已关闭：${outcome.value.hostId}` : `关闭失败：${props.failureText(outcome.failure)}`)
    props.loadTunnels()
  }

  const field = (index: number, spec: FieldSpec): unknown => {
    const host = draft[index]
    if (host === undefined) return null
    const input = spec.options === undefined
      ? h('input', {
        className: 'rws-fld-input',
        value: hostFieldValue(host, spec.key),
        placeholder: spec.placeholder,
        'data-testid': `rws.settings.field.${String(spec.key)}`,
        onChange: (event: { target: { value: string } }) => edit(index, spec.key, event.target.value),
      })
      : h(
        'select',
        {
          className: 'rws-fld-input',
          value: hostFieldValue(host, spec.key),
          'data-testid': `rws.settings.field.${String(spec.key)}`,
          onChange: (event: { target: { value: string } }) => edit(index, spec.key, event.target.value),
        },
        ...spec.options.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
      )
    return h(
      'label',
      { key: String(spec.key), className: 'rws-fld' },
      h('span', { className: 'rws-fld-label' }, spec.label),
      input,
    )
  }

  const kids: unknown[] = []
  kids.push(h('p', { key: 'lead', className: 'rws-lead' },
    '添加你要连接的远端主机。填好地址与登陆方式后，创建项目时就能选到它。'))

  if (config.status === 'loading') kids.push(h('p', { key: 'ld', className: 'rws-dim' }, '读取中…'))
  if (config.status === 'error' && config.failure !== null) {
    kids.push(h('p', { key: 'er', className: 'rws-err', 'data-rws-error': config.failure.code },
      `读取配置失败：${props.failureText(config.failure)}`))
  }

  if (config.status === 'ready' && value !== null) {
    kids.push(h('div', {
      key: 'status',
      className: 'rws-status',
      'data-testid': 'rws.settings.status',
      'data-rws-configured': value.configured ? '1' : '0',
      'data-rws-missing': value.missing.join(','),
    },
    h('span', { className: value.configured ? 'rws-dot rws-dot-on' : 'rws-dot rws-dot-off' }),
    h('span', null, value.configured ? '已就绪' : `还缺：${value.missing.join('、')}`)))

    // Runtime self-proof (G-11): what the *running* host face actually offers.
    const described = hostFace.value
    kids.push(h('p', {
      key: 'face',
      className: 'rws-dim',
      'data-rws-host-face': hostFace.status,
      'data-rws-describe': hostFace.status === 'ready' ? 'ok' : hostFace.status === 'error' ? 'error' : 'idle',
      'data-rws-remote-endpoints': String(described === null ? 0 : described.endpoints.length),
      'data-rws-remote-namespace': described === null ? '' : described.namespace,
      'data-rws-remote-revision': described === null ? '' : described.revision,
    }, described === null
      ? '宿主能力：读取中…'
      : `宿主能力：${described.namespace} · ${described.endpoints.length} 个方法 · revision ${described.revision.slice(0, 12)}`))

    if (value.migrated) {
      kids.push(h('p', { key: 'mig', className: 'rws-dim' }, '检测到旧版配置，已自动转换为下面的主机条目，请确认后保存。'))
    }
    if (value.hint !== '') kids.push(h('p', { key: 'hint', className: 'rws-dim' }, value.hint))

    if (draft.length === 0) {
      kids.push(h('p', { key: 'empty', className: 'rws-dim' }, '还没有主机。点「添加主机」，或从下面的候选里导入。'))
    }

    draft.forEach((host, index) => {
      kids.push(h('div', { key: `h${String(index)}`, className: 'rws-card', 'data-rws-host-card': host.id },
        h('div', { className: 'rws-card-head' },
          h('span', { className: 'rws-card-title' }, host.name === '' ? (host.address === '' ? (host.fromAlias === '' ? '新主机' : host.fromAlias) : host.address) : host.name),
          host.fromAlias === '' ? null : h('span', { className: 'rws-tag' }, `ssh 别名 ${host.fromAlias}`)),
        h('div', { className: 'rws-grid' },
          ...HOST_FIELDS.map((spec) => field(index, spec)),
          host.auth === 'key' ? field(index, { key: 'keyPath', label: '私钥路径', placeholder: '~/.ssh/id_ed25519' }) : null,
          host.auth === 'password' ? field(index, { key: 'passwordRef', label: '密码引用名', placeholder: '例如 MY_REMOTE_PASSWORD' }) : null),
        h('div', { className: 'rws-card-act' },
          h('button', {
            type: 'button',
            className: 'rws-btn rws-btn-primary',
            'data-rws-open': host.id,
            title: '建立 SSH 隧道并打开这台机器上的 DSH',
            onClick: () => {
              void openRemote(host)
            },
          }, '打开远端项目'),
          h('button', {
            type: 'button',
            className: 'rws-btn',
            onClick: () => setDraft((current) => current.filter((_, i) => i !== index)),
          }, '移除'))))
    })

    const candidates = value.candidates
    if (candidates.length > 0) {
      const imported = new Set(draft.map((host) => (host.fromAlias === '' ? host.id : host.fromAlias)))
      const rest = candidates.filter((candidate) => !imported.has(candidate.id))
      if (rest.length > 0) {
        kids.push(h('div', { key: 'imp', className: 'rws-import' },
          h('p', { className: 'rws-dim' }, `从 ~/.ssh/config 导入（已有 ${String(candidates.length)} 条候选）：`),
          h('div', { className: 'rws-chips' },
            ...rest.map((candidate) => h('button', {
              key: candidate.id,
              type: 'button',
              className: 'rws-chip',
              title: candidate.detail,
              onClick: () => importAlias(candidate),
            }, `+ ${candidate.id}`)))))
      }
    }

    kids.push(h('div', { key: 'scalars', className: 'rws-grid' },
      h('label', { className: 'rws-fld' },
        h('span', { className: 'rws-fld-label' }, '批次目录 M（审查回路，可选）'),
        h('input', {
          className: 'rws-fld-input',
          value: scalars.mDir,
          placeholder: '/home/me/.rd/m',
          'data-testid': 'rws.settings.field.mDir',
          onChange: (event: { target: { value: string } }) => setScalars({ ...scalars, mDir: event.target.value }),
        })),
      h('label', { className: 'rws-fld' },
        h('span', { className: 'rws-fld-label' }, 'hub（审查回路，可选）'),
        h('input', {
          className: 'rws-fld-input',
          value: scalars.hub,
          placeholder: '/home/me/hub',
          'data-testid': 'rws.settings.field.hub',
          onChange: (event: { target: { value: string } }) => setScalars({ ...scalars, hub: event.target.value }),
        })),
      h('label', { className: 'rws-fld' },
        h('span', { className: 'rws-fld-label' }, 'rd-core 引擎路径（可选）'),
        h('input', {
          className: 'rws-fld-input',
          value: scalars.enginePath,
          placeholder: '留空则使用包内引擎',
          'data-testid': 'rws.settings.field.enginePath',
          onChange: (event: { target: { value: string } }) => setScalars({ ...scalars, enginePath: event.target.value }),
        }))))

    kids.push(h('div', { key: 'act', className: 'rws-actions' },
      h('button', { type: 'button', className: 'rws-btn', 'data-testid': 'rws.settings.addHost', onClick: addHost }, '添加主机'),
      h('button', {
        type: 'button',
        className: 'rws-btn rws-btn-primary',
        disabled: busy,
        onClick: () => {
          void save()
        },
      }, busy ? '保存中…' : '保存'),
      h('button', { type: 'button', className: 'rws-btn', onClick: () => props.loadConfig() }, '重新读取'),
      h('span', { className: 'rws-dim', 'data-rws-settings-message': '1' }, message)))

    const rows = tunnels.tunnels
    kids.push(h('div', { key: 'tunnels', className: 'rws-import', 'data-rws-tunnels': String(rows.length) },
      h('p', { className: 'rws-dim' }, `活动隧道（${String(rows.length)}）：`),
      rows.length === 0
        ? h('p', { className: 'rws-dim' }, '没有活动隧道。')
        : h('div', { className: 'rws-chips' }, ...rows.map((tunnel) => h('span', {
          key: tunnel.hostId,
          className: 'rws-chip',
          'data-rws-tunnel': tunnel.hostId,
          'data-rws-tunnel-alive': tunnel.alive ? '1' : '0',
        },
        `${tunnel.hostId} → 127.0.0.1:${String(tunnel.localPort)}`,
        h('button', {
          type: 'button',
          className: 'rws-btn',
          onClick: () => {
            void closeTunnel(tunnel.hostId)
          },
        }, '关闭'))))))

    if (tunnels.status === 'error' && tunnels.failure !== null) {
      kids.push(h('p', { key: 'terr', className: 'rws-err' }, `隧道清单读取失败：${props.failureText(tunnels.failure)}`))
    }
    if (hosts.status === 'error' && hosts.failure !== null) {
      kids.push(h('p', { key: 'herr', className: 'rws-err' }, `主机清单读取失败：${props.failureText(hosts.failure)}`))
    }
  }

  return h('section', { className: 'rws-sec', 'data-rws-section': 'remote-dev', 'data-rws-config': config.status }, kids)
}

// ── slots 3+4: the two directory-flow holes ─────────────────────────────────

/** Owner props the two directory-flow surfaces pass (ui-workspace contract). */
export interface FlowOwnerProps {
  readonly open: boolean
  readonly busy: boolean
  readonly onPicked: (path: string) => void
  readonly onCancel: () => void
  readonly onError: (message: string) => void
}

/** Inject face of the directory flow. */
export interface FlowFace {
  useHosts(): HostsSnapshot
  useSelectable(showAll: boolean): readonly RemoteHostView[]
  useExtraCount(): number
  loadTargets(options?: { probe?: boolean; fresh?: boolean }): void
  listDirectory(hostId: string, path: string): Promise<Outcome<RemoteDirectoryListing>>
  createDirectory(location: RemoteWorkspaceLocation, name: string): Promise<Outcome<RemoteWorkspaceLocation>>
  openProject(
    location: RemoteWorkspaceLocation,
    remember: boolean,
    requireAuthentication: boolean,
  ): Promise<Outcome<RemoteOpenedProject>>
  pickDirectory(): Promise<string | null>
  failureText(failure: Failure): string
}

/**
 * Workspace directory flow: pick a host, then browse that host's filesystem.
 *
 * Registered at `priority: -1` into both `directoryFlow` single holes, which is
 * that hole's documented shadowing rule ("lowest renders"); the built-in picker
 * stays at 0. Remote commits register the project on the host and open that
 * machine's DSH; the host-issued `location` token rides every write verb
 * verbatim, and a `location-mismatch` is recovered by re-listing once.
 * @param props - flow face + owner props.
 * @returns dialog element (or null while closed).
 */
export function DirectoryFlow(props: FlowFace & FlowOwnerProps): unknown {
  const hosts = props.useHosts()
  const [hostId, setHostId] = React.useState('local')
  const [showAll, setShowAll] = React.useState(false)
  const [listing, setListing] = React.useState<RemoteDirectoryListing | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [showHidden, setShowHidden] = React.useState(false)
  const [newName, setNewName] = React.useState<string | null>(null)
  const [busyCommit, setBusyCommit] = React.useState(false)
  const [opened, setOpened] = React.useState<RemoteOpenedProject | null>(null)
  const [notice, setNotice] = React.useState('')
  const currentHost = React.useRef(hostId)

  const host = hosts.targets.find((item) => item.id === hostId) ?? LOCAL_VIEW
  const isRemote = host.kind !== 'local'
  const selectable = props.useSelectable(showAll)

  const load = React.useCallback(async (targetHost: string, path: string): Promise<RemoteDirectoryListing | null> => {
    setLoading(true)
    setError('')
    const outcome = await props.listDirectory(targetHost, path)
    if (currentHost.current !== targetHost) return null
    setLoading(false)
    if (!outcome.ok) {
      setListing(null)
      setError(props.failureText(outcome.failure))
      return null
    }
    setListing(outcome.value)
    return outcome.value
  }, [])

  React.useEffect(() => {
    if (!props.open) return
    setNewName(null)
    setNotice('')
    setOpened(null)
    currentHost.current = hostId
    setListing(null)
    void load(hostId, '')
  }, [props.open, hostId])

  if (!props.open) return null

  const visible = (listing === null ? [] : listing.entries).filter((entry) => showHidden || !entry.hidden)

  const commit = async (): Promise<void> => {
    if (listing === null) return
    if (listing.target.hostId !== hostId) {
      setError(`目录清单属于 ${listing.target.hostId}，与当前主机 ${hostId} 不一致：已阻止提交。`)
      return
    }
    if (!isRemote) {
      props.onPicked(listing.path)
      return
    }
    setBusyCommit(true)
    setError('')
    const outcome = await props.openProject(listing.location, true, true)
    setBusyCommit(false)
    if (!outcome.ok) {
      if (outcome.failure.code === 'remote-dev/location-mismatch') {
        // Recoverable: the host re-signs every path per instance. Re-list to get
        // a fresh proof, then retry once.
        setNotice('目录身份凭证已刷新华，正在重新读取目录…')
        const refreshed = await load(hostId, listing.path)
        setNotice(refreshed === null ? '' : '凭证已刷新，请再次提交。')
        return
      }
      setError(props.failureText(outcome.failure))
      props.onError(props.failureText(outcome.failure))
      return
    }
    setOpened(outcome.value)
    try {
      window.open(outcome.value.url, '_blank', 'noopener')
    } catch {
      /* popup blocked: the link below stays clickable */
    }
  }

  const createFolder = async (): Promise<void> => {
    if (listing === null) return
    const name = (newName ?? '').trim() === '' ? '未命名文件夹' : (newName ?? '').trim()
    const outcome = await props.createDirectory(listing.location, name)
    if (!outcome.ok) {
      if (outcome.failure.code === 'remote-dev/location-mismatch') {
        setNotice('目录身份凭证已失效，正在重新读取目录…')
        await load(hostId, listing.path)
        return
      }
      setError(props.failureText(outcome.failure))
      return
    }
    setNewName(null)
    // Re-read the PARENT directory: navigating into the fresh (empty) folder
    // would hide the very result the operator asked for.
    await load(hostId, listing.path)
  }

  const openSystemChooser = async (): Promise<void> => {
    const picked = await props.pickDirectory()
    if (picked !== null && picked !== '') props.onPicked(picked)
  }

  const crumbs: unknown[] = [h('button', {
    key: 'host',
    type: 'button',
    className: 'rws_crumb rws_crumbHost',
    'data-rws-crumb-host': host.id,
    title: host.detail,
    onClick: () => {
      void load(hostId, '')
    },
  }, host.name)]
  if (listing !== null) {
    let accumulated = ''
    listing.path.split('/').filter(Boolean).forEach((segment, index) => {
      accumulated += `/${segment}`
      const target = accumulated
      crumbs.push(h('span', { key: `sep${String(index)}`, className: 'rws_crumbSep' }, '/'))
      crumbs.push(h('button', {
        key: `seg${String(index)}`,
        type: 'button',
        className: 'rws_crumb',
        onClick: () => {
          void load(hostId, target)
        },
      }, segment))
    })
  }

  const extras: unknown[] = []
  if (newName !== null) {
    extras.push(h('div', { className: 'rws_row', key: 'new' },
      h('span', { className: 'rws_lbl' }, '新建'),
      h('input', {
        className: 'rws_input',
        value: newName,
        placeholder: '文件夹名称',
        'data-testid': 'rws.flow.newFolderName',
        onChange: (event: { target: { value: string } }) => setNewName(event.target.value),
      }),
      h('button', {
        type: 'button',
        className: 'rws_btn rws_btnPrimary',
        onClick: () => {
          void createFolder()
        },
      }, '创建'),
      h('button', { type: 'button', className: 'rws_btn', onClick: () => setNewName(null) }, '取消')))
  }
  if (notice !== '') extras.push(h('div', { className: 'rws_note', key: 'notice' }, notice))
  if (error !== '') extras.push(h('div', { className: 'rws_err', key: 'err', 'data-rws-error': '1' }, error))

  return h('div', { className: 'rws_mask', 'data-rws-flow': '1' },
    h('div', { className: 'rws_dlg' },
      h('div', { className: 'rws_dlgHead' },
        h('span', null, '选择工作区目录'),
        h('button', { type: 'button', className: 'rws_btn', onClick: props.onCancel }, '关闭')),
      h('div', { className: 'rws_dlgBody' },
        h('div', { className: 'rws_row' },
          h('span', { className: 'rws_lbl' }, '主机'),
          ...selectable.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: 'rws_chip',
            'data-selected': String(item.id === hostId),
            'data-host': item.id,
            title: item.detail,
            onClick: () => setHostId(item.id),
          }, Dot(item.state), h('span', null, item.name), item.detail === '' ? null : h('span', { className: 'rws_chipDetail' }, item.detail))),
          props.useExtraCount() > 0
            ? h('button', {
              type: 'button',
              className: 'rws_btn',
              'data-rws-showall': '1',
              title: '显示 ~/.ssh/config 里的其它机器（未在设置中添加）',
              onClick: () => setShowAll(!showAll),
            }, showAll ? '只看已配置' : `更多主机（${String(props.useExtraCount())}）`)
            : null,
          hosts.failure === null ? null : h('span', { className: 'rws_err' }, `清单读取失败：${props.failureText(hosts.failure)}`)),
        h('div', { className: 'rws_crumbs', 'data-rws-crumbs': '1' }, ...crumbs),
        h('div', { className: 'rws_row' },
          h('button', {
            type: 'button',
            className: 'rws_btn',
            disabled: listing === null || listing.parent === undefined,
            onClick: () => {
              if (listing !== null && listing.parent !== undefined) void load(hostId, listing.parent)
            },
          }, '上级'),
          h('button', {
            type: 'button',
            className: 'rws_btn',
            disabled: listing === null,
            onClick: () => {
              if (listing !== null) void load(hostId, listing.home)
            },
          }, '主目录'),
          h('button', {
            type: 'button',
            className: 'rws_btn',
            disabled: listing === null,
            onClick: () => setNewName(''),
          }, '新建文件夹'),
          h('span', { className: 'rws_grow' }),
          isRemote
            ? h('button', {
              type: 'button',
              className: 'rws_btn',
              'data-rws-reprobe': '1',
              onClick: () => props.loadTargets({ probe: true, fresh: true }),
            }, '重新探测')
            : h('button', {
              type: 'button',
              className: 'rws_btn',
              'data-rws-os-chooser': '1',
              onClick: () => {
                void openSystemChooser()
              },
            }, '打开系统选择器'),
          h('label', { className: 'rws_row', style: { gap: '4px', cursor: 'pointer' } },
            h('input', {
              type: 'checkbox',
              checked: showHidden,
              onChange: (event: { target: { checked: boolean } }) => setShowHidden(event.target.checked),
            }),
            h('span', { className: 'rws_lbl' }, '显示隐藏'))),
        h('div', { className: 'rws_list', 'data-rws-list': host.id, 'data-testid': 'rws.flow.list' },
          loading
            ? h('div', { className: 'rws_empty' }, '加载中…')
            : visible.length === 0
              ? h('div', { className: 'rws_empty' }, listing === null ? '无法列出' : '没有子目录')
              : visible.map((entry: RemoteDirectoryEntry) => h('button', {
                key: entry.path,
                type: 'button',
                className: `rws_item${entry.hidden ? ' rws_itemHidden' : ''}`,
                onClick: () => {
                  void load(hostId, entry.path)
                },
              }, h('span', null, '📁'), h('span', { className: 'rws_itemName' }, entry.name)))),
        ...extras),
      h('div', { className: 'rws_dlgFoot' },
        opened === null
          ? h('span', { className: 'rws_note', 'data-rws-remote-note': '1' },
            isRemote
              ? `将把 ${listing === null ? '' : listing.path} 登记为 ${host.name} 上的远端项目，并打开那台机器上的 DSH。`
              : h('span', { className: 'rws_lbl' }, listing === null ? '' : listing.path))
          : h('span', { className: 'rws_note', 'data-rws-remote-note': '1' },
            `已在 ${opened.host} 上打开：${opened.path} `,
            h('a', {
              'data-testid': 'rws.flow.openLink',
              href: opened.url,
              target: '_blank',
              rel: 'noopener',
              style: { marginLeft: '6px', color: 'inherit' },
            }, opened.url),
            opened.warning === undefined ? null : `　⚠️ ${opened.warning}`),
        h('span', { className: 'rws_grow' }),
        h('button', { type: 'button', className: 'rws_btn', onClick: props.onCancel }, '取消'),
        h('button', {
          type: 'button',
          className: 'rws_btn rws_btnPrimary',
          disabled: props.busy || busyCommit || listing === null || listing.target.hostId !== hostId,
          'data-rws-commit': '1',
          'data-testid': 'rws.flow.commit',
          onClick: () => {
            void commit()
          },
        }, busyCommit ? '连接中…' : (props.busy ? '创建中…' : (isRemote ? '创建远端项目' : '选择此目录'))))))
}

// ── slot 5: shell.overlay ───────────────────────────────────────────────────

/** Inject face of the review panel. */
export interface ReviewFace {
  useReview(): ReviewSnapshot
  useDiagnostics(): DiagnosticsSnapshot
  reviewBatch(): Promise<void>
  reviewStatus(): Promise<void>
  reviewApply(files: readonly string[], verify: boolean): Promise<void>
  reviewReject(files: readonly string[], comment: string): Promise<void>
  reviewRollback(ref: string): Promise<void>
  failureText(failure: Failure): string
}

const STEP_LABEL: Record<string, string> = {
  apply: '应用到 W',
  verify: '本地验证',
  'push-base': '推进基线',
  'm-sync': '回灌 M',
}

/** Split one batch diff into per-file chunks on `diff --git` boundaries. */
function splitDiff(diff: string): Record<string, string> {
  const chunks: Record<string, string[]> = {}
  let current: string | null = null
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
      current = match === null ? '' : match[2] ?? ''
      chunks[current] = []
      continue
    }
    if (current !== null) chunks[current]?.push(line)
  }
  const out: Record<string, string> = {}
  for (const key of Object.keys(chunks)) out[key] = (chunks[key] ?? []).join('\n').replace(/\n+$/, '')
  return out
}

/** Line-coloured diff body. */
function DiffView(text: string): unknown {
  if (text === '') return h('pre', { className: 'rws_diff' }, '（无 diff）')
  return h('pre', { className: 'rws_diff', 'data-rws-diff': '1' },
    ...text.split('\n').map((line, index) => {
      let className = ''
      if (/^(\+\+\+|---|@@|diff |index |new file|deleted file)/.test(line)) className = 'rws_diffMeta'
      else if (line.startsWith('+')) className = 'rws_diffAdd'
      else if (line.startsWith('-')) className = 'rws_diffDel'
      return h('div', { key: index, className }, line === '' ? ' ' : line)
    }))
}

/**
 * Batch review overlay.
 *
 * There is deliberately **no** fetch on mount: a mount-time read whose async
 * arrival writes state would drive a render loop inside this very slot, and a
 * batch read is an ssh + engine round trip. The launcher only renders; the user's
 * click opens the panel and is what triggers the read.
 * @param props - review face.
 * @returns launcher, or the open panel.
 */
export function ReviewPanel(props: ReviewFace): unknown {
  const review = props.useReview()
  const diagnostics = props.useDiagnostics()
  const [open, setOpen] = React.useState(false)
  const [verdicts, setVerdicts] = React.useState<Record<string, string>>({})
  const [comment, setComment] = React.useState('')
  const [active, setActive] = React.useState('')
  const [verify, setVerify] = React.useState(true)

  const readySlots = Object.keys(diagnostics.slots).filter((name) => diagnostics.slots[name] === true)
  // Machine-readable self-check surface: proves (from inside the page) that the
  // namespace mounted and which slot declarations were observed.
  const diagnosticsNode = h('span', {
    className: 'rws-diag',
    'data-rws-diagnostics': '1',
    'data-rws-describe': diagnostics.describe,
    'data-rws-targets': diagnostics.targets,
    'data-rws-config': diagnostics.config,
    'data-rws-endpoints': String(diagnostics.endpoints),
    'data-rws-targets-count': String(diagnostics.targetsCount),
    'data-rws-slots-total': String(Object.keys(diagnostics.slots).length),
    'data-rws-slots-ready': readySlots.join(','),
    'data-rws-slot-header': diagnostics.slots['conversation.session.header.actions'] === true ? '1' : '0',
    'data-rws-slot-settings': diagnostics.slots['settings.section'] === true ? '1' : '0',
    'data-rws-slot-hero': diagnostics.slots['conversation.hero.workspace.directoryFlow'] === true ? '1' : '0',
    'data-rws-slot-sidebar': diagnostics.slots['sidebar.workspaces.directoryFlow'] === true ? '1' : '0',
    'data-rws-slot-overlay': diagnostics.slots['shell.overlay'] === true ? '1' : '0',
  })

  const batch = review.batch
  const pending = batch === null ? 0 : batch.files.length
  const launcher = h('button', {
    type: 'button',
    className: `rws_launcher${pending > 0 ? ' rws_launcherPending' : ''}`,
    'data-rws-launcher': '1',
    'data-rws-pending': String(pending),
    'data-testid': 'rws.review.launcher',
    onClick: () => {
      setOpen(true)
      void props.reviewBatch()
    },
  }, Dot(batch === null ? 'unknown' : pending > 0 ? 'reconnecting' : 'connected'),
  '远端审阅',
  batch === null ? '' : pending > 0 ? ` · ${String(pending)} 个文件待审` : ' · 无待审批次')

  if (!open) return h('span', null, launcher, diagnosticsNode)

  const chunks = batch === null ? {} : splitDiff(batch.diff)
  const approved = Object.keys(verdicts).filter((path) => verdicts[path] === 'approve')
  const rejected = Object.keys(verdicts).filter((path) => verdicts[path] === 'reject')
  const applyResult: RemoteReviewApplyResult | null = review.applyResult

  const statusRows = applyResult === null ? [] : applyResult.steps.map((step) => h('div', {
    className: 'rws_statusRow',
    key: step.step,
  },
  h('span', { className: step.code === 0 ? 'rws_ok' : 'rws_bad' }, step.code === 0 ? '✓' : '✗'),
  h('span', null, STEP_LABEL[step.step] ?? step.step),
  h('span', { className: 'rws_sha' }, `exit ${String(step.code)}`)))

  return h('span', null, diagnosticsNode, h('div', { className: 'rws_mask', 'data-rws-review': '1' },
    h('div', { className: 'rws_dlg' },
      h('div', { className: 'rws_dlgHead' },
        h('span', null, '批次审阅'),
        h('button', { type: 'button', className: 'rws_btn', onClick: () => setOpen(false) }, '关闭')),
      h('div', { className: 'rws_dlgBody' },
        review.failure === null ? null : h('div', { className: 'rws_err', 'data-rws-error': review.failure.code },
          `取批失败：${props.failureText(review.failure)}`),
        review.status === 'loading' && batch === null
          ? h('div', { className: 'rws_card', 'data-rws-loading': '1' },
            h('div', { className: 'rws_cardTop' }, Dot('connecting'), h('span', null, '正在读取批次…')))
          : null,
        batch === null ? null : h('div', { className: 'rws_card', 'data-rws-card': '1' },
          h('div', { className: 'rws_cardTop' },
            h('span', { className: 'rws_tag rws_tagM' }, '批次'),
            h('span', { className: 'rws_sha' }, `${batch.base.slice(0, 8)} → ${batch.head.slice(0, 8)}`),
            h('span', { className: 'rws_lbl' }, `${String(batch.files.length)} 个文件`)),
          h('div', { className: 'rws_cardTop' },
            h('span', { className: 'rws_lbl' }, '主机'),
            h('span', { 'data-rws-review-host': batch.target.hostId }, batch.target.hostId),
            h('span', { className: 'rws_lbl' }, '引擎'),
            h('span', { className: 'rws_sha' }, batch.engine))),
        batch === null ? null : h('div', { className: 'rws_lbl', 'data-rws-empty': batch.empty ? '1' : '0' },
          batch.empty ? '没有待审批次（基线已与镜像一致）。' : ''),
        ...(batch === null ? [] : batch.files.map((file: RemoteReviewFile) => h('div', {
          key: file.path,
          className: 'rws_frow',
          'data-rws-file': file.path,
          'data-testid': 'rws.review.file',
          'data-active': String(active === file.path),
        },
        h('span', { className: `rws_tag rws_tag${file.status}` }, file.status),
        h('button', {
          type: 'button',
          className: 'rws_fpath',
          onClick: () => setActive(file.path),
        }, file.path),
        h('span', { className: 'rws_num rws_add' }, `+${String(file.add ?? 'bin')}`),
        h('span', { className: 'rws_num rws_del' }, `-${String(file.del ?? 'bin')}`),
        h('button', {
          type: 'button',
          className: `rws_verdict ${verdicts[file.path] === 'reject' ? 'rws_verdictReject' : 'rws_verdictApprove'}`,
          'data-rws-verdict': verdicts[file.path] ?? 'approve',
          onClick: () => setVerdicts({ ...verdicts, [file.path]: verdicts[file.path] === 'reject' ? 'approve' : 'reject' }),
        }, verdicts[file.path] === 'reject' ? '拒绝' : '批准')))),
        active !== '' && chunks[active] !== undefined ? DiffView(chunks[active] ?? '') : null,
        h('textarea', {
          className: 'rws_area',
          placeholder: '拒因 / 修改请求（拒绝时必填，会 append-only 留痕）',
          value: comment,
          onChange: (event: { target: { value: string } }) => setComment(event.target.value),
        }),
        h('div', { className: 'rws_status', 'data-rws-status': '1' },
          h('div', { className: 'rws_statusRow' },
            h('span', { className: 'rws_lbl' }, '状态'),
            h('span', null, review.busy ? '处理中…' : review.note)),
          h('div', { className: 'rws_statusRow' },
            h('label', { className: 'rws_row', style: { gap: '4px', cursor: 'pointer' } },
              h('input', {
                type: 'checkbox',
                checked: verify,
                onChange: (event: { target: { checked: boolean } }) => setVerify(event.target.checked),
              }),
              h('span', { className: 'rws_lbl' }, '应用后本地验证'))),
          ...statusRows)),
      h('div', { className: 'rws_dlgFoot' },
        h('button', {
          type: 'button',
          className: 'rws_btn',
          disabled: review.busy,
          onClick: () => {
            void props.reviewBatch()
          },
        }, '刷新'),
        h('button', {
          type: 'button',
          className: 'rws_btn',
          'data-rws-status-refresh': '1',
          disabled: review.busy,
          onClick: () => {
            void props.reviewStatus()
          },
        }, '检查状态'),
        h('span', { className: 'rws_grow' }),
        h('button', {
          type: 'button',
          className: 'rws_btn',
          'data-rws-rollback': '1',
          disabled: review.busy || batch === null,
          onClick: () => {
            if (batch !== null) void props.reviewRollback(batch.base)
          },
        }, '回滚到基线'),
        h('button', {
          type: 'button',
          className: 'rws_btn',
          'data-rws-reject': '1',
          disabled: review.busy || rejected.length === 0 || comment.trim() === '',
          onClick: () => {
            void props.reviewReject(rejected, comment.trim())
          },
        }, '拒绝并留痕'),
        h('button', {
          type: 'button',
          className: 'rws_btn rws_btnPrimary',
          'data-rws-apply': '1',
          disabled: review.busy || approved.length === 0,
          onClick: () => {
            void props.reviewApply(approved, verify)
          },
        }, review.busy ? '处理中…' : '批准并应用')))))
}
