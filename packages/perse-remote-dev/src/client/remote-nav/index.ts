/** Plugin-owned remote navigation: the host → project → session group and the Session header badge.
 *
 * Both surfaces sit in official stackable slots declared by the baseline shell:
 * `sidebar.footer.action` (a `list` seat in the left column, ordered by `options.order`)
 * and `conversation.session.header.utilities` (a `list` seat in the Session header).
 * `sidebar.workspaces` is NOT usable here: it is a `single` hole occupied by
 * ui-workspace's own browser, and a same-priority registration throws — taking that
 * seat would replace the local workspace tree, which N07 forbids.
 */
import * as React from 'react'
import { IconNewChatOutlineRegular, IconTriangleRightFillRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ExternalSessionAddress, ExternalWorkspaceAddress, ExternalWorkspaceSummary,
} from '../native-sessions/core-types.ts'
import { sameAddress, type RemoteNavBackend, type RemoteNavModel, type RemoteNavSnapshot } from './model.ts'
import { REMOTE_NAV_CSS } from './styles.ts'

export const REMOTE_NAV_LOCALE = 'perse.remote.navigation'

export type RemoteNavLocaleKey =
  | 'section' | 'connections' | 'connectionsAria' | 'status.connected' | 'status.offline' | 'status.running'
  | 'sessions.count' | 'session.untitled' | 'session.new' | 'session.newIn' | 'session.empty'
  | 'workspace.empty' | 'catalogError' | 'empty' | 'upgrade' | 'header.remote' | 'header.remoteHint' | 'header.remoteHintWithModel'

export const remoteNavLocale = {
  zh: {
    section: '远程主机',
    connections: '连接设置',
    connectionsAria: '打开远程主机连接设置',
    'status.connected': '在线',
    'status.offline': '离线',
    'status.running': '运行中',
    'sessions.count': '{n} 个会话',
    'session.untitled': '未命名会话',
    'session.new': '新建会话',
    'session.newIn': '在“{name}”中新建会话',
    'session.empty': '暂无会话',
    'workspace.empty': '暂无工作区',
    catalogError: '目录同步失败：{error}',
    empty: '还没有已连接的远程主机。',
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
    'status.running': 'Running',
    'sessions.count': '{n} sessions',
    'session.untitled': 'Untitled session',
    'session.new': 'New session',
    'session.newIn': 'Create a session in “{name}”',
    'session.empty': 'No sessions',
    'workspace.empty': 'No workspaces',
    catalogError: 'Catalog refresh failed: {error}',
    empty: 'No connected remote hosts yet.',
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
}

interface RemoteNavInjected {
  readonly nav: RemoteNavModel
  readonly openConnections: () => void
  readonly hooks: { readonly nav: HostObservable<RemoteNavSnapshot> }
}

type RemoteNavProps = PropsRuntime<'sidebar.footer.action'> & InjectFace<RemoteNavInjected> & {
  readonly useNav: SnapshotSelectorHook<RemoteNavSnapshot>
} & PropsLocale<typeof REMOTE_NAV_LOCALE>

const h = React.createElement

const Chevron = ({ open }: { open: boolean }): React.ReactElement =>
  h(IconTriangleRightFillRegular, { size: 11, className: open ? 'pcRemoteChevronOpen' : 'pcRemoteChevron' })

const ManageIcon = (): React.ReactElement => h('svg', {
  width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, 'aria-hidden': true,
}, h('rect', { x: 3, y: 5, width: 18, height: 13, rx: 2 }), h('path', { d: 'M8 21h8M12 18v3' }))

/** Host → authorized project → session group, collapsed at the session level by default. */
export function RemoteWorkspaceSection(props: RemoteNavProps): React.ReactElement | null {
  const { nav, openConnections, t, wide } = props
  // The renderer binds this selector to the plugin model's getSnapshot/subscribe.
  const snapshot = props.useNav(value => value)
  const [open, setOpen] = React.useState(true)
  const [closedHosts, setClosedHosts] = React.useState<Record<string, boolean>>({})
  const [openProjects, setOpenProjects] = React.useState<Record<string, boolean>>({})

  if (!wide) {
    // The 56px rail carries no list affordance: one compact button still reaches
    // connection management without inventing a second navigation column.
    return h('button', {
      type: 'button', className: 'pcRemoteManage', 'aria-label': t('connectionsAria'),
      title: t('connections'), onClick: openConnections,
    }, h(ManageIcon, null))
  }

  const renderSessions = (backend: RemoteNavBackend, workspace: ExternalWorkspaceSummary): React.ReactElement | null => {
    const key = `${backend.backendId}/${backend.hostId}/${workspace.id}`
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

  return h('section', { className: 'pcRemoteRoot', 'aria-label': t('section'), 'data-remote-workspace-tree': '1' },
    h('style', { 'data-perse-remote-nav-styles': '1' }, REMOTE_NAV_CSS),
    h('div', { className: 'pcRemoteHeader' },
      h('button', {
        type: 'button', className: 'pcRemoteTitle', 'aria-expanded': open,
        'aria-label': t('section'), onClick: () => { setOpen(value => !value) },
      }, h(Chevron, { open }), h('span', null, t('section'))),
      h('button', {
        type: 'button', className: 'pcRemoteManage', 'aria-label': t('connectionsAria'),
        title: t('connections'), onClick: openConnections,
      }, h(ManageIcon, null), h('span', null, t('connections')))),
    open ? h('div', { className: 'pcRemoteList' },
      snapshot.nativeSessionsAvailable ? null : h('p', { className: 'pcRemoteNote', 'data-tone': 'warn', role: 'note' }, t('upgrade')),
      snapshot.backends.length === 0 ? h('p', { className: 'pcRemoteNote' }, t('empty')) : null,
      ...snapshot.backends.map(backend => {
        const hostKey = `${backend.backendId}/${backend.hostId}`
        const hostOpen = closedHosts[hostKey] !== true
        const offline = backend.status !== 'connected'
        const hostLabel = `${backend.hostName} · ${backend.profileName}`
        return h('div', { className: 'pcRemoteHost', key: hostKey, 'data-remote-backend': hostKey },
          h('button', {
            type: 'button', className: 'pcRemoteHostButton',
            'aria-label': `${hostLabel} · ${offline ? t('status.offline') : t('status.connected')}`,
            'aria-expanded': hostOpen,
            onClick: () => { setClosedHosts(value => ({ ...value, [hostKey]: value[hostKey] === true ? false : true })) },
          },
          h(Chevron, { open: hostOpen }),
          h('span', { className: 'pcRemoteHostName' }, hostLabel),
          h('span', { className: 'pcRemoteStatus', 'data-state': offline ? 'offline' : 'connected' },
            offline ? t('status.offline') : t('status.connected'))),
          backend.warning === undefined || backend.warning === '' ? null
            : h('p', { className: 'pcRemoteNote', 'data-tone': 'warn', role: 'status' }, backend.warning),
          backend.catalogError === undefined ? null
            : h('p', { className: 'pcRemoteNote', 'data-tone': 'warn', role: 'status' }, t('catalogError', { error: backend.catalogError })),
          hostOpen ? h(React.Fragment, null,
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
                    title: t('session.new'), disabled: offline,
                    onClick: () => { nav.createSession(workspaceAddress) },
                  }, h(IconNewChatOutlineRegular, { size: 14 }))),
                renderSessions(backend, workspace))
            }),
            backend.workspaces.length === 0 ? h('p', { className: 'pcRemoteNote' }, t('workspace.empty')) : null) : null)
      })) : null)
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
