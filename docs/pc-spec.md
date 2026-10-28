# 004 — PC remote development through Persevere with DSH

Status: revision B, native-DSH integration contract, 2026-10-27. The user requested PC DSH remote control integrated with the existing Perse projects, with this repository's protocol authoritative. Concrete implementation remains delegated to GPT-6 Luna. This extends 001–003 without changing their remote wire protocol or iOS behavior.

## Product and scope

The existing `persevere-dsh/perse-remote-dev` plugin is the PC control surface. The collection index is `persevere-dsh-plugins`; Dashboard, Proof, Updater and CUA keep their separate purposes. Do not merge unrelated repositories or substitute dashboard tasks for native remote DSH sessions.

The PC browser uses the local DSH authenticated owner Remote to reach a Node bridge in the plugin. That bridge is a client of the exact Perse Remote 1.2 gateway, using Bearer authentication in the WebSocket Upgrade header. The controlled host still owns sessions, permissions, workspaces, execution, managed worktrees and immutable reviews. The bridge is not a second agent runtime and exposes no new HTTP listener. The browser receives neither durable device credentials nor master credentials.

## User-approved revision B

The user rejected a second PC application inside DSH. The native DSH conversation/composer is authoritative. The plugin entry is primarily connection configuration; sidebar additions are limited to necessary remote host/project/session navigation. Remove the independent task canvas, timeline, project-tools page and code-review page from the PC plugin. iOS and its host protocol retain their existing features.

Earlier custom-panel builds, screenshots and 36-test evidence are pre-revision investigation evidence only. They do not verify this revised native experience. Do not present a lookalike conversation, iframe, remote website, locally re-executed agent task or an empty native session as native remote integration.

## Requirements

| ID | Behavior and acceptance |
|---|---|
| D01 | One protocol: use 001/002/003 JSON-RPC, capabilities, errors, replay and identities. Keep canonical mirrored contract text with hashes in the PC package. No token URL, custom remote auth variant, DSH log scraping, or arbitrary SSH path as workspace authority in the new flow. |
| D02 | Pair from the same short-lived link produced for iOS: paste → local preview of host/address/access/expiry → explicit confirmation → one-time exchange → verified host.info. Parsing/preview has no network effect. Persist device credential only in private local plugin storage (directory 0700, file 0600, atomic writes); return redacted profiles. Identity mismatch deletes newly obtained authorization locally; the host may still retain that device grant, so tell the user it may need revocation through host administration. Never call a method on a host whose identity has not been verified, and never retain the mismatched credential. Successful exchange followed by offline socket retains reconnectable grant. |
| D03 | Saved connections with explicit connect/disconnect/forget/revoke-self. Each call captures profile, verified host and connection generation; stale queued calls fail before dispatch. Reconnect reauthenticates and verifies host identity. Never resend a mutation automatically. Explain offline/revoked/unsupported states; user manages optional HTTPS/private forwarding. |
| N04 | Reuse DSH's actual native conversation renderer and composer, native session selection and native UI lifecycle. Sidebar remote items identify host and authorized project clearly. A remote task executes on its selected host; no second local agent run or local copy of remote project is created. |
| N05 | Adapt the existing Perse 1.x wire to native DSH session/data contracts through supported plugin extension points. Preserve session identity, event/native sequence and replacement semantics, prompt idempotency, offline generations and provider errors. Native queue/interrupt/approval controls must dispatch to the captured remote session. Unsupported native actions are explicitly unavailable, never silently executed locally. |
| N06 | Plugin main entry is connection configuration only: paste existing host pairing link, preview, explicit confirm, saved connections, connect/disconnect/forget/revoke. No duplicate project tools, file/Git/terminal dashboard or code-review implementation. Use DSH's existing mechanisms where they can correctly address the selected remote context; unavailable remote mechanisms must not falsely act on a local workspace. |
| N07 | Preserve normal local DSH behavior. Remote IDs are namespaced and mapped to a verified host/profile/generation. Do not globally replace native services, shadow local pickers, rewrite installed Harness source or leak credentials into native UI/events. Removal/disconnection affects only plugin-owned remote bindings. |
| N08 | Match native DSH layout, theme, focus, keyboard and terminology by reusing native components/services. Left sidebar additions are compact and necessary. Remove obsolete custom PC rendering/workflow modules when unused; retain required security/transport logic without a parallel UI state machine. |
| N09 | Validate the packaged plugin in isolated DSH: actual native conversation/composer, remote task receipt and model reply, reload/reconnect, native local session unaffected, clear unsupported cases and connection settings. Verify exact runtime/peer compatibility. Earlier custom-panel checks and iOS evidence remain historical. Keep current artifacts and concise traceable results; no automatic production installation or publication. |

## Boundaries

Remote protocol 001–003 stays authoritative. No tunnel prerequisite or request for user server details; user-managed HTTPS/private forwarding remains optional. No public deployment, cloud relay, local re-execution, private DSH UI spoofing, global monkey patches or alteration of the user's installed runtime/profile. The user has approved extending DSH source to supply the missing native backend interface. Keep that work in its isolated source checkout; the previously recorded 0.2.1-rc.2 upstream revision `687f282e8625c6b8d11ff58211a90524be2e4317` is a historical baseline, not evidence that the current candidate is compatible. The extension must remain backward compatible and must not conceal unsupported behavior behind another custom chat UI. Compatibility with newer DSH runtime generations requires actual isolated verification.
