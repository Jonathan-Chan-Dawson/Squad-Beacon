Beacons feature

- screens/ActivitiesScreen.tsx: compact Beacons home with personal status, friend selection, a prioritized confirmed activity card, discovery previews and secondary saved tools. Legacy period links hand off to the dedicated activity and browse screens.
- screens/BrowseBeaconsScreen.tsx and screens/discoveryPlan.ts: shared readable/public discovery cards, viewer-scoped safe public preview sheets, and Plan links resolved only from an authorized Beacon relationship.
- activityHistory.ts: typed, bounded activity history query/page summaries, privacy-aware demo selector and strict RPC page parser; shared store loader uses session epoch checks.
- screens/CalendarScreen.tsx, calendarSelectors.ts: personal month/week agendas, existing weekly progress, authorized Plan schedules and date-only authoritative next Routine previews. Date/timezone handoffs reuse existing creation and Plan/Routine routes; no recurrence materialization.
- hubSelectors.ts, activityToolEntry.ts: permission-gated confirmed activity, checklist totals and sanitized exact module links.
- components/feed/HubFriends.tsx, SharedStatusControl.tsx, StatusPanel.tsx, statusActions.ts: compact independent friend targets/raised-hands reactions and the shared Beacons/Profile quick status editor, with existing services and visible partial cleanup. Legacy advanced status creation remains in CreateScreen.
- createHandoff.ts: validated invitee/context/status-text handoff and serialized post-creation invitation retries; a partial invitation failure never recreates the Beacon.
- screens/CreateScreen.tsx: creation launcher/editor, parameter-driven resets, drafts, validation, persistence and placement.
- screens/ActivityDetailScreen.tsx: Beacon detail workspace, navigation, RSVP actions and permission-gated tools.
- components/activity-detail/: shared Hero, Info (with native variant), Progress, People and Tools sections, also reused by Map sheets.
- ActivityCard.tsx, ActivityBadge.tsx, BeaconResponse.tsx: feed rows, status, and RSVP controls.
- components/BeaconFeedCard.tsx: readable Activity adapter for the shared compact discovery shell, retaining canonical participation and Home presentation behavior.
- cardSocialPreview.ts: current-viewer profile-safe attendee faces and canonical count; friend previews retain read access while general attendee faces require detail-roster permission.
- BeaconTools.tsx, beaconModules.ts: checklist, Beacon Sketchboard, Timer, and access helpers.
- BeaconMemories.tsx, beaconMedia.ts: Beacon-linked photos/videos and private uploads.
- BeaconScoreboard.tsx, models.ts: team membership, scores, and media/team contracts.
- moduleCollections.ts: private saved Lists and Journal demo actions.
- controls.ts, permissions.ts: organizer roles/capabilities and authorization helpers.
- createTiming.ts, focusTimer.ts: duration/deadline and local focus timer helpers.
- CreateHome.tsx: compact creation launcher with blank first, diverse For You, Recent, direct activity search, and saved-template reuse/editing. Compact secondary Plan/Routine entries retain canonical routes. The focused editor in screens/CreateScreen.tsx owns persistence and placement.
- templateBrowser.ts: presentation-only template families referencing stable IDs in shared/templates.ts; six core families and seventeen additional families use one catalog, including cross-listed Music, Photography, Home and Classes presets. No saved-template migration.
- Remaining redesign extensions (2026-10-13): shared status-reaction registry/picker; atomic own-status service and legacy StatusPanel route; bounded Routine projection DTO/read hook; transactional selected-invitation creation with frozen request UUID/reconciliation. Chronological Supabase migrations 202610130001 through 004 are source-only pending hosted rollout. Existing template, status-conversion and map/date handoffs remain supported.

- components/CreationLocationInput.tsx, socialPlanningSession.ts: web/native debounced Places suggestions and account-scoped editor/Map location round trips; only location changes on confirm, and completed/account-switched drafts reject results.

- livingActivity.ts, demoLivingActivity.ts, components/feed/LivingActivitySection.tsx: owner-first authorized Current Activity, independent Activity Note lifecycle, compact profile presence, direct editor, and contextual planning handoffs.

- creationDraftStorage.ts, draftSnapshot.ts: versioned account-owned local draft snapshots, size-safe native storage chunks, serialized commits, validation, and frozen canonical publication recovery. Publication is blocked when its initial checkpoint fails.
- components/CreationControls.tsx, creationModules.ts: compact disclosure rows, real module switches/configuration, and explicit recommendations; People & Access separates visibility, eligible invitations, delivery effects, approval, capacity, and post-publication role management.
- components/BeaconIdentity.tsx: read-only shared identity for published ActivityCard and creation review; draft review never fabricates published/RSVP state.
- components/CreationDateField.tsx and .native.tsx: native date/time controls and timezone-aware browser date input, retaining calendar handoffs.

- creationValidation.ts: supported HTTPS meeting-link validation for publication; unfinished templates remain exempt.

- components/BeaconOrganizerRoles.tsx: post-publication People entry for canonical approved-Going role grants/removal, with existing owner/co-owner hierarchy and server authorization.

- Pass 1.1: CreationPeople/CreationCapacity provide flat inline access, invitees, primary association and capacity; CreationDisclosure controls one major optional section at a time; CreationAppearance shares inline and focused artwork controls.
- CreationSavedDrafts shows three recent pills, all-draft browsing and confirmed removal. creationDraftRepository preserves the version-1 format behind injectable IO, validated summaries, and queued fail-closed user deletion; trusted completion cleanup remains separate.
- Live creationOptionalSection is retained across Map handoffs but omitted from durable snapshots, so resumed saved drafts begin with optional sections collapsed.

- Focused mobile polish: CreationPeople uses mutually exclusive inline visibility/community/joining panels; CreationInvitees hosts the existing SocialSelector in a full-screen modal with local gesture/sheet support. Saved draft pill styling is compact without changing storage or recovery.
