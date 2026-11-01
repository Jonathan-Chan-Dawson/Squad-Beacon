# Unified tab navigation — 2026-10-31

Your Activity, Chats/Communities and Friends use shared text navigation with a thin animated accent underline. Chats and Friends secondary filters use compact rounded chips. Calendar retains its existing compact Month/Week switch. The shared controls use theme tokens, 44px minimum targets, visible keyboard focus and immediate selection feedback when reduced motion is enabled. Content remains bounded by the existing Profile width on desktop.

The implementation preserves the existing routes, selection handlers, account boundaries and scroll restoration. No backend or persistence changes were made. Concurrent Map work remains untouched.

## Verification

- Typecheck passed; 25 focused workspace, Calendar, Chats and Friends state tests passed.
- Eight browser journeys passed across 320, 390, 430 and 1440px in light and dark, exercising keyboard tabs, retained chat search and filter toggles, Friends filters, and horizontal overflow.
- Actual Chrome 75% page zoom passed in light and dark using isolated browser profiles. Existing workspace journeys passed in both themes across 320–430px, including retained search and Calendar state.
- The existing Friends journey passed: search and availability filters, list position, profile return and selection survived navigation.
- Calendar scheduling retained its selected date/timezone, and an expanded itinerary was restored after opening a Beacon. Full repository lint passed with the existing cache; the changed navigation files also passed lint directly.
- Isolated web export passed. Hosted and native-device acceptance were not run.

## Screenshots

- [Mobile Your Activity](screenshots/unified-tabs-2026-10-31/light-390-activity.png)
- [Mobile Chats](screenshots/unified-tabs-2026-10-31/light-390-chats.png)
- [Mobile Friends](screenshots/unified-tabs-2026-10-31/light-390-friends.png)
- [Desktop Your Activity, dark](screenshots/unified-tabs-2026-10-31/dark-1440-activity.png)
- [Desktop Chats, dark](screenshots/unified-tabs-2026-10-31/dark-1440-chats.png)
