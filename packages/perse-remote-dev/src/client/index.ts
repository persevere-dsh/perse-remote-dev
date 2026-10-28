/** Browser entry for PC pairing and connection settings. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/remote'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import remoteDevRemote from 'perse-remote-dev/remote'
import { createPcConnectionController } from './connections/index.ts'
import { PC_CONNECTION_LOCALE, PcConnectionSettings, PcPanelIcon, pcConnectionLocale } from './pc-ui/index.ts'
import { PcNativeSessionIntegration } from './native-sessions/integration.ts'
import type { ExternalSessionsRegistry } from './native-sessions/core-types.ts'
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
    inject: ['slots', 'locale', 'remote.remoteDev', 'sessions'],
    apply: applyPcUi,
  })
  console.log(LOG, 'PC connection settings mounted')
  return async () => { await disposeRemote() }
}

function applyPcUi(ctx: Context): void {
  const remote = ctx.remote.remoteDev as PcRemote
  const controller = createPcConnectionController({ remote })
  const t = ctx.locale.bind(PC_CONNECTION_LOCALE)
  ctx.effect(() => ctx.locale.register(PC_CONNECTION_LOCALE, pcConnectionLocale), 'remote connection dictionaries')
  // Older DSH builds keep pairing/settings available while clearly reporting
  // that the native external-session API requires a newer core.
  const sessions = ctx.get('sessions') as ExternalSessionsRegistry
  const nativeSessions = new PcNativeSessionIntegration({ sessions, controller, remote })
  // The native integration owns the one activation refresh when its API exists
  // (and restores already-connected profiles from that same result). On older
  // connection-only cores the UI owns only the local profile-list refresh.
  if (controller.getSnapshot().nativeSessionSupport === 'unavailable') void controller.refreshProfiles()

  ctx.slots.inject('main', () => ctx.slots.register(
    {
      name: 'main',
      key: PC_PANEL,
      locale: PC_CONNECTION_LOCALE,
      inject: () => ({ controller, hooks: { connection: controller } }),
    },
    PcConnectionSettings,
  ))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    {
      name: 'sidebar.panellist',
      id: PC_PANEL,
      order: 4,
      label: () => t('panel'),
    },
    PcPanelIcon,
  ))

  ctx.effect(() => () => {
    // Tear down plugin-local connection state; slot hook bindings leave with the slot fiber.
    controller.dispose()
    nativeSessions.dispose()
  }, 'remote connection settings controller')
}
