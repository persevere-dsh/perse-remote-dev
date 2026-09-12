# perse-remote-dev — remote development for DSH.

The **perse-remote-dev** plugin for DSH: inventory your hosts and their link state,
browse and create directories over ssh, open remote DSH tunnels with token URLs,
open projects on the remote side, and drive the **rd-core** review chain.

Part of **Persevere with DSH** — the **perse** plugin collection (`` `perse` = persevere ``).

## Install

Installed from a tarball, never from a directory link:

```sh
npm install && npm run pack
dsh plugin --profile web add <path/to/perse-remote-dev-0.1.0.tgz>
```

Do **not** run `dsh plugin --profile web add ./`: the loader resolves this package
by name and needs the generated Typert artifacts next to the compiled entry.

## Host surface

Registers the typed Remote namespace `remoteDev` — 15 methods:

`listTargets`, `readConfiguration`, `updateConfiguration`, `describe`,
`listDirectory`, `createDirectory`, `openTunnel`, `listTunnels`, `closeTunnel`,
`openProject`, `reviewStatus`, `reviewBatch`, `reviewApply`, `reviewReject`,
`reviewRollback`.

The first four cover host inventory and link state, `listDirectory` /
`createDirectory` cover ssh directory browsing, the three tunnel methods cover the
remote DSH tunnel and its token URL, `openProject` covers remote project open, and
the five `review*` methods cover the rd-core batch review chain.

## Peer requirements

`@deepseek-ai/cordis` ^4.0.2, `@deepseek-ai/dsh-typert-protocol` ^0.1.5-rc.2 and
`@deepseek-ai/schemastery` ^3.18.2 must come from the host so the Remote layer
shares one module instance.

## License

MIT — © Xilong Liu.

---

<sub>Part of Persevere with DSH</sub>
