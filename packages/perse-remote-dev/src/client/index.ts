/** Browser entry for PC pairing, connection settings and native remote navigation. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import remoteDevRemote from 'perse-remote-dev/remote'
import { createPcConnectionController } from './connections/index.ts'
import { PC_CONNECTION_LOCALE, LegacyConfigSettings, PcConnectionSettings, pcConnectionLocale, PC_MODEL_LOCALE, PcRemoteModelSeat, pcModelLocale } from './pc-ui/index.ts'
import type { PcModelLocaleKey } from './pc-ui/index.ts'
import { PcNativeSessionIntegration } from './native-sessions/integration.ts'
import type { ExternalSessionsRegistry } from './native-sessions/core-types.ts'
import { REMOTE_NAV_LOCALE, RemoteSessionBadge, RemoteWorkspaceSection, remoteNavLocale } from './remote-nav/index.ts'
import { createRemoteNavModel, asNativeSessionId, externalBindingOf, navigationApiOf, type NativeSessionId } from './remote-nav/model.ts'
import type { PcRemote } from './connections/types.ts'

const PC_PANEL = 'perse-remote-connection'
const LOG = '[perse-remote-dev]'

/** Assembly row: mount the generated local owner Remote namespace first. */
export const inject = ['remote']

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(remoteDevRemote)
  ctx.plugin({
    name: 'remote-dev-client/connection-settings',
    // Wait for the DSH session service to activate before reading its registry.
    // Older DSH versions also provide `sessions`; their missing optional methods
    // are detected by PcNativeSessionIntegration after this lifecycle gate.
    inject: ['slots', 'locale', 'layout', 'uiWorkspace', 'remote.remoteDev', 'sessions'],
    apply: applyPcUi,
  })
  console.log(LOG, 'PC connection settings mounted')
  return async () => { await disposeRemote() }
}

