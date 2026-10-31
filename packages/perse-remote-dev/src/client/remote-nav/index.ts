/** Plugin-owned remote navigation: the stored-host group and the Session header badge.
 *
 * The host group contributes to `sidebar.workspaces.secondary` — the core's
 * generic `list` hole whose entries render as their own bordered sections
 * inside the workspace region, below the local Workspace/Session tree
 * (wide-only; ascending explicit `order`, ties keep registration order;
 * the owner passes no props and interprets nothing). The group used to sit
 * at `sidebar.footer.action`, below the account row — the owner rejected
 * that: the stored machines belong with the workspaces, just in a section
 * of their own.
 * `sidebar.workspaces` itself is still NOT usable: it is a `single` hole
 * occupied by ui-workspace's own browser, and a same-priority registration
 * throws — taking that seat would replace the local workspace tree, which
 * N07 forbids. The secondary hole exists precisely so a contribution can
 * stand beside the tree without touching it.
 *
 * Height: the core guarantees nothing about a contribution's height, and a
 * tall section would squeeze the flex tree above it. The group therefore
 * caps itself — `max-height: 42vh` on its root with its own scrolling list
 * — so at least the remaining ~58% of the sidebar stays with the local
 * tree regardless of how many hosts are stored (the profile store allows
 * 1000, and the list scrolls instead of growing).
 *
 * Rows: one row per stored profile — never only the active host. The state
 * shown is derived from the observed status plus the `autoConnect` intent
 * marker only (docs/pc-contract.md: Sidebar host row display states).
 *
 * The badge sits in `conversation.session.header.utilities`, a `list` seat
 * in the Session header.
 */
import * as React from 'react'
import { IconNewChatOutlineRegular, IconTriangleRightFillRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ExternalSessionAddress, ExternalWorkspaceAddress, ExternalWorkspaceSummary,
} from '../native-sessions/core-types.ts'
import { sameAddress, type RemoteNavBackend, type RemoteNavHost, type RemoteNavModel, type RemoteNavSnapshot } from './model.ts'
import { REMOTE_NAV_CSS } from './styles.ts'

export const REMOTE_NAV_LOCALE = 'perse.remote.navigation'

export type RemoteNavLocaleKey =
  | 'section' | 'connections' | 'connectionsAria' | 'status.connected' | 'status.offline' | 'status.running'
  | 'status.notConnected' | 'status.revoked' | 'action.reconnect' | 'action.connect'
  | 'sessions.count' | 'session.untitled' | 'session.new' | 'session.newIn' | 'session.empty'
  | 'workspace.empty' | 'catalogError' | 'empty' | 'upgrade' | 'header.remote' | 'header.remoteHint' | 'header.remoteHintWithModel'

