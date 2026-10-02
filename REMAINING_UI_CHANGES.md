# Remaining UI / UX Changes

This is a status ledger for the execution blueprint and related follow-up
requirements. It is intentionally not a completion claim. The current
checkpoint ships shared selected-state marks, one compact activity card,
relative active-time wording, visible Vote/Draw and Beacon Plan naming, and a
friend-to-DM action, capacity/tool settings, and manual attendance controls.
Checkpoint validation passed: 110 unit/database tests, 18 browser tests,
typecheck, lint, and fresh web/Android exports. Exports are not device testing
or a native binary build. Local migrations have not been remotely deployed.

## Phase 0 — Audit

- **Architecture inventory — Complete.** Existing Expo Router routes,
  feature folders, data/domain boundaries, and prior shared implementations
  were reviewed before this checkpoint. Preserve the current app/ route
  wrappers and established src/features, src/shared, and src/platform
  organization. Paths: _inventory.txt, app/_inventory.txt, src/_inventory.txt,
  src/features/_inventory.txt.

## Phase 1 — Component architecture

- **Reusable UI ownership — Partial; Medium.** Reusable components still live
  beside feature screens under src/features; the blueprint asks for a clear
  components/ boundary. Do not move them while 005 backend/UI work is active.
  Proposed mapping: src/shared/ui.tsx → components/shared/ui.tsx;
  src/features/beacons/ActivityCard.tsx and ActivityBadge.tsx →
  components/activities/; src/features/profile/ProfileAvatar.tsx and
  AvatarToggle.tsx → components/avatar/; map panel, tooltip, and native/web map
  siblings → components/map/; DirectoryControls.tsx and InviteQR.tsx →
  components/squads/; Beacon response/tools and ProposalEditor →
  components/beacon/. Keep screens, business logic, hooks, and feature
  contracts in src/features, src/shared, and src/platform. Preserve platform
  siblings and avoid re-export stubs. Dependency: backend 005 edit-freeze/
  handoff, then import/platform-resolution QA. Paths: components/,
  src/shared/, src/features/.
- **Search and sorting ownership — Partial; Medium.** Common Beacon browsing
  and domain helpers are separated, but Search UI/filter behavior remains
  screen-specific and friend ranking is inside ActivitiesScreen. Consolidate
  only after behavior is covered by tests. Paths: src/shared/browsing.ts,
  src/shared/domain.ts, src/features/beacons/screens/ActivitiesScreen.tsx,
  src/features/people/screens/SquadsScreen.tsx.
- **Folder guidance — Partial; Low.** Inventory guides exist for authored
  folders; add short README guidance only where a later component move creates
  a non-obvious boundary. Do not document generated/native internals as source
  components. Paths: components/, src/features/, src/shared/.

## Phase 2 — Shared design system

- **Selected controls — In progress; High.** Chips, directory filters, and
  Current/Upcoming/Past now pair a visible check mark with selected
  accessibility state. Validate native/web rendering and all multiselects;
  audit controls implemented locally outside these primitives for equivalent
  visible and accessible state. Paths: src/shared/ui.tsx,
  src/features/people/DirectoryControls.tsx,
  src/features/beacons/screens/ActivitiesScreen.tsx,
  src/features/plans/PlansScreen.tsx.
- **Consistency and feedback — Partial; Medium.** Shared Button/Action/Field/
  Sheet/Empty/Screen primitives exist, but local spacing, focused states,
  loading/error behavior, and expandable sections have not received a complete
  screen-by-screen audit. Keep tooltips limited to genuinely non-obvious
  concepts. Paths: src/shared/ui.tsx, src/features/**/.

## Phase 3 — Search, filters, and friend priority

- **Search coverage — Partial; High.** Search is present for Beacons,
  friends, templates, and library entries, but there is no single reusable
  search pattern and place/Squad/private-list search is incomplete.
  Dependencies: shared SearchField and discovery/organization data contracts.
  Paths: src/shared/ui.tsx, src/shared/browsing.ts,
  src/features/beacons/screens/ActivitiesScreen.tsx,
  src/features/people/screens/SquadsScreen.tsx, src/features/maps/.
