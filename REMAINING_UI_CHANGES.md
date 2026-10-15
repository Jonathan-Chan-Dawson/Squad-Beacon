# UX refinement status

Tracks the October 4 major product brief and later follow-ups. Implemented means local code, not hosted deployment or native-device acceptance. This is not a claim that all 106 sections are finished.

Current outstanding work comes first. Completed entries retain their original validation results; older coverage and architecture notes are historical where later entries supersede them.

## October 14 — Your Activity and Beacon browsing

Locally implemented: the Beacons homepage has one compact featured commitment and no permanent History shortcut. Your Activity and Browse Beacons now have separate routes and datasets, compact cards, search, and chronological sections. The obsolete period tabs, pager, and inline weekly calendar were removed; legacy period links redirect to the modern destinations. Calendar scheduling remains available from the homepage header.

Past Experiences collapses inline when current/upcoming commitments exist, otherwise reveals three recent entries. Search finds older history even while collapsed; Show More requests twenty additional records. Canceled, completed, and elapsed commitments have distinct labels. Existing detail, memories, tools, and Repeat flows remain the entry points for Beacon content.

History uses the authenticated, permission-scoped `activity_history_page` RPC and matching demo selector. Apply `supabase/migrations/202610140002_activity_history.sql` after preceding migrations for hosted accounts. No remote migration or deployment was performed. The shared full snapshot is retained for compatibility, so paged history results do not eliminate the global download of older activities.

Validation: TypeScript, zero-warning ESLint, and web export passed. All 378 app/database tests passed, followed by focused history/selector regressions. Fourteen relevant Chrome browser journeys passed across the main run and focused rerun, including 320/390px layouts, completed-history expansion/search, legacy redirects, Back, creation, saved tools, motion preferences, friend selection, Map handoff, and Routine scheduling. Mobile screenshots were inspected. Native-device acceptance is not claimed.

## Current outstanding work

### P0 — Deploy backend and Routine scheduler

- Current: organization/Routine/Space migrations are local only; hosted accounts require the new contracts.
- Dependency: operator approval and actual remote/scheduler configuration.
- Files: `supabase/migrations/202610040001_organization_audience_type.sql`, `202610040002_organizations_group_chat.sql`, `202610040003_plan_routines.sql`; plans inventory; README.
- Next: apply in filename order, committing the enum migration before organization use; verify deployed RPC/snapshot access; activate the documented due-Routine scheduler. No remote migration/deployment performed here.

### P0 — Native widgets, map and push acceptance

- Current: web and JS exports are not native binaries/device acceptance. Expo widgets cannot run on Android/web/Expo Go.
- Dependency: real iOS bundle identifier, extension rebuild, signing/device, push credentials.
- Files: `app.json`, `src/features/widgets/`, native BeaconMap, platform notifications.
- Next: set the application's own iOS identifier and rebuild; test full/discreet circles, stale/sign-out clearing, launcher links. Test Android map anchoring/zoom/dismissal and phone push/quiet hours. Never offer unsupported widgets as installable.

### P1 — DM unread receipts

- Current: group read timestamps exist; DMs lack authoritative receipts. Unread reports squad conversations only.
- Dependency: permission-tested DM receipt schema/projection, not guessed counts.
- Files: CommunicationHub, Messages screen, shared message contracts, new migration.
- Next: persist per-conversation reads, project the viewer's receipts, extend the same filter. No second messenger.

### P1 — Creation/detail UX consolidation

- Current: quick editor/More options work; advanced settings retain the established layout. Optional preview exists; creation confirmation is text, not marker-drop/haptic choreography. Detail navigation remains established workspace.
- Dependency: preserve default-off modules, permission checks and validation.
- Files: `src/features/beacons/screens/CreateScreen.tsx`, BeaconSettings, BeaconResponse, MapPanel, ProposalEditor.
- Next: regroup People/Tools/Social/Style without duplicate models; add contextual Add another/Alternative → existing proposals. Invite-only access exists through private audiences/invitations but lacks a separate quick-editor label. Cover tools before reducing detail tabs.

### P1 — Routine start-time override

- Current: Routine configuration reuses each source Beacon's local start time and relative day offsets; weekdays, interval, end date and reminder are editable. There is no separate Routine-wide start-time override (§65).
- Dependency: a single shift must preserve all relative steps across date/timezone/DST changes, rather than introduce another independent schedule.
- Files: `src/features/plans/routines.ts`, RoutineScheduleSheet, Routine migration and tests.
- Next: expose an optional first-step start time, defaulting to the source, and shift the existing Plan step schedule with parity-tested server/demo logic. Fixed source times are explicitly explained in the current sheet.

### P1 — Discovery/search/filter coverage

- Current: authorized map places, Beacons, people/chats, recipes and library searchable. Google Places Text Search is implemented through an authenticated, rate-limited server proxy but awaits operator configuration/deployment. There is no anonymous public feed.
- Dependency: public server projection/pagination; Google server credentials/deployment and the remaining web/iOS map-provider choice.
- Files: discovery feature, MapScreen, shared search/AudiencePicker, OrganizationDirectory.
- Next: organization/private-list/audience search over visible fields first. Design external/anonymous discovery separately; map visibility never grants profile/GPS access. Public/Open/Time/Momentum filters need explicit semantics.

### P1 — Notification events for new features

- Current: invites/Pings appear through snapshots; existing notice pipeline retained. Immediate background pushes for every new organization/chat/Routine event are not promised.
- Dependency: event triggers, deduplication, deployed worker and real tokens.
- Files: new migrations, push-worker, communication helper, notification UI.
- Next: connect uncovered events to the existing queue; recheck membership/profile/blocks at dispatch; no private content in push payloads or second inbox.

### P2 — Profile/library polish

