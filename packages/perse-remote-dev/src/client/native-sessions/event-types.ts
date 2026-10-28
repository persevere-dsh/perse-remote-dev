/** Internal JSON-shaped event entries before the one DSH SessionEventSource boundary cast. */
export type NativeEventEntry =
  | { readonly type: 'event'; readonly event: Readonly<Record<string, unknown>> }
  | { readonly type: 'transient'; readonly event: Readonly<Record<string, unknown>> }
