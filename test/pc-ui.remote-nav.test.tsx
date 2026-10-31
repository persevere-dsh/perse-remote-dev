// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'

// The primitives row ships CSS modules, which Node's ESM loader cannot import; the
// suite stubs the two icons the group renders (the same stub style as the settings suite).
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const ReactApi = await import('react')
  const icon = (props: { size?: number }) => ReactApi.createElement('svg', { 'data-icon-size': props.size ?? 0 })
  return { IconNewChatOutlineRegular: icon, IconTriangleRightFillRegular: icon }
})
import { RemoteWorkspaceSection, remoteNavLocale } from '../packages/perse-remote-dev/src/client/remote-nav/index.ts'
import type {
  RemoteHostRowState, RemoteNavBackend, RemoteNavHost, RemoteNavModel, RemoteNavSnapshot,
} from '../packages/perse-remote-dev/src/client/remote-nav/model.ts'
import type {
  ExternalBackendId, ExternalHostId, ExternalSessionAddress, ExternalSessionId,
  ExternalSessionSummary, ExternalWorkspaceAddress, ExternalWorkspaceId,
} from '../packages/perse-remote-dev/src/client/native-sessions/core-types.ts'

afterEach(cleanup)

/** The frozen core brands these ids; the fixture brands them by cast, never by re-deriving them. */
const brand = <T,>(value: string): T => value as T

const backendId = brand<ExternalBackendId>('profile-1')
const hostId = brand<ExternalHostId>('host-1')
const workspaceId = brand<ExternalWorkspaceId>('workspace-1')
const sessionId = brand<ExternalSessionId>('session-1')

function translator(language: 'zh' | 'en') {
  return (key: keyof typeof remoteNavLocale.en, params?: Record<string, string | number>): string => {
    let value: string = remoteNavLocale[language][key]
    for (const [name, item] of Object.entries(params ?? {})) value = value.replace(`{${name}}`, String(item))
    return value
  }
}

const t = translator('en')

function session(overrides: Partial<ExternalSessionSummary> = {}): ExternalSessionSummary {
  return { id: sessionId, title: 'Fix sidebar', updatedAt: 10, running: true, blank: false, ...overrides }
}

function backend(
  status: RemoteNavBackend['status'] = 'connected',
  notice: Pick<RemoteNavBackend, 'warning' | 'catalogError'> = { catalogError: undefined },
  sessions: readonly ExternalSessionSummary[] = [session()],
): RemoteNavBackend {
  return {
    backendId,
    hostId,
    hostName: 'Build host',
    profileName: 'Office',
    status,
    ...notice,
    workspaces: [{ id: workspaceId, name: 'Persevere', path: '/remote/private/path', sessions }],
  }
}

/** One stored profile as the view model renders it: identity + derived row state +
 * the catalog of the installed generation (only the active host has one). */
function host(overrides: Partial<RemoteNavHost> = {}, entry?: RemoteNavBackend): RemoteNavHost {
  return {
    profileId: 'profile-1',
    hostName: 'Build host',
    deviceName: 'Office',
    rowState: 'connected' satisfies RemoteHostRowState,
    active: true,
    backend: entry ?? backend(),
    ...overrides,
  }
}

function harness(
  snapshot: Partial<RemoteNavSnapshot> = {},
  nav: Partial<RemoteNavModel> = {},
) {
  const full: RemoteNavSnapshot = {
    hosts: [host()],
    selectedAddress: undefined,
    nativeSessionsAvailable: true,
    ...snapshot,
  }
  const model = {
    getSnapshot: () => full,
    subscribe: () => () => undefined,
    openSession: vi.fn<(address: ExternalSessionAddress) => void>(),
    createSession: vi.fn<(address: ExternalWorkspaceAddress) => void>(),
    connectHost: vi.fn<(profileId: string) => void>(),
    dispose: () => undefined,
    ...nav,
  } as unknown as RemoteNavModel
  const view = render(React.createElement(RemoteWorkspaceSection, {
    nav: model,
    openConnections: vi.fn(),
    hooks: { nav: { getSnapshot: () => full, subscribe: () => () => undefined } },
    useNav: (selector: (value: RemoteNavSnapshot) => RemoteNavSnapshot) => selector(full),
    t,
  }))
  return { view, model, snapshot: full }
}

