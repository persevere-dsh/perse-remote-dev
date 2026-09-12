/**
 * `perse-remote-dev` — browser half.
 *
 * Two nested Cordis plugins, because the Client Remote namespace must be
 * *mounted* and *consumed*, and a single plugin cannot do both:
 *
 *   1. {@link apply} (the Loader entry, `inject = ['remote']`) mirrors the
 *      official assembly in `@deepseek-ai/dsh-api-remotes/client`: it mounts the
 *      frozen host package's generated contribution through the protocol's
 *      public `ctx.remote.$mount()` API. The out-of-tree workspace gets no
 *      official assembly row, so this row *is* the seam — the same call the
 *      official list makes, not a workaround.
 *
 *   2. {@link applyUi} (`inject = ['slots', 'remote', 'remote.remoteDev']`)
 *      owns every call site and every slot registration. It is a nested plugin
 *      rather than the entry plugin's own body on purpose: if the entry plugin
 *      declared `remote.remoteDev` in its own `inject`, its fiber could
 *      only be satisfied by a service its own `apply` has not run yet — a
 *      guaranteed PENDING, i.e. exactly the "pending (waiting for service)"
 *      cold-start failure this delivery must not produce.
 *
 * Call discipline: every method call is written
 * `ctx.remote.remoteDev.<method>(request)` with its generated signature;
 * results are discriminated on `error.code`; no `instanceof`, no defensive
 * `catch`, no narrowed or manually written signature.
 */
import type { Context } from '@deepseek-ai/cordis'
import remoteDevRemote from 'perse-remote-dev/remote'
import { DirectoryFlow, HostBadge, RemoteDevSection, ReviewPanel, useCell } from './components.ts'
import type { BadgeFace, FlowFace, ReviewFace, SectionFace } from './components.ts'
import type { Failure, HostsSnapshot } from './model.ts'
import { RemoteWorkspaceClient } from './model.ts'
import { failureText } from './messages.ts'
import { ensureStyles } from './styles.ts'

/** Log prefix for every line this plugin prints. */
const LOG = '[perse-remote-dev]'

/** Slot names — the five slots this plugin registers. */
const SLOT_HEADER = 'conversation.session.header.actions'
const SLOT_SETTINGS_SECTION = 'settings.section'
const SLOT_FLOW_HERO = 'conversation.hero.workspace.directoryFlow'
const SLOT_FLOW_SIDEBAR = 'sidebar.workspaces.directoryFlow'
const SLOT_OVERLAY = 'shell.overlay'

/**
 * Shadow priority for the two `directoryFlow` **single** slots: that hole's
 * documented rule is "a different priority shadows; lowest renders", and the
 * built-in picker registers at 0.
 */
const FLOW_PRIORITY = -1

/** Assembly row: the protocol's public mount API, exactly as official code calls it. */
export const inject = ['remote']

/**
 * Mount the frozen host package's `remoteDev` contribution and install the
 * consumer UI.
 * @param ctx - Client root context carrying the typed Remote facade.
 * @returns disposer that unmounts the contribution (the nested UI plugin is
 * owned by this fiber and unwinds with it).
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const dispose = await ctx.remote.$mount(remoteDevRemote)
  ctx.plugin({ name: 'remote-dev-client/ui', inject: ['slots', 'remote', 'remote.remoteDev'], apply: applyUi })
  console.log(LOG, 'client half: remoteDev namespace mounted')
  return async () => {
    await dispose()
  }
}

/**
 * Consumer plugin body: the client model, the five slot registrations, and the
 * read hooks/actions components receive through each registration's inject face.
 * @param ctx - Client context that owns `remote.remoteDev` and `slots`.
 */