- **Friend list terminology — Partial; Medium.** Current preview now says
  Starred Friends; the existing private Close Friends list is retained. Verify
  every entry point consistently replaces Best/Good Friends language without
  changing private-list behavior. Paths:
  src/features/beacons/screens/ActivitiesScreen.tsx,
  src/features/people/DirectoryControls.tsx,
  src/features/people/screens/SquadsScreen.tsx.
- **Prioritization rules — Partial; High.** Current friend preview currently
  orders available friends, then starred friends, then name. It does not yet
  implement the complete requested order (people in the user's Beacon,
  available Starred, available Close Friends, other available friends, then
  relevant non-available friends). Move policy out of screen JSX and test
  each branch. Paths: src/features/beacons/screens/ActivitiesScreen.tsx,
  src/shared/domain.ts, tests/domain.test.ts.
- **Beacon filters — Partial; Medium.** Search/category/join/sort filters
  exist and selected checks are visible; public/open-to-join/time filters
  must follow server-backed public/admission semantics rather than imply
  unavailable access. Paths: src/features/beacons/screens/ActivitiesScreen.tsx,
  src/features/discovery/.

## Phase 4 — Terminology and RSVP

- **Visible language — In progress; High.** The UI now uses Pings & Decisions,
  Vote, Draw, and Beacon Plans; RSVP controls now use I'm In, I'm Out,
  Request, and Pending. Confirm no user-facing Council strings remain;
  internal action names and /council/... routes intentionally remain stable.
  Paths: src/features/planning/, src/features/plans/,
  src/features/beacons/BeaconResponse.tsx, src/features/maps/MapTooltip.tsx.
- **Invitation lifecycle — Implemented and checkpoint-verified.**
  Migration 005 and demo preserve durable invitations across I'm Out and
  remove the invitation grant only when a manager removes the person. The
  database acceptance and browser re-entry tests pass. Native device testing
  remains separate from the successful Android bundle export. Paths:
  supabase/migrations/202610010005_beacon_controls.sql, src/shared/types.ts,
  src/shared/store.tsx, src/shared/demo.ts, src/features/beacons/BeaconResponse.tsx.
- **Alternative creation — Partial; High.** Pings, Vote/Draw option creation,
  approval, resolution, and idempotent materialization exist. Normal Beacon
  creation does not yet offer a clear Add Alternative path that transitions
  into Vote/Draw while distinguishing an independent Add another Beacon.
  Paths: src/features/planning/, src/features/beacons/screens/, app/create.tsx.

## Phase 5 — Beacon creation

- **Fast path and progressive disclosure — Partial; High.** Searchable
  recipes, editable fields, saved templates, and recommended tools exist; the
  end-to-end editor still needs a focused pass so essential title/place/time/
  audience/join behavior is quick and secondary People/Activity/Social/Style
  controls are grouped behind Advanced. Preserve approval, privacy, templates,
  and repeat-as-reuse semantics. Paths: app/create.tsx, src/features/beacons/,
  src/features/library/, src/shared/templates.ts.
- **Map-to-create and confirmation — Not complete; High.** Place search or a
  selected map point should enter the Beacon editor with that location; after
  creation use restrained confirmation feedback. Paths:
  src/features/maps/screens/MapScreen.tsx, src/features/maps/, app/create.tsx.

## Phase 6 — Beacon card

- **Single compact card — Implemented and checkpoint-verified.**
  Activities now uses one shared compact ActivityCard; the Full/Compact
  selector and duplicate feed-card branch were removed. Existing details,
  RSVP, and a non-interactive priority marker remain. Paths:
  src/features/beacons/ActivityCard.tsx,
  src/features/beacons/screens/ActivitiesScreen.tsx.
