# Persevere with DSH — PC remote control

Read `docs/pc-spec.md`, `docs/pc-plan.md`, `docs/pc-contract.md` and `docs/protocol/` before edits. Canonical requirements and remote protocol live in `perse-ios-app/specs/001-remote-development`, `002-mobile-workflows`, `003-task-centered-experience` and `004-pc-remote-control`. Change the contract before observable behavior; map implementation/tests/evidence to D01–D09. Never silently update protocol fixtures.

Concrete implementation is delegated to GPT-6 Luna. The primary agent owns architecture, review and integration. Use official Cordis slots and generated Typert owner Remote. The bridge uses existing Perse Remote 1.2 with Authorization header; no new listener, token URL, DSH log scraping, model tool exposure, arbitrary root or duplicated Agent runtime. Browser UI never receives durable credentials. Preserve legacy user settings; retired unsafe open routes report explicit migration errors.

Never change the installed Harness source or active user profiles. Pack tarballs for isolated installation; never link package directories. Distinguish fixture tests, real DSH and live model execution. Browser/desktop interaction uses Codex built-in `mcp__cua_repl` only, never cua-driver or direct Playwright/CDP. Keep only latest package and concise evidence; do not delete user data.
