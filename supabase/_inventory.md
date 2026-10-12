Supabase database and functions

- config.toml: local Supabase configuration.
- migrations/: ordered schema, RLS, RPC, and data-contract changes. The timestamped SQL files are applied in order; do not edit or deploy applied migrations without an explicit migration plan.
- migrations/202610110004_ping_availability.sql: nullable Interested availability and availability-aware opt-in Auto-RSVP, integrated into the existing Ping actions without changing Vote/Draw resolution.
- migrations/202610110005_squad_icons.sql: persisted Squad icon metadata and an admin-only canonical update action; existing snapshot/RLS and decision actions are retained.
- functions/_shared/server.ts: shared edge-function server utilities.
- functions/delete-account/index.ts: account deletion function.
- functions/push-worker/index.ts: push delivery worker.
- functions/deno.json and deno.lock: edge-function runtime dependency manifest/lock.
- schedules.sql: database scheduler definitions.

No remote deployment is performed by local source changes.
