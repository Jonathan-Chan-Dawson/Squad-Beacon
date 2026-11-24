Beacons feature

- screens/ActivitiesScreen.tsx: compact Beacons home with retained personal status, one Your People carousel, personal activity, discovery previews and direct Saved & Tools shortcuts. Legacy period links hand off to the dedicated activity and browse screens.
- components/feed/SocialFriendsSection.tsx, socialFriends.ts and friendsBrowseSession.ts: authorized independent availability/notes/activity, shared account-scoped friend scope, stable carousel order and direct Ping/Beacon planning actions; screens/FriendsScreen.tsx retains the searchable virtualized directory. Ping audiences remain editor-selected, separate from the shared Beacon crew.
- screens/BrowseBeaconsScreen.tsx and screens/discoveryPlan.ts: shared readable/public discovery cards, viewer-scoped safe public preview sheets, and Plan links resolved only from an authorized Beacon relationship.
- activityHistory.ts: typed, bounded activity history query/page summaries, privacy-aware demo selector and strict RPC page parser; shared store loader uses session epoch checks.
- screens/CalendarScreen.tsx, calendarSelectors.ts: personal month/week agendas, existing weekly progress, authorized Plan schedules and date-only authoritative next Routine previews. Date/timezone handoffs reuse existing creation and Plan/Routine routes; no recurrence materialization.
- hubSelectors.ts, activityToolEntry.ts: permission-gated confirmed activity, checklist totals and sanitized exact module links.
- components/feed/SharedStatusControl.tsx, StatusPanel.tsx, statusActions.ts: shared Beacons/Profile quick status editor, with existing services and visible partial cleanup. Legacy advanced status creation remains in CreateScreen.
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
- spontaneity/: one local Side Quest catalog shared by the full Machine and the inline Surprise Me preview. The Machine seeds existing Beacon and Ping sessions, while the inline preview updates the current Beacon draft only after confirmation.
- app/beacon-templates.tsx opens the full-screen catalog/My Templates browser through the existing creation controller; CreateHome owns category/search presentation and template callbacks. The former template bottom sheet is removed.
- templateBrowser.ts: presentation-only template families referencing stable IDs in shared/templates.ts; six core families and seventeen additional families use one catalog, including cross-listed Music, Photography, Home and Classes presets. No saved-template migration.
- Remaining redesign extensions (2026-10-13): shared status-reaction registry/picker; atomic own-status service and legacy StatusPanel route; bounded Routine projection DTO/read hook; transactional selected-invitation creation with frozen request UUID/reconciliation. Chronological Supabase migrations 202610130001 through 004 are source-only pending hosted rollout. Existing template, status-conversion and map/date handoffs remain supported.

- components/CreationLocationInput.tsx, socialPlanningSession.ts: web/native debounced Places suggestions and account-scoped editor/Map location round trips; only location changes on confirm, and completed/account-switched drafts reject results.

- livingActivity.ts, demoLivingActivity.ts, components/feed/LivingActivitySection.tsx: authorized Current Activity, independent Activity Notes, and shared Beacons home and Profile Overview activity cards. Up Next selects the owner’s next eligible Beacon.

- creationDraftStorage.ts, draftSnapshot.ts: versioned account-owned local draft snapshots, size-safe native storage chunks, serialized commits, validation, and frozen canonical publication recovery. Publication is blocked when its initial checkpoint fails.
- components/CreationControls.tsx, creationModules.ts: compact disclosure rows, real module switches/configuration, and explicit recommendations; People & Access separates visibility, eligible invitations, delivery effects, approval, capacity, and post-publication role management.
- components/BeaconIdentity.tsx: read-only shared identity for published ActivityCard and creation review; draft review never fabricates published/RSVP state.

- creationValidation.ts: supported HTTPS meeting-link validation for publication; unfinished templates remain exempt.

- components/BeaconOrganizerRoles.tsx: post-publication People entry for canonical approved-Going role grants/removal, with existing owner/co-owner hierarchy and server authorization.

- CreationPeople and CreationCapacity provide inline visibility and joining with a focused community picker. CreationPicker provides centered web dialogs and native sheets for creation controls. CreationAppearance owns the editor’s single artwork entry.
- BeaconShopScreen.tsx handles Rewards, Quests, and contextual equipping. BeaconShopCatalog.tsx renders the filterable catalog, cosmetic previews, and Coin labels. rewardLooks.ts defines appearance tokens. The server wallet remains authoritative.
- demoRewards.ts handles Coins and cosmetic unlocks in the local demo session.
- CreationSavedDrafts shows three recent pills, all-draft browsing and confirmed removal. creationDraftRepository preserves the version-1 format behind injectable IO, validated summaries, and queued fail-closed user deletion; trusted completion cleanup remains separate.
- CreationInvitees hosts the existing SocialSelector with staged decisions in a centered web dialog and a full-screen native picker. Saved drafts retain actual invitation and tool selections.

- components/ActivityCategoryChoices.tsx, components/CreationTimingFields.tsx, BeaconTimingEditor.tsx and creationPublicListing.ts: category choices, inline creation timing, staged published-Beacon timing, and recoverable opt-in public discovery.

- beaconCardShortcuts.ts and components/BeaconCardShortcuts.tsx: viewer-checked reactions/comments, one Chat/host-message or Memories shortcut, counted Tools and authorized Map actions in More across readable cards; public projections remain separate.

- Plan-draft handoffs reuse CreateScreen and existing creation storage: Add to Plan returns private configuration without publication. Only the Plan scheduling transaction creates selected Beacons.

- premiumTools.ts and components/PremiumToolSettings.tsx: validated configuration-only presets and inline Focus, appearance, Teams and Council advanced tools. focusPersistence.ts stores per-account/Beacon absolute-deadline sessions through chunked draft adapters.
- useChecklistPages.ts: viewer-guarded incremental Checklist reads beyond the bounded snapshot. components/JournalEnhancements.tsx and MemoryCollections.tsx preserve note/media authorization and reference-only collections/Afterglow.
- Full Beacon detail uses Overview, People, Tools and Chat. Overview combines host/attendance and places Repeat below Memories and owns the bounded Memories gallery. Legacy activity/tools/memories links retain their destinations; Map sheet navigation stays independent.

- Phase F: agenda.ts, hosting.ts, taskCoordination.ts, roundScoring.ts and activityPremiumPresets.ts extend canonical Premium tools; components/BeaconAgenda, BeaconHosting, TaskCoordination and RoundScoring own inline workspace controls. See docs/SB_BEACON_PLUS_2_VALIDATION_2026-11-15.md for delivery boundaries.

- BeaconSection.tsx supplies section and action-row presentation. ActivityDetailTools uses grouped tool selection and a wide-screen contextual sidebar. BeaconAgenda presents Activity schedule; settings and drafts keep canonical action/revision checks. See docs/BEACON_UI_REDESIGN_PLAN.md.

- Front End 4A: Home has a compact labeled BEACON+ entry; advanced settings use shared capability/access hints without locking whole Free tools. Community previews reuse actual Beacon icons and existing RSVP/privacy selectors.
