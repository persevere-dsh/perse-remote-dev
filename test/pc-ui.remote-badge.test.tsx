// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// See the navigation suite: the primitives row ships CSS modules Node cannot import.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const ReactApi = await import('react')
  const icon = (props: { size?: number }) => ReactApi.createElement('svg', { 'data-icon-size': props.size ?? 0 })
  return { IconNewChatOutlineRegular: icon, IconTriangleRightFillRegular: icon }
})
import { RemoteSessionBadge } from '../packages/perse-remote-dev/src/client/remote-nav/index.ts'

afterEach(cleanup)

describe('RemoteSessionBadge', () => {
  it('keeps host identity visible and explains remote-only capabilities accessibly', () => {
    render(React.createElement(RemoteSessionBadge, {
      label: '远程 · Build host / Persevere',
      hint: '使用远程主机的模型；当前连接暂不支持切换模型、上传文件或插入本机命令。',
    }))

    const badge = screen.getByRole('status', {
      name: '远程 · Build host / Persevere. 使用远程主机的模型；当前连接暂不支持切换模型、上传文件或插入本机命令。',
    })
    expect(badge.textContent).toBe('远程 · Build host / Persevere')
    expect(badge.getAttribute('title')).toBe('使用远程主机的模型；当前连接暂不支持切换模型、上传文件或插入本机命令。')
  })

  it('renders nothing for local sessions', () => {
    const { container } = render(React.createElement(RemoteSessionBadge, { label: undefined, hint: undefined }))
    expect(container.firstChild).toBeNull()
  })
})
