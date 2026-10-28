# PC native integration plan — revision B

1. Read the installed native DSH session/controller, conversation, composer, slots and workspace contracts. Verify extension points separately for available runtime generations before choosing the adapter seam.
2. Keep the validated private Node bridge and shared Perse remote protocol. GPT-6 Luna implements the native session adapter and minimal connection/sidebar UI; the main agent owns architecture, source review and integration verification.
3. Replace the independent PC experience with native conversation and composer ownership. Do not invoke a local model to simulate a remote session. Bind every action to verified host/profile/session and preserve local DSH fallthrough unchanged.
4. Remove custom task/project-tools/review pages and unused duplicate workflow/rendering modules. Migrate only plugin-owned non-secret configuration if required; never discard active user drafts silently.
5. Build, test behavioral native adapters, pack a tarball, and cold boot an isolated profile. Through built-in Computer Use verify the actual DSH native UI with real remote replies, native local UI unaffected, connection setup and restart recovery. No active user profile mutation.
6. Replace pre-revision acceptance claims with revised evidence, update repository/collection docs and keep only latest needed artifacts.

## Module boundaries

- `src/pc/`: host-side private credentials, pairing and exact Perse wire transport.
- `src/client/native-sessions/`: identity mapping and native contract conversion, no rendering of a second conversation.
- Connection/sidebar UI module: minimal connection setup and remote navigation using native slots/components.
- `src/index.ts`, `src/client/index.ts`: official registration and scoped disposal.
- Tests: protocol security, native identity/dispatch/failure/replay and preservation of native local behavior.

The previous `client/pc`/`client/pc-ui` custom workflow architecture is superseded. No custom-page build is accepted as N04–N09 completion. The user-approved native backend extension supplies the missing seam; upstream runtimes without it remain connection-only.

## Approved implementation ownership

The user authorized the native DSH source extension on 2026-10-27. GPT-6 Luna implements `packages/api/session-controller` backend registration/lifetime, `packages/client/ui-workspace` native navigation, and the Perse client protocol adapter in separate ownership areas. The primary agent reviews interfaces and guards, prepares a bounded isolated build, and verifies the real native UI against the local gateway. Exact upstream source version and runtime artifacts must be recorded. Source-plane tests must resolve this worktree; artifacts from the installed application may only serve as immutable version-matched baseline dependencies in an isolated validation runtime.
