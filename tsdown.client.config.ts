// Root tsdown config for the **browser bundle**
// (`packages/perse-remote-dev/client.js`). `npm run bundle:client` runs it.
//
// WHY a separate config at the workspace root: `tsdown.config.ts` is the host
// lane (workspace entry + `lib/index.js`) and must stay untouched by the browser
// lane. The client bundle gets its own config so the two never share a run.
//
// WHY this replicates a preset by hand: the official shared preset's
// `clientBundle()` is NOT published — the directory is not a workspace package,
// has no package.json, and is in no exports. The three strings below (`banner`,
// `intro`, `footer`) are that preset's literal closure-factory contract, verified
// against an installed official bundle
// (`@deepseek-ai/dsh-client-ui-workspace/lib/client.js`):
//
//   window.__ModuleLoader__.load({
//     id: "<package-name>",
//     factory: (require) => {
//       var module = { exports: {} };
//       var exports = module.exports;
//       Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//       ...bundle body...
//       exports.apply = apply; exports.inject = inject;
//       return module.exports;
//     }
//   });
//
// `PLATFORM_MODULES` below is copied verbatim from the frozen shell seed at
// packages/client/web/src/platform.ts (DSH b9e77c1, SHA-256
// 5d76ea268c94a98d5938623a1928211862861700db177ec088dc66110871a079).
// The one package-specific external is the dynamically injected session
// controller row, declared in dsh.client.external. Typert protocol is an
// INLINE_SAFE value owner in the official DSH client build: it is bundled into
// this client, and must not require a module-table entry that the shell never
// seeds. The Host bundle keeps its separate protocol external.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

/** The browser module also stamps this id; it must equal `manifest.name`. */
const PACKAGE_ID = 'perse-remote-dev'

/** Frozen shell module table (verbatim from the source and hash above). */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** Package-specific dynamic-row externals, resolved by the frozen DSH loader. */
const packageManifest = JSON.parse(readFileSync(new URL('packages/perse-remote-dev/package.json', import.meta.url), 'utf8'))
const DYNAMIC_CLIENT_EXTERNALS = packageManifest.dsh?.client?.external ?? []

/** The package's generated contribution, inlined into the bundle. */
const REMOTE_CONTRIBUTION = fileURLToPath(
  new URL('packages/perse-remote-dev/lib/typert.remote-client.js', import.meta.url),
)

export default defineConfig({
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'packages/perse-remote-dev/src/client/index.ts' },
  outDir: 'packages/perse-remote-dev',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  sourcemap: false,
  // Resolve `perse-remote-dev/remote` through the alias below, not through the
  // package tsconfig's `paths` (which maps it to the generated `.d.ts` for tsc).
  // tsdown forwards `tsconfig` to rolldown, so the bundler gets the paths-free
  // `tsconfig.tsdown.json`; `tsconfig: false` would NOT work here — tsdown
  // rewrites it to `undefined` and rolldown falls back to auto-detecting the
  // very `tsconfig.json` we need it to ignore.
  tsconfig: 'tsconfig.tsdown.json',
  deps: { neverBundle: [...PLATFORM_MODULES, ...DYNAMIC_CLIENT_EXTERNALS] },
  alias: {
    'perse-remote-dev/remote': REMOTE_CONTRIBUTION,
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({\n\tid: ${JSON.stringify(PACKAGE_ID)},\n\tfactory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