export const remoteNavLocale = {
  zh: {
    section: '远程主机',
    connections: '连接设置',
    connectionsAria: '打开远程主机连接设置',
    'status.connected': '在线',
    'status.offline': '离线',
    'status.notConnected': '未连接',
    'status.revoked': '已撤销',
    'action.reconnect': '重连',
    'action.connect': '连接',
    'status.running': '运行中',
    'sessions.count': '{n} 个会话',
    'session.untitled': '未命名会话',
    'session.new': '新建会话',
    'session.newIn': '在“{name}”中新建会话',
    'session.empty': '暂无会话',
    'workspace.empty': '暂无工作区',
    catalogError: '目录同步失败：{error}',
    empty: '还没有已配对的远程主机。',
    upgrade: '当前 DSH 核心缺少原生远程会话接口；连接配置仍可使用。',
    'header.remote': '远程 · {host} / {workspace}',
    'header.remoteHint': '使用远程主机的模型；当前连接暂不支持切换模型、上传文件或插入本机命令。',
    'header.remoteHintWithModel': '使用远程主机的模型；可在输入框下方切换远程模型。上传文件与插入本机命令暂不支持。',
  },
  en: {
    section: 'Remote hosts',
    connections: 'Connections',
    connectionsAria: 'Open remote host connection settings',
    'status.connected': 'Online',
    'status.offline': 'Offline',
    'status.notConnected': 'Not connected',
    'status.revoked': 'Revoked',
    'action.reconnect': 'Reconnect',
    'action.connect': 'Connect',
    'status.running': 'Running',
    'sessions.count': '{n} sessions',
    'session.untitled': 'Untitled session',
    'session.new': 'New session',
    'session.newIn': 'Create a session in “{name}”',
    'session.empty': 'No sessions',
    'workspace.empty': 'No workspaces',
    catalogError: 'Catalog refresh failed: {error}',
    empty: 'No paired remote hosts yet.',
    upgrade: 'This DSH core has no native remote-session interface; connection settings remain available.',
    'header.remote': 'Remote · {host} / {workspace}',
    'header.remoteHint': 'Using the remote host model. This connection does not support changing models, uploading files, or inserting local commands.',
    'header.remoteHintWithModel': 'Using the remote host model; switch remote models below the composer. File upload and local commands are not supported yet.',
  },
} satisfies Record<'zh' | 'en', Record<RemoteNavLocaleKey, string>>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'perse.remote.navigation': RemoteNavLocaleKey
  }
  // Mirror of the patched core's generic hole (ui-workspace's contract: `{ kind:
  // 'list'; scope: 'root'; owner: Record<never, never> }`), so this composition
  // compiles against the published 0.2.1-rc.2 peer types too. Type-only: no
  // remote-specific concept enters the slot — the core entry stays generic and
  // the merged declarations are identical, one stable name per hole.
  interface SlotMap {
    'sidebar.workspaces.secondary': { kind: 'list'; scope: 'root'; owner: Record<never, never> }
  }
}

interface RemoteNavInjected {
  readonly nav: RemoteNavModel
  readonly openConnections: () => void
  readonly hooks: { readonly nav: HostObservable<RemoteNavSnapshot> }
}

type RemoteNavProps = PropsRuntime<'sidebar.workspaces.secondary'> & InjectFace<RemoteNavInjected> & {
  readonly useNav: SnapshotSelectorHook<RemoteNavSnapshot>
} & PropsLocale<typeof REMOTE_NAV_LOCALE>

const h = React.createElement

const Chevron = ({ open }: { open: boolean }): React.ReactElement =>
  h(IconTriangleRightFillRegular, { size: 11, className: open ? 'pcRemoteChevronOpen' : 'pcRemoteChevron' })

const ManageIcon = (): React.ReactElement => h('svg', {
  width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, 'aria-hidden': true,
}, h('rect', { x: 3, y: 5, width: 18, height: 13, rx: 2 }), h('path', { d: 'M8 21h8M12 18v3' }))

/** Visible label for each row state; 「在线」 renders as the green dot instead of text. */
const rowStatusLabel = (t: RemoteNavProps['t'], state: RemoteNavHost['rowState']): string => {
  if (state === 'connected') return t('status.connected')
  if (state === 'reconnect') return t('status.offline')
  if (state === 'revoked') return t('status.revoked')
  return t('status.notConnected')
}

/** Stored-host group: every stored profile is a row; sessions render only under the
 * one host whose generation is active for native sessions. */
