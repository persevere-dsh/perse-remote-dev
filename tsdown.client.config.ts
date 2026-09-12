// Root tsdown config for the **browser bundle**
// (`packages/perse-remote-dev/client.js`). `npm run bundle:client` runs it.
//
// WHY a separate config at the workspace root: `tsdown.config.ts` is the host
// lane (workspace entry + `lib/index.js`) and must stay untouched by the browser
// lane. The client bundle gets its own config so the two never share a run.
//
// WHY this replicates a preset by hand: the official shared preset
// `packages/client/tsdown.client.ts` (`clientBundle()`) is NOT published — the
// directory is not a workspace package, has no package.json, and is in no
// exports (OFFICIAL-SPEC R5.8). The three strings below (`banner`, `intro`,
// `footer`) are that preset's literal closure-factory contract (R5.6), verified
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
// Externals are exactly the shell baseline `PLATFORM_MODULES` (R5.4); the
// baseline is implicit for every dynamic bundle, so the package manifest
// declares no `dsh.client.external`. Everything else — including the generated
// contribution `perse-remote-dev/remote` and its `zod` — is privately bundled
// (silence = private copy, R5.5 rule 1).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

/** The browser module also stamps this id; it must equal `manifest.name`. */
const PACKAGE_ID = 'perse-remote-dev'

/** Frozen shell module table (OFFICIAL-SPEC R5.4, verbatim). */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

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
  deps: { neverBundle: PLATFORM_MODULES },
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
