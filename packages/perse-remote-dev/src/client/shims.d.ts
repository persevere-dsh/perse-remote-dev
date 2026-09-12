/**
 * Compiler-only ambient surface for the browser half.
 *
 * The out-of-tree workspace has no published copies of the Client runtime
 * packages (React types, `@deepseek-ai/dsh-client-ui-slots`,
 * `@deepseek-ai/dsh-api-gateway/client`), so the browser half declares the
 * minimum it consumes. Two rules keep this honest:
 *
 *   1. NOTHING here restates a generated Remote signature. `ctx.remote` is
 *      typed as `TypertClientRemote`, which extends the merge-extensible
 *      `TypertRemoteNamespaceMap`; the frozen host package's generated
 *      `lib/typert.remote-client.d.ts` (pulled in by the `perse-remote-dev/remote`
 *      import in `./index.ts`) supplies `remoteDev` and all 15 method
 *      signatures through declaration merging. No `Pick`, no local copy.
 *   2. `ctx.slots` is declared structurally: the official slot registry types
 *      live in a package this workspace cannot resolve, and only
 *      `inject`/`register`/`entries` are used.
 */

/** One slot registration's options, as this plugin uses them. */
interface RwsSlotOptions {
  readonly name: string
  readonly id?: string
  readonly key?: string
  readonly order?: number
  readonly label?: () => string
  readonly priority?: number
  readonly select?: (...args: readonly never[]) => unknown
  readonly inject?: (() => object) | Record<string, unknown>
  readonly children?: Record<string, unknown>
  readonly store?: unknown
  readonly locale?: string
}

/** Structural view of `ctx.slots` (the `SlotRegistry` service). */
interface RwsSlotsService {
  inject(key: string, callback: () => unknown): void
  register(options: RwsSlotOptions, component: unknown): () => void
  entries(key: string): readonly unknown[]
}

declare module 'react' {
  /** A React element placeholder: components only ever pass it back to React. */
  export type RwsReactElement = unknown
  export function createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): RwsReactElement
  export function useState<S>(initial: S | (() => S)): [S, (next: S | ((previous: S) => S)) => void]
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useRef<T>(initial: T): { current: T }
  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]): T
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T
  export const Fragment: unknown
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  /**
   * The Client Remote facade. `$mount` is the protocol's public mounting API —
   * the exact call the official `@deepseek-ai/dsh-api-remotes/client` assembly
   * makes (OFFICIAL-SPEC R7.1/R7.2). Namespace methods arrive through
   * `TypertRemoteNamespaceMap`, merged by the generated host artifact.
   */
  export interface TypertClientRemote extends TypertRemoteNamespaceMap {
    $mount(contribution: TypertRemoteContribution): Promise<() => Promise<void>>
    readonly $host: {
      readonly home: string | undefined
      readonly isLoopback: boolean
    }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Typed Client Remote facade (provided by `@deepseek-ai/dsh-api-gateway/client`). */
    remote: import('@deepseek-ai/dsh-typert-protocol').TypertClientRemote
    /** Slot registry (provided by `@deepseek-ai/dsh-client-ui-renderer`). */
    slots: RwsSlotsService
    /**
     * Service lookup through the reflection layer: returns `undefined` when the
     * service is absent, which is how this plugin treats the optional
     * `uiWorkspace` service without gating its whole fiber on it.
     */
    get(name: string): unknown
    /** Install a child plugin owned by this context's fiber (Cordis registry mix-in). */
    plugin(plugin: object, config?: unknown): unknown
    /**
     * Run a callback once the requested services are available (Cordis registry
     * mix-in: `ctx.plugin({ inject, apply })` shorthand). Declared structurally
     * because this interface replaces the published `Context` declaration —
     * Cordis augments its own `./context.ts` module, which does not survive a
     * module augmentation of the package entry.
     */
    inject(deps: readonly string[] | Record<string, unknown>, callback: (scoped: Context) => void): unknown
    /**
     * Register a cleanup-aware effect on this context's fiber (Cordis fiber
     * mix-in). The body may return a disposer.
     */
    effect(execute: () => void | (() => void), label?: string): unknown
  }
}
