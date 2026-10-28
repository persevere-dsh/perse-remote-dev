// @vitest-environment jsdom
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPcConnectionController } from '../packages/perse-remote-dev/src/client/connections/index.ts'
import type { PcRemote } from '../packages/perse-remote-dev/src/client/connections/types.ts'
import { PcConnectionSettings, pcConnectionLocale } from '../packages/perse-remote-dev/src/client/pc-ui/index.ts'

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

function createController() {
  const unavailable = async () => ({ ok: false as const, error: new Error('test remote method was not expected') })
  const remote: PcRemote = {
    pcProfiles: unavailable,
    pcPairPreview: unavailable,
    pcPairConfirm: unavailable,
    pcConnect: unavailable,
    pcDisconnect: unavailable,
    pcForget: unavailable,
    pcRevoke: unavailable,
    pcCall: unavailable,
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
