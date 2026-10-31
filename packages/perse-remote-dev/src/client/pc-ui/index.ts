import * as React from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { LegacyConfigPreviewValue } from '../../types.ts'
import type { PcConnectionController, PcConnectionSnapshot, PcRemote } from '../connections/index.ts'
import { PC_CONNECTION_CSS } from './styles.ts'

export const PC_CONNECTION_LOCALE = 'perse.remote.connection'

export type PcConnectionLocaleKey =
  | 'panel' | 'title' | 'intro' | 'connected' | 'connecting' | 'offline' | 'revoked' | 'error' | 'disconnected'
  | 'upgradeTitle' | 'upgradeBody' | 'uncertainTitle' | 'uncertainBody' | 'unknownReceipt' | 'receiptDetail' | 'thisDevice'
  | 'ackReceipt' | 'errorFallback' | 'operationError' | 'verifiedHost' | 'connectionDetails' | 'hostId'
  | 'generation' | 'addHost' | 'pairingIntro' | 'pairLink' | 'pairPlaceholder' | 'deviceName' | 'preview'
  | 'previewCreated' | 'verifyHost' | 'confirmPairing' | 'savedHosts' | 'refresh' | 'refreshed' | 'emptyProfiles'
  | 'saved' | 'remoteHost' | 'disconnect' | 'connect' | 'disconnectedNotice' | 'verifiedNotice' | 'revoke'
  | 'revokeConfirm' | 'revokedNotice' | 'forget' | 'forgetConfirm' | 'forgotNotice' | 'footnote'
  | 'checkedHost' | 'host' | 'address' | 'network' | 'permissions' | 'expires' | 'diagnostics'
  | 'previewHost' | 'previewId' | 'networkMode' | 'permissionSummary'
  | 'legacyImport' | 'legacyIntro' | 'legacyPreview' | 'legacyApply' | 'legacySource' | 'legacyFields'
  | 'legacyConflicts' | 'legacyUnsupported' | 'legacyApplied' | 'legacySourcesBoth' | 'legacyNoSource'