function applyUi(ctx: Context): void {
  ensureStyles()
  const client = new RemoteWorkspaceClient(ctx)

  // Cheap activation-time reads. `listTargets` here is probe-free: link state is
  // never invented, and the host has no event stream to subscribe to, so a real
  // probe is an explicit user action.
  void client.loadHostFace()
  void client.loadTargets()
  void client.loadConfig()
  void client.loadTunnels()

  /** `ctx.get` (not property access) so a missing ui-workspace degrades to "no system picker". */
  const pickDirectory = async (): Promise<string | null> => {
    const ui = ctx.get('uiWorkspace') as { pickDirectory(): Promise<string | null> } | undefined
    if (ui === undefined) return null
    return await ui.pickDirectory()
  }

  const badgeFace = (): BadgeFace => ({
    // Both cells MUST be subscribed: `activeHost()` joins the effective
    // configuration with the live target list, and without a subscription the
    // badge would freeze on the activation-time (usually empty) snapshot and
    // keep saying 本机 — the very defect this component exists to fix.
    useActiveHost: () => {
      useCell(client.config)
      useCell(client.hosts)
      return client.activeHost()
    },
  })

  const sectionFace = (): SectionFace => ({
    useConfig: () => useCell(client.config),
    useHostFace: () => useCell(client.hostFace),
    useHosts: () => useCell(client.hosts),
    useTunnels: () => useCell(client.tunnels),
    loadConfig: () => void client.loadConfig(),
    loadHostFace: () => void client.loadHostFace(),
    loadTargets: (options) => void client.loadTargets(options ?? {}),
    loadTunnels: () => void client.loadTunnels(),
    saveConfig: (hosts, scalars) => client.saveConfig(hosts, scalars),
    openTunnel: (hostId, requireAuthentication) => client.openTunnel(hostId, requireAuthentication),
    closeTunnel: (hostId) => client.closeTunnel(hostId),
    failureText: (failure: Failure) => failureText(failure),
  })

  const flowFace = (): FlowFace => ({
    useHosts: () => useCell(client.hosts),
    useSelectable: (showAll: boolean) => selectableOf(client.hosts.get(), showAll),
    useExtraCount: () => client.extraHostCount(),
    loadTargets: (options) => void client.loadTargets(options ?? {}),
    listDirectory: (hostId, path) => client.listDirectory(hostId, path),
    createDirectory: (location, name) => client.createDirectory(location, name),
    openProject: (location, remember, requireAuthentication) => client.openProject(location, remember, requireAuthentication),
    pickDirectory,
    failureText: (failure: Failure) => failureText(failure),
  })

  const reviewFace = (): ReviewFace => ({
    useReview: () => useCell(client.review),
    useDiagnostics: () => {
      // Fixed hook order; every hook binds one model cell.
      useCell(client.hostFace)
      useCell(client.hosts)
      useCell(client.config)
      useCell(client.slots)
      return client.diagnostics()
    },
    reviewBatch: () => client.reviewBatch(),
    reviewStatus: () => client.reviewStatus(),
    reviewApply: (files, verify) => client.reviewApply(files, verify),
    reviewReject: (files, comment) => client.reviewReject(files, comment),
    reviewRollback: (ref) => client.reviewRollback(ref),
    failureText: (failure: Failure) => failureText(failure),
  })

  // ── slot 1: session header host badge ─────────────────────────────────────
  ctx.slots.inject(SLOT_HEADER, () => {
    client.markSlot(SLOT_HEADER)
    console.log(LOG, 'slot declared → host badge', SLOT_HEADER)
    return ctx.slots.register(
      { name: SLOT_HEADER, id: 'remote-dev-host', order: 5, inject: badgeFace },
      HostBadge,
    )
  })

  // ── slot 2: settings › 远程开发 (list slot: register == it appears) ────────
  ctx.slots.inject(SLOT_SETTINGS_SECTION, () => {
    client.markSlot(SLOT_SETTINGS_SECTION)
    console.log(LOG, 'slot declared → settings section', SLOT_SETTINGS_SECTION)
    return ctx.slots.register(
      {
        name: SLOT_SETTINGS_SECTION, id: 'remote-dev', order: 40,
        label: () => '远程开发', inject: sectionFace,
      },
      RemoteDevSection,
    )
  })

  // ── slots 3+4: the two directory-flow holes (single; -1 shadows the built-in)
  ctx.slots.inject(SLOT_FLOW_HERO, () =>
    ctx.slots.inject(SLOT_FLOW_SIDEBAR, function* () {
      client.markSlot(SLOT_FLOW_HERO)
      client.markSlot(SLOT_FLOW_SIDEBAR)
      console.log(LOG, 'slots declared → directory flow', SLOT_FLOW_HERO, '/', SLOT_FLOW_SIDEBAR)
      yield ctx.slots.register(
        { name: SLOT_FLOW_HERO, id: 'remote-dev-flow', priority: FLOW_PRIORITY, inject: flowFace },
        DirectoryFlow,
      )
      yield ctx.slots.register(
        { name: SLOT_FLOW_SIDEBAR, id: 'remote-dev-flow', priority: FLOW_PRIORITY, inject: flowFace },
        DirectoryFlow,
      )
    }))

  // ── slot 5: batch review overlay ──────────────────────────────────────────
  ctx.slots.inject(SLOT_OVERLAY, () => {
    client.markSlot(SLOT_OVERLAY)
    console.log(LOG, 'slot declared → review overlay', SLOT_OVERLAY)
    return ctx.slots.register(
      { name: SLOT_OVERLAY, id: 'remote-dev-review', order: 500, inject: reviewFace },
      ReviewPanel,
    )
  })

  console.log(LOG, 'client half ready: mount + 5 slot registrations requested')
}

/** Selectable hosts for the flow's host row. */
function selectableOf(snapshot: HostsSnapshot, showAll: boolean): HostsSnapshot['targets'] {
  return showAll ? snapshot.targets : snapshot.targets.filter((host) => host.kind === 'local' || host.configured)
}
