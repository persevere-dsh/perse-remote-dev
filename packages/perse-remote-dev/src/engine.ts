/**
 * The rd-core engine contract, carried over from the hand-written host half.
 *
 * The calling shape (`bash <enginePath> <args>` with `RD_SSH` in the
 * environment) and the `#FILES / #DIFF / #END` output protocol are the
 * *engine's* contract, not DSH's, so they are preserved verbatim. Only the
 * error surface changed: a missing engine path is now an explicit typed
 * failure instead of `execFile('bash', [undefined, …])` — the old default table
 * had no `enginePath` key, so the engine always ran with an undefined script
 * and every `/review/*` call died as a TypeError folded into a generic 400.
 *
 * Default engine location: when `remote-dev.enginePath` is left empty the host
 * falls back to the engine bundled with this package (`<pkg>/engine/rd-sync.sh`,
 * resolved in `index.ts#requireEngine`); an explicit setting still wins.
 */

import { execFile } from 'node:child_process'

/** One completed engine invocation. */
export interface EngineRun {
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

/** Why an engine invocation could not produce a result. */
export type EngineFailureKind = 'missing' | 'timeout'

/** Typed engine launch failure; the caller maps it onto a `remote-dev/*` code. */
export class EngineExecutionError extends Error {
  readonly kind: EngineFailureKind
  readonly enginePath: string

  constructor(kind: EngineFailureKind, message: string, enginePath: string) {
    super(message)
    this.name = 'EngineExecutionError'
    this.kind = kind
    this.enginePath = enginePath
  }
}

/** One file row parsed out of a batch. */
export interface EngineBatchFile {
  /** Added lines; absent for a deletion. */
  readonly add?: number
  /** Deleted lines; absent for an addition. */
  readonly del?: number
  readonly path: string
  readonly status: 'A' | 'M' | 'D'
}

/** One parsed batch. */
export interface EngineBatch {
  readonly base: string
  readonly head: string
  readonly files: readonly EngineBatchFile[]
  readonly diff: string
  readonly empty: boolean
}

/**
 * Run the engine over ssh.
 * @param enginePath - absolute path to `rd-core/rd-sync.sh` on the local machine.
 * @param args - engine verb and arguments.
 * @param sshHost - value exported as `RD_SSH` for the engine's own ssh calls.
 * @param timeoutMs - hard timeout.
 */
export function runEngine(
  enginePath: string,
  args: readonly string[],
  sshHost: string,
  timeoutMs = 60000,
): Promise<EngineRun> {
  return new Promise((resolve, reject) => {
    execFile(
      'bash',
      [enginePath, ...args],
      { env: { ...process.env, RD_SSH: sshHost }, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          if ((err as { code?: unknown }).code === 'ENOENT') {
            reject(new EngineExecutionError('missing', `找不到引擎：${enginePath}`, enginePath))
            return
          }
          if ((err as { killed?: boolean }).killed === true) {
            reject(new EngineExecutionError('timeout', `引擎执行超时（${timeoutMs}ms）`, enginePath))
            return
          }
        }
        resolve({
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        })
      },
    )
  })
}

/**
 * Parse the engine's `batch` output: `base=` / `head=` header lines plus
 * `#FILES` (tab-separated add, del, path), `#DIFF`, and `#END` sections.
 * @param stdout - engine stdout.
 */
export function parseBatch(stdout: string): EngineBatch {
  const lines = String(stdout).split(/\r?\n/)
  const base = (lines.find((l) => l.startsWith('base=')) || 'base=').slice(5)
  const head = (lines.find((l) => l.startsWith('head=')) || 'head=').slice(5)
  const iF = lines.indexOf('#FILES')
  const iD = lines.indexOf('#DIFF')
  const iE = lines.indexOf('#END')
  const files: EngineBatchFile[] = []
  if (iF >= 0 && iD > iF) {
    for (const raw of lines.slice(iF + 1, iD)) {
      if (raw.trim() === '') continue
      const parts = raw.split('\t')
      if (parts.length < 3) continue
      const addRaw = parts[0] ?? ''
      const delRaw = parts[1] ?? ''
      const path = parts.slice(2).join('\t')
      files.push({
        ...addRaw === '-' ? {} : { add: Number(addRaw) },
        ...delRaw === '-' ? {} : { del: Number(delRaw) },
        path,
        status: 'M',
      })
    }
  }
  const diff = iD >= 0 ? lines.slice(iD + 1, iE >= 0 ? iE : undefined).join('\n') : ''
  const withStatus = files.map((f) => {
    const marker = `diff --git a/${f.path} b/${f.path}`
    const at = diff.indexOf(marker)
    if (at < 0) return { ...f, status: 'M' as const }
    const next = diff.indexOf('diff --git ', at + 1)
    const chunk = diff.slice(at, next < 0 ? undefined : next)
    const status: 'A' | 'M' | 'D' = /new file mode/.test(chunk) ? 'A' : /deleted file mode/.test(chunk) ? 'D' : 'M'
    return { ...f, status }
  })
  return { base, head, files: withStatus, diff, empty: withStatus.length === 0 }
}

/**
 * Keep only the selected files' chunks of a unified diff.
 *
 * Filtering locally (rather than asking the remote `git diff -- <paths>`) exists
 * because paths would otherwise have to be spliced into a remote command line;
 * the kept patch is byte-identical to what the review view displayed.
 * @param diff - full batch diff.
 * @param wanted - selected file paths.
 */
export function filterDiffByFiles(diff: string, wanted: readonly string[]): { patch: string; kept: string[] } {
  const set = new Set(wanted)
  const chunks: { path: string; lines: string[] }[] = []
  let cur: { path: string; lines: string[] } | null = null
  for (const line of String(diff).split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (cur !== null) chunks.push(cur)
      const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
      cur = { path: m ? (m[2] ?? '') : '', lines: [line] }
      continue
    }
    if (cur !== null) cur.lines.push(line)
  }
  if (cur !== null) chunks.push(cur)
  const kept = chunks.filter((c) => set.has(c.path))
  return {
    patch: kept.map((c) => c.lines.join('\n')).join('\n') + (kept.length ? '\n' : ''),
    kept: kept.map((c) => c.path),
  }
}

/** Short tail of engine output, so a whole log never lands in one response. */
export function brief(text: string, max = 300): string {
  const t = String(text || '').trim()
  return t.length > max ? `…${t.slice(-max)}` : t
}