export const pcConnectionLocale = {
  zh: {
    panel: '远程连接', title: '远程连接', intro: '管理远程主机的配对与连接。', connected: '已验证连接',
    connecting: '正在验证主机身份…', offline: '离线', revoked: '授权已撤销', error: '连接失败', disconnected: '未连接',
    upgradeTitle: '需要升级 DSH', upgradeBody: '当前 DSH 核心缺少原生远程会话接口。连接配置仍可使用；升级 DSH 后，远程项目和会话会出现在原生工作区中。',
    uncertainTitle: '有 {count} 次远程会话创建结果未知', uncertainBody: '请检查对应主机的会话列表。插件不会自动重试创建，也不会猜测哪条会话由这次操作产生。',
    unknownReceipt: '本地操作核实记录无法读取；请先检查相关主机的会话列表。', receiptDetail: '主机 {hostId}，工作区 {workspaceId}，开始时间 {time}',
    thisDevice: '此电脑', ackReceipt: '我已检查会话列表；仅清除提醒', errorFallback: '操作失败，请重试。', operationError: '操作未完成，请重试。',
    verifiedHost: '主机身份已验证', connectionDetails: '连接详情', hostId: '主机 ID', generation: '连接代次（诊断）',
    addHost: '添加远程主机', pairingIntro: '从被控主机的 Perse Remote 配对管理页生成链接。预览只在本机解析；确认后才交换一次性凭据并验证主机身份。',
    pairLink: '配对链接', pairPlaceholder: '粘贴 persevere://pair#… 链接', deviceName: '设备名称', preview: '预览配对信息',
    previewCreated: '已生成配对预览。', verifyHost: '核对主机信息', confirmPairing: '确认并验证主机', savedHosts: '已保存的主机',
    refresh: '刷新', refreshed: '连接列表已刷新。', emptyProfiles: '还没有保存的主机连接。', saved: '已保存', remoteHost: '远程主机',
    disconnect: '断开', connect: '连接并验证', disconnectedNotice: '已断开主机。', verifiedNotice: '主机身份已验证。', revoke: '撤销此设备',
    revokeConfirm: '撤销后，此设备的授权将失效。继续？', revokedNotice: '设备授权已撤销。', forget: '忘记主机',
    forgetConfirm: '只会移除此设备保存的连接信息，不会撤销主机上的授权。继续？', forgotNotice: '已从本机移除此主机。',
    footnote: '主机身份已核对；本地 DSH 会话不受影响。', checkedHost: '已验证连接', host: '主机', address: '地址', network: '网络',
    permissions: '权限', expires: '有效期', diagnostics: '诊断详情', previewHost: '主机', previewId: '主机 ID',
    networkMode: '网络', permissionSummary: '权限',
    legacyImport: '导入旧远程开发配置', legacyIntro: '显式预览并导入原 settings.yaml 中的 remote-dev 段。预览只显示字段名，不显示主机或凭据内容；旧文件会完整保留。',
    legacyPreview: '预览旧配置', legacyApply: '确认并写入当前 profile', legacySource: '来源文件', legacyFields: '可导入字段',
    legacyConflicts: '冲突字段', legacyUnsupported: '不支持的字段', legacyApplied: '旧配置已写入当前 profile。',
    legacySourcesBoth: '找到两个候选文件，请分别选择并预览。', legacyNoSource: '原生 profile 目录中没有可导入的旧配置文件。',
  },
  en: {
    panel: 'Remote connection', title: 'Remote connection', intro: 'Manage pairing and connections to remote hosts.', connected: 'Verified connection',
    connecting: 'Verifying host identity…', offline: 'Offline', revoked: 'Authorization revoked', error: 'Connection failed', disconnected: 'Not connected',
    upgradeTitle: 'DSH upgrade required', upgradeBody: 'This DSH core does not provide the native remote-session interface. Connection settings remain available; remote projects and sessions will appear in the native workspace after upgrading DSH.',
    uncertainTitle: '{count} remote session creation result(s) are unknown', uncertainBody: 'Check the session list on the relevant host. The plugin will not retry creation or guess which session came from this operation.',
    unknownReceipt: 'The local operation receipt cannot be read. Check the session list on the relevant host first.', receiptDetail: 'Host {hostId}, workspace {workspaceId}, started {time}',
    thisDevice: 'This PC', ackReceipt: 'I checked the session list; clear this reminder only', errorFallback: 'The operation failed. Try again.', operationError: 'The operation did not finish. Try again.',
    verifiedHost: 'Host identity verified', connectionDetails: 'Connection details', hostId: 'Host ID', generation: 'Connection generation (diagnostic)',
    addHost: 'Add remote host', pairingIntro: 'Create a link from Perse Remote pairing management on the host. The preview is parsed locally; one-time credentials are exchanged only after confirmation and host identity verification.',
    pairLink: 'Pairing link', pairPlaceholder: 'Paste a persevere://pair#… link', deviceName: 'Device name', preview: 'Preview pairing',
    previewCreated: 'Pairing preview is ready.', verifyHost: 'Verify host details', confirmPairing: 'Confirm and verify host', savedHosts: 'Saved hosts',
    refresh: 'Refresh', refreshed: 'Connection list refreshed.', emptyProfiles: 'No saved host connections yet.', saved: 'Saved', remoteHost: 'Remote host',
    disconnect: 'Disconnect', connect: 'Connect and verify', disconnectedNotice: 'Host disconnected.', verifiedNotice: 'Host identity verified.', revoke: 'Revoke this device',
    revokeConfirm: 'This will invalidate this device authorization. Continue?', revokedNotice: 'Device authorization revoked.', forget: 'Forget host',
    forgetConfirm: 'This removes the connection saved on this device only; it does not revoke host authorization. Continue?', forgotNotice: 'Host removed from this device.',
    footnote: 'Host identity verified; local DSH sessions are unaffected.', checkedHost: 'Verified connection', host: 'Host', address: 'Address', network: 'Network',
    permissions: 'Permissions', expires: 'Expires', diagnostics: 'Diagnostics', previewHost: 'Host', previewId: 'Host ID',
    networkMode: 'Network', permissionSummary: 'Permissions',
    legacyImport: 'Import legacy remote settings', legacyIntro: 'Preview and explicitly import the remote-dev section from the original settings.yaml. The preview shows field names only; host values and credentials are not displayed. The source file stays intact.',
    legacyPreview: 'Preview legacy settings', legacyApply: 'Confirm and write to this profile', legacySource: 'Source file', legacyFields: 'Importable fields',
    legacyConflicts: 'Conflicting fields', legacyUnsupported: 'Unsupported fields', legacyApplied: 'Legacy settings were written to this profile.',
    legacySourcesBoth: 'Two candidate files were found. Select and preview each explicitly.', legacyNoSource: 'No legacy settings file was found under the native profile directory.',
  },
} satisfies Record<'zh' | 'en', Record<PcConnectionLocaleKey, string>>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'perse.remote.connection': PcConnectionLocaleKey
  }
}

