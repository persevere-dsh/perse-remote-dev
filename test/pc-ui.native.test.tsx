// @vitest-environment jsdom
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPcConnectionController } from '../packages/perse-remote-dev/src/client/connections/index.ts'
import type { PcRemote } from '../packages/perse-remote-dev/src/client/connections/types.ts'
import { LegacyConfigSettings, PcConnectionSettings, pcConnectionLocale } from '../packages/perse-remote-dev/src/client/pc-ui/index.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const ReactApi = await import('react')
  return {
    Button: (props: React.ComponentProps<'button'>) => ReactApi.createElement('button', props, props.children),
    Input: (props: React.ComponentProps<'input'>) => ReactApi.createElement('input', props),
  }
})

afterEach(cleanup)

function makeTranslator(language: 'zh' | 'en') {
  return (key: keyof typeof pcConnectionLocale.en, params?: Record<string, unknown>): string => {
    let value: string = pcConnectionLocale[language][key]
    for (const [name, item] of Object.entries(params ?? {})) value = value.replace(`{${name}}`, String(item))
    return value
  }
}

function createController(remoteOverrides: Partial<PcRemote> = {}) {
  const unavailable = async () => ({ ok: false as const, error: new Error('test remote method was not expected') })
  const remote: PcRemote = {
    legacyConfigPreview: unavailable,
    legacyConfigApply: unavailable,
    pcProfiles: unavailable,
    pcPairPreview: unavailable,
    pcPairConfirm: unavailable,
    pcConnect: unavailable,
    pcDisconnect: unavailable,
    pcForget: unavailable,
    pcRevoke: unavailable,
    pcCall: unavailable,
    ...remoteOverrides,
  }
  const controller = createPcConnectionController({ remote })
  let subscribed = 0
  let unsubscribed = 0
  const subscribe = controller.subscribe.bind(controller)
  controller.subscribe = (listener) => {
    subscribed += 1
    const dispose = subscribe(listener)
    return () => { unsubscribed += 1; dispose() }
  }
  const useConnection = <T,>(selector: (snapshot: ReturnType<typeof controller.getSnapshot>) => T): T => {
    const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    return selector(snapshot)
  }
  return { controller, useConnection, subscriptionCounts: () => ({ subscribed, unsubscribed }) }
}

