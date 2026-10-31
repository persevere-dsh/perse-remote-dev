/**
 * Remote model seat: the plugin's composer contribution for remote Sessions (specs/005).
 * It renders the VERIFIED HOST's own `model.list` catalog for the selected external Session
 * and renders nothing for local Sessions, so exactly one model control is visible in every
 * state. It mounts on the list-kind composer seam (`conversation.input.right`): the named
 * `conversation.input.model` seat is `kind: 'single'`, and any second registration there
 * either throws (same priority) or shadows the core seat for every Session — which would
 * remove the local catalog seat from local Sessions. Selections go to the host
 * (`session.setModel`, or the create-time model path in the backend); no local catalog or
 * local `selectModel` is ever read or dispatched for a remote Session.
 */
import * as React from 'react'
import type { PcRemoteModel, PcRemoteModelList } from '../native-sessions/protocol.ts'

export const PC_MODEL_LOCALE = 'perse.remote.model'

export type PcModelLocaleKey =
  | 'seatLabel' | 'loading' | 'loadFailed' | 'unavailable' | 'defaultSuffix' | 'notSelectable' | 'selectPlaceholder'

export const pcModelLocale: Record<'zh' | 'en', Record<PcModelLocaleKey, string>> = {
  zh: {
    seatLabel: '远程模型', loading: '正在读取远程主机模型…', loadFailed: '远程模型列表读取失败：{reason}',
    unavailable: '该连接未宣告模型切换能力', defaultSuffix: '（默认）', notSelectable: '不可选', selectPlaceholder: '选择远程模型',
  },
  en: {
    seatLabel: 'Remote model', loading: 'Loading remote host models…', loadFailed: 'Could not load the remote model list: {reason}',
    unavailable: 'This connection does not advertise model selection', defaultSuffix: ' (default)', notSelectable: 'not selectable', selectPlaceholder: 'Select a remote model',
  },
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy of the remote-host model seat (specs/005). */
    'perse.remote.model': PcModelLocaleKey
  }
}

export interface PcRemoteModelSeatBackend {
  listModels(options?: { readonly fresh?: boolean }): Promise<PcRemoteModelList>
  setModel(sessionId: string, model: string, reasoningEffort?: string): Promise<{ readonly provider: string; readonly model: string }>
  modelSelectionAvailable(): boolean
  /** Durable host selection projected for the open remote Session, if any. */
  currentSelectionOf(remoteSessionId: string): { readonly provider: string; readonly model: string } | null
}

export interface PcRemoteModelSeatHost {
  readonly backend: PcRemoteModelSeatBackend
  readonly remoteSessionId: string
}

export interface PcRemoteModelSeatInjected {
  /** Resolves only for external (remote) Sessions; local Sessions receive undefined. */
  lookup(): PcRemoteModelSeatHost | undefined
  t(key: PcModelLocaleKey, params?: Record<string, unknown>): string
}

type SeatState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly list: PcRemoteModelList }
  | { readonly status: 'error'; readonly reason: string }

function interpolate(template: string, params: Record<string, unknown> | undefined): string {
  let value = template
  for (const [name, item] of Object.entries(params ?? {})) value = value.replace(`{${name}}`, String(item))
  return value
}

/** The composer seat for remote Sessions. Local Sessions and non-external rows render nothing. */
export function PcRemoteModelSeat(props: PcRemoteModelSeatInjected): React.ReactNode {
  // The slot is session-scoped: the fiber exists per open Session, so the host is resolved
  // once at mount. Resolving per render would let an unstable `lookup` identity loop updates.
  const [host] = React.useState(() => props.lookup())
  const t = props.t
  const [state, setState] = React.useState<SeatState>({ status: 'loading' })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [switchError, setSwitchError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (host === undefined || !host.backend.modelSelectionAvailable()) return undefined
    let live = true
    void host.backend.listModels({ fresh: true }).then(
      list => { if (live) setState({ status: 'ready', list }) },
      error => { if (live) setState({ status: 'error', reason: error instanceof Error ? error.message : String(error) }) },
    )
    return () => { live = false }
  }, [host])

  if (host === undefined) return null
  if (!host.backend.modelSelectionAvailable()) {
    return React.createElement('span', { title: t('seatLabel'), 'data-perse-model-seat': 'unavailable' }, t('unavailable'))
  }
  if (state.status === 'loading') {
    return React.createElement('span', { 'data-perse-model-seat': 'loading' }, t('loading'))
  }
  if (state.status === 'error') {
    return React.createElement('span', { 'data-perse-model-seat': 'error' }, interpolate(t('loadFailed'), { reason: state.reason }))
  }

  const current = selectedId ?? (() => {
    const selection = host.backend.currentSelectionOf(host.remoteSessionId)
    if (selection === null) return null
    return state.list.models.find(model => model.id === `${selection.provider}/${selection.model}`)?.id ?? null
  })()

  const groups = new Map<string, { name: string; models: PcRemoteModel[] }>()
  for (const model of state.list.models) {
    const group = groups.get(model.provider)
    if (group === undefined) groups.set(model.provider, { name: model.providerName, models: [model] })
    else group.models.push(model)
  }

  return React.createElement('label', { 'data-perse-model-seat': 'remote' },
    React.createElement('span', { hidden: true }, t('seatLabel')),
    React.createElement('select', {
      'aria-label': t('seatLabel'),
      value: current ?? '',
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
        const id = event.target.value
        const model = state.status === 'ready' ? state.list.models.find(entry => entry.id === id) : undefined
        if (model === undefined || !model.selectable) return
        setSwitchError(null)
        setSelectedId(model.id)
        void host.backend.setModel(host.remoteSessionId, model.id).then(
          selection => { setSelectedId(`${selection.provider}/${selection.model}`) },
          error => { setSelectedId(null); setSwitchError(error instanceof Error ? error.message : String(error)) },
        )
      },
    },
      React.createElement('option', { value: '' }, t('selectPlaceholder')),
      [...groups.entries()].map(([provider, group]) => React.createElement('optgroup', { key: provider, label: group.name },
        group.models.map(model => React.createElement('option', {
          key: model.id,
          value: model.selectable ? model.id : '',
          disabled: !model.selectable,
        }, `${model.name}${model.isDefault ? t('defaultSuffix') : ''}${model.selectable ? '' : ` — ${t('notSelectable')}`}${model.reasoningEfforts?.length ? ` · ${model.reasoningEfforts.length}` : ''}`)),
      )),
    ),
    state.list.failures.map(failure => React.createElement('span', { key: failure.provider, 'data-perse-model-failure': failure.provider }, interpolate(t('loadFailed'), { reason: failure.reason }))),
    switchError === null ? null : React.createElement('span', { 'data-perse-model-seat': 'switch-error' }, interpolate(t('loadFailed'), { reason: switchError })),
  )
}