- **Card details — Partial; Medium.** The card shows category/title, host,
  location or Virtual, relative time, attendance count, target need, and RSVP.
  It does not yet show attendee avatar groups or expose a dedicated Beacon
  star control; the up-arrow shown today is friend/squad priority, not a Beacon
  favorite. Keep these concepts distinct. Paths:
  src/features/beacons/ActivityCard.tsx, src/features/beacons/BeaconResponse.tsx,
  src/shared/types.ts.

## Phase 7 — Beacon overview

- **Progressive detail and modules — Partial; High.** Detail already has
  Overview/People/Chat and shared checklist/notes/local focus tools, with
  Virtual presentation available from meeting data. Audit disabled modules,
  narrow-screen overview facts, and completed/cancelled history permissions.
  Invitation controls still need progressive disclosure rather than a long
  stack of individual friend buttons before Tools. Paused checklist, journal,
  focus, and chat behavior passed the checkpoint browser tests.
  Memories remain simple comments rather than linked media Experiences.
  Paths: app/activity/[id].tsx, src/features/maps/MapPanel.tsx,
  src/features/beacons/BeaconTools.tsx, src/features/library/LibraryScreen.tsx.

## Phase 8 — Map

- **Place search / drop-to-create — Not complete; High.** Search and choose a
  place, or select a map point and carry it into Beacon creation. Paths:
  src/features/maps/screens/MapScreen.tsx,
  src/features/maps/components/BeaconMap.tsx, app/create.tsx.
- **Clustering, marker sizing, and drill-in — Partial; High.** Map markers and
  Beacon tooltip/detail exist; verify explicit avatar/Beacon clusters,
  mixed-cluster drill-in, and marker-size hierarchy rather than treating a
  filter as clustering. Paths:
  src/features/maps/components/BeaconMap.tsx,
  src/features/maps/MapTooltip.tsx, src/features/maps/MapPanel.tsx.
- **Directions and person quick actions — Not complete; High.** Physical
  Beacon and Beacon Plan steps need distance/navigation actions; avatar
  quick-details need Ping, Message, Invite, and Profile without exposing
  private location. Paths: src/features/maps/MapPanel.tsx,
  src/features/maps/MapTooltip.tsx, src/features/plans/.
- **Privacy — Preserve.** Do not add precise public or Sonar location sharing
  to solve map discovery.

## Phase 9 — Activities

- **Current/Upcoming/Past — Partial; High.** Current friend preview,
  actionable planning inbox, Past-only toolkit, and compact Beacon history are
  retained. Activity cards now use relative Starts in / Ends in wording;
  confirm screen and widget clocks on native/web. Paths:
  src/features/beacons/screens/ActivitiesScreen.tsx,
  src/features/planning/PlanningInbox.tsx, src/shared/domain.ts.
- **Current status priority/editing — Partial; High.** Friend preview and
  Find Friends work, but editing the user's status directly here and
  prioritizing people inside the user's Beacon need completion. Paths:
  src/features/beacons/screens/ActivitiesScreen.tsx, src/features/beacons/.
- **Upcoming plans/invites and Past repeat behavior — Partial; Medium.**
  Pending decisions are shown only when actionable and utilities stay Past
  only. A compact joined Beacon Plan summary and repeat-focused routines/
  saved Plan templates/recent-memory flow still need product-level verification.
  Paths: src/features/planning/PlanningInbox.tsx,
  src/features/beacons/screens/ActivitiesScreen.tsx, src/features/plans/.

## Phase 10 — Beacon Plans

- **Terminology and multi-Beacon data — Partial; Medium.** The user-facing
  label is now Beacon Plans and Plans/templates already schedule multiple
  Beacon steps. Clarify Plan membership separately from individual Beacon
  RSVP; add per-step directions and map entry. Paths:
  src/features/plans/PlansScreen.tsx, src/features/plans/PlanDetailScreen.tsx,
  src/features/plans/domain.ts, src/features/maps/.
- **Conflict discussion — Not complete; High.** Conflict detection suggests
  alternate times, but a squad/Plan conflict should offer an actual Ask the
  group Vote/Draw draft with the conflicting step and editable alternative,
  retaining the Plan audience and deadline-before-start validation. No
  auto-publish or auto-RSVP. Paths: src/features/plans/,
  src/features/planning/ProposalEditor.tsx,
  src/features/planning/PlanningListScreen.tsx.