/** Sessions are collapsed by default: open one project so its rows can be addressed. */
function expandProject(view: ReturnType<typeof render>): void {
  fireEvent.click(view.getByRole('button', { name: /Persevere · \d+ sessions/ }))
}

describe('RemoteWorkspaceSection', () => {
  it('collapses sessions by default and states the count instead of the rows', () => {
    const { view } = harness()
    expect(view.getByText('1 sessions')).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Fix sidebar' })).toBeNull()
    expandProject(view)
    expect(view.getByRole('button', { name: 'Fix sidebar' })).toBeTruthy()
  })

  it('opens host-qualified Sessions and creates only through the remote workspace address', () => {
    const { view, model } = harness({ selectedAddress: {
      kind: 'external-session', backendId, hostId, workspaceId, sessionId,
    } })
    expandProject(view)

    const row = view.getByRole('button', { name: 'Fix sidebar' })
    expect(row.getAttribute('aria-current')).toBe('page')
    fireEvent.click(row)
    expect(model.openSession).toHaveBeenCalledWith({
      kind: 'external-session', backendId, hostId, workspaceId, sessionId,
    })

    fireEvent.click(view.getByRole('button', { name: 'Create a session in “Persevere”' }))
    expect(model.createSession).toHaveBeenCalledWith({
      kind: 'external-workspace', backendId, hostId, workspaceId,
    })
    expect(view.queryByText('/remote/private/path')).toBeNull()
  })

  it('keeps offline catalog rows visible but disables open and new-session actions', () => {
    // Transport loss on the active host: intent is still connected, so the row
    // reads 「离线」 (Offline) and keeps the tree readable but unopenable.
    const { view, model } = harness({ hosts: [host({ rowState: 'reconnect' }, backend('offline'))] })
    const hostRow = view.getByRole('button', { name: /Build host · Office · Offline/ })
    expect(hostRow.getAttribute('aria-expanded')).toBe('true')
    expandProject(view)

    const row = view.getByRole('button', { name: 'Fix sidebar' })
    const create = view.getByRole('button', { name: 'Create a session in “Persevere”' })
    // The row stays readable; neither action may reach a local Session while the
    // exact remote generation is offline.
    expect((row as HTMLButtonElement).disabled).toBe(true)
    expect((create as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(row)
    fireEvent.click(create)
    expect(model.openSession).not.toHaveBeenCalled()
    expect(model.createSession).not.toHaveBeenCalled()

    fireEvent.click(hostRow)
    expect(within(document.body).queryByRole('button', { name: 'Fix sidebar' })).toBeNull()
  })

  it('keeps provider warnings and catalog refresh failures visible on the host group', () => {
    const entry = backend('connected', {
      warning: '新会话已由主机接收，目录尚未同步；请稍后刷新。',
      catalogError: '连接超时',
    })
    const { view } = harness({ hosts: [host({}, entry)] })
    expect(view.getAllByRole('status').map(element => element.textContent)).toEqual([
      '新会话已由主机接收，目录尚未同步；请稍后刷新。',
      'Catalog refresh failed: 连接超时',
    ])
    fireEvent.click(view.getByRole('button', { name: /Build host · Office · Online/ }))
    expect(view.getAllByRole('status').map(element => element.textContent)).toEqual([
      '新会话已由主机接收，目录尚未同步；请稍后刷新。',
      'Catalog refresh failed: 连接超时',
    ])
  })

  it('localizes raw session ids without relying on blank metadata or replacing custom titles', () => {
    const { view } = harness({ hosts: [host({}, backend('connected', { catalogError: undefined }, [
      session({ title: 'session-1' }),
      session({ id: brand<ExternalSessionId>('session-2'), title: 'Review draft', blank: true }),
    ])) ] })
    expect(view.getByText('2 sessions')).toBeTruthy()
    expandProject(view)
    expect(view.getByRole('button', { name: 'Untitled session' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Review draft' })).toBeTruthy()
    expect(view.queryByText('session-1')).toBeNull()
  })

  it('reports a core without the native seam instead of offering a local fallback', () => {
    const { view, model } = harness({ hosts: [], nativeSessionsAvailable: false })
    expect(view.getByRole('note').textContent).toContain('no native remote-session interface')
    // Wording note: the empty state now means "nothing stored", not "nothing
    // connected" — every stored host renders a row regardless of state.
    expect(view.getByText('No paired remote hosts yet.')).toBeTruthy()
    expect(model.openSession).not.toHaveBeenCalled()
  })
})

describe('stored-host row states (docs/pc-contract.md: Sidebar host row display states)', () => {
  it('renders a connected host as name + device name + green dot, without an action button', () => {
    const { view } = harness()
    const row = view.getByRole('button', { name: 'Build host · Office · Online' })
    expect(row.textContent).toContain('Build host · Office')
    const dot = row.querySelector('.pcRemoteDot[data-state="connected"]')
    expect(dot).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Reconnect' })).toBeNull()
    expect(view.queryByRole('button', { name: 'Connect' })).toBeNull()
  })

  it('labels a transport loss (intent connected) 「离线」 and 重连 dispatches exactly one attempt for that profile', () => {
    const { view, model } = harness({ hosts: [host({ rowState: 'reconnect' }, backend('offline'))] })
    const row = view.getByRole('button', { name: /Build host · Office · Offline/ })
    expect(row.textContent).toContain('Offline')
    const reconnect = view.getByRole('button', { name: 'Reconnect' })
    expect(reconnect.textContent).toBe('Reconnect')
    fireEvent.click(reconnect)
    // Exactly one attempt, for exactly this profile — per click, no batch, no loop.
    expect(model.connectHost).toHaveBeenCalledTimes(1)
    expect(model.connectHost).toHaveBeenCalledWith('profile-1')
  })

  it('labels withdrawn or never-set intent 「未连接」 and 连接 never attempts automatically', () => {
    const { view, model } = harness({ hosts: [host({ rowState: 'not-connected', active: false, backend: undefined })] })
    const row = view.getByRole('button', { name: /Build host · Office · Not connected/ })
    expect(row.textContent).toContain('Not connected')
    // No attempt was made just by rendering the row: intent disconnected means
    // nothing automatic, only the explicit click below may dispatch.
    expect(model.connectHost).not.toHaveBeenCalled()
    fireEvent.click(view.getByRole('button', { name: 'Connect' }))
    expect(model.connectHost).toHaveBeenCalledTimes(1)
    expect(model.connectHost).toHaveBeenCalledWith('profile-1')
  })

  it('labels a revoked grant honestly and offers no attempt from the row', () => {
    const { view, model } = harness({ hosts: [host({ rowState: 'revoked', active: false, backend: undefined })] })
    expect(view.getByRole('button', { name: /Build host · Office · Revoked/ }).textContent).toContain('Revoked')
    expect(view.queryByRole('button', { name: 'Reconnect' })).toBeNull()
    expect(view.queryByRole('button', { name: 'Connect' })).toBeNull()
    expect(model.connectHost).not.toHaveBeenCalled()
  })
})

describe('multi-host inventory', () => {
  it('renders every stored host even though only one is active for sessions', () => {
    const { view } = harness({ hosts: [
      // The active host: installed generation, session tree below its row.
      host({ profileId: 'profile-active' }),
      // Connected bridge socket but not the session-active host: true status, no tree.
      host({ profileId: 'profile-second', hostName: 'Studio host', rowState: 'connected', active: false, backend: undefined }),
      // Stored with withdrawn intent: still a row, never hidden.
      host({ profileId: 'profile-third', hostName: 'Lab host', deviceName: 'Laptop', rowState: 'not-connected', active: false, backend: undefined }),
    ] })
    // All three stored machines are visible at once.
    expect(view.getByRole('button', { name: 'Build host · Office · Online' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Studio host · Office · Online' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Lab host · Laptop · Not connected' })).toBeTruthy()
    // The two non-active hosts show true state; only the active one has a tree.
    expect(view.getByRole('button', { name: 'Studio host · Office · Online' }).querySelector('.pcRemoteDot[data-state="connected"]')).toBeTruthy()
    expect(view.getAllByRole('button', { name: /Persevere · 1 sessions/ })).toHaveLength(1)
    // Acting on one host (expanding the active project) keeps the others rendered.
    expandProject(view)
    expect(view.getByRole('button', { name: 'Fix sidebar' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Lab host · Laptop · Not connected' })).toBeTruthy()
    // The non-active connected host has no chevron: no tree is implied for it.
    const studioRow = view.getByRole('button', { name: 'Studio host · Office · Online' })
    expect(studioRow.getAttribute('aria-expanded')).toBeNull()
  })
})

describe('bounded height', () => {
  it('caps the section on its own root and scrolls its own list', () => {
    const hosts: RemoteNavHost[] = Array.from({ length: 30 }, (_, index) => host({
      profileId: `profile-${index}`,
      hostName: `Host ${index}`,
      active: false,
      rowState: 'not-connected',
      backend: undefined,
    }))
    const { view } = harness({ hosts })
    const root = view.container.querySelector('section[data-remote-secondary="1"]')
    expect(root).toBeTruthy()
    const styles = view.container.querySelector('style[data-perse-remote-nav-styles]')
    expect(styles?.textContent).toContain('max-height:42vh')
    // The cap only bounds if the inner list is the scroll area, so the section
    // can never grow and squeeze the local workspace tree.
    expect(styles?.textContent).toMatch(/\.pcRemoteList\{[^}]*overflow-y:auto/)
    // The bounded root is the outermost node the contribution owns: the row
    // list is inside its scrolling area, not a sibling growing the core wrapper.
    expect(root?.contains(view.getByRole('button', { name: 'Host 29 · Office · Not connected' }))).toBe(true)
  })
})

describe('slot registration (docs/pc-contract.md: placement)', () => {
  // jsdom turns import.meta.url into an http URL, so read from the suite's
  // working directory (npm run test:pc-ui executes from the repository root).
  const clientSource = readFileSync('packages/perse-remote-dev/src/client/index.ts', 'utf8')

  it('contributes to sidebar.workspaces.secondary with an explicit order', () => {
    expect(clientSource).toMatch(/slots\.inject\(\s*'sidebar\.workspaces\.secondary'/)
    const registration = /slots\.register\(\s*\{\s*name:\s*'sidebar\.workspaces\.secondary',\s*id:\s*'perse-remote-dev-remote-hosts',\s*order:\s*(\d+)/.exec(clientSource)
    expect(registration, 'the secondary registration must carry the stable id and an explicit order').toBeTruthy()
    // 50: above the future default placement; ties are decided by
    // registration order, the core's documented tie rule.
    expect(Number(registration?.[1])).toBe(50)
  })

  it('no longer registers against sidebar.footer.action', () => {
    // The relocation removed every footer-seat contribution: neither the
    // inject call nor a register spec may name the old slot. (The prose in
    // the source comment explains the old placement; only registrations count.)
    expect(clientSource).not.toMatch(/slots\.inject\(\s*'sidebar\.footer\.action'/)
    expect(clientSource).not.toMatch(/name:\s*'sidebar\.footer\.action'/)
  })
})
