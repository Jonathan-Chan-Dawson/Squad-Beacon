# Mobile UI polish and Beacon usability — validation

## Implemented

- Native creation uses the existing Places search with debounce, stale-response rejection, provider/demo labels, and a 44px Map picker action. Account-scoped in-memory drafts preserve editor fields across confirm/cancel and repeated picks; confirmation changes location only. Editing a chosen name clears its coordinates.
- Native detail and Map Overview reuse a physical-location mini map, gated by existing meeting-location permissions. Map Overview preview taps reuse contextual selection and focus at zoom 16.
- Native Overview exposes Chat, Comments and React. Chat opens the dedicated activity chat route, which reuses ChatThread and canonical module access checks. Paused chat history remains read-only. More options, Expand overview and View full Beacon identify separate actions.
- The Profile availability control opens its existing dropdown; the adjacent Status options action opens the existing independent editor.
- Owned native markers keep category shapes and stars, with a thin inner teal outline suppressed for selected markers. Clustering, preview limits and counts are unchanged.
- Native standard pages use subtle horizontal stack transitions with Back gestures and reduced motion. Modal routes retain vertical presentation. Centered dialogs appear immediately and disable drag dismissal; existing fade modals remain unchanged.
- Shared and Map-owned bottom sheets extend their background to the bottom edge, with square lower corners and internal safe spacing. Existing keyboard behavior and the shared spring remain in use.
- Native appearance configuration is automatic. Status icons follow the active appearance. Screen's optional immersive setting, and the shared focus-scoped hook, hide only the status bar and restore it on exit.

## Automated checks

- 100 focused tests passed, covering draft round trips/cancel/repeats, account/completion rejection, creation handoff, module permissions, clustering/ownership, contextual filters, Places parsing, availability, chat retry behavior, and all theme palettes/appearances.
- 13 production browser checks passed: all six themes in light/dark across the main screens at 320/375/430px, no horizontal overflow or runtime page errors, plus appearance persistence and live System appearance. These are web regression checks, not native device verification.
- TypeScript checking passed.
- Lint passed for app, src and components with zero warnings.
- Android and iOS Hermes exports passed; web export and static rendering passed. Final output: `.expo/mobile-polish-configured`.
- Updated two stale test expectations from the previous Tools label to the existing Activity tab. No navigation behavior changed for this correction.
- The first sandboxed native export could not write Hermes temporary bytecode. The subsequent export with the required local access succeeded.
- Earlier production artifacts omitted service configuration and caused web hydration errors. The final clean export loads `.env` before Metro starts; the existing configured service URL was verified in Android, iOS and web bundles without exposing its value. No credential values were changed.

Reproduction: `node --env-file=.env node_modules/expo/bin/cli export --platform android --platform ios --platform web --clear --max-workers 2 --output-dir .expo/mobile-polish-configured`.

## Native runtime acceptance remains pending

Bundle exports do **not** establish device-level behavior. The installed Android development client and Pixel 8a emulator were available, but the emulator did not respond reliably to screen inspection; the emulator started for this task was closed. This Windows environment has no iOS runtime.

Still verify on responsive Android and iOS targets:

- Map → Create and editor → Map → editor: confirm/cancel, repeated selection, search failures, keyboard use and full draft preservation.
- Private/online/missing locations, preview filter restoration, Chat/Comments/Reactions and readonly/denied states.
- 320/375/430px layouts, long labels, Essential Light/Dark and the other themes.
- Push/pop, swipe/system Back, reduced motion, centered dialogs, sheet resizing/keyboard, gesture navigation and safe areas.
- Immersive status-bar restoration on focus changes.

The native appearance configuration requires a rebuilt native app. Places suggestions continue to require the existing authenticated Places service. No new packages, migrations or backend infrastructure were added. Beacon chat has no new unread persistence; its existing handling is reused.

## Modified files

| Area | Files |
| --- | --- |
| App shell and route | `app.config.ts`, `app/_layout.tsx`, `app/activity/[id]/chat.tsx` |
| Creation | `src/features/beacons/screens/CreateScreen.tsx`, `src/features/beacons/components/CreationLocationInput.tsx`, `src/features/beacons/createHandoff.ts`, `src/features/beacons/socialPlanningSession.ts` |
| Detail and Profile | `src/features/beacons/screens/ActivityDetailScreen.tsx`, `src/features/beacons/components/activity-detail/ActivityDetailHero.tsx`, `src/features/beacons/components/activity-detail/ActivityDetailInfo.native.tsx`, `src/features/beacons/components/feed/StatusPanel.tsx` |
| Map | `src/features/maps/screens/MapScreen.tsx`, `src/features/maps/MapPanel.tsx`, `src/features/maps/BeaconOverviewSheet.tsx`, `src/features/maps/MapResultsSheet.tsx`, `src/features/maps/components/BeaconMapMarkers.native.tsx`, `src/features/maps/components/BeaconLocationPreview.native.tsx`, `src/features/maps/components/BeaconLocationPreview.tsx` |
| Shared UI | `src/shared/ui.tsx`, `src/shared/mobilePresentation.ts`, `src/shared/SystemBars.tsx`, `src/shared/SystemBars.native.tsx`, `src/shared/AppNavigation.tsx`, `src/shared/AppNavigation.native.tsx` |
| Tests and records | `tests/creationLocationDraft.test.ts`, `tests/activityToolEntry.test.ts`, `package.json`, inventories under `app`, `src/shared`, `src/features/beacons`, `src/features/maps`, and this document |
