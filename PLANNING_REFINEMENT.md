# Pings, decisions and responses refinement — October 11, 2026

Implemented in the existing Expo/React Native app. This report describes local code and validation, not a hosted deployment.

## Audit and preserved contracts

Planning already uses `planning_threads`, `planning_ping_responses`, `planning_proposals` and `planning_votes`. The canonical action dispatcher and snapshot in Supabase, mirrored by the demo provider, remain the source of truth for the inbox, Squad chat and embedded Map decisions.

The existing `private.apply_planning_action` implements manual creator Ping conversion, approved proposals, changeable single votes, organizer resolution after the deadline, highest-vote selection with earliest-submission tie-breaking (including zero votes), random Draw selection, future-option eligibility, replacement history and retry safeguards. The Vote/Draw branches were not changed. Existing regression tests now run with the Ping availability migration installed.

Map focus remains `resolveMapContext` plus the existing `mapThread`/Plan routing and removable contextual chips. No Map query, marker-selection, cluster, category icon, people marker, location permission or filter implementation was changed in this refinement. Physical suggestions, virtual options, confirmed-Beacon links and existing embedded decision actions retain their paths. Ping People continues to prefill the place name only. Public Beacon discovery is independent of private planning audiences.

The five global navigation destinations, Beacons periods/calendar, Create launcher/editors/templates, Plans/Routines, conversations, drafts, privacy checks and realtime snapshot handling are preserved.

## User-facing changes

- Squads retains Chats/Communities access and shows one compact Responses & Invitations row directly under the switch. Its summary and badge use live actionable decisions, invitations and authorized join requests. With no pending items, a quiet inbox link remains. Existing conversations come first; the Start a chat directory appears when requested, searching, or when there are no conversations.
- `/responses` is a full-screen destination with compact request rows and All/Pings/Votes/Draws/Invites filters. Existing Beacons and Chats launchers reuse it through the compatibility entry in `ResponsesSheet`. Rows open the canonical decision or focused invitation actions; history opens the existing decision list. No notification fixtures or second response store were added.
- New Message uses a searchable vertical people list. Existing People & Lists access remains available.
- Ping detail shows source, place, saved response/availability and a source-linked Squad chat shortcut. Interactive Squad Ping cards remain in chat and update the same record.
- Draws no longer show vote tallies or imply deadline-triggered resolution. Closed decisions say they await the organizer. Existing option approval/voting and manual resolve/run actions remain contextual. The duplicate option-creation entry moved under Add option as Use Beacon editor, preserving the full Beacon editor and its advanced fields alongside the existing recipe workflow.

## New availability feature and migration

Apply `supabase/migrations/202610110004_ping_availability.sql` before using Interested After on hosted accounts. It adds nullable `available_after` to the existing Ping response table, validates offset-bearing finite timestamps, and patches only the Ping response and Auto-RSVP conversion sections. Existing data needs no backfill; null means no availability restriction. Existing RLS, snapshot projection, locks, dispatcher authorization and request deduplication are retained.

Interested After offers now, in one hour, tomorrow at the same local time, or a specific date/time using the existing platform date picker. Relative choices resolve to UTC timestamps; custom web input requires an explicit timezone offset. Users can edit or remove availability while responses are open. Availability remains an Interested preference, never Going or an implicit Auto-RSVP choice.

Replying Interested from a chat card preserves previously saved availability and explicit Auto-RSVP. Maybe/Pass clear those Interested-only preferences. An opted-in user whose availability is later than the converted Beacon's start is skipped during conversion; their preference is retained in history. The UI explains this condition. Eligible opted-in users still join or request attendance according to the existing approval rules.

## Public discovery: staged, not implemented

Planning audiences currently support private, friends, private lists, Squads and Organizations. There is no authorized public decision projection, explicit discovery anchor or creator opt-in contract. Candidate coordinates alone cannot supply those permissions. This refinement therefore adds no discovery toggle or default pending-decision markers.

The next stage should extend the existing public discovery pipeline: add an authorized creator opt-in and explicit physical anchor; define compatible audience eligibility without silently widening private access; add a bounded active-decision server projection that rechecks blocks, moderation and location access; then feed that projection into the existing filters, markers and clustering with small type indicators. Suggested option pins should remain confined to authorized decision focus. No parallel Map or clustering system is needed.

## Message and profile icons

People continue to use the existing privacy-aware `ProfileAvatar`, which renders their selected photo or illustrated mini. The avatar-display preference remains respected. Squad conversation rows, chat headers, full profiles, permitted previews and linked Squad rows now share `CommunityAvatar` instead of two-letter tiles. Private lists use a list symbol; Squads without a selection use the People icon.

Current Squad admins can choose People/Fitness/Sports/Gaming/Coffee/Study/Music/Sparkles in existing Squad settings. Apply `202610110005_squad_icons.sql` to persist `squads.icon_key`. The new `update_squad_icon` action uses the existing admin/membership/block/ban/archive checks, row lock, rate limit and request deduplication. All other canonical actions delegate unchanged to the previous dispatcher. There is no new photo storage, membership grant, Map marker change or Vote/Draw implementation.

## Files

- Routes/UI: `app/responses.tsx`, people `ResponsesScreen`, `SquadsScreen`, `RedesignedCommunicationHub`, `ResponsesSheet`, planning `PlanningDetailScreen`, `ProposalEditor`, `PingAvailabilityEditor`.
- Canonical adapters: people `communication.ts`, `usePlanningResponses.ts`, planning `PlanningInbox.tsx`, organizations `GroupChatThread.tsx`.
- Model/demo/backend: both existing planning response type declarations, `availability.ts`, `src/shared/demo.ts`, the new Ping availability migration.
- Verification: availability, planning database, communication, complete-migration Map database and browser regression tests; `package.json` includes the new availability suite. Inventories and the UI status note document the current behavior.
- Icons: shared `CommunityAvatar`, `SquadIconPicker`, pure `squadIcons` catalog, `HubConversationRow`/`hubState`, existing Squad routes/profiles/previews and Organization linked-Squad rows; the new Squad field, demo action, icon migration and regression suites.

## Acceptance boundaries

Final local validation: all 310 app/database tests pass; TypeScript and zero-warning ESLint pass; web static and Android Hermes exports succeed. All 18 focused browser cases pass in one completed final run, including 320px/390px inbox and Chats layouts, availability editing/removal without implicit opt-in, full Beacon editor handoff, Ping conversion and option approval/voting, canonical Squad chat synchronization, new-account states, persisted icon selection across profiles/chat/conversations, existing linked Draw controls and removable Map context/normal filters. Chats, inbox and the 320px icon picker screenshots were reviewed. The broader browser suite was not run in full during this refinement.

Automated SQL tests use local PGlite. Browser checks cover web rendering at phone sizes; bundle export is not native device acceptance. Hosted Supabase migration deployment, real Auth/Realtime traffic, native date picker/keyboard/screen-reader behavior and iOS/Android account QA still require device/hosted validation. Squad and friend invitations retain the existing acceptance-only API; unsupported decline actions are not fabricated. Draw participation remains the existing no-entry model.
