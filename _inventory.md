Squad Beacon repository guide

Project entry and configuration:
- app.config.ts, app.json: Expo app configuration and platform metadata.
- package.json, package-lock.json: scripts and pinned JavaScript dependencies.
- tsconfig.json, eslint.config.js: TypeScript aliases/checks and lint rules.
- playwright.config.ts: browser smoke-test configuration.
- eas.json: EAS build profiles.
- README.md, APP_OVERVIEW.md, APP_OVERVIEW_SHORT.md, CLAUDE.md, LICENSE: setup and implementation guide, comprehensive feature guide, concise product summary, contributor guidance, and license.
- REMAINING_UI_CHANGES.md: blueprint checkpoint status, remaining work, priorities, and dependencies.

Authored product areas:
- app/: Expo Router route files; see app/_inventory.md.
- src/: shared contracts, feature implementations, and platform adapters; see src/_inventory.md.
- components/: Expo-shared inputs and starter components. Platform-specific siblings stay together.
- constants/: app-wide static constants.
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