- Current: aspiration progress/source-linked memories retained; private Journals/Lists file references rather than duplicate Beacon content. Disabled history readable.
- Dependency: public tags/folders and per-field visibility need explicit privacy contracts.
- Files: profile/library/beacon features, demo fixture.
- Next: richer progress/streak fixtures/layout and empty states; design public-library projections with revocation tests. Preserve one shared checklist/Beacon Note surface per Beacon.

### P2 — Media reliability, accessibility and scale

- Current: authenticated media permissions retained; group chat plain text. No new background cleanup service deployed.
- Dependency: storage retry/cleanup, native uploads/playback, screen-reader/keyboard/font-scaling and large-account acceptance.
- Files: beacon/platform features, MotionPressable, GroupChatThread, snapshot SQL.
- Next: interrupted upload/orphan tests, touch targets/focus/font scale, pagination/incremental updates and production profiling. Avoid decoration that hurts latency or reduced motion.

### Additional requirements from Parts 2–3

| Requirement | Current boundary / next step | Priority |
| --- | --- | --- |
| Profile-first chat headers | DM and Squad avatar/name headers now open full profiles; Map uses authorized compact previews with same-sheet Beacon navigation and Back. Native acceptance remains. | Local implementation complete |
| Squad discovery and Open/Request/Invite-only membership | Independent discoverability/join/invite settings, sanitized directory search and server-enforced join/request/cancel/review flows are implemented for Squads, Spaces and Organizations. Existing entities retain private/invite-only defaults. | Local implementation complete; deploy migration 007 |
| Large Organizations with searchable public/community-only Squad metadata | Bounded authenticated directory pages and authoritative summary counts are implemented, with independently authorized parent context. The full member snapshot remains pilot-sized; 50,000-member profiling and incremental membership loading are not verified. | P1 (scale acceptance) |
| Interactive Pings as messages inside DM/Squad threads | Squad chat now merges canonical audience-scoped Pings with text messages and supports exact-card jumps and direct replies. Friend-audience broadcasts are not falsely associated with individual DMs; a permission-scoped direct conversation association remains. | P1 (DM association) |
| System activity cards inside chats | Existing group chat is text-only. Add source-linked cards for created/finished Beacons, plans and routines; no fake photo/GIF controls. | P1 |
| Public reach and notification targets | Local/Wider reach must be independent of join mode and audience; no nearby broadcast. Explicit notification target schema/validation remains separate work. | P1 |
| Social-first multi-source filters and structured category refinements | Current audience/category/time filters exist. Add OR-based source filters and only refinements backed by real fields; never infer cuisine/skill from descriptions. | P1 |
| Organization announcements and fine-grained Squad roles/settings | Shared Owner/Co-owner/Admin/Elder/Member hierarchy and policy settings are implemented for all three community types. Elder organizes but cannot moderate or escalate roles. Announcement feeds and ownership-transfer workflows remain separate work. | P1 (announcements/transfer) |
| Search/provider native acceptance | Configure Places API (New), server secret/origins, billing quotas and deploy; validate Google attribution and map-provider choice on Android/iOS/web. | P0 |

Latest remaining boundaries: public decision discovery needs an authorized projection and anchor contract; DM-associated Pings, structured chat/system messages, Voice and music playback need integration contracts. PlanStep module persistence, ownership transfer/archive workflows, optional creation policies, and full roster pagination remain outstanding. Hosted migration deployment and real-account/native-device acceptance remain required.

## Completed locally

### Transactional selected invitations and publication reconciliation - 2026-10-13

- Additive `202610130004_atomic_creation_invites.sql` adds explicit creation-with-invitees actions for standalone and existing-Plan Beacons. The server validates 1 to 20 unique eligible friend UUIDs, reuses validated creation and invitation writers under the actor lock, and commits the Beacon, invitation RSVPs/grants and notices together. Any eligibility, Plan or quota error rolls back all writes. Selected recipients become Invited, never automatically Going.
- The parent request result is recorded only after the transaction succeeds; replay creates neither another Beacon nor duplicate notices. Client publication retains one request UUID and freezes the original payload and selection through missing/unverified responses. Ambiguous attempts show Retry confirmation; a new draft/request is allowed only after a definitive rollback. Account changes are checked before cached success and after a response. Prior already-created client invitation retries remain available without recreating their Beacon.
- Template storage, status-source text-only conversion, dates/timezones and confirmed Map coordinates retain their existing handoff behavior. Demo publication uses cloned validated writers and request acknowledgements; synchronous validation failure leaves the draft editable.
- Final regression: the single full `npm test` run passed all 369 tests (0 failed, skipped or cancelled), following the final 21-case atomic creation/handoff run. The temporary test log was removed during cleanup; final `npm run typecheck`, all-source zero-warning `npm run lint` and `git diff --check` passed. No full-suite rerun, web export or native build was performed.
- Rollout is local source only: the four chronological redesign migrations must be reviewed/applied to the intended Supabase project before real-account status emoji, atomic status actions, full Routine projection or atomic selected invitations are available. No CLI, local project link or standard local access-token file was present during the read-only deployment audit. No secret values were printed and no remote deployment was attempted.


### Bounded Routine calendar projection - 2026-10-13

