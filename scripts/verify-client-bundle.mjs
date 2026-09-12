#!/usr/bin/env node
/**
 * verify-client-bundle.mjs — closure-factory contract gate for `client.js`.
 *
 * Proves, without a browser, that the built browser bundle is a well-formed
 * `window.__ModuleLoader__` registration whose only externals are the frozen
 * shell baseline, and that the generated Remote contribution is inlined
 * (including its private `zod`) rather than left as a bare specifier.
 *
 * Checks
 *   1. `client.js` exists and its first non-empty content is
 *      `window.__ModuleLoader__.load({`;
 *   2. it registers `id: "perse-remote-dev"` — compared after whitespace
 *      normalisation, because the literal is not guaranteed to stay on one line;
 *   3. its closure-factory footer is intact: whitespace is normalised on **both
 *      sides** and the file then ends with `return module.exports;}});`
 *      (rolldown reflows the configured one-line `footer` across lines L7746-7748,
 *      so a raw `grep` for `return module.exports; } });` is a false negative);
 *   4. every `require("…")` specifier belongs to the 9-entry shell baseline
 *      `PLATFORM_MODULES`, which is also asserted to still match
 *      `tsdown.client.config.ts`;
 *   5. the inlined Remote contribution carries the `remoteDev` namespace and all
 *      15 frozen method names;
 *   6. `zod` is a private inline copy — `require("zod")` must appear nowhere.
 *
 * Usage
 *   node scripts/verify-client-bundle.mjs [--client <path>] [--source-config <path>]
 *   PERSE_REMOTE_DEV_CLIENT=<path> node scripts/verify-client-bundle.mjs
 *   node scripts/verify-client-bundle.mjs --help
 *
 * `--client` exists so the negative controls can run against a throwaway copy of
 * the bundle. Only node builtins are used.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(HERE, '..')
const DEFAULT_CLIENT = resolve(WORKSPACE_ROOT, 'packages', 'perse-remote-dev', 'client.js')
const DEFAULT_CONFIG = resolve(WORKSPACE_ROOT, 'tsdown.client.config.ts')

/** Frozen shell module table — must equal the config's copy. */
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

/** The package id the bundle must stamp; must equal `manifest.name`. */
const PACKAGE_ID = 'perse-remote-dev'

/** The frozen `@Remote` method set that must survive inlining. */
const FROZEN_METHODS = [
  'listTargets',
  'readConfiguration',
  'updateConfiguration',
  'describe',
  'listDirectory',
  'createDirectory',
  'openTunnel',
  'listTunnels',
  'closeTunnel',
  'openProject',
  'reviewStatus',
  'reviewBatch',
  'reviewApply',
  'reviewReject',
  'reviewRollback',
]

const OPENING = 'window.__ModuleLoader__.load({'
const FOOTER_WHITESPACE_STRIPPED = 'return module.exports;}});'

// --- entry point -------------------------------------------------------------

let options
try {
  options = parseArguments(process.argv.slice(2))
} catch (error) {
  report(`error: ${error.message}`)
  printUsage()
  process.exit(2)
}
if (options.help) {
  printUsage()
  process.exit(0)
}
const clientPath = options.client
const configPath = options.sourceConfig

const results = []
report(`client: ${clientPath}`)

// 1 ---------------------------------------------------------------------------
if (!existsSync(clientPath)) {
  check('1. client bundle exists', false, `a file at ${clientPath}`, 'MISSING')
  finish()
}
const source = readFileSync(clientPath, 'utf8')
const leadingTrimmed = source.replace(/^\s+/, '')
check(
  '1. first non-empty content is window.__ModuleLoader__.load({',
  leadingTrimmed.startsWith(OPENING),
  JSON.stringify(OPENING),
  JSON.stringify(leadingTrimmed.slice(0, 60)),
)

// 2 ---------------------------------------------------------------------------
const collapsed = source.replace(/\s+/g, ' ')
const idMatch = collapsed.match(/id:\s*["']([^"']*)["']/)
check(
  `2. registers id: "${PACKAGE_ID}" (whitespace-normalised)`,
  idMatch !== null && idMatch[1] === PACKAGE_ID,
  JSON.stringify(PACKAGE_ID),
  idMatch === null ? 'no id: "…" found' : JSON.stringify(idMatch[1]),
)

// 3 ---------------------------------------------------------------------------
// Whitespace is normalised on BOTH sides before the suffix comparison: the
// configured one-line `footer` ('return module.exports; } });', see
// tsdown.client.config.ts) is reflowed by rolldown across lines L7746-7748, so
// the raw text never matches the literal and a naive grep is a false negative.
// Stripping all whitespace turns the real footer into
// `returnmodule.exports;}});`, which is why the expectation is stripped too.
const whitespaceStripped = source.replace(/\s+/g, '')
const footerStripped = FOOTER_WHITESPACE_STRIPPED.replace(/\s+/g, '')
check(
  `3. footer intact after whitespace-normalising both sides (ends with ${JSON.stringify(FOOTER_WHITESPACE_STRIPPED)})`,
  whitespaceStripped.endsWith(footerStripped),
  `${JSON.stringify(FOOTER_WHITESPACE_STRIPPED)} → whitespace-free ${JSON.stringify(footerStripped)}`,
  `whitespace-free tail ${JSON.stringify(whitespaceStripped.slice(-40))}`,
)