interface PcConnectionSettingsInjected {
  readonly controller: PcConnectionController
  readonly hooks: { readonly connection: HostObservable<PcConnectionSnapshot> }
}
type PcConnectionSettingsProps = InjectFace<PcConnectionSettingsInjected> & {
  readonly useConnection: SnapshotSelectorHook<PcConnectionSnapshot>
} & PropsLocale<typeof PC_CONNECTION_LOCALE>

const h = React.createElement
const css = {
  settings: 'pcConnectionSettings', header: 'pcConnectionHeader', muted: 'pcConnectionMuted', status: 'pcConnectionStatus',
  statusDot: 'pcConnectionStatusDot', boundary: 'pcConnectionBoundary', notice: 'pcConnectionNotice', error: 'pcConnectionError',
  verified: 'pcConnectionVerified', section: 'pcConnectionSection', field: 'pcConnectionField', preview: 'pcConnectionPreview',
  sectionHeading: 'pcConnectionSectionHeading', profile: 'pcConnectionProfile', profileMain: 'pcConnectionProfileMain',
  actions: 'pcConnectionActions', footnote: 'pcConnectionFootnote',
}
const format = (template: string, values: Record<string, string | number> = {}): string =>
  template.replace(/\{([^}]+)\}/g, (_match, key: string) => String(values[key] ?? ''))

function statusLabel(status: string, t: PcConnectionSettingsProps['t']): string {
  switch (status) {
    case 'connected': return t('connected')
    case 'connecting': return t('connecting')
    case 'offline': return t('offline')
    case 'revoked': return t('revoked')
    case 'error': return t('error')
    default: return t('disconnected')
  }
}

