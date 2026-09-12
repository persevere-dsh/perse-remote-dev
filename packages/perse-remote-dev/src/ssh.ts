/**
 * Reusable ssh transport primitives, carried over from the hand-written host
 * half (`remote-dev/perse-remote-dev/lib/index.js` §10.1 reusable assets):
 *
 *   · `~/.ssh/config` parsing + endpoint folding (same endpoint, several aliases);
 *   · the base64-argv convention — ssh does not forward arbitrary environment
 *     variables, so every value is base64-encoded into the remote argv and
 *     decoded inside the script; base64 carries no shell metacharacters;
 *   · the tunnel-failure classifier, whose three classes map one-to-one onto
 *     RemoteError codes.
 *
 * Semantics are preserved deliberately: only the plumbing around them changed.
 */

import { execFile } from 'node:child_process'
import { homedir } from 'node:os'

/** One concrete alias block from `~/.ssh/config`. */
export interface SshHostEntry {
  readonly id: string
  readonly hostName: string
  readonly user: string
  readonly port: string
  readonly proxyJump: string
}

/** One endpoint after folding aliases that resolve to the same (HostName, User, Port). */
export interface FoldedSshHost {
  readonly id: string
  readonly name: string
  readonly hostName: string
  readonly user: string
  readonly port: string
  readonly proxyJump: string
  readonly aliases: readonly string[]
  readonly jump: boolean
}

/**
 * Every ssh invocation's target. `sshTarget` is what actually goes on the ssh
 * command line: an alias when the user imported one (the alias carries its own
 * jump host and identity), otherwise `user@address`.
 *
 * This is the corrected form of the former defect where the settings *id* was
 * passed to ssh for direct-address hosts, so probing/browsing never worked for
 * a host that was configured by address instead of imported from ssh config.
 */
export interface SshEndpoint {
  /** Stable wire identity (`local` never becomes an SshEndpoint). */
  readonly hostId: string
  /** Alias, or `user@address`, or bare `address`. */
  readonly sshTarget: string
  /** Explicit port; empty when an alias decides. */
  readonly port: string
  /** Explicit identity file; empty when the ssh default/agent decides. */
  readonly keyPath: string
}

/** Failure class of one ssh invocation. */
export type SshFailureKind = 'spawn-missing' | 'timeout' | 'unreachable' | 'exit'

/** Typed transport failure; callers map it onto a `remote-dev/*` code. */
export class SshExecutionError extends Error {
  readonly kind: SshFailureKind
  readonly stderr: string
  readonly code: number

  constructor(kind: SshFailureKind, message: string, stderr: string, code: number) {
    super(message)
    this.name = 'SshExecutionError'
    this.kind = kind
    this.stderr = stderr
    this.code = code
  }
}

/** Result of one completed ssh invocation (any exit code). */
export interface SshScriptResult {
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

/** The shared ssh connection flags, unchanged from the original host half. */
export const SSH_FLAGS: readonly string[] = [
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=8',
  '-o', 'ServerAliveInterval=15',
  '-o', 'ServerAliveCountMax=2',
]

/**
 * Parse concrete host aliases out of an OpenSSH client config.
 * Pattern-only hosts (`*`, `?`, `!`) are ignored.
 * @param text - raw `~/.ssh/config` body.
 * @returns one entry per concrete alias, in file order, first occurrence kept.
 */
export function parseSshHosts(text: string): SshHostEntry[] {
  const out: SshHostEntry[] = []
  let indexes: number[] = []
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const m = /^(\w+)[\s=]+(.*)$/.exec(line)
    if (m === null) continue
    const keyword = (m[1] ?? '').toLowerCase()
    const value = (m[2] ?? '').trim()
    if (keyword === 'host') {
      indexes = []
      for (const alias of value.split(/\s+/)) {
        if (alias === '' || /[*?!]/.test(alias)) continue
        indexes.push(out.length)
        out.push({ id: alias, hostName: '', user: '', port: '', proxyJump: '' })
      }
      continue
    }
    if (indexes.length === 0) continue
    if (keyword !== 'hostname' && keyword !== 'user' && keyword !== 'port' && keyword !== 'proxyjump') continue
    for (const i of indexes) {
      const cur = out[i]
      if (cur === undefined) continue
      if (keyword === 'hostname') out[i] = { ...cur, hostName: value }
      else if (keyword === 'user') out[i] = { ...cur, user: value }
      else if (keyword === 'port') out[i] = { ...cur, port: value }
      else out[i] = { ...cur, proxyJump: value }
    }
  }
  const seen = new Set<string>()
  return out.filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)))
}

