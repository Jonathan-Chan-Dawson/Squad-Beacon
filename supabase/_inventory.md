Supabase database and functions

- config.toml: local Supabase configuration.
- migrations/: ordered schema, RLS, RPC, and data-contract changes. The timestamped SQL files are applied in order; do not edit or deploy applied migrations without an explicit migration plan.
- functions/_shared/server.ts: shared edge-function server utilities.
- functions/delete-account/index.ts: account deletion function.
- functions/push-worker/index.ts: push delivery worker.
- functions/deno.json and deno.lock: edge-function runtime dependency manifest/lock.
- schedules.sql: database scheduler definitions.

No remote deployment is performed by local source changes.
