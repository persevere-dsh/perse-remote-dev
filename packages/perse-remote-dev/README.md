# Persevere with DSH — PC remote connections

The `perse-remote-dev` plugin now follows the user-approved native DSH design: a connection-settings entry in the existing sidebar, with no independent chat, task canvas, project-tools page or code-review page. DSH owns its native conversation and composer.

The plugin registers verified remote workspaces and sessions with DSH's native external-session backend. DSH owns the conversation, composer, event source, and session presentation. This integration requires the matching patched DSH 0.2.1 core API; with an upstream runtime that lacks that API, connection settings still work and the plugin reports that native sessions require the patched core.

## Flow

Generate a short-lived link on the controlled computer's `perse-remote` management page. In the controlling DSH sidebar open **远程连接**, paste the link, inspect its local preview and explicitly confirm. Then select the remote host/project/session in the native sidebar, or create a session with the project’s new-session button. Write in the ordinary DSH composer. Manage saved connections, disconnect, forget or revoke this device. Device credentials remain in private Node-side storage, never in browser state or URLs.

The local authenticated DSH owner Remote calls the plugin's Node bridge, which uses the canonical Perse 1.x JSON-RPC `/rpc` protocol with an Authorization header. Pairing uses the same format as iOS. No extra listener, automatic tunnel, local model re-execution or copied remote workspace is introduced. The old token-URL routes are retired; existing legacy settings are not deleted.

## Build

```sh
npm ci
npm run setup:dsh-native -- --source /path/to/perse-dsh-native
npm test
npm run pack
dsh plugin --profile web add ./perse-remote-dev-0.3.0.tgz
```

The setup command validates the isolated DSH 0.2.1 source packages and links only their built type/runtime packages into this development checkout. `PERSE_DSH_SOURCE_ROOT` can be used instead of `--source`. It does not modify an installed DSH runtime or profile. The build uses the 0.2.1 Typert generator and protocol. Node >=22 is required. The installable plugin tarball is prebuilt; users do not run this development setup command.

Canonical specifications live in `perse-ios-app/specs/001..003` and PC revision B in `specs/004-pc-remote-control`; packaged mirrors have verified hashes. `PERSE_REMOTE_CANONICAL_ROOT` selects an explicit canonical repository. The package builds independently of an absent canonical checkout using frozen mirrors.

## Modules

- `src/pc/`: private profiles, pairing and exact remote transport.
- `src/client/native-sessions/`: native SessionFace/event conversion, generation and dispatch receipts.
- `src/client/connections/`: connection-only controller and race/error handling.
- `src/client/pc-ui/`: connection settings, no second native session UI.
- `src/client/index.ts`: official sidebar/main registration, leaving `main.conversation` untouched.

Previous custom workflow/rendering modules were removed. Existing browser draft storage is not read, migrated or deleted. Current candidate status and acceptance boundaries are in [Native DSH status](docs/pc-native-status.md); historical UI evidence does not verify the current candidate. [中文说明](README.zh.md).
