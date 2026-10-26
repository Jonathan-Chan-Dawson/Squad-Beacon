# Living Plans, collaborative decisions and unified repeats

Implementation report for Prompt 3, started October 25, 2026 (America/Chicago). This is historical validation evidence; inventories remain the code-navigation source of truth.

## Delivered behavior

**3A — Living Plans.** A personal or authorized Squad Plan can be saved with a name, optional date and no Beacons. Stable stops hold ideas, canonical decision references or existing Beacons. Timeline order is independent of published activity timing and legacy scheduling indices. Existing records receive stop backfills. Creation, templates, editing and editor returns use the existing routes. The timeline uses compact icon rows, progressive disclosure and native/web date inputs. Removing an association does not delete its Beacon or resurrect it through legacy fallback.

**3B — Collaboration.** Squad Plans are visible immediately after saving. Suggestions appear as Pending approval, with inline review. Owners appoint co-owners; Squad admin review does not confer ownership. Open Collaboration permits direct tentative ideas only. Existing Ping, Pick One, Approval Vote, Draw and Find a Time controls remain canonical. Publication and replacement associate the actual authorized result with its stop; no second Beacon is published. Explicit chat sharing creates a compact authorized preview with existing response controls. Blocked authors and revoked references are filtered. Plan following never changes RSVP.

**3C — Reuse and scheduling.** Plans and standalone Beacons share the existing Routine generator and occurrence ledger. Private reviewed source snapshots preserve activity structure, allowed meeting details and controls. Source changes affect generation only after explicit review. Unresolved stops require acknowledgment and are not recreated as decisions. At least one confirmed activity is required. The original occurrence is recorded rather than generated again. Calendar groups actual activities once, distinguishes tentative Plans and projections, and expands itineraries inline. Map focus follows the same authorized references and retains the removable contextual filter.

This occurrence opens controls for the materialized instance. Future repeats opens the Routine editor and explains that already generated and completed occurrences remain unchanged. Single-Beacon setup creates an internal one-stop source without duplicating or modifying the original Beacon.

## Changed surfaces

- `src/features/plans/`: new living timeline, presentation/date controls, scoped domain/selectors, chat preview, shared repeat action and demo adapters; existing Plan and Routine entry screens remain canonical.
- `src/features/planning/`: Plan-context composers, reviewed publication handoff and inline organizer controls. Existing response engines and the concurrent response-list UI changes were preserved.
- `src/features/beacons/`: compact Create shortcut wording, shared editor return context, recurring Beacon entry, Calendar grouping/projection UI and selectors.
- Map context resolution, Squad discovery, group chat previews and shared snapshot/action/demo transport connect those surfaces without new primary routes.
- Three additive migrations, focused domain/database/browser tests, updated inventories, README and the `test:plans` command complete the integration.

## Contracts and migrations

The public RPC and route entry points remain unchanged. Additive action names cover lightweight Plan creation/metadata, stop addition/editing/linking/reordering/review, templates, standalone repetition and reviewed-source updates. Plan snapshots add optional dates, co-owners, collaboration settings, revisions and occurrence metadata; authorized snapshots add stable `plan_stops` and capability flags. Editors carry Plan/stop IDs and stable insertion anchors. Account-scoped transport supplies the expected actor; draft edits retain the revision they began against.

Apply all migrations in order through the normal deployment workflow:

1. `20261025203005_living_plans.sql`: nullable Plan dates, independent stops, backfill, scoped actions/RLS and capability detection.
2. `20261025204150_collaborative_plans.sql`: canonical decision-result association, tentative membership, suggestion notices and chat links.
3. `20261026002202_repeatable_plans_calendar.sql`: private reviewed sources, unified standalone repetition, source-occurrence deduplication and occurrence metadata.

No applied migration was rewritten. No hosted database was changed. Clients retain legacy screens on backends without the new capabilities. Reviewed source data is private; snapshot summaries do not expose its meeting coordinates or URLs. Capture reads meeting details with the source organizer's current access, and generation rechecks source access before publication.

## Verification

- `npm run typecheck` and `npm run lint` are required final checks.
- `npm run test:plans` covers living Plans plus existing Plan, Routine, connected-planning, Calendar, projection and Map-context suites. The first coordinated run passed 46 tests; subsequent checks add removal and protected-meeting regressions.
- The broad selected `npm test` checkpoint passed 552 tests before the final additional regression. Final results are recorded below.
- Explicit omitted-suite checks cover living activity and smart RSVP behavior.
- Browser coverage in `livingPlans.spec.ts` exercises undated creation/reopening, tentative edits, linked Ping creation/return and recurring Beacon setup with occurrence/future-repeat controls. Dark/light timelines are captured at 320, 390, 430 and 1024 pixels; light-mode runs also request reduced motion. Existing `createFlow.spec.ts` journeys retain coverage of shared creation/editor integration and are updated for lightweight Plan creation.
- PGlite executes the migration chain and verifies roles, revisions, cross-audience rejection, canonical publication retries, no implicit RSVP, source freezing/update, completed source reuse, lifecycle actions, original-record preservation and protected meeting exclusion. A co-owner capture is checked against the source organizer’s permissions. The trusted runner is exercised locally and must restore its identity after generation. Skip retries are idempotent and reject a stale selected occurrence date. Routine setup reuses an active series even when an ambiguous retry arrives with a new request ID; standalone repeats also reuse their existing internal source.

### Final run results

- TypeScript: passed.
- Broad selected `npm test`: 553 passed.
- Coordinated `npm run test:plans`: 47 passed. After final privacy/concurrency hardening, the living-Plan/Routine selection passed another 10 tests; the database scenario also exercises the trusted scheduler and organizer identity restoration.
- Explicit living-activity and smart-RSVP selection: 13 passed.
- Browser `livingPlans.spec.ts` plus `createFlow.spec.ts`: 13 passed, including parameterized creation presets, both appearances and reduced motion.
- Final web export: passed, 50 static routes.
- Full lint and focused final integration lint checks: passed.
- Working-tree whitespace check: passed; pre-existing concurrent changes were retained.

Rendered timeline evidence is generated under `test-results/living-plans-{light,dark}-{320,390,430,1024}.png`. These are local test artifacts, not hosted acceptance evidence.

## Acceptance boundaries

Automated database tests use local PGlite and browser journeys use demo mode. They do not establish hosted Auth/RLS deployment, hosted Realtime/push delivery, scheduler configuration or native-device acceptance. Native date pickers, screen readers, keyboard behavior and navigation transitions require phone testing after the three migrations are deployed to a staging project. Existing runner and notification infrastructure remain responsible for scheduled generation and reminders.

Personal and Squad audiences are implemented. Broader audiences, a new comment system and an independent Adventures entity remain intentionally outside this change. Existing decision notes and responses supply lightweight discussion. Published Beacon permissions remain authoritative even for Plan co-owners.