/**
 * Fold aliases that resolve to the same `(HostName, User, Port)` into one
 * candidate, and mark aliases referenced through another host's ProxyJump.
 * @param parsed - output of {@link parseSshHosts}.
 * @returns one row per real machine, in first-seen order.
 */
export function foldHosts(parsed: readonly SshHostEntry[]): FoldedSshHost[] {
  const jumpNames = new Set<string>()
  for (const h of parsed) {
    if (h.proxyJump !== '') for (const j of h.proxyJump.split(',')) jumpNames.add(j.trim())
  }
  const byKey = new Map<string, {
    id: string
    name: string
    hostName: string
    user: string
    port: string
    proxyJump: string
    aliases: string[]
    jump: boolean
  }>()
  for (const h of parsed) {
    const hostName = h.hostName !== '' ? h.hostName : h.id
    const key = `${hostName}|${h.user}|${h.port}`
    const existing = byKey.get(key)
    if (existing !== undefined) {
      existing.aliases.push(h.id)
      continue
    }
    byKey.set(key, {
      id: h.id,
      name: h.id,
      hostName,
      user: h.user,
      port: h.port,
      proxyJump: h.proxyJump,
      aliases: [h.id],
      jump: jumpNames.has(h.id),
    })
  }
  return [...byKey.values()]
}

/** Tunnel failure classes surfaced by {@link classifyTunnelFailure}. */
export type TunnelFailureKind = 'remote-dsh-down' | 'ssh-refused' | 'ssh-unreachable'

/**
 * Classify raw ssh stderr into an actionable tunnel failure.
 * @param stderr - accumulated ssh stderr.
 * @returns the class, or `null` when nothing recognizable matched.
 */
export function classifyTunnelFailure(stderr: string): TunnelFailureKind | null {
  const text = String(stderr || '')
  if (/open failed:\s*connect failed:\s*connection refused/i.test(text)) return 'remote-dsh-down'
  if (/channel \d+:[^\n]*connection refused/i.test(text)) return 'remote-dsh-down'
  if (/ssh:\s*connect to host [^\n]*connection refused/i.test(text)) return 'ssh-refused'
  if (/ssh:\s*connect to host [^\n]*(timed out|no route to host)/i.test(text)) return 'ssh-unreachable'
  if (/connection timed out|operation timed out|no route to host/i.test(text)) return 'ssh-unreachable'
  return null
}

/**
 * Operator-facing message for one classified tunnel failure. Wording preserved
 * from the original host half: it is a real asset (it names the actionable next
 * step, including "start DSH detached from the ssh session").
 * @param kind - classification result.
 * @param host - host identity shown to the user.
 * @param port - remote DSH port.
 * @param stderr - raw ssh stderr.
 */
export function tunnelFailureMessage(
  kind: TunnelFailureKind,
  host: string,
  port: string,
  stderr: string,
): string {
  const raw = String(stderr || '').trim().slice(0, 300)
  const appendix = raw ? `（ssh 原文：${raw}）` : ''
  switch (kind) {
    case 'remote-dsh-down':
      return `远端 DSH 似乎没有在运行：ssh 已连上 ${host}，但远端 127.0.0.1:${port} 拒绝连接。`
        + '可以让本地的 DSH agent 帮你把它起起来，例如直接对它说：'
        + `「帮我在 ${host} 上把 DSH web 装好并常驻起来」。`
        + '注意必须脱离 SSH 会话启动（setsid/nohup + 重定向输出），否则 ssh 一断进程就跟着死。'
        + appendix
    case 'ssh-refused':
      return `ssh 连不上 ${host}：地址/端口拒绝连接（不是"远端 DSH 没在跑"，是 ssh 通道本身不通）。`
        + '请确认主机在跑 sshd、地址与端口填对。'
        + appendix
    case 'ssh-unreachable':
      return `ssh 连不上 ${host}：网络不可达或超时（检查地址、端口、防火墙）。`
        + appendix
  }
}

