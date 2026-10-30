// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

// The primitives row ships CSS modules, which Node's ESM loader cannot import; the
// suite stubs the two icons the group renders (the same stub style as the settings suite).
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const ReactApi = await import('react')
  const icon = (props: { size?: number }) => ReactApi.createElement('svg', { 'data-icon-size': props.size ?? 0 })
  return { IconNewChatOutlineRegular: icon, IconTriangleRightFillRegular: icon }
})
import { RemoteWorkspaceSection, remoteNavLocale } from '../packages/perse-remote-dev/src/client/remote-nav/index.ts'
import type { RemoteNavBackend, RemoteNavModel, RemoteNavSnapshot } from '../packages/perse-remote-dev/src/client/remote-nav/model.ts'
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

function harness(
  snapshot: Partial<RemoteNavSnapshot> = {},
  nav: Partial<RemoteNavModel> = {},
) {
  const full: RemoteNavSnapshot = {
    backends: [backend()],
    selectedAddress: undefined,
    nativeSessionsAvailable: true,
    ...snapshot,
  }
  const model = {
    getSnapshot: () => full,
    subscribe: () => () => undefined,
    openSession: vi.fn<(address: ExternalSessionAddress) => void>(),
    createSession: vi.fn<(address: ExternalWorkspaceAddress) => void>(),
    dispose: () => undefined,
    ...nav,
  } as unknown as RemoteNavModel
  const view = render(React.createElement(RemoteWorkspaceSection, {
    wide: true,
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
    const { view, model } = harness({ backends: [backend('offline')] })
    const host = view.getByRole('button', { name: /Build host · Office · Offline/ })
    expect(host.getAttribute('aria-expanded')).toBe('true')
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

    fireEvent.click(host)
    expect(within(document.body).queryByRole('button', { name: 'Fix sidebar' })).toBeNull()
  })

  it('keeps provider warnings and catalog refresh failures visible on the host group', () => {
    const entry = backend('connected', {
      warning: '新会话已由主机接收，目录尚未同步；请稍后刷新。',
      catalogError: '连接超时',
    })
    const { view } = harness({ backends: [entry] })
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
    const { view } = harness({ backends: [backend('connected', { catalogError: undefined }, [
      session({ title: 'session-1' }),
      session({ id: brand<ExternalSessionId>('session-2'), title: 'Review draft', blank: true }),
    ]) ] })
    expect(view.getByText('2 sessions')).toBeTruthy()
    expandProject(view)
    expect(view.getByRole('button', { name: 'Untitled session' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'Review draft' })).toBeTruthy()
    expect(view.queryByText('session-1')).toBeNull()
  })

  it('reports a core without the native seam instead of offering a local fallback', () => {
    const { view, model } = harness({ backends: [], nativeSessionsAvailable: false })
    expect(view.getByRole('note').textContent).toContain('no native remote-session interface')
    expect(view.getByText('No connected remote hosts yet.')).toBeTruthy()
    expect(model.openSession).not.toHaveBeenCalled()
  })
})
