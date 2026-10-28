import type { ExternalSessionsRegistry } from './core-types.ts'

/** Runtime feature detection for old DSH builds that expose ISessions only. */
export function hasExternalSessionsApi(value: unknown): value is ExternalSessionsRegistry {
  if (typeof value !== 'object' || value === null) return false
  const registry = value as Record<string, unknown>
  const requiredMethods = [
    'registerExternalBackend', 'createExternalSession', 'respondExternalApproval',
    'externalAddressOf', 'externalIdentityOf', 'retain', 'using',
  ]
  return requiredMethods.every(method => typeof registry[method] === 'function')
    && isObservable(registry.externalCatalog)
    && isObservable(registry.retainedBindings)
}

function isObservable(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const observable = value as Record<string, unknown>
  return typeof observable.getSnapshot === 'function' && typeof observable.subscribe === 'function'
}
