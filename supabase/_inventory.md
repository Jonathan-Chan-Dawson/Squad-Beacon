Supabase database and functions

- templates/confirmation.html and templates/recovery.html: reviewed token-hash email templates using hosted Site URL. Copy into hosted Auth email settings only after the HTTPS confirmation route is deployed; source files do not change hosted configuration.

- `20261028193122_guest_beacon_foundation.sql`: Phase 5.1 verified guests, hashed/revocable sharing, canonical RSVP ownership/admission, narrow service-only guest RPCs and guest_sharing capability.
- `20261029000145_guest_planning_continuity.sql`: Phase 5.2 canonical guest planning ownership/tallies, safe decision/selected Plan/Status projections, authorized result navigation, moderation and transactional member claiming; guest_planning capability. Both migrations are source-only until explicitly applied to the selected hosted backend. Setup belongs in README.md.

- 20261026185923_onboarding_progress.sql: owner-only optional UI progress, first-profile eligibility trigger and one idempotent claim RPC. Existing accounts are not marked new. Requires preceding ordered migrations; source-only until separately deployed. Does not change the survey gate.

- `20261025203005_living_plans.sql`: undated Plans, stable independent stops, backfill, scoped server actions/RLS and the living_plans capability.
- `20261025204150_collaborative_plans.sql`: canonical decision-result association, independent tentative Plan membership, suggestion notices and authorized chat links; adds collaborative_plans capability.
- `20261026002202_repeatable_plans_calendar.sql`: private reviewed Routine sources, recurring single Beacons, original-occurrence deduplication and generated occurrence metadata; keeps the existing generator, runner and ledger and adds repeatable_plans capability. These migrations are source-only until explicitly deployed in order.

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

- 202610140003_messaging_hub.sql: additive private DM read markers, canonical group read boundaries, and owner-validated private-list rename/protected deletion; source-only pending hosted rollout.

- 202610130001_status_emoji.sql through 202610130004_atomic_creation_invites.sql: local redesign extensions for finite persisted status emoji, atomic status mutation/history, bounded private-ledger Routine calendar projection and transactional selected invitations. Security-definer entry points keep empty search paths and scoped execute grants. Hosted deployment is pending target/authorization setup; no credentials or project link were available locally during audit.
- 202610140002_activity_history.sql: permission-scoped activity history RPC with capped keyset pages, host profile visibility, approved-going attendee checks, and unchanged shared snapshot. Source-only pending hosted rollout.

- 202610140004_community_profiles.sql: authenticated exact-ID community summaries using existing visibility predicates; no new tables or membership hierarchy. Hosted application is a separate rollout step.

- 20261026031141_beacon_invitation_recommendation.sql: removes the atomic Beacon recipient-count cap and raises only its invitation throttle to the approved 300/hour. Friendship, permissions, replay and the general action ceiling remain enforced. Source-only; hosted rollout pending.
