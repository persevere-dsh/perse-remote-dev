# PC bridge focused validation

Date: 2026-10-27. Scope: local bridge TypeScript/type behavior, bundling, and fake-gateway behavioral tests. This is not real DSH, UI, browser, or end-to-end acceptance evidence.

Commands run:

```sh
npm run contracts
npx tsc --noEmit --target ES2024 --module ESNext --moduleResolution Bundler \
  --lib ES2024,DOM,DOM.Iterable --types node --strict --skipLibCheck \
  --allowImportingTsExtensions --exactOptionalPropertyTypes --noUnusedLocals \
  --noUnusedParameters packages/perse-remote-dev/src/pc/bridge.ts \
  packages/perse-remote-dev/src/pc/profile-store.ts packages/perse-remote-dev/src/types.ts
npx tsdown packages/perse-remote-dev/src/pc/bridge.ts \
  packages/perse-remote-dev/src/pc/profile-store.ts \
  --out-dir packages/perse-remote-dev/lib/types/pc \
  --root packages/perse-remote-dev/src/pc --no-config --format esm \
  --platform node --target node22 --tsconfig /tmp/perse-pc-tsdown.json \
  --deps.never-bundle ws --deps.never-bundle @deepseek-ai/dsh-typert-protocol \
  --deps.never-bundle zod
node --test test/pc-bridge.test.mjs
```

Results: focused strict TypeScript check passed; focused bridge bundle passed; bridge tests **13/13 passed, 0 failed, 0 skipped**. Tests use an ephemeral fake HTTP/WebSocket gateway and private temporary profile directories. No real DSH host, browser, user DSH profile, or external endpoint was started or changed.

The full repository build and isolated-profile/package checks remain with the primary agent.
