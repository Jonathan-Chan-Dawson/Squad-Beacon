# Beacons and Your Activity consistency — 2026-10-30

## Changes

- Reuse Profile's existing `contentMaxWidth` (640px, including 16px side gutters) for Beacons Home, Your Activity's header/actions/content, Chats/Communities, and the shared content style used by direct and Squad conversations. Mobile content remains fluid. The Map canvas remains full width.
- Keep the workspace's Beacons / Plans / Calendar tabs inside a compact segmented control, capped at 360px and aligned with the content. Retain lazy panels, independent state, route aliases and identity resets.
- Use compact wrapping action bars with 44px minimum targets, existing icons and selected-state tokens. The legacy Plan fallback exposes its existing Create / Templates / Routines actions together.
- Keep the personal activity list's compact card composition. Use the same 17px headline and 16px corner tokens as compact discovery cards; reduce compact homepage category artwork to 44px. Retain social/capacity details where they already appear and preserve all participation handlers.
- Match Beacons and Your Activity header typography. Improve Plan row text sizing and prevent its text column from pushing outside the available width.
- Present Month / Week as a contained control using the existing theme tokens. Calendar dates, routines, itinerary expansion, scheduling and restoration are unchanged.

No routes, persistence boundaries, permissions, backend actions, dependencies or migrations were added or changed by this pass. Concurrent Map, discovery and participation work is outside this change's ownership.

## Validation

- Focused unit suites: **53 passed** across activity screens/workspace, Calendar/projection, RSVP, messaging/retained hub state, homepage, Plans and theme tokens.
- Final typecheck: **passed**.
- Changed-file lint: **passed**, zero lint findings in this pass's source files.
- Full repository lint: **passed**, exit 0 (`npm run lint -- --concurrency 4 --cache --cache-location .expo/activity-lint-cache`). Concurrent Map changes were preserved; their transient unused-variable warning was resolved by their owner before this final run.
- Final browser suite: **18 passed**. It covers 320 / 375 / 390 / 430 / 1440 / 1920px in Light and Dark, aligned columns and search/actions, compact tab width, Month/Week switching, horizontal overflow, keyboard tab activation, 44px targets, and bounded direct conversations.
- Actual desktop 75% Chrome zoom is set through Chrome's own Appearance setting in an isolated profile, with `devicePixelRatio = 0.75` asserted. This is browser page zoom, not CSS scaling.
- Existing workspace journeys: **4 passed**, covering light/dark retained filters and Calendar state, scheduling date/timezone and itinerary-to-Beacon return/restoration.
- The legacy `smartRsvp.spec.ts` homepage fixture expects `a1` inside a two-card homepage preview. That assertion also fails on the prior immutable preview at 320px. It is not counted as passing. New visible-card coverage checks the current personal list, live response confirmation, cancellation and removing a tentative response from the committed list.
- Final isolated web export: **passed**, `.expo/activity-consistency-final`.

Browser evidence uses local demo data. Hosted data, native builds, simulators and physical devices remain unverified. No remote data was changed for these checks.

## Screenshots

The [screenshot folder](screenshots/activity-consistency-2026-10-30/) contains each tested width and theme, plus actual 75% desktop zoom and direct conversations.

| Surface | Light | Dark |
| --- | --- | --- |
| Desktop Beacons | [1440px](screenshots/activity-consistency-2026-10-30/light-1440-beacons.png) | [1440px](screenshots/activity-consistency-2026-10-30/dark-1440-beacons.png) |
| Desktop workspace | [1440px](screenshots/activity-consistency-2026-10-30/light-1440-beacons-workspace.png) | [1440px](screenshots/activity-consistency-2026-10-30/dark-1440-beacons-workspace.png) |
| Mobile workspace | [390px](screenshots/activity-consistency-2026-10-30/light-390-beacons-workspace.png) | [390px](screenshots/activity-consistency-2026-10-30/dark-390-beacons-workspace.png) |
| Desktop Chats | [1440px](screenshots/activity-consistency-2026-10-30/light-1440-chats.png) | [1440px](screenshots/activity-consistency-2026-10-30/dark-1440-chats.png) |
| Browser zoom | [75% Beacons](screenshots/activity-consistency-2026-10-30/light-desktop-75-beacons.png) | [75% Calendar](screenshots/activity-consistency-2026-10-30/dark-desktop-75-calendar.png) |

## Remaining opportunities

Keep the current shared width as the default. A future deliberately designed two-column desktop workspace could use more space, but should be evaluated separately from these compact single-column lists. The older RSVP browser fixtures need a separate refresh against the current demo records and live-response confirmation contract.
