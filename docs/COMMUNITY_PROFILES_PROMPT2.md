# Community profiles — Prompt 2

Prompt 2 updates the existing Squad, Organization (`space`), and Network (`organization`) destinations. Backend identifiers, routes, independent membership, and Prompt 1 messaging remain unchanged.

Profiles prioritize interaction for Squads, related Squads for Organizations, and related Organizations for Networks. Direct Network–Squad associations remain separate from Organization–Squad associations. Connections are many-to-many associations; they do not confer ownership or membership.

Profile previews are bounded while focused directories retain the supported complete lists. Squad activity uses a combined preview budget of three items, with existing Activity and Plans destinations for the full experience.

Editable details and access-policy forms use Save/Cancel. Invitations, approvals, role changes, icon selection, and connection operations retain their existing individual action contracts and authorization checks.

## Permissions and rollout

Safe profile identity is independent of membership. Each roster, relationship, child-community list, and activity section retains its own authorization checks. Missing and unauthorized summary lookups must produce the same unavailable state.

Apply `supabase/migrations/202610140004_community_profiles.sql` before releasing the corresponding client. It adds the authenticated `community_profile_summary` read-only RPC using existing visibility predicates and the discovery summary projection. Missing and unauthorized IDs both return no rows. Source implementation does not apply migrations to hosted Supabase. No hierarchy or membership model is added.

## Verification

The focused selector/demo suite passes 46 tests. The social database integration test exercises all three exact-ID SQL branches, discovery projection parity, invitation/request access, revocation, denied/missing equivalence, and existing membership actions. Existing Organization and Space database regression suites also passed.

The final TypeScript check, full application ESLint check, and Expo web export passed. All 33 distinct affected browser scenarios passed across the focused and regression runs, including Prompt 1's nine scenarios. The final profile/social run passed 17/17 cases: mobile widths, legacy links, hierarchy navigation, settings save/cancel/discard, role restrictions, public joins, cancellable requests, grouping/conversion safeguards, and return context.

The local preview server now serves exported dynamic route templates for direct profile URLs rather than homepage HTML. This fixes hydration errors during deep-link verification; no application route paths were changed. The separate verification server used port 4174 so the existing preview server on 4173 could remain untouched.

Android native verification was attempted in a read-only emulator but repeated System UI/app-not-responding dialogs prevented a reliable profile/navigation check. The test emulator and Metro helper were closed. iOS verification is unavailable on this Windows host. Browser checks do not establish native navigation or keyboard correctness.
