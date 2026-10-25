Squad Beacon repository guide

Project entry and configuration:
- app.config.ts, app.json: Expo app configuration and platform metadata.
- package.json, package-lock.json: scripts and pinned JavaScript dependencies.
- tsconfig.json, eslint.config.js: TypeScript aliases/checks and lint rules.
- playwright.config.ts: browser smoke-test configuration.
- eas.json: EAS build profiles.
- README.md: setup and operational guidance. AGENTS.md: concise contributor entry guide; CLAUDE.md forwards to it. LICENSE: license.
- APP_OVERVIEW.md and APP_OVERVIEW_SHORT.md: optional local product summaries excluded by .gitignore; not required for a fresh checkout.
- REMAINING_UI_CHANGES.md: blueprint checkpoint status, remaining work, priorities, and dependencies.

Authored product areas:
- app/: Expo Router route files; see app/_inventory.md.
- src/: shared contracts, feature implementations, and platform adapters; see src/_inventory.md.
- components/: shared date inputs, not-found theme compatibility, and web map styling. Platform-specific siblings stay together.
- assets/: app icons, splash artwork, and fonts; see assets/_inventory.md.
- public/: static web support files.
- tests/: unit, database, and browser tests; see tests/_inventory.md.
- supabase/: migrations, edge functions, and database schedule SQL; see supabase/_inventory.md.
- docs/: product, device, notification, and UI guidance; see docs/_inventory.md.
- scripts/: local tooling; see scripts/_inventory.md.

Native/configuration boundaries:
- android/: native Android project and build configuration; intentionally left in place.
- .codex/, .claude/, .vscode/: local agent/editor configuration; not product source.
- .env.example is a variable-name template. Do not put secrets in inventory files.

Generated, dependency, build, and temporary directories are intentionally omitted:
.git, .expo, node_modules, dist, dist-native, test-results, and .tmp-*.
