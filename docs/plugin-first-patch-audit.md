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

Verified in `ui-sidebar/src/client/contract/slots.ts` (baseline, via `git show HEAD:`):

- `sidebar.workspaces` is **`{ kind: 'single' }`** (line 42) and is occupied by ui-workspace's own browser. `ui-slots` `register()` throws on a second same-priority registration, and another priority only *shadows* it — which would **replace** the local workspace tree, an N07 violation. A plugin therefore **cannot** add a group inside the browsing region.
- `sidebar.footer.action` is **`{ kind: 'list' }`** with explicit `order` (line 53) — the official stackable seat below the browsing region, above Settings. This is where the remote group now lives.
- `sidebar.panellist` is `{ kind: 'list' }` (line 35). Usable, but first-level navigation is the wrong home for low-frequency connection management, so the plugin stopped using it.
- The remote badge uses `conversation.session.header.utilities`. `sidebar.session.row.leading` exists as a per-row seat but was not used.
- `sidebar.workspaces.session.menu.item`, `sidebar.workspaces.session.row.action`, `sidebar.workspaces.directoryFlow` are official per-row seats, but they render *inside* the local browser and cannot express a host-level group.
- `ui-approval` contributes its panel through the official `conversation.composer` slot.

The plugin already owns the data these components need: it constructs the backend and holds the catalog, so it does not need `WorkspaceBrowserInjected.externalCatalog` to render the group.

## Consequences for the placement complaint

Moving B1 into the plugin fixes the three placement problems as a side effect, all plugin-side:

1. the remote group renders through an official stackable sidebar seat with an explicit `order`, so it stops flooding the local session list. The earlier assumption that `sidebar.workspaces` could stack is wrong and is corrected in [the native integration boundary](native-dsh-extension.md): that hole is `kind: 'single'`, declared and occupied by ui-workspace's own browser, and a same-priority registration throws; shadowing it at another priority would replace the local workspace tree;
2. session rows render collapsed by default (`N 个会话`), so remote sessions stop flooding the sidebar;
3. the connection entry leaves the first-level `sidebar.panellist` and becomes a header action of the remote group — connection management is low frequency and does not deserve first-level navigation.

Acceptance mapping: N04/N06/N08 (native reuse, connection-only entry, native look and compact sidebar). N09 remains a separate gate: any move must be re-verified in the isolated packed install, not inferred from this audit.

## Target shape

- Core patch: **bucket A (8) + bucket B2 (3) + collapsed C + D** — an external-session seam plus one generic capability-gating helper.
- Plugin: pairing, profiles, transport, protocol, native adapter, **remote navigation and badges**, connection settings, capability advertisement, and all host-side capability additions (for example `model.list`).
- Never acceptable: a second conversation UI, a local re-execution, or a local fallback for a selected remote session.

## Executed split (2026-10-30)

B1 is out of core. Measured: the extension went from **82 to 72** changed paths against upstream `687f282e` (`git diff --name-only 687f282e..HEAD | wc -l`), with `ui-workspace` down to four paths (`locales.ts`, `navigation.ts`, and two test files). The plugin owns `src/client/remote-nav/` (group, header badge, locale, styles) plus the two ported UI suites; core deletes the six B1 files and reverts `ui-workspace` `src/client/index.ts`, `src/client/locales.ts`, `src/client/rows/WorkspaceBrowser.tsx`, `tests/workspace-browser.client.spec.tsx` and both READMEs.

Two measured deviations from the table above:

- `contract/slots.ts` reverts with B1 rather than staying in B2. Its four additions (`externalCatalog`, `selection`, `openExternal`, `createExternalSession`) existed only to type the removed browser mount; baseline `browserInjected` no longer supplies them, so keeping them fails typecheck. B2 is therefore `navigation.ts` + its service test.
- Core keeps exactly one remote string, `remote.backendUnavailable`, because the B2 navigation guard raises it; and one test-only line in `tests/apply.client.spec.ts`, whose baseline `sessions` fake lacked `externalCatalog` (without it the B2 navigation service crashed 30 baseline tests — already failing at the pre-split checkpoint, not caused by the split).

Placement is verified by test, not by claim: `test/pc-ui.remote-nav.test.tsx` asserts the collapsed "{n} sessions" default, that opening uses a Host-qualified address, and that an offline host disables open/create instead of falling through locally.
