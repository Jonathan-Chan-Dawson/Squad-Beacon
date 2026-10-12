Beacons feature

- screens/ActivitiesScreen.tsx: Current, Upcoming, and Past beacon feed.
- ActivityCard.tsx, ActivityBadge.tsx, BeaconResponse.tsx: feed rows, status, and RSVP controls.
- BeaconTools.tsx, beaconModules.ts: checklist, Beacon Sketchboard, Timer, and access helpers.
- BeaconMemories.tsx, beaconMedia.ts: Beacon-linked photos/videos and private uploads.
- BeaconScoreboard.tsx, models.ts: team membership, scores, and media/team contracts.
- moduleCollections.ts: private saved Lists and Journal demo actions.
- controls.ts, permissions.ts: organizer roles/capabilities and authorization helpers.
- createTiming.ts, focusTimer.ts: duration/deadline and local focus timer helpers.
- CreateHome.tsx: compact creation launcher with blank first, diverse For You, Recent, direct activity search, and saved-template reuse/editing. Plan/Routine tabs retain their existing creation routes. The existing Quick/Advanced editor in app/create.tsx owns persistence and placement.
- templateBrowser.ts: presentation-only template families referencing stable IDs in shared/templates.ts; six core families and seventeen additional families use one catalog, including cross-listed Music, Photography, Home and Classes presets. No saved-template migration.
- PeriodTabs.tsx: activity period selector.