- Additive `202610130003_calendar_routine_projection.sql` exposes an authenticated, read-only RPC for 1 to 62 days with a 500-row cap and explicit truncation. It reuses the existing recurrence helper and private occurrence ledger; it creates no Plans, Beacons or future occurrence records.
- Current Plan/Routine visibility and personal owned/joined scope remain required. Skips and missing/cancelled/unreadable materialized children suppress projection rather than revealing private child metadata or inventing a replacement occurrence. Dates remain in each Routine timezone, without fabricating times from partially readable stops or implying attendance.
- Calendar month/week views now use bounded RPC results instead of the next-date-only fallback. Materialized occurrences deduplicate existing actual schedules. Account/epoch and snapshot guards clear stale rows during refresh or revocation; loading, Retry and a useful backend-update message leave existing activities available. Truncated results explicitly suggest week view.
- Demo-only lifecycle actions retain an internal skip/materialization ledger for projection parity; this adapter does not invent hosted state or expose a private server ledger.
- Validation: 16 focused calendar/projection/Plan-Routine cases passed, including full-chain database privacy, null/anonymous auth, friendship/membership/block revocation, skips/materialization, cancelled/private children, bounded/truncated results and no writes. Typecheck, targeted zero-warning lint and diff check passed. No deployment, broad full-suite rerun, export or native build was performed.


### Atomic status editing and legacy route consolidation - 2026-10-13

- Shared status save/clear now use explicit `save_status_note` / `clear_status_notes` actions. Additive `202610130002_atomic_status.sql` locks the owner before status rows, reuses validated writers with distinct child request IDs, and records the parent result only after all changes succeed. Failed writes roll back the whole operation. Current title/expiry edits preserve status ID and reactions; changed availability or other status fields replace and cancel live duplicates while retaining history. Future scheduled notes coexist with current availability; Clear only cancels current live notes.
- Partial owned-source payloads retain note/category/audience/reaction settings, expiry and meeting fields. Source IDs are restricted to the viewer's solo notes. New notes retain Friends/one-hour defaults. Demo actions use cloned validated writers with equivalent edit/replacement/clear scope; client actions require explicit acknowledgements and preserve errors for retry.
- Legacy `/create?kind=status` now uses the same StatusPanel as Beacons/Profile. Authorized text/template context, audience, valid timing/timezone and selected meeting fields initialize that editor, with advanced timing/place fields available there. Private meeting coordinates require the existing meeting-detail gate; profile GPS is never copied. Invalid association/invitation context requires explicit clearing. Canonical template editing and Beacon-from-status conversion remain separate existing flows. Cold-start legacy links return to Beacons after Save/Close when no Back history exists.
- Validation: the focused regression run passed 37/37, including full-chain atomic and reaction database tests, client status actions, legacy seed/privacy/demo tests and existing creation handoff. The final bounded atomic/client/legacy rerun passed 13/13; final typecheck, targeted zero-warning lint and diff check passed. Nothing deployed; no other remaining-redesign packet, broad full suite, export or native build was started.


### Persisted status reaction picker - 2026-10-13

- Added a shared named catalog of 24 supported status emojis, with five quick choices and an expanded searchable grid in the same sheet. Beacons friend rows remain compact; their reaction action and Map status previews open the shared picker and display the persisted selected emoji. Selecting the current emoji removes it; another replaces it.
- Additive `202610130001_status_emoji.sql` expands the finite reaction constraint and introduces explicit `react_status` dispatch. Existing solo `react` calls retain the raised-hands default; ordinary Beacon reaction dispatch remains unchanged. Existing current-status, audience, block and reaction-enabled gates remain; direct table writes stay revoked. No activity, RSVP, membership or invitation is created by reacting.
- The picker uses the new action so an older hosted backend rejects unsupported persistence with a visible error instead of silently substituting an emoji. Demo reactions use the shared registry and match replacement/removal behavior.
- Validation: 15 focused cases passed, including the entire chronological migration chain in isolated PGlite, all 24 choices, replacement/removal, request replay, unsupported values, direct-write rejection, blocked/inaccessible/expired/future/cancelled/disabled statuses, ordinary Beacon compatibility and person-preview privacy. Typecheck and targeted zero-warning lint passed. No remote deployment, full-suite rerun, native build or export was performed; hosted migration remains required before real-account use.


### CARTO key wiring and centered web Beacon ripple - 2026-10-13

- Existing web CARTO light/dark styles and attribution are retained. `app.config.ts` reads the actual value from the exact environment variable `CARTO_BASEMAPS_API_KEY` into `extra.cartoBasemapsApiKey`; the web renderer passes that value to the tile URL as an encoded `key` query parameter. No key value was printed, and tests use only a dummy value. Native providers are unchanged.
- The web Beacon ripple now belongs to the visible badge face, rather than the whole marker button. Percentage centering and explicit border-box halo dimensions account for badge borders, zoomed-out dots, time chips and selected scaling; Leaflet anchors, click targets and reduced-motion behavior are retained. Friend markers remain without a Beacon ripple.
- Validation: 25 focused basemap/cluster/discovery unit tests passed; typecheck and targeted zero-warning lint passed. One Chrome geometry fixture using the actual marker factory/stylesheet passed eight dot/full, chip/no-chip and selected/unselected variants, three animation times per variant, click handling and reduced motion. Existing local preview was reused; no export, build, actual API-key tile request or full-suite rerun was performed. This verifies fixture geometry, not live provider or native acceptance.

### Beacons home, shared status controls, creation handoff and Calendar — 2026-10-13

