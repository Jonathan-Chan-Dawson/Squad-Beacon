# Squad Beacon contributor guide

## Find the relevant code

- Start with `_inventory.md`, then read only the relevant feature inventory. Inventories are navigation aids; verify current imports and callers before treating an entry as active or unused.
- `app/` contains Expo Router entry points. Implementations live under `src/features/`; route files and redirects can be used by external deep links without incoming imports.
- Keep `.native`, `.web`, `.ios`, and default platform siblings together when tracing usage.
- `src/shared/store.tsx` owns account state, authorized snapshots, and action dispatch; `src/shared/supabase.ts` owns the backend client and RPC transport; `src/shared/demo.ts` mirrors actions for demo mode.
- `src/theme/` owns theme tokens and palettes; shared theme exports retain compatibility aliases.
- `src/features/social/communityPresentation.ts` maps stable database names to UI labels: `space` means Organization, `organization` means Network, and `squad` means Squad. Preserve database identifiers.

## Preserve behavior

- Check the working tree before editing and preserve concurrent changes. Confirm ownership before changing files another task is actively editing.
- Trace routes, imports, platform variants, capability flags, tests, and SQL callers before removing code. SQL functions named legacy can remain part of the dispatcher/snapshot chain.
- Preserve navigation, Beacon/Ping/Vote/Draw behavior, permissions, account-switch guards, and database integrations. Do not remove authorization or stale-response checks as duplication.
- Treat migrations as ordered history. Do not delete or rewrite applied migrations as cleanup; use additive migrations for approved database changes.

## Documentation and validation

- README.md owns setup instructions; `_inventory.md` and feature inventories own code navigation. Dated plans/validation reports describe historical work, not current test counts or deployment status.
- Keep guidance concise and link to canonical files instead of duplicating implementation details. Local ignored APP_OVERVIEW files are optional, not contributor prerequisites.
- Run `npm run typecheck` and `npm run lint` for source changes, plus relevant existing tests. `npm test` is an explicit selection; inspect package.json for focused suites and omitted tests.
- Database tests use local PGlite; they do not establish hosted Supabase or native-device acceptance. Build/export/browser checks can create artifacts; run them when relevant to the change.
- Do not split large files or add forwarding layers merely to reduce line counts. Prefer cohesive responsibilities and direct imports.
