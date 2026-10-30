// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// The pc-ui barrel pulls in the primitives row, which ships CSS modules Node cannot import.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const ReactApi = await import('react')
  return {
    Button: (props: React.ComponentProps<'button'>) => ReactApi.createElement('button', props, props.children),
    Input: (props: React.ComponentProps<'input'>) => ReactApi.createElement('input', props),
  }
})

import { PcRemoteModelSeat } from '../packages/perse-remote-dev/src/client/pc-ui/index.ts'
import type { PcRemoteModelList } from '../packages/perse-remote-dev/src/client/native-sessions/protocol.ts'

afterEach(cleanup)

const catalog: PcRemoteModelList = {
  models: [
    { id: 'alpha/m0', provider: 'alpha', providerName: 'Alpha', name: 'Alpha M0', isDefault: true, selectable: true, reasoningEfforts: ['low', 'high'] },
    { id: 'beta/b1', provider: 'beta', providerName: 'Beta', name: 'Beta B1', isDefault: false, selectable: false },
  ],
  default: { provider: 'alpha', model: 'm0' },
  failures: [],
  truncated: false,
}

const zh: Record<string, string> = {
  seatLabel: '远程模型', loading: '正在读取远程主机模型…', loadFailed: '远程模型列表读取失败：{reason}',
  unavailable: '该连接未宣告模型切换能力', defaultSuffix: '（默认）', notSelectable: '不可选', selectPlaceholder: '选择远程模型',
}
const t = (key: string) => zh[key] ?? key

describe('PcRemoteModelSeat', () => {
  it('renders nothing for local sessions so the local seat stays alone', () => {
    const { container } = render(React.createElement(PcRemoteModelSeat, { lookup: () => undefined, t }))
    expect(container.firstChild).toBeNull()
  })

  it('explains unavailability without ever fabricating a catalog', async () => {
    const listModels = vi.fn()
    const { container } = render(React.createElement(PcRemoteModelSeat, {
      lookup: () => ({
        remoteSessionId: 'remote-1',
        backend: { listModels, setModel: vi.fn(), modelSelectionAvailable: () => false, currentSelectionOf: () => null },
      }),
      t,
    }))
    expect(container.querySelector('[data-perse-model-seat="unavailable"]')?.textContent).toBe('该连接未宣告模型切换能力')
    expect(listModels).not.toHaveBeenCalled()
  })

  it('renders the remote host catalog with provider groups, default marker and disabled non-selectable rows', async () => {
    const setModel = vi.fn().mockResolvedValue({ provider: 'alpha', model: 'm0' })
    render(React.createElement(PcRemoteModelSeat, {
      lookup: () => ({
        remoteSessionId: 'remote-1',
        backend: {
          listModels: async () => catalog,
          setModel,
          modelSelectionAvailable: () => true,
          currentSelectionOf: () => ({ provider: 'alpha', model: 'm0' }),
        },
      }),
      t,
    }))
    const select = await screen.findByRole('combobox', { name: '远程模型' })
    expect((select as HTMLSelectElement).value).toBe('alpha/m0')
    expect(select.querySelector('optgroup[label="Beta"]')).not.toBeNull()
    const defaultOption = select.querySelector('option[value="alpha/m0"]')
    expect(defaultOption?.textContent).toContain('（默认）')
    const disabledOption = select.querySelector('option:disabled')
    expect(disabledOption).not.toBeNull()
    expect(disabledOption?.textContent).toContain('不可选')
  })

  it('sends a model change to the remote host exactly once with the remote session id', async () => {
    const setModel = vi.fn().mockResolvedValue({ provider: 'beta', model: 'b1' })
    render(React.createElement(PcRemoteModelSeat, {
      lookup: () => ({
        remoteSessionId: 'remote-9',
        backend: { listModels: async () => ({ ...catalog, default: null }), setModel, modelSelectionAvailable: () => true, currentSelectionOf: () => null },
      }),
      t,
    }))
    const select = await screen.findByRole('combobox', { name: '远程模型' })
    fireEvent.change(select, { target: { value: 'alpha/m0' } })
    await waitFor(() => expect(setModel).toHaveBeenCalledWith('remote-9', 'alpha/m0'))
    expect(setModel).toHaveBeenCalledTimes(1)
  })

  it('surfaces a load failure instead of silently rendering an empty or local catalog', async () => {
    const { container } = render(React.createElement(PcRemoteModelSeat, {
      lookup: () => ({
        remoteSessionId: 'remote-1',
        backend: {
          listModels: async () => { throw new Error('host said no') },
          setModel: vi.fn(),
          modelSelectionAvailable: () => true,
          currentSelectionOf: () => null,
        },
      }),
      t,
    }))
    const error = await waitFor(() => {
      const node = container.querySelector('[data-perse-model-seat="error"]')
      if (node === null) throw new Error('error state not rendered yet')
      return node
    })
    expect(error.textContent).toContain('host said no')
    expect(container.querySelector('select')).toBeNull()
  })
})