- The default Beacons tab is a compact personal status, Friends Right Now, Your Activity and Beacons overview. The existing five tab controls remain. Detailed Now/Upcoming/Past links retain full browsing; confirmed personal activity/history bypass discovery search, area, audience, category and advanced filters while retaining period, sort, access and approval checks. Past focuses on history; weekly progress remains in Calendar.
- Friend selection uses separate checkbox/profile/activity/reaction/message targets, three inline previews, a supported BottomSheetFlatList picker, normalized search and bounded horizontal removal chips. Selection survives refresh, search and eligibility loss, resets on account change, and never publishes or joins anything. Unavailable recipients require explicit removal.
- Beacons and Profile use the same quick status control/editor. Profile's small avatar-edge control is separate from the photo button. Quick Free/Busy saves immediately; Activity Note edits retain title, description, category, audience and expiry. Existing create/edit/cancel services preserve history, clear all live owned duplicates and show partial cleanup failures. Map reads the same newest privacy-checked status source. The legacy launcher action `/create?kind=status` intentionally retains its separate advanced status creation path; not every legacy status entry point has been consolidated.
- Existing persisted raised-hands reactions remain available for authorized visible statuses. Additional emoji choices are deferred because the current reaction constraint supports only that existing value; chat emoji insertion is not a reaction contract.
- Creation carries selected invitees, status text, selected date/timezone and confirmed coordinates through blank/app/saved-template paths. Status conversion seeds text/category only and leaves the original status untouched. Template storage excludes invitation selections. Existing creation and invitation actions remain unchanged; recipient validation occurs before publication, and partial invitation failure locks the created Beacon into Retry/Open actions. Retries are serialized, successful/existing invitations are not resent, and recipient removal/navigation is disabled during sending.
- Map's central + opens the template-first launcher with Create Beacon on Map, then reuses the existing physical-point picker and selected valid point. Camera center is not treated as a selected meeting point. The pin-shaped Explore area control remains because it serves discovery/search, not creation.
- Your Calendar has month/week views, Today, accessible date agendas, calendar dots, personal hosted/approved-going Beacons, authorized owned/joined Plan schedules and contextual scheduling. A date tap only changes its agenda; past dates have history without scheduling actions. Once/Plan/Routine handoffs preserve explicit dates and validated timezones; creation defaults outside Calendar remain. Week mode covers both months at boundaries. Existing recurrence and DST conversion helpers are reused.
- Routine previews are date-only, labeled Projected and show the Routine timezone. They use only authoritative `next_occurrence_on`, exclude paused/ended/manual/cancelled sources, and avoid known published-source duplicates. Broader future projection and exact occurrence linkage remain deferred because the skipped/materialized occurrence ledger is private; readable partial Plan stops never fabricate projected timing or imply Beacon attendance.
- Your Activity shows authorized place/online information and accepted participant count, with Chat, actual readable Checklist done/total and Timer shortcuts when enabled. Sanitized `/activity/[id]?tab=tools&tool=…` links open the exact permitted module; unknown, disabled and unapproved inputs fall back safely. No invented unread counts or running timer state.
- Validation: staged focused checks passed (22, 20, 28 and 25 cases), and final focused regression passed 34/34. The single full `npm test` run executed 343 cases: 342 passed and one existing demo-fixture assertion failed because it expected 166 profiles/119 accepted friendships while unchanged expanded fixtures contain 190/143 and deliberately stale locations. That test now checks unique identities, expected friend/social-growth coverage and fresh/stale location examples; its targeted domain-file rerun passed 12/12. The full suite was not repeated. Final `tsc --noEmit`, all-source `eslint app src components --max-warnings=0` and `git diff --check` passed. New feature tests are included in the package test command.
- Acceptance boundary: adb is available, but no Android device is connected and `emulator -list-avds` returned no configured AVDs. Native visual/gesture acceptance remains unverified. No web export, Android/native build, deployment, schema migration, RLS change or transaction redesign was performed for this refinement.

### Feature organization cleanup — 2026-10-11

Beacon creation/detail routes now export feature-owned screens. Activity-detail components share one Beacons-owned folder. Communication hub and settings implementations use permanent names behind their existing entry points. Routes, parameters, permissions and data contracts are preserved. Validation: TypeScript, zero-warning lint, all 310 app/database tests, web static export and Android Hermes export passed. All six moved implementations were compared against their original code; only import paths and the settings function name changed. A direct browser smoke check passed creation/publishing, full detail routing, manual arrival and persisted Beacon settings. Existing browser suites passed 25 of 33 journeys across two runs; eight failed on older selectors or the previous avatar-size expectation (creation/map launchers, friend-chat tray, Suggested Beacon action, Midnight palette label, and avatar dimensions). Passing journeys include creation presets/templates/Plans/Routines, Beacon tools/RSVP/chat/Back, Squad profiles/drafts, settings search/palettes, and the response inbox. No browser assertions were weakened. Hosted migrations and real-account/native-device acceptance remain outstanding; earlier results below describe their original passes.

### Pings, Votes, Draws and inbox refinement — 2026-10-11

Avatar follow-up: people retain their existing mini-avatar/selected photo and privacy settings. Squad conversation rows, chat headers, full profiles and authorized previews now share a real icon instead of initials; private lists use a list symbol. Current Squad admins can choose one of eight icons in existing Squad settings. `202610110005_squad_icons.sql` persists `squads.icon_key` through the existing action/snapshot architecture; it does not change membership, Map markers or decision rules.

The latest planning brief restores the compact Chats/Communities switch and supersedes the response-carousel presentation. Squads now uses one real-data Responses & Invitations row and a full-screen `/responses` inbox. New Message presents people vertically. Existing community directories, conversations, drafts, interactive Squad Ping cards and the five global destinations remain.

Interested After adds an optional UTC availability timestamp to Interested without opting into Auto-RSVP. Existing chat replies preserve saved preferences; conversion skips an opted-in user if the Beacon starts before their availability, while retaining all existing approval rules. Apply `202610110004_ping_availability.sql` for hosted use. Vote/Draw resolution branches and Map focus/discovery/marker implementations were not changed. Draw copy/tallies and closed-decision states were corrected in the shared detail UI.

Public decision discovery is staged because the current private planning audiences lack an authorized public projection and explicit anchor contract. No ineffective toggle or automatically published pending markers were added. See [PLANNING_REFINEMENT.md](PLANNING_REFINEMENT.md) for audit, files, migration and rollout boundaries.

Validation for this pass: all 310 app/database tests, TypeScript, zero-warning lint, web export and Android Hermes export pass. All 18 focused browser journeys pass in one final run, including availability, the full Beacon option editor, Squad chat synchronization, chosen icons, empty-account states and preserved Map context/filter behavior. Phone-width screenshots were reviewed. Hosted migration deployment and native-device/real-account QA remain outstanding; the entire browser suite was not rerun.

