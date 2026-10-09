# Prompt 1 map validation

The map targets iPhone and Android. Browser previews supplement native checks. The user selected Android emulator verification and documentation of physical-device limits.

## Current validation status (2026-10-09)

The final integrated `npm run typecheck` and full `npm run lint` passed; subsequent changed files also passed scoped lint. The full `npm test` rerun after the demo-store correction passed all 233 unit/database cases in 39.1 seconds. All nine exploration cases passed. The frozen web export built 38 routes with `entry-6a99cf01a5ee6544cb8d467aea0f9a89.js`.

Nine focused Map/detail browser cases passed, including the stable-cluster retest with actual pointer hits, camera-scale changes, expanded singleton pins, and exact selected-title checks. They exercise area searching, search/selection/detail synchronization, Compass opening without a location request, category filters/reset, attribution, and narrow-phone layouts. The final cross-prompt checks also passed Feed 2/2, Squads 2/2, and the Upcoming shared Responses-sheet smoke check. Browser diagnostics recorded no runtime exceptions; CARTO tile requests were aborted during navigation.

The Pixel 8a API 35 emulator is authorized. The rebuilt x86_64 Android debug APK installed and launched through the localhost Metro server. Native Communities swipes and segmented-pill synchronization, and the Feed's full-viewport layout, were confirmed. **Native Map results-sheet and shared modal-sheet visibility remain under investigation.** A dim backdrop does not establish visible content or successful snap behavior. Native sheet acceptance is not complete.

## Dependencies and platform APIs

- Expo SDK 57, react-native-maps 1.27.2, FlashList 2.0.2, Gorhom Bottom Sheet 5, and Supercluster.
- iOS uses Apple Maps with muted standard appearance; Android uses Google Maps with palette-aware styling. Web uses attributed CARTO tiles.
- Foreground location is requested only through explicit Use my location. Explicit Sonar start/extension retains the existing permission and device-location lifecycle. Camera movement does not start sharing or alter access rights.

References: [Expo Maps SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/), [Expo Location SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [Expo FlashList SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/flash-list/).

## Historical Android checks and troubleshooting

The Pixel 8a emulator reports 1080 × 2400 pixels at density 420. Earlier cold launches exercised local-demo entry, styled Google Maps tiles, cluster expansion, and native singleton pins. A stray whitespace child in MapView was removed. An unsupported animated Circle color update (`ColorValue: the value must be a number or Object`) was corrected by keeping colors static and animating only numeric radius.

With fine/coarse location permissions denied, opening Compass did not request permission. Explicit Use my location displayed Android's permission request. Denial retained denied permissions and showed the inline Open Settings explanation. Evidence: `.expo/native-check/map-surface-compass-open.png` and `.expo/native-check/map-surface-location-denied.png`.

The selected Beacon preview was initially obscured by native map stacking. Elevation on its outer host made it visible; a horizontal swipe changed selection, and tapping the card opened detail. Evidence: `.expo/native-check/map-surface-layer-fix.png`, `.expo/native-check/map-surface-carousel-swipe.png`, and `.expo/native-check/map-surface-detail-tap2.png`. Local-demo I'm In on Pickup basketball changed two going to three and displayed I'm Out: `.expo/native-check/map-surface-rsvp-confirmed.png`. These checks did not write a production account's data.

Two development startup/bundle transitions produced a Fabric SIGSEGV in `MountingCoordinator::pullTransaction`; other cold launches and a manual reload did not reproduce it. A later guest session failed before JavaScript startup. Restarting without wiping data temporarily required renewed USB-debugging trust. That authorization block is resolved. These historical development events do not establish release-build stability or frame rate.

Earlier sheet diagnostics measured scene height 840.38 dp, hosting height 812.19 dp, handle height 24 dp, and index 0 at position 716.19 dp (detents 716.19, 406.10, 0). An unconstrained absolute BottomSheetView had reported about 5,334 dp of content. Bounded View frames with `flex: 1` and `minHeight: 0` replaced it while retaining the registered FlashList creator. This did not establish visible native sheet acceptance; renewed finite development diagnostics are investigating the remaining Map/shared-sheet issue.

The browser search-to-preview mismatch was corrected by serializing programmatic carousel scrolling and allowing only real drag/momentum to select another item. Search selects a readable canonical Beacon and includes it in synchronized results even outside active filters. Final focused browser checks verified exact selected titles.

## Backend and physical-device limits

- No waitlist data/action exists; full Beacons do not offer a fabricated waitlist.
- Windows cannot run an iOS simulator. Apple Maps rendering, iPhone safe areas, and iOS gestures require an iPhone or macOS simulator check.
- Emulator and browser checks cannot establish sustained 60 fps on physical devices. Release-build performance, haptic feel, GPS accuracy, manufacturer-specific permissions, thermal behavior, and battery use remain physical-device checks.

Final native sheet outcomes will be appended after the ongoing investigation.