export function RemoteWorkspaceSection(props: RemoteNavProps): React.ReactElement {
  const { nav, openConnections, t } = props
  // The renderer binds this selector to the plugin model's getSnapshot/subscribe.
  const snapshot = props.useNav(value => value)
  const [open, setOpen] = React.useState(true)
  const [closedHosts, setClosedHosts] = React.useState<Record<string, boolean>>({})
  const [openProjects, setOpenProjects] = React.useState<Record<string, boolean>>({})

  const renderSessions = (hostKey: string, backend: RemoteNavBackend, workspace: ExternalWorkspaceSummary): React.ReactElement | null => {
    // Same key the workspace row toggles: one expand state per (host, project).
    const key = `${hostKey}/${workspace.id}`
    if (openProjects[key] !== true) return null
    if (workspace.sessions.length === 0) return h('p', { className: 'pcRemoteNote' }, t('session.empty'))
    const offline = backend.status !== 'connected'
    return h(React.Fragment, { key }, ...workspace.sessions.map(session => {
      const title = session.title === '' || session.title === session.id ? t('session.untitled') : session.title
      const sessionAddress: ExternalSessionAddress = {
        kind: 'external-session',
        backendId: backend.backendId,
        hostId: backend.hostId,
        workspaceId: workspace.id,
        sessionId: session.id,
      }
      const selected = sameAddress(snapshot.selectedAddress, sessionAddress)
      return h('button', {
        key: `${key}/${session.id}`, type: 'button',
        className: selected ? 'pcRemoteSessionSelected' : 'pcRemoteSession',
        'aria-current': selected ? 'page' : undefined,
        'aria-label': title,
        // An offline host never falls through to a local Session: the row stays
        // readable but cannot be opened until the exact generation reconnects.
        disabled: offline,
        onClick: () => { nav.openSession(sessionAddress) },
      },
      h('span', { className: 'pcRemoteSessionTitle' }, title),
      session.running ? h('span', { className: 'pcRemoteRunning' }, t('status.running')) : null)
    }))
  }

  const renderHost = (host: RemoteNavHost): React.ReactElement => {
    const hostKey = host.profileId
    const backend = host.backend
    const hasTree = backend !== undefined
    const hostOpen = hasTree && closedHosts[hostKey] !== true
    const statusText = rowStatusLabel(t, host.rowState)
    // The row's accessible name keeps the state word for every state; only the
    // visible connected marker is the dot (aria-hidden) instead of text.
    return h('div', { className: 'pcRemoteHost', key: hostKey, 'data-remote-host': hostKey },
      h('div', { className: 'pcRemoteHostRow' },
        h('button', {
          type: 'button', className: 'pcRemoteHostButton',
          'aria-label': `${host.hostName} · ${host.deviceName} · ${statusText}`,
          'aria-expanded': hasTree ? hostOpen : undefined,
          onClick: () => { setClosedHosts(value => ({ ...value, [hostKey]: value[hostKey] === true ? false : true })) },
        },
        hasTree ? h(Chevron, { open: hostOpen }) : null,
        h('span', { className: 'pcRemoteHostName' }, `${host.hostName} · ${host.deviceName}`),
        host.rowState === 'connected'
          ? h('span', { className: 'pcRemoteDot', 'data-state': 'connected', 'aria-hidden': true })
          : h('span', { className: 'pcRemoteStatus', 'data-state': 'offline' }, statusText)),
        // The row action states what one explicit click will do; it never
        // schedules anything. 「重连」 = transport loss with the intent still
        // connected; 「连接」 = withdrawn/never-connected intent, and the absence
        // of `autoConnect` is what keeps it free of any automatic attempt.
        host.rowState === 'reconnect' ? h('button', {
          type: 'button', className: 'pcRemoteAction',
          'aria-label': t('action.reconnect'),
          onClick: () => { nav.connectHost(host.profileId) },
        }, t('action.reconnect')) : null,
        host.rowState === 'not-connected' ? h('button', {
          type: 'button', className: 'pcRemoteAction',
          'aria-label': t('action.connect'),
          onClick: () => { nav.connectHost(host.profileId) },
        }, t('action.connect')) : null),
      hasTree && backend !== undefined && backend.warning !== undefined && backend.warning !== ''
        ? h('p', { className: 'pcRemoteNote', 'data-tone': 'warn', role: 'status' }, backend.warning) : null,
      hasTree && backend !== undefined && backend.catalogError !== undefined
        ? h('p', { className: 'pcRemoteNote', 'data-tone': 'warn', role: 'status' }, t('catalogError', { error: backend.catalogError })) : null,
      hostOpen && backend !== undefined ? h(React.Fragment, null,
        ...backend.workspaces.map(workspace => {
          const projectKey = `${hostKey}/${workspace.id}`
          const workspaceAddress: ExternalWorkspaceAddress = {
            kind: 'external-workspace',
            backendId: backend.backendId,
            hostId: backend.hostId,
            workspaceId: workspace.id,
          }
          const count = t('sessions.count', { n: workspace.sessions.length })
          return h('div', { className: 'pcRemoteWorkspace', key: projectKey, 'data-remote-workspace': projectKey },
            h('div', { className: 'pcRemoteWorkspaceRow' },
              h('button', {
                type: 'button', className: 'pcRemoteWorkspaceButton',
                'aria-label': `${workspace.name} · ${count}`,
                'aria-expanded': openProjects[projectKey] === true,
                title: workspace.name,
                onClick: () => { setOpenProjects(value => ({ ...value, [projectKey]: value[projectKey] !== true })) },
              },
              h(Chevron, { open: openProjects[projectKey] === true }),
              h('span', { className: 'pcRemoteHostName' }, workspace.name),
              // Collapsed by default: the count is the row, sessions appear on expand.
              h('span', { className: 'pcRemoteCount' }, count)),
              h('button', {
                type: 'button', className: 'pcRemoteNew',
                'aria-label': t('session.newIn', { name: workspace.name }),
                title: t('session.new'), disabled: backend.status !== 'connected',
                onClick: () => { nav.createSession(workspaceAddress) },
              }, h(IconNewChatOutlineRegular, { size: 14 }))),
            renderSessions(hostKey, backend, workspace))
        }),
        backend.workspaces.length === 0 ? h('p', { className: 'pcRemoteNote' }, t('workspace.empty')) : null) : null)
  }

  return h('section', { className: 'pcRemoteRoot', 'aria-label': t('section'), 'data-remote-secondary': '1' },
    h('style', { 'data-perse-remote-nav-styles': '1' }, REMOTE_NAV_CSS),
    h('div', { className: 'pcRemoteHeader' },
      h('button', {
        type: 'button', className: 'pcRemoteTitle', 'aria-expanded': open,
        'aria-label': t('section'), onClick: () => { setOpen(value => !value) },
      }, h(Chevron, { open }), h('span', null, t('section'))),
      // 连接设置 stays reachable from inside the group: pairing links and the
      // per-host detail live on that panel, opened through the layout service.
      h('button', {
        type: 'button', className: 'pcRemoteManage', 'aria-label': t('connectionsAria'),
        title: t('connections'), onClick: openConnections,
      }, h(ManageIcon, null), h('span', null, t('connections')))),
    open ? h('div', { className: 'pcRemoteList' },
      snapshot.nativeSessionsAvailable ? null : h('p', { className: 'pcRemoteNote', 'data-tone': 'warn', role: 'note' }, t('upgrade')),
      snapshot.hosts.length === 0 ? h('p', { className: 'pcRemoteNote' }, t('empty')) : null,
      ...snapshot.hosts.map(renderHost)) : null)
}

export interface RemoteSessionBadgeInjected {
  readonly label: string | undefined
  readonly hint: string | undefined
}

/** Leading host/project identity for a selected remote Session, in the native header. */
export function RemoteSessionBadge(props: PropsRuntime<'conversation.session.header.utilities'> & RemoteSessionBadgeInjected): React.ReactNode {
  const { label, hint } = props
  if (label === undefined) return null
  const description = hint === undefined ? label : `${label}. ${hint}`
  return h('span', {
    role: 'status',
    'data-remote-session-badge': '1',
    title: hint,
    'aria-label': description,
    style: {
      color: 'var(--dsw-alias-label-tertiary)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '999px',
      padding: '1px 8px',
      fontSize: '11px',
      lineHeight: '16px',
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }, label)
}