Tracks the October 4 major product brief and earlier follow-ups. Implemented means local code, not hosted deployment or native-device acceptance. This is not a claim that all 106 sections are finished.

### Social profile simplification - 2026-10-11

The latest mobile simplification brief supersedes the older permanent Chats/Communities and profile-tab presentation described below. Existing data and permission contracts remain authoritative.

- Squads opens conversations directly. Communities has its own directory, entered from a compact header button; search exposes filters only when needed. Joined communities use one short preview, and discovery no longer duplicates a carousel and a list.
- New accounts get Find people and Explore Beacons, with no empty parent-community sections. Explore Beacons opens Upcoming. Friends without communities retain the Start a chat tray.
- DM/Squad headers, chat authors and social directories navigate directly to full profiles. Map previews remain lightweight. Back retains the underlying chat and its draft.
- Person profiles use one scrollable identity-first page: compact Message/friendship controls, a small Star, permitted current/next Beacon, two shared connections plus See all when relevant, populated interests/About/goals, and bounded past-Beacon previews. Safety & Privacy contains Report/Block; removing friendship requires confirmation. Private profiles keep connection controls without revealing private identity/details. Own-profile Edit/Share actions are compact; existing goals, libraries, memories, lists, journals, survey and settings remain.
- Squad Info uses compact Ping/Beacon/Invite controls, quiet parent links, authorized Beacon previews, members and About. Chat is omitted when arriving from chat. Members, invitation search, Beacons & Plans, and settings use focused routes with normal Back navigation. Large member lists expose contextual search. Role, join-request, invitation and policy handlers remain intact.
- Organizations and Super-Organizations use one overview with small community/Beacon previews and focused directories. Empty activity sections and permanent overview tabs are removed. Administrative controls remain in settings. Public join/request/invitation summary flows keep their existing sanitized, paged server queries.
- Presentation maps legacy `space` records/routes to **Organizations** and legacy `organization` records/routes to **Super-Organizations**. IDs, relationships, memberships, grants, action names, existing URLs and database tables are unchanged. The existing confirmed Squad-to-hub grouping flow remains available; it never silently copies membership.

Reused: Screen, Button/Action/IconButton, Sheet, ProfileAvatar, chat identity headers, canonical chat/Ping/Beacon/Plan handlers, social directory summaries, privacy selectors and membership-policy controls. Small shared profile rows/sections organize those components; no replacement data system or production fixture switches were added.

Validation: all 303 app/database tests pass, including shared-connection privacy and independent membership revocation; typecheck and zero-warning lint pass; web and Android Hermes exports pass. All 18 focused browser cases pass in one completed run at 390 x 844 / 320 x 740, including new/friends-only/one-Squad/one-Organization/multiple-network states, sparse and rich profiles, 122-member roster search, direct headers and Back with retained drafts, confirmed copy/grouping, public joining/request cancellation, legacy routes and Beacon association. Screenshots of person/Squad/Organization/Super-Organization and new-account layouts were reviewed. An independently running preview server avoids the earlier Windows Playwright server-teardown hang; the final browser run exits normally.

Outstanding boundaries: real Android/iOS device gestures, keyboards, screen readers and hosted account acceptance still require device/account QA. Directory summary paging exists, but full roster snapshot pagination/large-account profiling remains unimplemented. The repo has no announcement feed or configurable 250-member Super-Organization conversion/owner-approval contract; this UI pass does not fabricate these workflows or change the existing Squad growth threshold.

### Final social architecture pass — implemented locally

The latest 69-section social brief extends the existing chat-first model rather than replacing it. The core contracts and connected UI are implemented locally. This is not a claim that every long-term feature, hosted integration or large-scale acceptance criterion is complete.

- Keep the hierarchy shallow: Organization → Space → Squad, Organization → Squad, and standalone Spaces/Squads. Preserve existing links and histories; never introduce nested Spaces or Squads.
- Keep discoverability, membership, profile privacy, Beacon audiences and location sharing independent. Public community search uses a sanitized, bounded projection, not the private member snapshot.
- Share readable role and join-policy choices. Preserve existing private/invitation behavior until an authorized manager changes it. Invitations bypass redundant requests; joining a parent never joins its children.
- Organizing a Squad into a Space preserves its ID, messages, Beacons, Plans, Routines and history. Copying current members is an explicitly confirmed exception; grouping several Squads never merges their memberships or chats.
- Related Space/Organization previews, contextual search and creation menus, count-first Squad size labels and a dismissible growth suggestion are implemented. Preview → related community → Beacon stays in one sheet with Back. Settings remain secondary; private lists are reached from Profile → Friends & Lists, not Communities.
- Beacon community association is metadata, not an additional audience grant. No new Beacon type or implicit membership is introduced.
- Use existing accessible controls and reduced-motion-aware animation. Verify local actions and permissions before describing a flow as complete; hosted deployment, native acceptance and large-scale profiling remain separate operator work.

Remaining social boundaries: ownership transfer/archive workflows, optional per-entity “who can create” policy fields, richer announcement/system-message feeds, and large-account roster pagination. Existing creation authority and archive checks remain enforced; unsupported configuration controls are not displayed.

### Final UX audit and Map side controls (2026-10-11)

Preserves the existing Map, one overview sheet, canonical editors/actions, permissions, saved recipe IDs and user templates. Primary browser viewport: 390 x 844; 320px remains an overflow check.

