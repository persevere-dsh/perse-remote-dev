#!/usr/bin/env node
/**
 * verify-host-surface.mjs — capability-surface gate for the built host entry.
 *
 * Proves that the rewritten `@Remote`-only host surface never reintroduces a
 * self-made HTTP entry point, keeps its runtime peers as bare specifiers, and
 * cannot strand the plugin behind a phantom service injection.
 *
 * Checks
 *   1. `lib/index.js` has **zero** `webServer.register` and zero
 *      `kind: 'prefix'` hits once comment lines are removed.
 *      (Known trap: artifact L916 is the doc comment
 *      "`* \`ctx.webServer.register\` call anywhere in this package: the former
 *      prefix`". A raw `grep webServer` therefore reports 1 and is a false
 *      positive. The judgement is anchored to non-comment lines only, i.e. lines
 *      whose trimmed text does not start with `*`, `//` or `/*`.)
 *   2. the peers stay bare specifiers — `from "@deepseek-ai/dsh-typert-protocol"`
 *      and `from "@deepseek-ai/schemastery"` are both visible — and schemastery
 *      is not inlined (no second copy is bundled).
 *   3. the host `inject = […]` list contains only `typert`: never `config` and
 *      never `webServer`. (History: a `'config'` entry parked the plugin forever
 *      at `pending (waiting for service: config)` and made cold start report
 *      `N entries did not activate`.)
 *   4. `client.js` mentions `webServer` zero times.
 *
 * Usage
 *   node scripts/verify-host-surface.mjs [--host <path>] [--client <path>]
 *   PERSE_REMOTE_DEV_HOST=<path> PERSE_REMOTE_DEV_CLIENT=<path> \
 *     node scripts/verify-host-surface.mjs
 *   node scripts/verify-host-surface.mjs --help
 *
 * `--host` / `--client` exist so the negative controls can run against throwaway
 * copies of the artifacts. Only node builtins are used.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(HERE, '..')
const PACKAGE_ROOT = resolve(WORKSPACE_ROOT, 'packages', 'perse-remote-dev')
const DEFAULT_HOST = resolve(PACKAGE_ROOT, 'lib', 'index.js')
const DEFAULT_CLIENT = resolve(PACKAGE_ROOT, 'client.js')

/** Peers that must survive as bare specifiers (one shared runtime instance). */
const REQUIRED_BARE_PEERS = [
  '@deepseek-ai/dsh-typert-protocol',
  '@deepseek-ai/schemastery',
]

/** The only service the host face may inject. */
const ALLOWED_INJECT = ['typert']

/** Phantom service names that must never appear in `inject`. */
const FORBIDDEN_INJECT = ['config', 'webServer']

/** Maximum tolerated `schemastery` mentions once import/comment lines are allowed. */
const SCHEMASTERY_MENTION_BUDGET = 10

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

const results = []
report(`host: ${options.host}`)
report(`client: ${options.client}`)