function PcConnectionSettings(props: PcConnectionSettingsProps): React.ReactElement {
  const { controller, t } = props
  // The renderer binds this selector to controller.getSnapshot/subscribe.
  // There is no component-owned snapshot copy or subscription lifecycle.
  const snapshot = props.useConnection(value => value)
  const [pairLink, setPairLink] = React.useState('')
  const [deviceName, setDeviceName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [failure, setFailure] = React.useState('')

  const run = async (action: () => unknown | Promise<unknown>, success: string): Promise<void> => {
    setBusy(true)
    setFailure('')
    setMessage('')
    try {
      const result = await action()
      if (result !== null && typeof result === 'object' && 'ok' in result && result.ok === false) {
        const issue = 'failure' in result ? result.failure : 'error' in result ? result.error : undefined
        const detail = issue !== null && typeof issue === 'object' && 'message' in issue && typeof issue.message === 'string'
          ? issue.message : t('errorFallback')
        setFailure(detail)
      } else setMessage(success)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('operationError'))
    } finally {
      setBusy(false)
    }
  }

  const connected = snapshot.connection.status === 'connected' && snapshot.connection.hostInfo !== null && snapshot.connection.generation !== null
  const preview = snapshot.pairingPreview
  const activeProfileId = snapshot.connection.profileId
  const hostInfo = snapshot.connection.hostInfo
  const confirmedHostName = hostInfo !== null && 'hostName' in hostInfo && typeof hostInfo.hostName === 'string'
    ? hostInfo.hostName
    : hostInfo !== null && 'name' in hostInfo && typeof hostInfo.name === 'string' ? hostInfo.name : ''
  const button = (label: string, onClick: () => void, variant: 'primary' | 'outline' = 'outline', disabled = false) =>
    h(Button, { variant, size: 'sm', onClick, disabled }, label)

  return h('main', { className: css.settings, 'data-pc-connection-settings': '1' },
    h('style', { 'data-pc-connection-styles': '1' }, PC_CONNECTION_CSS),
    h('header', { className: css.header },
      h('div', null, h('h1', null, t('title')), h('p', { className: css.muted }, t('intro'))),
      h('div', { className: css.status, 'data-state': connected ? 'connected' : snapshot.connection.status },
        h('span', { className: css.statusDot, 'aria-hidden': true }), h('span', null, statusLabel(snapshot.connection.status, t)))),
    snapshot.nativeSessionSupport === 'unavailable'
      ? h('aside', { className: css.boundary, role: 'note', 'data-pc-native-session-support': snapshot.nativeSessionSupport },
        h('strong', null, t('upgradeTitle')), h('p', null, t('upgradeBody'))) : null,
    message ? h('div', { className: css.notice, role: 'status' }, message) : null,
    snapshot.pendingCreations.length > 0 ? h('div', { className: css.notice, role: 'alert', 'data-pc-creation-uncertain': snapshot.pendingCreations.length },
      h('strong', null, format(t('uncertainTitle'), { count: snapshot.pendingCreations.length })), h('p', null, t('uncertainBody')),
      h('ul', null, ...snapshot.pendingCreations.map(item => h('li', { key: item.operationId },
        h('span', null, item.startedAt === 0 ? t('unknownReceipt') : format(t('receiptDetail'), {
          hostId: item.hostId, workspaceId: item.workspaceId, time: new Date(item.startedAt).toLocaleString(),
        })),
        item.startedAt === 0 ? null : h(Button, { variant: 'outline', size: 'sm', onClick: () => controller.acknowledgeCreationReceipt(item.operationId) }, t('ackReceipt')))))) : null,
    failure ? h('div', { className: css.error, role: 'alert' }, failure,
      snapshot.connection.error?.details === undefined ? null : h('details', null,
        h('summary', null, t('diagnostics')), h('pre', null, String(snapshot.connection.error.details)))) : null,
    connected ? h('div', { className: css.verified, 'data-pc-verified-host': snapshot.connection.hostId ?? '' },
      h('strong', null, confirmedHostName || t('verifiedHost')),
      h('details', null, h('summary', null, t('connectionDetails')), h('dl', null,
        h('dt', null, t('hostId')), h('dd', null, snapshot.connection.hostId),
        h('dt', null, t('generation')), h('dd', null, snapshot.connection.generation)))) : null,
    h('section', { className: css.section },
      h('h2', null, t('addHost')), h('p', { className: css.muted }, t('pairingIntro')),
      h('label', { className: css.field }, h('span', null, t('pairLink')), h('textarea', {
        value: pairLink, rows: 4, autoComplete: 'off', spellCheck: false, placeholder: t('pairPlaceholder'),
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setPairLink(event.currentTarget.value),
      })),
      h('label', { className: css.field }, h('span', null, t('deviceName')), h(Input, {
        value: deviceName, maxLength: 100, placeholder: t('thisDevice'),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDeviceName(event.currentTarget.value),
      })),
      button(t('preview'), () => void run(async () => {
        const outcome = await controller.previewPairing(pairLink)
        if (outcome.ok) setPairLink('')
        return outcome
      }, t('previewCreated')), 'primary', busy || pairLink.trim() === ''),
      preview === null ? null : h('div', { className: css.preview, 'data-pc-pair-preview': '1' },
        h('h3', null, t('verifyHost')), h('dl', null,
          h('dt', null, t('previewHost')), h('dd', null, preview.hostName), h('dt', null, t('previewId')), h('dd', null, preview.hostId),
          h('dt', null, t('address')), h('dd', null, preview.endpoint), h('dt', null, t('networkMode')), h('dd', null, preview.networkMode),
          h('dt', null, t('permissionSummary')), h('dd', null, preview.accessSummary), h('dt', null, t('expires')), h('dd', null, new Date(preview.expiresAt).toLocaleString())),
        button(t('confirmPairing'), () => void run(() => controller.confirmPairing(preview.confirmationId, deviceName || t('thisDevice')), t('verifiedNotice')), 'primary', busy))),
    h('section', { className: css.section },
      h('div', { className: css.sectionHeading }, h('h2', null, t('savedHosts')),
      button(t('refresh'), () => void run(() => controller.refreshProfiles(), t('refreshed')), 'outline', busy)),
      snapshot.profiles.length === 0 ? h('p', { className: css.muted }, t('emptyProfiles')) : null,
      ...snapshot.profiles.map(profile => {
        const isVerifiedActive = connected && profile.profileId === activeProfileId
        const profileStatus = profile.status === 'offline' ? t('offline') : profile.status === 'revoked' ? t('revoked') : t('saved')
        return h('article', { className: css.profile, key: profile.profileId, 'data-pc-profile': profile.profileId },
          h('div', { className: css.profileMain }, h('strong', null, profile.hostName || t('remoteHost')),
            h('span', null, profile.endpoint), h('span', null, `${isVerifiedActive ? t('checkedHost') : profileStatus} · ${profile.networkMode}`)),
          h('div', { className: css.actions },
            button(isVerifiedActive ? t('disconnect') : t('connect'), () => void run(
              () => isVerifiedActive ? controller.disconnectProfile(profile.profileId) : controller.connectProfile(profile.profileId),
              isVerifiedActive ? t('disconnectedNotice') : t('verifiedNotice')), isVerifiedActive ? 'outline' : 'primary', busy),
            button(t('revoke'), () => {
              if (typeof window !== 'undefined' && window.confirm(t('revokeConfirm'))) void run(() => controller.revokeSelf(profile.profileId), t('revokedNotice'))
            }, 'outline', busy || !isVerifiedActive),
            button(t('forget'), () => {
              if (typeof window !== 'undefined' && window.confirm(t('forgetConfirm'))) void run(() => controller.forgetProfile(profile.profileId), t('forgotNotice'))
            }, 'outline', busy)))
      })),
    connected ? h('p', { className: css.footnote }, t('footnote')) : null)
}