| Audit case | Supported behavior and remaining limits |
| --- | --- |
| Grocery Run | Direct Grocery List, simple inline Add Item, check/uncheck, edit/remove and participant assignment persist through existing actions. Section creation now stays behind Checklist options. Structured quantity and item ordering are absent from the current schema; quantities can remain part of item names. |
| Study | Timer and Checklist render together; start/pause/reset remain local timer controls. Timer is not synchronized across participants or persisted across closing the sheet. |
| Basketball | One Game presentation with scores/rosters and a Teams focus; scoring, team management and participation retain canonical authorization. Casual sports templates keep Game optional. |
| Picnic + Vote | Checklist remains direct. Existing permitted Vote/Draw links now resolve through either materialization or proposal activity links; pending decisions take priority and count toward adaptive complexity. New votes currently use standalone Suggested Beacon drafts; attaching a new pending vote to an existing Picnic has no creation action/relationship contract. |
| Photo Walk | Real Memories uploads and permitted notes remain available. Past multi-tool Memories now links directly to Reflections & notes using the existing Sketchboard. Hosted upload acceptance needs an account. |
| Simple Hangout | Chat-only preset produces Overview, Chat and People; no empty Tools tab. |
| Advanced event | One pinned, horizontally scrolling pill row, active tool first, swipe switching, per-Beacon preference, mounted module drafts, and independent content scroll. No feature grid. |
| Plan relationship | Overview shows permitted stop sequence/next stop; contextual Map filter uses existing camera/filter restoration and visibility rules. Adding a preset to an existing Plan preserves its controls. Multi-stop PlanStep still lacks per-step module settings. |
| Chat | Shared text/Unicode emoji composer, send/retry, drafts across Beacon views and compact author previews. GIF/sticker/media/voice-message/reply/reaction and structured sharing are unsupported by message schema. Beacon unread counts are not available; no invented badges. |
| Voice / Music | Voice has no backend. Enabled valid music links open the real external service; inactive/invalid music stays hidden. No playback, queue or now-playing state exists. |
| People | Existing attendance, invitations/admission/removal and profile previews preserved. People now exposes the same manual arrival controls and authorized participant arrival captions. Running Late is not an existing state. |
| Templates | Blank first, For You and Recent retained by user preference. Browse explicitly contains exactly six Quick Start family rows plus additional presets, search and My Templates; all route into the existing editor. |
| Lifecycle | Preparation, live Game and past Memories/recap/Repeat priorities retain one navigation structure. Expired scheduled records retain existing backend write rules; the audit does not silently change status or roles. |
| Saved content | Legacy module normalization, saved template configurations and catalog IDs preserved; no migrations or replacement storage systems introduced. |

Map change: direct top-right Pin a location to create a Beacon enters the existing pin picker and editor with actual coordinates. Compass and map type share one compact collapsible side menu; Standard/Satellite reuse MapStyleControls and device preferences. Location, fit, explore/search and More map settings reuse existing handlers/components. Map taps, Escape/Android Back, selection, Done and the toggle dismiss the menu; opening it never requests GPS. Menu animation respects reduced motion and content scrolls within available phone height.

Audit fixes also repair ineffective tool-section collapse controls, make section options available to authorized checklist editors, add contextual grocery naming, and connect past Memories to existing reflections without another modal.

Files/components touched in this pass: MapPanel, mapBeaconFeatures, BeaconPanelNavigation, BeaconTools, beaconModules, BeaconSheetPeople, ActivityDetailPeople, CreateHome, MapScreen, MapCompassSheet, MapOptions; focused unit/browser tests and this audit record. Reused: BeaconScoreboard, BeaconMemories, PlanningDetailScreen, AttendanceControls, ChatThread, profile previews, contextual filters and the existing creation editor.

Validation: typecheck and zero-warning lint passed; all 302 app/database tests passed; final web and Android Hermes exports passed. Browser case results: 26 audit journeys passed, plus four final Map journeys passed (30 distinct cases across runs). The Map cases cover no implicit GPS request, normal/edge phone bounds, outside-tap/Escape/toggle dismissal, persisted map type, local demo search, and pin-to-editor-to-published-Beacon coordinates. Earlier test failures exposed missing web ARIA state and outdated test expectations; those were fixed and affected cases passed on rerun. Windows Playwright teardown stalled after emitting all case results, including with tracing off; interrupted the runner, so case results are verified but aggregate process completion is not. Phone menu screenshots reviewed locally. Native gestures/keyboard, hosted Realtime, media uploads and audio require real-device/account acceptance. These remain the highest-priority verification gaps; unsupported communication backends and PlanStep module persistence remain product/integration gaps.


### Beacon template launcher — refined locally

- Preserve the preferred launcher hierarchy: Create Blank Template first (opens the existing Beacon editor), For You and Recent, then Browse More Templates and My Templates. Blank creation does not silently save a user template; Save as template remains explicit in Advanced Options.
- Compact rows use activity/family icons, quiet dividers and chevrons. For You retains the existing history/interest ranking and avoids repeating a family. Search matches existing presets, saved templates, accents and common terms such as groceries, movie night, photo walk and dnd.
- Browse uses six core family rows plus seventeen additional families, then one preset detail view with Back to categories. All eighteen original catalog groups and every existing recipe ID remain accessible. Music, Photography, Home and Classes reference existing catalog entries rather than a second preset system. Routine-shaped legacy presets are labeled Familiar Activities and create a single Beacon; real Routine creation stays separate.
- New app-template defaults are selective: General Hangout is Chat only; groceries are Chat + Checklist; General Study is Chat + Timer with task variants adding Checklist; Basketball keeps Game optional; photography enables Memories. Saved user configurations remain unchanged and can be reused or edited through their canonical save action. Selecting a saved template dismisses the browser before navigation.
- Known integration limits: Voice has no backend. Music remains an optional external link. The multi-stop Plan builder retains its existing PlanStep contract, which does not store Beacon module settings; adding a preset Beacon to an existing Plan uses the current Beacon editor and its controls. Native phone/keyboard and hosted persistence acceptance still require devices/accounts.
- Validation: typecheck, zero-warning lint, all 300 app/database tests and web export passed. All nine creation browser journeys passed at the normal 390×844 phone size, covering search/synonyms, family Back navigation, editable defaults, My Templates save/reuse/edit, Recent, preset Vote/Plan placement, Plan/Routine paths, and real Grocery/Hangout sheet behavior. Launcher screenshot reviewed locally.

