/**
 * Remote-DSH tunnel lifecycle.
 *
 * `ssh -N -L 127.0.0.1:<local>:127.0.0.1:<remote>` from
 * a local port probed by *binding* it (binding port 0 would always succeed and
 * turn probing into not-checking), and an address decorated with the remote
 * DSH's current `?token=` — re-read on every open *and* every reuse, because the
 * remote token changes when the remote process restarts.
 *
 * Failures are typed RemoteError codes (the classifier's
 * three classes plus two more) instead of free-form strings, and
 * `requireAuthentication` promotes a missing/unverifiable token from a `warning`
 * field into `remote-dev/token-unavailable` carrying the degraded URL.
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { classifyTunnelFailure, httpStatus, sshArgsFor, tunnelFailureMessage } from './ssh.ts'
import type { SshEndpoint, TunnelFailureKind } from './ssh.ts'
import type { RemoteTunnelView } from './types.ts'

/** First local port tried when a new tunnel is opened. */
export const TUNNEL_PORT_FROM = 18080
/** How many consecutive ports are probed before giving up. */
export const TUNNEL_PORT_SPAN = 40

/** What one tunnel needs. */
export interface TunnelRequest {
  /**
   * Stable wire identity; also the tunnel key's host half. When several config
   * records fold onto one ssh alias this is the *alias*, so it alone cannot tell
   * the records apart.
   */
  readonly hostId: string
  /**
   * The settings record id that opened (or reuses) this tunnel. Multiple
   * records may share a `fromAlias`, so `hostId` folds them onto the alias and a
   * `closeTunnel(<config id>)` could never find its own tunnel. Keeping the config
   * id as a separate identity lets `closeByHostId` answer to either form.
   */
  readonly configId?: string
  readonly endpoint: SshEndpoint
  readonly remotePort: string
  /** Fail with `remote-dev/token-unavailable` rather than degrading. */
  readonly requireAuthentication: boolean
}

/** Result of one token read from the remote DSH log. */
export interface TokenRead {
  readonly token?: string
  readonly error?: string
}

/** Injected ssh/log access, so this module stays testable without a network. */
export interface TunnelDependencies {
  readonly readToken: (endpoint: SshEndpoint, remotePort: string) => Promise<TokenRead>
}

interface Tunnel {
  readonly key: string
  readonly hostId: string
  /**
   * Every config-record id that answers to this tunnel. A tunnel opened by config
   * record A may later be reused by config record B (same alias + remote port), so
   * both ids must be able to close it.
   */
  readonly configIds: Set<string>
  readonly endpoint: SshEndpoint
  readonly remotePort: string
  readonly localPort: number
  readonly proc: ChildProcess
  url: string
  authenticated: boolean
  warning?: string
  readonly openedAt: number
  refreshedAt: number
}

/**
 * Find a free local port by *binding* each candidate.
 * @param from - first candidate.
 * @param span - how many candidates to try.
 * @returns the port, or `0` when the whole window is occupied.
 */
export function findFreePort(from: number, span = TUNNEL_PORT_SPAN): Promise<number> {
  return new Promise((resolve) => {
    let p = from
    const tryBind = (): void => {
      if (p > from + span) {
        resolve(0)
        return
      }
      const srv = createServer()
      srv.once('error', () => {
        p += 1
        tryBind()
      })
      srv.once('listening', () => {
        const chosen = p
        srv.close(() => resolve(chosen))
      })
      srv.listen(p, '127.0.0.1')
    }
    tryBind()
  })
}

/** Owns every live tunnel for one plugin instance. */
export class TunnelManager {
  private readonly tunnels = new Map<string, Tunnel>()

  constructor(private readonly deps: TunnelDependencies) {}

  /** Snapshot for the wire. */
  list(): RemoteTunnelView[] {
    const out: RemoteTunnelView[] = []
    for (const v of this.tunnels.values()) {
      out.push({
        hostId: v.hostId,
        url: v.url,
        localPort: v.localPort,
        remotePort: v.remotePort,
        alive: v.proc.exitCode === null,
        openedAt: v.openedAt,
        refreshedAt: v.refreshedAt,
        authenticated: v.authenticated,
        ...v.warning === undefined ? {} : { warning: v.warning },
      })
    }
    return out
  }