// 4 ---------------------------------------------------------------------------
const required = [
  ...new Set(
    [...source.matchAll(/\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g)].map((match) => match[1]),
  ),
].sort()
const foreign = required.filter((specifier) => !PLATFORM_MODULES.includes(specifier))
check(
  `4a. every require("…") specifier is in the ${PLATFORM_MODULES.length}-entry shell baseline`,
  foreign.length === 0,
  `subset of ${JSON.stringify(PLATFORM_MODULES)}`,
  foreign.length === 0
    ? `found ${JSON.stringify(required)} — all baseline`
    : `non-baseline specifiers: ${JSON.stringify(foreign)} (all found: ${JSON.stringify(required)})`,
)

const configText = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
const configBlock = configText.match(/PLATFORM_MODULES\s*=\s*\[([\s\S]*?)\]/)
const configModules = configBlock === null
  ? []
  : [...configBlock[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1])
check(
  '4b. the baseline still equals tsdown.client.config.ts PLATFORM_MODULES',
  configModules.length === PLATFORM_MODULES.length
    && configModules.slice().sort().join('\u0000') === PLATFORM_MODULES.slice().sort().join('\u0000'),
  `${PLATFORM_MODULES.length} entries ${JSON.stringify(PLATFORM_MODULES)}`,
  `${configModules.length} entries ${JSON.stringify(configModules)} (from ${configPath})`,
)

// 5 ---------------------------------------------------------------------------
const missingMethods = FROZEN_METHODS.filter(
  (method) => !new RegExp(`\\b${method}\\b`).test(source),
)
const hasNamespace = /\bremoteDev\b/.test(source)
check(
  `5. inlined Remote contribution carries remoteDev + all ${FROZEN_METHODS.length} frozen methods`,
  hasNamespace && missingMethods.length === 0,
  `remoteDev namespace and all of ${JSON.stringify(FROZEN_METHODS)}`,
  hasNamespace
    ? missingMethods.length === 0
      ? `remoteDev present, all ${FROZEN_METHODS.length} methods present`
      : `remoteDev present, missing methods: ${JSON.stringify(missingMethods)}`
    : `remoteDev namespace NOT found; missing methods: ${JSON.stringify(missingMethods)}`,
)

// 6 ---------------------------------------------------------------------------
const zodRequires = [...source.matchAll(/\brequire\s*\(\s*["']zod["']\s*\)/g)].map(
  (match) => match[0],
)
const zodBareImports = [...source.matchAll(/\bfrom\s*["']zod["']/g)].map((match) => match[0])
check(
  '6. zod is privately inlined (no require("zod") / from "zod")',
  zodRequires.length === 0 && zodBareImports.length === 0,
  'zero bare zod specifiers',
  `require("zod") × ${zodRequires.length}, from "zod" × ${zodBareImports.length}`,
)

finish()

// --- summary ------------------------------------------------------------------

/** Print pass/fail summary and exit. */
function finish() {
  const failed = results.filter((result) => !result.ok)
  if (failed.length === 0) {
    report(`PASS: ${results.length}/${results.length} checks passed`)
    process.exit(0)
  }
  report(`FAIL: ${failed.length}/${results.length} checks failed`)
  for (const result of failed) {
    report(`  - ${result.label}`)
    report(`      expected: ${result.expected}`)
    report(`      actual:   ${result.actual}`)
  }
  process.exit(1)
}

// --- helpers ------------------------------------------------------------------

/** Record and print one assertion. */
function check(label, ok, expected, actual) {
  results.push({ label, ok: Boolean(ok), expected, actual })
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  console.log(`  FAIL ${label}`)
  console.log(`       expected: ${expected}`)
  console.log(`       actual:   ${actual}`)
}

/** Prefix one line with the script name. */
function report(line) {
  console.log(`[verify-client-bundle] ${line}`)
}

/**
 * Parse CLI arguments. `--client` is the documented entry point for running this
 * script against a throwaway copy of the bundle.
 */
function parseArguments(argv) {
  const parsed = {
    client: process.env.PERSE_REMOTE_DEV_CLIENT ?? DEFAULT_CLIENT,
    sourceConfig: process.env.PERSE_REMOTE_DEV_CLIENT_CONFIG ?? DEFAULT_CONFIG,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      parsed.help = true
    } else if (argument === '--client') {
      const value = argv[index + 1]
      if (value === undefined) throw new Error('--client needs a path')
      parsed.client = resolve(value)
      index += 1
    } else if (argument === '--source-config') {
      const value = argv[index + 1]
      if (value === undefined) throw new Error('--source-config needs a path')
      parsed.sourceConfig = resolve(value)
      index += 1
    } else {
      throw new Error(`unknown argument ${argument} (try --help)`)
    }
  }
  parsed.client = resolve(parsed.client)
  parsed.sourceConfig = resolve(parsed.sourceConfig)
  return parsed
}

/** Print the supported invocation surface. */
function printUsage() {
  console.log(`Usage: node scripts/verify-client-bundle.mjs [options]

Options:
  --client <path>         bundle to verify (default: packages/perse-remote-dev/client.js)
  --source-config <path>  tsdown client config carrying PLATFORM_MODULES
                          (default: tsdown.client.config.ts)
  --help, -h              print this help

Environment:
  PERSE_REMOTE_DEV_CLIENT          same as --client (the CLI flag wins)
  PERSE_REMOTE_DEV_CLIENT_CONFIG   same as --source-config

Exit code 0 only when every check passes; every failure prints the check label,
the expected value and the actual value.`)
}