### Beacon connections and communication — integrated locally

- Plan-linked Overview shows permitted stop progress, the next scheduled stop, and Show Plan on Map. Embedded Vote/Draw Suggested Beacons use the same existing contextual filter without pushing another Map route. Private stops, connector gaps, previous camera, and ordinary filters retain their existing authorization/state behavior.
- Music is a compact validated external link in Overview, outside Tools; disabled, missing and invalid links stay hidden. Past Beacons use the existing Repeat creation action. No audio playback is simulated.
- DM, Beacon and Squad chats reuse the same composer/list/sending foundation with a compact Unicode emoji picker and readable author previews. Beacon Chat expands in the existing sheet; profile/back/tab changes retain the conversation and draft. Shared person previews include permission-gated Message/Add Friend and optional full-profile access.
- Unsupported: no Voice Room schema/backend exists; music has no playback/queue/now-playing state; messages have no GIF/sticker/file/voice-message, reply, reaction, or structured sharing schema. Existing Beacon Memories uploads are distinct from chat attachments. These require real integrations before controls can be exposed.
- Validation uses 390×844 as the primary phone, with 320px only as an overflow edge case. Native keyboard, audio lifecycle and hosted Realtime acceptance still require real devices/accounts.
- Checks: 297 app/database tests passed, including restricted Plan/Beacon contexts, connector gaps, music URL validation and chat permissions. The final exported preview passed all 17 combined sheet/map/DM/Squad browser journeys. Typecheck, zero-warning lint and web export passed.

### Beacon map overview sheet — implemented locally

- Marker → existing compact preview → See overview now opens one expandable bottom sheet. Fixed Overview/Tools/Chat/People text tabs use a sliding underline and hide unavailable tools. One menu replaces the crowded header controls; the drag handle also supports keyboard resizing, and the exposed map dismisses the panel.
- Tools keeps small icon pills in one horizontal row with overflow fades, automatically reveals the selected tool, and remembers the last selection per viewer/Beacon on the device. Content responds to horizontal touch gestures and directional transitions; reduced motion uses fades. Main tabs and tool pills remain pinned while content scrolls, with a divider appearing only after scrolling. One/two enabled interfaces render directly; larger configurations switch between usable modules, prioritizing live games, study timers, preparation and past memories. Existing checklist, timer, notes, memories, teams/scores, chat, RSVP, People and planning decisions retain canonical state and permission checks.
- Focused views use Back in the same sheet, restore tab/scroll position and retain checklist/chat drafts and local timer state. Checklist editors and planning confirmations are inline in this context.
- Local verification: 297 app/database tests passed; 14 Beacon sheet/map preview browser journeys passed, including zero/one/two/many modules, lifecycle changes, Game/Teams, RSVP/chat, focused Back navigation, single-row pills, pinned content, device-local tool restoration, and touch swipes in both directions. TypeScript, ESLint and web export passed; the earlier sheet implementation also passed Android bundle export. The primary phone preview is 390×844; 320px remains an edge-case check. Chat has no Beacon unread-count record, so no badge is invented.
- Native gesture/keyboard/safe-area and screen-reader device acceptance remain; hosted Supabase media/persistence was not exercised by local demo browser checks.

## Superseded notes and historical coverage

Later completed entries take precedence over older presentation descriptions, including response carousels, compact chat-profile previews, and legacy community labels. These records retain the original briefs and validation boundaries.

### Brief coverage

