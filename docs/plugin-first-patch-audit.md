# Plugin-first patch audit — no upstreaming

Date: 2026-10-30. Owner: primary agent (architecture/review). Scope: the isolated DSH 0.2.1-rc.2 extension at `/Users/lxl/workspace/perse-dsh-native` (baseline commit `687f282e…`, extension source commit `b9e77c13…`).

Decision recorded here: **do not pursue upstreaming.** Keep the extension as our own maintained patch layer, and move into the plugin everything that official extension points can already carry. Everything else is reduced to the smallest honest core residue.

## Measured patch surface (82 changed paths, verified by `git status --short`)

| Bucket | Files | Content | Decision |
|---|---|---|---|
| A — core seam | 8 | `api/session-controller`: `contract/external-sessions.ts` (new), `contract/sessions.ts`, `contract/events.ts`, `client/index.ts`, `sessions/service.ts`, its test, both READMEs | **Stays in core.** No official API can register an external session backend: baseline `ISessions` exposes only `retain / retainInfo / create / refresh / search / fork / scope / scopeOf / sessionOf / binding / subagentAddress / refreshProjections` — no `register*`. |
| B1 — rendering | 12 | `ui-workspace`: `RemoteWorkspaceTree.tsx`/`.module.css`, `RemoteSessionBadge.tsx`/`.module.css`, their two tests, `index.ts`, `locales.ts`, `rows/WorkspaceBrowser.tsx` mount, both READMEs | **Move into the plugin.** Official slots already carry row-level contributions — see evidence below. |
| B2 — navigation/types | 3 | `ui-workspace`: `navigation.ts`, `contract/slots.ts`, `tests/workspaces-service.client.spec.ts` | **Stays in core** for now: opening a native session by an external address is the seam's open path, not presentation. |
| C — generic capability gating | 53 | `ui-conversation` (14), `ui-chat` (7), `ui-sidebar-files` (8), `ui-sidebar-terminal` (6), `session-log-export` (7), `ui-model-selection` (3), `ui-session` (2), `ui-commands` (2), `ui-permission-presets` (2), `ui-user-questions` (1), `test-support/client-runtime` (1) | **Stays in core, but must collapse to one helper.** These components call local APIs internally (upload, model RPC, terminal, files, export, commands), so only the component itself can refuse. Today each repeats `externalIdentityOf(id)?.capabilities.X === false`; replace that with a single shared `isActionAvailable(sessionId, action)` and shrink every call site to one line. |
| D — approval reuse | 6 | `ui-approval`: `ApprovalPanel.tsx`, `contract/slots.ts`, `index.ts`, its test, both READMEs | **Stays in core, small.** Reusing the native approval panel for remote approvals requires core to see the external approval source. A plugin-owned approval UI is rejected: contract fixes native-panel reuse. |

## Evidence that B1 can live in the plugin

Baseline `ui-workspace/src/client/index.ts` contributes its own shipped rows through the **official** slot mechanism, and says so in its own comment ("The shipped row actions take the same route as a plugin's"):

- `slots.inject('sidebar.workspaces', …)` — the whole workspace row set is a slot contribution, so a plugin can stack its own group and control placement with `order`.
- `slots.register('sidebar.session.row.leading', …)` — a plugin may contribute the leading badge on session rows: that is exactly `RemoteSessionBadge`.
- `sidebar.workspaces.session.menu.item`, `sidebar.workspaces.session.row.action`, `sidebar.workspaces.directoryFlow` — official per-row seats.
- `ui-approval` contributes its panel through the official `conversation.composer` slot.

The plugin already owns the data these components need: it constructs the backend and holds the catalog, so it does not need `WorkspaceBrowserInjected.externalCatalog` to render the group.

## Consequences for the placement complaint

Moving B1 into the plugin fixes the three placement problems as a side effect, all plugin-side:

1. the remote group joins `sidebar.workspaces` with an explicit `order`, so it sits with local workspaces instead of stranded at the bottom;
2. session rows render collapsed by default (`N 个会话`), so remote sessions stop flooding the sidebar;
3. the connection entry leaves the first-level `sidebar.panellist` and becomes a header action of the remote group — connection management is low frequency and does not deserve first-level navigation.

Acceptance mapping: N04/N06/N08 (native reuse, connection-only entry, native look and compact sidebar). N09 remains a separate gate: any move must be re-verified in the isolated packed install, not inferred from this audit.

## Target shape

- Core patch: **bucket A (8) + bucket B2 (3) + collapsed C + D** — an external-session seam plus one generic capability-gating helper.
- Plugin: pairing, profiles, transport, protocol, native adapter, **remote navigation and badges**, connection settings, capability advertisement, and all host-side capability additions (for example `model.list`).
- Never acceptable: a second conversation UI, a local re-execution, or a local fallback for a selected remote session.