  /**
   * Close every tunnel belonging to one host identity. Accepts either the stable
   * wire identity (`fromAlias`/folded alias, what `open` reports) or a settings
   * record id, so two records sharing one alias can each be closed by config id.
   * @param hostId - stable host identity or config-record id.
   * @returns whether anything was closed.
   */
  closeByHostId(hostId: string): boolean {
    let closed = false
    for (const [key, v] of [...this.tunnels]) {
      if (v.hostId !== hostId && !v.configIds.has(hostId)) continue
      try {
        v.proc.kill()
      } catch {
        /* the process is already gone */
      }
      this.tunnels.delete(key)
      closed = true
    }
    return closed
  }

  /** Kill every tunnel (plugin disposal). */
  dispose(): void {
    for (const v of this.tunnels.values()) {
      try {
        v.proc.kill()
      } catch {
        /* the process is already gone */
      }
    }
    this.tunnels.clear()
  }

  /**
   * Open or reuse one tunnel and return a browser-openable address.
   * @param request - target plus authentication strictness.
   * @param signal - carrier cancellation.
   */
  async open(request: TunnelRequest, signal: AbortSignal): Promise<{ view: RemoteTunnelView; reused: boolean }> {
    signal.throwIfAborted()
    const key = `${request.hostId}:${request.remotePort}`
    const alive = this.tunnels.get(key)
    if (alive !== undefined && alive.proc.exitCode === null) {
      if (request.configId !== undefined && request.configId !== '') alive.configIds.add(request.configId)
      const d = await this.decorate(alive.localPort, request, signal)
      alive.url = d.url
      alive.authenticated = d.authenticated
      alive.refreshedAt = Date.now()
      if (d.warning === undefined) delete alive.warning
      else alive.warning = d.warning
      return { view: this.view(alive), reused: true }
    }

    const localPort = await findFreePort(TUNNEL_PORT_FROM)
    if (localPort === 0) {
      throw new RemoteError(
        'remote-dev/tunnel-port-exhausted',
        `找不到可用本地端口（${TUNNEL_PORT_FROM}-${TUNNEL_PORT_FROM + TUNNEL_PORT_SPAN} 都被占用）`,
        { from: TUNNEL_PORT_FROM, to: TUNNEL_PORT_FROM + TUNNEL_PORT_SPAN },
      )
    }

    const proc = spawn('ssh', sshArgsFor(request.endpoint, ['-N', '-o', 'ExitOnForwardFailure=yes', '-L', `127.0.0.1:${localPort}:127.0.0.1:${request.remotePort}`]), { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr?.on('data', (b: Buffer) => {
      stderr += String(b)
    })
    let exitCode: number | null = null
    let spawnError: Error | null = null
    // Read through a function: TS's control-flow analysis cannot see the
    // callback assignment and would otherwise narrow this to `never`.
    const spawnFailure = (): Error | null => spawnError
    proc.on('error', (e: Error) => {
      spawnError = e
    })
    proc.on('exit', (code: number | null) => {
      exitCode = code
      const cur = this.tunnels.get(key)
      if (cur !== undefined && cur.proc === proc) this.tunnels.delete(key)
    })

    const probeUrl = `http://127.0.0.1:${localPort}/`
    for (let i = 0; i < 40; i++) {
      signal.throwIfAborted()
      if (spawnFailure() !== null || exitCode !== null) break
      if (classifyTunnelFailure(stderr) !== null) break
      await new Promise((r) => setTimeout(r, 300))
      const code = await httpStatus(probeUrl)
      if (code !== 0) {
        const d = await this.decorate(localPort, request, signal)
        const opened: Tunnel = {
          key,
          hostId: request.hostId,
          configIds: new Set(request.configId === undefined || request.configId === '' ? [] : [request.configId]),
          endpoint: request.endpoint,
          remotePort: request.remotePort,
          localPort,
          proc,
          url: d.url,
          authenticated: d.authenticated,
          ...d.warning === undefined ? {} : { warning: d.warning },
          openedAt: Date.now(),
          refreshedAt: Date.now(),
        }
        this.tunnels.set(key, opened)
        return { view: this.view(opened), reused: false }
      }
    }

    try {
      proc.kill()
    } catch {
      /* already gone */
    }
    this.tunnels.delete(key)
    const spawnErrorValue = spawnFailure()
    if (spawnErrorValue !== null) {
      throw new RemoteError(
        'remote-dev/tunnel-failed',
        '无法启动 ssh：' + spawnErrorValue.message,
        { hostId: request.hostId, port: request.remotePort, stderr: spawnErrorValue.message },
      )
    }
    const kind = classifyTunnelFailure(stderr)
    if (kind !== null) throw tunnelError(kind, request, stderr)
    if (exitCode !== null) {
      throw new RemoteError(
        'remote-dev/tunnel-failed',
        `ssh 隧道退出（code ${exitCode}）${stderr.trim().slice(0, 200)}`,
        { hostId: request.hostId, port: request.remotePort, stderr: stderr.trim().slice(0, 200) },
      )
    }
    throw new RemoteError(
      'remote-dev/tunnel-failed',
      '隧道建立后 12 秒内远端无 HTTP 响应（远端 dsh 是否在跑？）'
        + (stderr !== '' ? `：${stderr.trim().slice(0, 200)}` : ''),
      { hostId: request.hostId, port: request.remotePort, stderr: stderr.trim().slice(0, 200) },
    )
  }

  private view(t: Tunnel): RemoteTunnelView {
    return {
      hostId: t.hostId,
      url: t.url,
      localPort: t.localPort,
      remotePort: t.remotePort,
      alive: t.proc.exitCode === null,
      openedAt: t.openedAt,
      refreshedAt: t.refreshedAt,
      authenticated: t.authenticated,
      ...t.warning === undefined ? {} : { warning: t.warning },
    }
  }

  /**
   * Assemble the openable address: read the remote token, prove it against the
   * tunnel with a real GET, and retry once when the token looks stale (the
   * remote DSH restarted while the tunnel lived).
   */
  private async decorate(
    localPort: number,
    request: TunnelRequest,
    signal: AbortSignal,
  ): Promise<{ url: string; authenticated: boolean; warning?: string }> {
    const base = `http://127.0.0.1:${localPort}/`
    const verify = async (t: TokenRead): Promise<{ ok: boolean; url: string; reason: string }> => {
      if (t.token === undefined || t.token === '') {
        return { ok: false, url: base, reason: t.error ?? '未知原因' }
      }
      const url = `${base}?token=${encodeURIComponent(t.token)}`
      const code = await httpStatus(url)
      if (code !== 401 && code !== 0) return { ok: true, url, reason: '' }
      return {
        ok: false,
        url,
        reason: code === 0
          ? '隧道端口无 HTTP 响应（远端 dsh 是否在跑？）'
          : `远端拒绝了该 token（HTTP ${code}，多为远端重启后 token 已变）`,
      }
    }

    const t1 = await this.deps.readToken(request.endpoint, request.remotePort)
    signal.throwIfAborted()
    const v1 = await verify(t1)
    if (v1.ok) return { url: v1.url, authenticated: true }

    if (t1.token !== undefined && t1.token !== '') {
      const t2 = await this.deps.readToken(request.endpoint, request.remotePort)
      if (t2.token !== undefined && t2.token !== '' && t2.token !== t1.token) {
        const v2 = await verify(t2)
        if (v2.ok) return { url: v2.url, authenticated: true }
      }
      if (request.requireAuthentication) {
        throw new RemoteError(
          'remote-dev/token-unavailable',
          `远端 DSH token 校验未通过（${v1.reason}）`,
          { hostId: request.hostId, reason: v1.reason, url: v1.url },
        )
      }
      return {
        url: v1.url,
        authenticated: false,
        warning: `远端 DSH token 校验未通过（${v1.reason}）：已返回带 token 的地址，`
          + '打开可能仍是 401。请确认远端 dsh web 正在运行，再重新打开。',
      }
    }

    if (request.requireAuthentication) {
      throw new RemoteError(
        'remote-dev/token-unavailable',
        `未取到远端 DSH 认证 token（${v1.reason}）`,
        { hostId: request.hostId, reason: v1.reason, url: base },
      )
    }
    return {
      url: base,
      authenticated: false,
      warning: `未取到远端 DSH 认证 token（${v1.reason}）：已返回不带 token 的地址，`
        + '浏览器会看到 401。请确认远端 dsh web 正在运行（远端 ~/.dsh/web.log 里有 token= 行），再重新打开。',
    }
  }
}

/** Map one classifier class onto its RemoteError code. */
function tunnelError(
  kind: TunnelFailureKind,
  request: TunnelRequest,
  stderr: string,
): RemoteError {
  const message = tunnelFailureMessage(kind, request.hostId, request.remotePort, stderr)
  const details = { hostId: request.hostId, port: request.remotePort, stderr: stderr.trim().slice(0, 300) }
  switch (kind) {
    case 'remote-dsh-down':
      return new RemoteError('remote-dev/remote-dsh-down', message, details)
    case 'ssh-refused':
    case 'ssh-unreachable':
      return new RemoteError('remote-dev/ssh-unreachable', message, details)
  }
}