describe('PC connection settings native hook and locale contract', () => {
  it('previews field names without rendering stored host values and applies only after confirmation', async () => {
    const preview = {
      sources: ['settings.yaml.imported'] as const,
      source: 'settings.yaml.imported' as const,
      sourcePath: '/isolated/profile/settings.yaml.imported',
      sha256: 'a'.repeat(64),
      importableFields: ['hosts', 'workspace'],
      conflictFields: [],
      unsupportedFields: [],
      canApply: true,
    }
    const remote = {
      legacyConfigPreview: vi.fn(async () => ({ ok: true as const, value: preview })),
      legacyConfigApply: vi.fn(async () => ({ ok: true as const, value: {
        source: 'settings.yaml.imported' as const, importedFields: ['hosts', 'workspace'], alreadyAppliedFields: [],
      } })),
    }
    vi.stubGlobal('confirm', vi.fn(() => true))
    const view = render(React.createElement(LegacyConfigSettings, { remote, t: makeTranslator('en') }))
    await act(async () => { view.getByRole('button', { name: 'Preview legacy settings' }).click() })
    expect(view.getByText(/hosts, workspace/)).toBeTruthy()
    expect(view.container.textContent).not.toContain('secret-value')
    await act(async () => { view.getByRole('button', { name: 'Confirm and write to this profile' }).click() })
    expect(remote.legacyConfigApply).toHaveBeenCalledWith({ source: 'settings.yaml.imported', sha256: 'a'.repeat(64) })
    expect(view.getByRole('status').textContent).toBe('Legacy settings were written to this profile.')
    vi.unstubAllGlobals()
  })

  it('rediscovers both legacy files after previewing one, so either source can be selected', async () => {
    const selectedPreview = (source: 'settings.yaml' | 'settings.yaml.imported') => ({
      sources: ['settings.yaml', 'settings.yaml.imported'] as const,
      source,
      sourcePath: `/isolated/profile/${source}`,
      sha256: source === 'settings.yaml' ? 'a'.repeat(64) : 'b'.repeat(64),
      importableFields: ['workspace'],
      conflictFields: [],
      unsupportedFields: [],
      canApply: true,
    })
    const remote = {
      legacyConfigPreview: vi.fn(async (request: { source?: 'settings.yaml' | 'settings.yaml.imported' }) => ({
        ok: true as const,
        value: request.source === undefined
          ? { sources: ['settings.yaml', 'settings.yaml.imported'] as const, importableFields: [], conflictFields: [], unsupportedFields: [], canApply: false }
          : selectedPreview(request.source),
      })),
      legacyConfigApply: vi.fn(async () => ({ ok: true as const, value: {
        source: 'settings.yaml.imported' as const, importedFields: ['workspace'], alreadyAppliedFields: [],
      } })),
    }
    const view = render(React.createElement(LegacyConfigSettings, { remote, t: makeTranslator('en') }))
    const previewButton = () => view.getByRole('button', { name: 'Preview legacy settings' })

    await act(async () => { previewButton().click() })
    expect(remote.legacyConfigPreview).toHaveBeenNthCalledWith(1, {})
    expect(view.getByRole('button', { name: 'settings.yaml' })).toBeTruthy()
    expect(view.getByRole('button', { name: 'settings.yaml.imported' })).toBeTruthy()

    await act(async () => { view.getByRole('button', { name: 'settings.yaml' }).click() })
    expect(view.container.querySelector('[data-legacy-preview="settings.yaml"]')).toBeTruthy()
    expect(view.queryByRole('button', { name: 'settings.yaml.imported' })).toBeNull()

    await act(async () => { previewButton().click() })
    expect(remote.legacyConfigPreview).toHaveBeenNthCalledWith(3, {})
    expect(view.getByRole('button', { name: 'settings.yaml.imported' })).toBeTruthy()
    await act(async () => { view.getByRole('button', { name: 'settings.yaml.imported' }).click() })
    expect(remote.legacyConfigPreview).toHaveBeenNthCalledWith(4, { source: 'settings.yaml.imported' })
    expect(view.container.querySelector('[data-legacy-preview="settings.yaml.imported"]')).toBeTruthy()
  })

  it('shows the identity footnote only while a verified host connection is active', async () => {
    const profile = {
      profileId: 'profile-1', endpoint: 'https://host.example', networkMode: 'https' as const,
      hostId: 'host-1', hostName: 'Test host', deviceId: 'device-1', deviceName: 'This PC',
      status: 'disconnected' as const,
    }
    const source = createController({
      pcProfiles: async () => ({ ok: true, value: { profiles: [profile] } }),
      pcConnect: async () => ({
        ok: true,
        value: { profileId: profile.profileId, hostId: profile.hostId, generation: 'generation-1', hostInfoJson: JSON.stringify({ id: profile.hostId, name: profile.hostName }) },
      }),
    })
    const view = render(React.createElement(PcConnectionSettings, {
      controller: source.controller,
      useConnection: source.useConnection,
      t: makeTranslator('en'),
    }))

    expect(view.container.querySelector('.pcConnectionFootnote')).toBeNull()
    await act(async () => { await source.controller.refreshProfiles() })
    expect(view.container.querySelector('.pcConnectionFootnote')).toBeNull()
    await act(async () => { await source.controller.connectProfile(profile.profileId) })
    expect(view.getByText('Host identity verified; local DSH sessions are unaffected.')).toBeTruthy()

    view.unmount()
    source.controller.dispose()
  })

  it('subscribes to the controller snapshot and releases it when the panel unmounts', () => {
    const source = createController()
    const view = render(React.createElement(PcConnectionSettings, {
      controller: source.controller,
      useConnection: source.useConnection,
      t: makeTranslator('en'),
    }))
    expect(view.getByRole('heading', { name: 'Remote connection' })).toBeTruthy()
    expect(source.subscriptionCounts()).toEqual({ subscribed: 1, unsubscribed: 0 })
    act(() => source.controller.setNativeSessionSupport('available'))
    expect(view.container.querySelector('[data-pc-native-session-support]')).toBeNull()
    view.unmount()
    expect(source.subscriptionCounts()).toEqual({ subscribed: 1, unsubscribed: 1 })
    source.controller.dispose()
  })

  it('updates locale copy without replacing the connection controller or its snapshot', () => {
    const source = createController()
    const view = render(React.createElement(PcConnectionSettings, {
      controller: source.controller,
      useConnection: source.useConnection,
      t: makeTranslator('en'),
    }))
    act(() => source.controller.setNativeSessionSupport('available'))
    expect(view.container.querySelector('[data-pc-native-session-support]')).toBeNull()
    view.rerender(React.createElement(PcConnectionSettings, {
      controller: source.controller,
      useConnection: source.useConnection,
      t: makeTranslator('zh'),
    }))
    expect(view.getByRole('heading', { name: '远程连接' })).toBeTruthy()
    expect(view.getByRole('heading', { name: '添加远程主机' })).toBeTruthy()
    expect(view.getByPlaceholderText('此电脑')).toBeTruthy()
    expect(view.container.querySelector('[data-pc-native-session-support]')).toBeNull()
    expect(source.subscriptionCounts()).toEqual({ subscribed: 1, unsubscribed: 0 })
    view.unmount()
    source.controller.dispose()
  })
})
