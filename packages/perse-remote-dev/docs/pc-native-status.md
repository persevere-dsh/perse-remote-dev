# Native DSH revision status — 2026-10-29

## Verified source and API boundary

The PC candidate is typechecked against the exact native session-controller API from `@deepseek-ai/dsh-api-session-controller@0.2.1-rc.2`, frozen source commit `b9e77c1316dd54245062419f6fd6d8c13f247214` (tree `ccf24e58defd055d0912070f425e791fa4e7b300`). The checked-in development declaration input contains only the 16 allowlisted generated `.d.ts` files and manifest/license evidence; the declaration verifier checks their hashes and imports. The native source owner reports build 9/9, NodeNext typecheck 353, and public-package/publint checks passed.

The PC source passed its clean public npm dependency build/typecheck and focused PC suite (50/50). The independent final lifecycle regression passed 3/3 after fixing duplicate backend registration during reload. The exact repeat-registration probe observed one profile read, one reconnect, one backend registration, zero unregisters before cleanup, one catalog RPC, and one active backend. These are source and fixture checks; they do not establish packaged native UI acceptance.

## Runtime compatibility and acceptance boundary

On a DSH host that does not provide the external native-session API, the plugin is **connection-only**: users may configure, pair, refresh and connect profiles, but native remote sessions are unavailable and the UI reports that compatibility state. The API-dependent integration requires the exact owner interface above; this source check does not prove an installed application contains that extension.

Native desktop renderer/composer acceptance, an isolated packed-plugin installation, GUI pairing, real remote prompt/reply, and reconnect after app restart have not been verified. Do not infer those results from typecheck, fixture tests, bundle checks, or the native source build.

The current adapter also does not route these local-only or unsupported actions to the remote host: queue edit/remove and steer, local file upload, local model/preset/permission changes, user-question answers, local terminal actions, and local slash commands. Such actions must remain unavailable or explicitly explain their limitation; they must never fall through to local execution for a selected remote session. See [the native integration boundary](native-dsh-extension.md).

Validation receipt: `output/goal-dsh-lines-20261028/pc-remote-luna-final-validation.json` in the parent workspace. GUI and production acceptance remain separate gates.