interface LegacySettingsInjected { readonly remote: Pick<PcRemote, 'legacyConfigPreview' | 'legacyConfigApply'> }
type LegacySettingsProps = InjectFace<LegacySettingsInjected> & PropsLocale<typeof PC_CONNECTION_LOCALE>

function LegacyConfigSettings(props: LegacySettingsProps): React.ReactElement {
  const { remote, t } = props
  const [preview, setPreview] = React.useState<LegacyConfigPreviewValue>()
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [failure, setFailure] = React.useState('')
  const runPreview = async (selected?: 'settings.yaml' | 'settings.yaml.imported'): Promise<void> => {
    setBusy(true); setFailure(''); setMessage('')
    try {
      const result = await remote.legacyConfigPreview(selected === undefined ? {} : { source: selected })
      if (!result.ok) { setFailure(result.error.message); setPreview(undefined); return }
      setPreview(result.value)
    } catch (error) { setFailure(error instanceof Error ? error.message : t('operationError')) }
    finally { setBusy(false) }
  }
  const apply = async (): Promise<void> => {
    if (preview?.canApply !== true || preview.source === undefined || preview.sha256 === undefined) return
    if (typeof window !== 'undefined' && !window.confirm(t('legacyApply'))) return
    setBusy(true); setFailure(''); setMessage('')
    try {
      const result = await remote.legacyConfigApply({ source: preview.source, sha256: preview.sha256 })
      if (!result.ok) { setFailure(result.error.message); return }
      setMessage(t('legacyApplied')); setPreview(undefined)
    } catch (error) { setFailure(error instanceof Error ? error.message : t('operationError')) }
    finally { setBusy(false) }
  }
  const h = React.createElement
  const button = (label: string, click: () => void, disabled = false) => h(Button, { variant: 'outline', size: 'sm', onClick: click, disabled }, label)
  const candidateButtons = preview !== undefined && preview.source === undefined
    ? preview.sources.map(item => button(item, () => { void runPreview(item) }, busy)) : null
  return h('section', { 'data-legacy-settings-import': '1' },
    h('h2', null, t('legacyImport')), h('p', null, t('legacyIntro')),
    message ? h('p', { role: 'status' }, message) : null,
    failure ? h('p', { role: 'alert' }, failure) : null,
    button(t('legacyPreview'), () => { setPreview(undefined); void runPreview(undefined) }, busy),
    candidateButtons,
    preview?.source === undefined && preview?.sources.length === 0 ? h('p', null, t('legacyNoSource')) : null,
    preview?.source === undefined && (preview?.sources.length ?? 0) > 1 ? h('p', null, t('legacySourcesBoth')) : null,
    preview?.source !== undefined ? h('div', { 'data-legacy-preview': preview.source },
      h('p', null, `${t('legacySource')}: ${preview.sourcePath ?? preview.source}`),
      h('p', null, `${t('legacyFields')}: ${preview.importableFields.join(', ') || '—'}`),
      h('p', null, `${t('legacyConflicts')}: ${preview.conflictFields.join(', ') || '0'}`),
      preview.unsupportedFields.length > 0 ? h('p', { role: 'alert' }, `${t('legacyUnsupported')}: ${preview.unsupportedFields.join(', ')}`) : null,
      button(t('legacyApply'), () => void apply(), busy || !preview.canApply)) : null)
}

export { LegacyConfigSettings, PcConnectionSettings }
export { PC_MODEL_LOCALE, pcModelLocale, PcRemoteModelSeat } from './model-seat.ts'
export type { PcModelLocaleKey, PcRemoteModelSeatInjected, PcRemoteModelSeatHost, PcRemoteModelSeatBackend } from './model-seat.ts'
