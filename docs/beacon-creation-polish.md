# Beacon creation polish — Pass 1

Implemented October 23, 2026. This is a local implementation and verification record; no hosted deployment or database migration was performed.

## Delivered experience

- Blank Beacon is the dominant launcher action, followed by directly searchable built-in/owned templates, six personalized starter families, up to three actual owner-created past Beacons sorted by start time, local Continue Draft, and compact canonical creation routes.
- A fresh editor presents artwork/title, category, side-by-side timing, location, and People & Access before optional settings. At 375px, People & Access is visible in the initial viewport. One Advanced Options area holds details, appearance, aspirations, and independent template saving.
- Timing uses existing timezone/calendar rules. Web and native share place suggestions and Map round-trip sessions. Opening these controls does not enable Sonar or request device location. Publication requires a selected in-person coordinate or a usable HTTPS meeting link; unfinished templates and Council options retain their canonical semantics.
- People & Access separates visibility from eligible friend invitations, notification effects, open/approval joining, advisory/enforced capacity, community association, and post-publication People → Organizer roles management through existing canonical actions. Invitations remain capped at 20. No community-wide delivery or unsupported joining/discovery controls were added.
- Organizer management is reachable after publication at Beacon → People → Organizer roles. It uses existing `assign_beacon_role`/`revoke_beacon_role` actions and the existing owner/co-owner hierarchy, permits grants only to eligible approved Going participants, and rechecks eligibility before submitting.
- Real module switches use existing controls and permissions. Recommendations require an explicit action. Music/checklist expose supported configuration; content is added after creation.
- Read-only preview shares Beacon identity presentation, and explicitly covers visibility, invitees, location, joining/capacity, and the operation/destination. It invents no activity IDs, RSVP states, or participant content.

## Persistence and publication

Version 1 snapshots store account identity, editor fields, handoff/destination context, and recovery state. Restore validates field shapes, enums, controls, times, coordinates, recipients, and allowed recovery operations. Current recipients, community targets, associations, Plan destinations and Council access are checked against current application data/canonical authorization when used or submitted.

Snapshots are device-local: localStorage on web and SecureStore on native. Writes are serialized per account, use immutable chunk generations, and commit the index last. Native chunks preserve complete Unicode pairs and remain below 2KB. Failed saves are reported; Saved is shown only after successful persistence. Account epochs reject stale picker/restore/publication callbacks.

Before publication, the original operation, viewer, UUID and payload are frozen and persisted. A failed initial checkpoint blocks the request. Ambiguous outcomes retain that request and payload. Confirmed results are checkpointed before continuing; invitation sessions retain the created ID and only retry eligible pending recipients. Plain creation and atomic creation use actor-scoped transport checks, with the existing server expected-actor guard. Account-mismatch responses cannot discard an ambiguous pending request.

The implementation relies on the repository's canonical `beacon_action` request-result ledger and existing atomic creation/invitation actions. It adds no database migration and changes no RPC interface. If a deployed backend lacks these actions or cannot authoritatively confirm a response, publication remains pending with the original request; the client cannot establish a successful outcome independently. The creator's selected-place rule is UI validation, not a new server-wide policy for every legacy client.

## Changed areas

| Area | Files |
| --- | --- |
| Launcher/editor/review | `CreateHome.tsx`, `screens/CreateScreen.tsx`, `components/BeaconIdentity.tsx`, `ActivityCard.tsx`, `screens/ActivityDetailScreen.tsx`, `components/BeaconOrganizerRoles.tsx` |
| Focused controls | `components/CreationControls.tsx`, `creationModules.ts`, `components/CreationDateField.tsx` and `.native.tsx`, `creationValidation.ts` |
| Location/invitations | `components/CreationLocationInput.tsx`, `components/feed/CreationInvitees.tsx`, `createHandoff.ts` |
| Draft/recovery | `socialPlanningSession.ts`, `draftSnapshot.ts`, `creationDraftStorage.ts` |
| Integration | `maps/screens/MapScreen.tsx`, `planning/PlanningListScreen.tsx`, small `shared/ui.tsx` input-ref and `shared/store.tsx` actor/demo-idempotency changes |
| Coverage/docs | creation snapshot/recovery tests, browser creation suites, test script and feature inventory |