function applyPcUi(ctx: Context): void {
  const remote = ctx.remote.remoteDev as PcRemote
  const controller = createPcConnectionController({ remote })
  const t = ctx.locale.bind(PC_CONNECTION_LOCALE)
  const tn = ctx.locale.bind(REMOTE_NAV_LOCALE)
  const tm = ctx.locale.bind(PC_MODEL_LOCALE)
  ctx.effect(() => ctx.locale.register(PC_CONNECTION_LOCALE, pcConnectionLocale), 'remote connection dictionaries')
  ctx.effect(() => ctx.locale.register(REMOTE_NAV_LOCALE, remoteNavLocale), 'remote navigation dictionaries')
  ctx.effect(() => ctx.locale.register(PC_MODEL_LOCALE, pcModelLocale), 'remote model seat dictionaries')
  // Older DSH builds keep pairing/settings available while clearly reporting
  // that the native external-session API requires a newer core.
  const sessions = ctx.get('sessions') as ExternalSessionsRegistry
  const nativeSessions = new PcNativeSessionIntegration({ sessions, controller, remote })
  // The native integration owns the one activation refresh when its API exists
  // (and restores already-connected profiles from that same result). On older
  // connection-only cores the UI owns only the local profile-list refresh.
  if (controller.getSnapshot().nativeSessionSupport === 'unavailable') void controller.refreshProfiles()

  // Opening/creating a remote Session goes through the core Workspace navigation
  // service, never through a plugin-local agent. Only the patched core carries the
  // external-session verbs, so detect them rather than assuming the service shape.
  const navigation = navigationApiOf(serviceOf(ctx, 'uiWorkspace'))
  const nav = createRemoteNavModel({
    getBackends: () => nativeSessions.getBackends(),
    subscribeBackends: listener => nativeSessions.subscribeBackends(listener),
    // Row inventory: every stored profile renders, from the bridge-reported
    // profile list (status observation + autoConnect intent marker only — the
    // durable desiredState stays host-side).
    getProfiles: () => controller.getSnapshot().profiles,
    subscribeProfiles: listener => controller.subscribe(listener),
    // The one host whose installed generation serves native sessions; a
    // connected-but-not-active host still renders its true status, without a tree.
    getActiveProfileId: () => nativeSessions.getActiveProfileId(),
    // One explicit user-requested attempt per call, for exactly this profile:
    // the same controller path the automatic loop uses (reverify-only,
    // no Session recreated, no prompt replayed). No timer is ever armed here.
    connectProfile: profileId => {
      void controller.connectProfile(profileId).then(outcome => {
        if (!outcome.ok) console.warn(LOG, 'remote host connect failed:', outcome.failure.code, outcome.failure.message)
      }, (error: unknown) => { console.warn(LOG, 'remote host connect failed:', error) })
    },
    navigation,
    onActionError: (error: unknown) => { console.warn(LOG, 'remote session action failed:', error) },
  })
  const openConnections = (): void => { ctx.layout.selectPanel(PC_PANEL as MainPanelId) }

  ctx.slots.inject('main', () => ctx.slots.register(
    {
      name: 'main',
      key: PC_PANEL,
      locale: PC_CONNECTION_LOCALE,
      inject: () => ({ controller, hooks: { connection: controller } }),
    },
    PcConnectionSettings,
  ))

  // Stored-host navigation contributes to the core's generic
  // `sidebar.workspaces.secondary` list hole: its own bordered section inside
  // the workspace region, below the local Workspace/Session tree, rendered
  // wide-only. This replaces the old `sidebar.footer.action` seat — below the
  // account row, which the owner rejected (「远程主机位置太靠下了，要和工作区
  // 一起，只是分开区分而已」). The hole's owner passes no props, so all data
  // rides on this contribution's own inject face; nothing remote-specific
  // enters core types. Ordering: ascending explicit `order` — 50 places the
  // group above any future section that keeps the default; equal `order`
  // keeps registration order, the core's documented tie rule. The group
  // still does not take `sidebar.workspaces` itself: that hole is `single`,
  // occupied by ui-workspace's own browser, and shadowing it would replace
  // the local workspace tree, which N07 forbids. Connection management
  // stays reachable from inside the group's header (and from the settings
  // section); it has no first-level panel row.
  ctx.effect(() => ctx.slots.inject('sidebar.workspaces.secondary', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces.secondary',
      id: 'perse-remote-dev-remote-hosts',
      order: 50,
      locale: REMOTE_NAV_LOCALE,
      inject: () => ({ nav, openConnections, hooks: { nav } }),
    },
    RemoteWorkspaceSection,
  )), 'remote workspace group')

  // The selected remote Session keeps its host/project identity in the native
  // conversation header; local Sessions render nothing here.
  ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
    {
      name: 'conversation.session.header.utilities',
      id: 'perse-remote-dev-session-badge',
      locale: REMOTE_NAV_LOCALE,
      inject: (sessionId: string) => remoteSessionIdentity(sessions, nativeSessions, asNativeSessionId(sessionId), tn),
    },
    RemoteSessionBadge,
  )), 'remote Session identity')

  // Remote Sessions keep model choice on the verified host: this contribution to the
  // official composer slot renders the host's own `model.list` catalog and renders nothing
  // for local Sessions, so exactly one model control stays visible per Session state.
  // (specs/005.) The named `conversation.input.model` seat is `kind: 'single'` — registering
  // beside the core seat either throws (same priority) or shadows it for every Session
  // (ui-slots entriesOfSlot), which would strip the local catalog seat from local Sessions;
  // the core seat itself returns null while `capabilities.modelSelection` is false, so the
  // list-kind seam beside it is the only official mount that keeps both states correct.
  ctx.effect(() => ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
    {
      name: 'conversation.input.right',
      id: 'perse-remote-dev-model-seat',
      locale: PC_MODEL_LOCALE,
      inject: (sessionId: string) => ({
        lookup: () => {
          const host = nativeSessions.seatHostFor(sessionId)
          if (host === undefined) return undefined
          return { backend: host.backend, remoteSessionId: host.remoteSessionId }
        },
        t: (key: PcModelLocaleKey, params?: Record<string, unknown>) => tm(key, params),
      }),
    },
    PcRemoteModelSeat,
  )), 'remote model seat')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'remote-dev-legacy-import', order: 25,
    label: () => t('legacyImport'), locale: PC_CONNECTION_LOCALE,
    inject: () => ({ remote }),
  }, LegacyConfigSettings))

  ctx.effect(() => () => {
    // Tear down plugin-local connection state; slot hook bindings leave with the slot fiber.
    nav.dispose()
    controller.dispose()
    nativeSessions.dispose()
  }, 'remote connection settings controller')
}

/** Read an optional core service without failing activation when a runtime lacks it. */
function serviceOf(ctx: Context, name: string): unknown {
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/** Header badge label for a remote Session, resolved from the plugin's own catalog. */
function remoteSessionIdentity(
  sessions: ExternalSessionsRegistry,
  nativeSessions: PcNativeSessionIntegration,
  sessionId: NativeSessionId,
  t: (key: 'header.remote' | 'header.remoteHint' | 'header.remoteHintWithModel', params?: Record<string, string>) => string,
): { readonly label: string | undefined; readonly hint: string | undefined } {
  const identity = externalBindingOf(sessions, sessionId)
  if (identity === undefined) return { label: undefined, hint: undefined }
  const backend = nativeSessions.getBackends().find(candidate =>
    candidate.backendId === identity.backendId && candidate.hostId === identity.hostId)
  const workspace = backend?.workspaces.find(candidate => candidate.id === identity.address.workspaceId)
  const seat = nativeSessions.seatHostFor(String(sessionId))
  return {
    label: t('header.remote', { host: identity.hostName, workspace: workspace?.name ?? identity.profileName }),
    hint: seat !== undefined && seat.backend.modelSelectionAvailable()
      ? t('header.remoteHintWithModel')
      : t('header.remoteHint'),
  }
}