## Phase 11 — Squads / conversations

- **Friend messaging — Implemented and browser-verified.**
  Friend cards now give the larger primary action to a real direct-message
  route while avatar/name retain a separate Profile target. Paths:
  src/features/people/screens/SquadsScreen.tsx, app/messages/[id].tsx,
  app/person/[id].tsx.
- **Squad conversations — Backend/product dependency; High.** Squad rows
  still open real Squad details/activities; no Squad-chat route or durable
  squad-conversation contract exists. Do not add a misleading Chat button/page.
  Add conversation only with a real access-controlled backend and then make
  the row conversation-first. Paths: src/features/people/screens/SquadsScreen.tsx,
  src/features/messages/, src/shared/types.ts, src/shared/store.tsx,
  supabase/migrations/.
- **Directory organization — Partial; High.** All/Squads/Friends/Private Lists
  and friend search exist. Organization records/audience are still isolated
  scaffolding, and unread/starred sections are not part of the directory.
  Native share and QR invite exist; confirm native share is as discoverable
  as QR. Paths: src/features/people/, src/features/organizations/,
  src/features/people/InviteQR.tsx.

## Phase 12 — Profile

- **Profile/settings consolidation — Partial; Medium.** Public and self
  profile, editable identity, photo/mini avatar, interests, aspirations, and
  theme palettes exist. Consolidate notification/privacy/theme/account
  controls into coherent Settings; reduce management-button stacking and make
  own/public profile hierarchy consistent. Paths:
  src/features/profile/ProfileScreen.tsx,
  src/features/profile/ProfileSurvey.tsx, src/shared/preferences.tsx,
  src/shared/themes.ts.
- **Linked Experiences — Not complete; Medium.** Memories/media should remain
  linked to their source Beacon when surfaced on Profile. 005 stores validated
  optional external music links and decoration settings; it does not provide
  audio playback, media creation/reels, or decorations on Profile. Do not
  present those as implemented. Paths: src/features/profile/,
  src/features/library/, src/features/beacons/BeaconTools.tsx,
  src/features/beacons/BeaconSettings.tsx.
- **Avatar and privacy limits — Partial; Low.** Mini avatar/photo exists;
  a full avatar builder and per-field public profile visibility controls do
  not. Birthday/age information remains private. Paths:
  src/features/profile/, src/shared/types.ts.

## Phase 13 — Onboarding and authentication

- **Fast onboarding and later completion — Partial; Medium.** Auth, age gate,
  skippable/repeatable interests and aspiration survey exist. Recheck that
  signup reaches the app quickly, optional identity questions are not
  accidentally mandatory, and an incomplete survey remains easy to resume.
  Paths: src/features/auth/, src/features/profile/ProfileSurvey.tsx,
  src/shared/preferences.tsx.
- **Guest/public browse and action gates — Not complete; High.** Define how
  signed-out guests browse safely and when creation/join/messaging prompts for
  auth. Any public Discover route must use only the sanitized summary from
  006; account/auth transitions must not load private activity details or
  expose exact location. Dependencies: SQL006 public projection/admission
  security and Auth route behavior. Paths: src/features/auth/,
  src/features/discovery/, src/shared/store.tsx.

## Phase 14 — Notifications / briefing

- **Action notifications and briefing — Partial/unverified; High.** The app
  has notification/inbox foundations, but end-to-end delivery for Pings,
  votes, draws, invites, approval, joins, starts-soon, and Squad messages plus
  a non-empty-only entry briefing is not demonstrated. Dependencies: durable
  backend event/notification contracts and permission-aware navigation.
  Paths: src/platform/notifications.*, src/features/planning/,
  src/features/beacons/, src/features/messages/.

## Phase 15 — Help / terminology

- **Help content — Partial; Medium.** Help/tutorial route exists; review it
  against current Ping, Beacon, Vote/Draw, Beacon Plan, Starred/Close Friends,
  and location semantics. Do not teach Council terminology or imply
  unimplemented public discovery/Sonar behavior. Paths:
  src/features/help/HelpScreen.tsx, app/help.tsx.

