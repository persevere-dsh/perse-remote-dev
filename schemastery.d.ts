/**
 * Ambient declaration of `@deepseek-ai/schemastery` for this workspace.
 *
 * The settings seam (`ctx.settings.register(ns, schema)`) is schemastery-typed,
 * while the Typert artifact pipeline is zod v4. Both are runtime peers provided
 * by the installed `dsh`; this file is compiler-only, exactly like
 * `typert-protocol.d.ts`, and the emitted JavaScript keeps the bare specifier.
 *
 * Only the surface this package builds is declared.
 */
declare module '@deepseek-ai/schemastery' {
  /** One schemastery schema value: callable validator plus JSON projection. */
  export interface SchemasterySchema<T = unknown> {
    (value: unknown): T
    toJSON(): unknown
  }

  export interface Schemastery {
    string(): SchemasterySchema<string>
    number(): SchemasterySchema<number>
    boolean(): SchemasterySchema<boolean>
    array<T>(inner: SchemasterySchema<T>): SchemasterySchema<readonly T[]>
    object(shape: Record<string, unknown>): SchemasterySchema<Record<string, unknown>>
  }

  const z: Schemastery
  export default z
}
