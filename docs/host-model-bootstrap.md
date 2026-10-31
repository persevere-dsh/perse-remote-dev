# Host model bootstrap over SSH — pointer

Canonical contract: `perse-ios-app/specs/006-host-model-bootstrap/spec.md` (draft, awaiting lxl's answers).

Why it belongs to this project and not to core: a cold controlled host has no model provider configuration, so protocol 1.3 `model.list` honestly returns `catalog-unavailable` and the remote model seat can only state that the capability is missing (verified in the GUI on 2026-10-30). Bootstrap fixes the cold-host case **out of band over SSH**, so no credential ever enters the remote protocol, the gateway, or the browser UI — and it stays plugin-side CLI tooling, adding zero paths to the core patch.

Non-negotiables carried over from the spec, because they are easy to get wrong:

- field allowlist, never a directory copy — `identity.json` holds a live session token and `device.json` is a per-install id; copying them would transplant a signed-in session and collide device identity;
- dry run + explicit confirmation before a credential leaves the machine;
- backups and a printed restore command; per-name `--replace`, never silent overwrite;
- no secrets in logs or terminal output, target files `0600`;
- the operator restarts the host; success is then proven through `model.list`, not assumed.
