# Beacons feed redesign — Prompt 3

## Architecture and invariants

Reuse Prompt 0 tokens, primitives, shared sheets, canonical activity records, privacy helpers, and mutation APIs. `ActivitiesScreen` remains the store/route orchestration boundary. Extract presentational panels and a rich feed card so the three pages can be scanned without introducing a second activity or availability model.

The root verified the exact Expo SDK 57 documentation for [PagerView](https://docs.expo.dev/versions/v57.0.0/sdk/view-pager/) and [FlashList](https://docs.expo.dev/versions/v57.0.0/sdk/flash-list/). PagerView 8.0.2 is installed; FlashList 2.0.2 already exists. Use native PagerView with three stable page children and a web fallback that also supports swiping. Keep the shared sliding SegmentedControl synchronized for taps and completed swipes.

Status expresses availability only. Preserve existing status storage, edit/clear behavior and expiry; do not convert a status to attendance. Authorization, location freshness, memory readability and pending-invitation counts must use current selectors/helpers. Do not fabricate shared location, attendance, distance, aspiration linkage, invitations or memory thumbnails.

## Three disjoint Luna / XHigh packets

### C — feed integration and navigation

Own `ActivitiesScreen`, `PeriodTabs`, new platform-specific FeedPager modules and feed orchestration helpers. Own store reads/mutations and route/sheet wiring. Coordinate exported component contracts with A/B before integration.

- Large collapsing Beacons title, eyebrow, existing unread InboxButton, DemoChip; Now/Upcoming count badges.
- One FlashList per page, 16-point gutters, pull-to-refresh, skeletons, contextual empty/error/retry states, staggered first entry and measured/inset-aware bottom clearance for Create.
- Now composes status, vertically listed friends, and rich happening cards. Friend filter Everyone / Free to hang / Starred, inline expansion with layout animation, Find friends.
- Upcoming adds a horizontally scrolling week strip with actual event-day dots and scroll-to-group, shared area preference/Compass sheet entry, actual pending invitations banner opening Responses/PlanningInbox, sticky date headers and time rail. Reuse the shared AdvancedMapFilters sheet with active count.
- Past composes toolkit, month headers, authorized memory/history rows and optional linked aspiration progress. Create action works from the empty state.
- Use canonical status create/edit/clear and friend favorite APIs; use actual chat/profile/create/map routes. Custom status duration and presets must set real expiry. Conversion pre-fills create flow without silently RSVPing.
- The area sheet must share Map's preference/state source. Extract shared infrastructure only after agreement with current Map owner; do not invent a static Chicago label or independent location preference.

### B — status, friend and Past panels

Own new feed panel files only. Do not edit `ActivitiesScreen`, pager, `ActivityCard`, Map, or detail modules.

Export typed presentational components with derived view models and explicit callbacks; no duplicate store model:

- Status card/sheet: avatar, availability icon/dot, prompt, presets Free for 1 hr / Free tonight / Busy, custom text and duration, availability explanation, active countdown, Edit/Clear/Turn into a Beacon. Callback contract covers save payload, edit, clear, convert and close.
- Friends: ring plus non-color availability icon, name/status/time chip; fresh shared-location indicator only from authorized boolean supplied by integration. Separate minimum 44-point profile avatar, row/chat, Message and Star targets. Filter and expansion state may be passed in; expansion animation respects reduced motion.
- Toolkit: equal-size 2x2 tiles with distinct soft tints, icons, actual counts and callbacks for Beacon Plans, Favorites, My templates, Library.
- History row: optional readable memory thumbnail, title/date/people. Weekly progress strip only when supplied linked aspirations; calm rings without achievement mechanics.
- Friendly Past empty state with requested copy and Create button.

### A — rich reusable Beacon feed cards

Own new `BeaconFeedCard` and its helpers. Prefer composing canonical ActivityCard/action logic instead of changing ActivityCard's behavior across detail/Map consumers. Any shared ActivityCard edit requires C's explicit coordination.

- Category edge/CategoryBadge, title and prominent host; Live pulsing dot, countdown and accurate elapsed progress for active records; location, actual distance when known, going AvatarStack and accurate remaining capacity.
- Large one-tap I'm In and Maybe plus separate Map/Chat icon targets. Reuse real canonical RSVP mutation/error behavior; show existing participation correctly.
- Right swipe = I'm In and left swipe = Maybe with colored reveals and haptic feedback. Coordinate card horizontal gesture ownership with PagerView so page swipes remain reachable and neither gesture triggers accidentally. Preserve accessible button alternatives and vertical list scrolling.
- Long press opens actionable Save / Share / Report context menu using actual existing services/routes. Repeated save state must remain truthful; canceled sheets do not mutate.
- Same card supports upcoming timeline cells and active cards without duplicating RSVP logic. Card receives activity/viewer-derived data and explicit callbacks for RSVP, Map, Chat, Save, Share and Report.

## Requirement matrix and review gates

| Surface | Required coverage | Owner |
| --- | --- | --- |
| Header | Collapse, correct title/eyebrow, unread bell, DemoChip, sliding/count segments | C |
| Navigation | Native and web swipe, tap/swipe synchronization, state retention | C |
| Status | Real presets/custom duration, countdown/expiry, edit/clear/convert | B UI + C actions |
| Friends | Three filters, vertical rows, privacy-safe location, separate targets, expand/find | B UI + C selectors/actions |
| Active cards | All metadata, countdown/progress, canonical RSVP, directional gestures/menu | A |
| Upcoming | Week jump/dots, shared area, real inbox, sticky timeline, active filters | C + A card |
| Past | Four counted tiles, monthly readable history, linked rings, empty Create | B UI + C selectors/actions |
| Lists | FlashList, refresh/loading/error/empty, stagger, gutters, Create clearance | C |

Review completed packets before broad validation. Typecheck and lint changed files; run focused existing tests for touched behavior. Inspect rendering on narrow screens and verify one tap/swipe RSVP, canceled/error mutations, expired statuses, no-location friends, unread count updates, and no-memory history. Native device acceptance must cover the installed PagerView build, simultaneous card/page gestures, sticky/date jumping, refresh, keyboard/sheet dismissal and bottom clearance; web acceptance must cover swipe fallback and scrolling. Report device-only checks honestly if unavailable.

Do not treat demo content, placeholder callbacks, dead menus, static counts, static area labels, a horizontal friends carousel or a ScrollView replacing the page lists as completion.
