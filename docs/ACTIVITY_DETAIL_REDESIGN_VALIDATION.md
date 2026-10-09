# Prompt 2 activity detail validation

This redesign targets native iPhone and Android. It reuses the Prompt 0 design system and existing activity permissions, RSVP actions, and tool data.

## Current validation status (2026-10-09)

Implementation and architecture review are complete. Final integrated typecheck and full lint passed; subsequent changed files passed scoped lint. Earlier render-time Animated.Value refs, BOM, and duplicate-import lint findings were corrected. The full npm test rerun after the demo-store correction passed 233/233 unit/database cases in 39.1 seconds, and all nine exploration cases passed.

The frozen web export built 38 routes with entry-6a99cf01a5ee6544cb8d467aea0f9a89.js. Nine combined Map/detail browser cases passed, including exact search/selection/detail title checks and stable-cluster expansion. Cross-prompt Feed 2/2, Squads 2/2, and Upcoming shared Responses-sheet smoke checks also passed. Browser diagnostics recorded no runtime exceptions; CARTO tile requests were aborted during navigation.

The Android emulator is authorized; the rebuilt x86_64 debug APK installed and launched. Earlier native Map preview taps opened the detail route and local-demo RSVP changed the going count and available action. Native Communities swipe synchronization and Feed full-viewport layout were confirmed. **Map results-sheet and shared modal-sheet visibility remain under investigation.** Those observations do not establish acceptance of all native detail tools, modal actions, or gestures.

## Platform and backend choices

- Expo SDK 57 documentation was checked against installed SVG, haptics, linking, and gesture-handler versions. No additional native dependency was introduced for detail.
- Capacity and crew target remain separate. Counts use the existing authoritative capacity selector.
- Tools and profiles must pass existing read permissions before presentation. Paused tools require readable history with writes disabled.
- Calendar is omitted because no calendar integration exists. Native sharing uses the platform share sheet.

## Historical startup and device limits

The Pixel 8a API 35 guest previously required renewed USB-debugging trust after a reboot. That temporary authorization block is resolved. Historical development startup failures and the active shared-sheet investigation are documented in [MAP_REDESIGN_VALIDATION.md](MAP_REDESIGN_VALIDATION.md); a successful development build is not release-build stability evidence.

Browser checks supplement native validation. Windows cannot run an iOS simulator. iPhone safe areas, native transitions, gestures, haptic feel, and sustained release-build frame rate require an iPhone/macOS simulator and physical Android checks as appropriate. Emulator results do not establish physical GPS, thermal, battery, or manufacturer-specific permission behavior.

Final native sheet/detail outcomes will be appended after the ongoing investigation.