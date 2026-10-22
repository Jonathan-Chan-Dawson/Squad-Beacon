# Public Discovery & Community Connections

## Delivered behavior

- One safe community identity row across public previews, Map previews, Beacon Overview, and Browse. Community actions stay secondary to RSVP and have distinct accessibility labels.
- Backend identifiers and actions are unchanged: `organization` displays as Network, `space` as Organization, and `squad` as Squad. Existing associations say “Associated with”; no organizer authority is inferred.
- Public Beacon summaries remain separate from readable Activity objects. Browse merges both by ID, preferring readable Activities, and applies existing filters before deterministic ranking and diversity.
- Summary-only profiles work without private entity rows. Member sections require both confirmed active membership and the independently readable member record. Public Beacons and related communities use scoped, paginated authorized queries. Scoped profile Beacon cards omit repeated community identity/actions because the page already supplies them.
- Membership eligibility reloads before actions; Joined/Requested follow server confirmation. Pending requests can be cancelled from detailed public profiles.
- Account, snapshot, route-focus, and request-generation checks discard stale results. Profile navigation preserves the mounted Map camera/filter/context/selection state. Sheet position is retained per viewer and Beacon.

## Database release

Apply `supabase/migrations/20261021165125_beacon_community_discovery.sql` through the normal migration release **before shipping the client**. It adds:

- `beacon_community_summaries(p_activity_ids uuid[])`: authenticated batches of at most 50 IDs; safe community summaries with relationship `associated` and priority 0/1/2.
- `community_public_beacons(p_entity_type text, p_entity_id uuid, p_limit integer default 20, p_offset integer default 0)`: the paginated public Beacon projection scoped to an authorized community association.

Private helpers are not executable by clients. Public endpoints check authentication and authorization, use empty function search paths, revoke PUBLIC/anon execution, and grant authenticated execution. Existing table grants, policies, RPC signatures, membership rules, and audience/RSVP semantics are unchanged.

No remote migration was applied. The Supabase CLI was unavailable during authoring; the migration follows the repository timestamp naming convention and is exercised by the PGlite migration suite. Missing new RPCs omit card enrichment and show retry states for profile activity lists.

## Verification

- Full automated suite: **467 passed, 0 failed**, covering canonical membership states, private/blocked/banned/archived communities, hidden hierarchy intermediates, revoked affiliations, exclusions/expiry/opt-outs, exact public fields, pagination bounds, anon denial, guest RSVP independence, ranking, deduplication, and existing Map behavior.
- Focused integration/regression suite: **49 passed, 0 failed** before the final context-reason additions; the final full suite includes those additions.
- Final focused RSVP/projection checks: **11 passed**, including ordinary open attendance with an unset legacy approval flag and no community enrollment.
- TypeScript, full lint, and final changed-source lint pass.
- Web, Android, and iOS production exports pass, including Hermes native bundles. Combined output: ignored `dist-native/community-release/`; refreshed web preview: ignored `dist/`.
- **28 browser journeys pass across the suite and focused reruns**: 26 passed in the suite, then both affected journeys passed after fixes. Includes light/dark profiles at 320/430px, request/cancel, authorized child communities, guest public RSVP, community membership, Map selection/Now-filter return, existing profile disclosures, selectors, and Map controls. Screenshots were visually inspected for compact profile layout.
- Browser verification uses Demo data and exercises navigation/UI integration. PGlite tests exercise the actual migration and authorization functions. No live Supabase deployment or native device result is implied.

## Device verification boundary

Production bundles do not verify native gestures or device accessibility. On Android/iOS, verify hardware Back, Map camera and sheet restoration, touch targets, VoiceOver/TalkBack, large text, themes, and reduced motion. No native device or simulator result is claimed here.