Unrelated working-tree changes were retained, including the existing Maps, social presence, selector, profile, and store edits. No lockfile, dependency, or schema changes were needed.

## Verification

- Final targeted domain, recovery, invitation, defaults, template, capacity/roles, and local database-contract run: **65 passed, 0 failed**. An additional full database access-control acceptance suite passed **41/41** scenarios, covering organizer grants, strict capacity, privacy, modules, invitation retries and other canonical authorization boundaries. Database tests execute the repository migrations in local PGlite, including atomic rollback/idempotency, Council authorization/resolution, Plan membership, and Routine behavior.
- Browser: **21 passed, 0 failed** on the final full run. A strengthened restart scenario also passed separately, restoring the title, enabled Checklist, private audience and capacity of 7. Coverage includes blank/template/search/reuse, restart restore, focused sheets, timing, strict capacity, preview, publication, independent template saving/editing, Plan/Routine/Council, calendar/invitee context, place search, Map cancellation, storage failure, and post-publication organizer role grant/removal.
- Visual checks cover 320/375/430px in light/dark themes, reduced motion, long titles, keyboard Tab, scrolling sheets, sticky footer, and a larger 1024px layout with enlarged input/button text. Accessibility roles/labels and target sizes were inspected in the rendered browser; this is not a physical screen-reader certification.
- TypeScript: passed. Full application source lint: passed. Web export: passed with 49 static routes. Final combined web/Android/iOS export: passed (`--platform all --no-bytecode`), with no native device claim.

An earlier full browser attempt had 19 passing checks and one browser page-setup timeout before application execution; rerunning the full suite with a 60-second startup allowance passed all 20; the completed final suite also passed the added organizer role scenario (21/21). Earlier assertions that assumed obsolete Council/detail/template navigation were updated to the actual canonical routes; the tests now exercise successful creation and editing through those routes.

Rendered evidence is in `.expo/creation-polish/`: `editor-{320,375,430}-{light,dark}.png`, matching `people-*` and `review-*` states, and `editor-tablet-large-text.png`. These are actual browser captures of the implemented UI.

## Verification boundaries

No physical iOS/Android device, native keyboard, GPS permission prompt, hosted Supabase project, push delivery, or real screen-reader session was exercised. Native checks validate JavaScript bundling, not signed application packages or device behavior. Browser scenarios use the demo backend; database tests validate repository schema behavior locally. Existing post-publication discovery/roles and featuring/Current Activity/Sonar flows were preserved.

Drafts do not cloud-sync, and unsaved edits are not promised across restart. Storage capacity is bounded to 100 saved drafts per account and a validated snapshot size; storage failure leaves the editor open with an honest error. Clearing browser/app storage removes local recovery state. A server acknowledgement that cannot be recovered remains a pending request, rather than authorizing a new Beacon.

## Rendered examples

| State | Evidence |
| --- | --- |
| Essential editor at 375px | [Light](../.expo/creation-polish/editor-375-light.png) · [Dark](../.expo/creation-polish/editor-375-dark.png) |
| Narrow editor at 320px | [Light](../.expo/creation-polish/editor-320-light.png) · [Dark](../.expo/creation-polish/editor-320-dark.png) |
| Wider phone at 430px | [Light](../.expo/creation-polish/editor-430-light.png) · [Dark](../.expo/creation-polish/editor-430-dark.png) |
| People & Access | [375px dark](../.expo/creation-polish/people-375-dark.png) |
| Publishing review | [375px dark](../.expo/creation-polish/review-375-dark.png) |
| Larger display/text | [1024px](../.expo/creation-polish/editor-tablet-large-text.png) |

| Organizer roles after publication | [People role management](../.expo/creation-polish/organizer-roles.png) |