// --- host bundle --------------------------------------------------------------
if (!existsSync(options.host)) {
  check('1. host bundle exists', false, `a file at ${options.host}`, 'MISSING')
} else {
  const hostSource = readFileSync(options.host, 'utf8')
  const lines = hostSource.split(/\r?\n/)
  const commentLines = []
  const codeLines = []
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trimStart()
    const isComment = trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')
    ;(isComment ? commentLines : codeLines).push({ text: lines[index], number: index + 1 })
  }
  const codeText = codeLines.map((line) => line.text).join('\n')
  const allText = hostSource

  // 1 -------------------------------------------------------------------------
  const codeRegister = countMatches(codeText, /webServer\s*\.\s*register/g)
  const codePrefix = countMatches(codeText, /kind\s*:\s*['"]prefix['"]/g)
  const rawRegister = countMatches(allText, /webServer\s*\.\s*register/g)
  check(
    '1a. non-comment lines contain 0 × webServer.register',
    codeRegister === 0,
    '0',
    `${codeRegister} (raw over all lines, comments included: ${rawRegister})` +
      `${codeRegister === 0 ? '' : ` at ${JSON.stringify(hitsOf(codeLines, /webServer\s*\.\s*register/))}`}`,
  )
  check(
    "1b. non-comment lines contain 0 × kind: 'prefix'",
    codePrefix === 0,
    '0',
    `${codePrefix}` +
      `${codePrefix === 0 ? '' : ` at ${JSON.stringify(hitsOf(codeLines, /kind\s*:\s*['"]prefix['"]/))}`}`,
  )

  // 2 -------------------------------------------------------------------------
  for (const peer of REQUIRED_BARE_PEERS) {
    const pattern = new RegExp(`\\bfrom\\s*["']${peer.replace(/[/.\\^$*+?()[\]{}|]/g, '\\$&')}["']`)
    check(
      `2. peer stays a bare specifier: from "${peer}"`,
      pattern.test(hostSource),
      `from "${peer}"`,
      pattern.test(hostSource) ? 'present' : 'NOT FOUND (peer was bundled or rewritten)',
    )
  }
  const schemasteryLines = lines
    .map((text, index) => ({ text, number: index + 1 }))
    .filter((line) => /schemastery/i.test(line.text))
  const schemasteryOffenders = schemasteryLines.filter(
    (line) =>
      !isCommentLine(line.text) &&
      !/\bfrom\s*["']@deepseek-ai\/schemastery["']/.test(line.text),
  )
  check(
    '2c. schemastery is not inlined (every mention is an import or a comment)',
    schemasteryOffenders.length === 0
      && schemasteryLines.length <= SCHEMASTERY_MENTION_BUDGET,
    `≤ ${SCHEMASTERY_MENTION_BUDGET} mentions, each an import/comment line`,
    `mentions=${schemasteryLines.length} at ${JSON.stringify(schemasteryLines.map((line) => line.number))}; ` +
      `non-import/non-comment offenders=${JSON.stringify(schemasteryOffenders.map((line) => line.number))}`,
  )

  // 3 -------------------------------------------------------------------------
  const injectAssignments = [...hostSource.matchAll(/\binject\s*=\s*\[([^\]]*)\]/g)]
  const injectNames = injectAssignments.flatMap((match) =>
    [...match[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]),
  )
  const forbiddenFound = injectNames.filter((name) => FORBIDDEN_INJECT.includes(name))
  check(
    '3a. exactly one `inject = […]` assignment exists on the host face',
    injectAssignments.length === 1,
    '1',
    `${injectAssignments.length}: ${JSON.stringify(injectAssignments.map((match) => match[0]))}`,
  )
  check(
    `3b. inject = ${JSON.stringify(ALLOWED_INJECT)} — no phantom service`,
    injectNames.length === ALLOWED_INJECT.length
      && ALLOWED_INJECT.every((name) => injectNames.includes(name))
      && forbiddenFound.length === 0,
    `exactly ${JSON.stringify(ALLOWED_INJECT)} (never ${JSON.stringify(FORBIDDEN_INJECT)})`,
    `found ${JSON.stringify(injectNames)}; phantom services ${JSON.stringify(forbiddenFound)}`,
  )
}

// --- client bundle ------------------------------------------------------------
if (!existsSync(options.client)) {
  check('4. client bundle exists', false, `a file at ${options.client}`, 'MISSING')
} else {
  const clientSource = readFileSync(options.client, 'utf8')
  const clientWebServer = countMatches(clientSource, /webServer/g)
  check(
    '4. client.js mentions webServer 0 times',
    clientWebServer === 0,
    '0',
    `${clientWebServer}`,
  )
}

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
  console.log(`[verify-host-surface] ${line}`)
}

/** The specified comment-line rule: trimStart() begins with `*`, `//` or `/*`. */
function isCommentLine(text) {
  const trimmed = text.trimStart()
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')
}

/** Count non-overlapping matches of a global RegExp in `text`. */
function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length
}

/** `line:number` report for each line matching `pattern`. */
function hitsOf(numberedLines, pattern) {
  return numberedLines
    .filter((line) => pattern.test(line.text))
    .map((line) => `${line.number}: ${line.text.trim()}`)
}

/**
 * Parse CLI arguments. `--host` / `--client` are the documented entry points for
 * running this script against throwaway copies of the artifacts.
 */
function parseArguments(argv) {
  const parsed = {
    host: process.env.PERSE_REMOTE_DEV_HOST ?? DEFAULT_HOST,
    client: process.env.PERSE_REMOTE_DEV_CLIENT ?? DEFAULT_CLIENT,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      parsed.help = true
    } else if (argument === '--host') {
      const value = argv[index + 1]
      if (value === undefined) throw new Error('--host needs a path')
      parsed.host = resolve(value)
      index += 1
    } else if (argument === '--client') {
      const value = argv[index + 1]
      if (value === undefined) throw new Error('--client needs a path')
      parsed.client = resolve(value)
      index += 1
    } else {
      throw new Error(`unknown argument ${argument} (try --help)`)
    }
  }
  parsed.host = resolve(parsed.host)
  parsed.client = resolve(parsed.client)
  return parsed
}

/** Print the supported invocation surface. */
function printUsage() {
  console.log(`Usage: node scripts/verify-host-surface.mjs [options]

Options:
  --host <path>    host bundle to verify (default: packages/perse-remote-dev/lib/index.js)
  --client <path>  client bundle to verify (default: packages/perse-remote-dev/client.js)
  --help, -h       print this help

Environment:
  PERSE_REMOTE_DEV_HOST    same as --host (the CLI flag wins)
  PERSE_REMOTE_DEV_CLIENT  same as --client (the CLI flag wins)

Exit code 0 only when every check passes; every failure prints the check label,
the expected value and the actual value.`)
}