| Sections | Current implementation |
| --- | --- |
| 0–8: design, density, buttons, delight, terminology | Existing feature folders retained; compact labeled icon actions, contrast-based selection and reduced-motion press feedback. No redundant single-choice checks; meaningful multi-select checks remain. Full screen audit remains partial. |
| 9–18: map | Smaller circular/point Beacon pins and avatars; shared screen-space clustering; real thumbnails plus overflow; relevance ranking; anchored Beacons/People popovers; quick responses; outside dismissal; authorized saved-place search and dropped-pin creation; physical directions. External geocoder and native QA remain. |
| 19–22: Friends Now | Vertical compact rows, availability/time/location, direct Star, avatar → Profile, row → Message, joined/free/starred/close-friend ordering. See more/Find friends below. Private profiles and blocks gate identity/location. |
| 23–29: Chats/Pings/notifications | Squads has Chats/Communities, temporary search, a contextual New menu and compact response prompts. Squad Pings share canonical response state in chat; group messages have real read timestamps. Directory/private lists remain in a management sheet. DM unread counts are not invented. |
| 30–35: organizations/XP/games | Creation, invitations, owner/coowner/admin/elder/member hierarchy, role changes/removal/bans, linked Squads, shared chat/read state, Beacon/Ping audiences, profile grants and membership-revocation checks implemented locally. Private Squad rosters/chat remain separate. No unfinished XP/Games controls added. |
| 36–41: cards/details | One reusable compact card, functional save Star, time/place/approved avatars, state-aware response, owner Manage and contextual actions. Existing detail tools/permissions preserved; broader navigation simplification remains partial. |
| 42–54: modules/fields | Existing Chat, checklist, revision-safe Beacon Note, Memories, Timer, Music link, Teams/scoreboard, equipment and Vote/Draw preserved. Disabled tools keep authorized history readable; Library checklist preview added. Native media reliability remains to validate. |
| 55–62: creation/templates | Fewer quick starts, reusable searchable recipe catalog, quick virtual/join choices, More options for extras. Optional live draft preview and map confirmation added. Alternative-proposal handoff and advanced group redesign remain partial. |
| 63–65: Plans/Routines | Ordered timezone-aware sequences, personal/Squad templates retained. Separate Plan membership does not RSVP to every step. Routine schedules/lifecycle reuse Plans; server automation requires migration/scheduler activation. |
| 66–71: Activities/favorites/lists | Own status on Now; focused Upcoming with compact decisions link. Plans/Favorites/My templates/Library shortcuts ONLY in Past. Widgets in Profile. Existing private lists/canonical favorites reused. |
| 72–80: Profile/Settings/library | Compact identity-first profile, avatar styling, edit and repeatable survey; Settings header gear. Appearance/privacy/notifications/defaults/account groups; custom organization grants in actual privacy settings. Interests/aspirations/source-linked memories/library retained. Richer public-library display remains partial. |
| 81–83: Help/onboarding/auth | Settings → Help explains real features/platform limits. Survey skippable, retakable, prefilled; identity badges optional/collapsed on first run. Existing age gate/Auth retained. No anonymous public feed. |
| 84–92: widgets | One Friend Status architecture supports single/Starred/Squad/private-list circles, availability colors and privacy-safe initials. Freshness expiry; no coordinates. One configurable Beacon/Status/Plan launcher reuses editors. Existing Next Beacon/Squad Beacons/Pulse preserved. iOS build/device acceptance remains. |
| 93–96: notifications/search/filters | One notification ledger, quiet hours/push controls; actionable Pings badge. Shared normalized search and relevance helpers. Organization/private-list/audience search and more feed filters remain partial. Empty entry briefing intentionally omitted. |
| 97–100: organization/accessibility/performance | Feature-owned code, Markdown inventories, labeled icon actions, 44px shared targets, contrast themes/reduced motion. No aesthetic-only folder moves. Large-account pagination and complete native accessibility audit remain. |
| 101–106: fixtures/action matrix/QA/success | Demo statuses, decisions, organizations, group-message shapes and Friday Routine. Connected local tests; hosted/native acceptance remains. Not all final success criteria are satisfied. |

### Part 2 and Part 3 reconciliation

The subsequently supplied Final Product Architecture brief (Part 2) and Map/Discovery brief (Part 3) extend this ledger. A document proposal is not an instruction to expose private data or fabricate unfinished features. Direct user choices take precedence: profiles remain Public by default, utilities stay in Past, worldwide search uses the user's Google Places key, and fresh installs start in Midnight/Dark.

- Chats: two primary sections, Chats and Communities. Existing planning records power compact Needs your response cards and Interested/Maybe/Pass actions; Squad prompts jump to the exact canonical card in chat. Other invitations/decisions remain reachable in a secondary sheet. Search and filters appear only when requested; a contextual plus starts messages, Squads, friend requests or Spaces. Avatar/name opens the matching preview; the rest of the row opens chat.
- Spaces: independent lightweight hubs containing linked Squads, with creation, invitations, membership hierarchy and settings. Organizations and Squads do not require a Space. A link never enrolls someone in a Squad or grants access to private chat, profiles or location. Local migration `202610040006_spaces.sql` must be applied for hosted accounts.
- Appearance: each palette needs independently selectable Light/Dark/Device behavior, persisted per device; legacy saved palettes keep their former appearance. Status bar follows resolved appearance, not palette name.
- Exploration: a shared area/query/filter context connects Map and Upcoming. The Map has a compact search/Compass header, inline quick filters, progressive advanced sections with a sticky result action, separate map options, and one Sharing/My Beacon control. Search this area follows user gestures without snapping the camera. Past ignores geographic browsing. Search/pan changes do not start Sonar, grant profile access, or enroll anyone in groups.
- Google Places: server-only key, authenticated explicit query, bounded response, quota guard and no durable query/result cache. Operator setup is documented in `supabase/functions/places-search/README.md`. No key, billing change or remote deployment has been performed. Google Places results cannot be plotted on existing OSM/Apple maps; Google-map migration versus separate results is awaiting the user's choice.
- Public discovery: safe summaries must be separate from full authorized snapshots. Backend opt-in/join work is restricted to private/friends/list Beacons in this tranche; Squad/Organization public publishing stays unavailable until narrow per-Beacon provenance and revocation are permission-tested. Discovery is not a notification audience or group membership grant.

### Historical verification

October 5 social pass: all 210 app/database tests and 3 exploration tests passed. TypeScript and zero-warning ESLint passed. Web static export and Android Hermes bundle export succeeded. The broad Chrome run passed 54/56 journeys; its two failures were hidden retained-screen selectors, corrected without changing product behavior. All nine social journeys then passed on a clean rerun, including conversion/history preservation and link-only grouping. This verifies all 56 journeys across the broad run and focused rerun, not a single 56/56 run. Screenshots were reviewed at 320/390px.

October 4 local checks: 202 app/database tests and 3 exploration tests passed; all 47 Chrome browser journeys passed on the final two-worker run. TypeScript and ESLint passed. Final web static export and Android Hermes bundle export succeeded. Browser screenshots were reviewed at 320/390px, including compact Chats and independent Space creation. Reopening Ping/Plan creation from the same retained chat, exact Squad Ping jumps, direct replies, profile previews, community creation and the existing Map/privacy/library flows are covered. The initial six-worker run exposed stale navigation selectors and an animation timing failure; updated selectors and the unchanged animation passed the final run.

Local SQL tests use PGlite, not hosted Supabase Auth/Storage/Realtime, native widgets or phone push delivery. Android export is not emulator acceptance. The Places Edge function still needs server credentials, its migration, deployment, and a live-account smoke test; Deno was unavailable locally. No paid Google request or remote deployment was made.
