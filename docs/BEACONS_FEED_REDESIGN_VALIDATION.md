# Prompt 3 Beacons feed validation

## Implementation and review

The architecture is in [BEACONS_FEED_REDESIGN_PLAN.md](BEACONS_FEED_REDESIGN_PLAN.md). Initial implementation packets used Luna; the user's latest routing moved remaining implementation and review to Sol 6.1. Independent review corrected pager gesture locking, soft-capacity/full response behavior, friend availability sources, and authorized memory thumbnails with independent renewal/expiry.

## Current validation status (2026-10-09)

Final integrated typecheck and full lint passed; subsequent changed files passed scoped lint. The full npm test rerun after the demo-store correction passed 233/233 unit/database cases in 39.1 seconds, and all nine exploration cases passed. The frozen web export built 38 routes with entry-6a99cf01a5ee6544cb8d467aea0f9a89.js.

Both focused Feed browser tests passed on that bundle. They verified pager alignment at 375 × 667 and 390 × 844, Past toolkit/template routing, and Busy creation → Free replacement → Clear within the original five-second assertions. The Upcoming smoke check verified six real pending responses (five Pings and one Vote), the shared Responses & invitations sheet, its visible/enabled pinned New Ping or Vote button, and navigation to the canonical /councils creation flow. Cross-prompt Map/detail 9/9 and Squads 2/2 checks also passed. Browser diagnostics recorded no runtime exceptions; CARTO tile requests were aborted during navigation.

These checks exposed two actual regressions. Successful status writes now advance the selector clock immediately instead of waiting for the periodic clock. The demo store now composes sequential create/cancel actions against a synchronous current snapshot and rejects stale callbacks after viewer scope changes. Busy → Free → Clear passed again after both corrections; the full 233-case suite was rerun after the store correction.

Evidence includes test-results/feed-squads-store-final/upcoming-shared-responses.png and upcoming-runtime.json, with additional settled-layout/status screenshots in test-results/feed-squads-final-diagnostics/.

## Native dependencies and observations

Expo SDK 57's react-native-pager-view 8.0.2 and installed FlashList 2.0.2 are used. The x86_64 Android debug build passed with keyboard-controller 1.21.9 (579 tasks), installed, and launched on the authorized Pixel 8a API 35 emulator. Native Feed full-viewport rendering was confirmed. Native Communities swipes and segmented-pill synchronization were also confirmed in the integrated app.

**The native shared status sheet currently shows a dim backdrop without accepted visible content; Map/shared-sheet investigation is in progress.** Status modal interactions and all native Feed gestures remain unaccepted until exercised successfully. Development build success and web pager checks do not establish native PagerView acceptance or physical-device performance.

References: [SDK 57 PagerView](https://docs.expo.dev/versions/v57.0.0/sdk/view-pager/), [SDK 57 FlashList](https://docs.expo.dev/versions/v57.0.0/sdk/flash-list/).

## Remaining native and device checks

- Feed segment taps/swipes preserve each page position; loading, empty/error/retry, refresh, reduced motion, gutters, and Create-button clearance work at narrow phone sizes.
- Status presets/custom expiry, edit/clear/conversion, and failed writes work without changing attendance.
- Friend filters, stars, separate profile/chat targets, shared-location freshness, and RSVP/full/host states respect current viewer access.
- Week dots, date jumps, shared Map area preferences, response controls, toolkit counts, history/memory permissions, and linked progress work with actual data.
- Windows cannot run an iOS simulator. iPhone safe areas and native gestures require an iPhone or macOS simulator. Physical haptics, sustained release-build frame rate, GPS, thermal/battery behavior, and manufacturer-specific permissions require physical devices.

The earlier emulator USB-debugging authorization block is resolved. Historical native startup notes are retained in [MAP_REDESIGN_VALIDATION.md](MAP_REDESIGN_VALIDATION.md). Final native sheet outcomes will be appended after the ongoing investigation.