## Phase 16 — Final polish and QA

- **Checkpoint QA — Passed; wider blueprint QA remains.** All 110 tests,
  typecheck, lint, 18 browser flows, and fresh web/Android exports passed.
  Browser coverage includes 320px/390px controls across five themes, real
  friend-DM navigation, capacity settings, manual attendance, paused tools,
  and durable invitation re-entry. No native device/binary test or remote
  migration deployment is claimed. Remaining blueprint flows include
  map-to-place creation, ping → Beacon, Vote/Draw resolution, RSVP
  I'm In/I'm Out, Plan-step directions, friend-status-to-Beacon, Squad
  conversation/Profile, and Beacon memory → Profile → source Beacon. Check
  320px/390px, theme contrast, keyboard/search, focus, tap targets, empty/
  error/loading states, and route dead ends. Paths: tests/browser/, tests/,
  src/features/, app/.

## Additional requirements / current partial work

- **Public discovery and organizations — Isolated scaffold only; Critical
  before integration.** Safe domain/types validation and three focused
  standalone tests exist under src/features/discovery/ and
  src/features/organizations/. There is no migration 006, shared Data/store/
  snapshot/action integration, route, or screen. Implement sanitized public
  summary and explicit coarse-area opt-in; server-side coordinate quantization,
  block/exclusion checks, public admission, and capacity must be authoritative.
  Organizations must remain distinct from Squads, invite-only, and role
  protected. Preserve 005 viewer_id, viewer_can_access, and
  accepted_seat_count. Dependencies: stable 005 handoff, SQL006 security/
  snapshot/action integration, then routes and browser coverage. Register the
  suite is registered in the main test script and passes.
  Paths: src/features/discovery/, src/features/organizations/,
  src/shared/types.ts, src/shared/demo.ts, src/shared/store.tsx,
  supabase/migrations/, tests/discoveryOrganizations.test.ts.
- **Planning/database delivery — Core implemented; follow-up partial; High.**
  Migrations 001–005, shared types/demo/store, controls UI, planning UI, and
  database tests are integrated and currently green. Keep 006 isolated until
  the backend handoff, then add its migration chain. Proposal editing/search/
  time/place and deterministic resolution exist; add the Plan conflict entry
  point described above. Dependency: public/org contracts and SQL006 review.
  Paths:
  supabase/migrations/20261001000*.sql, src/features/planning/,
  tests/planningThreads*.test.ts.
- **Beacon modules/media limits — Partial; Medium.** Shared Checklist/Notes and the
  local timer exist; do not replace existing notes. Media Experiences/reels,
  streaming songs, and linked Profile media are separate work, not implied by
  the current Library. Dependency: source-linked media model and permissions.
  Paths: src/features/beacons/BeaconTools.tsx, src/features/library/,
  src/features/profile/.
- **Capacity, attendance, and roles — Verified foundation; role UI incomplete; High.**
  Migration 005, server projections, BeaconSettings, AttendanceControls, and
  permission gates are integrated. Database permission/revocation tests and
  browser capacity/settings/manual-attendance flows pass. Role grant/revoke
  pickers and co-owner/admin admission controls remain API-only and need UI;
  do not infer access from a client list. Dependency: role-management UI and
  native device QA. Paths:
  src/features/beacons/,
  src/shared/types.ts, supabase/migrations/202610010005_beacon_controls.sql.
- **Discovery limits — Explicitly not implemented; Critical safety dependency.**
  Public recommendations must not appear as an Upcoming widget by default; use a dedicated Discover
  route reached from Past utilities or an explicit opt-in filter. No precise
  public GPS, Sonar, full host profile, private place, chat, attendee, or tool
  payload may enter a public summary. Dependency: server-sanitized SQL006
  projection and explicit publication opt-in. Paths: src/features/discovery/,
  src/features/beacons/screens/ActivitiesScreen.tsx.
