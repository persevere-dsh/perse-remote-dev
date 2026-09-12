# perse-remote-dev — remote development for DSH.

**perse-remote-dev** is a DSH plugin that puts a remote development workspace inside
the harness: it inventories your hosts and their link state, browses and creates
directories over ssh, opens remote DSH tunnels with token URLs, opens projects on the
remote side, and drives the **rd-core** batch review chain (review → apply → reject →
rollback) from the browser.

Part of **Persevere with DSH** — a collection of DSH plugins published under the short
name **perse** (`` `perse` = persevere ``).

---

## What it does

| Area | Guarantee |
|------|-----------|
| **Host inventory + link state** | Lists the configured hosts, reads and updates the effective configuration, and reports one host's reachability/link state. |
| **ssh directory browsing** | Lists a remote directory and creates a directory, over the configured ssh connection — no bare HTTP route of its own. |
| **Remote DSH tunnels** | Opens a tunnel to the remote DSH, returns the token URL to reach it, lists the live tunnels, and closes one on demand. |
| **Remote project open** | Opens a project on the remote side and records the choice in the `remote-dev` settings namespace. |
| **rd-core batch review** | Reads batch status, fetches the batch, applies the approved files, rejects files with a comment, and rolls back to an approved baseline ref. |

The host half registers the `remoteDev` typed Remote namespace — 15 methods:
`listTargets`, `readConfiguration`, `updateConfiguration`, `describe`,
`listDirectory`, `createDirectory`, `openTunnel`, `listTunnels`, `closeTunnel`,
`openProject`, `reviewStatus`, `reviewBatch`, `reviewApply`, `reviewReject`,
`reviewRollback`. The browser half renders it in the conversation, settings,
sidebar and layout slots.

## Install

Build and pack first — the plugin is installed from a tarball, **not** from a
directory link:

```sh
npm install        # build tooling (TypeScript, tsdown, the Typert generator)
npm run pack       # build + `npm pack --workspace perse-remote-dev`
                   # npm prints the tarball path it produced

dsh plugin --profile web add <path/to/perse-remote-dev-0.1.0.tgz>
```

> **Do not** install with a directory path (`dsh plugin --profile web add ./`).
> The loader resolves the package by its name and expects the generated Typert
> artifacts (`lib/typert.host.js`, `lib/typert.remote-client.js`) to sit next to
> the compiled entry. A directory link does not provide that layout and the
> plugin will fail to load.

## Develop

```sh
npm run typecheck          # tsc -b tsconfig.host.json  (emits lib/types)
npm run codegen            # regenerate lib/typert.* from the annotated source
npm run bundle             # tsdown -> lib/index.js (host half)
npm run bundle:client      # tsdown --config tsdown.client.config.ts -> client.js
npm test                   # builds, then runs verify-generated + verify-client-bundle + verify-host-surface
```

`@deepseek-ai/cordis`, `@deepseek-ai/dsh-typert-protocol` and
`@deepseek-ai/schemastery` stay unbundled on purpose: the host supplies those
peers, so the Remote layer and the settings seam share one module instance — a
second copy silently disables the Remote layer. `zod` also stays a bare
specifier, but it is a real dependency of this package rather than a peer: the
host face resolves the copy installed next to it, while the browser bundle
inlines a private one.

## Driving the Remote API

The host half is served inside the Connection trust fence, so every request carries
the session cookie. The wire envelope is a JSON `POST` to `/api/<namespace>/<method>`:

```json
{ "type": "client-request", "rpcId": "1", "method": "remoteDev/describe",
  "payload": { "args": { "request": { "includeEndpoints": true } } } }
```

Two fields are easy to get wrong: `rpcId` is a **string**, and `method` is the
**full endpoint id** (`<namespace>/<name>`, e.g. `remoteDev/describe`) rather than
the bare method name. A malformed envelope still answers `HTTP 200` with
`ok:false` and code `gateway/bad-request`, which reads like a plugin fault but is
only the envelope. Failures raised by the plugin itself come back as `ok:false`
with a `remote-dev/<reason>` code.

## Requirements

- Node.js 22+
- DSH with `@deepseek-ai/cordis` ^4.0.2, `@deepseek-ai/dsh-typert-protocol` ^0.1.5-rc.2
  and `@deepseek-ai/schemastery` ^3.18.2
- `@deepseek-ai/cordis`, `@deepseek-ai/dsh-typert-protocol` and
  `@deepseek-ai/schemastery` must be provided by the host, so the Remote layer
  (and the settings seam) shares one module instance.

## License

MIT — © Xilong Liu. See [`LICENSE`](./LICENSE).

---

<sub>Part of Persevere with DSH</sub>
