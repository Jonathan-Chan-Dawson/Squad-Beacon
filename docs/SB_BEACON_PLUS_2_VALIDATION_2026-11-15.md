# SB Beacon+ 2 — Phase F local implementation

## Delivered behavior

| Stage | Working extension | Existing system reused |
| --- | --- | --- |
| Planning and preparation | Optional timed agendas, before/at/after-start timing, per-item and activity-boundary reminders, personal agenda presets, task priorities/filters, single prerequisites with cycle rejection, linked tasks, organizer assignments, live stage controls and preparation/workload summaries | Tool configurations/presets, Checklist paging and counts, Beacon roles, Plan preparation, notices/push and the existing scheduled runner |
| Hosting and live activities | Optional RSVP questions and answers, organizer-only notes, participant groups, check-in, scoped check-in coordinators, Free reminder preferences, focus goals/presets, agenda-to-focus sequences and private session history | Ordinary RSVP stays independent; existing organizer roles, approved participation and per-account/Beacon absolute-deadline timer persistence |
| Experiences and memories | Built-in reflection structures, Album/Timeline/Story recap layouts, authorized cross-Beacon memory references, optional participant credits with revocable Free consent, Plus tool ordering and up to six Pro activity sections | Existing Journal templates/tags/privacy, Memory collections/Afterglow, media authorization and appearance presets |
| Specialized tools | Pro round breakdowns that update canonical team totals transactionally; ordered links to existing Councils; Study/Sports/Party/Outdoor/Errands agenda recipes | Existing team scoring, Council ballots/deadlines/results and shared Premium entitlement resolution |

## Interface decisions

Overview retains a compact preparation summary and a direct planning action. People owns optional hosting details and keeps Free Bring Items. Tools groups entries by Planning, Collaboration, Live Activity and Memories; Agenda is selected like the other tools, rather than expanding above the selected Checklist or Timer. Memories still opens the Overview gallery.

Agenda timing uses Before start / At start / After start, readable local dates and minute-level times. Advanced task links, coordinator delegation, presets and preparation dashboards use existing inline disclosures. Task selectors offer search and small batches. Live agenda progress has one Start/Complete primary action. Agenda, hosting and round setup forms close after a successful save, returning to the summary. Collection setup uses a distinct Create album or recap entry. Existing Free creation, covers, basic modules, RSVP, arrival controls, voting and Draw remain available.

## Data and entitlement boundaries

New persistent state uses the existing settings/preset and action/snapshot chains. Attendee answers/notes, consent and round breakdowns use private tables with RLS and revoked direct client privileges. Editor keys include the current viewer/session so private form state cannot carry into a different account. Configuration and attendee/score writes check revisions; request IDs retain replay protection. Round writes update canonical totals in the same transaction. Checklist prerequisites serialize the Beacon graph and reject cross-Beacon links and cycles. Moving an activity revalidates paid task metadata through the existing Premium scope guard.

Shared tool use follows the Beacon entitlement and resource permissions, without granting a participant personal preset privileges. Prices, Boost counts and thresholds are unchanged. Downgrades retain content and Free cleanup paths; new advanced configuration requires current eligibility. Personal Journal privacy remains canonical. Participant recap credit is opt-in, can be withdrawn without subscribing, and is filtered again when projected and rendered.

Agenda reminders reuse the existing trusted runner and notice/push delivery. They deduplicate by timing signature and recipient, recheck current access and preferences, and invalidate obsolete queued reminders. Agenda timing edits notify currently eligible participants who have not muted agenda reminders. New capabilities are advertised separately for planning, hosting, stories and specialized tools so partial backend rollout does not expose unsupported new writers.

## Local validation

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- Selected existing domain/database suites plus the new expansion suites: 86 tests passed. These cover Premium, Boosts, Beacon controls/modules, timers, media/teams, collections, templates, Plans and snapshot normalization.
- `npm run test:beacon-expansion`: 18 tests passed, including complete ordered migration history in local PGlite, configuration tiers, replay, stale revisions, task cycles, participant privacy, reminder opt-out/deduplication, recap consent revocation, canonical round totals, Council references and Squad/personal entitlement isolation.
- Web export: passed, 59 static routes.
- iOS export: passed; this establishes bundling, not device acceptance.
- Browser validation: 19 scenarios passed across the full suite and focused reruns, covering light/dark 320px planning/hosting/consent, scoring rounds, recap creation, Premium, Premium Tools and Beacon controls. An obsolete Map-card selector was corrected to search Browse and use the visible action. The recap test also caught an empty credit line after consent withdrawal; the renderer now hides it. The final three Phase F journeys pass together.
- Screenshots are local generated evidence under `.expo/beacon-expansion-*`.

Local security advisors were attempted against `127.0.0.1:54322`; the local Supabase stack is not running, so the advisor could not connect. PGlite tests verify the ordered SQL/action/projection behavior and denied direct private-table access. They do not establish hosted Postgres locking or real push delivery.

## Migration and rollout boundary

All four migrations are additive, generated locally with the Supabase CLI and not applied to a hosted backend:

1. `20261115232046_beacon_expansion_planning.sql`
2. `20261115232752_beacon_expansion_hosting.sql`
3. `20261115233744_beacon_expansion_memories.sql`
4. `20261115234237_beacon_expansion_specialized.sql`

Apply through the project's normal ordered migration rollout after the existing Premium/Boost migrations. Setup remains in [README](../README.md). Hosted capability/projection checks, security advisors, scheduler/push delivery, real concurrent edits and native-device background/restart acceptance remain release checks.

## Deliberately smaller versions and deferred extensions

- A task has one prerequisite. Arbitrary dependency graphs, subtasks and workload balancing are deferred.
- Agendas coordinate one Beacon; the existing Plan preparation view connects related Beacons. No new calendar engine or cross-activity task mutation engine was introduced.
- Shared progress is organizer-controlled agenda state. Timers remain local and restart-safe; automatic shared phase advancement, remote synchronized clocks, multi-device history and live participant progress are deferred.
- Check-in delegation grants check-in only. Multi-session rosters and a broader organizer-role editor are deferred; ordinary roles remain authoritative.
- Afterglow uses deterministic layouts and current authorized memory references. Existing organizers can collaborate through revision-checked edits; simultaneous document editing, custom multi-album storage and generated videos are deferred.
- Council workflows link existing decisions in order and expose each canonical status/result. Each Council keeps its own ballots and deadline; the workflow is navigation guidance, not a new authorization gate or automatic round engine. Workflows are stripped from personal presets so saved presets cannot copy live decision references.
- Activity recipes reuse agendas and existing Checklist/Focus/hosting/scoring tools. Saving an entire complex Beacon configuration as one new object, advanced participant statistics, tournament brackets and arbitrary layout builders are deferred.

No nonfunctional placeholder controls were added for these extensions. Existing unrelated worktree changes were preserved.