/**
 * Build the ssh argument vector for one endpoint.
 * Explicit `-p`/`-i` are added only for direct endpoints; an alias carries its
 * own port, identity, and jump host.
 * @param endpoint - resolved ssh target.
 * @param extra - trailing arguments (for example `['-L', '127.0.0.1:1:127.0.0.1:2']`).
 */
export function sshArgsFor(endpoint: SshEndpoint, extra: readonly string[] = []): string[] {
  const args = [...SSH_FLAGS]
  if (endpoint.port !== '') args.push('-p', endpoint.port)
  if (endpoint.keyPath !== '') args.push('-i', endpoint.keyPath.replace(/^~/, homedir()))
  args.push(endpoint.sshTarget)
  return args.concat(extra)
}

/**
 * SSH flags for the short reachability probe (its own timeouts).
 */
export const SSH_PROBE_FLAGS: readonly string[] = [
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=4',
  '-o', 'StrictHostKeyChecking=accept-new',
]

/**
 * Run a bash script over ssh, passing values as extra remote argv.
 *
 * ssh does not forward arbitrary environment variables, so values are base64
 * encoded into the remote argv (`bash -s -- <b64>`) and decoded inside the
 * script — base64 carries no shell metacharacters, so there is no injection
 * surface.
 * @param endpoint - resolved ssh target.
 * @param script - bash script fed on stdin.
 * @param values - values appended to the remote argv as base64.
 * @param timeoutMs - hard timeout.
 */
export function sshScript(
  endpoint: SshEndpoint,
  script: string,
  values: readonly string[] = [],
  timeoutMs = 20000,
): Promise<SshScriptResult> {
  const encoded = values.map((v) => Buffer.from(String(v), 'utf8').toString('base64'))
  const remoteCommand = ['bash -s --', ...encoded].join(' ')
  return new Promise((resolve, reject) => {
    const child = execFile(
      'ssh',
      sshArgsFor(endpoint, ['--', remoteCommand]),
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const out = String(stdout || '')
        const errText = String(stderr || '')
        if (err) {
          const rawCode: unknown = (err as { code?: unknown }).code
          if (rawCode === 'ENOENT') {
            reject(new SshExecutionError('spawn-missing', '本机找不到 ssh 可执行文件', errText, -1))
            return
          }
          if ((err as { killed?: boolean }).killed === true) {
            reject(new SshExecutionError('timeout', `ssh ${endpoint.hostId} 超时`, errText, -2))
            return
          }
          const connectFailed = out === '' && /(connect|refused|timed out|denied|permission|no route|resolve)/i.test(errText)
          if (connectFailed) {
            reject(new SshExecutionError(
              'unreachable',
              `ssh ${endpoint.sshTarget} 连接失败：${errText.trim().slice(0, 240)}`,
              errText,
              typeof rawCode === 'number' ? rawCode : 1,
            ))
            return
          }
        }
        resolve({ stdout: out, stderr: errText, code: err ? (typeof err.code === 'number' ? err.code : 1) : 0 })
      },
    )
    child.stdin?.end(script)
  })
}

/**
 * Issue one GET against a local tunnel port.
 * @param url - absolute URL.
 * @param timeoutMs - socket timeout.
 * @returns the HTTP status, or `0` when nothing answered.
 */
export function httpStatus(url: string, timeoutMs = 1500): Promise<number> {
  return new Promise((resolve) => {
    // Imported lazily to keep this module's node-http usage in one place.
    void import('node:http').then(({ get }) => {
      const rq = get(url, (rs) => {
        rs.resume()
        resolve(rs.statusCode ?? 0)
      })
      rq.on('error', () => resolve(0))
      rq.setTimeout(timeoutMs, () => {
        rq.destroy()
        resolve(0)
      })
    }, () => resolve(0))
  })
}

/** Decode helper prepended to scripts that receive a path as `$1`. */
export const DECODE_PATH = 'RWS_PATH=""; if [ -n "$1" ]; then RWS_PATH=$(printf %s "$1" | base64 -d) || exit 9; fi\n'
