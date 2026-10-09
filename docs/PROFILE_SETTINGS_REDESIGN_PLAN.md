# Prompt 5: Profile and Settings

The implementation uses Sol 6.1 with high reasoning and the shared Prompt 0 tokens. Phone layout is the primary target: full width, 16-point gutters, 16-point body copy, and at least 44-point hit targets. Earlier Prompt 4 native acceptance checks continue alongside this work.

## Ownership and integration

- Profile: gradient identity card, 96-point avatar, neutral counts, current availability, interests, aspiration progress, authorized memories, library, manager links, and platform-gated widgets. Reuse canonical profile and activity selectors.
- Profile visibility: reusable sheet and Settings route with Public/Friends/Custom selection and current eligible grants. Profile grants never grant activity or location access.
- Editor: full-screen `/profile/edit` modal with a sticky Save action and unsaved-change confirmation. Reuse the existing avatar upload pipeline, interest catalog, aspiration model, and three-step survey rather than introducing a second account model.
- Settings: searchable inset groups with direct Appearance, Privacy, Notifications, Beacon defaults, Location, Account, and Help entries. Native quiet-hour pickers must reflect the server's current whole-hour contract honestly.
- Root: dependency changes, integration, reciprocal review, targeted validation, and final evidence.

## Privacy and durable state

Sonar begins only after the viewer chooses accepted friends and a duration and explicitly confirms. Opening Profile, Settings, or a sheet does not request location or create a session. Use the existing four-hour maximum, expiry arithmetic, device lifecycle, and rollback on device permission failure. Recipient labels come from the viewer's current accepted-friend access. Location sharing remains separate from profile visibility.

Historical memory thumbnails require current activity, author, entry, storage-path, and viewer checks. Signed URLs expire and must be discarded on access changes. Do not make private media public to render the strip.

The server currently persists only private/friends Beacon defaults and whole-hour quiet boundaries. Extend defaults through viewer-scoped device preferences for List/Squad/Organization, then apply them to the create flow only if the target remains eligible. Do not claim unsupported defaults are account-synced. Notification permission, device push registration, and server capability are separate states; show them honestly. Do not invent notification preference APIs or report history beyond the viewer's returned reports.

## Motion, accessibility, and verification

Use existing Screen, GlassBar, SegmentedControl, DemoChip, palette tokens, and reduced-motion preference. Maintain phone-scale typography and safe-area spacing at 390 points. Destructive operations use danger styling and explicit confirmation; account deletion remains two-step.

Validate the real demo Profile/editor/visibility routes, Settings search and all ten palette/appearance combinations, dirty navigation, Sonar no-side-effect opening, and default audience creation. Native checks cover layout, bottom sheets, time picker, and keyboard; physical haptics, sustained release performance, and iOS-specific behavior remain documented device checks.

Versioned references read before implementation: [Expo Image SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/image/), [DateTimePicker SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/date-time-picker/), and [Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
